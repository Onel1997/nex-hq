/**
 * Shopify Agent — storefront drafts grounded in Brain intelligence.
 */

export { runShopify, ShopifyKnowledgeError } from "./run";
export { parseShopifyOutput, ShopifyParseError } from "./parse-output";
export { enrichShopifyPayload } from "./enrich-output";
export { saveShopifyToBrain } from "./save";
export { retrieveShopifyKnowledge } from "./retrieve-context";
export {
  createProductDraft,
  updateCollection,
  publishProduct,
} from "./operations";
export type {
  ShopifyRunInput,
  ShopifyRunResult,
  ShopifyOutput,
  ShopifyProduct,
  ShopifyProductVariant,
} from "./types";
