import { jsonError, jsonOk, requirePersonaScope } from "@/app/api/persona/_utils";
import {
  correctProductFamilyPlacement,
  saveProductFamilyPlacementOverlay,
  toOwnerProductProfileView,
} from "@/lib/product-library/service";

export async function POST(
  request: Request,
  context: { params: Promise<{ profileId: string }> },
) {
  const gated = await requirePersonaScope();
  if (!gated.ok) return gated.response;
  try {
    const { profileId } = await context.params;
    const form = await request.formData();
    const file = form.get("file");
    const expectedVersion = Number(form.get("expectedVersion"));
    const side = form.get("side");
    if (
      !(file instanceof File) ||
      !Number.isInteger(expectedVersion) ||
      (side !== "FRONT" && side !== "BACK")
    ) {
      return jsonOk(
        { success: false, error: "Bild, Seite und aktuelle Produktversion sind erforderlich." },
        400,
      );
    }
    const result = await saveProductFamilyPlacementOverlay(gated.scope, profileId, {
      expectedVersion,
      side,
      bytes: Buffer.from(await file.arrayBuffer()),
      mimeType: file.type,
    });
    return jsonOk(
      {
        success: true,
        profile: await toOwnerProductProfileView(gated.scope, result.profile),
        template: result.template,
      },
      201,
    );
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ profileId: string }> },
) {
  const gated = await requirePersonaScope();
  if (!gated.ok) return gated.response;
  try {
    const { profileId } = await context.params;
    const result = await correctProductFamilyPlacement(
      gated.scope,
      profileId,
      await request.json(),
    );
    return jsonOk({
      success: true,
      profile: await toOwnerProductProfileView(gated.scope, result.profile),
      template: result.template,
    });
  } catch (error) {
    return jsonError(error);
  }
}
