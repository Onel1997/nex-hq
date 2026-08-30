import {
  jsonError,
  jsonOk,
  requirePersonaScope,
} from "@/app/api/persona/_utils";
import {
  resolveStageABasePreviewSource,
  toStageABasePreviewView,
} from "@/lib/image/deterministic-runtime/base-preview";
import { getDeterministicRecovery } from "@/lib/image/deterministic-runtime/service";
import { loadDeterministicImageObject } from "@/lib/image/deterministic-runtime/storage";
import { PersonaDomainError } from "@/lib/persona/domain/errors";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ jobId: string }> },
) {
  const gated = await requirePersonaScope();
  if (!gated.ok) return gated.response;
  try {
    const { jobId } = await context.params;
    const recovery = await getDeterministicRecovery(gated.scope, jobId);
    const source = resolveStageABasePreviewSource(recovery);
    if (!source) {
      throw new PersonaDomainError(
        "Für diesen Auftrag ist kein gespeichertes Stage-A-Basisbild verfügbar.",
        "NOT_FOUND",
      );
    }
    const content = new URL(request.url).searchParams.get("content");
    if (content === "image" || content === "mask") {
      const selected = content === "mask" ? source.segmentationMask : source;
      if (!selected) {
        throw new PersonaDomainError(
          "Für diesen Auftrag ist keine gespeicherte Kleidungsmaske verfügbar.",
          "NOT_FOUND",
        );
      }
      const bytes = await loadDeterministicImageObject({
        workspaceId: recovery.job.workspaceId,
        path: selected.storagePath,
        expectedChecksum: selected.checksumSha256,
      });
      return new Response(new Uint8Array(bytes), {
        status: 200,
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": "private, no-store, no-cache, must-revalidate",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
    return jsonOk({
      success: true,
      preview: toStageABasePreviewView(
        source,
        `/api/image/v2/jobs/${encodeURIComponent(jobId)}/base-preview?content=image`,
        source.segmentationMask
          ? `/api/image/v2/jobs/${encodeURIComponent(jobId)}/base-preview?content=mask`
          : null,
      ),
    });
  } catch (error) {
    return jsonError(error);
  }
}
