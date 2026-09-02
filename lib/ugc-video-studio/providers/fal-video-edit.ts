import { ApiError, createFalClient, type FalClient } from "@fal-ai/client";

import type {
  UgcVideoGenerationSetup,
  UgcVideoResult,
} from "@/lib/ugc-video-studio/contracts";
import {
  isUgcVideoEditModelId,
  KLING_O1_STANDARD_EDIT_ENDPOINT,
  KLING_O3_PRO_EDIT_ENDPOINT,
  SEEDANCE_2_FAST_EDIT_ENDPOINT,
  ugcVideoModelById,
  type UgcVideoEditModelId,
} from "@/lib/ugc-video-studio/model-registry";
import {
  extractFalProviderValidationDetail,
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
import { resolveUgcVideoEditReferences } from "@/lib/ugc-video-studio/video-edit-config";

export type FalVideoEditEndpoint =
  | typeof KLING_O3_PRO_EDIT_ENDPOINT
  | typeof KLING_O1_STANDARD_EDIT_ENDPOINT
  | typeof SEEDANCE_2_FAST_EDIT_ENDPOINT;

export type FalKlingVideoEditInput = {
  prompt: string;
  video_url: string;
  keep_audio: boolean;
  elements: Array<{
    frontal_image_url: string;
    reference_image_urls: [string, ...string[]];
  }>;
  shot_type?: "customize";
};

export type FalSeedance2FastEditInput = {
  prompt: string;
  image_urls: [string];
  video_urls: [string];
  resolution: "720p";
  duration: UgcVideoGenerationSetup["duration"];
  aspect_ratio: "auto";
  generate_audio: false;
  bitrate_mode: "standard";
  end_user_id: string;
};

export type FalVideoEditInput = FalKlingVideoEditInput | FalSeedance2FastEditInput;
export type FalVideoEditOutput = {
  video: {
    url: string;
    content_type?: string;
    file_name?: string;
    file_size?: number;
  };
  seed?: number;
};

export type FalVideoEditTransport = {
  uploadReference(reference: UgcVideoProviderReference): Promise<string>;
  submit(endpoint: FalVideoEditEndpoint, input: FalVideoEditInput): Promise<{
    requestId: string;
    statusUrl: string | null;
    responseUrl: string | null;
    cancelUrl: string | null;
    queuePosition: number | null;
  }>;
  status(
    endpoint: FalVideoEditEndpoint,
    requestId: string,
    queueHandle?: UgcVideoProviderQueueHandle | null,
  ): Promise<UgcVideoProviderStatus>;
  result(
    endpoint: FalVideoEditEndpoint,
    requestId: string,
    queueHandle?: UgcVideoProviderQueueHandle | null,
  ): Promise<{ requestId: string; data: FalVideoEditOutput }>;
};

const FAL_QUEUE_HOST = "queue.fal.run";
const FAL_QUEUE_TIMEOUT_MS = 30_000;

type FalVideoEditQueueSubmission = {
  requestId: string;
  statusUrl: string | null;
  responseUrl: string | null;
  cancelUrl: string | null;
  queuePosition: number | null;
};

function safeModelIdForEndpoint(endpoint: FalVideoEditEndpoint): UgcVideoEditModelId {
  if (endpoint === KLING_O3_PRO_EDIT_ENDPOINT) return "kling-o3-pro-video-edit";
  if (endpoint === KLING_O1_STANDARD_EDIT_ENDPOINT) return "kling-o1-standard-video-edit";
  return "seedance-2-fast-video-edit";
}

function logVideoEditRecoveryFailure(input: {
  error: unknown;
  endpoint: FalVideoEditEndpoint;
  recoveryStage: "status" | "result";
  providerStatus: number | null;
  providerUrlSource: "authoritative" | "legacy-sdk";
}) {
  const detail = extractFalProviderValidationDetail(input.error);
  console.warn("[xeriamo-ugc] ugc_video_edit_recovery_failed", {
    model: safeModelIdForEndpoint(input.endpoint),
    recoveryStage: input.recoveryStage,
    providerStatus: input.providerStatus,
    providerErrorType: detail.providerErrorType,
    providerValidationPath: detail.providerValidationPath,
    providerMessage: detail.providerMessage,
    providerUrlSource: input.providerUrlSource,
  });
}

function recordValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? value as Record<string, unknown>
    : null;
}

function firstQueueText(
  records: Array<Record<string, unknown> | null>,
  ...keys: string[]
): string | null {
  for (const record of records) {
    if (!record) continue;
    for (const key of keys) {
      const value = record[key];
      if (typeof value === "string" && value.trim()) return value.trim();
    }
  }
  return null;
}

/** Normalize the installed fal queue contract without discarding its authoritative URLs. */
export function extractFalVideoEditQueueSubmission(
  value: unknown,
): FalVideoEditQueueSubmission {
  const root = recordValue(value);
  const records = [
    root,
    recordValue(root?.queue),
    recordValue(root?.data),
    recordValue(root?.response),
  ];
  const requestId = firstQueueText(records, "request_id", "requestId");
  if (!requestId) throw new Error("UGC_VIDEO_EDIT_REQUEST_ID_MISSING");
  const statusUrl = firstQueueText(records, "status_url", "statusUrl");
  const responseUrl = firstQueueText(records, "response_url", "responseUrl");
  const cancelUrl = firstQueueText(records, "cancel_url", "cancelUrl");
  const queuePositionValue = records.flatMap((record) => record ? [
    record.queue_position,
    record.queuePosition,
  ] : []).find((item) => typeof item === "number" && Number.isInteger(item));
  return {
    requestId,
    statusUrl: statusUrl ? assertUgcFalQueueUrl(statusUrl) : null,
    responseUrl: responseUrl ? assertUgcFalQueueUrl(responseUrl) : null,
    cancelUrl: cancelUrl ? assertUgcFalQueueUrl(cancelUrl) : null,
    queuePosition: typeof queuePositionValue === "number" ? queuePositionValue : null,
  };
}

export function assertUgcFalQueueUrl(value: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("UGC_PROVIDER_QUEUE_URL_INVALID");
  }
  if (
    parsed.protocol !== "https:" ||
    parsed.hostname !== FAL_QUEUE_HOST ||
    parsed.port ||
    parsed.username ||
    parsed.password ||
    parsed.hash
  ) {
    throw new Error("UGC_PROVIDER_QUEUE_URL_UNTRUSTED");
  }
  return value;
}

function queueHandleUrl(
  handle: UgcVideoProviderQueueHandle | null | undefined,
  endpoint: FalVideoEditEndpoint,
  stage: "STATUS" | "RESULT",
): string | null {
  if (!handle) return null;
  if (handle.endpoint !== endpoint) throw new Error("UGC_PROVIDER_QUEUE_ENDPOINT_MISMATCH");
  const value = stage === "STATUS" ? handle.statusUrl : handle.responseUrl;
  return value ? assertUgcFalQueueUrl(value) : null;
}

async function readFalResponse(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";
  const body = contentType.includes("application/json")
    ? await response.json().catch(() => null)
    : await response.text().catch(() => null);
  if (!response.ok) {
    const error = new Error(`FAL_VIDEO_EDIT_QUEUE_HTTP_${response.status}`) as Error & {
      status?: number;
      body?: unknown;
    };
    error.status = response.status;
    error.body = body;
    throw error;
  }
  return body;
}

function queueLogs(value: unknown) {
  if (!value || typeof value !== "object") return [];
  const logs = (value as { logs?: unknown }).logs;
  if (!Array.isArray(logs)) return [];
  return logs.slice(-20).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    if (
      !["STDERR", "STDOUT", "ERROR", "INFO", "WARN", "DEBUG"].includes(String(record.level)) ||
      typeof record.message !== "string" ||
      typeof record.timestamp !== "string"
    ) return [];
    return [{
      level: record.level as "STDERR" | "STDOUT" | "ERROR" | "INFO" | "WARN" | "DEBUG",
      message: sanitizeFalQueueText(record.message),
      timestamp: record.timestamp,
    }];
  });
}

async function authoritativeQueueRequest(input: {
  credentials: string;
  url: string;
  stage: "STATUS" | "RESULT";
  endpoint: FalVideoEditEndpoint;
  requestId: string;
  fetcher?: typeof fetch;
}) {
  try {
    const response = await (input.fetcher ?? fetch)(assertUgcFalQueueUrl(input.url), {
      method: "GET",
      headers: { Authorization: `Key ${input.credentials}`, Accept: "application/json" },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(FAL_QUEUE_TIMEOUT_MS),
    });
    return await readFalResponse(response);
  } catch (error) {
    const diagnostic = sanitizeFalProviderError({
      error,
      phase: input.stage,
      endpoint: input.endpoint,
      requestId: input.requestId,
    });
    logVideoEditRecoveryFailure({
      error,
      endpoint: input.endpoint,
      providerUrlSource: "authoritative",
      recoveryStage: input.stage === "STATUS" ? "status" : "result",
      providerStatus: diagnostic.httpStatus,
    });
    throw new UgcVideoProviderDiagnosticError(diagnostic, false);
  }
}

function statusFromRaw(value: unknown): UgcVideoProviderStatus {
  const record = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const status = record.status;
  if (status !== "IN_QUEUE" && status !== "IN_PROGRESS" && status !== "COMPLETED" && status !== "FAILED") {
    throw new Error("UGC_PROVIDER_QUEUE_STATUS_INVALID");
  }
  const metrics = record.metrics && typeof record.metrics === "object"
    ? sanitizeFalQueueText(JSON.stringify(record.metrics)).slice(0, 4096)
    : null;
  const inference = record.metrics && typeof record.metrics === "object"
    ? (record.metrics as { inference_time?: unknown }).inference_time
    : null;
  return {
    status,
    queuePosition: status === "IN_QUEUE" && typeof record.queue_position === "number"
      ? record.queue_position
      : null,
    error: status === "FAILED"
      ? sanitizeFalQueueText(typeof record.error === "string" ? record.error : "Provider rejected the video edit.")
      : null,
    logs: queueLogs(value),
    inferenceTimeSeconds: typeof inference === "number" ? inference : null,
    metrics,
    truncated: Array.isArray(record.logs) && record.logs.length > 20,
  };
}

export function createFalVideoEditTransport(
  credentials: string,
  fetcher: typeof fetch = fetch,
): FalVideoEditTransport {
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
    async submit(endpoint, input) {
      const queued = await client.queue.submit(endpoint, {
        input: input as never,
        storageSettings: { expiresIn: "1d" },
      });
      return extractFalVideoEditQueueSubmission(queued);
    },
    async status(endpoint, requestId, queueHandle) {
      const authoritativeUrl = queueHandleUrl(queueHandle, endpoint, "STATUS");
      if (!authoritativeUrl) {
        try {
          const status = await client.queue.status(endpoint, { requestId, logs: true });
          return statusFromRaw(status);
        } catch (error) {
          const diagnostic = sanitizeFalProviderError({
            error, phase: "STATUS", endpoint, requestId,
          });
          logVideoEditRecoveryFailure({
            error,
            endpoint,
            providerUrlSource: "legacy-sdk",
            recoveryStage: "status",
            providerStatus: diagnostic.httpStatus,
          });
          throw new UgcVideoProviderDiagnosticError(diagnostic, false);
        }
      }
      return statusFromRaw(await authoritativeQueueRequest({
        credentials, url: authoritativeUrl, stage: "STATUS", endpoint, requestId, fetcher,
      }));
    },
    async result(endpoint, requestId, queueHandle) {
      const authoritativeUrl = queueHandleUrl(queueHandle, endpoint, "RESULT");
      if (!authoritativeUrl) {
        try {
          const result = await client.queue.result(endpoint, { requestId });
          return { requestId: result.requestId, data: result.data as FalVideoEditOutput };
        } catch (error) {
          const diagnostic = sanitizeFalProviderError({
            error, phase: "RESULT", endpoint, requestId,
          });
          logVideoEditRecoveryFailure({
            error,
            endpoint,
            providerUrlSource: "legacy-sdk",
            recoveryStage: "result",
            providerStatus: diagnostic.httpStatus,
          });
          throw new UgcVideoProviderDiagnosticError(
            diagnostic,
            error instanceof ApiError && error.status >= 400 && error.status < 600,
          );
        }
      }
      const value = await authoritativeQueueRequest({
        credentials, url: authoritativeUrl, stage: "RESULT", endpoint, requestId, fetcher,
      });
      const record = value && typeof value === "object" ? value as Record<string, unknown> : {};
      const data = record.video
        ? record
        : record.data && typeof record.data === "object"
          ? record.data
          : record;
      return { requestId, data: data as FalVideoEditOutput };
    },
  };
}

function referenceById(references: UgcVideoProviderReference[], id: string) {
  const reference = references.find((item) => item.metadata.id === id);
  if (!reference) throw new Error("UGC_VIDEO_EDIT_REFERENCE_REQUIRED");
  return reference;
}

export function buildCharacterReplacePrompt(input: {
  modelId: UgcVideoEditModelId;
  userInstruction: string;
}): string {
  const characterToken = input.modelId === "seedance-2-fast-video-edit"
    ? "@Image1"
    : "@Element1";
  const canonical = [
    "@Video1 is the absolute source for scene, environment, location, camera, framing, timing, subject placement and motion.",
    `Replace only the main person in @Video1 with ${characterToken}.`,
    `Use ${characterToken} only for identity, body appearance, clothing, garment color, garment fit and visible artwork.`,
    `Never copy the background from ${characterToken}; preserve the source-video environment and camera exactly.`,
    "Preserve the source performance and realistic human movement.",
    "Preserve the Character Master's face, body, garment silhouette, oversized fit, garment color and artwork as strongly as possible.",
    "Keep visible typography and artwork attached naturally to the moving fabric. Do not redesign, remove or replace the garment graphic.",
    "Do not add extra people, random logos or visible text overlays.",
  ];
  const user = input.userInstruction.trim();
  return `${canonical.join("\n")}${user ? `\n\nAdditional user direction (without overriding the source/character authority above):\n${user}` : ""}`;
}

export function buildFalVideoEditInput(input: {
  modelId: UgcVideoEditModelId;
  setup: UgcVideoGenerationSetup;
  sourceVideoUrl: string;
  characterMasterUrl: string;
  endUserId: string;
}): FalVideoEditInput {
  const prompt = buildCharacterReplacePrompt({
    modelId: input.modelId,
    userInstruction: input.setup.prompt,
  });
  if (input.modelId === "seedance-2-fast-video-edit") {
    return {
      prompt,
      image_urls: [input.characterMasterUrl],
      video_urls: [input.sourceVideoUrl],
      resolution: "720p",
      duration: input.setup.duration,
      aspect_ratio: "auto",
      generate_audio: false,
      bitrate_mode: "standard",
      end_user_id: input.endUserId,
    };
  }
  return {
    prompt,
    video_url: input.sourceVideoUrl,
    keep_audio: input.setup.videoEdit.keepOriginalSound,
    elements: [{
      frontal_image_url: input.characterMasterUrl,
      reference_image_urls: [input.characterMasterUrl],
    }],
    ...(input.modelId === "kling-o3-pro-video-edit" ? { shot_type: "customize" as const } : {}),
  };
}

function endpointForModel(modelId: UgcVideoEditModelId): FalVideoEditEndpoint {
  const endpoint = ugcVideoModelById(modelId)?.providerModelId;
  if (
    endpoint !== KLING_O3_PRO_EDIT_ENDPOINT &&
    endpoint !== KLING_O1_STANDARD_EDIT_ENDPOINT &&
    endpoint !== SEEDANCE_2_FAST_EDIT_ENDPOINT
  ) throw new Error("UGC_VIDEO_EDIT_ENDPOINT_INVALID");
  return endpoint;
}

function normalizeResult(input: {
  output: FalVideoEditOutput;
  requestId: string;
  modelId: UgcVideoEditModelId;
  setup: UgcVideoGenerationSetup;
}): UgcVideoResult {
  return {
    id: `${input.requestId}-video`,
    url: input.output.video.url,
    downloadUrl: input.output.video.url,
    mimeType: input.output.video.content_type ?? "video/mp4",
    width: null,
    height: null,
    durationSeconds: Number(input.setup.duration),
    byteLength: input.output.video.file_size ?? null,
    favorite: false,
    provider: "fal",
    providerModel: endpointForModel(input.modelId),
    providerRequestId: input.requestId,
  };
}

export class FalVideoEditProvider implements UgcVideoProvider {
  readonly providerId = "fal" as const;

  constructor(
    private readonly modelId: UgcVideoEditModelId,
    private readonly credentials: string | undefined = process.env.FAL_KEY,
    private readonly transport: FalVideoEditTransport | null = null,
  ) {
    if (!isUgcVideoEditModelId(modelId)) throw new Error("UGC_VIDEO_EDIT_MODEL_INVALID");
  }

  isConfigured() {
    return Boolean(this.transport || this.credentials?.trim());
  }

  private transportInstance() {
    if (!this.isConfigured()) throw new Error("FAL_KEY ist nicht eingerichtet.");
    return this.transport ?? createFalVideoEditTransport(this.credentials!.trim());
  }

  async submit(request: UgcVideoProviderRequest): Promise<UgcVideoProviderSubmission> {
    const resolution = resolveUgcVideoEditReferences(request.setup);
    const sourceVideo = referenceById(request.references, resolution.sourceVideo.id);
    const characterMaster = referenceById(request.references, resolution.characterMaster.id);
    const endpoint = endpointForModel(this.modelId);
    let sourceVideoUrl: string;
    let characterMasterUrl: string;
    try {
      [sourceVideoUrl, characterMasterUrl] = await Promise.all([
        sourceVideo.providerUrl ?? this.transportInstance().uploadReference(sourceVideo),
        characterMaster.providerUrl ?? this.transportInstance().uploadReference(characterMaster),
      ]);
    } catch (error) {
      throw new UgcVideoProviderDiagnosticError(
        sanitizeFalProviderError({ error, phase: "SUBMIT", endpoint, requestId: null }),
        true,
      );
    }
    const providerPrompt = buildCharacterReplacePrompt({
      modelId: this.modelId,
      userInstruction: request.setup.prompt,
    });
    const payload = buildFalVideoEditInput({
      modelId: this.modelId,
      setup: request.setup,
      sourceVideoUrl,
      characterMasterUrl,
      endUserId: request.endUserId,
    });
    try {
      const submitted = await this.transportInstance().submit(endpoint, payload);
      if (!submitted.statusUrl || !submitted.responseUrl) {
        throw new Error("UGC_VIDEO_EDIT_QUEUE_HANDLE_INCOMPLETE");
      }
      return {
        provider: "fal",
        providerModel: endpoint,
        providerRequestId: submitted.requestId,
        providerPrompt,
        referenceOrder: [sourceVideo.metadata.id, characterMaster.metadata.id],
        providerStatus: "IN_QUEUE",
        statusUrl: submitted.statusUrl,
        responseUrl: submitted.responseUrl,
        cancelUrl: submitted.cancelUrl,
        queuePosition: submitted.queuePosition,
      };
    } catch (error) {
      const diagnostic = sanitizeFalProviderError({
        error, phase: "SUBMIT", endpoint, requestId: null,
      });
      if (
        error instanceof ApiError &&
        error.status >= 400 && error.status < 500 &&
        error.status !== 408 && error.status !== 429
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
    return this.transportInstance().status(
      endpointForModel(this.modelId), providerRequestId, queueHandle,
    );
  }

  async getResult(input: {
    providerRequestId: string;
    setup: UgcVideoGenerationSetup;
    providerPrompt: string;
    referenceOrder: string[];
    queueHandle?: UgcVideoProviderQueueHandle | null;
  }): Promise<UgcVideoProviderResponse> {
    const endpoint = endpointForModel(this.modelId);
    const response = await this.transportInstance().result(
      endpoint, input.providerRequestId, input.queueHandle,
    );
    return {
      provider: "fal",
      providerModel: endpoint,
      providerRequestId: input.providerRequestId,
      providerPrompt: input.providerPrompt,
      referenceOrder: input.referenceOrder,
      result: normalizeResult({
        output: response.data,
        requestId: input.providerRequestId,
        modelId: this.modelId,
        setup: input.setup,
      }),
      actualCostUsd: null,
    };
  }
}
