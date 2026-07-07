import { loadMilaeneCommerceBaseline } from "@/lib/commerce/milaene-commerce-baseline";
import type { MilaeneCommerceBaseline } from "@/lib/commerce/milaene-commerce-baseline";
import { ShopifyApiError, ShopifyConfigError } from "@/lib/shopify/client";
import { testShopifyConnection } from "@/lib/shopify/connection-test";
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

function missingCredentialsResult(): ProviderSyncResult<MilaeneCommerceBaseline> {
  const auth = getProviderAuthStatus("shopify");
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
    error: `Missing credentials: ${auth.missingKeys.join(", ")}`,
    simulatedReason:
      "Set Shopify Client Credentials in .env.local — no catalog data is fabricated",
  };
}

export const shopifyAdapter: DataProviderAdapter<MilaeneCommerceBaseline> = {
  id: "shopify",
  label: "Shopify",
  brandColor: "#95bf47",
  apiVersion: API_VERSION,
  cacheTtlMs: CACHE_TTL_MS,
  getAuthStatus: () => getProviderAuthStatus("shopify"),
  async healthCheck(): Promise<ProviderHealth> {
    const auth = getProviderAuthStatus("shopify");
    if (!auth.configured) {
      return {
        healthy: false,
        message: `Missing credentials: ${auth.missingKeys.join(", ")}`,
        checkedAt: new Date().toISOString(),
      };
    }

    const test = await testShopifyConnection();
    return {
      healthy: test.ok,
      latencyMs: test.latencyMs,
      message: test.ok
        ? `Live · ${test.shopName} · ${test.productSampleCount} products sampled · ${test.collectionSampleCount} collections`
        : test.error ?? "Health check failed",
      checkedAt: new Date().toISOString(),
    };
  },
  async sync(options = {}): Promise<ProviderSyncResult<MilaeneCommerceBaseline>> {
    const auth = getProviderAuthStatus("shopify");
    if (!auth.configured) {
      return missingCredentialsResult();
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
        summary: ["Shopify sync failed — no catalog data returned"],
        trending: [],
        lastSync: new Date().toISOString(),
        lastSuccessfulSync: null,
        cacheAgeMs: null,
        fromCache: false,
        apiVersion: API_VERSION,
        error: error instanceof Error ? error.message : "Sync failed",
        simulatedReason:
          "API unreachable — Shopify data is not fabricated when sync fails",
      };
    }
  },
};

export function disconnectShopify(): void {
  clearProviderCache("shopify");
}

/** Manual connection test for Data Sources Center. */
export async function testShopifyProvider(): Promise<{
  ok: boolean;
  message: string;
  details?: Record<string, string | number>;
}> {
  const auth = getProviderAuthStatus("shopify");
  if (!auth.configured) {
    return {
      ok: false,
      message: `Missing credentials: ${auth.missingKeys.join(", ")}`,
    };
  }

  const test = await testShopifyConnection();
  if (!test.ok) {
    return { ok: false, message: test.error ?? "Connection test failed" };
  }

  return {
    ok: true,
    message: `Live · ${test.shopName} reachable`,
    details: {
      productsSampled: test.productSampleCount ?? 0,
      collectionsSampled: test.collectionSampleCount ?? 0,
      withImages: test.productsWithImages ?? 0,
      tagged: test.taggedProducts ?? 0,
      latencyMs: test.latencyMs ?? 0,
    },
  };
}
