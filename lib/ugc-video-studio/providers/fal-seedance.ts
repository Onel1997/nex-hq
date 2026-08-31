import { ApiError, createFalClient, type FalClient } from "@fal-ai/client";

import {
  UGC_VIDEO_REFERENCE_ROLE_LABELS,
  UGC_VIDEO_TYPE_LABELS,
  type UgcVideoGenerationSetup,
  type UgcVideoResult,
} from "@/lib/ugc-video-studio/contracts";
import {
  sanitizeFalProviderError,
  sanitizeFalQueueText,
} from "@/lib/ugc-video-studio/provider-diagnostics";
import type {
  UgcVideoProvider,
  UgcVideoProviderReference,
  UgcVideoProviderRequest,
  UgcVideoProviderResponse,
  UgcVideoProviderStatus,
  UgcVideoProviderSubmission,
} from "@/lib/ugc-video-studio/provider";
import { UgcVideoProviderDiagnosticError } from "@/lib/ugc-video-studio/provider";
import { UgcVideoProviderSubmitUnknownOutcomeError } from "@/lib/ugc-video-studio/provider";
import { SEEDANCE_25_REFERENCE_MODEL_ID } from "@/lib/ugc-video-studio/seedance-config";

export type FalSeedanceInput = {
  prompt: string;
  image_urls?: string[];
  video_urls?: string[];
  audio_urls?: string[];
  resolution: "480p" | "720p" | "1080p";
  duration: UgcVideoGenerationSetup["duration"];
  aspect_ratio: "auto" | "21:9" | "16:9" | "4:3" | "1:1" | "3:4" | "9:16";
  generate_audio: boolean;
  bitrate_mode: "standard" | "high";
  seed?: number;
  end_user_id: string;
};

export type FalSeedanceOutput = {
  video: {
    url: string;
    content_type?: string;
    file_name?: string;
    file_size?: number;
  };
  seed: number;
};

export type FalSeedanceTransport = {
  uploadReference(reference: UgcVideoProviderReference): Promise<string>;
  submit(
    endpoint: typeof SEEDANCE_25_REFERENCE_MODEL_ID,
    input: FalSeedanceInput,
  ): Promise<{
    requestId: string;
    statusUrl: string | null;
    responseUrl: string | null;
    cancelUrl: string | null;
    queuePosition: number | null;
  }>;
  status(
    endpoint: typeof SEEDANCE_25_REFERENCE_MODEL_ID,
    requestId: string,
  ): Promise<{
    status: "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED" | "FAILED";
    queuePosition: number | null;
    error: string | null;
    logs: UgcVideoProviderStatus["logs"];
    inferenceTimeSeconds: number | null;
    metrics: string | null;
    truncated: boolean;
  }>;
  result(
    endpoint: typeof SEEDANCE_25_REFERENCE_MODEL_ID,
    requestId: string,
  ): Promise<{ requestId: string; data: FalSeedanceOutput }>;
};

function createDefaultTransport(credentials: string): FalSeedanceTransport {
  const client: FalClient = createFalClient({ credentials });
  return {
    async uploadReference(reference) {
      if (reference.providerUrl) return reference.providerUrl;
      const copy = Uint8Array.from(reference.bytes);
      const blob = new Blob([copy], { type: reference.metadata.mimeType });
      return client.storage.upload(blob, {
        lifecycle: { expiresIn: "1d" },
      });
    },
    async submit(endpoint, input) {
      const queued = await client.queue.submit(endpoint, {
        input,
        storageSettings: { expiresIn: "1d" },
      });
      return {
        requestId: queued.request_id,
        statusUrl: queued.status_url ?? null,
        responseUrl: queued.response_url ?? null,
        cancelUrl: queued.cancel_url ?? null,
        queuePosition: queued.queue_position ?? null,
      };
    },
    async status(endpoint, requestId) {
      try {
        const status = await client.queue.status(endpoint, {
          requestId,
          logs: true,
        });
        const rawLogs = "logs" in status && Array.isArray(status.logs)
          ? status.logs
          : [];
        const logs = rawLogs.slice(-20).map((log) => ({
          level: log.level,
          message: sanitizeFalQueueText(log.message),
          timestamp: log.timestamp,
        }));
        const rawMetrics = "metrics" in status ? status.metrics : undefined;
        const metrics = rawMetrics
          ? sanitizeFalQueueText(JSON.stringify(rawMetrics)).slice(0, 4096)
          : null;
        const common = {
          logs,
          inferenceTimeSeconds:
            rawMetrics && typeof rawMetrics.inference_time === "number"
              ? rawMetrics.inference_time
              : null,
          metrics,
          truncated: rawLogs.length > logs.length,
          error: null,
        };
        if (status.status === "IN_QUEUE") {
          return {
            ...common,
            status: "IN_QUEUE" as const,
            queuePosition: status.queue_position ?? null,
          };
        }
        if (status.status === "IN_PROGRESS") {
          return {
            ...common,
            status: "IN_PROGRESS" as const,
            queuePosition: null,
          };
        }
        return {
          ...common,
          status: "COMPLETED" as const,
          queuePosition: null,
        };
      } catch (error) {
        throw new UgcVideoProviderDiagnosticError(
          sanitizeFalProviderError({
            error,
            phase: "STATUS",
            endpoint,
            requestId,
          }),
          false,
        );
      }
    },
    async result(endpoint, requestId) {
      try {
        const result = await client.queue.result(endpoint, { requestId });
        return {
          requestId: result.requestId,
          data: result.data as FalSeedanceOutput,
        };
      } catch (error) {
        if (
          error instanceof ApiError &&
          error.status >= 400 &&
          error.status < 600
        ) {
          throw new UgcVideoProviderDiagnosticError(
            sanitizeFalProviderError({
              error,
              phase: "RESULT",
              endpoint,
              requestId,
            }),
            true,
          );
        }
        throw new UgcVideoProviderDiagnosticError(
          sanitizeFalProviderError({
            error,
            phase: "RESULT",
            endpoint,
            requestId,
          }),
          false,
        );
      }
    },
  };
}

type UploadedReferences = {
  imageUrls: string[];
  videoUrls: string[];
  audioUrls: string[];
  promptReferenceById: Map<string, string>;
};

export function mapSeedanceReferences(
  orderedReferences: UgcVideoProviderReference[],
  uploadedUrls: string[],
): UploadedReferences {
  const imageUrls: string[] = [];
  const videoUrls: string[] = [];
  const audioUrls: string[] = [];
  const promptReferenceById = new Map<string, string>();
  orderedReferences.forEach((reference, index) => {
    const url = uploadedUrls[index]!;
    if (reference.metadata.mediaType === "IMAGE") {
      imageUrls.push(url);
      promptReferenceById.set(reference.metadata.id, `@Image${imageUrls.length}`);
    } else if (reference.metadata.mediaType === "VIDEO") {
      videoUrls.push(url);
      promptReferenceById.set(reference.metadata.id, `@Video${videoUrls.length}`);
    } else {
      audioUrls.push(url);
      promptReferenceById.set(reference.metadata.id, `@Audio${audioUrls.length}`);
    }
  });
  return { imageUrls, videoUrls, audioUrls, promptReferenceById };
}

/** The first block is always the owner's exact prompt, unchanged. */
export function buildSeedanceProviderPrompt(input: {
  setup: UgcVideoGenerationSetup;
  promptReferenceById: ReadonlyMap<string, string>;
}): string {
  const referenceHints = [...input.setup.references]
    .sort((a, b) => a.order - b.order)
    .map((reference) => {
      const providerLabel = input.promptReferenceById.get(reference.id);
      const role = UGC_VIDEO_REFERENCE_ROLE_LABELS[reference.role];
      return providerLabel
        ? `${reference.order + 1}. ${providerLabel}${reference.role === "NONE" ? "" : ` — optionale Rolle: ${role}`}`
        : null;
    })
    .filter((value): value is string => Boolean(value));
  const context = [
    `Video-Typ: ${UGC_VIDEO_TYPE_LABELS[input.setup.videoType]}.`,
    referenceHints.length
      ? `Referenzreihenfolge:\n${referenceHints.join("\n")}`
      : null,
    input.setup.advanced.negativePrompt.trim()
      ? `Nach Möglichkeit vermeiden: ${input.setup.advanced.negativePrompt.trim()}`
      : null,
  ].filter((value): value is string => Boolean(value));
  return `${input.setup.prompt}\n\nOptionale NexHQ-Kontexthinweise:\n${context.join("\n")}`;
}

export function buildSeedanceInput(input: {
  setup: UgcVideoGenerationSetup;
  providerPrompt: string;
  references: UploadedReferences;
  endUserId: string;
}): FalSeedanceInput {
  return {
    prompt: input.providerPrompt,
    ...(input.references.imageUrls.length
      ? { image_urls: input.references.imageUrls }
      : {}),
    ...(input.references.videoUrls.length
      ? { video_urls: input.references.videoUrls }
      : {}),
    ...(input.references.audioUrls.length
      ? { audio_urls: input.references.audioUrls }
      : {}),
    resolution: input.setup.quality,
    duration: input.setup.duration,
    aspect_ratio:
      input.setup.aspectRatio === "AUTO" ? "auto" : input.setup.aspectRatio,
    generate_audio: input.setup.advanced.generateAudio,
    bitrate_mode: input.setup.bitrate === "HIGH" ? "high" : "standard",
    ...(input.setup.advanced.seed === null
      ? {}
      : { seed: input.setup.advanced.seed }),
    end_user_id: input.endUserId,
  };
}

export class FalSeedanceSubmitUnknownOutcomeError extends UgcVideoProviderSubmitUnknownOutcomeError {
  readonly causeMessage: string;

  constructor(diagnostic: ReturnType<typeof sanitizeFalProviderError>) {
    super(diagnostic);
    this.name = "FalSeedanceSubmitUnknownOutcomeError";
    this.causeMessage = diagnostic.providerMessage;
  }
}

function normalizeResult(
  output: FalSeedanceOutput,
  providerRequestId: string,
  setup: UgcVideoGenerationSetup,
): UgcVideoResult {
  return {
    id: `${providerRequestId}-video`,
    url: output.video.url,
    downloadUrl: output.video.url,
    mimeType: output.video.content_type ?? "video/mp4",
    width: null,
    height: null,
    durationSeconds: Number(setup.duration),
    byteLength: output.video.file_size ?? null,
    favorite: false,
    provider: "fal",
    providerModel: SEEDANCE_25_REFERENCE_MODEL_ID,
    providerRequestId,
  };
}

export class FalSeedanceProvider implements UgcVideoProvider {
  readonly providerId = "fal" as const;

  constructor(
    private readonly credentials: string | undefined = process.env.FAL_KEY,
    private readonly transport: FalSeedanceTransport | null = null,
  ) {}

  isConfigured(): boolean {
    return Boolean(this.credentials?.trim() || this.transport);
  }

  private transportInstance(): FalSeedanceTransport {
    if (!this.isConfigured()) throw new Error("FAL_KEY ist nicht eingerichtet.");
    return this.transport ?? createDefaultTransport(this.credentials!.trim());
  }

  async submit(
    request: UgcVideoProviderRequest,
  ): Promise<UgcVideoProviderSubmission> {
    const transport = this.transportInstance();
    const orderedReferences = [...request.references].sort(
      (a, b) => a.metadata.order - b.metadata.order,
    );
    const uploadedUrls: string[] = [];
    try {
      for (const reference of orderedReferences) {
        uploadedUrls.push(
          reference.providerUrl ?? (await transport.uploadReference(reference)),
        );
      }
    } catch (error) {
      throw new UgcVideoProviderDiagnosticError(
        sanitizeFalProviderError({
          error,
          phase: "SUBMIT",
          endpoint: SEEDANCE_25_REFERENCE_MODEL_ID,
          requestId: null,
        }),
        true,
      );
    }
    const mapped = mapSeedanceReferences(orderedReferences, uploadedUrls);
    const providerPrompt = buildSeedanceProviderPrompt({
      setup: request.setup,
      promptReferenceById: mapped.promptReferenceById,
    });
    const payload = buildSeedanceInput({
      setup: request.setup,
      providerPrompt,
      references: mapped,
      endUserId: request.endUserId,
    });

    try {
      const submitted = await transport.submit(
        SEEDANCE_25_REFERENCE_MODEL_ID,
        payload,
      );
      return {
        provider: "fal",
        providerModel: SEEDANCE_25_REFERENCE_MODEL_ID,
        providerRequestId: submitted.requestId,
        providerPrompt,
        referenceOrder: orderedReferences.map(
          (reference) => reference.metadata.id,
        ),
        providerStatus: "IN_QUEUE",
        statusUrl: submitted.statusUrl,
        responseUrl: submitted.responseUrl,
        cancelUrl: submitted.cancelUrl,
        queuePosition: submitted.queuePosition,
      };
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.status >= 400 &&
        error.status < 500 &&
        error.status !== 408 &&
        error.status !== 429
      ) {
        throw new UgcVideoProviderDiagnosticError(
          sanitizeFalProviderError({
            error,
            phase: "SUBMIT",
            endpoint: SEEDANCE_25_REFERENCE_MODEL_ID,
            requestId: null,
          }),
          true,
        );
      }
      throw new FalSeedanceSubmitUnknownOutcomeError(
        sanitizeFalProviderError({
          error,
          phase: "SUBMIT",
          endpoint: SEEDANCE_25_REFERENCE_MODEL_ID,
          requestId: null,
        }),
      );
    }
  }

  async getStatus(providerRequestId: string): Promise<UgcVideoProviderStatus> {
    return this.transportInstance().status(
      SEEDANCE_25_REFERENCE_MODEL_ID,
      providerRequestId,
    );
  }

  async getResult(input: {
    providerRequestId: string;
    setup: UgcVideoGenerationSetup;
    providerPrompt: string;
    referenceOrder: string[];
  }): Promise<UgcVideoProviderResponse> {
    let response: Awaited<ReturnType<FalSeedanceTransport["result"]>>;
    try {
      response = await this.transportInstance().result(
        SEEDANCE_25_REFERENCE_MODEL_ID,
        input.providerRequestId,
      );
    } catch (error) {
      if (error instanceof UgcVideoProviderDiagnosticError) throw error;
      const diagnostic = sanitizeFalProviderError({
        error,
        phase: "RESULT",
        endpoint: SEEDANCE_25_REFERENCE_MODEL_ID,
        requestId: input.providerRequestId,
      });
      throw new UgcVideoProviderDiagnosticError(
        diagnostic,
        error instanceof ApiError && error.status >= 400 && error.status < 600,
      );
    }
    return {
      provider: "fal",
      providerModel: SEEDANCE_25_REFERENCE_MODEL_ID,
      providerRequestId: input.providerRequestId,
      providerPrompt: input.providerPrompt,
      referenceOrder: input.referenceOrder,
      result: normalizeResult(
        response.data,
        input.providerRequestId,
        input.setup,
      ),
      actualCostUsd: null,
    };
  }
}
