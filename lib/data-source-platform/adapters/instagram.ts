import { getProviderAuthStatus } from "../auth";
import { clearProviderCache } from "../cache";
import type {
  DataProviderAdapter,
  ProviderHealth,
  ProviderSyncResult,
} from "../types";

export interface InstagramIntelligenceData {
  prepared: boolean;
  note: string;
}

const API_VERSION = "graph-v19";

export const instagramAdapter: DataProviderAdapter<InstagramIntelligenceData> = {
  id: "instagram",
  label: "Instagram",
  brandColor: "#e1306c",
  apiVersion: API_VERSION,
  cacheTtlMs: 0,
  getAuthStatus: () => getProviderAuthStatus("instagram"),
  async healthCheck(): Promise<ProviderHealth> {
    return {
      healthy: false,
      message: "Instagram adapter prepared — integration coming soon",
      checkedAt: new Date().toISOString(),
    };
  },
  async sync(): Promise<ProviderSyncResult<InstagramIntelligenceData>> {
    return {
      id: "instagram",
      status: "disconnected",
      mode: "simulated",
      data: {
        prepared: true,
        note: "Instagram Graph API adapter scaffolded",
      },
      summary: ["Adapter prepared for future integration"],
      trending: [],
      lastSync: null,
      lastSuccessfulSync: null,
      cacheAgeMs: null,
      fromCache: false,
      apiVersion: API_VERSION,
    };
  },
};

export function disconnectInstagram(): void {
  clearProviderCache("instagram");
}
