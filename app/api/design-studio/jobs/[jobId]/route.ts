import { NextResponse } from "next/server";
import { finalizeDesignCreations } from "@/lib/design-studio/projection";
import { recoverDesignJob } from "@/lib/design-studio/generation-service";
import { publicDesignRun } from "@/lib/design-studio/public";
import { isSuccessfulDesignRun } from "@/lib/design-studio/persistent-results";
import { SupabaseDesignJobStore } from "@/lib/design-studio/server-storage";
import { hasXerianoAccountMembership, resolveXerianoAccess } from "@/lib/xeriano/auth";
import { authorizeXerianoGeneration } from "@/lib/xeriano/credit-guard";
import { reconcileCustomerGenerationFromRun, type XerianoGenerationAuthority } from "@/lib/xeriano/customer-generation";

export async function GET(_request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const access = await resolveXerianoAccess();
  if (access.status !== "AUTHENTICATED" || !hasXerianoAccountMembership(access.context)) return NextResponse.json({ error: "Kein Zugriff." }, { status: 403 });
  const { jobId } = await params;
  const scope = { workspaceId: access.context.workspaceKey, actorId: access.context.userId };
  try {
    const store = new SupabaseDesignJobStore();
    let manifest = await store.readManifest(scope, jobId);
    if (!manifest) return NextResponse.json({ error: "Auftrag nicht gefunden." }, { status: 404 });
    if ((manifest.status === "RUNNING" || manifest.status === "UNKNOWN_OUTCOME") && manifest.providerRequestId) {
      await recoverDesignJob({ scope, jobId });
      manifest = await store.readManifest(scope, jobId);
      if (!manifest) return NextResponse.json({ error: "Auftrag nicht gefunden." }, { status: 404 });
    }
    const financial = authorizeXerianoGeneration(access.context);
    let authority: XerianoGenerationAuthority | undefined;
    if (financial.allowed && financial.bypass === null) {
      authority = await reconcileCustomerGenerationFromRun({ context: access.context, jobId, run: { status: manifest.status, providerRequestId: manifest.providerRequestId, providerModel: manifest.providerModel, updatedAt: manifest.updatedAt } });
    }
    let run = publicDesignRun(manifest);
    if (isSuccessfulDesignRun(run)) {
      run = await finalizeDesignCreations({ context: access.context, scope, run, ...(authority ? { authority } : {}), ...(financial.allowed && financial.bypass === "OWNER_UNLIMITED" ? { ownerPricingVersion: "xeriano-design-generation-pricing-v1" } : {}) });
    }
    return NextResponse.json({ success: true, run });
  } catch {
    return NextResponse.json({ error: "Auftrag konnte nicht geladen werden." }, { status: 503 });
  }
}
