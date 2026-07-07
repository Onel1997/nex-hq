/** Prepared data source connectors — intelligence layer ready, live APIs env-gated. */
export type DataSourceId =
  | "shopify"
  | "marketprint"
  | "reddit"
  | "pinterest"
  | "google_trends"
  | "tiktok"
  | "instagram"
  | "fashion_news"
  | "consumer_signals"
  | "etsy"
  | "amazon"
  | "own_sales"
  | "pod";

export type DataSourceStatus = "connected" | "ready" | "planned";

export interface DataSourceConnector {
  id: DataSourceId;
  label: string;
  status: DataSourceStatus;
  description: string;
}

export const RESEARCH_DATA_SOURCES: DataSourceConnector[] = [
  {
    id: "shopify",
    label: "Shopify",
    status: "connected",
    description: "Catalog, sales, bestsellers, weak SKUs",
  },
  {
    id: "marketprint",
    label: "MarketPrint",
    status: "connected",
    description: "POD catalog, embroidery-ready products",
  },
  {
    id: "own_sales",
    label: "Eigene Verkäufe",
    status: "connected",
    description: "Shopify order history and unit velocity",
  },
  {
    id: "pod",
    label: "POD-Daten",
    status: "connected",
    description: "Supplier-managed fulfillment intelligence",
  },
  {
    id: "google_trends",
    label: "Google Trends",
    status: "ready",
    description: "Nachfrage, Saisonalität, Keywords, Länder",
  },
  {
    id: "reddit",
    label: "Reddit",
    status: "ready",
    description: "streetwear, fashion, fashionreps, streetwearstartup, MFA",
  },
  {
    id: "pinterest",
    label: "Pinterest",
    status: "ready",
    description: "Farbwelten, Moodboards, Ästhetiken, Capsule Trends",
  },
  {
    id: "tiktok",
    label: "TikTok",
    status: "ready",
    description: "Virale Streetwear Trends, Hashtags, Silhouetten",
  },
  {
    id: "etsy",
    label: "Etsy",
    status: "ready",
    description: "Bestseller, Keywords, Print Trends, Preisbereiche",
  },
  {
    id: "amazon",
    label: "Amazon",
    status: "ready",
    description: "Bestseller, Nachfrage, Bewertungen, Kategorien",
  },
  {
    id: "instagram",
    label: "Instagram",
    status: "planned",
    description: "Streetwear brand visual signals",
  },
  {
    id: "fashion_news",
    label: "Fashion News",
    status: "planned",
    description: "Industry movement and launch coverage",
  },
  {
    id: "consumer_signals",
    label: "Consumer Signals",
    status: "ready",
    description: "Aggregated demand and sentiment",
  },
];

export function isLiveConnector(id: DataSourceId): boolean {
  switch (id) {
    case "google_trends":
      return Boolean(process.env.GOOGLE_TRENDS_API_KEY);
    case "reddit":
      return Boolean(
        process.env.REDDIT_CLIENT_ID && process.env.REDDIT_CLIENT_SECRET,
      );
    case "pinterest":
      return Boolean(process.env.PINTEREST_ACCESS_TOKEN);
    case "tiktok":
      return Boolean(
        process.env.TIKTOK_CLIENT_KEY && process.env.TIKTOK_CLIENT_SECRET,
      );
    case "etsy":
      return Boolean(process.env.ETSY_API_KEY);
    case "amazon":
      return Boolean(
        process.env.AMAZON_ACCESS_KEY &&
          process.env.AMAZON_SECRET_KEY &&
          process.env.AMAZON_PARTNER_TAG,
      );
    default:
      return false;
  }
}

export function resolveDataSourceStatus(
  source: DataSourceConnector,
): DataSourceStatus {
  if (source.status === "planned") return "planned";
  if (source.status === "connected") return "connected";
  return isLiveConnector(source.id) ? "connected" : "ready";
}

export function getResolvedDataSources(): DataSourceConnector[] {
  return RESEARCH_DATA_SOURCES.map((source) => ({
    ...source,
    status: resolveDataSourceStatus(source),
  }));
}

export function getActiveSourceLabels(): string[] {
  return getResolvedDataSources()
    .filter((s) => s.status === "connected")
    .map((s) => s.label);
}

export function getReadySourceLabels(): string[] {
  return getResolvedDataSources()
    .filter((s) => s.status === "connected" || s.status === "ready")
    .map((s) => s.label);
}

export function getPlannedSourceLabels(): string[] {
  return RESEARCH_DATA_SOURCES.filter((s) => s.status === "planned").map(
    (s) => s.label,
  );
}
