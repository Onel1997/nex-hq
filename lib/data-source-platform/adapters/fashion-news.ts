import { getProviderAuthStatus } from "../auth";
import { clearProviderCache } from "../cache";
import type {
  DataProviderAdapter,
  ProviderHealth,
  ProviderSyncResult,
} from "../types";

export interface FashionNewsIntelligenceData {
  prepared: boolean;
  feeds: string[];
  note: string;
}

const API_VERSION = "rss-v1";

export const fashionNewsAdapter: DataProviderAdapter<FashionNewsIntelligenceData> =
  {
    id: "fashion_news",
    label: "Fashion News",
    brandColor: "#a78bfa",
    apiVersion: API_VERSION,
    cacheTtlMs: 0,
    getAuthStatus: () => getProviderAuthStatus("fashion_news"),
    async healthCheck(): Promise<ProviderHealth> {
      const auth = getProviderAuthStatus("fashion_news");
      return {
        healthy: false,
        message: auth.configured
          ? "RSS URL configured — parser coming soon"
          : "FASHION_NEWS_RSS_URL not configured",
        checkedAt: new Date().toISOString(),
      };
    },
    async sync(): Promise<ProviderSyncResult<FashionNewsIntelligenceData>> {
      const auth = getProviderAuthStatus("fashion_news");
      return {
        id: "fashion_news",
        status: "disconnected",
        mode: "simulated",
        data: {
          prepared: true,
          feeds: auth.configured ? [process.env.FASHION_NEWS_RSS_URL ?? ""] : [],
          note: "RSS provider abstraction prepared",
        },
        summary: ["Fashion news feed launching soon"],
        trending: [],
        lastSync: null,
        lastSuccessfulSync: null,
        cacheAgeMs: null,
        fromCache: false,
        apiVersion: API_VERSION,
      };
    },
  };

export function disconnectFashionNews(): void {
  clearProviderCache("fashion_news");
}
