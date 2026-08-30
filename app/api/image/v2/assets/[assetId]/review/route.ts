import { jsonError, jsonOk, requirePersonaScope } from "@/app/api/persona/_utils";
import { reviewDeterministicAsset } from "@/lib/image/deterministic-runtime/service";

export async function POST(request: Request, context: { params: Promise<{ assetId: string }> }) {
  const gated = await requirePersonaScope();
  if (!gated.ok) return gated.response;
  try {
    const { assetId } = await context.params;
    return jsonOk({ success: true, asset: await reviewDeterministicAsset(gated.scope, assetId, await request.json()) });
  } catch (error) {
    return jsonError(error);
  }
}
