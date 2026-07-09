import { loadMilaeneCommerceBaseline } from "@/lib/commerce/milaene-commerce-baseline";
import type { MilaeneCommerceBaseline } from "@/lib/commerce/milaene-commerce-baseline";
import { scanGoogleTrends } from "@/services/connectors/google-trends";
import type { GoogleTrendsData } from "@/services/connectors/google-trends";
import { pingGoogleTrendsLive } from "@/services/connectors/clients/google-trends-client";
import { getProviderAuthStatus } from "../auth";
import {
  clearProviderCache,
  getCachedProviderResult,
  setCachedProviderResult,
} from "../cache";
import { summarizeGoogleTrends } from "../summarize";
import type {
  DataProviderAdapter,
  ProviderHealth,
  ProviderSyncResult,
} from "../types";

const API_VERSION = "serpapi-v1";
const CACHE_TTL_MS = 15 * 60 * 1000;
const DEFAULT_REGION = "DE";

async function loadKeywordBaseline(): Promise<MilaeneCommerceBaseline | null> {
  const cached = getCachedProviderResult<MilaeneCommerceBaseline>(
    "shopify",
    5 * 60 * 1000,
  );
  if (cached?.data) return cached.data;

  try {
    const auth = getProviderAuthStatus("shopify");
    if (!auth.configured) return null;
    return await loadMilaeneCommerceBaseline();
  } catch {
    return null;
  }
}

function buildResult(
  data: GoogleTrendsData,
  mode: "live" | "simulated",
  options: {
    error?: string;
    simulatedReason?: string;
    status?: ProviderSyncResult["status"];
  } = {},
): ProviderSyncResult<GoogleTrendsData> {
  const { summary, trending } = summarizeGoogleTrends(data, mode);
  const auth = getProviderAuthStatus("google_trends");
  const status =
    options.status ??
    (mode === "live"
      ? "connected"
      : auth.configured
        ? "offline"
        : "disconnected");

  return {
    id: "google_trends",
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

export const googleTrendsAdapter: DataProviderAdapter<GoogleTrendsData> = {
  id: "google_trends",
  label: "Google Trends",
  brandColor: "#4285f4",
  apiVersion: API_VERSION,
  cacheTtlMs: CACHE_TTL_MS,
  getAuthStatus: () => getProviderAuthStatus("google_trends"),
  async healthCheck(): Promise<ProviderHealth> {
    const auth = getProviderAuthStatus("google_trends");
    const started = Date.now();

    if (!auth.configured) {
      return {
        healthy: false,
        message:
          "Coming soon — GOOGLE_TRENDS_API_KEY not set (SerpAPI key required for live trends)",
        checkedAt: new Date().toISOString(),
      };
    }

    const ping = await pingGoogleTrendsLive(DEFAULT_REGION);
    return {
      healthy: ping.ok,
      latencyMs: ping.latencyMs || Date.now() - started,
      message: ping.ok
        ? ping.message
        : ping.message.toLowerCase().includes("api key")
          ? `Invalid API key — ${ping.message}`
          : `Offline — ${ping.message}`,
      checkedAt: new Date().toISOString(),
    };
  },
  async sync(options = {}): Promise<ProviderSyncResult<GoogleTrendsData>> {
    if (!options.force) {
      const cached = getCachedProviderResult<GoogleTrendsData>(
        "google_trends",
        CACHE_TTL_MS,
      );
      if (cached) return cached;
    }

    try {
      const baseline = await loadKeywordBaseline();
      const intel = await scanGoogleTrends({
        baseline,
        region: DEFAULT_REGION,
      });
      const result = buildResult(intel.data, intel.mode, {
        status: intel.providerStatus,
        error: intel.error,
        simulatedReason: intel.simulatedReason,
      });
      setCachedProviderResult("google_trends", result);
      return result;
    } catch (error) {
      const baseline = await loadKeywordBaseline();
      const fallback = await scanGoogleTrends({
        baseline,
        region: DEFAULT_REGION,
      });
      return buildResult(fallback.data, fallback.mode, {
        status: "offline",
        error: error instanceof Error ? error.message : "Sync failed",
        simulatedReason:
          fallback.simulatedReason ??
          "Sync error — static keyword estimates in use",
      });
    }
  },
};

export function disconnectGoogleTrends(): void {
  clearProviderCache("google_trends");
}

/** Manual connection test for Data Sources Center. */
export async function testGoogleTrendsProvider(): Promise<{
  ok: boolean;
  message: string;
  mode: "live" | "simulated";
}> {
  const auth = getProviderAuthStatus("google_trends");
  if (!auth.configured) {
    return {
      ok: false,
      mode: "simulated",
      message:
        "Coming soon — set GOOGLE_TRENDS_API_KEY (SerpAPI key) for live keyword trends",
    };
  }

  const ping = await pingGoogleTrendsLive(DEFAULT_REGION);
  if (!ping.ok) {
    const authFailure = ping.message.toLowerCase().includes("api key");
    return {
      ok: false,
      mode: "simulated",
      message: authFailure
        ? `Invalid API key — ${ping.message}`
        : `Offline — ${ping.message}`,
    };
  }

  const baseline = await loadKeywordBaseline();
  const intel = await scanGoogleTrends({ baseline, region: DEFAULT_REGION });
  return {
    ok: intel.mode === "live",
    mode: intel.mode,
    message:
      intel.mode === "live"
        ? `Live · ${intel.data.keywords.length} keywords · ${intel.data.topRising.length} rising · ${intel.data.relatedQueries.length} related`
        : intel.error ?? intel.simulatedReason ?? "Returned simulated fallback",
  };
}
