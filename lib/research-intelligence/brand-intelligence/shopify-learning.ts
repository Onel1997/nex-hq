import "server-only";

import { loadMilaeneCommerceBaseline } from "@/lib/commerce/milaene-commerce-baseline";
import type { ShopifyLearningContext } from "./types";

const EMPTY_LEARNING: ShopifyLearningContext = {
  loaded: false,
  productCount: 0,
  bestsellerTitles: [],
  collectionNames: [],
  tags: [],
  materials: [],
  titles: [],
  futureMetrics: {
    sales: false,
    ctr: false,
    conversion: false,
    returns: false,
    roas: false,
    favorites: false,
  },
};

/**
 * Loads Shopify catalog signals to improve Brand Fit scoring.
 * Performance metrics (sales, CTR, conversion, returns, ROAS) are architecture-only
 * until Shopify analytics APIs are connected — no invented data.
 */
export async function loadShopifyLearningContext(): Promise<ShopifyLearningContext> {
  try {
    const baseline = await loadMilaeneCommerceBaseline();
    const { knowledge, productKnowledge, commerceIntelligence } = baseline;

    const titles = knowledge.products.map((product) => product.title);
    const tags = [
      ...new Set(
        knowledge.products.flatMap((product) => product.tags ?? []),
      ),
    ];
    const materials = [
      ...new Set(
        knowledge.products.flatMap((product) => product.materials ?? []),
      ),
    ];
    const collectionNames = [
      ...new Set(
        knowledge.products.flatMap((product) => product.collections ?? []),
      ),
    ];

    const bestsellerTitles = commerceIntelligence.topUnits.length > 0
      ? commerceIntelligence.topUnits.map((unit) => unit.title)
      : productKnowledge.bestsellerCandidates.map((product) => product.title);

    return {
      loaded: true,
      productCount: knowledge.products.length,
      bestsellerTitles: bestsellerTitles.slice(0, 8),
      collectionNames: collectionNames.slice(0, 12),
      tags: tags.slice(0, 24),
      materials: materials.slice(0, 12),
      titles: titles.slice(0, 40),
      futureMetrics: {
        sales: false,
        ctr: false,
        conversion: false,
        returns: false,
        roas: false,
        favorites: false,
      },
    };
  } catch {
    return { ...EMPTY_LEARNING };
  }
}

export function emptyShopifyLearningContext(): ShopifyLearningContext {
  return { ...EMPTY_LEARNING };
}
