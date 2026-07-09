/** Client-safe commerce merge helpers — no server-only imports. */

import type { CommerceIntelligence } from "@/lib/shopify/commerce-intelligence-types";
import type { ShopifyKnowledge, ShopifyKnowledgeProduct } from "@/lib/shopify/types";

export function mergeHistoricalProducts(
  knowledge: ShopifyKnowledge,
  commerce: CommerceIntelligence,
): ShopifyKnowledgeProduct[] {
  const merged = new Map(knowledge.products.map((p) => [p.id, p]));

  for (const record of commerce.products) {
    if (merged.has(record.productId)) continue;
    merged.set(record.productId, {
      id: record.productId,
      title: record.title,
      handle: record.productId.split("/").pop() ?? record.productId,
      status: "ARCHIVED",
      productType: record.productType,
      price: "0",
      currency: record.currency,
      inventory: 0,
      collections: record.collections,
      tags: ["historical-sales"],
      colors: [],
      sizes: [],
      materials: [],
    });
  }

  return [...merged.values()];
}
