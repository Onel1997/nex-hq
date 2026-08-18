import {
  jsonError,
  jsonOk,
  requirePersonaScope,
} from "@/app/api/persona/_utils";
import { renameApprovedMasterArtworkDisplayName } from "@/lib/design/master-artwork-authority/service";
import { toApprovedMasterArtworkView } from "@/lib/design/master-artwork-authority/types";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ artworkId: string }> },
) {
  const gated = await requirePersonaScope();
  if (!gated.ok) return gated.response;

  try {
    const { artworkId } = await context.params;
    const body = (await request.json()) as { displayName?: unknown };
    const artwork = await renameApprovedMasterArtworkDisplayName(
      gated.scope,
      artworkId,
      typeof body.displayName === "string" ? body.displayName : "",
    );
    return jsonOk({
      success: true,
      artwork: toApprovedMasterArtworkView(artwork),
    });
  } catch (error) {
    return jsonError(error);
  }
}
