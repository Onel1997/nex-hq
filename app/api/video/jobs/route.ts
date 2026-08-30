import {
  jsonError,
  jsonOk,
  requirePersonaScope,
} from "@/app/api/persona/_utils";
import { SupabaseVideoRepository } from "@/lib/video/supabase-repository";
import { defaultVideoDependencies, prepareVideoJob } from "@/lib/video/service";
import { persistVideoAsset } from "@/lib/video/storage";
import { toVideoJobView } from "@/lib/video/types";
export async function GET(request: Request) {
  const gated = await requirePersonaScope();
  if (!gated.ok) return gated.response;
  try {
    const repository = new SupabaseVideoRepository();
    const requestedLimit = Number(new URL(request.url).searchParams.get("limit"));
    const limit = Number.isFinite(requestedLimit) && requestedLimit > 0
      ? Math.min(Math.floor(requestedLimit), 50)
      : 50;
    const jobs = await repository.listJobs(gated.scope, limit);
    const assets = await repository.getAssetsByJobs(
      gated.scope,
      jobs.map((job) => job.id),
    );
    return jsonOk({
      success: true,
      jobs: await Promise.all(jobs.map(async (job) => ({
        ...toVideoJobView(job),
        assetReviewStatus: assets.get(job.id)?.reviewStatus ?? null,
      }))),
    });
  } catch (error) {
    return jsonError(error);
  }
}
export async function POST(request: Request) {
  const gated = await requirePersonaScope();
  if (!gated.ok) return gated.response;
  try {
    const repository = new SupabaseVideoRepository();
    const job = await prepareVideoJob(
      gated.scope,
      await request.json(),
      defaultVideoDependencies(repository, persistVideoAsset),
    );
    return jsonOk({ success: true, job: toVideoJobView(job) }, 201);
  } catch (error) {
    return jsonError(error);
  }
}
