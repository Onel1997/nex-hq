import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { designUtilityRequestSchema } from "@/lib/design-studio/utility-contracts";
import {
  completeDesignUtilityManifest, DesignUtilityError, executeDesignUtility, loadOwnedDesignRasterSource,
} from "@/lib/design-studio/utility-service";
import { persistDesignUtilityResult, recordDesignProviderCostEvent } from "@/lib/design-studio/projection";
import { DESIGN_UTILITY_PRICING_VERSION, resolveDesignUtilityConfig } from "@/lib/design-studio/utility-config";
import { hasXerianoAccountMembership, resolveXerianoAccess } from "@/lib/xeriano/auth";
import { authorizeXerianoGeneration } from "@/lib/xeriano/credit-guard";
import {
  quarantineCustomerGeneration, quoteDesignUtilityGeneration, reconcileCustomerGenerationFromRun,
  releaseCustomerGenerationBeforeProvider, reserveCustomerGeneration, XerianoCustomerGenerationError,
  type XerianoGenerationAuthority,
} from "@/lib/xeriano/customer-generation";

export const runtime = "nodejs";
export const maxDuration = 300;

function fail(error: string, code: string, status: number) {
  return NextResponse.json({ success: false, error, code }, { status });
}

export async function POST(request: Request) {
  const access = await resolveXerianoAccess();
  if (access.status !== "AUTHENTICATED") return fail("Bitte melde dich erneut an.", "AUTHENTICATION_REQUIRED", 401);
  if (!hasXerianoAccountMembership(access.context)) return fail("Eine aktive Xeriamo Mitgliedschaft ist erforderlich.", "ACCOUNT_REQUIRED", 403);
  const authorization = authorizeXerianoGeneration(access.context);
  if (!authorization.allowed) return fail(authorization.message, authorization.code, authorization.status);
  const customer = authorization.bypass === null;
  let authority: XerianoGenerationAuthority | null = null;
  let jobId: string | null = null;
  let accepted = false;
  try {
    const input = designUtilityRequestSchema.parse(await request.json());
    jobId = input.jobId;
    const source = await loadOwnedDesignRasterSource(access.context, input.sourceAssetId, input.operation);
    const quote = quoteDesignUtilityGeneration(input.operation);
    if (customer) authority = await reserveCustomerGeneration({ context: access.context, jobId, quote });
    const execution = await executeDesignUtility({
      context: access.context,
      scope: { workspaceId: access.context.workspaceKey, actorId: access.context.userId },
      jobId, sourceAssetId: input.sourceAssetId, operation: input.operation, source,
      onAccepted: async (providerRequestId, providerModel, updatedAt) => {
        accepted = true;
        if (customer) authority = await reconcileCustomerGenerationFromRun({
          context: access.context, jobId: jobId!,
          run: { status: "RUNNING", providerRequestId, providerModel, updatedAt },
        });
        const config = resolveDesignUtilityConfig(input.operation);
        await recordDesignProviderCostEvent({
          context: access.context, jobId: jobId!, providerModel, providerRequestId,
          estimatedCostUsdMicros: config.providerCostUsdMicros,
          ...(authority ? { authorityId: authority.id } : {}), occurredAt: updatedAt,
          operation: input.operation, costVersion: DESIGN_UTILITY_PRICING_VERSION,
        });
      },
    });
    if (!execution.bytes) {
      return NextResponse.json({
        success: execution.manifest.status === "SUCCEEDED",
        status: execution.manifest.status,
        result: execution.manifest.resultAssetId ? {
          assetId: execution.manifest.resultAssetId,
          creationId: execution.manifest.resultCreationId,
          width: execution.manifest.width, height: execution.manifest.height,
        } : null,
      }, { status: execution.manifest.status === "SUCCEEDED" ? 200 : 202 });
    }
    const projected = await persistDesignUtilityResult({
      context: access.context, jobId, operation: input.operation, sourceAssetId: input.sourceAssetId,
      bytes: execution.bytes, ...(authority ? { authority } : {}),
      ...(authorization.bypass === "OWNER_UNLIMITED" ? { ownerPricingVersion: quote.pricingVersion } : {}),
    });
    const manifest = await completeDesignUtilityManifest({ manifest: execution.manifest, result: projected });
    if (customer) authority = await reconcileCustomerGenerationFromRun({
      context: access.context, jobId,
      run: { status: "SUCCEEDED", providerRequestId: manifest.providerRequestId, providerModel: manifest.providerModel, updatedAt: manifest.updatedAt },
    });
    return NextResponse.json({ success: true, status: "SUCCEEDED", result: projected });
  } catch (error) {
    if (customer && authority && jobId) {
      try {
        const safePreProvider = !accepted && (
          error instanceof ZodError
          || error instanceof DesignUtilityError && ["SOURCE_NOT_FOUND", "SOURCE_INVALID", "VECTOR_UNSUPPORTED", "BACKGROUND_ALREADY_REMOVED", "UPSCALE_NOT_REQUIRED", "PROVIDER_NOT_CONFIGURED"].includes(error.code)
        );
        if (safePreProvider) await releaseCustomerGenerationBeforeProvider({ context: access.context, jobId });
        else await quarantineCustomerGeneration({ context: access.context, jobId, providerEndpoint: "design-utility" });
      } catch { /* Preserve the original safe response; settlement stays fail-closed. */ }
    }
    if (error instanceof XerianoCustomerGenerationError) return fail(error.message, error.code, error.status);
    if (error instanceof DesignUtilityError) return fail(error.message, error.code, error.status);
    if (error instanceof ZodError || error instanceof SyntaxError) return fail("Die Aktion ist ungültig.", "INVALID_REQUEST", 400);
    console.error("[xeriamo-design] utility failed", { code: "DESIGN_UTILITY_FAILED", stage: accepted ? "post_acceptance" : "pre_provider" });
    return fail("Die Aktion konnte nicht abgeschlossen werden. Bitte versuche es erneut.", "DESIGN_UTILITY_FAILED", 503);
  }
}
