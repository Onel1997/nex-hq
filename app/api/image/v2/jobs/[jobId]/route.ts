import { jsonError, jsonOk, requirePersonaScope } from "@/app/api/persona/_utils";
import { deterministicJobActionSchema } from "@/lib/image/deterministic-runtime/prepare-types";
import { confirmDeterministicImageJob, executeFakeDeterministicJob, executeRealDeterministicJob, getDeterministicCompositeRetryEligibility, getDeterministicRecovery, retryDeterministicComposite } from "@/lib/image/deterministic-runtime/service";
import { toDeterministicImageJobView } from "@/lib/image/deterministic-runtime/types";
import { createImageProductionAssetAccess } from "@/lib/image/production-project/asset-access";
import { ImagePaidGenerationSafetyError } from "@/lib/image/image-paid-generation-guard";

export const runtime = "nodejs";
export const maxDuration = 300;

async function recoveryView(
  scope: Parameters<typeof getDeterministicRecovery>[0],
  recovery: Awaited<ReturnType<typeof getDeterministicRecovery>>,
) {
  const access = recovery.asset
    ? await createImageProductionAssetAccess(recovery.asset.workspaceId, recovery.asset.storagePath).catch(() => null)
    : null;
  const retryEligibility = recovery.state === "COMPOSITE_FAILED"
    ? await getDeterministicCompositeRetryEligibility(scope, recovery.job.id)
    : null;
  return {
    ...recovery,
    retryEligibility,
    job: toDeterministicImageJobView(recovery.job),
    stages: recovery.stages.map((stage) => ({ ...(stage as Record<string, unknown>), storagePath: null })),
    asset: recovery.asset ? { ...recovery.asset, storagePath: null, accessUrl: access?.accessUrl ?? null, accessExpiresAt: access?.expiresAt ?? null } : null,
  };
}

export async function GET(_request: Request, context: { params: Promise<{ jobId: string }> }) {
  const gated = await requirePersonaScope();
  if (!gated.ok) return gated.response;
  try {
    const { jobId } = await context.params;
    return jsonOk({ success: true, recovery: await recoveryView(gated.scope, await getDeterministicRecovery(gated.scope, jobId)) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request, context: { params: Promise<{ jobId: string }> }) {
  const gated = await requirePersonaScope();
  if (!gated.ok) return gated.response;
  try {
    const { jobId } = await context.params;
    const parsed = deterministicJobActionSchema.safeParse(await request.json());
    if (!parsed.success) return jsonOk({ success: false, error: "Die Produktionsaktion ist ungültig.", details: parsed.error.flatten() }, 400);
    const { action, inputFingerprint } = parsed.data;
    if (action === "confirm") {
      const job = await confirmDeterministicImageJob(gated.scope, jobId, inputFingerprint);
      return jsonOk({ success: true, job: toDeterministicImageJobView(job) });
    }
    const recovery = action === "retry_composite"
      ? await retryDeterministicComposite(gated.scope, jobId, inputFingerprint)
      : action === "execute_real"
        ? await executeRealDeterministicJob(gated.scope, jobId, inputFingerprint)
        : await executeFakeDeterministicJob(gated.scope, jobId, inputFingerprint);
    return jsonOk({ success: true, recovery: await recoveryView(gated.scope, recovery) });
  } catch (error) {
    if (error instanceof ImagePaidGenerationSafetyError) {
      return jsonOk(
        {
          success: false,
          error:
            "Die bezahlte Bildproduktion ist serverseitig deaktiviert. Der bestätigte Auftrag wurde nicht ausgeführt.",
          code: error.code,
        },
        423,
      );
    }
    return jsonError(error);
  }
}
