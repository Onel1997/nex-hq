import "server-only";

import { PROVIDER_ADAPTERS, getProviderAdapter } from "./adapters";
import { testAmazonProvider } from "./adapters/amazon";
import { testDepopProvider } from "./adapters/depop";
import { testEtsyProvider } from "./adapters/etsy";
import { testGrailedProvider } from "./adapters/grailed";
import { testStockXProvider } from "./adapters/stockx";
import { testFashionNewsProvider } from "./adapters/fashion-news";
import { testGoogleTrendsProvider } from "./adapters/google-trends";
import { testPinterestProvider } from "./adapters/pinterest";
import { testRedditProvider } from "./adapters/reddit";
import { testShopifyProvider } from "./adapters/shopify";
import { testTikTokProvider } from "./adapters/tiktok";
import { testYouTubeProvider } from "./adapters/youtube";
import { clearProviderCache } from "./cache";
import { getProviderSetupGuide, partitionGuideSteps } from "./provider-guides";
import type {
  DataSourcePlatformSnapshot,
  DataSourceSettingsSnapshot,
  ProviderConnectionStatus,
  ProviderDataMode,
  ProviderId,
  ProviderSnapshot,
  ProviderSyncResult,
} from "./types";

function toSnapshot(
  result: ProviderSyncResult,
  adapter: { label: string; brandColor: string; apiVersion: string },
): ProviderSnapshot {
  return {
    id: result.id,
    name: adapter.label,
    brandColor: adapter.brandColor,
    status: result.status,
    mode: result.mode,
    summary: result.summary,
    trending: result.trending,
    lastSync: result.lastSync,
    lastSuccessfulSync: result.lastSuccessfulSync,
    cacheAgeMs: result.cacheAgeMs,
    fromCache: result.fromCache,
    apiVersion: result.apiVersion,
    health: result.health ?? null,
    error: result.error,
  };
}

function failedSnapshot(
  id: ProviderId,
  adapter: { label: string; brandColor: string; apiVersion: string },
  error: string,
): ProviderSnapshot {
  return {
    id,
    name: adapter.label,
    brandColor: adapter.brandColor,
    status: "offline",
    mode: "simulated",
    summary: ["Sync failed"],
    trending: [],
    lastSync: new Date().toISOString(),
    lastSuccessfulSync: null,
    cacheAgeMs: null,
    fromCache: false,
    apiVersion: adapter.apiVersion,
    health: null,
    error,
  };
}

/** Central data source manager — orchestrates all provider adapters. */
export class DataSourceManager {
  static async syncAll(options: { force?: boolean } = {}): Promise<{
    results: ProviderSyncResult[];
    snapshot: DataSourcePlatformSnapshot;
  }> {
    const settled = await Promise.allSettled(
      PROVIDER_ADAPTERS.map((adapter) => adapter.sync(options)),
    );

    const results: ProviderSyncResult[] = [];
    const providers: ProviderSnapshot[] = [];

    settled.forEach((outcome, index) => {
      const adapter = PROVIDER_ADAPTERS[index];
      if (outcome.status === "fulfilled") {
        results.push(outcome.value);
        providers.push(toSnapshot(outcome.value, adapter));
      } else {
        const message =
          outcome.reason instanceof Error
            ? outcome.reason.message
            : "Provider sync failed";
        providers.push(failedSnapshot(adapter.id, adapter, message));
      }
    });

    const connectedCount = providers.filter(
      (p) => p.status === "connected",
    ).length;
    const failedCount = providers.filter(
      (p) => p.status === "offline" || p.status === "authentication_error",
    ).length;

    return {
      results,
      snapshot: {
        loadedAt: new Date().toISOString(),
        providers,
        connectedCount,
        failedCount,
        liveCount: providers.filter((p) => p.mode === "live").length,
        simulatedCount: providers.filter((p) => p.mode === "simulated").length,
      },
    };
  }

  static async syncProvider(
    id: ProviderId,
    options: { force?: boolean } = {},
  ): Promise<ProviderSyncResult | null> {
    const adapter = getProviderAdapter(id);
    if (!adapter) return null;
    return adapter.sync(options);
  }

  static async healthCheckProvider(id: ProviderId) {
    const adapter = getProviderAdapter(id);
    if (!adapter) return null;
    return adapter.healthCheck();
  }

  static async healthCheckAll() {
    const settled = await Promise.allSettled(
      PROVIDER_ADAPTERS.map(async (adapter) => ({
        id: adapter.id,
        health: await adapter.healthCheck(),
      })),
    );

    return settled
      .map((outcome, index) => {
        if (outcome.status === "fulfilled") return outcome.value;
        return {
          id: PROVIDER_ADAPTERS[index].id,
          health: {
            healthy: false,
            message: "Health check failed",
            checkedAt: new Date().toISOString(),
          },
        };
      });
  }

  static async loadSettings(options?: {
    force?: boolean;
  }): Promise<DataSourceSettingsSnapshot> {
    const { results } = await DataSourceManager.syncAll(options);

    const providers = results.map((result) => {
      const adapter = getProviderAdapter(result.id)!;
      const guide = getProviderSetupGuide(result.id);
      const { setupSteps, limitations, notes } = partitionGuideSteps(guide);
      return {
        id: result.id,
        name: adapter.label,
        brandColor: adapter.brandColor,
        status: result.status,
        mode: result.mode,
        auth: adapter.getAuthStatus(),
        apiVersion: result.apiVersion,
        lastSync: result.lastSync,
        lastSuccessfulSync: result.lastSuccessfulSync,
        cacheAgeMs: result.cacheAgeMs,
        fromCache: result.fromCache,
        health: result.health ?? null,
        error: result.error,
        rateLimit: result.rateLimit,
        simulatedReason: result.simulatedReason,
        setupGuide: {
          purpose: guide.purpose,
          steps: setupSteps,
          simulatedWhen: guide.simulatedWhen,
          docsUrl: guide.docsUrl,
          requiredEnvKeys: guide.requiredEnvKeys,
          limitations,
          notes,
        },
      };
    });

    let connectedCount = 0;
    let simulatedCount = 0;
    let offlineCount = 0;
    let comingSoonCount = 0;

    for (const provider of providers) {
      const display = resolveDisplayStatus(provider.status, provider.mode);
      if (display === "connected") connectedCount++;
      else if (display === "simulated") simulatedCount++;
      else if (display === "coming_soon") comingSoonCount++;
      else offlineCount++;
    }

    const liveCount = providers.filter(
      (provider) =>
        provider.mode === "live" &&
        resolveDisplayStatus(provider.status, provider.mode) === "connected",
    ).length;

    return {
      loadedAt: new Date().toISOString(),
      providers,
      connectedCount,
      simulatedCount,
      offlineCount,
      comingSoonCount,
      liveCount,
    };
  }

  static disconnectProvider(id: ProviderId): void {
    clearProviderCache(id);
  }

  static disconnectAll(): void {
    clearProviderCache();
  }

  static async testProvider(id: ProviderId): Promise<{
    ok: boolean;
    message: string;
    mode?: "live" | "simulated";
    details?: Record<string, string | number>;
  } | null> {
    if (id === "shopify") return testShopifyProvider();
    if (id === "google_trends") return testGoogleTrendsProvider();
    if (id === "pinterest") return testPinterestProvider();
    if (id === "tiktok") return testTikTokProvider();
    if (id === "etsy") return testEtsyProvider();
    if (id === "amazon") return testAmazonProvider();
    if (id === "reddit") return testRedditProvider();
    if (id === "fashion_news") return testFashionNewsProvider();
    if (id === "youtube") return testYouTubeProvider();
    if (id === "depop") return testDepopProvider();
    if (id === "stockx") return testStockXProvider();
    if (id === "grailed") return testGrailedProvider();
    const adapter = getProviderAdapter(id);
    if (!adapter) return null;
    const health = await adapter.healthCheck();
    return {
      ok: health.healthy,
      message: health.message ?? (health.healthy ? "Test passed" : "Test failed"),
    };
  }
}

export async function loadDataSourcePlatformSnapshot(options?: {
  force?: boolean;
}): Promise<DataSourcePlatformSnapshot> {
  const { snapshot } = await DataSourceManager.syncAll(options);
  return snapshot;
}

export type ProviderDisplayStatus =
  | "connected"
  | "simulated"
  | "offline"
  | "coming_soon";

export function resolveDisplayStatus(
  status: ProviderConnectionStatus,
  mode: ProviderDataMode,
): ProviderDisplayStatus {
  if (status === "disconnected") return "coming_soon";
  if (status === "connected" && mode === "live") return "connected";
  if (
    mode === "simulated" &&
    status !== "offline" &&
    status !== "rate_limited"
  ) {
    return "simulated";
  }
  return "offline";
}
