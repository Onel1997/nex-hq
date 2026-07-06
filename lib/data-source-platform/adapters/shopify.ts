import { loadMilaeneCommerceBaseline } from "@/lib/commerce/milaene-commerce-baseline";
import type { MilaeneCommerceBaseline } from "@/lib/commerce/milaene-commerce-baseline";
import { ShopifyApiError, ShopifyConfigError } from "@/lib/shopify/client";
import { getProviderAuthStatus } from "../auth";
import {
  clearProviderCache,
  getCachedProviderResult,
  setCachedProviderResult,
} from "../cache";
import { summarizeShopify } from "../summarize";
import type {
  DataProviderAdapter,
  ProviderConnectionStatus,
  ProviderHealth,
  ProviderSyncResult,
} from "../types";

const API_VERSION = "2026-01";
const CACHE_TTL_MS = 5 * 60 * 1000;

function mapShopifyError(error: unknown): ProviderConnectionStatus {
  if (error instanceof ShopifyConfigError) return "authentication_error";
  if (error instanceof ShopifyApiError) {
    if (error.status === 429) return "rate_limited";
    if (error.status === 401 || error.status === 403) return "authentication_error";
    return "offline";
  }
  return "offline";
}

export const shopifyAdapter: DataProviderAdapter<MilaeneCommerceBaseline> = {
  id: "shopify",
  label: "Shopify",
  brandColor: "#95bf47",
  apiVersion: API_VERSION,
  cacheTtlMs: CACHE_TTL_MS,
  getAuthStatus: () => getProviderAuthStatus("shopify"),
  async healthCheck(): Promise<ProviderHealth> {
    const started = Date.now();
    const auth = getProviderAuthStatus("shopify");
    if (!auth.configured) {
      return {
        healthy: false,
        message: `Missing: ${auth.missingKeys.join(", ")}`,
        checkedAt: new Date().toISOString(),
      };
    }
    try {
      const baseline = await loadMilaeneCommerceBaseline();
      return {
        healthy: Boolean(baseline.storeDomain),
        latencyMs: Date.now() - started,
        message: `Store ${baseline.storeDomain} reachable`,
        checkedAt: new Date().toISOString(),
      };
    } catch (error) {
      return {
        healthy: false,
        latencyMs: Date.now() - started,
        message: error instanceof Error ? error.message : "Health check failed",
        checkedAt: new Date().toISOString(),
      };
    }
  },
  async sync(options = {}): Promise<ProviderSyncResult<MilaeneCommerceBaseline>> {
    const auth = getProviderAuthStatus("shopify");
    if (!auth.configured) {
      return {
        id: "shopify",
        status: "authentication_error",
        mode: "simulated",
        data: null,
        summary: ["Shopify credentials not configured"],
        trending: [],
        lastSync: new Date().toISOString(),
        lastSuccessfulSync: null,
        cacheAgeMs: null,
        fromCache: false,
        apiVersion: API_VERSION,
        error: `Missing: ${auth.missingKeys.join(", ")}`,
      };
    }

    if (!options.force) {
      const cached = getCachedProviderResult<MilaeneCommerceBaseline>(
        "shopify",
        CACHE_TTL_MS,
      );
      if (cached) return cached;
    }

    try {
      const baseline = await loadMilaeneCommerceBaseline();
      const { summary, trending } = summarizeShopify(baseline);
      const result: ProviderSyncResult<MilaeneCommerceBaseline> = {
        id: "shopify",
        status: "connected",
        mode: "live",
        data: baseline,
        summary,
        trending,
        lastSync: new Date().toISOString(),
        lastSuccessfulSync: new Date().toISOString(),
        cacheAgeMs: 0,
        fromCache: false,
        apiVersion: API_VERSION,
        rateLimit: { limit: 40, remaining: 38 },
      };
      setCachedProviderResult("shopify", result);
      return result;
    } catch (error) {
      const status = mapShopifyError(error);
      return {
        id: "shopify",
        status,
        mode: "simulated",
        data: null,
        summary: ["Shopify sync failed"],
        trending: [],
        lastSync: new Date().toISOString(),
        lastSuccessfulSync: null,
        cacheAgeMs: null,
        fromCache: false,
        apiVersion: API_VERSION,
        error: error instanceof Error ? error.message : "Sync failed",
      };
    }
  },
};

export function disconnectShopify(): void {
  clearProviderCache("shopify");
}
