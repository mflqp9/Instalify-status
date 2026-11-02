import "server-only";

import type { RailwayProvider } from "@/config/providers";

import { toLevel, worst } from "./levels";
import { assembleProvider, componentPath, fetchJson, matchesFocus, prettyStatus } from "./shared";
import type { ComponentState, GroupState, Incident, Level, Maintenance, ProviderStatus } from "./types";

// Railway's own status page (status.railway.com, since 2026) serves everything
// it renders from one JSON endpoint. Components carry 90-day uptime but no
// "current status" field: what is broken right now is whatever an unresolved
// incident or running maintenance says it is.

interface RwComponent {
  id: string;
  name: string;
  uptimePercentage?: string;
}

type RwEntry = { type: "group"; data: { id: string; name: string; components: RwComponent[] } } | { type: "component"; data: RwComponent };

interface RwAffected {
  id: string;
  name: string;
  groupName: string | null;
  impact: string;
}

interface RwIncident {
  id: string;
  slug?: string;
  title: string;
  status: string;
  createdAt: string;
  resolvedAt: string | null;
  components?: RwAffected[];
  updates?: { status: string; message: string; createdAt: string }[];
}

interface RwMaintenance extends Partial<RwIncident> {
  id: string;
  title?: string;
  name?: string;
  status: string;
  startsAt?: string;
  endsAt?: string;
  scheduledFor?: string;
  scheduledUntil?: string;
}

interface RwStatus {
  entries: RwEntry[];
  activeIncidents?: RwIncident[];
  recentIncidents?: RwIncident[];
  maintenances?: RwMaintenance[];
}

const UNGROUPED = "Platform";

export async function loadRailway(config: RailwayProvider, now: Date): Promise<ProviderStatus> {
  const data = await fetchJson<RwStatus>(config.apiUrl);
  const active = (data.activeIncidents ?? []).filter((i) => i.status !== "RESOLVED");

  const current = new Map<string, Level>();
  for (const incident of active) {
    for (const c of incident.components ?? []) current.set(c.id, worst([current.get(c.id) ?? "operational", toLevel(c.impact)]));
  }
  const runningMaintenance = (data.maintenances ?? []).filter((m) => /progress/i.test(m.status));
  for (const m of runningMaintenance) for (const c of m.components ?? []) current.set(c.id, worst([current.get(c.id) ?? "operational", "maintenance"]));

  const toState = (c: RwComponent, group: string | null): ComponentState => ({
    id: c.id,
    name: c.name,
    group,
    level: current.get(c.id) ?? "operational",
    uptime: c.uptimePercentage,
  });
  const ungrouped: GroupState = { id: "ungrouped", name: UNGROUPED, level: "operational", components: [] };
  const groups: GroupState[] = [];
  for (const entry of data.entries) {
    if (entry.type === "group") {
      groups.push({
        id: entry.data.id,
        name: entry.data.name,
        level: "operational",
        components: entry.data.components.map((c) => toState(c, entry.data.name)),
      });
    } else {
      ungrouped.components.push(toState(entry.data, null));
    }
  }
  groups.push(ungrouped);

  const label = (c: RwAffected) => (c.groupName ? `${c.groupName} · ${c.name}` : c.name);
  const touchesFocus = (list: RwAffected[]) => list.some((c) => matchesFocus(componentPath(c.groupName, c.name), config.focus));
  const url = (i: { id: string; slug?: string }) => `${config.pageUrl}/incident/${i.slug ?? i.id}`;

  const toIncident = (i: RwIncident): Incident => {
    const affected = i.components ?? [];
    const latest = [...(i.updates ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    return {
      id: i.id,
      title: i.title,
      level: worst(affected.map((c) => toLevel(c.impact))),
      status: prettyStatus(i.status),
      startedAt: i.createdAt,
      resolvedAt: i.resolvedAt,
      url: url(i),
      affected: affected.map(label),
      relevant: affected.length === 0 || touchesFocus(affected),
      latest: latest ? { status: prettyStatus(latest.status), body: latest.message, at: latest.createdAt } : null,
    };
  };

  const activeIncidents = active.map(toIncident);
  const activeIds = new Set(activeIncidents.map((i) => i.id));
  const past = [...activeIncidents, ...(data.recentIncidents ?? []).filter((i) => !activeIds.has(i.id)).map(toIncident)];

  const maintenances: Maintenance[] = (data.maintenances ?? [])
    .map((m) => {
      const affected = m.components ?? [];
      const endsAt = m.endsAt ?? m.scheduledUntil ?? null;
      return {
        id: m.id,
        title: m.title ?? m.name ?? "Scheduled maintenance",
        status: prettyStatus(m.status),
        inProgress: /progress/i.test(m.status),
        startsAt: m.startsAt ?? m.scheduledFor ?? m.createdAt ?? null,
        endsAt,
        url: url(m),
        affected: affected.map(label),
        relevant: touchesFocus(affected),
      };
    })
    .filter((m) => !/complete|resolved/i.test(m.status) && (!m.endsAt || new Date(m.endsAt) > now));

  const officialLevel = worst([...current.values(), ...activeIncidents.map((i) => i.level)]);
  return assembleProvider(
    config,
    {
      official: {
        level: officialLevel,
        text: officialLevel === "operational" ? "All systems operational" : `${activeIncidents.length} active incident${activeIncidents.length === 1 ? "" : "s"}`,
      },
      groups,
      incidents: activeIncidents,
      maintenances,
      past,
      coverageFrom: null,
    },
    now,
  );
}
