import { jsonError, jsonOk, requirePersonaScope } from "@/app/api/persona/_utils";
import { getProductProfile, toOwnerProductProfileView, updateProductKnowledge } from "@/lib/product-library/service";

export async function GET(request: Request, context: { params: Promise<{ profileId: string }> }) {
  const gated = await requirePersonaScope();
  if (!gated.ok) return gated.response;
  try {
    const { profileId } = await context.params;
    const versionParam = new URL(request.url).searchParams.get("version");
    const version = versionParam ? Number(versionParam) : undefined;
    const profile = await getProductProfile(gated.scope, profileId, Number.isInteger(version) ? version : undefined);
    if (!profile) return jsonOk({ success: false, error: "Produktprofil nicht gefunden." }, 404);
    return jsonOk({ success: true, profile: await toOwnerProductProfileView(gated.scope, profile) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ profileId: string }> }) {
  const gated = await requirePersonaScope();
  if (!gated.ok) return gated.response;
  try {
    const { profileId } = await context.params;
    const profile = await updateProductKnowledge(gated.scope, profileId, await request.json());
    return jsonOk({ success: true, profile: await toOwnerProductProfileView(gated.scope, profile) });
  } catch (error) {
    return jsonError(error);
  }
}
