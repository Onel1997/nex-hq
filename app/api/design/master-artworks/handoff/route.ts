import {
  jsonError,
  jsonOk,
  requirePersonaScope,
} from "@/app/api/persona/_utils";
import { resolveApprovedMasterArtworkForHandoff } from "@/lib/design/master-artwork-authority/service";
import {
  masterArtworkHandoffRequestSchema,
  toApprovedMasterArtworkView,
} from "@/lib/design/master-artwork-authority/types";
import { PersonaDomainError } from "@/lib/persona/domain/errors";

export const runtime = "nodejs";

/**
 * Resolves an already-approved durable Artwork for Image Studio handoff.
 * This endpoint accepts JSON identity only; it never uploads or duplicates bytes.
 */
export async function POST(request: Request) {
  const requestId = crypto.randomUUID().slice(0, 8);
  const gated = await requirePersonaScope();
  if (!gated.ok) return gated.response;

  try {
    const parsed = masterArtworkHandoffRequestSchema.safeParse(await request.json());
    if (!parsed.success) {
      throw new PersonaDomainError(
        "Invalid approved Artwork handoff request.",
        "WORKFLOW",
        { requestId, stage: "request_validation" },
      );
    }
    console.info(`[Design Artwork handoff ${requestId}] Authority resolution started`, {
      operation: "authority_resolve",
      artworkId: parsed.data.artworkId,
      workspaceId: gated.scope.workspaceId,
    });
    const artwork = await resolveApprovedMasterArtworkForHandoff(
      gated.scope,
      parsed.data.artworkId,
    );
    console.info(`[Design Artwork handoff ${requestId}] Authority resolved`, {
      operation: "authority_resolve",
      artworkId: artwork.id,
      designId: artwork.designId,
      version: artwork.version,
    });
    return jsonOk({
      success: true,
      requestId,
      artwork: toApprovedMasterArtworkView(artwork),
    });
  } catch (error) {
    console.error(`[Design Artwork handoff ${requestId}] Authority resolution failed`, {
      operation: "authority_resolve",
      message: error instanceof Error ? error.message : "unknown",
      code: error instanceof PersonaDomainError ? error.code : "UPSTREAM_ERROR",
    });
    if (error instanceof PersonaDomainError) {
      return jsonError(
        new PersonaDomainError(error.message, error.code, {
          ...error.details,
          requestId,
          stage: error.details?.stage ?? "authority_resolve",
        }),
      );
    }
    return jsonOk(
      {
        success: false,
        error: error instanceof Error ? error.message : "Artwork handoff failed.",
        code: "UPSTREAM_ERROR",
        stage: "authority_resolve",
        requestId,
      },
      500,
    );
  }
}
