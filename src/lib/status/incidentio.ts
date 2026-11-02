import "server-only";

import type { IncidentIoProvider } from "@/config/providers";

import { toLevel, worst } from "./levels";
import { assembleProvider, componentPath, fetchJson, matchesFocus, ruledOutByTitle, prettyStatus } from "./shared";
import type { ComponentState, GroupState, Incident, Level, Maintenance, ProviderStatus } from "./types";

// incident.io status pages (Supabase since 2026). Two sources:
//   /proxy/<domain>          — what their own page renders: the component tree,
//                              per-component impacts, ongoing incidents, maintenance
//   /api/v2/incidents.json   — a Statuspage-compatible list of recent incidents
//                              (no components), used for status text and history

interface IioRef {
  component_id: string;
  name: string;
  hidden?: boolean;
}

interface IioImpact {
  component_id: string;
  status: string;
  start_at?: string | null;
  end_at?: string | null;
}

interface IioTextNode {
  type?: string;
  text?: string;
  content?: IioTextNode[];
}

interface IioEvent {
  id: string;
  name: string;
  status: string;
  published_at?: string;
  type?: string;
  component_impacts?: IioImpact[];
  affected_components?: { id?: string; component_id?: string; name?: string; status?: string }[];
  current_worst_impact?: string;
  last_update_message?: string;
  updates?: { published_at?: string; message?: { text_node?: IioTextNode } }[];
}

interface IioSummary {
  summary: {
    structure: { items: ({ group: { id: string; name: string; hidden?: boolean; components: IioRef[] } } | { component: IioRef })[] };
    affected_components?: { component_id: string; status: string }[];
    ongoing_incidents?: IioEvent[];
    scheduled_maintenances?: IioEvent[];
    in_progress_maintenances?: IioEvent[];
  };
}

interface CompatIncident {
  id: string;
  name: string;
  status: string;
  impact: string;
  created_at: string;
  resolved_at: string | null;
  incident_updates?: { status: string; body: string; created_at: string; display_at?: string }[];
}

// Maintenance with no dates that was published this long ago is a leftover
// (Supabase still lists a "scheduled" window from July).
const STALE_UNDATED_MS = 7 * 86_400_000;

export async function loadIncidentIo(config: IncidentIoProvider, now: Date): Promise<ProviderStatus> {
  const [widget, compat] = await Promise.all([
    fetchJson<IioSummary>(config.widgetUrl),
    fetchJson<{ incidents: CompatIncident[] }>(config.incidentsUrl).catch(() => ({ incidents: [] })),
  ]);
  const s = widget.summary;

  // Current level per component: the page-wide list, plus any impact on an
  // ongoing incident or running maintenance that has not ended yet.
  const current = new Map<string, Level>();
  const bump = (id: string, level: Level) => current.set(id, worst([current.get(id) ?? "operational", level]));
  for (const a of s.affected_components ?? []) bump(a.component_id, toLevel(a.status));
  for (const event of [...(s.ongoing_incidents ?? []), ...(s.in_progress_maintenances ?? [])]) {
    for (const impact of openImpacts(event, now)) bump(impact.component_id, toLevel(impact.status));
  }

  const names = new Map<string, { group: string | null; name: string }>();
  const ungrouped: GroupState = { id: "ungrouped", name: config.ungroupedName, level: "operational", components: [] };
  const groups: GroupState[] = [];
  const toState = (ref: IioRef, group: string | null): ComponentState => {
    names.set(ref.component_id, { group, name: ref.name });
    return { id: ref.component_id, name: ref.name, group, level: current.get(ref.component_id) ?? "operational" };
  };
  for (const item of s.structure.items) {
    if ("group" in item) {
      if (item.group.hidden) continue;
      groups.push({
        id: item.group.id,
        name: item.group.name,
        level: "operational",
        components: item.group.components.filter((c) => !c.hidden).map((c) => toState(c, item.group.name)),
      });
    } else if (!item.component.hidden) {
      ungrouped.components.push(toState(item.component, null));
    }
  }
  groups.unshift(ungrouped);

  const affectedOf = (event: IioEvent | undefined) => {
    if (!event) return [];
    const ids = new Set([
      ...(event.component_impacts ?? []).map((i) => i.component_id),
      ...(event.affected_components ?? []).map((a) => a.component_id ?? a.id ?? ""),
    ]);
    return [...ids].map((id) => names.get(id)).filter((n): n is { group: string | null; name: string } => !!n);
  };
  const label = (n: { group: string | null; name: string }) => (n.group ? `${n.group} · ${n.name}` : n.name);
  const touchesFocus = (list: { group: string | null; name: string }[]) =>
    list.some((n) => matchesFocus(componentPath(n.group, n.name), config.focus));

  const ongoing = new Map((s.ongoing_incidents ?? []).map((e) => [e.id, e]));
  const toIncident = (i: CompatIncident): Incident => {
    const event = ongoing.get(i.id);
    const affected = affectedOf(event);
    const latest = [...(i.incident_updates ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    const eventLevel = event ? worst(openImpacts(event, now).map((x) => toLevel(x.status))) : "operational";
    return {
      id: i.id,
      title: i.name,
      level: worst([toLevel(i.impact), eventLevel, event?.current_worst_impact ? toLevel(event.current_worst_impact) : "operational"]),
      status: prettyStatus(i.status),
      startedAt: i.created_at,
      resolvedAt: i.resolved_at,
      url: `${config.pageUrl}/incidents/${i.id}`,
      affected: affected.map(label),
      // The compatible feed carries no components, so without the live widget
      // only the title can rule an incident out.
      relevant: affected.length ? touchesFocus(affected) : !ruledOutByTitle(i.name, config),
      latest: latest
        ? { status: prettyStatus(latest.status), body: latest.body, at: latest.display_at ?? latest.created_at }
        : null,
    };
  };

  const past = compat.incidents.map(toIncident);
  const active = past.filter((i) => !i.resolvedAt);
  // An ongoing incident the compatible feed has not picked up yet.
  for (const event of ongoing.values()) {
    if (active.some((i) => i.id === event.id)) continue;
    const affected = affectedOf(event);
    const incident: Incident = {
      id: event.id,
      title: event.name,
      level: worst([
        ...openImpacts(event, now).map((x) => toLevel(x.status)),
        event.current_worst_impact ? toLevel(event.current_worst_impact) : "degraded",
      ]),
      status: prettyStatus(event.status),
      startedAt: event.published_at ?? now.toISOString(),
      resolvedAt: null,
      url: `${config.pageUrl}/incidents/${event.id}`,
      affected: affected.map(label),
      relevant: affected.length ? touchesFocus(affected) : !ruledOutByTitle(event.name, config),
      latest: latestText(event),
    };
    active.push(incident);
    past.push(incident);
  }

  const maintenances: Maintenance[] = [...(s.in_progress_maintenances ?? []), ...(s.scheduled_maintenances ?? [])]
    .map((m) => {
      const starts = minIso((m.component_impacts ?? []).map((i) => i.start_at));
      const ends = maxIso((m.component_impacts ?? []).map((i) => i.end_at));
      const affected = affectedOf(m);
      return {
        id: m.id,
        title: m.name,
        status: prettyStatus(m.status),
        inProgress: /in_progress/.test(m.status) || (!!starts && new Date(starts) <= now && (!ends || new Date(ends) > now)),
        startsAt: starts,
        endsAt: ends,
        url: `${config.pageUrl}/incidents/${m.id}`,
        affected: affected.map(label),
        relevant: touchesFocus(affected),
        published: m.published_at ?? null,
      };
    })
    .filter((m) => {
      if (m.endsAt) return new Date(m.endsAt) > now;
      if (m.startsAt) return true;
      return !!m.published && now.getTime() - new Date(m.published).getTime() < STALE_UNDATED_MS;
    })
    .map(({ published: _published, ...m }) => m);

  const officialLevel = worst([...current.values(), ...active.map((i) => i.level)]);
  return assembleProvider(
    config,
    {
      official: { level: officialLevel, text: officialText(officialLevel) },
      groups,
      incidents: active,
      maintenances,
      past,
      // The compatible feed returns a short list (25 on 2026-11-02, back to
      // late September), which already covers the 14-day strip.
      coverageFrom: null,
    },
    now,
  );
}

function openImpacts(event: IioEvent, now: Date): IioImpact[] {
  return (event.component_impacts ?? []).filter((i) => !i.end_at || new Date(i.end_at) > now);
}

function latestText(event: IioEvent): Incident["latest"] {
  if (event.last_update_message) {
    return { status: prettyStatus(event.status), body: event.last_update_message, at: event.published_at ?? "" };
  }
  const update = event.updates?.[0];
  if (!update?.message?.text_node) return null;
  return { status: prettyStatus(event.status), body: flatten(update.message.text_node).trim(), at: update.published_at ?? "" };
}

/** incident.io stores updates as a ProseMirror document. */
function flatten(node: IioTextNode): string {
  if (node.text) return node.text;
  const inner = (node.content ?? []).map(flatten).join("");
  return node.type === "paragraph" || node.type === "listItem" ? `${inner}\n` : inner;
}

function minIso(values: (string | null | undefined)[]): string | null {
  const list = values.filter((v): v is string => !!v).sort();
  return list[0] ?? null;
}

function maxIso(values: (string | null | undefined)[]): string | null {
  const list = values.filter((v): v is string => !!v).sort();
  return list.at(-1) ?? null;
}

function officialText(level: Level): string {
  switch (level) {
    case "operational":
      return "All Systems Operational";
    case "maintenance":
      return "Under Maintenance";
    case "degraded":
      return "Degraded Performance";
    case "partial":
      return "Partial Outage";
    case "major":
      return "Major Outage";
    default:
      return "Status unknown";
  }
}
