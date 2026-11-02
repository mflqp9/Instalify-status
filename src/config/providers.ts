import type { ProviderId } from "@/lib/status/types";

/**
 * Which parts of each provider Instalify actually depends on.
 *
 * Every provider page reports on its whole platform, and the whole platform is
 * almost never green: Cloudflare alone usually has a few of its 330+ cities
 * rerouted at any moment, so its own headline reads "Partial System Outage" on
 * a perfectly normal day. Leading with that would tell Instalify's users the
 * app is broken when it is not. So each provider lists the components that
 * matter here (`focus`); the page leads with those and shows the provider's own
 * headline underneath, so nothing is hidden.
 *
 * Facts these lists rest on, checked on 2026-11-02:
 * - instalify.app and admin.instalify.app are served by Cloudflare Workers
 *   (OpenNext, R2 incremental cache) through the Karachi data centre.
 * - api.instalify.app and Redis run on Railway in Southeast Asia (Singapore).
 * - The database is Supabase ap-southeast-1 (Singapore).
 *
 * A focus entry matches "Group/Component" for a grouped component, or just
 * "Component" for one that is not in a group.
 *
 * `regional` handles incidents that are tagged with a global service but are
 * really about one place ("Elevated errors for R2 in Eastern Europe"). Without
 * it, two weeks of Cloudflare history were mostly red for Pakistan users who
 * were never affected. A title naming another place, and not ours, is treated
 * as elsewhere.
 */
export type FocusMatcher = string | RegExp;

export interface RegionalRule {
  elsewhere: RegExp;
  ours: RegExp;
}

interface BaseProvider {
  id: ProviderId;
  name: string;
  /** What Instalify uses this provider for. */
  role: string;
  /** What an outage here means for someone using Instalify. */
  impact: string;
  pageUrl: string;
  focusTitle: string;
  focus: FocusMatcher[];
  regional?: RegionalRule;
  /** Incident titles about features Instalify does not use. */
  unused?: RegExp;
}

export interface StatuspageProvider extends BaseProvider {
  kind: "statuspage";
  apiBase: string;
  /** Name for the components that sit in no group. */
  ungroupedName: string;
}

export interface IncidentIoProvider extends BaseProvider {
  kind: "incidentio";
  widgetUrl: string;
  /** Statuspage-compatible incident list, used for the 14-day history. */
  incidentsUrl: string;
  ungroupedName: string;
}

export interface RailwayProvider extends BaseProvider {
  kind: "railway";
  apiUrl: string;
}

export type ProviderConfig = StatuspageProvider | IncidentIoProvider | RailwayProvider;

export const PROVIDERS: ProviderConfig[] = [
  {
    id: "cloudflare",
    kind: "statuspage",
    name: "Cloudflare",
    role: "Website hosting, DNS & security",
    impact:
      "instalify.app and the Instalify API reach you through Cloudflare. A problem here can stop Instalify from opening or make it slow.",
    pageUrl: "https://www.cloudflarestatus.com",
    apiBase: "https://www.cloudflarestatus.com/api/v2",
    ungroupedName: "Other services",
    focusTitle: "Pakistan locations & services Instalify uses",
    focus: [
      /\/(Karachi|Lahore|Islamabad), Pakistan/,
      "Cloudflare Sites and Services/CDN/Cache",
      "Cloudflare Sites and Services/Authoritative DNS",
      "Cloudflare Sites and Services/SSL Certificate Provisioning",
      "Cloudflare Sites and Services/Firewall",
      "Cloudflare Sites and Services/Workers",
      "Cloudflare Sites and Services/Workers Assets",
      "Cloudflare Sites and Services/Durable Objects",
      "Cloudflare Sites and Services/R2",
      "Cloudflare Sites and Services/Images",
    ],
    regional: {
      elsewhere:
        /\b(ENAM|WNAM|EEUR|WEUR|EMEA|North America|South America|Latin America|Europe|Africa|Oceania|Australia|Japan|Korea|China|Brazil|India|United States|Canada|Mexico)\b|\((?!KHI|LHE|ISB)[A-Z]{3}\)/,
      ours: /\b(Pakistan|Karachi|Lahore|Islamabad|KHI|LHE|ISB|Asia|global(ly)?|worldwide|all regions|multiple regions)\b/i,
    },
  },
  {
    id: "railway",
    kind: "railway",
    name: "Railway",
    role: "API server & Redis",
    impact:
      "The Instalify API and Redis run on Railway in Singapore. If Railway is down, login, sales, payments and reports cannot load or save.",
    pageUrl: "https://status.railway.com",
    apiUrl: "https://status.railway.com/api/status",
    focusTitle: "Singapore region, where Instalify runs",
    focus: [
      "Southeast Asia (Singapore)/Compute",
      "Southeast Asia (Singapore)/Networking — Public",
      "Southeast Asia (Singapore)/Networking — Private",
      "Southeast Asia (Singapore)/Storage",
      "Southeast Asia (Singapore)/Deployments",
    ],
  },
  {
    id: "supabase",
    kind: "incidentio",
    name: "Supabase",
    role: "Database, sign-in & file storage",
    impact:
      "All Instalify records live in Supabase (Singapore). If it is down, data cannot be read or saved.",
    pageUrl: "https://status.supabase.com",
    widgetUrl: "https://status.supabase.com/proxy/status.supabase.com",
    incidentsUrl: "https://status.supabase.com/api/v2/incidents.json",
    ungroupedName: "Platform",
    focusTitle: "Singapore region (ap-southeast-1)",
    focus: [
      "Postgres/ap-southeast-1",
      "Connection Pooler/ap-southeast-1",
      "Data APIs/ap-southeast-1",
      "Storage/ap-southeast-1",
      "Auth",
    ],
    regional: {
      elsewhere:
        /\b(EU|Europe|US|North America|South America|Canada|Japan|Korea|Australia|India|Mumbai|Tokyo|Seoul|Sydney|Frankfurt|London|Ireland|Paris|Stockholm|Zurich|Sao Paulo|(us|eu|ca|sa|ap)-(east|west|central|north|south|northeast|southeast)-\d)\b/,
      ours: /\b(ap-southeast-1|Singapore|multiple regions|all regions|global(ly)?|worldwide)\b/i,
    },
    // Supabase's incident feed names no components, and most of its incidents
    // are about its control plane (logs, the management API, creating or
    // upgrading projects), which a running Instalify never touches.
    unused: /\b(logs?|log drains?|log delivery|mgmt api|management api|project creation|project lifecycle|branching|upgrade failures|PG\d+ -> PG\d+)\b/i,
  },
  {
    id: "vercel",
    kind: "statuspage",
    name: "Vercel",
    role: "Business sites & web deployments",
    impact:
      "Instalify business subdomain sites and some web deployments run on Vercel. If it is down, those pages may not open or update.",
    pageUrl: "https://www.vercel-status.com",
    apiBase: "https://www.vercel-status.com/api/v2",
    ungroupedName: "Platform",
    focusTitle: "Hosting & the edge nearest Pakistan",
    focus: [
      "Build & Deploy/Builds",
      "Functions",
      "Routing Middleware",
      "Image Optimization",
      "Data Cache",
      "DNS",
      "TLS Certificates",
      "Firewall",
      /^CDN\/(BOM1|DXB1|SIN1)\b/,
    ],
    regional: {
      elsewhere: /\((?!bom1|dxb1|sin1)[a-z]{3}\d\)/,
      ours: /\b(bom1|dxb1|sin1|global(ly)?|all regions|multiple regions)\b/i,
    },
  },
];

/** Instalify's own endpoints, checked directly. */
export const INSTALIFY = {
  websiteUrl: "https://instalify.app/",
  // Public, unauthenticated, and built for this: ?db=1 times five `SELECT 1`
  // round trips from the API server, ?redis=1 sends one PING. Neither returns
  // anything secret (backend/src/index.ts, GET /api/health).
  healthUrl: "https://api.instalify.app/api/health?db=1&redis=1",
} as const;

/** Days shown in each provider's history strip. */
export const HISTORY_DAYS = 14;

export const TIME_ZONE = "Asia/Karachi";
