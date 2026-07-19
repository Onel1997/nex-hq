import {
  createPersona,
  getPersonaDashboardCounts,
  getPersonaStudioSnapshot,
  listPersonas,
} from "@/lib/persona/services/persona-service";
import { createPersonaSchema } from "@/lib/persona/validation/schemas";
import { dict, jsonError, jsonOk, requirePersonaScope } from "./_utils";

export async function GET() {
  const gated = await requirePersonaScope();
  if (!gated.ok) return gated.response;
  try {
    const [personas, counts, snapshot] = await Promise.all([
      listPersonas(gated.scope),
      getPersonaDashboardCounts(gated.scope),
      getPersonaStudioSnapshot(gated.scope),
    ]);
    return jsonOk({ personas, counts, snapshot });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  const gated = await requirePersonaScope();
  if (!gated.ok) return gated.response;
  try {
    const body = await request.json();
    const parsed = createPersonaSchema.safeParse(body);
    if (!parsed.success) {
      return jsonOk(
        { error: dict.persona.errors.invalidRequest, details: parsed.error.flatten() },
        400,
      );
    }
    const persona = await createPersona(gated.scope, parsed.data);
    return jsonOk({ success: true, persona }, 201);
  } catch (error) {
    return jsonError(error);
  }
}
