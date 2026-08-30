import { z } from "zod";
import {
  productProductionSelectionSchema,
  resolveProductProductionContext,
} from "@/lib/image/product-production-context";
import { fetchShopifyCatalog } from "@/lib/shopify/fetch-catalog";
import { jsonError, jsonOk, requirePersonaScope } from "@/app/api/persona/_utils";
import { logImageStudioTimings, timeImageStudioPhase, type ImageStudioTiming } from "@/lib/image/performance-diagnostics";

const resolveRequestSchema = z
  .object({
    selection: productProductionSelectionSchema,
  })
  .strict();

/** Server-verified, read-only Shopify selector data. No publishing or mutation. */
export async function GET() {
  const timings: ImageStudioTiming[] = [];
  const gated = await timeImageStudioPhase("owner-auth", requirePersonaScope, timings);
  if (!gated.ok) return gated.response;
  try {
    const catalog = await timeImageStudioPhase("shopify-catalog", fetchShopifyCatalog, timings);
    logImageStudioTimings("image-product-context", timings);
    return jsonOk({
      success: true,
      authority: "SHOPIFY_LIVE",
      capturedAt: new Date().toISOString(),
      products: catalog.products.map((product) => ({
        id: product.id,
        title: product.title,
        productType: product.productType,
        vendor: product.vendor ?? null,
        tags: product.tags,
        status: product.status,
        active: product.status.toUpperCase() === "ACTIVE",
        collections: product.collections,
        updatedAt: product.updatedAt,
        variantColors: product.variantColors,
        variantSizes: product.variantSizes,
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
