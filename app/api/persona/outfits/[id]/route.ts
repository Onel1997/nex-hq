import {
  deleteOutfit,
  getOutfit,
  updateOutfit,
} from "@/lib/persona/services/persona-service";
import { updateOutfitSchema } from "@/lib/persona/validation/schemas";
import { dict, jsonError, jsonOk, requirePersonaScope } from "../../_utils";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const gated = await requirePersonaScope();
  if (!gated.ok) return gated.response;
  try {
    const { id } = await context.params;
    return jsonOk({ outfit: await getOutfit(gated.scope, id) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const gated = await requirePersonaScope();
  if (!gated.ok) return gated.response;
  try {
    const { id } = await context.params;
    const body = await request.json();
    const parsed = updateOutfitSchema.safeParse(body);
    if (!parsed.success) {
      return jsonOk(
        { error: dict.persona.errors.invalidRequest, details: parsed.error.flatten() },
        400,
      );
    }
    const outfit = await updateOutfit(gated.scope, id, parsed.data);
    return jsonOk({ success: true, outfit });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const gated = await requirePersonaScope();
  if (!gated.ok) return gated.response;
  try {
    const { id } = await context.params;
    const impact = await deleteOutfit(gated.scope, id);
    return jsonOk({ success: true, delete_impact: impact });
  } catch (error) {
    return jsonError(error);
  }
}
