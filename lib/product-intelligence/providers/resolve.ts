import { getProductCatalogForSlug } from "../registry";
import type {
  CatalogSyncStatus,
  Product,
  ProductCatalog,
  ProductCollection,
  ProductSource,
} from "../types";
import { PRODUCT_SOURCE_PRIORITY } from "../types";
import { SeedProductCatalogProvider } from "./seed-provider";
import { ShopifyProductCatalogProvider } from "./shopify-provider";
import {
  normalizeProductSource,
  sourceWins,
  type ProductCatalogLoadResult,
} from "./types";

function productKey(product: Product): string {
  return product.slug || product.id;
}

/**
 * Merge catalogs by source precedence.
 * Shopify live always wins over seed for the same product id/slug.
 * Seed must never override a valid live Shopify product.
 */
export function mergeProductCatalogs(params: {
  brandSlug: string;
  brandName: string;
  seed: ProductCatalog;
  shopify?: ProductCatalog | null;
  manual?: ProductCatalog | null;
  sync: CatalogSyncStatus;
}): ProductCatalog {
  const byKey = new Map<string, Product>();

  for (const product of params.seed.products) {
    byKey.set(productKey(product), {
      ...product,
      source: normalizeProductSource(product.source),
    });
  }

  if (params.manual) {
    for (const product of params.manual.products) {
      const key = productKey(product);
      const existing = byKey.get(key);
      if (!existing || sourceWins("manual_confirmed", existing.source)) {
        byKey.set(key, {
          ...product,
          source: "manual_confirmed",
        });
      }
    }
  }

  if (params.shopify) {
    for (const product of params.shopify.products) {
      byKey.set(productKey(product), {
        ...product,
        source: "shopify_live",
      });
    }
  }

  const collectionById = new Map<string, ProductCollection>();
  for (const collection of params.seed.collections) {
    collectionById.set(collection.id, collection);
  }
  if (params.manual) {
    for (const collection of params.manual.collections) {
      collectionById.set(collection.id, collection);
    }
  }
  if (params.shopify) {
    for (const collection of params.shopify.collections) {
      collectionById.set(collection.id, collection);
    }
  }

  const authoritySource: ProductSource = params.shopify
    ? "shopify_live"
    : params.manual
      ? "manual_confirmed"
      : "seed";

  const forbiddenTypes = new Set<string>(
    params.seed.forbiddenProductTypes.map((t) => t.toLowerCase()),
  );
  if (params.manual) {
    for (const t of params.manual.forbiddenProductTypes) {
      forbiddenTypes.add(t.toLowerCase());
    }
  }
  if (params.shopify) {
    for (const t of params.shopify.forbiddenProductTypes) {
      forbiddenTypes.add(t.toLowerCase());
    }
  }

  const products = [...byKey.values()].sort((a, b) => a.id.localeCompare(b.id));
  for (const product of products) {
    if (product.active && product.sellable && product.status === "active") {
      forbiddenTypes.delete(product.productType.toLowerCase());
      forbiddenTypes.delete(
        product.productType.replace(/\s+/g, "_").toLowerCase(),
      );
    }
  }

  const forbiddenCategories = new Set(params.seed.forbiddenCategories);
  if (params.shopify) {
    for (const c of params.shopify.forbiddenCategories) {
      forbiddenCategories.add(c);
    }
  }

  const notes = params.shopify
    ? [
        "Catalog authority: Shopify live.",
        "Seed rows were overridden where Shopify products exist.",
        ...params.seed.notes,
      ]
    : [
        "Catalog authority: seed fallback (Shopify live unavailable).",
        "Do not treat seed assumptions as confirmed Shopify inventory.",
        ...params.seed.notes,
      ];

  return {
    brandSlug: params.brandSlug,
    brandName: params.brandName,
    version: params.shopify?.version ?? params.seed.version,
    source: authoritySource,
    updatedAt: params.shopify?.updatedAt ?? params.seed.updatedAt,
    products,
    collections: [...collectionById.values()].sort((a, b) =>
      a.id.localeCompare(b.id),
    ),
    forbiddenProductTypes: [...forbiddenTypes].sort((a, b) =>
      a.localeCompare(b),
    ),
    forbiddenCategories: [...forbiddenCategories],
    notes,
    sync: params.sync,
  };
}

export type ResolveCatalogOptions = {
  brandSlug?: string;
  allowSeedFallback?: boolean;
  shopifyCatalog?: ProductCatalog | null;
  manualCatalog?: ProductCatalog | null;
  /** When true, never instantiate Shopify provider (sync Persona path). */
  seedOnly?: boolean;
};

/**
 * Resolve catalog with Shopify-first precedence.
 * Current Shopify adapter always reports unavailable and never fakes products.
 */
export async function resolveProductCatalog(
  options: ResolveCatalogOptions = {},
): Promise<ProductCatalogLoadResult> {
  const brandSlug = options.brandSlug ?? "milaene";
  const allowSeedFallback = options.allowSeedFallback ?? true;
  const seed = getProductCatalogForSlug(brandSlug);

  let shopifyCatalog = options.shopifyCatalog ?? null;
  let syncError: string | null = null;
  let liveCatalogAvailable = Boolean(shopifyCatalog);
  let lastSyncedAt: string | null = shopifyCatalog?.updatedAt ?? null;

  if (!shopifyCatalog && !options.seedOnly) {
    const shopify = new ShopifyProductCatalogProvider();
    const connection = await shopify.validateConnection();
    if (!connection.available) {
      syncError = connection.reason;
    } else {
      try {
        const products = await shopify.loadProducts();
        const collections = await shopify.loadCollections();
        shopifyCatalog = {
          brandSlug,
          brandName: seed.brandName,
          version: `shopify-live-${seed.updatedAt}`,
          source: "shopify_live",
          updatedAt: seed.updatedAt,
          products,
          collections,
          forbiddenProductTypes: [],
          forbiddenCategories: seed.forbiddenCategories,
          notes: ["Loaded from Shopify live catalog."],
        };
        liveCatalogAvailable = true;
        lastSyncedAt = shopifyCatalog.updatedAt;
      } catch (err) {
        syncError = err instanceof Error ? err.message : String(err);
      }
    }
  }

  if (!liveCatalogAvailable && !allowSeedFallback) {
    throw new Error(
      syncError ??
        "Shopify catalog unavailable and seed fallback is not allowed.",
    );
  }

  const sync: CatalogSyncStatus = {
    catalogSource: liveCatalogAvailable ? "shopify_live" : "seed",
    sourcePriority: PRODUCT_SOURCE_PRIORITY,
    lastSyncedAt,
    liveCatalogAvailable,
    usingSeedFallback: !liveCatalogAvailable,
    stale: false,
    syncError,
  };

  const catalog = mergeProductCatalogs({
    brandSlug,
    brandName: seed.brandName,
    seed,
    shopify: shopifyCatalog,
    manual: options.manualCatalog ?? null,
    sync,
  });

  return { catalog, sync };
}

/** Synchronous seed-only resolve — no Shopify provider instantiation. */
export function resolveProductCatalogSeedOnly(
  brandSlug = "milaene",
): ProductCatalogLoadResult {
  const seedProvider = new SeedProductCatalogProvider(brandSlug);
  const seed = getProductCatalogForSlug(brandSlug);
  const sync: CatalogSyncStatus = {
    ...(seed.sync ?? seedProvider.getLastSyncStatus()),
    usingSeedFallback: true,
    liveCatalogAvailable: false,
    catalogSource: "seed",
  };
  return {
    catalog: { ...seed, sync },
    sync,
  };
}
