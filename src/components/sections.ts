import type { ProviderId } from "@/lib/status/types";

export type SectionId = "summary" | "systems" | ProviderId;

export const SECTION_IDS: SectionId[] = ["summary", "systems", "cloudflare", "railway", "supabase", "vercel"];

export function isSectionId(value: string): value is SectionId {
  return (SECTION_IDS as string[]).includes(value);
}
