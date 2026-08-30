import {
  jsonError,
  jsonOk,
  requirePersonaScope,
} from "@/app/api/persona/_utils";
import { DeterministicFakeVideoProvider } from "@/lib/video/fake-provider";
import { SupabaseVideoRepository } from "@/lib/video/supabase-repository";
import {
  confirmVideoJob,
  cancelVideoJob,
  executeFakeVideoJob,
  recoverVideoJob,
  reviewVideoAsset,
} from "@/lib/video/service";
import { persistVideoAsset, signVideoAsset } from "@/lib/video/storage";
import { toVideoAssetView, toVideoJobView } from "@/lib/video/types";
export async function GET(
  _: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const gated = await requirePersonaScope();
  if (!gated.ok) return gated.response;
  try {
    const { jobId } = await params;
    const recovery = await recoverVideoJob(
      gated.scope,
      jobId,
      new SupabaseVideoRepository(),
    );
    const access =
      recovery.asset && recovery.asset.mimeType.startsWith("video/")
        ? await signVideoAsset({
            workspaceId: gated.scope.workspaceId,
            path: recovery.asset.storagePath,
          }).catch(() => null)
        : null;
    return jsonOk({
      success: true,
      recovery: {
        ...recovery,
        job: toVideoJobView(recovery.job),
        asset: toVideoAssetView(recovery.asset),
        access,
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const gated = await requirePersonaScope();
  if (!gated.ok) return gated.response;
  try {
    const { jobId } = await params;
    const body = (await request.json()) as {
      action: string;
      inputFingerprint?: string;
      assetId?: string;
      decision?: "APPROVED" | "REJECTED";
      checklist?: unknown;
      note?: string | null;
    };
    const repository = new SupabaseVideoRepository();
    if (body.action === "confirm") {
      const job = await confirmVideoJob(
        gated.scope,
        jobId,
        body.inputFingerprint ?? "",
        { repository, now: () => new Date().toISOString() },
      );
      return jsonOk({ success: true, job: toVideoJobView(job) });
    }
    if (body.action === "cancel") {
      const job = await cancelVideoJob(gated.scope, jobId, {
        repository,
        now: () => new Date().toISOString(),
      });
      return jsonOk({ success: true, job: toVideoJobView(job) });
    }
    if (body.action === "execute_fake") {
      if (process.env.NODE_ENV === "production")
        return jsonOk(
          {
            success: false,
            error:
              "Synthetische Video-Ausführung ist in Produktion deaktiviert.",
          },
          403,
        );
      const result = await executeFakeVideoJob(
        gated.scope,
        jobId,
        body.inputFingerprint ?? "",
        {
          repository,
          provider: new DeterministicFakeVideoProvider(),
          persist: persistVideoAsset,
          now: () => new Date().toISOString(),
          id: crypto.randomUUID,
        },
      );
      return jsonOk({
        success: true,
        job: toVideoJobView(result.job),
        asset: toVideoAssetView(result.asset),
      });
    }
    if (body.action === "review" && body.assetId && body.decision) {
      const asset = await reviewVideoAsset(
        gated.scope,
        body.assetId,
        {
          decision: body.decision,
          checklist: body.checklist,
          note: body.note ?? null,
        },
        repository,
        () => new Date().toISOString(),
      );
      return jsonOk({ success: true, asset: toVideoAssetView(asset) });
    }
    return jsonOk({ success: false, error: "Ungültige Video-Aktion." }, 400);
  } catch (error) {
    return jsonError(error);
  }
}
