import { buildDesignIntelligenceDashboard } from "@/lib/design/product-intelligence";
import type { MilaeneCommerceBaseline } from "@/lib/commerce/milaene-commerce-baseline";
import { MILAENE_DNA } from "@/services/milaene-dna";

export interface ProductIntelligence {
  bestsellers: string[];
  weakProducts: string[];
  opportunities: string[];
  categories: string[];
  colors: string[];
  salesTrends: string[];
  podProducts: string[];
}

const MILAENE_PRODUCT_DEFAULTS = {
  bestsellers: ["Faith Oversized Tee", "Dream Oversized Tee"],
  weakProducts: ["Shorts", "Accessories"],
  opportunities: ["Heavy Hoodies", "Caps", "Embroidery", "Outerwear"],
  categories: ["Hoodies", "Tees", "Cargos", "Caps", "Outerwear"],
  colors: MILAENE_DNA.colors.map(
    (c) => c.charAt(0).toUpperCase() + c.slice(1),
  ),
};

function mergeUnique(primary: string[], fallback: string[], limit = 5): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const item of [...primary, ...fallback]) {
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
    if (result.length >= limit) break;
  }

  return result;
}

export interface ProductAnalyzerInput {
  baseline?: MilaeneCommerceBaseline | null;
}

/** Analyze Milaene product performance, gaps, and POD catalog fit. */
export function analyzeProducts(input: ProductAnalyzerInput = {}): ProductIntelligence {
  const { baseline } = input;

  if (!baseline) {
    return {
      ...MILAENE_PRODUCT_DEFAULTS,
      salesTrends: [
        "Faith Tee — starke Einheiten pro Drop",
        "Dream Tee — konstante Nachfrage",
        "Hoodies — Wachstumspotenzial",
      ],
      podProducts: ["Premium Hoodie", "Oversized Tee", "Structured Cap"],
    };
  }

  const { productKnowledge, commerceIntelligence, marketPrintIntelligence } =
    baseline;

  const designIntel = buildDesignIntelligenceDashboard(
    baseline.knowledge.products,
    undefined,
    commerceIntelligence,
  );

  const commerceBestsellers =
    commerceIntelligence.topUnits.length > 0
      ? commerceIntelligence.topUnits.slice(0, 5).map((p) => p.title)
      : productKnowledge.bestsellerCandidates.slice(0, 5).map((p) => p.title);

  const weakFromCommerce = designIntel.lowestPerforming
    .slice(0, 4)
    .map((p) => p.title);

  const categoryGaps = productKnowledge.categoryGaps.slice(0, 4);
  const expansionInsights = baseline.insights
    .filter((i) => i.kind === "expansion" || i.kind === "marketprint")
    .slice(0, 3)
    .map((i) => i.message);

  const salesTrends = [
    commerceIntelligence.allTimeBestseller
      ? `${commerceIntelligence.allTimeBestseller.title} — Top-Nachfrage`
      : null,
    ...baseline.insights
      .filter((i) => i.kind === "bestseller" || i.kind === "category")
      .slice(0, 3)
      .map((i) => i.message),
  ].filter(Boolean) as string[];

  const podProducts = marketPrintIntelligence.catalogMatches
    .filter((m) => m.match.suitability >= 75)
    .slice(0, 5)
    .map((m) => m.title);

  const colors =
    productKnowledge.availableColors.length > 0
      ? productKnowledge.availableColors.slice(0, 6)
      : MILAENE_PRODUCT_DEFAULTS.colors;

  const categories =
    productKnowledge.availableCategories.length > 0
      ? productKnowledge.availableCategories.slice(0, 6)
      : MILAENE_PRODUCT_DEFAULTS.categories;

  return {
    bestsellers: mergeUnique(
      commerceBestsellers,
      MILAENE_PRODUCT_DEFAULTS.bestsellers,
    ),
    weakProducts: mergeUnique(
      weakFromCommerce,
      MILAENE_PRODUCT_DEFAULTS.weakProducts,
      4,
    ),
    opportunities: mergeUnique(
      [...categoryGaps, ...expansionInsights],
      MILAENE_PRODUCT_DEFAULTS.opportunities,
      5,
    ),
    categories,
    colors,
    salesTrends:
      salesTrends.length > 0
        ? salesTrends
        : [
            "Faith Oversized Tee — Bestseller",
            "Dream Oversized Tee — stabil",
            "Heavy Hoodies — Chancenkategorie",
          ],
    podProducts:
      podProducts.length > 0
        ? podProducts
        : ["Premium Hoodie", "Oversized Tee", "Embroidery Crewneck"],
  };
}
