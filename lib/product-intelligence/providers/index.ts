export type {
  CatalogConnectionStatus,
  ProductCatalogLoadResult,
  ProductCatalogProvider,
} from "./types";
export {
  emptyUnavailableSync,
  normalizeProductSource,
  sourcePriorityRank,
  sourceWins,
} from "./types";

export { SeedProductCatalogProvider } from "./seed-provider";
export { ShopifyProductCatalogProvider } from "./shopify-provider";
export {
  mergeProductCatalogs,
  resolveProductCatalog,
  resolveProductCatalogSeedOnly,
  type ResolveCatalogOptions,
} from "./resolve";
