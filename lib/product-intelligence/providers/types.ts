import type {
  CatalogSyncStatus,
  Product,
  ProductCatalog,
  ProductCollection,
  ProductSource,
  ProductVariant,
} from "../types";
import { PRODUCT_SOURCE_PRIORITY } from "../types";

export type CatalogConnectionStatus = {
  available: boolean;
  /** Human-readable reason when unavailable — never secrets. */
  reason: string | null;
};

export type ProductCatalogLoadResult = {
  catalog: ProductCatalog;
  sync: CatalogSyncStatus;
};

/**
 * Catalog authority boundary.
 * Shopify implementation must not fake live data when disconnected.
 */
export interface ProductCatalogProvider {
  readonly id: string;
  loadProducts(): Promise<Product[]>;
  loadProductById(id: string): Promise<Product | null>;
  loadVariants(productId: string): Promise<ProductVariant[]>;
  loadCollections(): Promise<ProductCollection[]>;
  getLastSyncStatus(): CatalogSyncStatus;
  validateConnection(): Promise<CatalogConnectionStatus>;
}

export function normalizeProductSource(source: ProductSource): ProductSource {
  if (source === "shopify") return "shopify_live";
  if (source === "manual") return "manual_confirmed";
  return source;
}

export function sourcePriorityRank(source: ProductSource): number {
  const normalized = normalizeProductSource(source);
  const idx = PRODUCT_SOURCE_PRIORITY.indexOf(normalized);
  return idx === -1 ? PRODUCT_SOURCE_PRIORITY.length : idx;
}

/** True when `a` should win over `b` under catalog authority rules. */
export function sourceWins(
  a: ProductSource,
  b: ProductSource,
): boolean {
  return sourcePriorityRank(a) < sourcePriorityRank(b);
}

export function emptyUnavailableSync(error: string | null = null): CatalogSyncStatus {
  return {
    catalogSource: "seed",
    sourcePriority: PRODUCT_SOURCE_PRIORITY,
    lastSyncedAt: null,
    liveCatalogAvailable: false,
    usingSeedFallback: true,
    stale: false,
    syncError: error,
  };
}
