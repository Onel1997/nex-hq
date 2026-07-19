import {
  createCameraPreset,
  listCameraPresets,
} from "@/lib/persona/services/persona-service";
import { createCameraPresetSchema } from "@/lib/persona/validation/schemas";
import { dict, jsonError, jsonOk, requirePersonaScope } from "../_utils";

export async function GET() {
  const gated = await requirePersonaScope();
  if (!gated.ok) return gated.response;
  try {
    return jsonOk({ camera_presets: await listCameraPresets(gated.scope) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  const gated = await requirePersonaScope();
  if (!gated.ok) return gated.response;
  try {
    const body = await request.json();
    const parsed = createCameraPresetSchema.safeParse(body);
    if (!parsed.success) {
      return jsonOk(
        { error: dict.persona.errors.invalidRequest, details: parsed.error.flatten() },
        400,
      );
    }
    const camera_preset = await createCameraPreset(gated.scope, parsed.data);
    return jsonOk({ success: true, camera_preset }, 201);
  } catch (error) {
    return jsonError(error);
  }
}
