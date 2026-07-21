import { PRODUCT_INTELLIGENCE_VERSION } from "./milaene";
import type {
  Product,
  ProductCatalog,
  ProductCategory,
  ProductGenerationConstraints,
  ProductIntelligenceSnapshot,
  ProductVariant,
} from "./types";

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}

function productById(catalog: ProductCatalog, productId: string): Product | undefined {
  return catalog.products.find((p) => p.id === productId);
}

/** Active + sellable + generation flags — eligible for AI image/video generation. */
export function isProductGenerationEligible(product: Product): boolean {
  return (
    product.active &&
    product.sellable &&
    product.status === "active" &&
    (product.imageGenerationAllowed || product.videoGenerationAllowed)
  );
}

export function getAllowedProductTypes(catalog: ProductCatalog): string[] {
  const types = new Set<string>();
  for (const product of catalog.products) {
    if (isProductGenerationEligible(product)) {
      types.add(product.productType);
    }
  }
  return [...types].sort((a, b) => a.localeCompare(b));
}

export function getForbiddenProductTypes(catalog: ProductCatalog): string[] {
  return [...catalog.forbiddenProductTypes].sort((a, b) => a.localeCompare(b));
}

export function getHeroProducts(catalog: ProductCatalog): Product[] {
  return catalog.products.filter(
    (p) => p.heroProduct && isProductGenerationEligible(p),
  );
}

export function isProductTypeAllowed(
  catalog: ProductCatalog,
  productType: string,
): boolean {
  const key = normalizeKey(productType);
  if (!key) return false;

  if (
    catalog.forbiddenProductTypes.some(
      (f) => normalizeKey(f) === key || key.includes(normalizeKey(f)),
    )
  ) {
    return false;
  }

  return getAllowedProductTypes(catalog).some((allowed) => {
    const a = normalizeKey(allowed);
    return a === key || a.includes(key) || key.includes(a);
  });
}

export function isCategoryForbidden(
  catalog: ProductCatalog,
  category: ProductCategory | string,
): boolean {
  const key = normalizeKey(String(category));
  return catalog.forbiddenCategories.some((c) => normalizeKey(c) === key);
}

export function isColorAllowedForProduct(
  catalog: ProductCatalog,
  productId: string,
  colorNameOrId: string,
): boolean {
  const product = productById(catalog, productId);
  if (!product || !isProductGenerationEligible(product)) return false;

  const key = normalizeKey(colorNameOrId);
  return product.availableColors.some(
    (c) =>
      normalizeKey(c.id) === key ||
      normalizeKey(c.slug) === key ||
      normalizeKey(c.name) === key,
  );
}

export function isVariantAvailable(
  catalog: ProductCatalog,
  variantId: string,
): boolean {
  for (const product of catalog.products) {
    if (!isProductGenerationEligible(product)) continue;
    const variant = product.variants.find((v) => v.id === variantId);
    if (!variant) continue;
    return (
      variant.active &&
      variant.sellable &&
      variant.availability !== "out_of_stock"
    );
  }
  return false;
}

export function findVariant(
  catalog: ProductCatalog,
  variantId: string,
): { product: Product; variant: ProductVariant } | undefined {
  for (const product of catalog.products) {
    const variant = product.variants.find((v) => v.id === variantId);
    if (variant) return { product, variant };
  }
  return undefined;
}

export function assertRequestedProductExists(
  catalog: ProductCatalog,
  productId: string,
): Product {
  const product = productById(catalog, productId);
  if (!product) {
    throw new Error(
      `Product Intelligence: product "${productId}" does not exist in catalog ${catalog.version}. Do not invent products.`,
    );
  }
  return product;
}

export function assertRequestedVariantExists(
  catalog: ProductCatalog,
  variantId: string,
): ProductVariant {
  const found = findVariant(catalog, variantId);
  if (!found) {
    throw new Error(
      `Product Intelligence: variant "${variantId}" does not exist in catalog ${catalog.version}. Do not invent variants.`,
    );
  }
  return found.variant;
}

export function buildProductGenerationConstraints(
  catalog: ProductCatalog,
): ProductGenerationConstraints {
  const eligible = catalog.products.filter(isProductGenerationEligible);
  const allowedColorsByProductId: Record<string, string[]> = {};
  for (const product of eligible) {
    allowedColorsByProductId[product.id] = product.availableColors.map(
      (c) => c.name,
    );
  }

  const neverGenerate = [
    ...getForbiddenProductTypes(catalog),
    ...catalog.forbiddenCategories,
    ...catalog.products
      .filter((p) => !isProductGenerationEligible(p))
      .map((p) => p.productType),
  ];

  const usingSeedFallback = catalog.sync?.usingSeedFallback ?? catalog.source === "seed";

  return {
    allowedProductTypes: getAllowedProductTypes(catalog),
    forbiddenProductTypes: getForbiddenProductTypes(catalog),
    forbiddenCategories: [...catalog.forbiddenCategories],
    allowedColorsByProductId,
    heroProductIds: getHeroProducts(catalog).map((p) => p.id),
    generationEligibleProductIds: eligible.map((p) => p.id),
    neverGenerate: [...new Set(neverGenerate)].sort((a, b) =>
      a.localeCompare(b),
    ),
    notes: [...catalog.notes],
    catalogSource: catalog.sync?.catalogSource ?? catalog.source,
    usingSeedFallback,
  };
}

/** Deterministic fingerprint — stable across process runs for the same catalog. */
export function buildCatalogContentFingerprint(catalog: ProductCatalog): string {
  const productParts = catalog.products
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((p) => {
      const colors = p.availableColors
        .map((c) => c.slug)
        .sort()
        .join(",");
      const variants = p.variants
        .map((v) => v.id)
        .sort()
        .join(",");
      return [
        p.id,
        p.version,
        p.status,
        p.active ? "1" : "0",
        p.sellable ? "1" : "0",
        p.heroProduct ? "1" : "0",
        colors,
        variants,
      ].join(":");
    });

  return [
    catalog.version,
    catalog.source,
    catalog.forbiddenProductTypes.slice().sort().join(","),
    catalog.forbiddenCategories.slice().sort().join(","),
    productParts.join("|"),
  ].join("::");
}

export function createProductIntelligenceSnapshot(
  catalog: ProductCatalog,
  options?: {
    selectedProductIds?: string[];
    selectedVariantIds?: string[];
    capturedAt?: string;
  },
): ProductIntelligenceSnapshot {
  const constraints = buildProductGenerationConstraints(catalog);
  const selectedProductIds = options?.selectedProductIds ?? [];
  const selectedVariantIds = options?.selectedVariantIds ?? [];

  for (const id of selectedProductIds) {
    assertRequestedProductExists(catalog, id);
  }
  for (const id of selectedVariantIds) {
    assertRequestedVariantExists(catalog, id);
  }

  return {
    productIntelligenceVersion: PRODUCT_INTELLIGENCE_VERSION,
    productConstraintSource: catalog.source,
    catalogVersion: catalog.version,
    brandSlug: catalog.brandSlug,
    capturedAt: options?.capturedAt ?? catalog.updatedAt,
    selectedProductIds,
    selectedVariantIds,
    allowedProductTypes: constraints.allowedProductTypes,
    forbiddenProductTypes: constraints.forbiddenProductTypes,
    forbiddenCategories: constraints.forbiddenCategories,
    heroProductIds: constraints.heroProductIds,
    generationEligibleProductIds: constraints.generationEligibleProductIds,
    contentFingerprint: buildCatalogContentFingerprint(catalog),
    catalog,
    catalogSource: catalog.sync?.catalogSource ?? catalog.source,
    sourcePriority: catalog.sync?.sourcePriority ?? [
      "shopify_live",
      "manual_confirmed",
      "seed",
      "seed_assumed",
      "unknown",
    ],
    lastSyncedAt: catalog.sync?.lastSyncedAt ?? null,
    liveCatalogAvailable: catalog.sync?.liveCatalogAvailable ?? false,
    usingSeedFallback:
      catalog.sync?.usingSeedFallback ?? catalog.source === "seed",
    stale: catalog.sync?.stale ?? false,
    syncError: catalog.sync?.syncError ?? null,
  };
}
