import type {
  ProviderConnectionStatus,
  ProviderDataMode,
  ProviderId,
} from "@/lib/data-source-platform/types";

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

export function displayStatusLabel(status: ProviderDisplayStatus): string {
  switch (status) {
    case "connected":
      return "Connected";
    case "simulated":
      return "Simulated";
    case "offline":
      return "Offline";
    case "coming_soon":
      return "Coming Soon";
  }
}

export function formatCacheAge(cacheAgeMs: number | null, fromCache: boolean): string {
  if (!fromCache || cacheAgeMs == null) return "Fresh";
  const seconds = Math.round(cacheAgeMs / 1000);
  if (seconds < 60) return `${seconds}s cached`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m cached`;
  const hours = Math.round(minutes / 60);
  return `${hours}h cached`;
}

export function authMethodLabel(
  method: "oauth" | "api_key" | "client_credentials" | "rss" | "none",
): string {
  switch (method) {
    case "oauth":
      return "OAuth";
    case "api_key":
      return "API Key";
    case "client_credentials":
      return "Client Credentials";
    case "rss":
      return "RSS Feed";
    case "none":
      return "Not required";
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
