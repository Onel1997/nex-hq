import { scanAmazon } from "@/services/connectors/amazon";
import type { AmazonIntelligenceData } from "@/services/connectors/amazon";
import { EMPTY_AMAZON_DATA } from "@/services/connectors/amazon";
import {
  pingAmazonLive,
  AMAZON_API_LIMITATIONS,
} from "@/services/connectors/clients/amazon-client";
import { getProviderAuthStatus } from "../auth";
import {
  clearProviderCache,
  getCachedProviderResult,
  setCachedProviderResult,
} from "../cache";
import { summarizeAmazon } from "../summarize";
import type {
  DataProviderAdapter,
  ProviderHealth,
  ProviderSyncResult,
} from "../types";

const API_VERSION = "pa-api-v5";
const CACHE_TTL_MS = 20 * 60 * 1000;

function buildResult(
  data: AmazonIntelligenceData | null,
  mode: "live" | "simulated",
  options: {
    error?: string;
    simulatedReason?: string;
    status?: ProviderSyncResult["status"];
  } = {},
): ProviderSyncResult<AmazonIntelligenceData> {
  const auth = getProviderAuthStatus("amazon");
  const status =
    options.status ??
    (mode === "live"
      ? "connected"
      : auth.configured
        ? "offline"
        : "disconnected");

  const summaryData = data ?? EMPTY_AMAZON_DATA;
  const { summary, trending } = summarizeAmazon(summaryData, mode);

  return {
    id: "amazon",
    status,
    mode,
    data,
    summary,
    trending,
    lastSync: new Date().toISOString(),
    lastSuccessfulSync: mode === "live" ? new Date().toISOString() : null,
    cacheAgeMs: 0,
    fromCache: false,
    apiVersion: API_VERSION,
    error: options.error,
    simulatedReason: options.simulatedReason,
  };
}

function missingCredentialsResult(): ProviderSyncResult<AmazonIntelligenceData> {
  const auth = getProviderAuthStatus("amazon");
  return buildResult(null, "simulated", {
    status: "disconnected",
    error: `Missing credentials: ${auth.missingKeys.join(", ")}`,
    simulatedReason:
      "Set AMAZON_ACCESS_KEY, AMAZON_SECRET_KEY and AMAZON_PARTNER_TAG in .env.local — no Amazon data is fabricated without credentials",
  });
}

export const amazonAdapter: DataProviderAdapter<AmazonIntelligenceData> = {
  id: "amazon",
  label: "Amazon",
  brandColor: "#ff9900",
  apiVersion: API_VERSION,
  cacheTtlMs: CACHE_TTL_MS,
  getAuthStatus: () => getProviderAuthStatus("amazon"),
  async healthCheck(): Promise<ProviderHealth> {
    const auth = getProviderAuthStatus("amazon");
    const started = Date.now();

    if (!auth.configured) {
      return {
        healthy: false,
        message:
          "Simulated — Amazon PA-API credentials not set (Access Key, Secret Key, Partner Tag required)",
        checkedAt: new Date().toISOString(),
      };
    }

    const ping = await pingAmazonLive();
    return {
      healthy: ping.ok,
      latencyMs: ping.latencyMs || Date.now() - started,
      message: ping.ok ? ping.message : `Offline — ${ping.message}`,
      checkedAt: new Date().toISOString(),
    };
  },
  async sync(options = {}): Promise<ProviderSyncResult<AmazonIntelligenceData>> {
    const auth = getProviderAuthStatus("amazon");
    if (!auth.configured) {
      return missingCredentialsResult();
    }

    if (!options.force) {
      const cached = getCachedProviderResult<AmazonIntelligenceData>(
        "amazon",
        CACHE_TTL_MS,
      );
      if (cached) return cached;
    }

    try {
      const intel = await scanAmazon();
      const result = buildResult(
        intel.mode === "live" ? intel.data : null,
        intel.mode,
        {
          simulatedReason: intel.simulatedReason,
          error: intel.mode === "simulated" ? intel.simulatedReason : undefined,
          status: intel.mode === "live" ? "connected" : "offline",
        },
      );

      if (intel.mode === "live" && result.summary.length > 0) {
        result.summary.push(AMAZON_API_LIMITATIONS);
      }

      setCachedProviderResult("amazon", result);
      return result;
    } catch (error) {
      return buildResult(null, "simulated", {
        error: error instanceof Error ? error.message : "Sync failed",
        simulatedReason:
          "Amazon sync error — no data fabricated when the API fails",
        status: "offline",
      });
    }
  },
};

export function disconnectAmazon(): void {
  clearProviderCache("amazon");
}

/** Manual connection test for Data Sources Center. */
export async function testAmazonProvider(): Promise<{
  ok: boolean;
  message: string;
  mode: "live" | "simulated";
  details?: Record<string, string | number>;
}> {
  const auth = getProviderAuthStatus("amazon");
  if (!auth.configured) {
    return {
      ok: false,
      mode: "simulated",
      message:
        "Simulated — set Amazon PA-API credentials for live product, pricing and category signals",
    };
  }

  const ping = await pingAmazonLive();
  if (!ping.ok) {
    return {
      ok: false,
      mode: "simulated",
      message: `Live API unreachable — ${ping.message}`,
    };
  }

  const intel = await scanAmazon();
  if (intel.mode !== "live") {
    return {
      ok: false,
      mode: "simulated",
      message: intel.simulatedReason ?? "Amazon returned no live data",
    };
  }

  const data = intel.data;
  return {
    ok: true,
    mode: "live",
    message: `Live · ${data.bestsellers.length} products · ${data.categories.length} categories · ${data.demandSignals.length} demand signals`,
    details: {
      products: data.bestsellers.length,
      categories: data.categories.length,
      demandSignals: data.demandSignals.length,
      latencyMs: ping.latencyMs,
    },
  };
}
