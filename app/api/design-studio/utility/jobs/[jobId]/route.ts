import { NextResponse } from "next/server";
import { completeDesignUtilityManifest, DesignUtilityError, recoverDesignUtility } from "@/lib/design-studio/utility-service";
import { persistDesignUtilityResult } from "@/lib/design-studio/projection";
import { SupabaseDesignUtilityStore } from "@/lib/design-studio/utility-storage";
import { hasXerianoAccountMembership, resolveXerianoAccess } from "@/lib/xeriano/auth";
import { authorizeXerianoGeneration } from "@/lib/xeriano/credit-guard";
import { reconcileCustomerGenerationFromRun, type XerianoGenerationAuthority } from "@/lib/xeriano/customer-generation";
import { DESIGN_UTILITY_PRICING_VERSION } from "@/lib/design-studio/utility-config";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(_request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const access = await resolveXerianoAccess();
  if (access.status !== "AUTHENTICATED" || !hasXerianoAccountMembership(access.context)) {
    return NextResponse.json({ success: false, error: "Kein Zugriff." }, { status: 403 });
  }
  const { jobId } = await params;
  const scope = { workspaceId: access.context.workspaceKey, actorId: access.context.userId };
  try {
    const store = new SupabaseDesignUtilityStore();
    let observation = await recoverDesignUtility({ scope, jobId }, { store });
    const financial = authorizeXerianoGeneration(access.context);
    let authority: XerianoGenerationAuthority | undefined;
    if (financial.allowed && financial.bypass === null) {
      authority = await reconcileCustomerGenerationFromRun({
        context: access.context,
        jobId,
        run: {
          status: observation.manifest.status,
          providerRequestId: observation.manifest.providerRequestId,
          providerModel: observation.manifest.providerModel,
          updatedAt: observation.manifest.updatedAt,
        },
      });
    }
    if (observation.bytes) {
      const projected = await persistDesignUtilityResult({
        context: access.context,
        jobId,
        operation: observation.manifest.operation,
        sourceAssetId: observation.manifest.sourceAssetId,
        bytes: observation.bytes,
        ...(authority ? { authority } : {}),
        ...(financial.allowed && financial.bypass === "OWNER_UNLIMITED"
          ? { ownerPricingVersion: DESIGN_UTILITY_PRICING_VERSION }
          : {}),
      });
      observation = {
        manifest: await completeDesignUtilityManifest({ manifest: observation.manifest, result: projected, store }),
        bytes: null,
      };
      if (financial.allowed && financial.bypass === null) {
        await reconcileCustomerGenerationFromRun({
          context: access.context,
          jobId,
          run: {
            status: "SUCCEEDED",
            providerRequestId: observation.manifest.providerRequestId,
            providerModel: observation.manifest.providerModel,
            updatedAt: observation.manifest.updatedAt,
          },
        });
      }
    }
    return NextResponse.json({
      success: observation.manifest.status === "SUCCEEDED",
      status: observation.manifest.status,
      result: observation.manifest.resultAssetId ? {
        assetId: observation.manifest.resultAssetId,
        creationId: observation.manifest.resultCreationId,
        width: observation.manifest.width,
        height: observation.manifest.height,
      } : null,
    }, { status: 200 });
  } catch (error) {
    if (error instanceof DesignUtilityError) {
      return NextResponse.json({ success: false, error: error.message, code: error.code }, { status: error.status });
    }
    return NextResponse.json({ success: false, error: "Die Aktion konnte nicht geladen werden." }, { status: 503 });
  }
}
