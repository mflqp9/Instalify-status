import "server-only";

import { HISTORY_DAYS, TIME_ZONE, type FocusMatcher, type ProviderConfig } from "@/config/providers";

import { isProblem, rank, worst } from "./levels";
import type {
  ComponentState,
  GroupState,
  HistoryDay,
  Incident,
  Level,
  Maintenance,
  ProviderStatus,
} from "./types";

const TIMEOUT_MS = 8000;

export async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { accept: "application/json", "user-agent": "instalify-status/1.0 (+https://status.instalify.app)" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`${url} answered ${res.status}`);
  return (await res.json()) as T;
}

export function componentPath(group: string | null, name: string): string {
  return group ? `${group}/${name}` : name;
}

export function matchesFocus(path: string, focus: FocusMatcher[]): boolean {
  return focus.some((m) => (typeof m === "string" ? m === path : m.test(path)));
}

/** The title says the incident is about another place, or a feature Instalify does not use. */
export function ruledOutByTitle(title: string, config: ProviderConfig): boolean {
  const rule = config.regional;
  if (rule && rule.elsewhere.test(title) && !rule.ours.test(title)) return true;
  return !!config.unused?.test(title);
}

/** Groups keep the provider's order; inside a group, problems sort first. */
export function finishGroups(groups: GroupState[]): GroupState[] {
  return groups
    .filter((g) => g.components.length > 0)
    .map((g) => ({
      ...g,
      level: worst(g.components.map((c) => c.level)),
      components: [...g.components].sort((a, b) => rank(b.level) - rank(a.level)),
    }));
}

/** Focus components in the order the focus list names them. */
export function pickFocus(components: ComponentState[], focus: FocusMatcher[]): ComponentState[] {
  const picked: ComponentState[] = [];
  for (const matcher of focus) {
    for (const c of components) {
      if (matchesFocus(componentPath(c.group, c.name), [matcher]) && !picked.includes(c)) picked.push(c);
    }
  }
  return picked;
}

const dayKey = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function pakistanDate(at: Date | string): string {
  return dayKey.format(typeof at === "string" ? new Date(at) : at);
}

/**
 * One cell per day for the last HISTORY_DAYS days, coloured by the worst
 * relevant incident open that day. Incident feeds are capped (Statuspage returns
 * the latest 50), so when the cap was hit, days older than the oldest incident
 * we got are "nodata" rather than a green they have not earned.
 */
export function buildHistory(incidents: Incident[], now: Date, coverageFrom: string | null): HistoryDay[] {
  const days: HistoryDay[] = [];
  const coverageDay = coverageFrom ? pakistanDate(coverageFrom) : null;
  for (let i = HISTORY_DAYS - 1; i >= 0; i -= 1) {
    const date = pakistanDate(new Date(now.getTime() - i * 86_400_000));
    days.push({ date, level: coverageDay && date < coverageDay ? "nodata" : "operational", incidents: [] });
  }
  const today = pakistanDate(now);
  for (const incident of incidents) {
    if (!incident.relevant) continue;
    const from = pakistanDate(incident.startedAt);
    const to = incident.resolvedAt ? pakistanDate(incident.resolvedAt) : today;
    for (const day of days) {
      if (day.date < from || day.date > to || day.level === "nodata") continue;
      day.incidents.push(incident.title);
      if (rank(incident.level) > rank(day.level as Level)) day.level = incident.level;
    }
  }
  return days;
}

export function withinHistory(at: string, now: Date): boolean {
  return now.getTime() - new Date(at).getTime() <= HISTORY_DAYS * 86_400_000;
}

/** "investigating" / "MONITORING" / "maintenance_in_progress" → "Investigating" etc. */
export function prettyStatus(raw: string): string {
  const text = raw.replace(/^maintenance_/i, "").replace(/_/g, " ").toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export interface ProviderParts {
  official: { level: Level; text: string };
  groups: GroupState[];
  /** Unresolved incidents. */
  incidents: Incident[];
  maintenances: Maintenance[];
  /** Every incident we know of, open or resolved, for the history strip. */
  past: Incident[];
  /** Oldest incident start when the feed was capped, else null. */
  coverageFrom: string | null;
}

export function assembleProvider(config: ProviderConfig, parts: ProviderParts, now: Date): ProviderStatus {
  const groups = finishGroups(parts.groups);
  const all = groups.flatMap((g) => g.components);
  const focus = pickFocus(all, config.focus);

  const focusLevel = worst([
    ...focus.map((c) => c.level),
    ...parts.incidents.filter((i) => i.relevant).map((i) => i.level),
    ...parts.maintenances.filter((m) => m.relevant && m.inProgress).map((): Level => "maintenance"),
  ]);
  // A focus list that matches nothing means the provider renamed something.
  // Fall back to their own headline rather than claim a green we did not check.
  if (focus.length === 0) console.warn(`[status] ${config.id}: no focus component matched`);
  const level = focus.length === 0 ? parts.official.level : focusLevel;

  const recent = parts.past
    .filter((i) => i.resolvedAt && withinHistory(i.startedAt, now))
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));

  return {
    id: config.id,
    name: config.name,
    role: config.role,
    impact: config.impact,
    pageUrl: config.pageUrl,
    available: true,
    level,
    official: parts.official,
    focus: { title: config.focusTitle, components: focus },
    groups,
    componentCount: all.length,
    affectedCount: all.filter((c) => isProblem(c.level) || c.level === "maintenance").length,
    incidents: [...parts.incidents].sort((a, b) => Number(b.relevant) - Number(a.relevant) || rank(b.level) - rank(a.level)),
    maintenances: [...parts.maintenances].sort(
      (a, b) => Number(b.relevant) - Number(a.relevant) || (a.startsAt ?? "").localeCompare(b.startsAt ?? ""),
    ),
    recent,
    history: buildHistory(parts.past, now, parts.coverageFrom),
  };
}

/** What the page shows when a provider's API could not be read. */
export function unavailableProvider(config: ProviderConfig, now: Date): ProviderStatus {
  return {
    id: config.id,
    name: config.name,
    role: config.role,
    impact: config.impact,
    pageUrl: config.pageUrl,
    available: false,
    level: "unknown",
    official: null,
    focus: { title: config.focusTitle, components: [] },
    groups: [],
    componentCount: 0,
    affectedCount: 0,
    incidents: [],
    maintenances: [],
    recent: [],
    history: buildHistory([], now, now.toISOString()).map((d) => ({ ...d, level: "nodata" })),
  };
}
