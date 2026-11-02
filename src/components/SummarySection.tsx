"use client";

import { ArrowRight, ChevronRight, Smartphone } from "lucide-react";

import { isProblem, LEVEL_LABEL, worst } from "@/lib/status/levels";
import type { Level, StatusBoard } from "@/lib/status/types";

import { ProviderMark, SystemMark } from "./marks";
import { HistoryStrip, IncidentCard, MaintenanceRow } from "./parts";
import type { SectionId } from "./sections";
import { Card, CardHeader, Empty, StatusGlyph, StatusPill, TONE } from "./ui";

export function SummarySection({ board, now, onSelect }: { board: StatusBoard; now: number; onSelect: (id: SectionId) => void }) {
  const systemIssues = board.systems.filter((s) => s.level !== "operational");
  const incidents = board.providers.flatMap((p) => p.incidents.filter((i) => i.relevant).map((i) => ({ i, p })));
  const elsewhere = board.providers
    .map((p) => ({ p, count: p.incidents.filter((i) => !i.relevant).length }))
    .filter((x) => x.count > 0);
  const maintenance = board.providers
    .flatMap((p) => p.maintenances.filter((m) => m.relevant).map((m) => ({ m, p })))
    .sort((a, b) => Number(b.m.inProgress) - Number(a.m.inProgress) || (a.m.startsAt ?? "").localeCompare(b.m.startsAt ?? ""));
  const nothingWrong = systemIssues.length === 0 && incidents.length === 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Right now"
          sub="Anything currently affecting Instalify."
          aside={nothingWrong ? <StatusPill level="operational">No issues</StatusPill> : <StatusPill level={board.level}>{LEVEL_LABEL[board.level]}</StatusPill>}
        />
        {nothingWrong ? <Empty>Nothing is affecting Instalify. Every check passed.</Empty> : null}
        {systemIssues.length ? (
          <ul className="divide-y divide-line">
            {systemIssues.map((s) => (
              <li key={s.id}>
                <button type="button" onClick={() => onSelect("systems")} className="flex w-full items-center gap-3 px-5 py-3.5 text-left hover:bg-surface-2 sm:px-6">
                  <SystemMark id={s.id} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-semibold text-ink">{s.name}</p>
                    <p className="text-[12.5px] text-muted">{s.note}</p>
                  </div>
                  <StatusGlyph level={s.level} size="md" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {incidents.length ? (
          <div className="space-y-3 border-t border-line p-4 sm:p-5">
            {incidents.map(({ i, p }) => (
              <IncidentCard key={`${p.id}-${i.id}`} incident={i} now={now} provider={p.name} />
            ))}
          </div>
        ) : null}
        {elsewhere.length ? (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-line px-5 py-3.5 text-[12.5px] text-muted sm:px-6">
            <span>Not affecting Instalify:</span>
            {elsewhere.map(({ p, count }) => (
              <button key={p.id} type="button" onClick={() => onSelect(p.id)} className="font-semibold text-ink underline-offset-2 hover:underline">
                {p.name} has {count} {count === 1 ? "incident" : "incidents"} elsewhere
              </button>
            ))}
          </div>
        ) : null}
      </Card>

      <ConnectionPath board={board} onSelect={onSelect} />

      {maintenance.length ? (
        <Card>
          <CardHeader title="Upcoming maintenance" sub="Planned work on parts Instalify uses. Instalify may be slower for a while; usually nothing goes down." />
          <ul className="divide-y divide-line">
            {maintenance.map(({ m, p }) => (
              <MaintenanceRow key={`${p.id}-${m.id}`} m={m} now={now} provider={p.name} />
            ))}
          </ul>
        </Card>
      ) : null}

      <Card>
        <CardHeader title="Last 14 days" sub="Incidents on each platform that touched the parts Instalify uses." />
        <ul className="divide-y divide-line">
          {board.providers.map((p) => {
            const count = p.recent.filter((i) => i.relevant).length + p.incidents.filter((i) => i.relevant).length;
            return (
              <li key={p.id}>
                <div className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-3 px-5 py-4 sm:grid-cols-[180px_1fr_auto] sm:px-6">
                  <button type="button" onClick={() => onSelect(p.id)} className="flex items-center gap-3 text-left">
                    <ProviderMark id={p.id} size="sm" />
                    <span className="text-[14px] font-semibold text-ink hover:underline">{p.name}</span>
                  </button>
                  <span className="text-right text-[12px] text-muted sm:order-last">
                    {count ? `${count} incident${count === 1 ? "" : "s"}` : "No incidents"}
                  </span>
                  <div className="col-span-2 sm:col-span-1">
                    <HistoryStrip days={p.history} compact />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}

/** Cloudflare → API → database & Redis, each with its own result. */
function ConnectionPath({ board, onSelect }: { board: StatusBoard; onSelect: (id: SectionId) => void }) {
  const level = (id: string): Level => board.systems.find((s) => s.id === id)?.level ?? "unknown";
  const provider = (id: string): Level => board.providers.find((p) => p.id === id)?.level ?? "unknown";

  const steps: { key: string; role: string; title: string; sub: string; level: Level; icon: React.ReactNode; target: SectionId }[] = [
    {
      key: "cloudflare",
      role: "Front door",
      title: "Cloudflare",
      sub: "Karachi edge · website",
      level: worst([provider("cloudflare"), level("website")]),
      icon: <ProviderMark id="cloudflare" size="sm" />,
      target: "cloudflare",
    },
    {
      key: "api",
      role: "Server",
      title: "Instalify API",
      sub: "Railway · Singapore",
      level: worst([provider("railway"), level("api")]),
      icon: <SystemMark id="api" size="sm" />,
      target: "railway",
    },
    {
      key: "database",
      role: "Your records",
      title: "Database",
      sub: "Supabase · Singapore",
      level: worst([provider("supabase"), level("database")]),
      icon: <SystemMark id="database" size="sm" />,
      target: "systems",
    },
    {
      key: "redis",
      role: "Sign-in & alerts",
      title: "Redis",
      sub: "Railway · Singapore",
      level: level("redis"),
      icon: <SystemMark id="redis" size="sm" />,
      target: "systems",
    },
  ];

  return (
    <Card>
      <CardHeader
        title="How Instalify reaches you"
        sub={
          <span className="inline-flex flex-wrap items-center gap-1">
            <Smartphone className="h-3.5 w-3.5" aria-hidden /> Your phone or computer
            <ArrowRight className="h-3 w-3" aria-hidden /> Cloudflare
            <ArrowRight className="h-3 w-3" aria-hidden /> Instalify API
            <ArrowRight className="h-3 w-3" aria-hidden /> Database &amp; Redis
          </span>
        }
      />
      <div className="grid gap-2.5 p-4 sm:grid-cols-2 sm:p-5">
        {steps.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => onSelect(s.target)}
            className={`flex min-w-0 items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors hover:bg-surface-2 ${
              isProblem(s.level) ? TONE[s.level].border : "border-line"
            }`}
          >
            {s.icon}
            <div className="min-w-0 flex-1">
              <p className="text-[10.5px] font-semibold uppercase tracking-wider text-muted">{s.role}</p>
              <p className="truncate text-[13.5px] font-semibold text-ink">{s.title}</p>
              <p className="truncate text-[11.5px] text-muted">{s.sub}</p>
            </div>
            <StatusGlyph level={s.level} size="sm" />
            <ChevronRight className="h-4 w-4 shrink-0 text-muted" aria-hidden />
          </button>
        ))}
      </div>
    </Card>
  );
}
