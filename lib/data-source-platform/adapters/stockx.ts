import { scanStockX } from "@/services/connectors/stockx";
import type { StockXIntelligenceData } from "@/services/connectors/stockx";
import { EMPTY_STOCKX_DATA } from "@/services/connectors/stockx";
import {
  pingStockXLive,
  isStockXLiveConfigured,
  STOCKX_API_LIMITATIONS,
} from "@/services/connectors/clients/stockx-client";
import { getProviderAuthStatus } from "../auth";
import {
  clearProviderCache,
  getCachedProviderResult,
  setCachedProviderResult,
} from "../cache";
import { summarizeStockX } from "../summarize";
import type {
  DataProviderAdapter,
  ProviderHealth,
  ProviderSyncResult,
} from "../types";

export type { StockXIntelligenceData };

const API_VERSION = "developer-v2";
const CACHE_TTL_MS = 30 * 60 * 1000;
const DAILY_REQUEST_BUDGET = 25_000;

function buildResult(
  data: StockXIntelligenceData | null,
  mode: "live" | "simulated",
  options: {
    error?: string;
    simulatedReason?: string;
    status?: ProviderSyncResult["status"];
    requestsUsed?: number;
  } = {},
): ProviderSyncResult<StockXIntelligenceData> {
  const auth = getProviderAuthStatus("stockx");
  const status =
    options.status ??
    (mode === "live"
      ? "connected"
      : auth.configured
        ? "offline"
        : "disconnected");

  const summaryData = data ?? EMPTY_STOCKX_DATA;
  const { summary, trending } = summarizeStockX(summaryData, mode);

  return {
    id: "stockx",
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
    rateLimit: {
      limit: DAILY_REQUEST_BUDGET,
      remaining: Math.max(
        0,
        DAILY_REQUEST_BUDGET - (options.requestsUsed ?? (mode === "live" ? 12 : 0)),
      ),
    },
  };
}

function missingCredentialsResult(): ProviderSyncResult<StockXIntelligenceData> {
  const auth = getProviderAuthStatus("stockx");
  return buildResult(null, "simulated", {
    status: "disconnected",
    error: `Missing credentials: ${auth.missingKeys.join(", ")}`,
    simulatedReason:
      "StockX Developer API requires approved STOCKX_API_KEY + OAuth access token — no marketplace data is fabricated without credentials",
  });
}

export const stockxAdapter: DataProviderAdapter<StockXIntelligenceData> = {
  id: "stockx",
  label: "StockX",
  brandColor: "#006340",
  apiVersion: API_VERSION,
  cacheTtlMs: CACHE_TTL_MS,
  getAuthStatus: () => getProviderAuthStatus("stockx"),
  async healthCheck(): Promise<ProviderHealth> {
    const auth = getProviderAuthStatus("stockx");
    const started = Date.now();

    if (!auth.configured) {
      return {
        healthy: false,
        message:
          "Coming Soon — StockX developer credentials not set (approval + OAuth required; no public open API)",
        checkedAt: new Date().toISOString(),
      };
    }

    const ping = await pingStockXLive();
    return {
      healthy: ping.ok,
      latencyMs: ping.latencyMs || Date.now() - started,
      message: ping.ok ? ping.message : `Offline — ${ping.message}`,
      checkedAt: new Date().toISOString(),
    };
  },
  async sync(options = {}): Promise<ProviderSyncResult<StockXIntelligenceData>> {
    if (!isStockXLiveConfigured()) {
      return missingCredentialsResult();
    }

    if (!options.force) {
      const cached = getCachedProviderResult<StockXIntelligenceData>(
        "stockx",
        CACHE_TTL_MS,
      );
      if (cached) return cached;
    }

    try {
      const intel = await scanStockX();
      const result = buildResult(
        intel.mode === "live" ? intel.data : null,
        intel.mode,
        {
          simulatedReason: intel.simulatedReason,
          error: intel.mode === "simulated" ? intel.simulatedReason : undefined,
          status: intel.mode === "live" ? "connected" : "offline",
          requestsUsed: intel.mode === "live" ? 12 : undefined,
        },
      );

      if (intel.mode === "live" && result.summary.length > 0) {
        result.summary.push(STOCKX_API_LIMITATIONS);
      }

      setCachedProviderResult("stockx", result);
      return result;
    } catch (error) {
      return buildResult(null, "simulated", {
        error: error instanceof Error ? error.message : "Sync failed",
        simulatedReason:
          "StockX sync error — no data fabricated when the API fails",
        status: "offline",
      });
    }
  },
};

export function disconnectStockX(): void {
  clearProviderCache("stockx");
}

/** Manual connection test for Data Sources Center. */
export async function testStockXProvider(): Promise<{
  ok: boolean;
  message: string;
  mode: "live" | "simulated";
  details?: Record<string, string | number>;
}> {
  const auth = getProviderAuthStatus("stockx");
  if (!isStockXLiveConfigured()) {
    return {
      ok: false,
      mode: "simulated",
      message:
        "Coming Soon — apply at developer.stockx.com for STOCKX_API_KEY + OAuth token",
      ...(auth.missingKeys.length > 0
        ? { details: { missing: auth.missingKeys.join(", ") } }
        : {}),
    };
  }

  const ping = await pingStockXLive();
  if (!ping.ok) {
    return {
      ok: false,
      mode: "simulated",
      message: `Developer API unreachable — ${ping.message}`,
    };
  }

  const intel = await scanStockX();
  if (intel.mode !== "live") {
    return {
      ok: false,
      mode: "simulated",
      message: intel.simulatedReason ?? "StockX returned no live data",
    };
  }

  const data = intel.data;
  return {
    ok: true,
    mode: "live",
    message: `Live · ${data.products.length} products · ${data.risingBrands.length} brands · ${data.premiumPriceRanges.length} premium bands`,
    details: {
      products: data.products.length,
      brands: data.risingBrands.length,
      silhouettes: data.trendingSilhouettes.length,
      colorways: data.colorwayTrends.length,
      withMarketPrice: data.products.filter((p) => p.marketPrice != null).length,
      latencyMs: ping.latencyMs,
    },
  };
}
