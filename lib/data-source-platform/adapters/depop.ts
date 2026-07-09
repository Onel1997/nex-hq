import { scanDepop } from "@/services/connectors/depop";
import type { DepopIntelligenceData } from "@/services/connectors/depop";
import { EMPTY_DEPOP_DATA } from "@/services/connectors/depop";
import {
  pingDepopLive,
  DEPOP_API_LIMITATIONS,
} from "@/services/connectors/clients/depop-client";
import { getProviderAuthStatus } from "../auth";
import {
  clearProviderCache,
  getCachedProviderResult,
  setCachedProviderResult,
} from "../cache";
import { summarizeDepop } from "../summarize";
import type {
  DataProviderAdapter,
  ProviderHealth,
  ProviderSyncResult,
} from "../types";

export type { DepopIntelligenceData };

const API_VERSION = "partner-v1";
const CACHE_TTL_MS = 20 * 60 * 1000;

function buildResult(
  data: DepopIntelligenceData | null,
  mode: "live" | "simulated",
  options: {
    error?: string;
    simulatedReason?: string;
    status?: ProviderSyncResult["status"];
  } = {},
): ProviderSyncResult<DepopIntelligenceData> {
  const auth = getProviderAuthStatus("depop");
  const status =
    options.status ??
    (mode === "live"
      ? "connected"
      : auth.configured
        ? "offline"
        : "disconnected");

  const summaryData = data ?? EMPTY_DEPOP_DATA;
  const { summary, trending } = summarizeDepop(summaryData, mode);

  return {
    id: "depop",
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

function missingCredentialsResult(): ProviderSyncResult<DepopIntelligenceData> {
  const auth = getProviderAuthStatus("depop");
  return buildResult(null, "simulated", {
    status: "disconnected",
    error: `Missing credentials: ${auth.missingKeys.join(", ")}`,
    simulatedReason:
      "Depop Partner Selling API requires DEPOP_API_KEY (approved partner access) — no resale data is fabricated without credentials",
  });
}

export const depopAdapter: DataProviderAdapter<DepopIntelligenceData> = {
  id: "depop",
  label: "Depop",
  brandColor: "#ff2300",
  apiVersion: API_VERSION,
  cacheTtlMs: CACHE_TTL_MS,
  getAuthStatus: () => getProviderAuthStatus("depop"),
  async healthCheck(): Promise<ProviderHealth> {
    const auth = getProviderAuthStatus("depop");
    const started = Date.now();

    if (!auth.configured) {
      return {
        healthy: false,
        message:
          "Coming Soon — DEPOP_API_KEY not set (Depop Partner Selling API requires approved partner credentials; no public marketplace API)",
        checkedAt: new Date().toISOString(),
      };
    }

    const ping = await pingDepopLive();
    return {
      healthy: ping.ok,
      latencyMs: ping.latencyMs || Date.now() - started,
      message: ping.ok ? ping.message : `Offline — ${ping.message}`,
      checkedAt: new Date().toISOString(),
    };
  },
  async sync(options = {}): Promise<ProviderSyncResult<DepopIntelligenceData>> {
    const auth = getProviderAuthStatus("depop");
    if (!auth.configured) {
      return missingCredentialsResult();
    }

    if (!options.force) {
      const cached = getCachedProviderResult<DepopIntelligenceData>(
        "depop",
        CACHE_TTL_MS,
      );
      if (cached) return cached;
    }

    try {
      const intel = await scanDepop();
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
        result.summary.push(DEPOP_API_LIMITATIONS);
      }

      setCachedProviderResult("depop", result);
      return result;
    } catch (error) {
      return buildResult(null, "simulated", {
        error: error instanceof Error ? error.message : "Sync failed",
        simulatedReason:
          "Depop sync error — no data fabricated when the API fails",
        status: "offline",
      });
    }
  },
};

export function disconnectDepop(): void {
  clearProviderCache("depop");
}

/** Manual connection test for Data Sources Center. */
export async function testDepopProvider(): Promise<{
  ok: boolean;
  message: string;
  mode: "live" | "simulated";
  details?: Record<string, string | number>;
}> {
  const auth = getProviderAuthStatus("depop");
  if (!auth.configured) {
    return {
      ok: false,
      mode: "simulated",
      message:
        "Coming Soon — set DEPOP_API_KEY after Depop partner approval for live resale inventory intelligence",
    };
  }

  const ping = await pingDepopLive();
  if (!ping.ok) {
    return {
      ok: false,
      mode: "simulated",
      message: `Partner API unreachable — ${ping.message}`,
    };
  }

  const intel = await scanDepop();
  if (intel.mode !== "live") {
    return {
      ok: false,
      mode: "simulated",
      message: intel.simulatedReason ?? "Depop returned no live data",
    };
  }

  const data = intel.data;
  return {
    ok: true,
    mode: "live",
    message: `Live · ${data.listings.length} listings · ${data.popularBrands.length} brands · ${data.priceBands.length} price bands`,
    details: {
      listings: data.listings.length,
      brands: data.popularBrands.length,
      styles: data.risingStyles.length,
      priceBands: data.priceBands.length,
      keywords: data.streetwearKeywords.length,
      latencyMs: ping.latencyMs,
    },
  };
}
