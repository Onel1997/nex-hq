import { prepareImageGenerationJobRequestSchema } from "@/lib/image/paid-generation/types";
import { toImageGenerationJobView } from "@/lib/image/paid-generation/types";
import { prepareImageGenerationJob } from "@/lib/image/paid-generation/service";
import { requirePersonaScope, jsonError, jsonOk } from "@/app/api/persona/_utils";
import { SupabaseImageGenerationJobRepository } from "@/lib/image/paid-generation/supabase-repository";

export async function GET(request: Request) {
  const gated = await requirePersonaScope();
  if (!gated.ok) return gated.response;
  try {
    const params = new URL(request.url).searchParams;
    const jobs = await new SupabaseImageGenerationJobRepository().list(
      gated.scope,
      {
        productionProjectId: params.get("productionProjectId") ?? undefined,
        reportRecordId: params.get("reportRecordId") ?? undefined,
        assetId: params.get("assetId") ?? undefined,
        limit: Math.min(Math.max(Number(params.get("limit")) || 50, 1), 100),
      },
    );
    return jsonOk({ success: true, jobs: jobs.map(toImageGenerationJobView) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  const gated = await requirePersonaScope();
  if (!gated.ok) return gated.response;
  try {
    const parsed = prepareImageGenerationJobRequestSchema.safeParse(await request.json());
    if (!parsed.success) return jsonOk({ success: false, error: "Invalid paid Image preparation request.", details: parsed.error.flatten() }, 400);
    const job = await prepareImageGenerationJob(gated.scope, parsed.data);
    return jsonOk({ success: true, job: toImageGenerationJobView(job) }, 201);
  } catch (error) {
    return jsonError(error);
  }
}
