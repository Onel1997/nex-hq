import { scanPinterest } from "@/services/connectors/pinterest";
import type { PinterestIntelligenceData } from "@/services/connectors/pinterest";
import { EMPTY_PINTEREST_DATA } from "@/services/connectors/pinterest";
import { pingPinterestLive } from "@/services/connectors/clients/pinterest-client";
import { PINTEREST_API_LIMITATIONS } from "@/services/connectors/clients/pinterest-client";
import { getProviderAuthStatus } from "../auth";
import {
  clearProviderCache,
  getCachedProviderResult,
  setCachedProviderResult,
} from "../cache";
import { summarizePinterest } from "../summarize";
import type {
  DataProviderAdapter,
  ProviderHealth,
  ProviderSyncResult,
} from "../types";

const API_VERSION = "v5";
const CACHE_TTL_MS = 10 * 60 * 1000;

function buildResult(
  data: PinterestIntelligenceData | null,
  mode: "live" | "simulated",
  options: {
    error?: string;
    simulatedReason?: string;
    status?: ProviderSyncResult["status"];
  } = {},
): ProviderSyncResult<PinterestIntelligenceData> {
  const auth = getProviderAuthStatus("pinterest");
  const status =
    options.status ??
    (mode === "live"
      ? "connected"
      : auth.configured
        ? "offline"
        : "disconnected");

  const summaryData = data ?? EMPTY_PINTEREST_DATA;
  const { summary, trending } = summarizePinterest(summaryData, mode);

  return {
    id: "pinterest",
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

function missingCredentialsResult(): ProviderSyncResult<PinterestIntelligenceData> {
  const auth = getProviderAuthStatus("pinterest");
  return buildResult(null, "simulated", {
    status: "disconnected",
    error: `Missing credentials: ${auth.missingKeys.join(", ")}`,
    simulatedReason:
      "Set PINTEREST_ACCESS_TOKEN in .env.local — no Pinterest data is fabricated without credentials",
  });
}

export const pinterestAdapter: DataProviderAdapter<PinterestIntelligenceData> = {
  id: "pinterest",
  label: "Pinterest",
  brandColor: "#e60023",
  apiVersion: API_VERSION,
  cacheTtlMs: CACHE_TTL_MS,
  getAuthStatus: () => getProviderAuthStatus("pinterest"),
  async healthCheck(): Promise<ProviderHealth> {
    const auth = getProviderAuthStatus("pinterest");
    const started = Date.now();

    if (!auth.configured) {
      return {
        healthy: false,
        message:
          "Simulated — PINTEREST_ACCESS_TOKEN not set (Pinterest API v5 required for live trends)",
        checkedAt: new Date().toISOString(),
      };
    }

    const ping = await pingPinterestLive();
    return {
      healthy: ping.ok,
      latencyMs: ping.latencyMs || Date.now() - started,
      message: ping.ok
        ? ping.message
        : `Offline — ${ping.message}`,
      checkedAt: new Date().toISOString(),
    };
  },
  async sync(options = {}): Promise<ProviderSyncResult<PinterestIntelligenceData>> {
    const auth = getProviderAuthStatus("pinterest");
    if (!auth.configured) {
      return missingCredentialsResult();
    }

    if (!options.force) {
      const cached = getCachedProviderResult<PinterestIntelligenceData>(
        "pinterest",
        CACHE_TTL_MS,
      );
      if (cached) return cached;
    }

    try {
      const intel = await scanPinterest();
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
        result.summary.push(PINTEREST_API_LIMITATIONS);
      }

      setCachedProviderResult("pinterest", result);
      return result;
    } catch (error) {
      return buildResult(null, "simulated", {
        error: error instanceof Error ? error.message : "Sync failed",
        simulatedReason:
          "Pinterest sync error — no data fabricated when API fails",
        status: "offline",
      });
    }
  },
};

export function disconnectPinterest(): void {
  clearProviderCache("pinterest");
}

/** Manual connection test for Data Sources Center. */
export async function testPinterestProvider(): Promise<{
  ok: boolean;
  message: string;
  mode: "live" | "simulated";
  details?: Record<string, string | number>;
}> {
  const auth = getProviderAuthStatus("pinterest");
  if (!auth.configured) {
    return {
      ok: false,
      mode: "simulated",
      message:
        "Simulated — set PINTEREST_ACCESS_TOKEN for live Pinterest trends and board insights",
    };
  }

  const ping = await pingPinterestLive();
  if (!ping.ok) {
    return {
      ok: false,
      mode: "simulated",
      message: `Live API unreachable — ${ping.message}`,
    };
  }

  const intel = await scanPinterest();
  if (intel.mode !== "live") {
    return {
      ok: false,
      mode: "simulated",
      message: intel.simulatedReason ?? "Pinterest returned no live data",
    };
  }

  const data = intel.data;
  return {
    ok: true,
    mode: "live",
    message: `Live · ${data.outfitTrends.length} trending keywords · ${data.boards.length} boards · ${data.colorWorlds.length} color worlds`,
    details: {
      keywords: data.outfitTrends.length,
      boards: data.boards.length,
      aesthetics: data.aesthetics.length,
      colorWorlds: data.colorWorlds.length,
      latencyMs: ping.latencyMs,
    },
  };
}
