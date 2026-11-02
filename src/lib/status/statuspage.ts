import "server-only";

import type { StatuspageProvider } from "@/config/providers";

import { toLevel } from "./levels";
import { assembleProvider, componentPath, fetchJson, matchesFocus, ruledOutByTitle, prettyStatus } from "./shared";
import type { ComponentState, GroupState, Incident, Maintenance, ProviderStatus } from "./types";

// Atlassian Statuspage public API (Cloudflare, Vercel):
//   /summary.json   — components, unresolved incidents, upcoming maintenance
//   /incidents.json — the latest 50 incidents, for the history strip

interface SpComponent {
  id: string;
  name: string;
  status: string;
  position: number;
  group_id: string | null;
  group: boolean;
  only_show_if_degraded?: boolean;
  components?: string[];
}

interface SpUpdate {
  status: string;
  body: string;
  created_at: string;
  display_at?: string;
}

interface SpIncident {
  id: string;
  name: string;
  status: string;
  impact: string;
  created_at: string;
  started_at?: string | null;
  resolved_at: string | null;
  shortlink?: string;
  scheduled_for?: string | null;
  scheduled_until?: string | null;
  incident_updates?: SpUpdate[];
  components?: { id: string; name: string; group_id?: string | null }[];
}

interface SpSummary {
  status: { indicator: string; description: string };
  components: SpComponent[];
  incidents: SpIncident[];
  scheduled_maintenances: SpIncident[];
}

const FEED_CAP = 50;

export async function loadStatuspage(config: StatuspageProvider, now: Date): Promise<ProviderStatus> {
  const [summary, history] = await Promise.all([
    fetchJson<SpSummary>(`${config.apiBase}/summary.json`),
    fetchJson<{ incidents: SpIncident[] }>(`${config.apiBase}/incidents.json`).catch(() => ({ incidents: [] })),
  ]);

  const byId = new Map(summary.components.map((c) => [c.id, c]));
  const groupName = (c: { group_id?: string | null }) => (c.group_id ? byId.get(c.group_id)?.name ?? null : null);

  const toState = (c: SpComponent): ComponentState => ({
    id: c.id,
    name: c.name,
    group: groupName(c),
    level: toLevel(c.status),
  });
  const visible = (c: SpComponent) => !(c.only_show_if_degraded && c.status === "operational");

  const ungrouped: GroupState = { id: "ungrouped", name: config.ungroupedName, level: "operational", components: [] };
  const groups: GroupState[] = [];
  for (const top of [...summary.components].filter((c) => !c.group_id).sort((a, b) => a.position - b.position)) {
    if (top.group) {
      const children = (top.components ?? [])
        .map((id) => byId.get(id))
        .filter((c): c is SpComponent => !!c && visible(c))
        .sort((a, b) => a.position - b.position);
      groups.push({ id: top.id, name: top.name, level: "operational", components: children.map(toState) });
    } else if (visible(top)) {
      ungrouped.components.push(toState(top));
    }
  }
  // Single components first, the way the provider pages show them.
  groups.unshift(ungrouped);

  const affectedOf = (i: SpIncident): Affected[] =>
    (i.components ?? []).map((c) => {
      const known = byId.get(c.id);
      return { group: groupName(known ?? c), name: known?.name ?? c.name };
    });
  const touchesFocus = (affected: Affected[]) =>
    affected.some((a) => matchesFocus(componentPath(a.group, a.name), config.focus));

  const isRelevant = (title: string, affected: Affected[]) => {
    // Locations (Cloudflare cities, Vercel CDN regions) are the most precise
    // signal: an incident pinned only to cities that are not ours is elsewhere.
    const places = affected.filter((a) => a.group && LOCATION_GROUPS.test(a.group));
    if (places.length) return touchesFocus(places);
    if (ruledOutByTitle(title, config)) return false;
    // No component listed means the provider did not say; count it.
    return affected.length === 0 || touchesFocus(affected);
  };

  const toIncident = (i: SpIncident): Incident => {
    const affected = affectedOf(i);
    const latest = [...(i.incident_updates ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    return {
      id: i.id,
      title: i.name,
      level: toLevel(i.impact),
      status: prettyStatus(i.status),
      startedAt: i.started_at ?? i.created_at,
      resolvedAt: i.resolved_at,
      url: i.shortlink ?? `${config.pageUrl}/incidents/${i.id}`,
      affected: affected.map(label),
      relevant: isRelevant(i.name, affected),
      latest: latest ? { status: prettyStatus(latest.status), body: latest.body, at: latest.display_at ?? latest.created_at } : null,
    };
  };

  const maintenances: Maintenance[] = summary.scheduled_maintenances
    .filter((m) => !m.scheduled_until || new Date(m.scheduled_until) > now)
    .map((m) => {
      const affected = affectedOf(m);
      return {
        id: m.id,
        title: m.name,
        status: prettyStatus(m.status),
        inProgress: m.status === "in_progress" || m.status === "verifying",
        startsAt: m.scheduled_for ?? null,
        endsAt: m.scheduled_until ?? null,
        url: m.shortlink ?? `${config.pageUrl}/incidents/${m.id}`,
        affected: affected.map(label),
        // Maintenance is announced for every city; only ours should stand out.
        relevant: touchesFocus(affected),
      };
    });

  const active = summary.incidents.map(toIncident);
  const activeIds = new Set(active.map((i) => i.id));
  const past = [...active, ...history.incidents.filter((i) => !activeIds.has(i.id) && i.impact !== "maintenance").map(toIncident)];
  const oldest = history.incidents.at(-1);

  return assembleProvider(
    config,
    {
      official: { level: toLevel(summary.status.indicator), text: summary.status.description },
      groups,
      incidents: active,
      maintenances,
      past,
      coverageFrom: history.incidents.length >= FEED_CAP && oldest ? oldest.created_at : null,
    },
    now,
  );
}

interface Affected {
  group: string | null;
  name: string;
}

// Groups whose components are places rather than services.
const LOCATION_GROUPS = /^(North America|Europe|Asia|Africa|Oceania|Middle East|Latin America.*|CDN)$/;

// Cloudflare's service group and its continent groups add nothing to a city or
// service name, so they are left off the label.
const QUIET_GROUPS = /Sites and Services|^(North America|Europe|Asia|Africa|Oceania|Middle East|Latin America)/;

function label({ group, name }: Affected): string {
  return !group || QUIET_GROUPS.test(group) ? name : `${group} · ${name}`;
}
