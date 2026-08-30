import { jsonError, jsonOk, requirePersonaScope } from "@/app/api/persona/_utils";
import { prepareDeterministicJobRequestSchema } from "@/lib/image/deterministic-runtime/prepare-types";
import {
  getDeterministicCompositeRetryEligibility,
  getDeterministicRecoveries,
  listDeterministicJobs,
  prepareDeterministicImageJob,
} from "@/lib/image/deterministic-runtime/service";
import { toDeterministicImageJobView } from "@/lib/image/deterministic-runtime/types";
import { createImageProductionAssetAccessBatch } from "@/lib/image/production-project/asset-access";
import { SupabaseMasterArtworkAuthorityRepository } from "@/lib/design/master-artwork-authority/supabase-repository";
import {
  sortPreviousRunsNewestFirst,
  toPreviousRunOwnerView,
} from "@/lib/image/deterministic-v2-panel/previous-runs";

export const runtime = "nodejs";

const HISTORY_LIMIT = 40;
const CONTENT_HISTORY_LIMIT = 100;
const DEFAULT_LIST_LIMIT = 50;

export async function GET(request: Request) {
  const gated = await requirePersonaScope();
  if (!gated.ok) return gated.response;
  try {
    const url = new URL(request.url);
    const projectId = url.searchParams.get("projectId") ?? undefined;
    const view = url.searchParams.get("view");
    const requestedLimit = Number(url.searchParams.get("limit"));
    const listLimit = view === "resume"
      ? 1
      : view === "history"
        ? HISTORY_LIMIT
        : view === "content-history"
          ? CONTENT_HISTORY_LIMIT
          : Number.isFinite(requestedLimit) && requestedLimit > 0
            ? Math.min(Math.floor(requestedLimit), DEFAULT_LIST_LIMIT)
            : DEFAULT_LIST_LIMIT;
    const jobs = await listDeterministicJobs(
      gated.scope,
      projectId,
      {},
      listLimit,
    );
    if (view === "resume") {
      return jsonOk({
        success: true,
        jobs: jobs.slice(0, 1).map(toDeterministicImageJobView),
      });
    }
    if (view === "content-history") {
      const selected = jobs
        .filter((job) => job.inputSnapshot.shot.assetId.startsWith("content:"))
        .slice(0, CONTENT_HISTORY_LIMIT);
      const recoveries = await getDeterministicRecoveries(gated.scope, selected);
      return jsonOk({
        success: true,
        lineages: recoveries.map(({ job, asset }) => ({
          shotId: job.inputSnapshot.shot.assetId,
          artworkId: job.inputSnapshot.masterArtwork.artworkId,
          artworkVersion: job.inputSnapshot.masterArtwork.version,
          artworkChecksum: job.inputSnapshot.masterArtwork.checksum,
          productProfileId: job.inputSnapshot.product.productProfileId,
          productProfileVersion: job.inputSnapshot.product.profileVersion,
          variantId: job.inputSnapshot.product.variantId,
          brandModelId: job.inputSnapshot.brandModel.brandModelId,
          reviewStatus: asset?.reviewStatus ?? null,
        })),
      });
    }
    if (view === "history") {
      const selected = jobs.slice(0, HISTORY_LIMIT);
      const recoveries = await getDeterministicRecoveries(gated.scope, selected);
      const artworks = await new SupabaseMasterArtworkAuthorityRepository().list(
        gated.scope,
      );
      const artworkNames = new Map(
        artworks.map((artwork) => [
          artwork.id,
          artwork.displayName ?? artwork.originalFileName ?? artwork.designId,
        ]),
      );
      const thumbnailPaths = recoveries.flatMap((recovery) => {
        const base = recovery.stages.find(
          (stage) =>
            stage.stage === "BASE_GENERATION" &&
            stage.status === "SUCCEEDED" &&
            stage.storagePath,
        );
        const path = recovery.asset?.storagePath ?? base?.storagePath ?? null;
        return path ? [path] : [];
      });
      const thumbnailAccess = await createImageProductionAssetAccessBatch(
        gated.scope.workspaceId,
        thumbnailPaths,
      ).catch(() => new Map());
      const runs = await Promise.all(
        recoveries.map(async (recovery) => {
          const retryEligibility =
            recovery.state === "COMPOSITE_FAILED"
              ? await getDeterministicCompositeRetryEligibility(
                  gated.scope,
                  recovery.job.id,
                )
              : {
                  eligible: false as const,
                  boundary: "DETERMINISTIC_STAGE_B_ONLY" as const,
                  openAiRequired: false as const,
                  samRequired: false as const,
                  reason: "Für diesen Status ist keine lokale Artwork-Wiederholung vorgesehen.",
                };
          const base = recovery.stages.find(
            (stage) =>
              stage.stage === "BASE_GENERATION" &&
              stage.status === "SUCCEEDED" &&
              stage.storagePath,
          );
          const thumbnailPath =
            recovery.asset?.storagePath ?? base?.storagePath ?? null;
          const thumbnail = thumbnailPath
            ? thumbnailAccess.get(thumbnailPath) ?? null
            : null;
          return toPreviousRunOwnerView({
            recovery,
            artworkDisplayName: artworkNames.get(
              recovery.job.inputSnapshot.masterArtwork.artworkId,
            ),
            thumbnailUrl: thumbnail?.accessUrl ?? null,
            thumbnailKind: recovery.asset
              ? "RESULT"
              : base
                ? "STAGE_A_BASE"
                : null,
            retryEligibility,
          });
        }),
      );
      return jsonOk({
        success: true,
        runs: sortPreviousRunsNewestFirst(runs),
      });
    }
    return jsonOk({ success: true, jobs: jobs.map(toDeterministicImageJobView) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  const gated = await requirePersonaScope();
  if (!gated.ok) return gated.response;
  try {
    const parsed = prepareDeterministicJobRequestSchema.safeParse(await request.json());
    if (!parsed.success) return jsonOk({ success: false, error: "Die Anfrage für das deterministische Mockup ist ungültig.", details: parsed.error.flatten() }, 400);
    const job = await prepareDeterministicImageJob(gated.scope, parsed.data);
    return jsonOk({ success: true, job: toDeterministicImageJobView(job) }, 201);
  } catch (error) {
    return jsonError(error);
  }
}
