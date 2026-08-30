import {
  approveDurableMasterArtwork,
} from "@/lib/design/master-artwork-authority/service";
import { parseApproveMasterArtworkBody } from "@/lib/design/master-artwork-authority/request";
import { toApprovedMasterArtworkView } from "@/lib/design/master-artwork-authority/types";
import { SupabaseMasterArtworkAuthorityRepository } from "@/lib/design/master-artwork-authority/supabase-repository";
import { jsonError, jsonOk, requirePersonaScope } from "@/app/api/persona/_utils";
import { PersonaDomainError } from "@/lib/persona/domain/errors";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const gated = await requirePersonaScope();
  if (!gated.ok) return gated.response;
  try {
    const designId = new URL(request.url).searchParams.get("designId") ?? undefined;
    const records = await new SupabaseMasterArtworkAuthorityRepository().list(
      gated.scope,
      designId,
    );
    return jsonOk({
      success: true,
      artworks: records.map(toApprovedMasterArtworkView),
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID().slice(0, 8);
  const gated = await requirePersonaScope();
  if (!gated.ok) return gated.response;

  const parsed = await parseApproveMasterArtworkBody(request);
  if (!parsed.ok) {
    console.warn(`[Design Master Artwork ${requestId}] Request rejected`, {
      stage: parsed.stage,
      code: parsed.code,
      status: parsed.status,
    });
    return jsonOk(
      {
        success: false,
        error: parsed.error,
        code: parsed.code,
        stage: parsed.stage,
        requestId,
        details: parsed.details,
      },
      parsed.status,
    );
  }

  try {
    const { meta, bytes } = parsed;
    console.info(`[Design Master Artwork ${requestId}] Approval started`, {
      designId: meta.designId,
      version: meta.version,
      mimeType: meta.mimeType,
      byteLength: bytes.length,
      transport:
        (request.headers.get("content-type") ?? "").includes("multipart/form-data")
          ? "multipart"
          : (request.headers.get("content-type") ?? "").startsWith("image/")
            ? "binary"
            : "json",
    });

    const artwork = await approveDurableMasterArtwork(gated.scope, meta, bytes);
    console.info(`[Design Master Artwork ${requestId}] Approval persisted`, {
      artworkId: artwork.id,
      checksum: artwork.checksum,
      byteLength: artwork.byteLength,
    });
    return jsonOk(
      { success: true, requestId, artwork: toApprovedMasterArtworkView(artwork) },
      201,
    );
  } catch (error) {
    console.error(`[Design Master Artwork ${requestId}] Approval failed`, {
      message: error instanceof Error ? error.message : "unknown",
      code: error instanceof Error && "code" in error ? error.code : undefined,
    });
    if (error instanceof PersonaDomainError) {
      return jsonError(
        new PersonaDomainError(error.message, error.code, {
          ...error.details,
          requestId,
          stage: "approval_persist",
        }),
      );
    }
    return jsonOk(
      {
        success: false,
        error: error instanceof Error ? error.message : "Artwork approval failed.",
        code: "UPSTREAM_ERROR",
        stage: "approval_persist",
        requestId,
      },
      500,
    );
  }
}
