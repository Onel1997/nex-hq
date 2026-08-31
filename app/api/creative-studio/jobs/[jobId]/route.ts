import { NextResponse } from "next/server";

import type { CreativeRun } from "@/lib/creative-studio/contracts";
import { reconcileCreativeJob } from "@/lib/creative-studio/generation-service";
import { SupabaseCreativeJobStore } from "@/lib/creative-studio/server-storage";
import { resolveXerianoAccess } from "@/lib/xeriano/auth";
import { authorizeXerianoGeneration } from "@/lib/xeriano/credit-guard";
import {
  customerCreditReceipt,
  loadCustomerAvailableCredits,
  quarantineCustomerGeneration,
  reconcileCustomerGenerationFromRun,
  redactCreativeRunForCustomer,
  XerianoCustomerGenerationError,
} from "@/lib/xeriano/customer-generation";
import { finalizeCreativeCreations } from "@/lib/xeriano/creation-service";
import { resolveCreativeAccountJobScope } from "@/lib/creative-studio/account-history";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ jobId: string }> },
) {
  const access = await resolveXerianoAccess();
  if (access.status === "UNAUTHENTICATED") {
    return NextResponse.json({ success: false, code: "AUTHENTICATION_REQUIRED", error: "Nicht angemeldet." }, { status: 401 });
  }
  if (access.status !== "AUTHENTICATED") {
    return NextResponse.json({ success: false, code: "XERIANO_FOUNDATION_UNAVAILABLE", error: "Xeriamo-Konto nicht verfügbar." }, { status: 503 });
  }
  const authorization = authorizeXerianoGeneration(access.context);
  if (!authorization.allowed) {
    return NextResponse.json({ success: false, code: "CUSTOMER_ACCOUNT_REQUIRED", error: "Dieser Bereich ist für dein Konto nicht freigegeben." }, { status: 403 });
  }
  const { jobId } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(jobId)) {
    return NextResponse.json({ success: false, code: "INVALID_REQUEST", error: "Der Auftrag ist ungültig." }, { status: 400 });
  }
  try {
    const scope = await resolveCreativeAccountJobScope({
      context: access.context,
      jobId,
    });
    if (!scope) {
      return NextResponse.json(
        { success: false, code: "JOB_NOT_FOUND", error: "Der Auftrag wurde nicht gefunden." },
        { status: 404 },
      );
    }
    const store = new SupabaseCreativeJobStore();
    let manifest = await store.readManifest(
      scope,
      jobId,
    );
    if (!manifest) {
      if (authorization.bypass === null) {
        await quarantineCustomerGeneration({ context: access.context, jobId });
        return NextResponse.json(
          {
            success: false,
            code: "UNKNOWN_OUTCOME",
            error: "Der Anbieterstatus ist unklar. Es wird kein neuer Auftrag gestartet.",
          },
          { status: 409 },
        );
      }
      return NextResponse.json({ success: false, code: "JOB_NOT_FOUND", error: "Der Auftrag wurde nicht gefunden." }, { status: 404 });
    }
    if (
      manifest.providerRequestId &&
      (manifest.status === "RUNNING" || manifest.status === "UNKNOWN_OUTCOME")
    ) {
      const reconciled = await reconcileCreativeJob(
        { scope, jobId },
        {
          store,
          financialMode:
            authorization.bypass === "OWNER_UNLIMITED"
              ? "OWNER"
              : authorization.bypass === null
                ? "CUSTOMER"
                : "INTERNAL",
        },
      );
      if (reconciled) {
        manifest = await store.readManifest(scope, jobId) ?? manifest;
      }
    }
    const run: CreativeRun = {
      id: manifest.jobId,
      createdAt: manifest.createdAt,
      updatedAt: manifest.updatedAt,
      status: manifest.status,
      setup: manifest.setup,
      results: manifest.results.map((result) => result.publicView),
      message: manifest.message,
      provider: manifest.provider,
      providerModel: manifest.providerModel,
      providerRequestId: manifest.providerRequestId,
      ...(manifest.providerPrompt ? { providerPrompt: manifest.providerPrompt } : {}),
      estimatedMaximumCostUsd: manifest.estimatedMaximumCostUsd,
    };
    if (authorization.bypass === null) {
      const authority = await reconcileCustomerGenerationFromRun({ context: access.context, jobId, run });
      if (run.status === "SUCCEEDED" || run.status === "PARTIALLY_SUCCEEDED") {
        const creations = await finalizeCreativeCreations({
          context: access.context,
          scope: {
            workspaceId: scope.workspaceId,
            actorId: scope.actorId,
          },
          run,
          authority,
        });
        const byResult = new Map(
          creations.map((creation) => [creation.resultId, creation]),
        );
        run.results = run.results.map((result) => {
          const creation = byResult.get(result.id);
          return creation
            ? {
                ...result,
                libraryAssetId: creation.assetId,
                creationId: creation.creationId,
              }
            : result;
        });
      }
      const credit = customerCreditReceipt({
        authority,
        availableCredits: await loadCustomerAvailableCredits(access.context.accountId),
      });
      return NextResponse.json({ success: run.status === "SUCCEEDED" || run.status === "PARTIALLY_SUCCEEDED", run: redactCreativeRunForCustomer(run), credit });
    }
    return NextResponse.json({ success: run.status === "SUCCEEDED" || run.status === "PARTIALLY_SUCCEEDED", run });
  } catch (error) {
    if (error instanceof XerianoCustomerGenerationError) {
      return NextResponse.json({ success: false, code: error.code, error: error.message }, { status: error.status });
    }
    return NextResponse.json({ success: false, code: "CREATIVE_JOB_STATUS_FAILED", error: "Der Auftrag konnte gerade nicht aktualisiert werden." }, { status: 503 });
  }
}
