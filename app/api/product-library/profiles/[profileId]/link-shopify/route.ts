import { jsonError, jsonOk, requirePersonaScope } from "@/app/api/persona/_utils";
import { linkManualProductToShopify, toOwnerProductProfileView } from "@/lib/product-library/service";

export async function POST(request: Request, context: { params: Promise<{ profileId: string }> }) {
  const gated = await requirePersonaScope();
  if (!gated.ok) return gated.response;
  try {
    const { profileId } = await context.params;
    const profile = await linkManualProductToShopify(gated.scope, profileId, await request.json());
    return jsonOk({ success: true, profile: await toOwnerProductProfileView(gated.scope, profile) });
  } catch (error) {
    return jsonError(error);
  }
}
