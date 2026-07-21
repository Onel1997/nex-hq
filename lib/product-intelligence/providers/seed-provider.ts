import { getProductCatalogForSlug } from "../registry";
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
import { emptyUnavailableSync } from "./types";

/**
 * Local seed catalog provider — fallback when Shopify is unavailable.
 * Never claims to be live Shopify truth.
 */
export class SeedProductCatalogProvider implements ProductCatalogProvider {
  readonly id = "seed";

  constructor(private readonly brandSlug: string = "milaene") {}

  private catalog() {
    return getProductCatalogForSlug(this.brandSlug);
  }

  async loadProducts(): Promise<Product[]> {
    return this.catalog().products.slice();
  }

  async loadProductById(id: string): Promise<Product | null> {
    return this.catalog().products.find((p) => p.id === id) ?? null;
  }

  async loadVariants(productId: string): Promise<ProductVariant[]> {
    const product = await this.loadProductById(productId);
    return product?.variants.slice() ?? [];
  }

  async loadCollections(): Promise<ProductCollection[]> {
    return this.catalog().collections.slice();
  }

  getLastSyncStatus(): CatalogSyncStatus {
    const catalog = this.catalog();
    return (
      catalog.sync ?? {
        ...emptyUnavailableSync(null),
        catalogSource: "seed",
        sourcePriority: PRODUCT_SOURCE_PRIORITY,
        usingSeedFallback: true,
        liveCatalogAvailable: false,
      }
    );
  }

  async validateConnection(): Promise<CatalogConnectionStatus> {
    return {
      available: true,
      reason: "Local seed catalog available (not live Shopify).",
    };
  }
}
