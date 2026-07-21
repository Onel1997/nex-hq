import type {
  CatalogSyncStatus,
  Product,
  ProductCollection,
  ProductVariant,
} from "../types";
import { PRODUCT_SOURCE_PRIORITY } from "../types";
import type {
  CatalogConnectionStatus,
  ProductCatalogProvider,
} from "./types";

/**
 * Shopify catalog provider boundary — Phase 1.7B patch.
 *
 * Does NOT call Shopify. Does NOT fake live products.
 * Returns a clear unavailable state until a real adapter is wired.
 */
export class ShopifyProductCatalogProvider implements ProductCatalogProvider {
  readonly id = "shopify";

  private readonly disabledReason =
    "Shopify catalog provider is not connected in this build. Live sync is disabled — no fake Shopify data.";

  async loadProducts(): Promise<Product[]> {
    throw new Error(this.disabledReason);
  }

  async loadProductById(_id: string): Promise<Product | null> {
    throw new Error(this.disabledReason);
  }

  async loadVariants(_productId: string): Promise<ProductVariant[]> {
    throw new Error(this.disabledReason);
  }

  async loadCollections(): Promise<ProductCollection[]> {
    throw new Error(this.disabledReason);
  }

  getLastSyncStatus(): CatalogSyncStatus {
    return {
      catalogSource: "seed",
      sourcePriority: PRODUCT_SOURCE_PRIORITY,
      lastSyncedAt: null,
      liveCatalogAvailable: false,
      usingSeedFallback: true,
      stale: false,
      syncError: this.disabledReason,
    };
  }

  async validateConnection(): Promise<CatalogConnectionStatus> {
    return {
      available: false,
      reason: this.disabledReason,
    };
  }
}
