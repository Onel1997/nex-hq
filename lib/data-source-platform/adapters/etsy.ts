import { scanEtsy } from "@/services/connectors/etsy";
import type { EtsyIntelligenceData } from "@/services/connectors/etsy";
import { EMPTY_ETSY_DATA } from "@/services/connectors/etsy";
import {
  pingEtsyLive,
  ETSY_API_LIMITATIONS,
} from "@/services/connectors/clients/etsy-client";
import { getProviderAuthStatus } from "../auth";
import {
  clearProviderCache,
  getCachedProviderResult,
  setCachedProviderResult,
} from "../cache";
import { summarizeEtsy } from "../summarize";
import type {
  DataProviderAdapter,
  ProviderHealth,
  ProviderSyncResult,
} from "../types";

const API_VERSION = "v3";
const CACHE_TTL_MS = 20 * 60 * 1000;

function buildResult(
  data: EtsyIntelligenceData | null,
  mode: "live" | "simulated",
  options: {
    error?: string;
    simulatedReason?: string;
    status?: ProviderSyncResult["status"];
  } = {},
): ProviderSyncResult<EtsyIntelligenceData> {
  const auth = getProviderAuthStatus("etsy");
  const status =
    options.status ??
    (mode === "live"
      ? "connected"
      : auth.configured
        ? "offline"
        : "disconnected");

  const summaryData = data ?? EMPTY_ETSY_DATA;
  const { summary, trending } = summarizeEtsy(summaryData, mode);

  return {
    id: "etsy",
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

function missingCredentialsResult(): ProviderSyncResult<EtsyIntelligenceData> {
  const auth = getProviderAuthStatus("etsy");
  return buildResult(null, "simulated", {
    status: "disconnected",
    error: `Missing credentials: ${auth.missingKeys.join(", ")}`,
    simulatedReason:
      "Set ETSY_API_KEY in .env.local — no Etsy data is fabricated without credentials",
  });
}

export const etsyAdapter: DataProviderAdapter<EtsyIntelligenceData> = {
  id: "etsy",
  label: "Etsy",
  brandColor: "#f56400",
  apiVersion: API_VERSION,
  cacheTtlMs: CACHE_TTL_MS,
  getAuthStatus: () => getProviderAuthStatus("etsy"),
  async healthCheck(): Promise<ProviderHealth> {
    const auth = getProviderAuthStatus("etsy");
    const started = Date.now();

    if (!auth.configured) {
      return {
        healthy: false,
        message:
          "Simulated — ETSY_API_KEY not set (Etsy Open API v3 keystring required for live listings)",
        checkedAt: new Date().toISOString(),
      };
    }

    const ping = await pingEtsyLive();
    return {
      healthy: ping.ok,
      latencyMs: ping.latencyMs || Date.now() - started,
      message: ping.ok ? ping.message : `Offline — ${ping.message}`,
      checkedAt: new Date().toISOString(),
    };
  },
  async sync(options = {}): Promise<ProviderSyncResult<EtsyIntelligenceData>> {
    const auth = getProviderAuthStatus("etsy");
    if (!auth.configured) {
      return missingCredentialsResult();
    }

    if (!options.force) {
      const cached = getCachedProviderResult<EtsyIntelligenceData>(
        "etsy",
        CACHE_TTL_MS,
      );
      if (cached) return cached;
    }

    try {
      const intel = await scanEtsy();
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
        result.summary.push(ETSY_API_LIMITATIONS);
      }

      setCachedProviderResult("etsy", result);
      return result;
    } catch (error) {
      return buildResult(null, "simulated", {
        error: error instanceof Error ? error.message : "Sync failed",
        simulatedReason:
          "Etsy sync error — no data fabricated when the API fails",
        status: "offline",
      });
    }
  },
};

export function disconnectEtsy(): void {
  clearProviderCache("etsy");
}

/** Manual connection test for Data Sources Center. */
export async function testEtsyProvider(): Promise<{
  ok: boolean;
  message: string;
  mode: "live" | "simulated";
  details?: Record<string, string | number>;
}> {
  const auth = getProviderAuthStatus("etsy");
  if (!auth.configured) {
    return {
      ok: false,
      mode: "simulated",
      message:
        "Simulated — set ETSY_API_KEY for live Etsy fashion listings and pricing signals",
    };
  }

  const ping = await pingEtsyLive();
  if (!ping.ok) {
    return {
      ok: false,
      mode: "simulated",
      message: `Live API unreachable — ${ping.message}`,
    };
  }

  const intel = await scanEtsy();
  if (intel.mode !== "live") {
    return {
      ok: false,
      mode: "simulated",
      message: intel.simulatedReason ?? "Etsy returned no live data",
    };
  }

  const data = intel.data;
  return {
    ok: true,
    mode: "live",
    message: `Live · ${data.bestsellers.length} popular listings · ${data.keywords.length} keywords · ${data.priceRanges.length} price bands`,
    details: {
      listings: data.bestsellers.length,
      keywords: data.keywords.length,
      priceBands: data.priceRanges.length,
      patterns: data.printTrends.length,
      latencyMs: ping.latencyMs,
    },
  };
}
