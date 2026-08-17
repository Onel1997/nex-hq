import { jsonError, jsonOk, requirePersonaScope } from "@/app/api/persona/_utils";
import {
  reviewImageProductionAssetRequestSchema,
} from "@/lib/image/production-project/types";
import { reviewImageProductionAsset } from "@/lib/image/production-project/service";

export async function POST(
  request: Request,
  context: { params: Promise<{ assetId: string }> },
) {
  const gated = await requirePersonaScope();
  if (!gated.ok) return gated.response;
  try {
    const parsed = reviewImageProductionAssetRequestSchema.safeParse(
      await request.json(),
    );
    if (!parsed.success) {
      return jsonOk(
        {
          success: false,
          error: "Invalid human Image asset review.",
          details: parsed.error.flatten(),
        },
        400,
      );
    }
    const { assetId } = await context.params;
    const asset = await reviewImageProductionAsset(
      gated.scope,
      assetId,
      parsed.data.reviewStatus,
      parsed.data.note,
    );
    const { storagePath: _private, ...view } = asset;
    void _private;
    return jsonOk({ success: true, asset: view });
  } catch (error) {
    return jsonError(error);
  }
}
