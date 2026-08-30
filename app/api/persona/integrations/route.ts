import {
  BRAND_MODEL_CONTRACT_VERSION,
} from "@/lib/persona/domain/brand-model-contract";
import { personaIntegrationQuerySchema } from "@/lib/persona/integrations/api-schema";
import { buildImageStudioPersonaHandoff, listImageStudioBrandModels } from "@/lib/persona/future/image-studio-hooks";
import { buildVideoStudioPersonaHandoff, listVideoStudioBrandModels } from "@/lib/persona/future/video-studio-hooks";
import { jsonError, jsonOk, requirePersonaScope } from "../_utils";
import { logImageStudioTimings, timeImageStudioPhase, type ImageStudioTiming } from "@/lib/image/performance-diagnostics";

/**
 * List eligible Brand Models or resolve one eligibility-gated production
 * handoff. Asset access is short-lived and never becomes canonical identity.
 */
export async function GET(request: Request) {
  const timings: ImageStudioTiming[] = [];
  const authStartedAt = performance.now();
  const gated = await requirePersonaScope();
  timings.push({
    phase: "owner-auth",
    durationMs: performance.now() - authStartedAt,
  });
  if (!gated.ok) return gated.response;

  try {
    const url = new URL(request.url);
    const parsed = personaIntegrationQuerySchema.safeParse(
      Object.fromEntries(url.searchParams.entries()),
    );
    if (!parsed.success) {
      return jsonOk(
        {
          success: false,
          code: "VALIDATION",
          error: "Invalid Brand Model integration request.",
          details: parsed.error.flatten(),
        },
        400,
      );
    }

    const { consumer, personaId } = parsed.data;
    if (!personaId) {
      const brandModels =
        consumer === "image"
          ? await timeImageStudioPhase(
              "eligible-image-brand-models",
              () => listImageStudioBrandModels(gated.scope),
              timings,
            )
          : await listVideoStudioBrandModels(gated.scope);
      if (consumer === "image")
        logImageStudioTimings("eligible-image-brand-models", timings);
      return jsonOk({
        kind: "eligible-brand-models",
        consumer,
        contractVersion: BRAND_MODEL_CONTRACT_VERSION,
        brandModels,
      });
    }

    const expectedIdentity =
      parsed.data.expectedIdentityLockSnapshotId &&
      parsed.data.expectedIdentityLockVersion &&
      parsed.data.expectedIdentityFingerprint
      ? {
          identityLockSnapshotId:
            parsed.data.expectedIdentityLockSnapshotId,
          identityLockVersion: parsed.data.expectedIdentityLockVersion,
          identityFingerprint: parsed.data.expectedIdentityFingerprint,
        }
      : undefined;
    const handoff =
      consumer === "image"
        ? await timeImageStudioPhase(
            "image-brand-model-handoff",
            () =>
              buildImageStudioPersonaHandoff(gated.scope, personaId, {
                expectedIdentity,
                resolveAssetAccess: true,
              }),
            timings,
          )
        : await buildVideoStudioPersonaHandoff(gated.scope, personaId, {
            expectedIdentity,
            resolveAssetAccess: true,
          });
    if (consumer === "image")
      logImageStudioTimings("image-brand-model-handoff", timings);

    return jsonOk({
      kind: "brand-model-handoff",
      consumer,
      handoff,
    });
  } catch (error) {
    return jsonError(error);
  }
}
