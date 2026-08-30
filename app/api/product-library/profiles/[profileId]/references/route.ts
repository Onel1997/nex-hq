import { jsonError, jsonOk, requirePersonaScope } from "@/app/api/persona/_utils";
import { addManualProductReference, toOwnerProductProfileView } from "@/lib/product-library/service";

export async function POST(request: Request, context: { params: Promise<{ profileId: string }> }) {
  const gated = await requirePersonaScope();
  if (!gated.ok) return gated.response;
  try {
    const { profileId } = await context.params;
    const form = await request.formData();
    const file = form.get("file");
    const expectedVersion = Number(form.get("expectedVersion"));
    const role = form.get("role");
    const altText = form.get("altText");
    const purpose = form.get("purpose");
    const familyColorKey = form.get("familyColorKey");
    const productSide = form.get("productSide");
    if (!(file instanceof File) || !Number.isInteger(expectedVersion) || typeof role !== "string") {
      return jsonOk({ success: false, error: "Datei, Referenzrolle und aktuelle Produktversion sind erforderlich." }, 400);
    }
    const profile = await addManualProductReference(gated.scope, profileId, {
      expectedVersion,
      role,
      bytes: Buffer.from(await file.arrayBuffer()),
      mimeType: file.type,
      altText: typeof altText === "string" ? altText : null,
      purpose:
        purpose === "BLANK_PRODUCT" ? "BLANK_PRODUCT" : "PRODUCT_REFERENCE",
      familyColorKey:
        typeof familyColorKey === "string" && familyColorKey
          ? familyColorKey
          : null,
      productSide:
        productSide === "FRONT" || productSide === "BACK"
          ? productSide
          : null,
    });
    return jsonOk({ success: true, profile: await toOwnerProductProfileView(gated.scope, profile) }, 201);
  } catch (error) {
    return jsonError(error);
  }
}
