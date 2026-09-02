import { ApiError, createFalClient, type FalClient } from "@fal-ai/client";

import {
  HAILUO_23_FAST_I2V_ENDPOINT,
  HAILUO_23_STANDARD_T2V_ENDPOINT,
  KLING_25_TURBO_PRO_I2V_ENDPOINT,
  KLING_25_TURBO_PRO_T2V_ENDPOINT,
  PIXVERSE_C1_I2V_ENDPOINT,
  PIXVERSE_C1_T2V_ENDPOINT,
  SEEDANCE_2_FAST_I2V_ENDPOINT,
  SEEDANCE_2_FAST_T2V_ENDPOINT,
  WAN_22_A14B_I2V_ENDPOINT,
  WAN_22_A14B_T2V_ENDPOINT,
  assertUgcBaseVideoSetup,
  baseVideoEndpointForSetup,
  wanBaseVideoFramePreset,
  type FalBaseVideoEndpoint,
} from "@/lib/ugc-video-studio/base-video-config";
import type {
  UgcVideoGenerationSetup,
  UgcVideoResult,
} from "@/lib/ugc-video-studio/contracts";
import {
  sanitizeFalProviderError,
  sanitizeFalQueueText,
} from "@/lib/ugc-video-studio/provider-diagnostics";
import {
  UgcVideoProviderDiagnosticError,
  UgcVideoProviderSubmitUnknownOutcomeError,
  type UgcVideoProvider,
  type UgcVideoProviderQueueHandle,
  type UgcVideoProviderReference,
  type UgcVideoProviderRequest,
  type UgcVideoProviderResponse,
  type UgcVideoProviderStatus,
  type UgcVideoProviderSubmission,
} from "@/lib/ugc-video-studio/provider";

export const XERIAMO_BASE_VIDEO_FASHION_POLICY = [
  "Create an original fashion source video with fictional adult actors only.",
  "Preserve natural anatomy, realistic movement, clear clothing silhouettes and the requested framing.",
  "Use an original environment and do not add visible third-party logos, watermarks or text overlays unless the user explicitly requests text.",
  "When a continuous shot is requested, keep the camera and action stable without unnecessary cuts.",
].join("\n");

export function buildBaseVideoProviderPrompt(userPrompt: string): string {
  return `${userPrompt.trim()}\n\nXeriamo production guidance:\n${XERIAMO_BASE_VIDEO_FASHION_POLICY}`;
}

type HailuoTextInput = {
  prompt: string;
  prompt_optimizer: true;
  duration: "6" | "10";
};
type HailuoImageInput = HailuoTextInput & { image_url: string };
type PixVerseTextInput = {
  prompt: string;
  aspect_ratio: Exclude<UgcVideoGenerationSetup["aspectRatio"], "AUTO">;
  resolution: "720p";
  duration: number;
  generate_audio_switch: boolean;
};
type PixVerseImageInput = Omit<PixVerseTextInput, "aspect_ratio"> & {
  image_url: string;
};
type KlingTextInput = {
  prompt: string;
  duration: "5" | "10";
  aspect_ratio: "16:9" | "9:16" | "1:1";
  negative_prompt: string;
  cfg_scale: number;
};
type KlingImageInput = Omit<KlingTextInput, "aspect_ratio"> & {
  image_url: string;
};
type WanTextInput = {
  prompt: string;
  num_frames: 81 | 161;
  frames_per_second: 16;
  resolution: "480p" | "580p" | "720p";
  aspect_ratio: "16:9" | "9:16" | "1:1";
  enable_safety_checker: true;
  enable_output_safety_checker: true;
};
type WanImageInput = Omit<WanTextInput, "aspect_ratio"> & {
  image_url: string;
  aspect_ratio: "auto" | "16:9" | "9:16" | "1:1";
};
type SeedanceTextInput = {
  prompt: string;
  resolution: "480p" | "720p";
  duration: "5" | "10" | "15";
  aspect_ratio: "auto" | "21:9" | "16:9" | "4:3" | "1:1" | "3:4" | "9:16";
  generate_audio: boolean;
  bitrate_mode: "standard";
  end_user_id: string;
};
type SeedanceImageInput = SeedanceTextInput & { image_url: string };

export type FalBaseVideoInput =
  | HailuoTextInput
  | HailuoImageInput
  | PixVerseTextInput
  | PixVerseImageInput
  | KlingTextInput
  | KlingImageInput
  | WanTextInput
  | WanImageInput
  | SeedanceTextInput
  | SeedanceImageInput;

type FalBaseVideoOutput = {
  video: {
    url: string;
    content_type?: string;
    file_name?: string;
    file_size?: number;
    width?: number;
    height?: number;
    duration?: number;
  };
  seed?: number;
};

export function buildFalBaseVideoInput(input: {
  setup: UgcVideoGenerationSetup;
  startImageUrl: string | null;
  endUserId: string;
}): { endpoint: FalBaseVideoEndpoint; payload: FalBaseVideoInput; prompt: string } {
  const resolved = assertUgcBaseVideoSetup(input.setup);
  const endpoint = resolved.endpoint;
  const prompt = buildBaseVideoProviderPrompt(input.setup.prompt);
  const duration = input.setup.duration;
  const aspectRatio = input.setup.aspectRatio === "AUTO"
    ? "auto"
    : input.setup.aspectRatio;
  const resolution = input.setup.baseVideo.resolution;
  if (resolved.variant === "IMAGE_TO_VIDEO" && !input.startImageUrl) {
    throw new Error("UGC_BASE_VIDEO_START_IMAGE_URL_REQUIRED");
  }
  if (endpoint === HAILUO_23_STANDARD_T2V_ENDPOINT) {
    return {
      endpoint,
      prompt,
      payload: { prompt, prompt_optimizer: true, duration: duration as "6" | "10" },
    };
  }
  if (endpoint === HAILUO_23_FAST_I2V_ENDPOINT) {
    return {
      endpoint,
      prompt,
      payload: {
        prompt,
        prompt_optimizer: true,
        image_url: input.startImageUrl!,
        duration: duration as "6" | "10",
      },
    };
  }
  if (endpoint === PIXVERSE_C1_T2V_ENDPOINT) {
    return {
      endpoint,
      prompt,
      payload: {
        prompt,
        aspect_ratio: input.setup.aspectRatio as PixVerseTextInput["aspect_ratio"],
        resolution: "720p",
        duration: Number(duration),
        generate_audio_switch: input.setup.baseVideo.generateAudio,
      },
    };
  }
  if (endpoint === PIXVERSE_C1_I2V_ENDPOINT) {
    return {
      endpoint,
      prompt,
      payload: {
        prompt,
        image_url: input.startImageUrl!,
        resolution: "720p",
        duration: Number(duration),
        generate_audio_switch: input.setup.baseVideo.generateAudio,
      },
    };
  }
  if (endpoint === KLING_25_TURBO_PRO_T2V_ENDPOINT) {
    return {
      endpoint,
      prompt,
      payload: {
        prompt,
        duration: duration as "5" | "10",
        aspect_ratio: input.setup.aspectRatio as KlingTextInput["aspect_ratio"],
        negative_prompt: "blur, distort, low quality, watermark, text overlay, logo",
        cfg_scale: 0.5,
      },
    };
  }
  if (endpoint === KLING_25_TURBO_PRO_I2V_ENDPOINT) {
    return {
      endpoint,
      prompt,
      payload: {
        prompt,
        image_url: input.startImageUrl!,
        duration: duration as "5" | "10",
        negative_prompt: "blur, distort, low quality, watermark, text overlay, logo",
        cfg_scale: 0.5,
      },
    };
  }
  if (endpoint === WAN_22_A14B_T2V_ENDPOINT || endpoint === WAN_22_A14B_I2V_ENDPOINT) {
    const frames = wanBaseVideoFramePreset(duration);
    const common = {
      prompt,
      num_frames: frames.numFrames,
      frames_per_second: frames.framesPerSecond,
      resolution: resolution as WanTextInput["resolution"],
      enable_safety_checker: true as const,
      enable_output_safety_checker: true as const,
    };
    return endpoint === WAN_22_A14B_I2V_ENDPOINT
      ? {
          endpoint,
          prompt,
          payload: {
            ...common,
            image_url: input.startImageUrl!,
            aspect_ratio: aspectRatio as WanImageInput["aspect_ratio"],
          },
        }
      : {
          endpoint,
          prompt,
          payload: {
            ...common,
            aspect_ratio: input.setup.aspectRatio as WanTextInput["aspect_ratio"],
          },
        };
  }
  const seedance = {
    prompt,
    resolution: resolution as SeedanceTextInput["resolution"],
    duration: duration as SeedanceTextInput["duration"],
    aspect_ratio: aspectRatio as SeedanceTextInput["aspect_ratio"],
    generate_audio: input.setup.baseVideo.generateAudio,
    bitrate_mode: "standard" as const,
    end_user_id: input.endUserId,
  };
  return endpoint === SEEDANCE_2_FAST_I2V_ENDPOINT
    ? { endpoint, prompt, payload: { ...seedance, image_url: input.startImageUrl! } }
    : { endpoint: SEEDANCE_2_FAST_T2V_ENDPOINT, prompt, payload: seedance };
}

export type FalBaseVideoTransport = {
  uploadReference(reference: UgcVideoProviderReference): Promise<string>;
  submit(endpoint: FalBaseVideoEndpoint, input: FalBaseVideoInput): Promise<{
    requestId: string;
    statusUrl: string;
    responseUrl: string;
    cancelUrl: string | null;
    queuePosition: number | null;
  }>;
  status(
    endpoint: FalBaseVideoEndpoint,
    requestId: string,
    queueHandle?: UgcVideoProviderQueueHandle | null,
  ): Promise<UgcVideoProviderStatus>;
  result(
    endpoint: FalBaseVideoEndpoint,
    requestId: string,
    queueHandle?: UgcVideoProviderQueueHandle | null,
  ): Promise<{ requestId: string; data: FalBaseVideoOutput }>;
};

const FAL_QUEUE_HOST = "queue.fal.run";
const FAL_QUEUE_TIMEOUT_MS = 30_000;

export function assertBaseVideoFalQueueUrl(value: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("UGC_BASE_VIDEO_QUEUE_URL_INVALID");
  }
  if (
    parsed.protocol !== "https:" ||
    parsed.hostname !== FAL_QUEUE_HOST ||
    parsed.port ||
    parsed.username ||
    parsed.password ||
    parsed.hash
  ) {
    throw new Error("UGC_BASE_VIDEO_QUEUE_URL_UNTRUSTED");
  }
  return value;
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function queueText(records: Array<Record<string, unknown> | null>, ...keys: string[]) {
  for (const item of records) {
    for (const key of keys) {
      const value = item?.[key];
      if (typeof value === "string" && value.trim()) return value.trim();
    }
  }
  return null;
}

export function extractFalBaseVideoQueueSubmission(value: unknown) {
  const root = record(value);
  const records = [root, record(root?.queue), record(root?.data), record(root?.response)];
  const requestId = queueText(records, "request_id", "requestId");
  const statusUrl = queueText(records, "status_url", "statusUrl");
  const responseUrl = queueText(records, "response_url", "responseUrl");
  const cancelUrl = queueText(records, "cancel_url", "cancelUrl");
  if (!requestId || !statusUrl || !responseUrl) {
    throw new Error("UGC_BASE_VIDEO_QUEUE_HANDLE_INCOMPLETE");
  }
  const queuePosition = records
    .flatMap((item) => (item ? [item.queue_position, item.queuePosition] : []))
    .find((item) => typeof item === "number" && Number.isInteger(item));
  return {
    requestId,
    statusUrl: assertBaseVideoFalQueueUrl(statusUrl),
    responseUrl: assertBaseVideoFalQueueUrl(responseUrl),
    cancelUrl: cancelUrl ? assertBaseVideoFalQueueUrl(cancelUrl) : null,
    queuePosition: typeof queuePosition === "number" ? queuePosition : null,
  };
}

function queueUrl(
  handle: UgcVideoProviderQueueHandle | null | undefined,
  endpoint: FalBaseVideoEndpoint,
  stage: "STATUS" | "RESULT",
) {
  if (!handle) return null;
  if (handle.endpoint !== endpoint) {
    throw new Error("UGC_BASE_VIDEO_QUEUE_ENDPOINT_MISMATCH");
  }
  const value = stage === "STATUS" ? handle.statusUrl : handle.responseUrl;
  return value ? assertBaseVideoFalQueueUrl(value) : null;
}

function queueLogs(value: unknown) {
  const raw = record(value)?.logs;
  if (!Array.isArray(raw)) return [];
  return raw.slice(-20).flatMap((item) => {
    const entry = record(item);
    if (
      !entry ||
      !["STDERR", "STDOUT", "ERROR", "INFO", "WARN", "DEBUG"].includes(String(entry.level)) ||
      typeof entry.message !== "string" ||
      typeof entry.timestamp !== "string"
    ) return [];
    return [{
      level: entry.level as "STDERR" | "STDOUT" | "ERROR" | "INFO" | "WARN" | "DEBUG",
      message: sanitizeFalQueueText(entry.message),
      timestamp: entry.timestamp,
    }];
  });
}

function statusFromRaw(value: unknown): UgcVideoProviderStatus {
  const item = record(value) ?? {};
  const status = item.status;
  if (!["IN_QUEUE", "IN_PROGRESS", "COMPLETED", "FAILED"].includes(String(status))) {
    throw new Error("UGC_BASE_VIDEO_QUEUE_STATUS_INVALID");
  }
  const metrics = record(item.metrics);
  return {
    status: status as UgcVideoProviderStatus["status"],
    queuePosition:
      status === "IN_QUEUE" && typeof item.queue_position === "number"
        ? item.queue_position
        : null,
    error:
      status === "FAILED"
        ? sanitizeFalQueueText(
            typeof item.error === "string"
              ? item.error
              : "Provider rejected the base video.",
          )
        : null,
    logs: queueLogs(value),
    inferenceTimeSeconds:
      typeof metrics?.inference_time === "number" ? metrics.inference_time : null,
    metrics: metrics
      ? sanitizeFalQueueText(JSON.stringify(metrics)).slice(0, 4096)
      : null,
    truncated: Array.isArray(item.logs) && item.logs.length > 20,
  };
}

async function authoritativeRequest(input: {
  credentials: string;
  url: string;
  endpoint: FalBaseVideoEndpoint;
  requestId: string;
  stage: "STATUS" | "RESULT";
  fetcher: typeof fetch;
}) {
  try {
    const response = await input.fetcher(assertBaseVideoFalQueueUrl(input.url), {
      method: "GET",
      headers: {
        Authorization: `Key ${input.credentials}`,
        Accept: "application/json",
      },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(FAL_QUEUE_TIMEOUT_MS),
    });
    const contentType = response.headers.get("content-type") ?? "";
    const body = contentType.includes("application/json")
      ? await response.json().catch(() => null)
      : await response.text().catch(() => null);
    if (!response.ok) {
      const error = new Error(`FAL_BASE_VIDEO_QUEUE_HTTP_${response.status}`) as Error & {
        status?: number;
        body?: unknown;
      };
      error.status = response.status;
      error.body = body;
      throw error;
    }
    return body;
  } catch (error) {
    throw new UgcVideoProviderDiagnosticError(
      sanitizeFalProviderError({
        error,
        phase: input.stage,
        endpoint: input.endpoint,
        requestId: input.requestId,
      }),
      false,
    );
  }
}

export function createFalBaseVideoTransport(
  credentials: string,
  fetcher: typeof fetch = fetch,
): FalBaseVideoTransport {
  const client: FalClient = createFalClient({ credentials });
  return {
    async uploadReference(reference) {
      if (reference.providerUrl) return reference.providerUrl;
      return client.storage.upload(
        new Blob([Uint8Array.from(reference.bytes)], {
          type: reference.metadata.mimeType,
        }),
        { lifecycle: { expiresIn: "1d" } },
      );
    },
    async submit(endpoint, payload) {
      const queued = await client.queue.submit(endpoint, {
        input: payload as never,
        storageSettings: { expiresIn: "1d" },
      });
      return extractFalBaseVideoQueueSubmission(queued);
    },
    async status(endpoint, requestId, handle) {
      const url = queueUrl(handle, endpoint, "STATUS");
      if (url) {
        return statusFromRaw(
          await authoritativeRequest({
            credentials,
            url,
            endpoint,
            requestId,
            stage: "STATUS",
            fetcher,
          }),
        );
      }
      try {
        return statusFromRaw(
          await client.queue.status(endpoint, { requestId, logs: true }),
        );
      } catch (error) {
        throw new UgcVideoProviderDiagnosticError(
          sanitizeFalProviderError({ error, phase: "STATUS", endpoint, requestId }),
          false,
        );
      }
    },
    async result(endpoint, requestId, handle) {
      const url = queueUrl(handle, endpoint, "RESULT");
      if (url) {
        const raw = await authoritativeRequest({
          credentials,
          url,
          endpoint,
          requestId,
          stage: "RESULT",
          fetcher,
        });
        const root = record(raw) ?? {};
        const data = root.video ? root : record(root.data) ?? root;
        return { requestId, data: data as FalBaseVideoOutput };
      }
      try {
        const result = await client.queue.result(endpoint, { requestId });
        return { requestId: result.requestId, data: result.data as FalBaseVideoOutput };
      } catch (error) {
        throw new UgcVideoProviderDiagnosticError(
          sanitizeFalProviderError({ error, phase: "RESULT", endpoint, requestId }),
          error instanceof ApiError && error.status >= 400 && error.status < 600,
        );
      }
    },
  };
}

function startImageReference(request: UgcVideoProviderRequest) {
  const id = request.setup.baseVideo.startImageReferenceId;
  return id
    ? request.references.find((reference) => reference.metadata.id === id) ?? null
    : null;
}

function normalizedResult(input: {
  output: FalBaseVideoOutput;
  endpoint: FalBaseVideoEndpoint;
  requestId: string;
  setup: UgcVideoGenerationSetup;
}): UgcVideoResult {
  if (!input.output.video?.url) throw new Error("UGC_BASE_VIDEO_RESULT_MISSING");
  return {
    id: `${input.requestId}-video`,
    url: input.output.video.url,
    downloadUrl: input.output.video.url,
    mimeType: input.output.video.content_type ?? "video/mp4",
    width: input.output.video.width ?? null,
    height: input.output.video.height ?? null,
    durationSeconds: input.output.video.duration ?? Number(input.setup.duration),
    byteLength: input.output.video.file_size ?? null,
    favorite: false,
    provider: "fal",
    providerModel: input.endpoint,
    providerRequestId: input.requestId,
  };
}

export class FalBaseVideoProvider implements UgcVideoProvider {
  readonly providerId = "fal" as const;

  constructor(
    private readonly modelId: string,
    private readonly credentials: string | undefined = process.env.FAL_KEY,
    private readonly transport: FalBaseVideoTransport | null = null,
  ) {}

  isConfigured() {
    return Boolean(this.transport || this.credentials?.trim());
  }

  private transportInstance() {
    if (!this.isConfigured()) throw new Error("FAL_KEY ist nicht eingerichtet.");
    return this.transport ?? createFalBaseVideoTransport(this.credentials!.trim());
  }

  async submit(request: UgcVideoProviderRequest): Promise<UgcVideoProviderSubmission> {
    if (request.setup.modelId !== this.modelId) {
      throw new Error("UGC_BASE_VIDEO_MODEL_MISMATCH");
    }
    const resolved = assertUgcBaseVideoSetup(request.setup);
    const image = startImageReference(request);
    let imageUrl: string | null = null;
    if (resolved.variant === "IMAGE_TO_VIDEO") {
      if (!image) throw new Error("UGC_BASE_VIDEO_START_IMAGE_REQUIRED");
      try {
        imageUrl = image.providerUrl ?? await this.transportInstance().uploadReference(image);
      } catch (error) {
        throw new UgcVideoProviderDiagnosticError(
          sanitizeFalProviderError({
            error,
            phase: "SUBMIT",
            endpoint: resolved.endpoint,
            requestId: null,
          }),
          true,
        );
      }
    }
    const built = buildFalBaseVideoInput({
      setup: request.setup,
      startImageUrl: imageUrl,
      endUserId: request.endUserId,
    });
    try {
      const submitted = await this.transportInstance().submit(
        built.endpoint,
        built.payload,
      );
      return {
        provider: "fal",
        providerModel: built.endpoint,
        providerRequestId: submitted.requestId,
        providerPrompt: built.prompt,
        referenceOrder: image ? [image.metadata.id] : [],
        providerStatus: "IN_QUEUE",
        statusUrl: submitted.statusUrl,
        responseUrl: submitted.responseUrl,
        cancelUrl: submitted.cancelUrl,
        queuePosition: submitted.queuePosition,
      };
    } catch (error) {
      if (error instanceof UgcVideoProviderDiagnosticError) throw error;
      const diagnostic = sanitizeFalProviderError({
        error,
        phase: "SUBMIT",
        endpoint: built.endpoint,
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

  async getStatus(
    providerRequestId: string,
    queueHandle?: UgcVideoProviderQueueHandle | null,
  ) {
    const endpoint = queueHandle?.endpoint as FalBaseVideoEndpoint | undefined;
    if (!endpoint) throw new Error("UGC_BASE_VIDEO_ENDPOINT_MISSING");
    return this.transportInstance().status(endpoint, providerRequestId, queueHandle);
  }

  async getResult(input: {
    providerRequestId: string;
    setup: UgcVideoGenerationSetup;
    providerPrompt: string;
    referenceOrder: string[];
    queueHandle?: UgcVideoProviderQueueHandle | null;
  }): Promise<UgcVideoProviderResponse> {
    const endpoint = baseVideoEndpointForSetup(input.setup);
    const response = await this.transportInstance().result(
      endpoint,
      input.providerRequestId,
      input.queueHandle,
    );
    return {
      provider: "fal",
      providerModel: endpoint,
      providerRequestId: input.providerRequestId,
      providerPrompt: input.providerPrompt,
      referenceOrder: input.referenceOrder,
      result: normalizedResult({
        output: response.data,
        endpoint,
        requestId: input.providerRequestId,
        setup: input.setup,
      }),
      // The audited output contracts expose no authoritative monetary spend.
      actualCostUsd: null,
    };
  }
}
