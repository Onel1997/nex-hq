import { fetchShopifyCatalog } from "@/lib/shopify/fetch-catalog";
import type {
  ShopifyInventorySummary,
  ShopifyKnowledge,
  ShopifyKnowledgeCollection,
  ShopifyKnowledgeProduct,
  ShopifyPriceRange,
} from "@/lib/shopify/types";

const MATERIAL_KEYWORDS = [
  "cotton",
  "fleece",
  "french terry",
  "terry",
  "denim",
  "leather",
  "wool",
  "polyester",
  "nylon",
  "jersey",
  "canvas",
  "suede",
  "linen",
  "mesh",
  "ripstop",
  "satin",
  "velvet",
  "cashmere",
  "organic cotton",
  "recycled",
  "gsm",
];

const COLOR_TAG_KEYWORDS = [
  "black",
  "white",
  "cream",
  "navy",
  "grey",
  "gray",
  "olive",
  "stone",
  "sand",
  "red",
  "blue",
  "green",
  "pink",
  "beige",
  "charcoal",
  "burgundy",
  "brown",
  "tan",
  "ivory",
  "off-white",
  "heather",
  "washed",
];

const LOW_STOCK_THRESHOLD = 5;

function uniqueSorted(values: Iterable<string>): string[] {
  return [...new Set([...values].map((v) => v.trim()).filter(Boolean))].sort(
    (a, b) => a.localeCompare(b),
  );
}

function extractMaterialsFromText(text: string): string[] {
  const lower = text.toLowerCase();
  const found: string[] = [];

  for (const keyword of MATERIAL_KEYWORDS) {
    if (lower.includes(keyword)) {
      found.push(keyword);
    }
  }

  const gsmMatch = text.match(/\d+\s*gsm[^.,;\n]*/gi);
  if (gsmMatch) {
    for (const phrase of gsmMatch) {
      found.push(phrase.trim());
    }
  }

  return uniqueSorted(found);
}

function extractMaterialsFromTags(tags: string[]): string[] {
  return uniqueSorted(
    tags.filter((tag) =>
      MATERIAL_KEYWORDS.some((keyword) => tag.toLowerCase().includes(keyword)),
    ),
  );
}

function extractColorsFromTags(tags: string[]): string[] {
  return uniqueSorted(
    tags.filter((tag) =>
      COLOR_TAG_KEYWORDS.some((keyword) => tag.toLowerCase().includes(keyword)),
    ),
  );
}

function buildInventorySummary(
  products: ShopifyKnowledgeProduct[],
): ShopifyInventorySummary {
  const active = products.filter((p) => p.status === "ACTIVE");
  const draft = products.filter((p) => p.status === "DRAFT");
  const inStock = products.filter((p) => p.inventory > 0);
  const outOfStock = products.filter((p) => p.inventory <= 0);
  const lowStock = products.filter(
    (p) => p.inventory > 0 && p.inventory <= LOW_STOCK_THRESHOLD,
  );

  return {
    totalProducts: products.length,
    activeProducts: active.length,
    draftProducts: draft.length,
    totalInventory: products.reduce((sum, p) => sum + p.inventory, 0),
    inStock: inStock.length,
    outOfStock: outOfStock.length,
    lowStock: lowStock.length,
  };
}

function buildPriceRanges(
  products: ShopifyKnowledgeProduct[],
): ShopifyPriceRange[] {
  if (products.length === 0) return [];

  const currency = products[0]?.currency ?? "EUR";
  const prices = products
    .map((p) => parseFloat(p.price))
    .filter((n) => !Number.isNaN(n));

  if (prices.length === 0) return [];

  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const span = max - min || 1;
  const step = span / 3;

  const bands: Array<{ label: string; min: number; max: number }> = [
    { label: "Entry", min, max: min + step },
    { label: "Core", min: min + step, max: min + step * 2 },
    { label: "Premium", min: min + step * 2, max: max + 0.01 },
  ];

  return bands.map((band) => {
    const inBand = products.filter((p) => {
      const price = parseFloat(p.price);
      return price >= band.min && price < band.max;
    });

    return {
      label: band.label,
      min: Math.round(band.min * 100) / 100,
      max: Math.round(band.max * 100) / 100,
      currency,
      productCount: inBand.length,
    };
  });
}

function mapKnowledgeProduct(
  product: Awaited<ReturnType<typeof fetchShopifyCatalog>>["products"][number],
): ShopifyKnowledgeProduct {
  const tagMaterials = extractMaterialsFromTags(product.tags);
  const descMaterials = extractMaterialsFromText(product.description);
  const tagColors = extractColorsFromTags(product.tags);

  return {
    id: product.id,
    title: product.title,
    handle: product.handle,
    status: product.status,
    productType: product.productType,
    price: product.priceMin,
    currency: product.currency,
    inventory: product.totalInventory,
    imageUrl: product.imageUrl,
    collections: product.collections,
    tags: product.tags,
    colors: uniqueSorted([...product.variantColors, ...tagColors]),
    materials: uniqueSorted([...tagMaterials, ...descMaterials]),
  };
}

function mapCollections(
  catalog: Awaited<ReturnType<typeof fetchShopifyCatalog>>,
): ShopifyKnowledgeCollection[] {
  const fromApi: ShopifyKnowledgeCollection[] = catalog.collections.map((c) => ({
    title: c.title,
    handle: c.handle,
    productCount: c.productCount,
  }));

  const fromProducts = new Map<string, number>();
  for (const product of catalog.products) {
    for (const title of product.collections) {
      fromProducts.set(title, (fromProducts.get(title) ?? 0) + 1);
    }
  }

  const merged = new Map<string, ShopifyKnowledgeCollection>();

  for (const col of fromApi) {
    merged.set(col.title, col);
  }

  for (const [title, count] of fromProducts) {
    const existing = merged.get(title);
    if (existing) {
      merged.set(title, {
        ...existing,
        productCount: Math.max(existing.productCount, count),
      });
    } else {
      merged.set(title, {
        title,
        handle: title.toLowerCase().replace(/\s+/g, "-"),
        productCount: count,
      });
    }
  }

  return [...merged.values()].sort((a, b) => a.title.localeCompare(b.title));
}

/**
 * Load the central Shopify business database snapshot.
 * All agent knowledge must originate from this source.
 */
export async function fetchShopifyKnowledge(): Promise<ShopifyKnowledge> {
  const catalog = await fetchShopifyCatalog();
  const products = catalog.products.map(mapKnowledgeProduct);

  const categories = uniqueSorted(products.map((p) => p.productType));
  const colors = uniqueSorted(products.flatMap((p) => p.colors));
  const materials = uniqueSorted(products.flatMap((p) => p.materials));
  const tags = uniqueSorted(products.flatMap((p) => p.tags));
  const collections = mapCollections(catalog);

  return {
    products,
    collections,
    categories,
    colors,
    materials,
    priceRanges: buildPriceRanges(products),
    tags,
    inventorySummary: buildInventorySummary(products),
  };
}

/** Empty knowledge when Shopify is unavailable — agents must not invent catalog data. */
export function emptyShopifyKnowledge(): ShopifyKnowledge {
  return {
    products: [],
    collections: [],
    categories: [],
    colors: [],
    materials: [],
    priceRanges: [],
    tags: [],
    inventorySummary: {
      totalProducts: 0,
      activeProducts: 0,
      draftProducts: 0,
      totalInventory: 0,
      inStock: 0,
      outOfStock: 0,
      lowStock: 0,
    },
  };
}

/**
 * Safe wrapper — returns empty knowledge instead of throwing when Shopify is unavailable.
 */
export async function loadShopifyKnowledgeSafe(): Promise<ShopifyKnowledge> {
  try {
    return await fetchShopifyKnowledge();
  } catch (error) {
    console.warn(
      "[Shopify Knowledge] Failed to load catalog",
      error instanceof Error ? error.message : error,
    );
    return emptyShopifyKnowledge();
  }
}
