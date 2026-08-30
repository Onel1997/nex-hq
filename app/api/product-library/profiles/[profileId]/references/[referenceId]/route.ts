import { jsonError, jsonOk, requirePersonaScope } from "@/app/api/persona/_utils";
import { assignProductReferenceRole, toOwnerProductProfileView } from "@/lib/product-library/service";

export async function PATCH(request: Request, context: { params: Promise<{ profileId: string; referenceId: string }> }) {
  const gated = await requirePersonaScope();
  if (!gated.ok) return gated.response;
  try {
    const { profileId, referenceId } = await context.params;
    const profile = await assignProductReferenceRole(gated.scope, profileId, referenceId, await request.json());
    return jsonOk({ success: true, profile: await toOwnerProductProfileView(gated.scope, profile) });
  } catch (error) {
    return jsonError(error);
  }
}
