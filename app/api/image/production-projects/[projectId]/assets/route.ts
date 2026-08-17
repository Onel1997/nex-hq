import { jsonError, jsonOk, requirePersonaScope } from "@/app/api/persona/_utils";
import { listImageProductionAssets } from "@/lib/image/production-project/service";

export async function GET(
  _request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  const gated = await requirePersonaScope();
  if (!gated.ok) return gated.response;
  try {
    const { projectId } = await context.params;
    return jsonOk({
      success: true,
      assets: await listImageProductionAssets(gated.scope, projectId),
    });
  } catch (error) {
    return jsonError(error);
  }
}
