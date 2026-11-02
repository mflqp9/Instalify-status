import { TIME_ZONE } from "@/config/providers";

// Built from numeric parts rather than a locale string so the server and the
// browser always print the same text (ICU versions differ in spacing and in
// how they write am/pm, which would break hydration).

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const PARTS = new Intl.DateTimeFormat("en-US", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  hourCycle: "h23",
});

function parts(iso: string) {
  const out: Record<string, number> = {};
  for (const p of PARTS.formatToParts(new Date(iso))) if (p.type !== "literal") out[p.type] = Number(p.value);
  return out as { year: number; month: number; day: number; hour: number; minute: number };
}

function clock(hour: number, minute: number): string {
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${h}:${String(minute).padStart(2, "0")} ${hour < 12 ? "AM" : "PM"}`;
}

/** "2 Nov, 11:08 PM" in Pakistan time. */
export function formatPkt(iso: string): string {
  const p = parts(iso);
  return `${p.day} ${MONTHS[p.month - 1]}, ${clock(p.hour, p.minute)}`;
}

/** "11:08 PM" in Pakistan time. */
export function formatPktClock(iso: string): string {
  const p = parts(iso);
  return clock(p.hour, p.minute);
}

/** "2 Nov" from a YYYY-MM-DD key. */
export function formatDay(key: string): string {
  const [, m, d] = key.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]}`;
}

export function relative(iso: string, now: number): string {
  const diff = Math.round((now - new Date(iso).getTime()) / 1000);
  const future = diff < 0;
  const s = Math.abs(diff);
  let text: string;
  if (s < 45) return future ? "in a moment" : "just now";
  if (s < 3600) text = `${Math.round(s / 60)} min`;
  else if (s < 86_400) text = `${Math.round(s / 3600)} h`;
  else text = `${Math.round(s / 86_400)} day${Math.round(s / 86_400) === 1 ? "" : "s"}`;
  return future ? `in ${text}` : `${text} ago`;
}

export function duration(fromIso: string, toIso: string): string {
  const min = Math.max(1, Math.round((new Date(toIso).getTime() - new Date(fromIso).getTime()) / 60_000));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const rest = min % 60;
  if (h < 48) return rest ? `${h} h ${rest} min` : `${h} h`;
  return `${Math.round(h / 24)} days`;
}
