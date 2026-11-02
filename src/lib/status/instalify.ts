import "server-only";

import { INSTALIFY } from "@/config/providers";

import type { Level, SystemCheck } from "./types";

// Instalify's own pieces, checked directly rather than through a provider page.
// The database and Redis are read through the API's public health route, so
// this site holds no credentials for either and checks them from where it
// matters: the API server, in the same region as both.

const TIMEOUT_MS = 10_000;
const SLOW_PAGE_MS = 4000;
const SLOW_DB_MS = 100;
const DOWN_DB_MS = 500;
const SLOW_REDIS_MS = 100;

interface Health {
  status?: string;
  db?: { medianMs?: number; minMs?: number; maxMs?: number };
  redis?: { configured?: boolean; state?: string; pingMs?: number; downForSeconds?: number };
}

async function timed(url: string): Promise<{ res: Response | null; ms: number; error: string | null }> {
  const t0 = performance.now();
  try {
    const res = await fetch(url, {
      headers: { "user-agent": "instalify-status/1.0 (+https://status.instalify.app)" },
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return { res, ms: Math.round(performance.now() - t0), error: null };
  } catch (error) {
    const timeout = error instanceof Error && error.name === "TimeoutError";
    return { res: null, ms: Math.round(performance.now() - t0), error: timeout ? "No answer within 10 s" : "Could not connect" };
  }
}

export async function checkInstalify(): Promise<SystemCheck[]> {
  const [site, health] = await Promise.all([timed(INSTALIFY.websiteUrl), timed(INSTALIFY.healthUrl)]);
  await site.res?.body?.cancel().catch(() => undefined);

  return [websiteCheck(site), ...(await apiChecks(health))];
}

function websiteCheck({ res, ms, error }: Awaited<ReturnType<typeof timed>>): SystemCheck {
  const base = { id: "website", name: "Website & app", detail: "instalify.app" } as const;
  if (!res) return { ...base, level: "major", note: error ?? "Not reachable", latencyMs: null, metrics: [] };
  const level: Level = res.status >= 500 ? "major" : res.status >= 400 ? "partial" : ms > SLOW_PAGE_MS ? "degraded" : "operational";
  const note =
    level === "operational" ? "Opening normally" : level === "degraded" ? "Opening, but slowly" : `Answered with an error (HTTP ${res.status})`;
  return { ...base, level, note, latencyMs: ms, metrics: [{ label: "HTTP", value: String(res.status) }] };
}

async function apiChecks({ res, ms, error }: Awaited<ReturnType<typeof timed>>): Promise<SystemCheck[]> {
  const api = { id: "api", name: "API server", detail: "api.instalify.app" } as const;
  const database = { id: "database", name: "Database", detail: "PostgreSQL · Supabase Singapore" } as const;
  const redis = { id: "redis", name: "Redis", detail: "Sessions, rate limits & live alerts" } as const;
  const unknownBehindApi = "Cannot be checked while the API is not answering";

  if (!res) {
    return [
      { ...api, level: "major", note: error ?? "Not reachable", latencyMs: null, metrics: [] },
      { ...database, level: "unknown", note: unknownBehindApi, latencyMs: null, metrics: [] },
      { ...redis, level: "unknown", note: unknownBehindApi, latencyMs: null, metrics: [] },
    ];
  }

  let body: Health = {};
  try {
    body = (await res.json()) as Health;
  } catch {
    // A proxy error page instead of JSON; the HTTP status below says enough.
  }

  // 503 with status "db_error" is the API itself answering that Postgres failed.
  const apiAnswered = res.ok || body.status === "db_error";
  const apiCheck: SystemCheck = apiAnswered
    ? { ...api, level: ms > SLOW_PAGE_MS ? "degraded" : "operational", note: ms > SLOW_PAGE_MS ? "Answering, but slowly" : "Answering normally", latencyMs: ms, metrics: [] }
    : { ...api, level: "major", note: `Answered with an error (HTTP ${res.status})`, latencyMs: ms, metrics: [] };
  if (!apiAnswered) {
    return [
      apiCheck,
      { ...database, level: "unknown", note: unknownBehindApi, latencyMs: null, metrics: [] },
      { ...redis, level: "unknown", note: unknownBehindApi, latencyMs: null, metrics: [] },
    ];
  }

  return [apiCheck, databaseCheck(database, body), redisCheck(redis, body)];
}

function databaseCheck(base: Pick<SystemCheck, "id" | "name" | "detail">, body: Health): SystemCheck {
  // The error text is deliberately not shown: it is the database driver's.
  if (body.status === "db_error" || !body.db || body.db.medianMs === undefined) {
    return { ...base, level: "major", note: "Not answering queries — records cannot be read or saved", latencyMs: null, metrics: [] };
  }
  const { medianMs, minMs, maxMs } = body.db;
  const level: Level = medianMs > DOWN_DB_MS ? "partial" : medianMs > SLOW_DB_MS ? "degraded" : "operational";
  const note =
    level === "operational" ? "Answering queries normally" : level === "degraded" ? "Answering, but slower than usual" : "Very slow — pages may time out";
  return {
    ...base,
    level,
    note,
    latencyMs: medianMs,
    metrics: [
      { label: "Fastest", value: `${minMs ?? medianMs} ms` },
      { label: "Slowest", value: `${maxMs ?? medianMs} ms` },
      { label: "Samples", value: "5 queries" },
    ],
  };
}

function redisCheck(base: Pick<SystemCheck, "id" | "name" | "detail">, body: Health): SystemCheck {
  const r = body.redis;
  if (!r) return { ...base, level: "unknown", note: "The API did not report on Redis", latencyMs: null, metrics: [] };
  if (!r.configured) return { ...base, level: "unknown", note: "Not configured on the API", latencyMs: null, metrics: [] };
  const state = r.state ? r.state.charAt(0).toUpperCase() + r.state.slice(1) : "Unknown";
  if (r.pingMs === undefined) {
    const down = r.downForSeconds ? ` for ${formatSeconds(r.downForSeconds)}` : "";
    return {
      ...base,
      // The API keeps working without Redis, but sign-ins and live alerts suffer.
      level: "partial",
      note: `Not answering${down} — you may be signed out and live alerts may stop`,
      latencyMs: null,
      metrics: [{ label: "Connection", value: state }],
    };
  }
  return {
    ...base,
    level: r.pingMs > SLOW_REDIS_MS ? "degraded" : "operational",
    note: r.pingMs > SLOW_REDIS_MS ? "Answering, but slower than usual" : "Answering normally",
    latencyMs: r.pingMs,
    metrics: [{ label: "Connection", value: state }],
  };
}

function formatSeconds(s: number): string {
  if (s < 90) return `${s} s`;
  if (s < 5400) return `${Math.round(s / 60)} min`;
  return `${Math.round(s / 3600)} h`;
}
