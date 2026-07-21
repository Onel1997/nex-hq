/**
 * Product Intelligence — authoritative product / variant SSOT for NexHQ studios.
 *
 * Brand Memory (`lib/brand-memory`) = creative identity + broad product direction.
 * Product Intelligence = what the brand actually sells.
 *
 * Source precedence (highest first):
 * 1. shopify_live
 * 2. manual_confirmed
 * 3. seed
 * 4. seed_assumed
 * 5. unknown
 *
 * Seed never overrides a valid live Shopify product.
 */

/** Confidence of a catalog fact relative to live commerce truth. */
export type ProductFactConfidence =
  | "confirmed"
  | "confirmed_direction"
  | "seed"
  | "unknown";

/**
 * Where a catalog fact originated.
 * `shopify` / `manual` are legacy aliases normalized to `shopify_live` / `manual_confirmed`.
 */
export type ProductSource =
  | "shopify_live"
  | "manual_confirmed"
  | "seed"
  | "seed_assumed"
  | "unknown"
  /** @deprecated Prefer shopify_live */
  | "shopify"
  /** @deprecated Prefer manual_confirmed */
  | "manual";

/** Canonical precedence — lower index wins on conflict. */
export const PRODUCT_SOURCE_PRIORITY: readonly ProductSource[] = [
  "shopify_live",
  "manual_confirmed",
  "seed",
  "seed_assumed",
  "unknown",
] as const;

export type ProductStatus = "draft" | "active" | "archived" | "unknown";

/**
 * Availability is inventory-adjacent. Seed catalogs must use `unknown` or
 * `seed_assumed` — never pretend live stock without Shopify.
 */
export type ProductAvailability =
  | "in_stock"
  | "limited"
  | "out_of_stock"
  | "unknown"
  | "seed_assumed";

export type ProductCategory =
  | "t-shirts"
  | "hoodies"
  | "sweatshirts"
  | "sweatpants"
  | "caps"
  | "jackets"
  | "footwear"
  | "jewelry"
  | "accessories"
  | "other";

export type ProductColor = {
  id: string;
  name: string;
  slug: string;
  hex?: string;
  confidence: ProductFactConfidence;
};

export type ProductSize = {
  id: string;
  label: string;
  sortOrder: number;
  confidence: ProductFactConfidence;
};

export type ProductMaterial = {
  id: string;
  name: string;
  confidence: ProductFactConfidence;
};

export type ProductMediaReference = {
  id: string;
  url?: string;
  alt?: string;
  role: "hero" | "gallery" | "swatch" | "unknown";
  confidence: ProductFactConfidence;
};

export type ProductVariant = {
  id: string;
  sku?: string;
  productId: string;
  title: string;
  colorId: string;
  sizeId: string;
  availability: ProductAvailability;
  sellable: boolean;
  active: boolean;
  confidence: ProductFactConfidence;
};

export type ProductCollection = {
  id: string;
  slug: string;
  title: string;
  confidence: ProductFactConfidence;
};

export type Product = {
  id: string;
  slug: string;
  title: string;
  category: ProductCategory;
  productType: string;
  status: ProductStatus;
  description: string;
  materials: ProductMaterial[];
  /** Grams per square meter — null when unknown. */
  gsm: number | null;
  gsmConfidence: ProductFactConfidence;
  fit: string[];
  silhouette: string[];
  genderPresentation: string;
  availableColors: ProductColor[];
  availableSizes: ProductSize[];
  variants: ProductVariant[];
  collections: string[];
  season: string | null;
  heroProduct: boolean;
  active: boolean;
  sellable: boolean;
  imageGenerationAllowed: boolean;
  videoGenerationAllowed: boolean;
  source: ProductSource;
  updatedAt: string;
  version: string;
  confidence: ProductFactConfidence;
  media: ProductMediaReference[];
};

/** Safe catalog sync metadata — never includes API keys or secrets. */
export type CatalogSyncStatus = {
  catalogSource: ProductSource;
  sourcePriority: readonly ProductSource[];
  lastSyncedAt: string | null;
  liveCatalogAvailable: boolean;
  usingSeedFallback: boolean;
  stale: boolean;
  syncError: string | null;
};

export type ProductCatalog = {
  brandSlug: string;
  brandName: string;
  version: string;
  source: ProductSource;
  updatedAt: string;
  products: Product[];
  collections: ProductCollection[];
  /** Product types that must never be generated for this brand. */
  forbiddenProductTypes: string[];
  /** Categories absent from catalog — never invent them. */
  forbiddenCategories: ProductCategory[];
  notes: string[];
  /** Optional sync metadata from the catalog resolver. */
  sync?: CatalogSyncStatus;
};

/**
 * Persistable snapshot for generation jobs (Persona / Image / Video / etc.).
 * Designed so a Shopify-backed loader can populate the same shape later.
 */
export type ProductIntelligenceSnapshot = {
  productIntelligenceVersion: string;
  productConstraintSource: ProductSource | "mixed";
  catalogVersion: string;
  brandSlug: string;
  capturedAt: string;
  selectedProductIds: string[];
  selectedVariantIds: string[];
  allowedProductTypes: string[];
  forbiddenProductTypes: string[];
  forbiddenCategories: ProductCategory[];
  heroProductIds: string[];
  generationEligibleProductIds: string[];
  /** Deterministic fingerprint of catalog content for cache / audit. */
  contentFingerprint: string;
  catalog: ProductCatalog;
  /** Catalog authority metadata for job persistence. */
  catalogSource: ProductSource;
  sourcePriority: readonly ProductSource[];
  lastSyncedAt: string | null;
  liveCatalogAvailable: boolean;
  usingSeedFallback: boolean;
  stale: boolean;
  syncError: string | null;
};

/** Compact generation guardrails derived from a catalog or snapshot. */
export type ProductGenerationConstraints = {
  allowedProductTypes: string[];
  forbiddenProductTypes: string[];
  forbiddenCategories: ProductCategory[];
  allowedColorsByProductId: Record<string, string[]>;
  heroProductIds: string[];
  generationEligibleProductIds: string[];
  neverGenerate: string[];
  notes: string[];
  catalogSource: ProductSource;
  usingSeedFallback: boolean;
};
