import { InstalifyMark } from "./marks";

/** Shown only if the board is not in the prerendered page yet. */
export function BoardSkeleton() {
  return (
    <div className="min-h-screen bg-bg" aria-busy="true" aria-label="Checking status">
      <header className="hero relative overflow-hidden text-white">
        <div className="container relative">
          <div className="flex items-center gap-2.5 py-5">
            <InstalifyMark className="h-8 w-8" />
            <span className="text-lg font-bold tracking-tight">Instalify</span>
          </div>
          <div className="flex flex-col items-center pb-36 pt-12">
            <div className="h-16 w-16 animate-pulse rounded-full bg-white/10" />
            <div className="mt-6 h-8 w-72 max-w-full animate-pulse rounded-lg bg-white/10" />
            <p className="mt-4 text-sm text-white/60">Checking every platform…</p>
          </div>
        </div>
      </header>
      <main className="container relative -mt-24">
        <div className="h-56 animate-pulse rounded-2xl border border-line bg-surface shadow-card" />
      </main>
    </div>
  );
}
