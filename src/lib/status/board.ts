import "server-only";

import { cacheLife } from "next/cache";

import { PROVIDERS, type ProviderConfig } from "@/config/providers";

import { checkInstalify } from "./instalify";
import { loadIncidentIo } from "./incidentio";
import { worst } from "./levels";
import { loadRailway } from "./railway";
import { unavailableProvider } from "./shared";
import { loadStatuspage } from "./statuspage";
import type { ProviderStatus, StatusBoard } from "./types";

/**
 * Everything the page shows, gathered in one pass and cached for a minute.
 *
 * The cache is what keeps an outage from becoming two: when something breaks,
 * every Instalify user opens this page at once. Without it each visit would
 * call four status APIs and Instalify's own health route (five database round
 * trips each). With it, the page is prerendered and refreshed in the background
 * at most once a minute however many people are looking. `expire` is kept at
 * ten minutes because a shorter one drops the board out of the prerender.
 */
export async function getStatusBoard(): Promise<StatusBoard> {
  "use cache";
  cacheLife({ stale: 30, revalidate: 60, expire: 600 });

  const now = new Date();
  const [systems, ...providers] = await Promise.all([checkInstalify(), ...PROVIDERS.map((p) => loadProvider(p, now))]);

  return {
    generatedAt: now.toISOString(),
    level: worst([...systems.map((s) => s.level), ...providers.map((p) => p.level)]),
    systems,
    providers,
  };
}

async function loadProvider(config: ProviderConfig, now: Date): Promise<ProviderStatus> {
  try {
    switch (config.kind) {
      case "statuspage":
        return await loadStatuspage(config, now);
      case "incidentio":
        return await loadIncidentIo(config, now);
      case "railway":
        return await loadRailway(config, now);
    }
  } catch (error) {
    console.error(`[status] ${config.id} could not be read:`, error instanceof Error ? error.message : error);
    return unavailableProvider(config, now);
  }
}
