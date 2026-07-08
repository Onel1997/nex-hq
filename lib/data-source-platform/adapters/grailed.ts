import { scanGrailed } from "@/services/connectors/grailed";
import type { GrailedIntelligenceData } from "@/services/connectors/grailed";
import { EMPTY_GRAILED_DATA } from "@/services/connectors/grailed";
import {
  pingGrailedLive,
  isGrailedLiveConfigured,
  GRAILED_API_LIMITATIONS,
} from "@/services/connectors/clients/grailed-client";
import { getProviderAuthStatus } from "../auth";
import {
  clearProviderCache,
  getCachedProviderResult,
  setCachedProviderResult,
} from "../cache";
import { summarizeGrailed } from "../summarize";
import type {
  DataProviderAdapter,
  ProviderHealth,
  ProviderSyncResult,
} from "../types";

export type { GrailedIntelligenceData };

const API_VERSION = "partner-v1";
const CACHE_TTL_MS = 20 * 60 * 1000;

function buildResult(
  data: GrailedIntelligenceData | null,
  mode: "live" | "simulated",
  options: {
    error?: string;
    simulatedReason?: string;
    status?: ProviderSyncResult["status"];
  } = {},
): ProviderSyncResult<GrailedIntelligenceData> {
  const auth = getProviderAuthStatus("grailed");
  const status =
    options.status ??
    (mode === "live"
      ? "connected"
      : auth.configured
        ? "offline"
        : "disconnected");

  const summaryData = data ?? EMPTY_GRAILED_DATA;
  const { summary, trending } = summarizeGrailed(summaryData, mode);

  return {
    id: "grailed",
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

function missingCredentialsResult(): ProviderSyncResult<GrailedIntelligenceData> {
  const auth = getProviderAuthStatus("grailed");
  return buildResult(null, "simulated", {
    status: "disconnected",
    error: `Missing credentials: ${auth.missingKeys.join(", ")}`,
    simulatedReason:
      "Grailed has no open public API — partner credentials (GRAILED_API_KEY + GRAILED_API_BASE_URL) required; no resale data is fabricated",
  });
}

export const grailedAdapter: DataProviderAdapter<GrailedIntelligenceData> = {
  id: "grailed",
  label: "Grailed",
  brandColor: "#000000",
  apiVersion: API_VERSION,
  cacheTtlMs: CACHE_TTL_MS,
  getAuthStatus: () => getProviderAuthStatus("grailed"),
  async healthCheck(): Promise<ProviderHealth> {
    const started = Date.now();

    if (!isGrailedLiveConfigured()) {
      return {
        healthy: false,
        message:
          "Coming Soon — Grailed has no open public API; partner credentials required (GRAILED_API_KEY + GRAILED_API_BASE_URL)",
        checkedAt: new Date().toISOString(),
      };
    }

    const ping = await pingGrailedLive();
    return {
      healthy: ping.ok,
      latencyMs: ping.latencyMs || Date.now() - started,
      message: ping.ok ? ping.message : `Offline — ${ping.message}`,
      checkedAt: new Date().toISOString(),
    };
  },
  async sync(options = {}): Promise<ProviderSyncResult<GrailedIntelligenceData>> {
    if (!isGrailedLiveConfigured()) {
      return missingCredentialsResult();
    }

    if (!options.force) {
      const cached = getCachedProviderResult<GrailedIntelligenceData>(
        "grailed",
        CACHE_TTL_MS,
      );
      if (cached) return cached;
    }

    try {
      const intel = await scanGrailed();
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
        result.summary.push(GRAILED_API_LIMITATIONS);
      }

      setCachedProviderResult("grailed", result);
      return result;
    } catch (error) {
      return buildResult(null, "simulated", {
        error: error instanceof Error ? error.message : "Sync failed",
        simulatedReason:
          "Grailed sync error — no data fabricated when the API fails",
        status: "offline",
      });
    }
  },
};

export function disconnectGrailed(): void {
  clearProviderCache("grailed");
}

/** Manual connection test for Data Sources Center. */
export async function testGrailedProvider(): Promise<{
  ok: boolean;
  message: string;
  mode: "live" | "simulated";
  details?: Record<string, string | number>;
}> {
  if (!isGrailedLiveConfigured()) {
    const auth = getProviderAuthStatus("grailed");
    return {
      ok: false,
      mode: "simulated",
      message:
        "Coming Soon — Grailed has no open public API; set GRAILED_API_KEY + GRAILED_API_BASE_URL when partner access is approved",
      ...(auth.missingKeys.length > 0
        ? { details: { missing: auth.missingKeys.join(", ") } }
        : {}),
    };
  }

  const ping = await pingGrailedLive();
  if (!ping.ok) {
    return {
      ok: false,
      mode: "simulated",
      message: `Partner API unreachable — ${ping.message}`,
    };
  }

  const intel = await scanGrailed();
  if (intel.mode !== "live") {
    return {
      ok: false,
      mode: "simulated",
      message: intel.simulatedReason ?? "Grailed returned no live data",
    };
  }

  const data = intel.data;
  return {
    ok: true,
    mode: "live",
    message: `Live · ${data.listings.length} listings · ${data.risingDesigners.length} designers · ${data.designerPriceBands.length} price bands`,
    details: {
      listings: data.listings.length,
      designers: data.risingDesigners.length,
      archiveSignals: data.archiveFashionSignals.length,
      luxurySignals: data.luxuryStreetwearSignals.length,
      priceBands: data.designerPriceBands.length,
      latencyMs: ping.latencyMs,
    },
  };
}
