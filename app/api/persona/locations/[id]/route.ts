import {
  deleteLocation,
  getLocation,
  previewLocationDelete,
  updateLocation,
} from "@/lib/persona/services/persona-service";
import { updateLocationSchema } from "@/lib/persona/validation/schemas";
import { dict, jsonError, jsonOk, requirePersonaScope } from "../../_utils";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const gated = await requirePersonaScope();
  if (!gated.ok) return gated.response;
  try {
    const { id } = await context.params;
    const location = await getLocation(gated.scope, id);
    const impact = await previewLocationDelete(gated.scope, id);
    return jsonOk({ location, delete_impact: impact });
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
    const parsed = updateLocationSchema.safeParse(body);
    if (!parsed.success) {
      return jsonOk(
        { error: dict.persona.errors.invalidRequest, details: parsed.error.flatten() },
        400,
      );
    }
    const location = await updateLocation(gated.scope, id, parsed.data);
    return jsonOk({ success: true, location });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const gated = await requirePersonaScope();
  if (!gated.ok) return gated.response;
  try {
    const { id } = await context.params;
    const impact = await deleteLocation(gated.scope, id);
    return jsonOk({ success: true, delete_impact: impact });
  } catch (error) {
    return jsonError(error);
  }
}
