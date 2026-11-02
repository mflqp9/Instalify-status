"use client";

import { CalendarClock, ExternalLink } from "lucide-react";
import { useState } from "react";

import { LEVEL_LABEL } from "@/lib/status/levels";
import type { ComponentState, HistoryDay, Incident, Maintenance } from "@/lib/status/types";

import { duration, formatDay, formatPkt, relative } from "./time";
import { StatusGlyph, StatusPill, TONE } from "./ui";

const CHIP_LIMIT = 6;

function Chips({ items }: { items: string[] }) {
  const [all, setAll] = useState(false);
  if (items.length === 0) return null;
  const shown = all ? items : items.slice(0, CHIP_LIMIT);
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {shown.map((item) => (
        <span key={item} className="rounded-md bg-surface-2 px-2 py-0.5 text-[11.5px] font-medium text-muted">
          {item}
        </span>
      ))}
      {items.length > CHIP_LIMIT && !all ? (
        <button type="button" onClick={() => setAll(true)} className="rounded-md px-2 py-0.5 text-[11.5px] font-semibold text-ink hover:bg-surface-2">
          +{items.length - CHIP_LIMIT} more
        </button>
      ) : null}
    </div>
  );
}

export function IncidentCard({ incident, now, provider }: { incident: Incident; now: number; provider?: string }) {
  const [open, setOpen] = useState(false);
  const level = incident.level === "operational" ? "unknown" : incident.level;
  const t = TONE[level];
  const body = incident.latest?.body.trim() ?? "";
  const long = body.length > 260;
  return (
    <article className={`relative overflow-hidden rounded-xl border bg-surface p-4 sm:p-5 ${t.border}`}>
      <span className={`absolute inset-y-0 left-0 w-1 ${t.bg}`} aria-hidden />
      <div className="flex flex-wrap items-start justify-between gap-2 pl-1">
        <div className="min-w-0">
          {provider ? <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">{provider}</p> : null}
          <h4 className="text-[15px] font-semibold leading-snug text-ink">{incident.title}</h4>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-surface-2 px-2 py-0.5 text-[11.5px] font-semibold text-ink">{incident.status}</span>
          {incident.level !== "operational" ? <StatusPill level={incident.level} /> : <StatusPill level="unknown">Notice</StatusPill>}
        </div>
      </div>
      <p className="mt-1.5 pl-1 text-[12.5px] text-muted">
        Started {relative(incident.startedAt, now)} · {formatPkt(incident.startedAt)} PKT
        {incident.resolvedAt ? ` · resolved after ${duration(incident.startedAt, incident.resolvedAt)}` : ""}
      </p>
      {body ? (
        <div className="mt-3 pl-1">
          <p className={`whitespace-pre-line text-[13.5px] leading-relaxed text-ink/85 ${open || !long ? "" : "line-clamp-3"}`}>{body}</p>
          <div className="mt-1.5 flex items-center gap-3 text-[12px] text-muted">
            {incident.latest?.at ? <span>Update {relative(incident.latest.at, now)}</span> : null}
            {long ? (
              <button type="button" onClick={() => setOpen((v) => !v)} className="font-semibold text-ink hover:underline">
                {open ? "Show less" : "Read more"}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
      <div className="pl-1">
        <Chips items={incident.affected} />
      </div>
      <a
        href={incident.url}
        target="_blank"
        rel="noreferrer"
        className="mt-3 inline-flex items-center gap-1 pl-1 text-[12.5px] font-semibold text-ink/80 hover:text-ink"
      >
        Full timeline <ExternalLink className="h-3.5 w-3.5" />
      </a>
    </article>
  );
}

/** A resolved incident: one line, the way status pages list their history. */
export function PastIncidentRow({ incident, now }: { incident: Incident; now: number }) {
  return (
    <li className="px-5 py-4 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
        <a
          href={incident.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-w-0 items-center gap-1.5 text-[14px] font-semibold text-ink hover:underline"
        >
          {incident.title}
          <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted" />
        </a>
        {incident.level !== "operational" ? <StatusPill level={incident.level} /> : <StatusPill level="unknown">Notice</StatusPill>}
      </div>
      <p className="mt-1 text-[12.5px] text-muted">
        {formatPkt(incident.startedAt)} PKT · {relative(incident.startedAt, now)}
        {incident.resolvedAt ? ` · lasted ${duration(incident.startedAt, incident.resolvedAt)}` : ""}
      </p>
      <Chips items={incident.affected} />
    </li>
  );
}

export function MaintenanceRow({ m, now, provider }: { m: Maintenance; now: number; provider?: string }) {
  return (
    <li className="flex gap-3 px-5 py-4 sm:px-6">
      <span className={`mt-0.5 inline-grid h-8 w-8 shrink-0 place-items-center rounded-lg ${m.inProgress ? "bg-info text-white" : "bg-info/10 text-info"}`}>
        <CalendarClock className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {provider ? <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">{provider}</span> : null}
          <a href={m.url} target="_blank" rel="noreferrer" className="text-[14px] font-semibold text-ink hover:underline">
            {m.title}
          </a>
          {m.inProgress ? <StatusPill level="maintenance">In progress</StatusPill> : null}
        </div>
        <p className="mt-0.5 text-[12.5px] text-muted">
          {m.startsAt ? `${formatPkt(m.startsAt)}` : "Time not announced"}
          {m.endsAt ? ` → ${formatPkt(m.endsAt)} PKT` : m.startsAt ? " PKT" : ""}
          {m.startsAt && !m.inProgress ? ` · starts ${relative(m.startsAt, now)}` : ""}
        </p>
      </div>
    </li>
  );
}

/** Fourteen day cells; hover or tap a cell for what happened that day. */
export function HistoryStrip({ days, compact = false }: { days: HistoryDay[]; compact?: boolean }) {
  return (
    <div>
      <div className={`flex ${compact ? "gap-[3px]" : "gap-1 sm:gap-1.5"}`}>
        {days.map((d, i) => {
          const tone = d.level === "nodata" ? "bg-line" : d.level === "operational" ? "bg-ok/75" : TONE[d.level].bar;
          const label =
            d.level === "nodata"
              ? "No data"
              : d.incidents.length === 0
                ? "No incidents"
                : `${d.level === "operational" ? "Notice" : LEVEL_LABEL[d.level]} — ${d.incidents.join(" · ")}`;
          const edge = i < 3 ? "left-0" : i > days.length - 4 ? "right-0" : "left-1/2 -translate-x-1/2";
          return (
            <button
              key={d.date}
              type="button"
              aria-label={`${formatDay(d.date)}: ${label}`}
              className={`group relative flex-1 rounded-[3px] outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ink/40 ${compact ? "h-6" : "h-9"} ${tone}`}
            >
              <span
                className={`pointer-events-none absolute bottom-full z-20 mb-2 hidden w-56 rounded-lg border border-line bg-surface p-2.5 text-left text-[12px] leading-snug text-ink shadow-lift group-hover:block group-focus:block ${edge}`}
              >
                <span className="block font-semibold">{formatDay(d.date)}</span>
                <span className="mt-0.5 block text-muted">{label}</span>
              </span>
            </button>
          );
        })}
      </div>
      {!compact ? (
        <div className="mt-2 flex justify-between text-[11.5px] text-muted">
          <span>{days.length} days ago</span>
          <span>Today</span>
        </div>
      ) : null}
    </div>
  );
}

// Supabase names each component after its region ("ap-southeast-1") inside a
// service group ("Postgres"); out of its group the service is the useful name.
const REGION_CODE = /^[a-z]{2}-[a-z]+-\d$/;

export function ComponentRow({ c, showGroup = false }: { c: ComponentState; showGroup?: boolean }) {
  const swap = showGroup && !!c.group && REGION_CODE.test(c.name);
  const title = swap ? c.group : c.name;
  const sub = swap ? c.name : showGroup ? c.group : null;
  return (
    <li className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 hover:bg-surface-2">
      <div className="min-w-0">
        <p className="truncate text-[13.5px] font-medium text-ink">{title}</p>
        {sub ? <p className="truncate text-[11.5px] text-muted">{sub}</p> : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {c.uptime ? <span className="hidden text-[11.5px] tabular-nums text-muted sm:inline">{c.uptime}</span> : null}
        <span className={`hidden text-[12px] font-medium sm:inline ${TONE[c.level].text}`}>{LEVEL_LABEL[c.level]}</span>
        <StatusGlyph level={c.level} size="sm" />
      </div>
    </li>
  );
}
