import { fetchShopifyCatalog } from "@/lib/shopify/fetch-catalog";
import { jsonError, jsonOk, requirePersonaScope } from "@/app/api/persona/_utils";

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
