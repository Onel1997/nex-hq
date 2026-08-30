import { jsonError, jsonOk, requirePersonaScope } from "@/app/api/persona/_utils";
import { addProductFamilyColor, toOwnerProductProfileView } from "@/lib/product-library/service";

export async function POST(
  request: Request,
  context: { params: Promise<{ profileId: string }> },
) {
  const gated = await requirePersonaScope();
  if (!gated.ok) return gated.response;
  try {
    const { profileId } = await context.params;
    const profile = await addProductFamilyColor(
      gated.scope,
      profileId,
      await request.json(),
    );
    return jsonOk(
      { success: true, profile: await toOwnerProductProfileView(gated.scope, profile) },
      201,
    );
  } catch (error) {
    return jsonError(error);
  }
}
