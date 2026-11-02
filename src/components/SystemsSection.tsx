"use client";

import { Info } from "lucide-react";

import { LEVEL_LABEL } from "@/lib/status/levels";
import type { SystemCheck } from "@/lib/status/types";

import { SystemMark } from "./marks";
import { Card, StatusGlyph, TONE } from "./ui";

const MEANING: Record<SystemCheck["id"], string> = {
  website: "If the website does not open, nothing else can be used.",
  api: "Every screen loads and saves through the API. If it stops answering, pages show errors.",
  database: "Every record — customers, sales, installments, accounts — is stored here. If it stops, nothing can be read or saved.",
  redis:
    "Keeps you signed in, limits abuse and delivers live alerts. If it stops, Instalify keeps working but you may be signed out and the bell stops updating.",
};

const LATENCY_LABEL: Record<SystemCheck["id"], string> = {
  website: "Response time from the status monitor",
  api: "Response time from the status monitor",
  database: "Query round trip from the API server",
  redis: "PING round trip from the API server",
};

export function SystemsSection({ systems }: { systems: SystemCheck[] }) {
  const db = systems.find((s) => s.id === "database");
  const redis = systems.find((s) => s.id === "redis");
  const path = systems.filter((s) => s.id === "website" || s.id === "api");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">Database &amp; Redis</h2>
        <p className="mt-1 text-[13.5px] text-muted">
          Checked live from the Instalify API server in Singapore, the same region as both.
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        {db ? <BigCheck s={db} /> : null}
        {redis ? <BigCheck s={redis} /> : null}
      </div>

      <div>
        <h3 className="mb-3 text-[15px] font-semibold text-ink">Checked through</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          {path.map((s) => (
            <SmallCheck key={s.id} s={s} />
          ))}
        </div>
      </div>

      <Card className="flex gap-3 p-4 sm:p-5">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
        <p className="text-[13px] leading-relaxed text-muted">
          The database runs on Supabase and Redis on Railway. When one of these shows a problem, the{" "}
          <span className="font-semibold text-ink">Supabase</span> and <span className="font-semibold text-ink">Railway</span> sections
          show whether the platform itself has reported an incident.
        </p>
      </Card>
    </div>
  );
}

function BigCheck({ s }: { s: SystemCheck }) {
  const t = TONE[s.level];
  return (
    <Card className="relative overflow-hidden">
      <span className={`absolute inset-x-0 top-0 h-1 ${t.bg}`} aria-hidden />
      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <SystemMark id={s.id} size="lg" />
            <div>
              <h3 className="text-lg font-bold text-ink">{s.name}</h3>
              <p className="text-[12.5px] text-muted">{s.detail}</p>
            </div>
          </div>
          <StatusGlyph level={s.level} size="lg" />
        </div>

        <div className="mt-6 flex items-end justify-between gap-4">
          <div>
            <p className={`text-[15px] font-bold ${t.text}`}>{LEVEL_LABEL[s.level]}</p>
            <p className="mt-0.5 text-[13px] text-muted">{s.note}</p>
          </div>
          {s.latencyMs !== null ? (
            <div className="text-right">
              <p className="text-3xl font-bold tabular-nums tracking-tight text-ink">
                {s.latencyMs}
                <span className="ml-1 text-base font-semibold text-muted">ms</span>
              </p>
            </div>
          ) : null}
        </div>
        {s.latencyMs !== null ? <p className="mt-1 text-right text-[11.5px] text-muted">{LATENCY_LABEL[s.id]}</p> : null}

        {s.metrics.length ? (
          <dl className="mt-5 grid grid-cols-3 gap-2">
            {s.metrics.map((m) => (
              <div key={m.label} className="rounded-lg bg-surface-2 px-3 py-2">
                <dt className="text-[11px] font-medium text-muted">{m.label}</dt>
                <dd className="text-[13.5px] font-semibold tabular-nums text-ink">{m.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}

        <p className="mt-5 border-t border-line pt-4 text-[13px] leading-relaxed text-muted">{MEANING[s.id]}</p>
      </div>
    </Card>
  );
}

function SmallCheck({ s }: { s: SystemCheck }) {
  return (
    <Card className="flex items-center gap-4 p-4">
      <SystemMark id={s.id} />
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold text-ink">{s.name}</p>
        <p className="truncate text-[12.5px] text-muted">
          {s.detail} · {s.note}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {s.latencyMs !== null ? <span className="text-[13px] font-semibold tabular-nums text-muted">{s.latencyMs} ms</span> : null}
        <StatusGlyph level={s.level} size="md" />
      </div>
    </Card>
  );
}
