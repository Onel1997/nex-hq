/** Research Studio data source platform — provider contracts. */

export type ProviderId =
  | "shopify"
  | "tiktok"
  | "pinterest"
  | "google_trends"
  | "amazon"
  | "etsy"
  | "reddit"
  | "youtube"
  | "depop"
  | "stockx"
  | "grailed"
  | "instagram"
  | "fashion_news";

export type ProviderConnectionStatus =
  | "connected"
  | "disconnected"
  | "authentication_error"
  | "rate_limited"
  | "offline"
  | "syncing";

export type ProviderDataMode = "live" | "simulated";

export interface ProviderAuthStatus {
  configured: boolean;
  method: "oauth" | "api_key" | "client_credentials" | "rss" | "none";
  envKeys: string[];
  missingKeys: string[];
}

export interface ProviderRateLimit {
  limit: number;
  remaining: number;
  resetAt?: string;
}

export interface ProviderHealth {
  healthy: boolean;
  latencyMs?: number;
  message?: string;
  checkedAt: string;
}

export interface ProviderSyncResult<T = unknown> {
  id: ProviderId;
  status: ProviderConnectionStatus;
  mode: ProviderDataMode;
  data: T | null;
  summary: string[];
  trending: string[];
  lastSync: string | null;
  lastSuccessfulSync: string | null;
  cacheAgeMs: number | null;
  fromCache: boolean;
  apiVersion: string;
  error?: string;
  health?: ProviderHealth;
  rateLimit?: ProviderRateLimit;
  simulatedReason?: string;
}

export interface ProviderSnapshot {
  id: ProviderId;
  name: string;
  brandColor: string;
  status: ProviderConnectionStatus;
  mode: ProviderDataMode;
  summary: string[];
  trending: string[];
  lastSync: string | null;
  lastSuccessfulSync: string | null;
  cacheAgeMs: number | null;
  fromCache: boolean;
  apiVersion: string;
  health: ProviderHealth | null;
  error?: string;
}

export interface DataSourcePlatformSnapshot {
  loadedAt: string;
  providers: ProviderSnapshot[];
  connectedCount: number;
  failedCount: number;
  liveCount: number;
  simulatedCount: number;
}

export interface ProviderSettingsEntry {
  id: ProviderId;
  name: string;
  brandColor: string;
  status: ProviderConnectionStatus;
  mode: ProviderDataMode;
  auth: ProviderAuthStatus;
  apiVersion: string;
  lastSync: string | null;
  lastSuccessfulSync: string | null;
  cacheAgeMs: number | null;
  fromCache: boolean;
  health: ProviderHealth | null;
  error?: string;
  rateLimit?: ProviderRateLimit;
  simulatedReason?: string;
  setupGuide?: {
    purpose: string;
    steps: string[];
    simulatedWhen: string;
    docsUrl?: string;
    requiredEnvKeys: string[];
    limitations: string[];
    notes: string[];
  };
}

export interface DataSourceSettingsSnapshot {
  loadedAt: string;
  providers: ProviderSettingsEntry[];
  connectedCount: number;
  simulatedCount: number;
  offlineCount: number;
  comingSoonCount: number;
  liveCount: number;
}

export interface DataProviderAdapter<T = unknown> {
  id: ProviderId;
  label: string;
  brandColor: string;
  apiVersion: string;
  cacheTtlMs: number;
  getAuthStatus: () => ProviderAuthStatus;
  sync: (options?: { force?: boolean }) => Promise<ProviderSyncResult<T>>;
  healthCheck: () => Promise<ProviderHealth>;
}
