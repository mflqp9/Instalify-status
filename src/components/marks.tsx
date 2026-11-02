import { Cloud, Database, Globe, Server, TrainFront, Zap } from "lucide-react";

import type { ProviderId, SystemId } from "@/lib/status/types";

const BOX = { sm: "h-8 w-8 rounded-lg", md: "h-10 w-10 rounded-xl", lg: "h-12 w-12 rounded-xl" };
const ICON = { sm: "h-4 w-4", md: "h-5 w-5", lg: "h-6 w-6" };

type Size = keyof typeof BOX;

/** Simple brand-coloured tiles; not the providers' logos. */
export function ProviderMark({ id, size = "md" }: { id: ProviderId; size?: Size }) {
  const box = `${BOX[size]} inline-grid shrink-0 place-items-center`;
  switch (id) {
    case "vercel":
      return (
        <span className={`${box} bg-black text-white ring-1 ring-white/10`}>
          <svg viewBox="0 0 24 24" className={ICON[size]} aria-hidden>
            <path d="M12 3.5 22 20.5H2z" fill="currentColor" />
          </svg>
        </span>
      );
    case "railway":
      return (
        <span className={`${box} bg-[#7c3aed] text-white`}>
          <TrainFront className={ICON[size]} strokeWidth={2.25} />
        </span>
      );
    case "supabase":
      return (
        <span className={`${box} bg-[#1c1c1c] text-[#3ecf8e] ring-1 ring-white/10`}>
          <svg viewBox="0 0 24 24" className={ICON[size]} aria-hidden>
            <path d="M13.6 2.2 4.1 14.1c-.5.6 0 1.4.7 1.4h6.7l-1 6.3c-.1.6.7.9 1.1.4l9.5-11.9c.5-.6 0-1.4-.7-1.4h-6.7l1-6.3c.1-.6-.7-.9-1.1-.4z" fill="currentColor" />
          </svg>
        </span>
      );
    case "cloudflare":
      return (
        <span className={`${box} bg-[#f38020] text-white`}>
          <Cloud className={ICON[size]} fill="currentColor" strokeWidth={1.5} />
        </span>
      );
  }
}

export function SystemMark({ id, size = "md" }: { id: SystemId; size?: Size }) {
  const box = `${BOX[size]} inline-grid shrink-0 place-items-center`;
  const Icon = id === "website" ? Globe : id === "api" ? Server : id === "database" ? Database : Zap;
  // The 500 shades read on both the light and the dark surface.
  const tint =
    id === "website"
      ? "bg-sky-500/15 text-sky-500"
      : id === "api"
        ? "bg-violet-500/15 text-violet-500"
        : id === "database"
          ? "bg-emerald-500/15 text-emerald-500"
          : "bg-rose-500/15 text-rose-500";
  return (
    <span className={`${box} ${tint}`}>
      <Icon className={ICON[size]} strokeWidth={2.25} />
    </span>
  );
}

/** The Instalify pie mark, as on instalify.app. */
export function InstalifyMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden>
      <path d="M50 10 A 40 40 0 0 1 90 50 L 50 50 Z" fill="#ef4444" />
      <path d="M90 50 A 40 40 0 0 1 50 90 L 50 50 Z" fill="#f87171" />
      <path d="M50 90 A 40 40 0 0 1 10 50 L 50 50 Z" fill="#fca5a5" />
      <path d="M5 45 A 40 40 0 0 1 45 5 L 45 45 Z" fill="#dc2626" transform="translate(-3, -3)" />
    </svg>
  );
}
