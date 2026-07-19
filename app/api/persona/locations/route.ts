import {
  createLocation,
  listLocations,
} from "@/lib/persona/services/persona-service";
import { createLocationSchema } from "@/lib/persona/validation/schemas";
import { dict, jsonError, jsonOk, requirePersonaScope } from "../_utils";

export async function GET() {
  const gated = await requirePersonaScope();
  if (!gated.ok) return gated.response;
  try {
    return jsonOk({ locations: await listLocations(gated.scope) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  const gated = await requirePersonaScope();
  if (!gated.ok) return gated.response;
  try {
    const body = await request.json();
    const parsed = createLocationSchema.safeParse(body);
    if (!parsed.success) {
      return jsonOk(
        { error: dict.persona.errors.invalidRequest, details: parsed.error.flatten() },
        400,
      );
    }
    const location = await createLocation(gated.scope, parsed.data);
    return jsonOk({ success: true, location }, 201);
  } catch (error) {
    return jsonError(error);
  }
}
