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

export const PROVIDER_DISPLAY_ORDER: ProviderId[] = [
  "shopify",
  "tiktok",
  "pinterest",
  "google_trends",
  "etsy",
  "amazon",
  "reddit",
  "instagram",
  "fashion_news",
];

export function resolveDisplayStatus(
  status: ProviderConnectionStatus,
  mode: ProviderDataMode,
): ProviderDisplayStatus {
  if (status === "disconnected") return "coming_soon";
  if (status === "connected" && mode === "live") return "connected";
  if (mode === "simulated") return "simulated";
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
