import { jsonError, jsonOk, requirePersonaScope } from "@/app/api/persona/_utils";
import { calibrateProductSurfaceRequestSchema, calibrateShopifyProductSurface, toProductProfileView } from "@/lib/product-library/calibration-service";

export async function POST(request: Request) {
  const gated = await requirePersonaScope();
  if (!gated.ok) return gated.response;
  try {
    const parsed = calibrateProductSurfaceRequestSchema.safeParse(await request.json());
    if (!parsed.success) return jsonOk({ success: false, error: "Exact Shopify Product, variant, and owner-defined PrintSurface geometry are required.", details: parsed.error.flatten() }, 400);
    const result = await calibrateShopifyProductSurface(gated.scope, parsed.data);
    return jsonOk({ success: true, profile: toProductProfileView(result.profile), productContext: result.productContext, productVisualInput: { ...result.productVisualInput, referencePackage: { ...result.productVisualInput.referencePackage, references: result.productVisualInput.referencePackage.references.map((reference) => ({ ...reference, privateStoragePath: null })) } }, printSurface: result.printSurface }, 201);
  } catch (error) {
    return jsonError(error);
  }
}
