import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

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
} from "@/lib/ugc-video-studio/contracts";
import {
  generateUgcVideoJob,
  UgcVideoGenerationError,
} from "@/lib/ugc-video-studio/generation-service";
import type { UgcVideoProviderReference } from "@/lib/ugc-video-studio/provider";
import { UgcVideoCostCapError } from "@/lib/ugc-video-studio/seedance-config";
import { resolveKlingMotionReferences } from "@/lib/ugc-video-studio/kling-motion-config";
import { prepareKlingMotionMedia } from "@/lib/ugc-video-studio/kling-motion-media";
import { requireTrustedCustomerMotionDuration } from "@/lib/xeriano/video-duration";
import { xerianoTempReferenceGenerateEntrySchema } from "@/lib/xeriano/temp-references/contracts";
import {
  bindTempReferences,
  resolveTempReferences,
  XerianoTempReferenceError,
} from "@/lib/xeriano/temp-references/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const ugcGenerateRequestSchema = z
  .object({
    jobId: z.string().uuid(),
    setup: ugcVideoGenerationSetupSchema,
    tempReferences: z
      .array(xerianoTempReferenceGenerateEntrySchema)
      .max(50),
  })
  .strict();

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
  const customer = authorization.allowed && authorization.bypass === null;
  const ownerUnlimited =
    authorization.allowed && authorization.bypass === "OWNER_UNLIMITED";
  let customerAuthority: XerianoGenerationAuthority | null = null;
  let customerQuote: XerianoCustomerCreditQuote | null = null;
  let customerJobId: string | null = null;

  try {
    if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
      throw new UgcVideoGenerationError(
        "INVALID_REQUEST",
        "Referenzen müssen zuerst sicher hochgeladen werden.",
        415,
      );
    }
    const parsed = ugcGenerateRequestSchema.parse(await request.json());
    const { jobId, setup } = parsed;
    let providerSetup = setup;
    if (
      parsed.tempReferences.length !== setup.references.length ||
      parsed.tempReferences.some(
        (entry, index) => entry.referenceId !== setup.references[index]?.id,
      )
    ) {
      throw new UgcVideoGenerationError(
        "REFERENCE_INVALID",
        "Die Referenzen konnten nicht eindeutig zugeordnet werden.",
        400,
      );
    }
    const resolvedReferences = await resolveTempReferences({
      context: access.context,
      studio: "UGC_VIDEO_STUDIO",
      entries: parsed.tempReferences,
      jobId,
    });
    let references: UgcVideoProviderReference[] = resolvedReferences.map(
      (reference, index) => ({
        metadata: setup.references[index]!,
        bytes: reference.bytes,
        providerUrl: reference.providerUrl,
      }),
    );

    if (setup.modelId === "kling-v3-pro-motion-control") {
      const motion = resolveKlingMotionReferences(setup).motionVideo;
      const motionReference = motion
        ? references.find((reference) => reference.metadata.id === motion.id)
        : null;
      if (!motion || !motionReference) {
        throw new XerianoCustomerGenerationError(
          "VIDEO_DURATION_REQUIRED",
          "Die Dauer des Bewegungs-Referenzvideos konnte nicht bestimmt werden.",
          400,
        );
      }
      const motionId = motion.id;
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
      const trustedSetup = {
        ...setup,
        references: setup.references.map((reference) =>
          reference.id === motionId
            ? { ...reference, durationSeconds: trustedDuration }
            : reference,
        ),
      };
      if (customer) {
        customerQuote = quoteUgcCustomerGeneration(trustedSetup, trustedDuration);
      }
      let prepared;
      try {
        prepared = prepareKlingMotionMedia({
          setup: trustedSetup,
          references,
          trustedSourceDurationSeconds: trustedDuration,
        });
      } catch {
        throw new XerianoCustomerGenerationError(
          "VIDEO_DURATION_INVALID",
          "Das Bewegungs-Referenzvideo konnte nicht sicher auf die gewählte Länge vorbereitet werden.",
          400,
        );
      }
      providerSetup = prepared.setup;
      references = prepared.references;
    }

    if (customer) {
      if (!customerQuote) {
        customerQuote = quoteUgcCustomerGeneration(providerSetup);
      }
      customerJobId = jobId;
      customerAuthority = await reserveCustomerGeneration({
        context: access.context,
        jobId,
        quote: customerQuote,
      });
    }

    await bindTempReferences({
      context: access.context,
      referenceIds: resolvedReferences.map((reference) => reference.authorityId),
      jobId,
    });

    const run = await generateUgcVideoJob(
      {
        scope: {
          workspaceId: access.context.workspaceKey,
          actorId: access.context.userId,
        },
        jobId,
        setup: providerSetup,
        references,
      },
      ownerUnlimited
        ? { costLimitPolicy: "OWNER_ESTIMATE_ONLY" }
        : {},
    );
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
        error instanceof XerianoTempReferenceError ||
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
    if (error instanceof XerianoTempReferenceError) {
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
