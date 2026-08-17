import {
  BRAND_MODEL_CONTRACT_VERSION,
} from "@/lib/persona/domain/brand-model-contract";
import { personaIntegrationQuerySchema } from "@/lib/persona/integrations/api-schema";
import { buildImageStudioPersonaHandoff, listImageStudioBrandModels } from "@/lib/persona/future/image-studio-hooks";
import { buildVideoStudioPersonaHandoff, listVideoStudioBrandModels } from "@/lib/persona/future/video-studio-hooks";
import { jsonError, jsonOk, requirePersonaScope } from "../_utils";

/**
 * List eligible Brand Models or resolve one eligibility-gated production
 * handoff. Asset access is short-lived and never becomes canonical identity.
 */
export async function GET(request: Request) {
  const gated = await requirePersonaScope();
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
          ? await listImageStudioBrandModels(gated.scope)
          : await listVideoStudioBrandModels(gated.scope);
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
        ? await buildImageStudioPersonaHandoff(gated.scope, personaId, {
            expectedIdentity,
            resolveAssetAccess: true,
          })
        : await buildVideoStudioPersonaHandoff(gated.scope, personaId, {
            expectedIdentity,
            resolveAssetAccess: true,
          });

    return jsonOk({
      kind: "brand-model-handoff",
      consumer,
      handoff,
    });
  } catch (error) {
    return jsonError(error);
  }
}
