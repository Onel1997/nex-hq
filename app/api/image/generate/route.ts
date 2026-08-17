import { z } from "zod";
import { requirePersonaScope, jsonError, jsonOk } from "@/app/api/persona/_utils";
import { executeImageGenerationJob } from "@/lib/image/paid-generation/service";
import { toImageGenerationJobView } from "@/lib/image/paid-generation/types";
import { ImagePaidGenerationSafetyError } from "@/lib/image/image-paid-generation-guard";

const requestSchema = z.object({
  jobId: z.string().uuid(),
  inputFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  retryKnownFailure: z.boolean().default(false),
}).strict();

/**
 * Compatibility execution route. Raw report/asset/provider payloads are no
 * longer accepted: every provider call must consume one confirmed durable job.
 */
export async function POST(request: Request) {
  const gated = await requirePersonaScope();
  if (!gated.ok) return gated.response;
  try {
    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) return jsonOk({ success: false, error: "A confirmed durable Image generation job is required.", details: parsed.error.flatten() }, 400);
    const result = await executeImageGenerationJob(
      gated.scope, parsed.data.jobId, parsed.data.inputFingerprint, parsed.data.retryKnownFailure,
    );
    return jsonOk({ success: true, ...result, job: toImageGenerationJobView(result.job) });
  } catch (error) {
    if (error instanceof ImagePaidGenerationSafetyError) {
      return jsonOk({ success: false, error: error.message, code: error.code }, 423);
    }
    return jsonError(error);
  }
}
