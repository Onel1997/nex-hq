export type {
  CatalogSyncStatus,
  Product,
  ProductAvailability,
  ProductCatalog,
  ProductCategory,
  ProductCollection,
  ProductColor,
  ProductFactConfidence,
  ProductGenerationConstraints,
  ProductIntelligenceSnapshot,
  ProductMaterial,
  ProductMediaReference,
  ProductSize,
  ProductSource,
  ProductStatus,
  ProductVariant,
} from "./types";

export { PRODUCT_SOURCE_PRIORITY } from "./types";

export {
  MILAENE_PRODUCT_CATALOG,
  MILAENE_PRODUCT_CATALOG_VERSION,
  MILAENE_PRODUCTS,
  PRODUCT_INTELLIGENCE_VERSION,
} from "./milaene";

export {
  DEFAULT_PRODUCT_INTELLIGENCE_SLUG,
  PRODUCT_CATALOG_BY_SLUG,
  getProductCatalogForSlug,
  listProductCatalogSlugs,
} from "./registry";

export {
  getRawSeedCatalog,
  loadProductCatalog,
  loadProductCatalogBySlug,
  loadProductIntelligenceSnapshot,
  loadProductIntelligenceSnapshotBySlug,
} from "./load";

export {
  assertRequestedProductExists,
  assertRequestedVariantExists,
  buildCatalogContentFingerprint,
  buildProductGenerationConstraints,
  createProductIntelligenceSnapshot,
  findVariant,
  getAllowedProductTypes,
  getForbiddenProductTypes,
  getHeroProducts,
  isCategoryForbidden,
  isColorAllowedForProduct,
  isProductGenerationEligible,
  isProductTypeAllowed,
  isVariantAvailable,
} from "./rules";

export {
  formatProductConstraintsPrompt,
  formatProductIntelligencePrompt,
  formatProductVariantPrompt,
  formatProductWardrobeConstraintsForPersona,
} from "./prompt";

export {
  SeedProductCatalogProvider,
  ShopifyProductCatalogProvider,
  emptyUnavailableSync,
  mergeProductCatalogs,
  normalizeProductSource,
  resolveProductCatalog,
  resolveProductCatalogSeedOnly,
  sourcePriorityRank,
  sourceWins,
  type CatalogConnectionStatus,
  type ProductCatalogLoadResult,
  type ProductCatalogProvider,
  type ResolveCatalogOptions,
} from "./providers";
