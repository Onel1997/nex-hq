import {
  jsonError,
  jsonOk,
  requirePersonaScope,
} from "@/app/api/persona/_utils";
import { renameApprovedMasterArtworkDisplayName } from "@/lib/design/master-artwork-authority/service";
import { toApprovedMasterArtworkView } from "@/lib/design/master-artwork-authority/types";
import { SupabaseMasterArtworkAuthorityRepository } from "@/lib/design/master-artwork-authority/supabase-repository";
import { downloadApprovedMasterArtwork } from "@/lib/design/master-artwork-authority/storage";
import { PersonaDomainError } from "@/lib/persona/domain/errors";

export const runtime = "nodejs";

/** Authenticated, workspace-scoped preview of canonical private Artwork bytes. */
export async function GET(
  _request: Request,
  context: { params: Promise<{ artworkId: string }> },
) {
  const gated = await requirePersonaScope();
  if (!gated.ok) return gated.response;

  try {
    const { artworkId } = await context.params;
    const artwork = await new SupabaseMasterArtworkAuthorityRepository().get(
      gated.scope,
      artworkId,
    );
    if (!artwork || artwork.status !== "APPROVED") {
      throw new PersonaDomainError(
        "Approved Master Artwork was not found.",
        "NOT_FOUND",
      );
    }
    const bytes = await downloadApprovedMasterArtwork({
      workspaceId: gated.scope.workspaceId,
      storagePath: artwork.storagePath,
      expectedChecksum: artwork.checksum,
      expectedByteLength: artwork.byteLength,
    });
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": artwork.mimeType,
        "Content-Length": String(bytes.length),
        "Cache-Control": "private, no-store",
        ETag: `"${artwork.checksum}"`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}

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
