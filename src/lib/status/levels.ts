import type { Level } from "./types";

// Pure helpers shared by the server adapters and the client components.

const RANK: Record<Level, number> = {
  operational: 0,
  unknown: 1,
  maintenance: 2,
  degraded: 3,
  partial: 4,
  major: 5,
};

export function rank(level: Level): number {
  return RANK[level];
}

/** The most severe of `levels`; operational when the list is empty. */
export function worst(levels: Iterable<Level>): Level {
  let result: Level = "operational";
  for (const level of levels) if (RANK[level] > RANK[result]) result = level;
  return result;
}

/** True for anything a user should be warned about. */
export function isProblem(level: Level): boolean {
  return RANK[level] >= RANK.degraded;
}

export const LEVEL_LABEL: Record<Level, string> = {
  operational: "Operational",
  unknown: "Unknown",
  maintenance: "Maintenance",
  degraded: "Degraded",
  partial: "Partial outage",
  major: "Major outage",
};

export const LEVEL_HEADLINE: Record<Level, string> = {
  operational: "All systems operational",
  unknown: "Some statuses could not be checked",
  maintenance: "Scheduled maintenance in progress",
  degraded: "Some services are running slowly",
  partial: "Some services are down",
  major: "Major outage in progress",
};

// The four vendors all use the same vocabulary with different spellings.
const ALIASES: Record<string, Level> = {
  operational: "operational",
  none: "operational",
  up: "operational",
  degraded_performance: "degraded",
  degraded: "degraded",
  minor: "degraded",
  partial_outage: "partial",
  major: "partial",
  major_outage: "major",
  full_outage: "major",
  critical: "major",
  under_maintenance: "maintenance",
  maintenance: "maintenance",
};

export function toLevel(raw: string | null | undefined): Level {
  if (!raw) return "unknown";
  return ALIASES[raw.toLowerCase()] ?? "unknown";
}
