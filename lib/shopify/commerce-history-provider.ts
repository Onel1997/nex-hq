import "server-only";

import type { ShopifyKnowledge } from "@/lib/shopify/types";
import type {
  CommerceIntelligenceDebug,
  CommerceOrderRollup,
} from "@/lib/shopify/commerce-intelligence";
import {
  loadHistoricalIntelligence,
  loadHistoricalIntelligenceRollup,
  resolveCommerceHistoryCsvPath,
} from "@/lib/commerce/historical-intelligence";
import {
  HISTORICAL_READ_ALL_ORDERS_WARNING,
  type CommerceHistoricalPlaceholders,
  type CommerceHistoricalStatus,
  type CommerceHistoryAccessStatus,
  type CommerceHistoryProviderDescriptor,
  type CommerceHistoryResolution,
  type CommerceHistorySourceType,
} from "@/lib/shopify/commerce-shared";

export type {
  CommerceHistoricalMode,
  CommerceHistoricalPlaceholders,
  CommerceHistoricalStatus,
  CommerceHistoryAccessStatus,
  CommerceHistoryProviderDescriptor,
  CommerceHistoryResolution,
  CommerceHistorySourceType,
} from "@/lib/shopify/commerce-shared";

export {
  formatHistoricalPlaceholder,
  HISTORICAL_READ_ALL_ORDERS_WARNING,
  isCommerceHistoryActive,
} from "@/lib/shopify/commerce-shared";

const UNAVAILABLE_PLACEHOLDERS: CommerceHistoricalPlaceholders = {
  historicalRevenue: "unavailable",
  historicalUnits: "unavailable",
  historicalBestseller: "unavailable",
};

const PROVIDER_CATALOG: CommerceHistoryProviderDescriptor[] = [
  {
    id: "shopify-orders",
    label: "Shopify historical orders",
    sourceType: "shopify-orders",
    implemented: true,
  },
  {
    id: "csv-import",
    label: "CSV sales import",
    sourceType: "csv-import",
    implemented: true,
  },
  {
    id: "manual-import",
    label: "Manual sales import",
    sourceType: "manual-import",
    implemented: false,
  },
  {
    id: "analytics",
    label: "Analytics provider",
    sourceType: "analytics",
    implemented: false,
  },
];

function accessFromDebug(debug: CommerceIntelligenceDebug): CommerceHistoryAccessStatus {
  return {
    hasReadOrders: debug.hasReadOrders,
    hasReadAllOrders: debug.hasReadAllOrders,
    tokenScopes: debug.tokenScopes,
    appAccessScopes: debug.appAccessScopes,
  };
}

function emptyRollup(currency: string): CommerceOrderRollup {
  return {
    productAggregates: new Map(),
    orderCount: 0,
    totalRevenue: 0,
    totalUnits: 0,
    currency,
    firstOrderDate: null,
    lastOrderDate: null,
    monthlyOrders: new Map(),
  };
}

function buildPlaceholdersFromRollup(rollup: CommerceOrderRollup): CommerceHistoricalPlaceholders {
  const bestseller = [...rollup.productAggregates.values()].sort(
    (a, b) => b.unitsSold - a.unitsSold || b.revenue - a.revenue,
  )[0];

  return {
    historicalRevenue: rollup.totalRevenue,
    historicalUnits: rollup.totalUnits,
    historicalBestseller: bestseller?.title ?? "unavailable",
  };
}

function resolveShopifyMode(
  access: CommerceHistoryAccessStatus,
  debug: CommerceIntelligenceDebug,
): Pick<CommerceHistoricalStatus, "mode" | "available" | "source" | "warning"> & {
  shouldLoad: boolean;
} {
  if (!access.hasReadOrders) {
    return {
      mode: "catalog-only",
      available: false,
      source: null,
      warning: "Missing read_orders scope — add it to the NexHQ Shopify app and reinstall.",
      shouldLoad: false,
    };
  }

  if (!access.hasReadAllOrders) {
    const hasRecentOrders = (debug.ordersCountFromApi ?? debug.ordersCount) > 0;
    if (hasRecentOrders) {
      return {
        mode: "recent-only",
        available: true,
        source: "shopify-orders",
        warning:
          "Only the last 60 days of Shopify orders are available. Enable read_all_orders for full Milaene history since March 2023.",
        shouldLoad: true,
      };
    }

    return {
      mode: "catalog-only",
      available: false,
      source: null,
      warning: HISTORICAL_READ_ALL_ORDERS_WARNING,
      shouldLoad: false,
    };
  }

  return {
    mode: "active",
    available: true,
    source: "shopify-orders",
    warning: null,
    shouldLoad: true,
  };
}

async function loadShopifyOrdersRollup(): Promise<CommerceOrderRollup> {
  const { fetchCommerceOrderRollup } = await import("@/lib/shopify/commerce-intelligence");
  return fetchCommerceOrderRollup();
}

async function probeShopifyAccess(): Promise<CommerceIntelligenceDebug> {
  const { probeShopifyOrdersAccess } = await import("@/lib/shopify/commerce-intelligence");
  return probeShopifyOrdersAccess();
}

async function resolveCsvImport(
  knowledge: ShopifyKnowledge,
): Promise<CommerceHistoryResolution | null> {
  const csvPath = await resolveCommerceHistoryCsvPath();
  if (!csvPath) return null;

  try {
    const intelligence = await loadHistoricalIntelligence(knowledge);
    if (!intelligence || intelligence.summary.totalOrders === 0) return null;

    return buildResolution(
      {
        mode: "active",
        available: true,
        source: "csv-import",
        warning: null,
        placeholders: {
          historicalRevenue: intelligence.summary.totalRevenue,
          historicalUnits: intelligence.summary.totalUnits,
          historicalBestseller: intelligence.allTimeBestseller?.title ?? "unavailable",
        },
      },
      {
        hasReadOrders: true,
        hasReadAllOrders: true,
        tokenScopes: [],
        appAccessScopes: [],
      },
      true,
    );
  } catch (error) {
    console.warn("[Commerce History] CSV import failed", error);
    return null;
  }
}

async function resolveManualImport(): Promise<CommerceHistoryResolution | null> {
  const manualPath = process.env.COMMERCE_HISTORY_MANUAL_PATH?.trim();
  if (!manualPath) return null;

  // Future: load structured manual import. Not yet implemented.
  return null;
}

async function resolveAnalyticsProvider(): Promise<CommerceHistoryResolution | null> {
  const analyticsKey = process.env.COMMERCE_HISTORY_ANALYTICS_PROVIDER?.trim();
  if (!analyticsKey) return null;

  // Future: connect analytics API. Not yet implemented.
  return null;
}

function buildResolution(
  status: CommerceHistoricalStatus,
  access: CommerceHistoryAccessStatus,
  shouldLoadOrders: boolean,
  debug?: CommerceIntelligenceDebug,
): CommerceHistoryResolution {
  return { status, access, shouldLoadOrders, debug };
}

/**
 * Pluggable historical commerce loader.
 * Tries Shopify orders first, then CSV / manual / analytics providers when configured.
 */
export const commerceHistoryProvider = {
  listProviders(): CommerceHistoryProviderDescriptor[] {
    return [...PROVIDER_CATALOG];
  },

  isHistoricalAvailable(status: CommerceHistoricalStatus): boolean {
    return status.available && status.mode !== "catalog-only";
  },

  buildPlaceholders(
    rollup: CommerceOrderRollup,
    status: CommerceHistoricalStatus,
  ): CommerceHistoricalPlaceholders {
    if (!this.isHistoricalAvailable(status) || rollup.orderCount === 0) {
      return UNAVAILABLE_PLACEHOLDERS;
    }
    return buildPlaceholdersFromRollup(rollup);
  },

  /** Detect Shopify scopes and whether historical orders can be loaded. */
  async detectAccess(): Promise<CommerceHistoryAccessStatus & { debug: CommerceIntelligenceDebug }> {
    const debug = await probeShopifyAccess();
    return { ...accessFromDebug(debug), debug };
  },

  /** Pick the best available historical data source for the current store. */
  async resolve(knowledge: ShopifyKnowledge): Promise<CommerceHistoryResolution> {
    const csvResolution = await resolveCsvImport(knowledge);
    if (csvResolution?.status.available) return csvResolution;

    const altProviders = await Promise.all([
      resolveManualImport(),
      resolveAnalyticsProvider(),
    ]);

    for (const alt of altProviders) {
      if (alt?.status.available) return alt;
    }

    let debug: CommerceIntelligenceDebug;
    try {
      debug = await probeShopifyAccess();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Shopify orders probe failed";
      return buildResolution(
        {
          mode: "catalog-only",
          available: false,
          source: null,
          warning: message,
          placeholders: UNAVAILABLE_PLACEHOLDERS,
        },
        {
          hasReadOrders: false,
          hasReadAllOrders: false,
          tokenScopes: [],
          appAccessScopes: [],
        },
        false,
      );
    }

    const access = accessFromDebug(debug);
    const shopify = resolveShopifyMode(access, debug);

    return buildResolution(
      {
        mode: shopify.mode,
        available: shopify.available,
        source: shopify.source,
        warning: shopify.warning,
        placeholders: UNAVAILABLE_PLACEHOLDERS,
      },
      access,
      shopify.shouldLoad,
      debug,
    );
  },

  /** Load order rollup from the active provider, or an empty rollup in catalog-only mode. */
  async loadRollup(
    knowledge: ShopifyKnowledge,
    resolution: CommerceHistoryResolution,
  ): Promise<{ rollup: CommerceOrderRollup; status: CommerceHistoricalStatus }> {
    const currency = knowledge.products[0]?.currency ?? "EUR";

    if (!resolution.shouldLoadOrders) {
      return {
        rollup: emptyRollup(currency),
        status: resolution.status,
      };
    }

    let rollup: CommerceOrderRollup;

    switch (resolution.status.source) {
      case "shopify-orders":
        rollup = await loadShopifyOrdersRollup();
        break;
      case "csv-import": {
        const imported = await loadHistoricalIntelligenceRollup(knowledge);
        rollup = imported?.rollup ?? emptyRollup(currency);
        break;
      }
      case "manual-import":
      case "analytics":
        rollup = emptyRollup(currency);
        break;
      default:
        rollup = emptyRollup(currency);
    }

    const available =
      resolution.status.mode !== "catalog-only" && rollup.orderCount > 0;
    const status: CommerceHistoricalStatus = {
      ...resolution.status,
      available,
      placeholders: available
        ? buildPlaceholdersFromRollup(rollup)
        : UNAVAILABLE_PLACEHOLDERS,
    };

    if (
      resolution.status.mode === "active" &&
      rollup.orderCount === 0 &&
      resolution.access.hasReadAllOrders
    ) {
      status.warning =
        "Shopify ordersCount is 0 — verify orders exist on this store domain.";
      status.available = false;
      status.mode = "catalog-only";
      status.placeholders = UNAVAILABLE_PLACEHOLDERS;
    }

    return { rollup, status };
  },
};

