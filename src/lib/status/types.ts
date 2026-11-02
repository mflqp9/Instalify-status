/**
 * The one shape every provider is normalised into. The page only ever sees
 * these types, never a provider's raw API response, so a provider changing its
 * status vendor (Supabase moved to incident.io, Railway to its own page) is a
 * change to one adapter file and nothing else.
 */

export type Level = "operational" | "unknown" | "maintenance" | "degraded" | "partial" | "major";

export type ProviderId = "cloudflare" | "railway" | "supabase" | "vercel";

export interface ComponentState {
  id: string;
  name: string;
  /** Group the component sits in on the provider's page, if any. */
  group: string | null;
  level: Level;
  /** Railway publishes a 90-day uptime per component; the others do not. */
  uptime?: string;
}

export interface GroupState {
  id: string;
  name: string;
  level: Level;
  components: ComponentState[];
}

export interface IncidentUpdate {
  status: string;
  body: string;
  at: string;
}

export interface Incident {
  id: string;
  title: string;
  level: Level;
  status: string;
  startedAt: string;
  resolvedAt: string | null;
  url: string;
  affected: string[];
  /** Touches something Instalify depends on (see `focus` in config/providers.ts). */
  relevant: boolean;
  latest: IncidentUpdate | null;
}

export interface Maintenance {
  id: string;
  title: string;
  status: string;
  inProgress: boolean;
  startsAt: string | null;
  endsAt: string | null;
  url: string;
  affected: string[];
  relevant: boolean;
}

export interface HistoryDay {
  /** YYYY-MM-DD in Pakistan time. */
  date: string;
  level: Level | "nodata";
  /** Titles of the incidents that touched Instalify's components that day. */
  incidents: string[];
}

export interface ProviderStatus {
  id: ProviderId;
  name: string;
  role: string;
  impact: string;
  pageUrl: string;
  /** False when the provider's status API could not be read at all. */
  available: boolean;
  /** Status of the parts Instalify depends on — what the page leads with. */
  level: Level;
  /** What the provider itself reports for its whole platform. */
  official: { level: Level; text: string } | null;
  focus: { title: string; components: ComponentState[] };
  groups: GroupState[];
  componentCount: number;
  affectedCount: number;
  incidents: Incident[];
  maintenances: Maintenance[];
  recent: Incident[];
  history: HistoryDay[];
}

export type SystemId = "website" | "api" | "database" | "redis";

export interface SystemCheck {
  id: SystemId;
  name: string;
  detail: string;
  level: Level;
  /** One-line, user-facing explanation of the current result. */
  note: string;
  latencyMs: number | null;
  metrics: { label: string; value: string }[];
}

export interface StatusBoard {
  generatedAt: string;
  level: Level;
  systems: SystemCheck[];
  providers: ProviderStatus[];
}
