import { z } from "zod";

import { jsonError, jsonOk, requirePersonaScope } from "@/app/api/persona/_utils";
import { buildShopifyProductReferencePackage } from "@/lib/product-library/product-reference-package";
import { fetchShopifyProductDetail } from "@/lib/shopify/fetch-product-detail";

const requestSchema = z.object({
  authority: z.literal("SHOPIFY_LIVE"),
  productId: z.string().min(1),
}).strict();

/** Read-only Shopify media resolution. No remote bytes or Storage objects are created here. */
export async function POST(request: Request) {
  const gated = await requirePersonaScope();
  if (!gated.ok) return gated.response;
  try {
    const input = requestSchema.parse(await request.json());
    const product = await fetchShopifyProductDetail(input.productId);
    if (!product) return jsonError(new Error("Shopify product was not found."));
    return jsonOk({
      success: true,
      package: buildShopifyProductReferencePackage(product, new Date().toISOString()),
    });
  } catch (error) {
    return jsonError(error);
  }
}
