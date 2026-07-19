import { uploadReferenceAsset } from "@/lib/persona/services/persona-service";
import { referenceUploadMetaSchema } from "@/lib/persona/validation/schemas";
import { dict, jsonError, jsonOk, requirePersonaScope } from "../../_utils";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const gated = await requirePersonaScope();
  if (!gated.ok) return gated.response;
  try {
    const { id: personaId } = await context.params;
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return jsonOk({ error: dict.persona.errors.invalidRequest }, 400);
    }

    const metaParsed = referenceUploadMetaSchema.safeParse({
      asset_type: form.get("asset_type") ?? undefined,
      view_angle: form.get("view_angle") ?? undefined,
      framing: form.get("framing") ?? undefined,
      expression: form.get("expression") ?? undefined,
      body_visibility: form.get("body_visibility") ?? undefined,
      notes: form.get("notes") ?? undefined,
      source_type: form.get("source_type") ?? undefined,
      rights_confirmed:
        form.get("rights_confirmed") === "true" ||
        form.get("rights_confirmed") === "1",
    });
    if (!metaParsed.success) {
      return jsonOk(
        {
          error: dict.persona.errors.invalidRequest,
          details: metaParsed.error.flatten(),
        },
        400,
      );
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const asset = await uploadReferenceAsset(
      gated.scope,
      personaId,
      {
        filename: file.name || "reference.bin",
        mimeType: file.type || "application/octet-stream",
        bytes,
      },
      metaParsed.data,
    );
    return jsonOk({ success: true, asset }, 201);
  } catch (error) {
    return jsonError(error);
  }
}
