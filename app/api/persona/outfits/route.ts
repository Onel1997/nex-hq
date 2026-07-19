import {
  createOutfit,
  listOutfits,
} from "@/lib/persona/services/persona-service";
import { createOutfitSchema } from "@/lib/persona/validation/schemas";
import { dict, jsonError, jsonOk, requirePersonaScope } from "../_utils";

export async function GET() {
  const gated = await requirePersonaScope();
  if (!gated.ok) return gated.response;
  try {
    return jsonOk({ outfits: await listOutfits(gated.scope) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  const gated = await requirePersonaScope();
  if (!gated.ok) return gated.response;
  try {
    const body = await request.json();
    const parsed = createOutfitSchema.safeParse(body);
    if (!parsed.success) {
      return jsonOk(
        { error: dict.persona.errors.invalidRequest, details: parsed.error.flatten() },
        400,
      );
    }
    const outfit = await createOutfit(gated.scope, parsed.data);
    return jsonOk({ success: true, outfit }, 201);
  } catch (error) {
    return jsonError(error);
  }
}
