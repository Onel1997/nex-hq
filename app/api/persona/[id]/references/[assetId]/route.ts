import {
  deleteReferenceAsset,
  updateReferenceAsset,
} from "@/lib/persona/services/persona-service";
import { updateReferenceAssetSchema } from "@/lib/persona/validation/schemas";
import { dict, jsonError, jsonOk, requirePersonaScope } from "../../../_utils";

type RouteContext = { params: Promise<{ id: string; assetId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const gated = await requirePersonaScope();
  if (!gated.ok) return gated.response;
  try {
    const { assetId } = await context.params;
    const body = await request.json();
    const parsed = updateReferenceAssetSchema.safeParse(body);
    if (!parsed.success) {
      return jsonOk(
        {
          error: dict.persona.errors.invalidRequest,
          details: parsed.error.flatten(),
        },
        400,
      );
    }
    const asset = await updateReferenceAsset(gated.scope, assetId, parsed.data);
    return jsonOk({ success: true, asset });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const gated = await requirePersonaScope();
  if (!gated.ok) return gated.response;
  try {
    const { assetId } = await context.params;
    await deleteReferenceAsset(gated.scope, assetId);
    return jsonOk({ success: true });
  } catch (error) {
    return jsonError(error);
  }
}
