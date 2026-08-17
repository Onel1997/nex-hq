import { z } from "zod";
import {
  productProductionSelectionSchema,
  resolveProductProductionContext,
} from "@/lib/image/product-production-context";
import { fetchShopifyCatalog } from "@/lib/shopify/fetch-catalog";
import { jsonError, jsonOk, requirePersonaScope } from "@/app/api/persona/_utils";

const resolveRequestSchema = z
  .object({
    selection: productProductionSelectionSchema,
  })
  .strict();

/** Server-verified, read-only Shopify selector data. No publishing or mutation. */
export async function GET() {
  const gated = await requirePersonaScope();
  if (!gated.ok) return gated.response;
  try {
    const catalog = await fetchShopifyCatalog();
    return jsonOk({
      success: true,
      authority: "SHOPIFY_LIVE",
      capturedAt: new Date().toISOString(),
      products: catalog.products.map((product) => ({
        id: product.id,
        title: product.title,
        productType: product.productType,
        status: product.status,
        active: product.status.toUpperCase() === "ACTIVE",
        collections: product.collections,
        updatedAt: product.updatedAt,
        variants: product.variants.map((variant) => ({
          id: variant.id,
          title: variant.title,
          availableForSale: variant.availableForSale,
          selectedOptions: variant.selectedOptions,
          updatedAt: variant.updatedAt,
        })),
      })),
    });
  } catch (error) {
    return jsonError(error);
  }
}

/** Resolve a live Shopify product + variant into canonical production context. */
export async function POST(request: Request) {
  const gated = await requirePersonaScope();
  if (!gated.ok) return gated.response;
  try {
    const body = resolveRequestSchema.parse(await request.json());
    const context = await resolveProductProductionContext(body.selection);
    return jsonOk({
      success: true,
      context,
    });
  } catch (error) {
    return jsonError(error);
  }
}
