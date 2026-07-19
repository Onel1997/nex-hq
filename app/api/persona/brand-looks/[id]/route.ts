import {
  deleteBrandLook,
  getBrandLook,
  updateBrandLook,
} from "@/lib/persona/services/persona-service";
import { updateBrandLookSchema } from "@/lib/persona/validation/schemas";
import { dict, jsonError, jsonOk, requirePersonaScope } from "../../_utils";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const gated = await requirePersonaScope();
  if (!gated.ok) return gated.response;
  try {
    const { id } = await context.params;
    return jsonOk({ brand_look: await getBrandLook(gated.scope, id) });
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
    const parsed = updateBrandLookSchema.safeParse(body);
    if (!parsed.success) {
      return jsonOk(
        { error: dict.persona.errors.invalidRequest, details: parsed.error.flatten() },
        400,
      );
    }
    const brand_look = await updateBrandLook(gated.scope, id, parsed.data);
    return jsonOk({ success: true, brand_look });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const gated = await requirePersonaScope();
  if (!gated.ok) return gated.response;
  try {
    const { id } = await context.params;
    const impact = await deleteBrandLook(gated.scope, id);
    return jsonOk({ success: true, delete_impact: impact });
  } catch (error) {
    return jsonError(error);
  }
}
