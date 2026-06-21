import { loadShopifyKnowledgeSafe } from "@/lib/shopify/knowledge";
import {
  buildProductKnowledge,
  emptyProductKnowledge,
} from "@/lib/shopify/product-knowledge";
import type { ProductKnowledge, ShopifyKnowledge } from "@/lib/shopify/types";

export interface ShopifyAgentContext {
  knowledge: ShopifyKnowledge;
  productKnowledge: ProductKnowledge;
}

/** Load Shopify knowledge for agent pipelines (never throws). */
export async function loadShopifyAgentContext(): Promise<ShopifyAgentContext> {
  const knowledge = await loadShopifyKnowledgeSafe();
  const productKnowledge =
    knowledge.products.length > 0
      ? buildProductKnowledge(knowledge)
      : emptyProductKnowledge();

  return { knowledge, productKnowledge };
}
