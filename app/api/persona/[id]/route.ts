import {
  deletePersona,
  getPersona,
  getPersonaReadiness,
  listReferenceAssetViews,
  resolvePersonaRelations,
  setPersonaRelations,
  transitionPersona,
  updatePersona,
} from "@/lib/persona/services/persona-service";
import {
  setPersonaRelationsSchema,
  updatePersonaSchema,
} from "@/lib/persona/validation/schemas";
import { z } from "zod";
import { dict, jsonError, jsonOk, requirePersonaScope } from "../_utils";

const transitionSchema = z.object({
  action: z.enum(["submit_review", "approve", "archive", "reopen_draft"]),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const gated = await requirePersonaScope();
  if (!gated.ok) return gated.response;
  try {
    const { id } = await context.params;
    const [persona, relations, readiness, references] = await Promise.all([
      getPersona(gated.scope, id),
      resolvePersonaRelations(gated.scope, id),
      getPersonaReadiness(gated.scope, id),
      listReferenceAssetViews(gated.scope, id),
    ]);
    return jsonOk({ persona, relations, readiness, references });
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

    if (body && typeof body === "object" && "action" in body) {
      const parsed = transitionSchema.safeParse(body);
      if (!parsed.success) {
        return jsonOk(
          { error: dict.persona.errors.invalidRequest, details: parsed.error.flatten() },
          400,
        );
      }
      const persona = await transitionPersona(gated.scope, id, parsed.data.action);
      return jsonOk({ success: true, persona });
    }

    if (body && typeof body === "object" && "kind" in body && "ids" in body) {
      const parsed = setPersonaRelationsSchema.safeParse(body);
      if (!parsed.success) {
        return jsonOk(
          { error: dict.persona.errors.invalidRequest, details: parsed.error.flatten() },
          400,
        );
      }
      const persona = await setPersonaRelations(
        gated.scope,
        id,
        parsed.data.kind,
        parsed.data.ids,
      );
      return jsonOk({ success: true, persona });
    }

    const parsed = updatePersonaSchema.safeParse(body);
    if (!parsed.success) {
      return jsonOk(
        { error: dict.persona.errors.invalidRequest, details: parsed.error.flatten() },
        400,
      );
    }
    const persona = await updatePersona(gated.scope, id, parsed.data);
    return jsonOk({ success: true, persona });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const gated = await requirePersonaScope();
  if (!gated.ok) return gated.response;
  try {
    const { id } = await context.params;
    await deletePersona(gated.scope, id);
    return jsonOk({ success: true });
  } catch (error) {
    return jsonError(error);
  }
}
