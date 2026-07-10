import type {
  ProviderConnectionStatus,
  ProviderDataMode,
  ProviderId,
} from "@/lib/data-source-platform/types";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";

export type ProviderDisplayStatus =
  | "connected"
  | "simulated"
  | "offline"
  | "coming_soon";

/** Live providers with production integrations. */
export const CONNECTED_PROVIDER_IDS: ProviderId[] = [
  "shopify",
  "fashion_news",
];

/** Planned / extended intelligence providers. */
export const PLANNED_PROVIDER_IDS: ProviderId[] = [
  "tiktok",
  "pinterest",
  "google_trends",
  "amazon",
  "etsy",
  "reddit",
  "youtube",
  "stockx",
  "grailed",
  "instagram",
  "depop",
];

export const PROVIDER_DISPLAY_ORDER: ProviderId[] = [
  ...CONNECTED_PROVIDER_IDS,
  ...PLANNED_PROVIDER_IDS,
];

export function resolveDisplayStatus(
  status: ProviderConnectionStatus,
  mode: ProviderDataMode,
): ProviderDisplayStatus {
  if (status === "disconnected") return "coming_soon";
  if (status === "connected" && mode === "live") return "connected";
  if (
    mode === "simulated" &&
    status !== "offline" &&
    status !== "rate_limited"
  ) {
    return "simulated";
  }
  return "offline";
}

export function displayStatusLabel(
  status: ProviderDisplayStatus,
  locale: Locale = DEFAULT_LOCALE,
): string {
  const labels = getDictionary(locale).research.studio.dataSources.displayStatus;
  return labels[status];
}

export function formatCacheAge(
  cacheAgeMs: number | null,
  fromCache: boolean,
  locale: Locale = DEFAULT_LOCALE,
): string {
  const ds = getDictionary(locale).research.studio.dataSources;
  if (!fromCache || cacheAgeMs == null) return ds.cacheFresh;
  const seconds = Math.round(cacheAgeMs / 1000);
  if (seconds < 60) return ds.cacheSeconds.replace("{seconds}", String(seconds));
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return ds.cacheMinutes.replace("{minutes}", String(minutes));
  const hours = Math.round(minutes / 60);
  return ds.cacheHours.replace("{hours}", String(hours));
}

export function authMethodLabel(
  method: "oauth" | "api_key" | "client_credentials" | "rss" | "none",
  locale: Locale = DEFAULT_LOCALE,
): string {
  const ds = getDictionary(locale).research.studio.dataSources;
  switch (method) {
    case "oauth":
      return ds.oauth;
    case "api_key":
      return ds.apiKey;
    case "client_credentials":
      return ds.clientCredentials;
    case "rss":
      return ds.rssFeed;
    case "none":
      return ds.notRequired;
  }
}

export function groupProvidersBySection<T extends { id: ProviderId }>(
  providers: T[],
): { connected: T[]; planned: T[] } {
  const order = new Map(
    PROVIDER_DISPLAY_ORDER.map((id, index) => [id, index]),
  );
  const sorted = [...providers].sort(
    (a, b) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99),
  );

  return {
    connected: sorted.filter((provider) =>
      CONNECTED_PROVIDER_IDS.includes(provider.id),
    ),
    planned: sorted.filter((provider) =>
      PLANNED_PROVIDER_IDS.includes(provider.id),
    ),
  };
}
