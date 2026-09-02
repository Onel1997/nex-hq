import { NextResponse } from "next/server";

import {
  observeUgcVideoJob,
  UgcVideoGenerationError,
} from "@/lib/ugc-video-studio/generation-service";
import { resolveXerianoAccess } from "@/lib/xeriano/auth";
import { authorizeXerianoGeneration } from "@/lib/xeriano/credit-guard";
import {
  customerCreditReceipt,
  loadCustomerAvailableCredits,
  quarantineCustomerGeneration,
  reconcileCustomerGenerationFromRun,
  redactUgcRunForCustomer,
  XerianoCustomerGenerationError,
} from "@/lib/xeriano/customer-generation";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(
  _request: Request,
  context: { params: Promise<{ jobId: string }> },
) {
  const startedAt = performance.now();
  const access = await resolveXerianoAccess();
  if (access.status === "UNAUTHENTICATED") {
    return NextResponse.json(
      { success: false, code: "AUTHENTICATION_REQUIRED", error: "Nicht angemeldet." },
      { status: 401 },
    );
  }
  if (access.status !== "AUTHENTICATED") {
    return NextResponse.json(
      { success: false, code: "XERIANO_FOUNDATION_UNAVAILABLE", error: "Xeriamo-Konto nicht verfügbar." },
      { status: 503 },
    );
  }
  const authorization = authorizeXerianoGeneration(access.context);
  if (!authorization.allowed) {
    return NextResponse.json(
      { success: false, code: "CUSTOMER_ACCOUNT_REQUIRED", error: "Dieser Bereich ist für dein Konto nicht freigegeben." },
      { status: 403 },
    );
  }
  const customer = authorization.bypass === null;
  const { jobId } = await context.params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(jobId)) {
    return NextResponse.json(
      { success: false, code: "INVALID_REQUEST", error: "Der Videoauftrag ist ungültig." },
      { status: 400 },
    );
  }
  try {
    const run = await observeUgcVideoJob({
      scope: {
        workspaceId: access.context.workspaceKey,
        actorId: access.context.userId,
      },
      jobId,
    });
    let credit = null;
    if (customer) {
      const authority = await reconcileCustomerGenerationFromRun({
        context: access.context,
        jobId,
        run,
      });
      credit = customerCreditReceipt({
        authority,
        availableCredits: await loadCustomerAvailableCredits(access.context.accountId),
      });
    }
    if (process.env.NODE_ENV === "development") {
      console.info("[Performance] UGC job observation", {
        durationMs: Math.round(performance.now() - startedAt),
        status: run.status,
        queueStatus: run.queueObservations?.at(-1)?.status ?? null,
      });
    }
    return NextResponse.json({
      success: run.status === "SUCCEEDED",
      run: customer ? redactUgcRunForCustomer(run) : run,
      ...(credit ? { credit } : {}),
    });
  } catch (error) {
    if (error instanceof XerianoCustomerGenerationError) {
      return NextResponse.json(
        { success: false, code: error.code, error: error.message },
        { status: error.status },
      );
    }
    if (error instanceof UgcVideoGenerationError) {
      if (error.code === "JOB_STATE_INCONSISTENT") {
        console.error("[xeriamo-ugc] durable_job_state_inconsistent", {
          jobId,
          code: error.code,
          stage: error.technicalDetails ?? "unknown",
        });
      }
      if (
        customer &&
        error.code === "JOB_NOT_FOUND" &&
        error.status === 404
      ) {
        try {
          await quarantineCustomerGeneration({ context: access.context, jobId });
          return NextResponse.json(
            {
              success: false,
              code: "UNKNOWN_OUTCOME",
              error: "Der Anbieterstatus ist unklar. Es wird kein neuer Auftrag gestartet.",
            },
            { status: 409 },
          );
        } catch (quarantineError) {
          if (quarantineError instanceof XerianoCustomerGenerationError) {
            return NextResponse.json(
              { success: false, code: quarantineError.code, error: quarantineError.message },
              { status: quarantineError.status },
            );
          }
        }
      }
      return NextResponse.json(
        { success: false, code: error.code, error: error.message },
        { status: error.status },
      );
    }
    console.error("[UGC Video Studio] Job observation failed", {
      name: error instanceof Error ? error.name : "UnknownError",
      message: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json(
      {
        success: false,
        code: "UGC_VIDEO_JOB_STATUS_FAILED",
        error: "Der Videoauftrag konnte gerade nicht aktualisiert werden.",
      },
      { status: 503 },
    );
  }
}
