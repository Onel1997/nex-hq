import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { resolveXerianoAccess } from "@/lib/xeriano/auth";
import { authorizeXerianoGeneration } from "@/lib/xeriano/credit-guard";
import {
  customerCreditReceipt,
  loadCustomerAvailableCredits,
  quoteUgcCustomerGeneration,
  reconcileCustomerGenerationFromRun,
  redactUgcRunForCustomer,
  releaseCustomerGenerationBeforeProvider,
  reserveCustomerGeneration,
  XerianoCustomerGenerationError,
  type XerianoCustomerCreditQuote,
  type XerianoGenerationAuthority,
} from "@/lib/xeriano/customer-generation";
import {
  ugcVideoGenerationSetupSchema,
  type UgcVideoReferenceMetadata,
} from "@/lib/ugc-video-studio/contracts";
import {
  generateUgcVideoJob,
  UgcVideoGenerationError,
} from "@/lib/ugc-video-studio/generation-service";
import type { UgcVideoProviderReference } from "@/lib/ugc-video-studio/provider";
import { UgcVideoCostCapError } from "@/lib/ugc-video-studio/seedance-config";
import { resolveKlingMotionReferences } from "@/lib/ugc-video-studio/kling-motion-config";
import { requireTrustedCustomerMotionDuration } from "@/lib/xeriano/video-duration";

export const runtime = "nodejs";
export const maxDuration = 60;

function errorResponse(input: {
  error: string;
  code: string;
  status: number;
  technicalDetails?: string;
}) {
  return NextResponse.json(
    {
      success: false,
      error: input.error,
      code: input.code,
      ...(input.technicalDetails
        ? { technicalDetails: input.technicalDetails.slice(0, 2000) }
        : {}),
    },
    { status: input.status },
  );
}

export async function POST(request: Request) {
  const access = await resolveXerianoAccess();
  if (access.status === "UNAUTHENTICATED") {
    return errorResponse({
      error: "Bitte melde dich erneut an, um Videos zu generieren.",
      code: "AUTHENTICATION_REQUIRED",
      status: 401,
    });
  }
  if (access.status !== "AUTHENTICATED") return errorResponse({ error: "Die Xeriamo-Konto- und Credit-Datenbank ist noch nicht aktiviert.", code: "XERIANO_FOUNDATION_UNAVAILABLE", status: 503 });
  const authorization = authorizeXerianoGeneration(access.context);
  if (!authorization.allowed) {
    return errorResponse({ error: authorization.message, code: authorization.code, status: authorization.status });
  }
  const customer = access.context.role === "CUSTOMER";
  let customerAuthority: XerianoGenerationAuthority | null = null;
  let customerQuote: XerianoCustomerCreditQuote | null = null;
  let customerJobId: string | null = null;

  try {
    const formData = await request.formData();
    const jobId = formData.get("jobId");
    const setupJson = formData.get("setup");
    if (typeof jobId !== "string" || typeof setupJson !== "string") {
      throw new UgcVideoGenerationError(
        "INVALID_REQUEST",
        "Der Videoauftrag ist unvollständig.",
        400,
      );
    }
    const setup = ugcVideoGenerationSetupSchema.parse(JSON.parse(setupJson));
    const files = formData.getAll("reference");
    const references: UgcVideoProviderReference[] = [];
    for (let index = 0; index < setup.references.length; index += 1) {
      const file = files[index];
      const metadata: UgcVideoReferenceMetadata = setup.references[index]!;
      if (
        !(file instanceof File) ||
        file.name !== metadata.name ||
        file.type.toLowerCase() !== metadata.mimeType.toLowerCase()
      ) {
        throw new UgcVideoGenerationError(
          "REFERENCE_INVALID",
          "Mindestens eine Referenz stimmt nicht mit dem Setup überein.",
          400,
          `reference=${metadata.id};order=${index}`,
        );
      }
      references.push({
        metadata,
        bytes: Buffer.from(await file.arrayBuffer()),
      });
    }
    if (files.length !== references.length) {
      throw new UgcVideoGenerationError(
        "REFERENCE_INVALID",
        "Die Referenzen konnten nicht eindeutig zugeordnet werden.",
        400,
      );
    }

    if (customer) {
      const motion = resolveKlingMotionReferences(setup).motionVideo;
      const motionReference = motion
        ? references.find((reference) => reference.metadata.id === motion.id)
        : null;
      if (!motionReference) {
        throw new XerianoCustomerGenerationError(
          "VIDEO_DURATION_REQUIRED",
          "Die Dauer des Bewegungs-Referenzvideos konnte nicht bestimmt werden.",
          400,
        );
      }
      let trustedDuration: number;
      try {
        trustedDuration = requireTrustedCustomerMotionDuration({
          bytes: motionReference.bytes,
          mimeType: motionReference.metadata.mimeType,
        });
      } catch {
        throw new XerianoCustomerGenerationError(
          "VIDEO_DURATION_REQUIRED",
          "Die Videodauer konnte serverseitig nicht sicher geprüft werden. Verwende für Kundengenerierungen eine gültige MP4-, MOV- oder M4V-Datei.",
          400,
        );
      }
      customerQuote = quoteUgcCustomerGeneration(setup, trustedDuration);
      customerJobId = jobId;
      customerAuthority = await reserveCustomerGeneration({
        context: access.context,
        jobId,
        quote: customerQuote,
      });
    }

    const run = await generateUgcVideoJob({
      scope: {
        workspaceId: access.context.workspaceKey,
        actorId: access.context.userId,
      },
      jobId,
      setup,
      references,
    });
    if (customer) {
      customerAuthority = await reconcileCustomerGenerationFromRun({
        context: access.context,
        jobId,
        run,
      });
    }
    const credit =
      customer && customerQuote && customerAuthority
        ? customerCreditReceipt({
            authority: customerAuthority,
            availableCredits: await loadCustomerAvailableCredits(
              access.context.accountId,
            ),
          })
        : null;
    return NextResponse.json(
      {
        success: run.status === "SUCCEEDED",
        run: customer ? redactUgcRunForCustomer(run) : run,
        ...(credit ? { credit } : {}),
        ...(run.status !== "SUCCEEDED" ? { code: run.status } : {}),
      },
      { status: run.status === "RUNNING" ? 202 : 200 },
    );
  } catch (error) {
    if (customer && customerAuthority && customerJobId) {
      const definitelyBeforeProvider =
        (error instanceof UgcVideoGenerationError &&
          [
            "INVALID_REQUEST",
            "REFERENCE_LIMIT_EXCEEDED",
            "REFERENCE_INVALID",
            "PROVIDER_NOT_CONFIGURED",
            "UGC_VIDEO_STORAGE_SETUP_FAILED",
          ].includes(error.code)) ||
        error instanceof UgcVideoCostCapError ||
        error instanceof ZodError ||
        error instanceof SyntaxError ||
        (error instanceof Error &&
          /UGC video (request claim|manifest write|storage preflight|storage setup)/i.test(
            error.message,
          ));
      try {
        if (definitelyBeforeProvider) {
          await releaseCustomerGenerationBeforeProvider({
            context: access.context,
            jobId: customerJobId,
          });
        }
      } catch (settlementError) {
        console.error("[Xeriano] UGC credit settlement failed", {
          jobId: customerJobId,
          message:
            settlementError instanceof Error
              ? settlementError.message
              : "unknown",
        });
      }
    }
    console.error("[UGC Video Studio] Generation request failed", {
      name: error instanceof Error ? error.name : "UnknownError",
      message: error instanceof Error ? error.message : "unknown",
      code:
        error instanceof UgcVideoGenerationError
          ? error.code
          : error instanceof UgcVideoCostCapError
            ? error.code
            : "UGC_VIDEO_GENERATION_FAILED",
    });
    if (error instanceof UgcVideoGenerationError) {
      return errorResponse({
        error: error.message,
        code: error.code,
        status: error.status,
        technicalDetails: customer ? undefined : error.technicalDetails,
      });
    }
    if (error instanceof XerianoCustomerGenerationError) {
      return errorResponse({ error: error.message, code: error.code, status: error.status });
    }
    if (error instanceof UgcVideoCostCapError) {
      return errorResponse({
        error: error.message,
        code: error.code,
        status: 503,
        technicalDetails: customer
          ? undefined
          : `estimatedMaximumCostUsd=${error.estimatedMaximumCostUsd};configuredCostCapUsd=${error.configuredCostCapUsd ?? "missing"}`,
      });
    }
    if (error instanceof ZodError || error instanceof SyntaxError) {
      return errorResponse({
        error: "Bitte prüfe Prompt, Modell und Videoeinstellungen.",
        code: "INVALID_REQUEST",
        status: 400,
      });
    }
    return errorResponse({
      error: "Das Video konnte nicht erstellt werden.",
      code: "UGC_VIDEO_GENERATION_FAILED",
      status: 500,
      technicalDetails:
        customer ? undefined : error instanceof Error ? error.message : "unknown",
    });
  }
}
