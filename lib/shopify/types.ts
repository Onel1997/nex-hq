/** Raw product node from Shopify Admin GraphQL catalog fetch. */
export interface ShopifyCatalogProduct {
  id: string;
  title: string;
  handle: string;
  status: string;
  productType: string;
  tags: string[];
  description: string;
  totalInventory: number;
  imageUrl: string | null;
  priceMin: string;
  priceMax: string;
  currency: string;
  collections: string[];
  options: Array<{ name: string; values: string[] }>;
  variantColors: string[];
}

export interface ShopifyCatalogCollection {
  id: string;
  title: string;
  handle: string;
  productCount: number;
}

export interface ShopifyCatalog {
  products: ShopifyCatalogProduct[];
  collections: ShopifyCatalogCollection[];
}

export interface ShopifyKnowledgeProduct {
  id: string;
  title: string;
  handle: string;
  status: string;
  productType: string;
  price: string;
  currency: string;
  inventory: number;
  imageUrl?: string | null;
  collections: string[];
  tags: string[];
  colors: string[];
  materials: string[];
}

export interface ShopifyKnowledgeCollection {
  title: string;
  handle: string;
  productCount: number;
}

export interface ShopifyPriceRange {
  label: string;
  min: number;
  max: number;
  currency: string;
  productCount: number;
}

export interface ShopifyInventorySummary {
  totalProducts: number;
  activeProducts: number;
  draftProducts: number;
  totalInventory: number;
  inStock: number;
  outOfStock: number;
  lowStock: number;
}

/** Central Shopify business database snapshot. */
export interface ShopifyKnowledge {
  products: ShopifyKnowledgeProduct[];
  collections: ShopifyKnowledgeCollection[];
  categories: string[];
  colors: string[];
  materials: string[];
  priceRanges: ShopifyPriceRange[];
  tags: string[];
  inventorySummary: ShopifyInventorySummary;
}

export interface ShopifyProductSummary {
  id: string;
  title: string;
  productType: string;
  price: string;
  currency: string;
  status: string;
  inventory: number;
  collections: string[];
  colors: string[];
  materials: string[];
}

export interface ShopifyPriceBand {
  label: string;
  range: string;
  productCount: number;
}

/** Derived product universe for agent constraints. */
export interface ProductKnowledge {
  availableProducts: ShopifyProductSummary[];
  availableCategories: string[];
  availableColors: string[];
  availableMaterials: string[];
  collections: string[];
  priceBands: ShopifyPriceBand[];
  productCount: number;
  bestsellerCandidates: ShopifyProductSummary[];
  inventoryState: ShopifyInventorySummary;
  categoryGaps: string[];
}
