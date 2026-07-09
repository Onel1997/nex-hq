import type { MilaeneCommerceBaseline } from "@/lib/commerce/milaene-commerce-baseline";
import { matchProductToMarketPrint } from "@/lib/marketprint/product-capabilities";
import type { ShopifyKnowledgeProduct } from "@/lib/shopify/types";
import { scoreDnaAlignment } from "@/services/milaene-dna";

export type ProductCategory =
  | "tee"
  | "hoodie"
  | "crewneck"
  | "cap"
  | "accessory";

export interface ProductIntelligence {
  productId: string;
  title: string;
  category: ProductCategory;
  availableColors: string[];
  availableSizes: string[];
  materials: string[];
  printAreas: string[];
  bestseller: boolean;
  salesRank: number;
  revenue?: number;
  unitsSold?: number;
  trendWeight: number;
  recommendationWeight: number;
}

export interface ProductIntelligenceCatalog {
  loadedAt: string;
  commerceConnected: boolean;
  products: ProductIntelligence[];
  bestsellers: ProductIntelligence[];
  allColors: string[];
  allSizes: string[];
  allMaterials: string[];
  allPrintAreas: string[];
}

export interface ProductIntelligenceEngineInput {
  baseline?: MilaeneCommerceBaseline | null;
}

function uniqueSorted(values: Iterable<string>): string[] {
  return [...new Set([...values].map((v) => v.trim()).filter(Boolean))].sort(
    (a, b) => a.localeCompare(b),
  );
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function detectCategory(product: ShopifyKnowledgeProduct): ProductCategory {
  const text = normalize(
    [product.title, product.productType, ...(product.tags ?? [])].join(" "),
  );

  if (/\bcap\b|dad cap|snapback|baseball cap|structured cap/.test(text)) {
    return "cap";
  }
  if (/\bbeanie\b|knit hat/.test(text)) return "cap";
  if (/\bhoodie\b|hooded/.test(text)) return "hoodie";
  if (/\bcrewneck\b|crew neck|sweatshirt\b/.test(text)) return "crewneck";
  if (/\btee\b|t-shirt|tshirt|oversized tee/.test(text)) return "tee";
  return "accessory";
}

function resolvePrintAreas(
  product: ShopifyKnowledgeProduct,
  category: ProductCategory,
): string[] {
  const match = matchProductToMarketPrint({
    title: product.title,
    productType: product.productType,
    tags: product.tags,
    materials: product.materials,
  });

  const areas = new Set<string>();

  if (category === "cap") {
    if (match.capability.embroidery) areas.add("Front Panel");
    if (match.capability.printing) areas.add("Front");
    return [...areas];
  }

  if (category === "accessory") {
    if (match.capability.printing) areas.add("Front");
    return [...areas];
  }

  if (match.capability.printing) {
    areas.add("Front");
    areas.add("Back");
  }
  if (match.capability.embroidery) {
    areas.add("Front");
    if (category === "hoodie" || category === "crewneck") {
      areas.add("Back");
    }
  }

  return uniqueSorted(areas);
}

function resolveMaterials(
  product: ShopifyKnowledgeProduct,
  category: ProductCategory,
): string[] {
  const fromProduct = uniqueSorted(product.materials);
  if (fromProduct.length > 0) return fromProduct;

  const match = matchProductToMarketPrint({
    title: product.title,
    productType: product.productType,
    tags: product.tags,
    materials: product.materials,
  });

  if (match.capability.material) {
    return [match.capability.material];
  }

  if (category === "tee" || category === "hoodie") {
    return ["Heavyweight Cotton"];
  }

  return [];
}

function computeTrendWeight(
  product: ShopifyKnowledgeProduct,
  category: ProductCategory,
): number {
  const text = normalize(
    [product.title, product.productType, ...(product.tags ?? [])].join(" "),
  );

  const dna = scoreDnaAlignment({
    styleMatch: /oversized|boxy|minimal|premium/.test(text) ? 90 : 70,
    colorMatch: product.colors.some((c) =>
      /black|white|sand|olive|grey|gray|washed/.test(normalize(c)),
    )
      ? 88
      : 65,
    silhouetteMatch:
      category === "tee" || category === "hoodie" ? 85 : 70,
    qualityMatch: /heavyweight|premium|450|500/.test(text) ? 90 : 72,
  });

  return Math.round(dna);
}

function computeRecommendationWeight(input: {
  bestseller: boolean;
  salesRank: number;
  unitsSold: number;
  trendWeight: number;
  marketPrintSuitability: number;
  inventory: number;
}): number {
  const salesBoost = input.bestseller
    ? 25
    : input.unitsSold > 0
      ? Math.min(15, Math.round(input.unitsSold / 10))
      : 0;
  const rankBoost =
    input.salesRank > 0 ? Math.max(0, 12 - input.salesRank) : 0;
  const stockBoost = input.inventory > 0 ? 5 : -10;

  return Math.min(
    100,
    Math.round(
      input.trendWeight * 0.35 +
        input.marketPrintSuitability * 0.25 +
        salesBoost +
        rankBoost +
        stockBoost +
        20,
    ),
  );
}

function buildProductRecord(
  product: ShopifyKnowledgeProduct,
  salesByTitle: Map<string, { unitsSold: number; revenue: number; rank: number }>,
): ProductIntelligence {
  const category = detectCategory(product);
  const sales = salesByTitle.get(normalize(product.title));
  const match = matchProductToMarketPrint({
    title: product.title,
    productType: product.productType,
    tags: product.tags,
    materials: product.materials,
  });

  const trendWeight = computeTrendWeight(product, category);
  const bestseller = (sales?.rank ?? 0) > 0 && (sales?.rank ?? 99) <= 5;
  const salesRank = sales?.rank ?? 0;

  return {
    productId: product.id,
    title: product.title,
    category,
    availableColors: uniqueSorted(product.colors),
    availableSizes: uniqueSorted(product.sizes ?? []),
    materials: resolveMaterials(product, category),
    printAreas: resolvePrintAreas(product, category),
    bestseller,
    salesRank,
    revenue: sales?.revenue,
    unitsSold: sales?.unitsSold,
    trendWeight,
    recommendationWeight: computeRecommendationWeight({
      bestseller,
      salesRank,
      unitsSold: sales?.unitsSold ?? 0,
      trendWeight,
      marketPrintSuitability: match.suitability,
      inventory: product.inventory,
    }),
  };
}

/** Build per-product intelligence from Shopify + MarketPrint + sales data. */
export function buildProductIntelligenceCatalog(
  input: ProductIntelligenceEngineInput = {},
): ProductIntelligenceCatalog {
  const { baseline } = input;

  if (!baseline) {
    return {
      loadedAt: new Date().toISOString(),
      commerceConnected: false,
      products: [],
      bestsellers: [],
      allColors: [],
      allSizes: [],
      allMaterials: [],
      allPrintAreas: [],
    };
  }

  const salesByTitle = new Map<
    string,
    { unitsSold: number; revenue: number; rank: number }
  >();

  for (const record of baseline.commerceIntelligence.topUnits) {
    salesByTitle.set(normalize(record.title), {
      unitsSold: record.unitsSold,
      revenue: record.revenue,
      rank: record.unitsRank,
    });
  }

  const activeProducts = baseline.knowledge.products.filter(
    (p) => p.status === "ACTIVE",
  );

  const products = activeProducts
    .map((p) => buildProductRecord(p, salesByTitle))
    .sort((a, b) => b.recommendationWeight - a.recommendationWeight);

  const bestsellers = products.filter((p) => p.bestseller);

  return {
    loadedAt: new Date().toISOString(),
    commerceConnected: true,
    products,
    bestsellers,
    allColors: uniqueSorted(products.flatMap((p) => p.availableColors)),
    allSizes: uniqueSorted(products.flatMap((p) => p.availableSizes)),
    allMaterials: uniqueSorted(products.flatMap((p) => p.materials)),
    allPrintAreas: uniqueSorted(products.flatMap((p) => p.printAreas)),
  };
}

function formatProductBlock(product: ProductIntelligence): string[] {
  const lines = [product.title];

  if (product.availableColors.length > 0) {
    lines.push("Farben:");
    for (const color of product.availableColors) {
      lines.push(`- ${color}`);
    }
  }

  if (product.availableSizes.length > 0) {
    lines.push("Größen:");
    for (const size of product.availableSizes) {
      lines.push(`- ${size}`);
    }
  }

  if (product.materials.length > 0) {
    lines.push(`Material: ${product.materials.join(", ")}`);
  }

  if (product.printAreas.length > 0) {
    lines.push(`Printflächen: ${product.printAreas.join(", ")}`);
  }

  if (product.bestseller) {
    lines.push(
      `Bestseller${product.unitsSold ? ` · ${product.unitsSold} Einheiten` : ""}`,
    );
  }

  return lines;
}

/** Format catalog for Research Agent prompt — only real available variants. */
export function formatProductIntelligencePrompt(
  catalog: ProductIntelligenceCatalog,
): string {
  if (!catalog.commerceConnected || catalog.products.length === 0) {
    return [
      "## VERFÜGBARE PRODUKTE",
      "",
      "Commerce offline — keine Live-Produktdaten verfügbar.",
      "Empfehle KEINE konkreten Produkte, Farben oder Materialien ohne Katalogdaten.",
    ].join("\n");
  }

  const featured = [
    ...catalog.bestsellers,
    ...catalog.products.filter((p) => !p.bestseller),
  ]
    .filter(
      (p, index, arr) =>
        arr.findIndex((x) => x.productId === p.productId) === index,
    )
    .slice(0, 12);

  const lines = [
    "## VERFÜGBARE PRODUKTE",
    "",
    "WICHTIG: Empfehle ausschließlich verfügbare Varianten aus diesem Katalog.",
    "Erfinde KEINE Produkte, Farben, Größen oder Materialien.",
    "",
  ];

  for (const product of featured) {
    lines.push(...formatProductBlock(product), "");
  }

  if (catalog.allColors.length > 0) {
    lines.push(
      "Verfügbare Farben (gesamt):",
      ...catalog.allColors.map((c) => `- ${c}`),
      "",
    );
  }

  if (catalog.bestsellers.length > 0) {
    lines.push(
      "Bestseller priorisieren:",
      ...catalog.bestsellers.map((p) => `- ${p.title}`),
    );
  }

  return lines.join("\n");
}

export function findProductByTitle(
  catalog: ProductIntelligenceCatalog,
  title: string,
): ProductIntelligence | undefined {
  const needle = normalize(title);
  return (
    catalog.products.find((p) => normalize(p.title) === needle) ??
    catalog.products.find(
      (p) =>
        normalize(p.title).includes(needle) || needle.includes(normalize(p.title)),
    )
  );
}

export function isColorAvailable(
  catalog: ProductIntelligenceCatalog,
  color: string,
  productTitle?: string,
): boolean {
  const needle = normalize(color);
  if (productTitle) {
    const product = findProductByTitle(catalog, productTitle);
    if (!product) return false;
    return product.availableColors.some((c) => normalize(c).includes(needle));
  }
  return catalog.allColors.some((c) => normalize(c).includes(needle));
}

export function isProductAvailable(
  catalog: ProductIntelligenceCatalog,
  title: string,
): boolean {
  return findProductByTitle(catalog, title) != null;
}

export function resolveAvailableProducts(
  catalog: ProductIntelligenceCatalog,
  suggestions: string[],
): string[] {
  const resolved: string[] = [];
  const seen = new Set<string>();

  for (const suggestion of suggestions) {
    const match = findProductByTitle(catalog, suggestion);
    const title = match?.title ?? suggestion;
    const key = normalize(title);
    if (seen.has(key)) continue;
    if (match) {
      seen.add(key);
      resolved.push(match.title);
    }
  }

  return resolved;
}

export function resolveAvailableColors(
  catalog: ProductIntelligenceCatalog,
  colors: string[],
  productTitles?: string[],
): string[] {
  const pool =
    productTitles && productTitles.length > 0
      ? uniqueSorted(
          productTitles.flatMap((title) => {
            const product = findProductByTitle(catalog, title);
            return product?.availableColors ?? [];
          }),
        )
      : catalog.allColors;

  const resolved: string[] = [];
  const seen = new Set<string>();

  for (const color of colors) {
    const needle = normalize(color);
    const match = pool.find(
      (c) => normalize(c) === needle || normalize(c).includes(needle),
    );
    if (match) {
      const key = normalize(match);
      if (!seen.has(key)) {
        seen.add(key);
        resolved.push(match);
      }
    }
  }

  return resolved;
}
