import { createFalClient, type FalClient } from "@fal-ai/client";
import type {
  NanoBananaOutput,
  NanoBananaProEditInput,
  NanoBananaProInput,
} from "@fal-ai/client/endpoints";

import {
  CREATIVE_OUTPUT_TYPE_LABELS,
  type CreativeGenerationSetup,
  type CreativeResult,
} from "@/lib/creative-studio/contracts";
import {
  NANO_BANANA_PRO_EDIT_MODEL_ID,
  NANO_BANANA_PRO_TEXT_MODEL_ID,
} from "@/lib/creative-studio/nano-banana-config";
import type {
  CreativeImageProvider,
  CreativeProviderRecoveryRequest,
  CreativeProviderReference,
  CreativeProviderRequest,
  CreativeProviderResponse,
} from "@/lib/creative-studio/provider";
import {
  logCreativeProviderDiagnostic,
  safeProviderStatus,
} from "@/lib/creative-studio/provider-diagnostics";

type NanoBananaEndpoint =
  | typeof NANO_BANANA_PRO_TEXT_MODEL_ID
  | typeof NANO_BANANA_PRO_EDIT_MODEL_ID;

export type NanoBananaProviderInput =
  | NanoBananaProInput
  | NanoBananaProEditInput;

export type FalNanoBananaTransport = {
  uploadReference(reference: CreativeProviderReference): Promise<string>;
  submit(
    endpoint: NanoBananaEndpoint,
    input: NanoBananaProviderInput,
  ): Promise<unknown>;
  wait(endpoint: NanoBananaEndpoint, requestId: string): Promise<void>;
  result(
    endpoint: NanoBananaEndpoint,
    requestId: string,
  ): Promise<{ requestId: string; data: NanoBananaOutput }>;
};

function createDefaultTransport(credentials: string): FalNanoBananaTransport {
  const client: FalClient = createFalClient({ credentials });
  return {
    async uploadReference(reference) {
      const copy = Uint8Array.from(reference.bytes);
      const blob = new Blob([copy], { type: reference.metadata.mimeType });
      return client.storage.upload(blob, {
        lifecycle: { expiresIn: "1d" },
      });
    },
    async submit(endpoint, input) {
      return client.queue.submit(endpoint, {
        input,
        storageSettings: { expiresIn: "1d" },
      });
    },
    async wait(endpoint, requestId) {
      await client.queue.subscribeToStatus(endpoint, {
        requestId,
        mode: "polling",
        pollInterval: 1_000,
        logs: false,
      });
    },
    async result(endpoint, requestId) {
      const result = await client.queue.result(endpoint, { requestId });
      return { requestId: result.requestId, data: result.data };
    },
  };
}

export function extractFalQueueRequestId(
  value: unknown,
  seen: Set<object> = new Set(),
): string | null {
  if (!value || typeof value !== "object") return null;
  if (seen.has(value)) return null;
  seen.add(value);
  const record = value as Record<string, unknown>;
  const direct = [record.request_id, record.requestId].find(
    (candidate): candidate is string =>
      typeof candidate === "string" && candidate.trim().length > 0,
  );
  if (direct) return direct;
  for (const nestedKey of ["queue", "data", "response"] as const) {
    const nested = record[nestedKey];
    if (nested && typeof nested === "object") {
      const nestedId = extractFalQueueRequestId(nested, seen);
      if (nestedId) return nestedId;
    }
  }
  return null;
}

function requestIdFromError(error: unknown): string | null {
  return extractFalQueueRequestId(error);
}

function isDefinitePreAcceptanceRejection(error: unknown): boolean {
  const status = safeProviderStatus(error);
  return status !== null && status >= 400 && status < 500;
}

export function mapCreativeAspectRatio(
  ratio: CreativeGenerationSetup["aspectRatio"],
): NanoBananaProInput["aspect_ratio"] {
  return ratio === "AUTO" ? "auto" : ratio;
}

/** The original prompt remains the first, verbatim authority block. */
export function buildNanoBananaProviderPrompt(
  setup: CreativeGenerationSetup,
): string {
  const roleHints = [...setup.references]
    .sort((a, b) => a.order - b.order)
    .filter((reference) => reference.role !== "NONE")
    .map(
      (reference) =>
        `Referenz ${reference.order + 1}: optionale Rolle ${reference.role.toLocaleLowerCase("de")}`,
    );
  const context = [
    `Bildtyp: ${CREATIVE_OUTPUT_TYPE_LABELS[setup.outputType]}.`,
    "Nutze Referenzen in der exakt übermittelten Reihenfolge. Der freie Prompt bleibt maßgeblich.",
    ...roleHints,
    setup.advanced.negativePrompt.trim()
      ? `Vermeide nach Möglichkeit: ${setup.advanced.negativePrompt.trim()}`
      : null,
  ].filter((line): line is string => Boolean(line));
  return `${setup.prompt}\n\nOptionale NexHQ-Kontexthinweise:\n${context.join("\n")}`;
}

export function buildNanoBananaInput(input: {
  setup: CreativeGenerationSetup;
  uploadedReferenceUrls: string[];
  providerPrompt: string;
}): { endpoint: NanoBananaEndpoint; payload: NanoBananaProviderInput } {
  const common = {
    prompt: input.providerPrompt,
    aspect_ratio: mapCreativeAspectRatio(input.setup.aspectRatio),
    resolution: input.setup.quality,
    num_images: input.setup.batchSize,
    output_format: "png" as const,
    safety_tolerance: "4" as const,
    enable_web_search: false,
    limit_generations: true,
    sync_mode: false,
    ...(input.setup.advanced.seed === null
      ? {}
      : { seed: input.setup.advanced.seed }),
  };
  return input.uploadedReferenceUrls.length
    ? {
        endpoint: NANO_BANANA_PRO_EDIT_MODEL_ID,
        payload: { ...common, image_urls: input.uploadedReferenceUrls },
      }
    : { endpoint: NANO_BANANA_PRO_TEXT_MODEL_ID, payload: common };
}

function normalizeResults(
  output: NanoBananaOutput,
  providerRequestId: string,
  providerModel: NanoBananaEndpoint,
): CreativeResult[] {
  return output.images.map((image, index) => ({
    id: `${providerRequestId}-${index + 1}`,
    url: image.url,
    downloadUrl: image.url,
    mimeType: image.content_type ?? "image/png",
    width: image.width ?? null,
    height: image.height ?? null,
    favorite: false,
    provider: "fal",
    providerModel,
    providerRequestId,
  }));
}

export class FalNanoBananaUnknownOutcomeError extends Error {
  readonly code = "CREATIVE_PROVIDER_UNKNOWN_OUTCOME" as const;

  constructor(
    readonly providerRequestId: string | null,
    readonly causeMessage: string,
  ) {
    super("Der Anbieterstatus ist nach der Übermittlung nicht eindeutig.");
    this.name = "FalNanoBananaUnknownOutcomeError";
  }
}

export class FalNanoBananaProvider implements CreativeImageProvider {
  readonly providerId = "fal" as const;

  constructor(
    private readonly credentials: string | undefined = process.env.FAL_KEY,
    private readonly transport: FalNanoBananaTransport | null = null,
  ) {}

  isConfigured(): boolean {
    return Boolean(this.credentials?.trim() || this.transport);
  }

  async generate(
    request: CreativeProviderRequest,
  ): Promise<CreativeProviderResponse> {
    if (!this.isConfigured()) throw new Error("FAL_KEY ist nicht eingerichtet.");
    const transport =
      this.transport ?? createDefaultTransport(this.credentials!.trim());
    const orderedReferences = [...request.references].sort(
      (a, b) => a.metadata.order - b.metadata.order,
    );
    const uploadedReferenceUrls: string[] = [];
    for (const reference of orderedReferences) {
      uploadedReferenceUrls.push(await transport.uploadReference(reference));
    }

    const providerPrompt = buildNanoBananaProviderPrompt(request.setup);
    const { endpoint, payload } = buildNanoBananaInput({
      setup: request.setup,
      uploadedReferenceUrls,
      providerPrompt,
    });
    let providerRequestId: string | null = null;
    try {
      const submitted = await transport.submit(endpoint, payload);
      providerRequestId = extractFalQueueRequestId(submitted);
      if (!providerRequestId) {
        throw new FalNanoBananaUnknownOutcomeError(
          null,
          "provider_acceptance_id_missing",
        );
      }
      logCreativeProviderDiagnostic("provider_accepted", {
        stage: "queue_submit",
        modelCode: endpoint,
        financialMode: request.financialMode ?? "INTERNAL",
        providerAccepted: true,
        requestIdPresent: true,
        normalizedErrorCode: null,
        providerStatus: null,
        jobId: request.clientRequestId,
      });
      await request.onProviderRequestId?.(providerRequestId);
      await transport.wait(endpoint, providerRequestId);
      const response = await transport.result(endpoint, providerRequestId);
      return {
        provider: "fal",
        providerModel: endpoint,
        providerRequestId,
        providerPrompt,
        referenceOrder: orderedReferences.map(
          (reference) => reference.metadata.id,
        ),
        results: normalizeResults(response.data, providerRequestId, endpoint),
      };
    } catch (error) {
      if (error instanceof FalNanoBananaUnknownOutcomeError) {
        logCreativeProviderDiagnostic("acceptance_unconfirmed", {
          stage: "queue_submit",
          modelCode: endpoint,
          financialMode: request.financialMode ?? "INTERNAL",
          providerAccepted: Boolean(error.providerRequestId),
          requestIdPresent: Boolean(error.providerRequestId),
          normalizedErrorCode: "PROVIDER_ACCEPTANCE_ID_MISSING",
          providerStatus: null,
          jobId: request.clientRequestId,
        });
        throw error;
      }
      const errorRequestId = providerRequestId ?? requestIdFromError(error);
      if (!providerRequestId && isDefinitePreAcceptanceRejection(error)) {
        throw error;
      }
      logCreativeProviderDiagnostic("acceptance_unconfirmed", {
        stage: providerRequestId ? "provider_completion" : "queue_submit",
        modelCode: endpoint,
        financialMode: request.financialMode ?? "INTERNAL",
        providerAccepted: Boolean(errorRequestId),
        requestIdPresent: Boolean(errorRequestId),
        normalizedErrorCode: providerRequestId
          ? "PROVIDER_COMPLETION_AMBIGUOUS"
          : "PROVIDER_SUBMISSION_AMBIGUOUS",
        providerStatus: safeProviderStatus(error),
        jobId: request.clientRequestId,
      });
      throw new FalNanoBananaUnknownOutcomeError(
        errorRequestId,
        providerRequestId
          ? "provider_completion_ambiguous"
          : "provider_submission_ambiguous",
      );
    }
  }

  async recover(
    request: CreativeProviderRecoveryRequest,
  ): Promise<CreativeProviderResponse> {
    if (!this.isConfigured()) throw new Error("FAL_KEY ist nicht eingerichtet.");
    const transport =
      this.transport ?? createDefaultTransport(this.credentials!.trim());
    const endpoint = request.setup.references.length
      ? NANO_BANANA_PRO_EDIT_MODEL_ID
      : NANO_BANANA_PRO_TEXT_MODEL_ID;
    try {
      await transport.wait(endpoint, request.providerRequestId);
      const response = await transport.result(endpoint, request.providerRequestId);
      return {
        provider: "fal",
        providerModel: endpoint,
        providerRequestId: request.providerRequestId,
        providerPrompt: request.providerPrompt,
        referenceOrder: request.referenceOrder,
        results: normalizeResults(
          response.data,
          request.providerRequestId,
          endpoint,
        ),
      };
    } catch {
      throw new FalNanoBananaUnknownOutcomeError(
        request.providerRequestId,
        "provider_reconciliation_ambiguous",
      );
    }
  }
}
