import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { designGenerationSetupSchema } from "@/lib/design-studio/contracts";
import { DesignGenerationError, generateDesignJob } from "@/lib/design-studio/generation-service";
import { isSuccessfulDesignRun } from "@/lib/design-studio/persistent-results";
import type { DesignProviderReference } from "@/lib/design-studio/provider";
import { finalizeDesignCreations, recordDesignProviderCostEvent } from "@/lib/design-studio/projection";
import { SupabaseDesignJobStore } from "@/lib/design-studio/server-storage";
import { hasXerianoAccountMembership, resolveXerianoAccess } from "@/lib/xeriano/auth";
import { authorizeXerianoGeneration } from "@/lib/xeriano/credit-guard";
import {
  customerCreditReceipt, loadCustomerAvailableCredits, quarantineCustomerGeneration,
  quoteDesignCustomerGeneration, reconcileCustomerGenerationFromRun,
  releaseCustomerGenerationBeforeProvider, reserveCustomerGeneration,
  XerianoCustomerGenerationError, type XerianoGenerationAuthority,
} from "@/lib/xeriano/customer-generation";
import { validateDesignSignature } from "@/lib/xeriano/library";

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
  const ownerUnlimited = authorization.bypass === "OWNER_UNLIMITED";
  let authority: XerianoGenerationAuthority | null = null;
  let jobId: string | null = null;
  let definitelyBeforeProvider = true;
  try {
    const form = await request.formData();
    const rawJobId = form.get("jobId"); const rawSetup = form.get("setup");
    if (typeof rawJobId !== "string" || typeof rawSetup !== "string") throw new DesignGenerationError("INVALID_REQUEST", "Der Design-Auftrag ist unvollständig.", 400);
    jobId = rawJobId;
    const setup = designGenerationSetupSchema.parse(JSON.parse(rawSetup));
    const referenceParts = form.getAll("reference");
    if (referenceParts.length > 1) throw new DesignGenerationError("REFERENCE_INVALID", "Es ist genau eine optionale Referenz erlaubt.", 400);
    const file = referenceParts[0] ?? null;
    let reference: DesignProviderReference | null = null;
    if (setup.reference) {
      if (!(file instanceof File) || file.name !== setup.reference.name || file.type !== setup.reference.mimeType || file.size !== setup.reference.byteLength) {
        throw new DesignGenerationError("REFERENCE_INVALID", "Diese Referenz kann nicht verwendet werden.", 400);
      }
      const bytes = Buffer.from(await file.arrayBuffer());
      if (!validateDesignSignature(bytes, file.type)) throw new DesignGenerationError("REFERENCE_INVALID", "Diese Referenz kann nicht verwendet werden.", 400);
      reference = { bytes, mimeType: file.type, name: file.name };
    } else if (file instanceof File) throw new DesignGenerationError("REFERENCE_INVALID", "Diese Referenz kann nicht verwendet werden.", 400);
    const quote = quoteDesignCustomerGeneration(setup);
    if (customer) authority = await reserveCustomerGeneration({ context: access.context, jobId, quote });
    definitelyBeforeProvider = false;
    let run = await generateDesignJob({
      scope: { workspaceId: access.context.workspaceKey, actorId: access.context.userId },
      jobId,
      setup,
      reference,
      onProviderAccepted: async (evidence: { providerRequestId: string; providerModel: string; updatedAt: string }) => {
        if (customer) {
          authority = await reconcileCustomerGenerationFromRun({
            context: access.context,
            jobId: jobId!,
            run: {
              status: "RUNNING",
              providerRequestId: evidence.providerRequestId,
              providerModel: evidence.providerModel,
              updatedAt: evidence.updatedAt,
            },
          });
        }
        const acceptedManifest = await new SupabaseDesignJobStore().readManifest(
          { workspaceId: access.context.workspaceKey, actorId: access.context.userId },
          jobId!,
        );
        if (acceptedManifest) {
          await recordDesignProviderCostEvent({
            context: access.context,
            jobId: jobId!,
            providerModel: evidence.providerModel,
            providerRequestId: evidence.providerRequestId,
            estimatedCostUsdMicros: acceptedManifest.estimatedCostUsdMicros,
            ...(authority ? { authorityId: authority.id } : {}),
            occurredAt: evidence.updatedAt,
          });
        }
      },
    });
    const manifest = await new SupabaseDesignJobStore().readManifest({ workspaceId: access.context.workspaceKey, actorId: access.context.userId }, jobId);
    if (!manifest) throw new Error("DESIGN_MANIFEST_MISSING");
    if (customer) authority = await reconcileCustomerGenerationFromRun({ context: access.context, jobId, run: { status: manifest.status, providerRequestId: manifest.providerRequestId, providerModel: manifest.providerModel, updatedAt: manifest.updatedAt } });
    if (isSuccessfulDesignRun(run)) {
      run = await finalizeDesignCreations({
        context: access.context, scope: { workspaceId: access.context.workspaceKey, actorId: access.context.userId }, run,
        ...(authority ? { authority } : {}), ...(ownerUnlimited ? { ownerPricingVersion: quote.pricingVersion } : {}),
      });
    }
    const credit = customer && authority ? customerCreditReceipt({ authority, availableCredits: await loadCustomerAvailableCredits(access.context.accountId) }) : null;
    return NextResponse.json({ success: isSuccessfulDesignRun(run), run, ...(credit ? { credit } : {}) }, { status: run.status === "RUNNING" ? 202 : 200 });
  } catch (error) {
    if (customer && authority && jobId) {
      try {
        const safePreProviderFailure = definitelyBeforeProvider
          || error instanceof ZodError
          || error instanceof SyntaxError
          || (error instanceof DesignGenerationError
            && ["INVALID_REQUEST", "REFERENCE_INVALID", "PROVIDER_NOT_CONFIGURED"].includes(error.code));
        if (safePreProviderFailure) {
          await releaseCustomerGenerationBeforeProvider({ context: access.context, jobId });
        } else if (error instanceof DesignGenerationError
          && ["DUPLICATE_REQUEST_RUNNING", "IDEMPOTENCY_CONFLICT"].includes(error.code)) {
          // Another request already owns this exact authority. It must remain
          // reserved/accepted and be recovered through the status endpoint.
        } else {
          await quarantineCustomerGeneration({ context: access.context, jobId, providerEndpoint: "design-studio" });
        }
      } catch { /* Never expose settlement diagnostics. */ }
    }
    if (error instanceof XerianoCustomerGenerationError) return fail(error.message, error.code, error.status);
    if (error instanceof DesignGenerationError) return fail(error.message, error.code, error.status);
    if (error instanceof ZodError || error instanceof SyntaxError) return fail("Die Design-Einstellungen sind ungültig.", "INVALID_REQUEST", 400);
    console.error("[xeriamo-design] generation failed", { code: "DESIGN_GENERATION_FAILED", stage: definitelyBeforeProvider ? "pre_provider" : "generation" });
    return fail("Design konnte nicht erstellt werden. Bitte versuche es erneut.", "DESIGN_GENERATION_FAILED", 503);
  }
}
