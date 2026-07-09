import type {
  ProductKnowledge,
  ShopifyKnowledge,
  ShopifyProductSummary,
  ShopifyPriceBand,
} from "@/lib/shopify/types";

/** Standard streetwear categories used to detect catalog gaps. */
const EXPECTED_CATEGORIES = [
  "T-Shirts",
  "Hoodies",
  "Sweatshirts",
  "Pants",
  "Shorts",
  "Jackets",
  "Outerwear",
  "Accessories",
  "Headwear",
  "Footwear",
];

const CATEGORY_ALIASES: Record<string, string[]> = {
  "T-Shirts": ["tee", "t-shirt", "tshirt", "top", "shirt"],
  Hoodies: ["hoodie", "hooded"],
  Sweatshirts: ["sweatshirt", "crewneck", "crew"],
  Pants: ["pant", "trouser", "jogger", "bottom"],
  Shorts: ["short"],
  Jackets: ["jacket", "bomber", "windbreaker"],
  Outerwear: ["outerwear", "coat", "parka", "puffer"],
  Accessories: ["accessory", "bag", "tote", "sock"],
  Headwear: ["cap", "hat", "beanie", "headwear"],
  Footwear: ["shoe", "sneaker", "footwear", "boot"],
};

function toProductSummary(
  product: ShopifyKnowledge["products"][number],
): ShopifyProductSummary {
  return {
    id: product.id,
    title: product.title,
    productType: product.productType,
    price: product.price,
    currency: product.currency,
    status: product.status,
    inventory: product.inventory,
    collections: product.collections,
    colors: product.colors,
    sizes: product.sizes,
    materials: product.materials,
  };
}

function detectCategoryGaps(categories: string[]): string[] {
  const normalized = categories.map((c) => c.toLowerCase());

  return EXPECTED_CATEGORIES.filter((expected) => {
    const aliases = CATEGORY_ALIASES[expected] ?? [expected.toLowerCase()];
    return !normalized.some((cat) =>
      aliases.some((alias) => cat.includes(alias)),
    );
  });
}

function buildPriceBands(knowledge: ShopifyKnowledge): ShopifyPriceBand[] {
  return knowledge.priceRanges.map((range) => ({
    label: range.label,
    range: `${range.min.toFixed(0)}–${range.max.toFixed(0)} ${range.currency}`,
    productCount: range.productCount,
  }));
}

function selectBestsellerCandidates(
  products: ShopifyProductSummary[],
): ShopifyProductSummary[] {
  return products
    .filter((p) => p.status === "ACTIVE" && p.inventory > 0)
    .sort((a, b) => b.inventory - a.inventory)
    .slice(0, 8);
}

/**
 * Derive agent-ready product universe constraints from Shopify knowledge.
 */
export function buildProductKnowledge(
  knowledge: ShopifyKnowledge,
): ProductKnowledge {
  const activeProducts = knowledge.products
    .filter((p) => p.status === "ACTIVE")
    .map(toProductSummary);

  const availableProducts = knowledge.products.map(toProductSummary);

  return {
    availableProducts,
    availableCategories: knowledge.categories,
    availableColors: knowledge.colors,
    availableMaterials: knowledge.materials,
    collections: knowledge.collections.map((c) => c.title),
    priceBands: buildPriceBands(knowledge),
    productCount: knowledge.products.length,
    bestsellerCandidates: selectBestsellerCandidates(availableProducts),
    inventoryState: knowledge.inventorySummary,
    categoryGaps: detectCategoryGaps(knowledge.categories),
  };
}

export function emptyProductKnowledge(): ProductKnowledge {
  return {
    availableProducts: [],
    availableCategories: [],
    availableColors: [],
    availableMaterials: [],
    collections: [],
    priceBands: [],
    productCount: 0,
    bestsellerCandidates: [],
    inventoryState: {
      totalProducts: 0,
      activeProducts: 0,
      draftProducts: 0,
      totalInventory: 0,
      inStock: 0,
      outOfStock: 0,
      lowStock: 0,
    },
    categoryGaps: EXPECTED_CATEGORIES,
  };
}
