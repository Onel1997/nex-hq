import { imageGenerationJobActionSchema, toImageGenerationJobView } from "@/lib/image/paid-generation/types";
import { cancelImageGenerationJob, confirmImageGenerationJob, executeImageGenerationJob } from "@/lib/image/paid-generation/service";
import { requirePersonaScope, jsonError, jsonOk } from "@/app/api/persona/_utils";
import { SupabaseImageGenerationJobRepository } from "@/lib/image/paid-generation/supabase-repository";
import { ImagePaidGenerationSafetyError } from "@/lib/image/image-paid-generation-guard";

function jobError(error: unknown) {
  if (error instanceof ImagePaidGenerationSafetyError) {
    return jsonOk({ success: false, error: error.message, code: error.code }, 423);
  }
  return jsonError(error);
}

export async function GET(_request: Request, context: { params: Promise<{ jobId: string }> }) {
  const gated = await requirePersonaScope();
  if (!gated.ok) return gated.response;
  try {
    const { jobId } = await context.params;
    const job = await new SupabaseImageGenerationJobRepository().get(gated.scope, jobId);
    return job ? jsonOk({ success: true, job: toImageGenerationJobView(job) }) : jsonOk({ success: false, error: "Image generation job not found." }, 404);
  } catch (error) { return jobError(error); }
}

export async function POST(request: Request, context: { params: Promise<{ jobId: string }> }) {
  const gated = await requirePersonaScope();
  if (!gated.ok) return gated.response;
  try {
    const { jobId } = await context.params;
    const parsed = imageGenerationJobActionSchema.safeParse(await request.json());
    if (!parsed.success) return jsonOk({ success: false, error: "Invalid Image generation job action.", details: parsed.error.flatten() }, 400);
    const { action, inputFingerprint } = parsed.data;
    if (action === "confirm") return jsonOk({ success: true, job: toImageGenerationJobView(await confirmImageGenerationJob(gated.scope, jobId, inputFingerprint)) });
    if (action === "cancel") return jsonOk({ success: true, job: toImageGenerationJobView(await cancelImageGenerationJob(gated.scope, jobId, inputFingerprint)) });
    const result = await executeImageGenerationJob(gated.scope, jobId, inputFingerprint, action === "retry_known_failure");
    return jsonOk({ success: true, ...result, job: toImageGenerationJobView(result.job) });
  } catch (error) { return jobError(error); }
}
