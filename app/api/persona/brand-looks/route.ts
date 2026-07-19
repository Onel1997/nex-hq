import {
  createBrandLook,
  listBrandLooks,
} from "@/lib/persona/services/persona-service";
import { createBrandLookSchema } from "@/lib/persona/validation/schemas";
import { dict, jsonError, jsonOk, requirePersonaScope } from "../_utils";

export async function GET() {
  const gated = await requirePersonaScope();
  if (!gated.ok) return gated.response;
  try {
    return jsonOk({ brand_looks: await listBrandLooks(gated.scope) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  const gated = await requirePersonaScope();
  if (!gated.ok) return gated.response;
  try {
    const body = await request.json();
    const parsed = createBrandLookSchema.safeParse(body);
    if (!parsed.success) {
      return jsonOk(
        { error: dict.persona.errors.invalidRequest, details: parsed.error.flatten() },
        400,
      );
    }
    const brand_look = await createBrandLook(gated.scope, parsed.data);
    return jsonOk({ success: true, brand_look }, 201);
  } catch (error) {
    return jsonError(error);
  }
}
