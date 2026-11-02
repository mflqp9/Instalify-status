"use client";

import { ExternalLink, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { isProblem, LEVEL_HEADLINE, LEVEL_LABEL, worst } from "@/lib/status/levels";
import type { Level, StatusBoard as Board } from "@/lib/status/types";

import { InstalifyMark, ProviderMark, SystemMark } from "./marks";
import { ProviderSection } from "./ProviderSection";
import { isSectionId, type SectionId } from "./sections";
import { SummarySection } from "./SummarySection";
import { SystemsSection } from "./SystemsSection";
import { ThemeToggle } from "./ThemeToggle";
import { formatPktClock, relative } from "./time";
import { Card, StatusGlyph, TONE } from "./ui";

const REFRESH_MS = 60_000;
// The server rebuilds the board in the background, so an answer older than
// this means a fresher one is being built right now: ask again shortly.
const STALE_MS = 90_000;
const STALE_RETRY_MS = 10_000;
const STALE_RETRIES = 3;
const ERROR_RETRY_MS = 30_000;

// Nothing is written to localStorage, sessionStorage or IndexedDB. The board
// lives in memory only; the section lives in the URL hash so it can be shared.

export function StatusBoard({ initial }: { initial: Board }) {
  const [board, setBoard] = useState(initial);
  const [now, setNow] = useState(() => Date.parse(initial.generatedAt));
  const [refreshing, setRefreshing] = useState(false);
  const [failed, setFailed] = useState(false);
  const [section, setSection] = useState<SectionId>("summary");
  const detailRef = useRef<HTMLDivElement>(null);
  const loadRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    let alive = true;
    let timer: number | undefined;
    let staleTries = 0;
    let lastLoad = Date.now();
    const schedule = (ms: number) => {
      window.clearTimeout(timer);
      timer = window.setTimeout(load, ms);
    };

    async function load() {
      if (document.hidden) return schedule(REFRESH_MS);
      lastLoad = Date.now();
      setRefreshing(true);
      try {
        const res = await fetch("/api/status", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const next = (await res.json()) as Board;
        if (!alive) return;
        setBoard((prev) => (next.generatedAt >= prev.generatedAt ? next : prev));
        setFailed(false);
        const stale = Date.now() - Date.parse(next.generatedAt) > STALE_MS;
        staleTries = stale ? staleTries + 1 : 0;
        schedule(stale && staleTries <= STALE_RETRIES ? STALE_RETRY_MS : REFRESH_MS);
      } catch {
        if (!alive) return;
        setFailed(true);
        schedule(ERROR_RETRY_MS);
      } finally {
        if (alive) setRefreshing(false);
        setNow(Date.now());
      }
    }
    loadRef.current = load;

    const age = Date.now() - Date.parse(initial.generatedAt);
    schedule(age > STALE_MS ? 0 : REFRESH_MS - age);

    const onVisible = () => {
      if (!document.hidden && Date.now() - lastLoad > REFRESH_MS) load();
    };
    document.addEventListener("visibilitychange", onVisible);
    const tick = window.setInterval(() => setNow(Date.now()), 10_000);
    setNow(Date.now());
    return () => {
      alive = false;
      window.clearTimeout(timer);
      window.clearInterval(tick);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [initial.generatedAt]);

  useEffect(() => {
    const fromHash = () => {
      const id = window.location.hash.slice(1);
      if (isSectionId(id)) setSection(id);
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, []);

  const select = useCallback((id: SectionId) => {
    setSection(id);
    window.history.replaceState(null, "", id === "summary" ? window.location.pathname : `#${id}`);
    const el = detailRef.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top;
    if (top < 0 || top > window.innerHeight * 0.5) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const provider = board.providers.find((p) => p.id === section);

  return (
    <div className="min-h-screen bg-bg">
      <Hero board={board} now={now} refreshing={refreshing} failed={failed} onRefresh={() => loadRef.current()} />

      <main className="container relative -mt-20 pb-16 sm:-mt-24">
        <HealthGrid board={board} section={section} onSelect={select} />

        <div ref={detailRef} className="mt-10 scroll-mt-2 lg:grid lg:grid-cols-[240px_minmax(0,1fr)] lg:items-start lg:gap-8">
          <SectionNav board={board} section={section} onSelect={select} />
          <div key={section} className="mt-5 min-w-0 animate-fadeup lg:mt-0">
            {section === "summary" ? <SummarySection board={board} now={now} onSelect={select} /> : null}
            {section === "systems" ? <SystemsSection systems={board.systems} /> : null}
            {provider ? <ProviderSection p={provider} now={now} /> : null}
          </div>
        </div>
      </main>

      <Footer board={board} />
    </div>
  );
}

function Hero({ board, now, refreshing, failed, onRefresh }: { board: Board; now: number; refreshing: boolean; failed: boolean; onRefresh: () => void }) {
  const ok = board.level === "operational";
  return (
    <header className="hero relative overflow-hidden text-white">
      <div className="container relative">
        <div className="flex items-center justify-between py-5">
          <a href="https://instalify.app" className="flex items-center gap-2.5">
            <InstalifyMark className="h-8 w-8 drop-shadow" />
            <span className="text-lg font-bold tracking-tight">Instalify</span>
            <span className="rounded-md bg-white/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-white/75 ring-1 ring-inset ring-white/15">
              Status
            </span>
          </a>
          <div className="flex items-center gap-2">
            <a
              href="https://instalify.app"
              className="hidden items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-[13px] font-semibold text-white/85 transition-colors hover:bg-white/10 hover:text-white sm:inline-flex"
            >
              Open Instalify <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <ThemeToggle />
          </div>
        </div>

        <div className="flex flex-col items-center pb-32 pt-8 text-center sm:pb-36 sm:pt-12">
          <div className="relative">
            <span className={`absolute inset-0 animate-ping2 rounded-full ${TONE[board.level].bg}`} aria-hidden />
            <StatusGlyph level={board.level} size="xl" className="relative shadow-lg ring-4 ring-white/10" />
          </div>
          <h1 className="mt-6 text-balance text-[28px] font-bold leading-tight tracking-tight sm:text-4xl">{LEVEL_HEADLINE[board.level]}</h1>
          <p className="mt-2 max-w-xl text-pretty text-[14.5px] text-white/65 sm:text-base">
            {ok
              ? "Instalify and every platform it runs on are working normally."
              : "Live status of Instalify and the platforms it runs on. Details for each are below."}
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-[13px] text-white/70">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 ring-1 ring-inset ring-white/10">
              <span className="relative flex h-2 w-2">
                <span className={`absolute inline-flex h-full w-full animate-ping2 rounded-full ${failed ? "bg-warn" : "bg-ok"}`} />
                <span className={`relative inline-flex h-2 w-2 rounded-full ${failed ? "bg-warn" : "bg-ok"}`} />
              </span>
              {failed ? "Could not refresh — showing the last result" : "Live"}
            </span>
            <span>
              Checked {relative(board.generatedAt, now)} · {formatPktClock(board.generatedAt)} PKT
            </span>
            <button
              type="button"
              onClick={onRefresh}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-semibold text-white/85 hover:bg-white/10 hover:text-white disabled:opacity-60"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
              {refreshing ? "Checking…" : "Refresh"}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

type Tile = { key: string; name: string; level: Level; icon: React.ReactNode; target: SectionId };

function HealthGrid({ board, section, onSelect }: { board: Board; section: SectionId; onSelect: (id: SectionId) => void }) {
  const systems: Tile[] = board.systems.map((s) => ({
    key: s.id,
    name: s.name,
    level: s.level,
    icon: <SystemMark id={s.id} size="sm" />,
    target: "systems",
  }));
  const providers: Tile[] = board.providers.map((p) => ({
    key: p.id,
    name: p.name,
    level: p.level,
    icon: <ProviderMark id={p.id} size="sm" />,
    target: p.id,
  }));
  const total = systems.length + providers.length;
  const problems = [...systems, ...providers].filter((t) => t.level !== "operational").length;

  return (
    <Card className="p-4 shadow-lift sm:p-6">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2 px-1">
        <h2 className="text-[15px] font-semibold text-ink">Platform health</h2>
        <p className="text-[12.5px] text-muted">
          {problems === 0 ? `All ${total} checks passing` : `${total - problems} of ${total} checks passing · ${problems} need attention`}
        </p>
      </div>
      <div className="grid gap-5 lg:grid-cols-2 lg:gap-0 lg:divide-x lg:divide-line">
        <TileGroup title="Instalify" tiles={systems} section={section} onSelect={onSelect} className="lg:pr-6" />
        <TileGroup title="Cloud platforms" tiles={providers} section={section} onSelect={onSelect} className="lg:pl-6" />
      </div>
    </Card>
  );
}

function TileGroup({ title, tiles, section, onSelect, className = "" }: { title: string; tiles: Tile[]; section: SectionId; onSelect: (id: SectionId) => void; className?: string }) {
  return (
    <div className={className}>
      <p className="mb-2.5 px-1 text-[11px] font-semibold uppercase tracking-wider text-muted">{title}</p>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-2">
        {tiles.map((t) => {
          const active = section === t.target && (t.target !== "systems" || t.key === "database" || t.key === "redis");
          const problem = t.level !== "operational";
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => onSelect(t.target)}
              // Stacked on phones and tablets, where a tile is too narrow for one row.
              className={`group relative flex flex-col items-start gap-2.5 rounded-xl border p-3 text-left transition-all hover:-translate-y-px hover:shadow-card lg:flex-row lg:items-center lg:gap-3 ${
                problem ? `${TONE[t.level].border} ${TONE[t.level].soft}` : "border-line bg-surface hover:border-ink/15"
              } ${active ? "ring-2 ring-ink/10" : ""}`}
            >
              {t.icon}
              <div className="w-full min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-semibold text-ink">{t.name}</p>
                <p className={`truncate text-[12px] font-medium ${problem ? TONE[t.level].text : "text-muted"}`}>
                  {t.level === "operational" ? "Operational" : LEVEL_LABEL[t.level]}
                </p>
              </div>
              <StatusGlyph level={t.level} size="sm" className="absolute right-3 top-3 lg:static" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SectionNav({ board, section, onSelect }: { board: Board; section: SectionId; onSelect: (id: SectionId) => void }) {
  const systemsLevel = worst(board.systems.filter((s) => s.id === "database" || s.id === "redis").map((s) => s.level));
  const items: { id: SectionId; label: string; sub: string; level: Level; icon: React.ReactNode }[] = [
    {
      id: "summary",
      label: "Summary",
      sub: "Everything at a glance",
      level: board.level,
      icon: <InstalifyMark className="h-5 w-5" />,
    },
    {
      id: "systems",
      label: "Database & Redis",
      sub: "Live checks",
      level: systemsLevel,
      icon: <SystemMark id="database" size="sm" />,
    },
    ...board.providers.map((p) => ({ id: p.id, label: p.name, sub: p.role, level: p.level, icon: <ProviderMark id={p.id} size="sm" /> })),
  ];

  return (
    <nav aria-label="Status sections" className="sticky top-0 z-30 -mx-4 bg-bg/85 px-4 py-2.5 backdrop-blur-md lg:top-6 lg:mx-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
      {/* Phones and tablets: one scrolling row. */}
      <div className="no-scrollbar flex gap-2 overflow-x-auto lg:hidden">
        {items.map((it) => {
          const active = section === it.id;
          return (
            <button
              key={it.id}
              type="button"
              onClick={() => onSelect(it.id)}
              aria-current={active ? "page" : undefined}
              className={`flex shrink-0 items-center gap-2 rounded-full border py-1.5 pl-1.5 pr-3.5 text-[13px] font-semibold transition-colors ${
                active ? "border-ink bg-ink text-bg" : "border-line bg-surface text-ink hover:bg-surface-2"
              }`}
            >
              <StatusGlyph level={it.level} size="sm" />
              {it.label}
            </button>
          );
        })}
      </div>

      {/* Laptops and up: a sidebar. */}
      <Card className="hidden p-2 lg:block">
        <ul className="space-y-0.5">
          {items.map((it) => {
            const active = section === it.id;
            return (
              <li key={it.id}>
                <button
                  type="button"
                  onClick={() => onSelect(it.id)}
                  aria-current={active ? "page" : undefined}
                  className={`relative flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition-colors ${
                    active ? "bg-surface-2" : "hover:bg-surface-2/70"
                  }`}
                >
                  {active ? <span className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-ink" aria-hidden /> : null}
                  <span className="inline-grid h-8 w-8 shrink-0 place-items-center">{it.icon}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-semibold text-ink">{it.label}</span>
                    <span className="block truncate text-[11.5px] text-muted">{it.sub}</span>
                  </span>
                  <StatusGlyph level={it.level} size="sm" />
                </button>
              </li>
            );
          })}
        </ul>
      </Card>
    </nav>
  );
}

function Footer({ board }: { board: Board }) {
  const year = board.generatedAt.slice(0, 4);
  const issues = board.providers.filter((p) => isProblem(p.level)).length;
  return (
    <footer className="border-t border-line">
      <div className="container flex flex-col gap-4 py-8 text-[12.5px] text-muted md:flex-row md:items-start md:justify-between">
        <div className="max-w-xl space-y-1">
          <p>
            Data comes from each platform&rsquo;s public status page and Instalify&rsquo;s own health checks, refreshed every
            minute. All times are Pakistan time (PKT).
          </p>
          <p>
            © {year} Instalify{issues ? ` · ${issues} platform${issues === 1 ? "" : "s"} reporting problems` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {board.providers.map((p) => (
            <a key={p.id} href={p.pageUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium hover:text-ink">
              {p.name} <ExternalLink className="h-3 w-3" />
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}
