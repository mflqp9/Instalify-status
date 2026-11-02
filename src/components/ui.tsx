import { Check, CircleQuestionMark, Wrench, X } from "lucide-react";

import { LEVEL_LABEL } from "@/lib/status/levels";
import type { Level } from "@/lib/status/types";

// Tailwind only ships classes it can see written out in full, so every
// level's classes are spelled out here rather than built from a string.
export const TONE: Record<Level, { text: string; bg: string; soft: string; ring: string; border: string; bar: string }> = {
  operational: { text: "text-ok", bg: "bg-ok", soft: "bg-ok/10", ring: "ring-ok/25", border: "border-ok/30", bar: "bg-ok/80" },
  unknown: { text: "text-unknown", bg: "bg-unknown", soft: "bg-unknown/10", ring: "ring-unknown/30", border: "border-unknown/40", bar: "bg-unknown/60" },
  maintenance: { text: "text-info", bg: "bg-info", soft: "bg-info/10", ring: "ring-info/25", border: "border-info/30", bar: "bg-info/80" },
  degraded: { text: "text-warn", bg: "bg-warn", soft: "bg-warn/10", ring: "ring-warn/25", border: "border-warn/40", bar: "bg-warn" },
  partial: { text: "text-partial", bg: "bg-partial", soft: "bg-partial/10", ring: "ring-partial/25", border: "border-partial/40", bar: "bg-partial" },
  major: { text: "text-bad", bg: "bg-bad", soft: "bg-bad/10", ring: "ring-bad/25", border: "border-bad/40", bar: "bg-bad" },
};

const GLYPH_SIZE = {
  xs: { box: "h-4 w-4", icon: "h-2.5 w-2.5", bang: "text-[10px]" },
  sm: { box: "h-5 w-5", icon: "h-3 w-3", bang: "text-[11px]" },
  md: { box: "h-7 w-7", icon: "h-4 w-4", bang: "text-sm" },
  lg: { box: "h-12 w-12", icon: "h-6 w-6", bang: "text-2xl" },
  xl: { box: "h-16 w-16", icon: "h-8 w-8", bang: "text-3xl" },
};

/**
 * Green tick when all is well, red cross for an outage, amber "!" for a
 * slowdown, blue spanner for maintenance, grey "?" when it could not be checked.
 */
export function StatusGlyph({ level, size = "sm", className = "" }: { level: Level; size?: keyof typeof GLYPH_SIZE; className?: string }) {
  const s = GLYPH_SIZE[size];
  const stroke = size === "lg" || size === "xl" ? 3 : 3.5;
  let inner: React.ReactNode;
  if (level === "operational") inner = <Check className={s.icon} strokeWidth={stroke} />;
  else if (level === "partial" || level === "major") inner = <X className={s.icon} strokeWidth={stroke} />;
  else if (level === "maintenance") inner = <Wrench className={s.icon} strokeWidth={2.5} />;
  else if (level === "unknown") inner = <CircleQuestionMark className={s.icon} strokeWidth={2.5} />;
  else inner = <span className={`${s.bang} font-black leading-none`}>!</span>;
  return (
    <span
      role="img"
      aria-label={LEVEL_LABEL[level]}
      className={`inline-grid shrink-0 place-items-center rounded-full text-white ${TONE[level].bg} ${s.box} ${className}`}
    >
      {inner}
    </span>
  );
}

export function StatusPill({ level, children }: { level: Level; children?: React.ReactNode }) {
  const t = TONE[level];
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${t.soft} ${t.text} ${t.ring}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${t.bg}`} />
      {children ?? LEVEL_LABEL[level]}
    </span>
  );
}

export function Card({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return <div className={`rounded-2xl border border-line bg-surface shadow-card ${className}`}>{children}</div>;
}

export function CardHeader({ title, aside, sub }: { title: React.ReactNode; aside?: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4 sm:px-6">
      <div className="min-w-0">
        <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
        {sub ? <p className="mt-0.5 text-[13px] text-muted">{sub}</p> : null}
      </div>
      {aside}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-5 py-5 text-sm text-muted sm:px-6">
      <StatusGlyph level="operational" size="sm" />
      {children}
    </div>
  );
}
