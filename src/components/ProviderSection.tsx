"use client";

import { ChevronDown, ExternalLink, Search, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";

import { isProblem, LEVEL_HEADLINE, LEVEL_LABEL } from "@/lib/status/levels";
import type { ProviderStatus } from "@/lib/status/types";

import { ProviderMark } from "./marks";
import { ComponentRow, HistoryStrip, IncidentCard, MaintenanceRow, PastIncidentRow } from "./parts";
import { Card, CardHeader, Empty, StatusGlyph, StatusPill, TONE } from "./ui";

const MAINTENANCE_PREVIEW = 4;

export function ProviderSection({ p, now }: { p: ProviderStatus; now: number }) {
  const relevantIncidents = p.incidents.filter((i) => i.relevant);
  const otherIncidents = p.incidents.filter((i) => !i.relevant);
  const relevantMaint = p.maintenances.filter((m) => m.relevant);
  const otherMaint = p.maintenances.filter((m) => !m.relevant);
  const recentRelevant = p.recent.filter((i) => i.relevant);
  const [showAllRecent, setShowAllRecent] = useState(false);
  const recentShown = showAllRecent ? p.recent : recentRelevant;

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex items-center gap-4">
            <ProviderMark id={p.id} size="lg" />
            <div>
              <h2 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">{p.name}</h2>
              <p className="text-[13.5px] text-muted">{p.role}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl bg-surface-2 px-4 py-3">
            <StatusGlyph level={p.level} size="md" />
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">For Instalify</p>
              <p className={`text-[15px] font-bold ${TONE[p.level].text}`}>
                {p.available ? (p.level === "operational" ? "Working normally" : LEVEL_LABEL[p.level]) : "Could not check"}
              </p>
            </div>
          </div>
        </div>
        <div className="border-t border-line bg-surface-2/50 px-5 py-4 text-[13.5px] leading-relaxed text-ink/85 sm:px-6">{p.impact}</div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3.5 sm:px-6">
          <div className="flex flex-wrap items-center gap-2 text-[13px] text-muted">
            <span>{p.name}&rsquo;s own status page says</span>
            {p.official ? <StatusPill level={p.official.level}>{p.official.text}</StatusPill> : <StatusPill level="unknown">Unavailable</StatusPill>}
            {p.available && p.affectedCount > 0 ? (
              <span>
                · {p.affectedCount} of {p.componentCount} components affected worldwide
              </span>
            ) : null}
          </div>
          <a
            href={p.pageUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-[12.5px] font-semibold text-ink hover:bg-surface-2"
          >
            Official status page <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </Card>

      {!p.available ? (
        <Card className="flex items-start gap-3 border-warn/40 p-5">
          <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-warn" />
          <p className="text-sm text-ink">
            {p.name}&rsquo;s status could not be read just now. This page tries again every minute; until then, check the{" "}
            <a href={p.pageUrl} target="_blank" rel="noreferrer" className="font-semibold underline">
              official page
            </a>
            .
          </p>
        </Card>
      ) : null}

      {p.available ? (
        <>
          <Card>
            <CardHeader
              title="Active incidents"
              sub={relevantIncidents.length ? "These affect parts Instalify depends on." : undefined}
              aside={relevantIncidents.length ? <StatusPill level={p.level}>{relevantIncidents.length} active</StatusPill> : null}
            />
            {relevantIncidents.length ? (
              <div className="space-y-3 p-4 sm:p-5">
                {relevantIncidents.map((i) => (
                  <IncidentCard key={i.id} incident={i} now={now} />
                ))}
              </div>
            ) : (
              <Empty>No incidents affecting Instalify right now.</Empty>
            )}
            {otherIncidents.length ? (
              <details className="group border-t border-line">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-3.5 text-[13px] text-muted hover:bg-surface-2 sm:px-6">
                  <span>
                    {otherIncidents.length} other {otherIncidents.length === 1 ? "incident" : "incidents"} on {p.name}, not in parts Instalify uses
                  </span>
                  <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                </summary>
                <div className="space-y-3 px-4 pb-5 sm:px-5">
                  {otherIncidents.map((i) => (
                    <IncidentCard key={i.id} incident={i} now={now} />
                  ))}
                </div>
              </details>
            ) : null}
          </Card>

          <Card>
            <CardHeader
              title={p.focus.title}
              sub="The parts of this platform Instalify depends on."
              aside={<StatusPill level={p.level}>{p.level === "operational" ? "All operational" : LEVEL_HEADLINE[p.level]}</StatusPill>}
            />
            <ul className="grid gap-x-4 p-2 sm:grid-cols-2 sm:p-3">
              {p.focus.components.map((c) => (
                <ComponentRow key={c.id} c={c} showGroup />
              ))}
            </ul>
          </Card>

          {p.maintenances.length ? (
            <Card>
              <CardHeader
                title="Scheduled maintenance"
                sub={relevantMaint.length ? "Windows that touch parts Instalify uses are listed first." : "None of these touch the parts Instalify uses."}
              />
              <MaintenanceList relevant={relevantMaint} other={otherMaint} now={now} />
            </Card>
          ) : null}

          <Card>
            <CardHeader
              title="Last 14 days"
              sub="Incidents that touched the parts Instalify uses. Hover or tap a day."
              aside={
                p.recent.length > recentRelevant.length ? (
                  <button
                    type="button"
                    onClick={() => setShowAllRecent((v) => !v)}
                    className="rounded-lg border border-line px-3 py-1.5 text-[12.5px] font-semibold text-ink hover:bg-surface-2"
                  >
                    {showAllRecent ? "Only Instalify's parts" : `All ${p.recent.length} incidents`}
                  </button>
                ) : null
              }
            />
            <div className="px-5 pb-2 pt-5 sm:px-6">
              <HistoryStrip days={p.history} />
            </div>
            {recentShown.length ? (
              <ul className="mt-3 divide-y divide-line border-t border-line">
                {recentShown.map((i) => (
                  <PastIncidentRow key={i.id} incident={i} now={now} />
                ))}
              </ul>
            ) : (
              <Empty>No resolved incidents in the last 14 days.</Empty>
            )}
          </Card>

          <AllComponents p={p} />
        </>
      ) : null}
    </div>
  );
}

function MaintenanceList({ relevant, other, now }: { relevant: ProviderStatus["maintenances"]; other: ProviderStatus["maintenances"]; now: number }) {
  const [all, setAll] = useState(false);
  const shownOther = all ? other : other.slice(0, Math.max(0, MAINTENANCE_PREVIEW - relevant.length));
  return (
    <>
      <ul className="divide-y divide-line">
        {[...relevant, ...shownOther].map((m) => (
          <MaintenanceRow key={m.id} m={m} now={now} />
        ))}
      </ul>
      {other.length > shownOther.length ? (
        <button
          type="button"
          onClick={() => setAll(true)}
          className="w-full border-t border-line px-5 py-3 text-left text-[13px] font-semibold text-ink hover:bg-surface-2 sm:px-6"
        >
          Show {other.length - shownOther.length} more elsewhere in the world
        </button>
      ) : null}
    </>
  );
}

function AllComponents({ p }: { p: ProviderStatus }) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const groups = useMemo(
    () =>
      q
        ? p.groups
            .map((g) => ({ ...g, components: g.components.filter((c) => c.name.toLowerCase().includes(q) || g.name.toLowerCase().includes(q)) }))
            .filter((g) => g.components.length > 0)
        : p.groups,
    [p.groups, q],
  );

  return (
    <Card>
      <CardHeader title="All components" sub={`Everything ${p.name} reports on — ${p.componentCount} components.`} />
      <div className="px-4 pt-4 sm:px-5">
        <label className="flex items-center gap-2 rounded-xl border border-line bg-surface-2/60 px-3 py-2.5 focus-within:border-ink/30">
          <Search className="h-4 w-4 shrink-0 text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={p.id === "cloudflare" ? "Search, e.g. Karachi, DNS, Workers" : "Search components"}
            className="w-full bg-transparent text-[14px] text-ink outline-none placeholder:text-muted"
            aria-label={`Search ${p.name} components`}
          />
        </label>
      </div>
      <div className="space-y-2 p-4 sm:p-5">
        {groups.map((g) => {
          const affected = g.components.filter((c) => isProblem(c.level) || c.level === "maintenance").length;
          return (
            <details key={`${g.id}-${q ? "q" : ""}`} open={!!q} className="group rounded-xl border border-line">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-4 py-3 hover:bg-surface-2">
                <div className="flex min-w-0 items-center gap-3">
                  <StatusGlyph level={g.level} size="sm" />
                  <span className="truncate text-[14px] font-semibold text-ink">{g.name}</span>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-[12px] text-muted">
                    {affected ? `${affected} of ${g.components.length} affected` : `${g.components.length} operational`}
                  </span>
                  <ChevronDown className="h-4 w-4 text-muted transition-transform group-open:rotate-180" />
                </div>
              </summary>
              <ul className="grid gap-x-4 border-t border-line p-2 sm:grid-cols-2">
                {g.components.map((c) => (
                  <ComponentRow key={c.id} c={c} />
                ))}
              </ul>
            </details>
          );
        })}
        {groups.length === 0 ? <p className="px-1 py-4 text-sm text-muted">Nothing matches &ldquo;{query}&rdquo;.</p> : null}
      </div>
    </Card>
  );
}
