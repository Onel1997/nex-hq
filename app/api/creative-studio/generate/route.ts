import { NextResponse } from "next/server";
import { ZodError } from "zod";

import {
  hasXerianoAccountMembership,
  resolveXerianoAccess,
} from "@/lib/xeriano/auth";
import { authorizeXerianoGeneration } from "@/lib/xeriano/credit-guard";
import {
  customerCreditReceipt,
  loadCustomerAvailableCredits,
  quoteCreativeCustomerGeneration,
  reconcileCustomerGenerationFromRun,
  redactCreativeRunForCustomer,
  releaseCustomerGenerationBeforeProvider,
  reserveCustomerGeneration,
  XerianoCustomerGenerationError,
  type XerianoCustomerCreditQuote,
  type XerianoGenerationAuthority,
} from "@/lib/xeriano/customer-generation";
import {
  CREATIVE_GENERATION_HTTP_MAX_BYTES,
  creativeGenerationSetupSchema,
  creativeReferenceSnapshotSchema,
  type CreativeReferenceMetadata,
} from "@/lib/creative-studio/contracts";
import {
  CreativeGenerationError,
  generateCreativeJob,
} from "@/lib/creative-studio/generation-service";
import { logCreativeProviderDiagnostic } from "@/lib/creative-studio/provider-diagnostics";
import { CreativeCostCapError } from "@/lib/creative-studio/nano-banana-config";
import type { CreativeProviderReference } from "@/lib/creative-studio/provider";
import {
  assertXerianoCreationAuthorityReady,
  finalizeCreativeCreations,
  prepareCreativeCreationReferences,
  XerianoCreationError,
} from "@/lib/xeriano/creation-service";

export const runtime = "nodejs";
export const maxDuration = 300;

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
      error: "Bitte melde dich erneut an, um Bilder zu generieren.",
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
  const accountCreationMode =
    hasXerianoAccountMembership(access.context) &&
    (customer || ownerUnlimited);
  let customerAuthority: XerianoGenerationAuthority | null = null;
  let customerQuote: XerianoCustomerCreditQuote | null = null;
  let customerJobId: string | null = null;
  let creativeRunObserved = false;

  try {
    const declaredRequestBytes = Number(request.headers.get("content-length") ?? 0);
    if (
      Number.isFinite(declaredRequestBytes) &&
      declaredRequestBytes > CREATIVE_GENERATION_HTTP_MAX_BYTES
    ) {
      return errorResponse({
        error:
          "Die Übertragung der ausgewählten Referenzen ist zu groß. Bitte verwende kleinere Dateien oder weniger Referenzen.",
        code: "REQUEST_PAYLOAD_TOO_LARGE",
        status: 413,
      });
    }
    const formData = await request.formData();
    const jobId = formData.get("jobId");
    const setupJson = formData.get("setup");
    if (typeof jobId !== "string" || typeof setupJson !== "string") {
      throw new CreativeGenerationError(
        "INVALID_REQUEST",
        "Der Generierungsauftrag ist unvollständig.",
        400,
      );
    }
    const setup = creativeGenerationSetupSchema.parse(JSON.parse(setupJson));
    const rawReferenceSnapshot = formData.get("referenceSnapshot");
    const referenceSnapshot =
      accountCreationMode && typeof rawReferenceSnapshot === "string"
        ? creativeReferenceSnapshotSchema.parse(JSON.parse(rawReferenceSnapshot))
        : null;
    const files = formData.getAll("reference");
    const references: CreativeProviderReference[] = [];
    for (let index = 0; index < setup.references.length; index += 1) {
      const file = files[index];
      const metadata: CreativeReferenceMetadata = setup.references[index]!;
      if (
        !(file instanceof File) ||
        file.name !== metadata.name ||
        file.type.toLowerCase() !== metadata.mimeType.toLowerCase()
      ) {
        throw new CreativeGenerationError(
          "REFERENCE_INVALID",
          "Mindestens ein Referenzbild stimmt nicht mit dem Setup überein.",
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
      throw new CreativeGenerationError(
        "REFERENCE_INVALID",
        "Die Referenzbilder konnten nicht eindeutig zugeordnet werden.",
        400,
      );
    }

    if (accountCreationMode) {
      const canonicalQuote = quoteCreativeCustomerGeneration(setup);
      if (customer) customerQuote = canonicalQuote;
      customerJobId = jobId;
      await assertXerianoCreationAuthorityReady();
      if (customer) {
        customerAuthority = await reserveCustomerGeneration({
          context: access.context,
          jobId,
          quote: canonicalQuote,
        });
      }
      await prepareCreativeCreationReferences({
        context: access.context,
        scope: {
          workspaceId: access.context.workspaceKey,
          actorId: access.context.userId,
        },
        jobId,
        references,
        snapshot: referenceSnapshot,
      });
    }

    logCreativeProviderDiagnostic("submission_started", {
      stage: "generation_service",
      modelCode: setup.modelId,
      financialMode: ownerUnlimited
        ? "OWNER"
        : customer
          ? "CUSTOMER"
          : "INTERNAL",
      providerAccepted: false,
      requestIdPresent: false,
      normalizedErrorCode: null,
      providerStatus: null,
      jobId,
    });
    const run = await generateCreativeJob({
      scope: {
        workspaceId: access.context.workspaceKey,
        actorId: access.context.userId,
      },
      jobId,
      setup,
      references,
    }, {
      ...(ownerUnlimited
        ? { costLimitPolicy: "OWNER_ESTIMATE_ONLY" as const }
        : {}),
      financialMode: ownerUnlimited
        ? "OWNER"
        : customer
          ? "CUSTOMER"
          : "INTERNAL",
    });
    creativeRunObserved = true;
    if (customer) {
      customerAuthority = await reconcileCustomerGenerationFromRun({
        context: access.context,
        jobId,
        run,
      });
    }
    let creationSyncPending = false;
    if (
      accountCreationMode &&
      (customerAuthority || ownerUnlimited) &&
      (run.status === "SUCCEEDED" || run.status === "PARTIALLY_SUCCEEDED")
    ) {
      try {
        const creations = await finalizeCreativeCreations({
          context: access.context,
          scope: {
            workspaceId: access.context.workspaceKey,
            actorId: access.context.userId,
          },
          run,
          ...(customerAuthority ? { authority: customerAuthority } : {}),
          ...(ownerUnlimited
            ? { ownerUnlimitedPricingVersion: quoteCreativeCustomerGeneration(run.setup).pricingVersion }
            : {}),
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
      } catch (creationError) {
        // Provider/result authority is already terminal. Never hide a paid,
        // persisted result or alter its credit settlement because the outer
        // Creation projection needs a storage-only retry.
        creationSyncPending = true;
        console.error("[Xeriano] Creation finalization pending", {
          jobId,
          message:
            creationError instanceof Error ? creationError.message : "unknown",
        });
      }
    }
    const success =
      run.status === "SUCCEEDED" || run.status === "PARTIALLY_SUCCEEDED";
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
        success,
        run: customer ? redactCreativeRunForCustomer(run) : run,
        ...(credit ? { credit } : {}),
        ...(creationSyncPending ? { creationSyncPending: true } : {}),
        ...(!success ? { code: run.status } : {}),
      },
      { status: run.status === "RUNNING" ? 202 : 200 },
    );
  } catch (error) {
    if (customer && customerAuthority && customerJobId) {
      const definitelyBeforeProvider =
        (error instanceof CreativeGenerationError &&
          [
            "INVALID_REQUEST",
            "REFERENCE_LIMIT_EXCEEDED",
            "REFERENCE_INVALID",
            "PROVIDER_NOT_CONFIGURED",
          ].includes(error.code)) ||
        error instanceof CreativeCostCapError ||
        (error instanceof XerianoCreationError && !creativeRunObserved) ||
        error instanceof ZodError ||
        error instanceof SyntaxError ||
        (error instanceof Error &&
          /Creative (request claim|manifest write|storage setup|storage unavailable)/i.test(
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
        console.error("[Xeriano] Creative credit settlement failed", {
          jobId: customerJobId,
          message:
            settlementError instanceof Error
              ? settlementError.message
              : "unknown",
        });
      }
    }
    console.error("[Creative Studio] Generation request failed", {
      name: error instanceof Error ? error.name : "UnknownError",
      message: error instanceof Error ? error.message : "unknown",
      code:
        error instanceof CreativeGenerationError
          ? error.code
          : error instanceof CreativeCostCapError
            ? error.code
            : "CREATIVE_GENERATION_FAILED",
    });
    if (error instanceof CreativeGenerationError) {
      return errorResponse({
        error: error.message,
        code: error.code,
        status: error.status,
        technicalDetails: customer ? undefined : error.technicalDetails,
      });
    }
    if (error instanceof XerianoCustomerGenerationError) {
      return errorResponse({
        error: error.message,
        code: error.code,
        status: error.status,
      });
    }
    if (error instanceof XerianoCreationError) {
      return errorResponse({
        error: error.message,
        code: error.code,
        status:
          error.code === "XERIANO_CREATION_REFERENCE_INVALID" ? 400 : 503,
      });
    }
    if (error instanceof CreativeCostCapError) {
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
        error: "Bitte prüfe Prompt, Modell und Einstellungen.",
        code: "INVALID_REQUEST",
        status: 400,
      });
    }
    return errorResponse({
      error: "Das Bild konnte nicht erstellt werden.",
      code: "CREATIVE_GENERATION_FAILED",
      status: 500,
      technicalDetails:
        customer ? undefined : error instanceof Error ? error.message : "unknown",
    });
  }
}
