import { ApiError, createFalClient, type FalClient } from "@fal-ai/client";

import type {
  UgcVideoGenerationSetup,
  UgcVideoResult,
} from "@/lib/ugc-video-studio/contracts";
import {
  assertKlingMotionReferences,
  KLING_V3_PRO_MOTION_CONTROL_MODEL_ID,
  type KlingMotionReferenceResolution,
} from "@/lib/ugc-video-studio/kling-motion-config";
import {
  sanitizeFalProviderError,
  sanitizeFalQueueText,
} from "@/lib/ugc-video-studio/provider-diagnostics";
import {
  UgcVideoProviderDiagnosticError,
  UgcVideoProviderSubmitUnknownOutcomeError,
  type UgcVideoProvider,
  type UgcVideoProviderReference,
  type UgcVideoProviderRequest,
  type UgcVideoProviderResponse,
  type UgcVideoProviderStatus,
  type UgcVideoProviderSubmission,
} from "@/lib/ugc-video-studio/provider";

export type FalKlingMotionControlInput = {
  prompt?: string;
  image_url: string;
  video_url: string;
  keep_original_sound: boolean;
  character_orientation: "image" | "video";
  elements?: Array<{
    frontal_image_url: string;
  }>;
};

export type FalKlingMotionControlOutput = {
  video: {
    url: string;
    content_type?: string;
    file_name?: string;
    file_size?: number;
  };
};

export type FalKlingMotionControlTransport = {
  uploadReference(reference: UgcVideoProviderReference): Promise<string>;
  submit(
    endpoint: typeof KLING_V3_PRO_MOTION_CONTROL_MODEL_ID,
    input: FalKlingMotionControlInput,
  ): Promise<{
    requestId: string;
    statusUrl: string | null;
    responseUrl: string | null;
    cancelUrl: string | null;
    queuePosition: number | null;
  }>;
  status(
    endpoint: typeof KLING_V3_PRO_MOTION_CONTROL_MODEL_ID,
    requestId: string,
  ): Promise<UgcVideoProviderStatus>;
  result(
    endpoint: typeof KLING_V3_PRO_MOTION_CONTROL_MODEL_ID,
    requestId: string,
  ): Promise<{ requestId: string; data: FalKlingMotionControlOutput }>;
};

function createDefaultTransport(
  credentials: string,
): FalKlingMotionControlTransport {
  const client: FalClient = createFalClient({ credentials });
  return {
    async uploadReference(reference) {
      const blob = new Blob([Uint8Array.from(reference.bytes)], {
        type: reference.metadata.mimeType,
      });
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
        const rawLogs =
          "logs" in status && Array.isArray(status.logs) ? status.logs : [];
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
          data: result.data as FalKlingMotionControlOutput,
        };
      } catch (error) {
        throw new UgcVideoProviderDiagnosticError(
          sanitizeFalProviderError({
            error,
            phase: "RESULT",
            endpoint,
            requestId,
          }),
          error instanceof ApiError && error.status >= 400 && error.status < 600,
        );
      }
    },
  };
}

function providerReference(
  references: UgcVideoProviderReference[],
  id: string,
): UgcVideoProviderReference {
  const reference = references.find((item) => item.metadata.id === id);
  if (!reference) throw new Error(`kling_reference_bytes_missing:${id}`);
  return reference;
}

export function buildKlingMotionProviderPrompt(input: {
  setup: UgcVideoGenerationSetup;
  identityElementBound: boolean;
}): string {
  if (!input.identityElementBound) return input.setup.prompt;
  return `${input.setup.prompt}\n\nOptionale NexHQ-Kontexthinweise:\n@Element1 dient ausschließlich als zusätzliche Identitätsreferenz für stabilere Gesichtszüge.`;
}

export function buildKlingMotionInput(input: {
  setup: UgcVideoGenerationSetup;
  providerPrompt: string;
  characterImageUrl: string;
  motionVideoUrl: string;
  identityElementUrl: string | null;
}): FalKlingMotionControlInput {
  const useElement =
    input.setup.klingMotion.characterOrientation === "VIDEO" &&
    input.setup.klingMotion.faceBindingEnabled &&
    Boolean(input.identityElementUrl);
  return {
    ...(input.providerPrompt.trim() ? { prompt: input.providerPrompt } : {}),
    image_url: input.characterImageUrl,
    video_url: input.motionVideoUrl,
    character_orientation:
      input.setup.klingMotion.characterOrientation === "VIDEO"
        ? "video"
        : "image",
    keep_original_sound: input.setup.klingMotion.keepOriginalSound,
    ...(useElement
      ? {
          elements: [
            {
              frontal_image_url: input.identityElementUrl!,
            },
          ],
        }
      : {}),
  };
}

function selectedProviderReferences(input: {
  resolution: KlingMotionReferenceResolution;
  references: UgcVideoProviderReference[];
}): UgcVideoProviderReference[] {
  const selected = [
    providerReference(input.references, input.resolution.characterImage!.id),
    providerReference(input.references, input.resolution.motionVideo!.id),
  ];
  if (input.resolution.identityElement) {
    selected.push(
      providerReference(
        input.references,
        input.resolution.identityElement.id,
      ),
    );
  }
  return selected;
}

function normalizeResult(
  output: FalKlingMotionControlOutput,
  providerRequestId: string,
  setup: UgcVideoGenerationSetup,
): UgcVideoResult {
  const motionReference = assertKlingMotionReferences(setup).motionVideo;
  return {
    id: `${providerRequestId}-video`,
    url: output.video.url,
    downloadUrl: output.video.url,
    mimeType: output.video.content_type ?? "video/mp4",
    width: null,
    height: null,
    durationSeconds: motionReference?.durationSeconds ?? null,
    byteLength: output.video.file_size ?? null,
    favorite: false,
    provider: "fal",
    providerModel: KLING_V3_PRO_MOTION_CONTROL_MODEL_ID,
    providerRequestId,
  };
}

export class FalKlingMotionControlProvider implements UgcVideoProvider {
  readonly providerId = "fal" as const;

  constructor(
    private readonly credentials: string | undefined = process.env.FAL_KEY,
    private readonly transport: FalKlingMotionControlTransport | null = null,
  ) {}

  isConfigured(): boolean {
    return Boolean(this.credentials?.trim() || this.transport);
  }

  private transportInstance(): FalKlingMotionControlTransport {
    if (!this.isConfigured()) throw new Error("FAL_KEY ist nicht eingerichtet.");
    return this.transport ?? createDefaultTransport(this.credentials!.trim());
  }

  async submit(
    request: UgcVideoProviderRequest,
  ): Promise<UgcVideoProviderSubmission> {
    const resolution = assertKlingMotionReferences(request.setup);
    const selected = selectedProviderReferences({
      resolution,
      references: request.references,
    });
    const uploadedUrls: string[] = [];
    try {
      for (const reference of selected) {
        uploadedUrls.push(
          await this.transportInstance().uploadReference(reference),
        );
      }
    } catch (error) {
      throw new UgcVideoProviderDiagnosticError(
        sanitizeFalProviderError({
          error,
          phase: "SUBMIT",
          endpoint: KLING_V3_PRO_MOTION_CONTROL_MODEL_ID,
          requestId: null,
        }),
        true,
      );
    }
    const providerPrompt = buildKlingMotionProviderPrompt({
      setup: request.setup,
      identityElementBound: Boolean(resolution.identityElement),
    });
    const payload = buildKlingMotionInput({
      setup: request.setup,
      providerPrompt,
      characterImageUrl: uploadedUrls[0]!,
      motionVideoUrl: uploadedUrls[1]!,
      identityElementUrl: uploadedUrls[2] ?? null,
    });

    try {
      const submitted = await this.transportInstance().submit(
        KLING_V3_PRO_MOTION_CONTROL_MODEL_ID,
        payload,
      );
      return {
        provider: "fal",
        providerModel: KLING_V3_PRO_MOTION_CONTROL_MODEL_ID,
        providerRequestId: submitted.requestId,
        providerPrompt,
        referenceOrder: selected.map((reference) => reference.metadata.id),
        providerStatus: "IN_QUEUE",
        statusUrl: submitted.statusUrl,
        responseUrl: submitted.responseUrl,
        cancelUrl: submitted.cancelUrl,
        queuePosition: submitted.queuePosition,
      };
    } catch (error) {
      const diagnostic = sanitizeFalProviderError({
        error,
        phase: "SUBMIT",
        endpoint: KLING_V3_PRO_MOTION_CONTROL_MODEL_ID,
        requestId: null,
      });
      if (
        error instanceof ApiError &&
        error.status >= 400 &&
        error.status < 500 &&
        error.status !== 408 &&
        error.status !== 429
      ) {
        throw new UgcVideoProviderDiagnosticError(diagnostic, true);
      }
      throw new UgcVideoProviderSubmitUnknownOutcomeError(diagnostic);
    }
  }

  async getStatus(providerRequestId: string): Promise<UgcVideoProviderStatus> {
    return this.transportInstance().status(
      KLING_V3_PRO_MOTION_CONTROL_MODEL_ID,
      providerRequestId,
    );
  }

  async getResult(input: {
    providerRequestId: string;
    setup: UgcVideoGenerationSetup;
    providerPrompt: string;
    referenceOrder: string[];
  }): Promise<UgcVideoProviderResponse> {
    const response = await this.transportInstance().result(
      KLING_V3_PRO_MOTION_CONTROL_MODEL_ID,
      input.providerRequestId,
    );
    return {
      provider: "fal",
      providerModel: KLING_V3_PRO_MOTION_CONTROL_MODEL_ID,
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
