import { createFalClient, type FalClient } from "@fal-ai/client";

import { buildDesignProviderInput, buildDesignProviderPrompt, DESIGN_ENDPOINTS } from "@/lib/design-studio/model-config";
import type { DesignEndpoint } from "@/lib/design-studio/model-config";
import type {
  DesignProvider,
  DesignProviderQueueHandle,
  DesignProviderReference,
  DesignProviderResult,
} from "@/lib/design-studio/provider";
import { DesignProviderUnknownOutcomeError } from "@/lib/design-studio/provider";
import { normalizeDesignProviderError } from "@/lib/design-studio/provider-errors";

export type FalDesignTransport = {
  upload(reference: DesignProviderReference): Promise<string>;
  submit(endpoint: DesignEndpoint, input: Record<string, unknown>): Promise<string | FalDesignQueueSubmission>;
  wait(endpoint: DesignEndpoint, requestId: string, queueHandle?: DesignProviderQueueHandle | null): Promise<void>;
  status?(endpoint: DesignEndpoint, requestId: string, queueHandle?: DesignProviderQueueHandle | null): Promise<"RUNNING" | "COMPLETED">;
  result(endpoint: DesignEndpoint, requestId: string, queueHandle?: DesignProviderQueueHandle | null): Promise<unknown>;
};

export type FalDesignQueueSubmission = {
  requestId: string;
  queueHandle: DesignProviderQueueHandle | null;
};

type FalQueueStage = "status" | "result";
type FalQueueStatus = "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED";
type FalQueueUrlSource = "authoritative" | "legacy-reconstructed";
const FAL_QUEUE_HOST = "queue.fal.run";
const FAL_QUEUE_TIMEOUT_MS = 30_000;

const RECRAFT_ENDPOINTS = new Set<DesignEndpoint>([
  DESIGN_ENDPOINTS.RECRAFT_RASTER,
  DESIGN_ENDPOINTS.RECRAFT_VECTOR,
  DESIGN_ENDPOINTS.RECRAFT_REFERENCE_RASTER,
  DESIGN_ENDPOINTS.RECRAFT_REFERENCE_VECTOR,
]);

function isRecraftEndpoint(endpoint: DesignEndpoint) {
  return RECRAFT_ENDPOINTS.has(endpoint);
}

function logRecraftQueue(
  event: "recraft_submit" | "recraft_accepted" | "recraft_poll_endpoint_match" | "recraft_poll_failed" | "recraft_result_recovered",
  fields: {
    endpoint: DesignEndpoint;
    requestIdPresent: boolean;
    recoveryStage: "submit" | FalQueueStage;
    providerStatus?: string | number | null;
    providerUrlSource?: FalQueueUrlSource | null;
  },
) {
  const payload = {
    routeClass: fields.endpoint,
    requestIdPresent: fields.requestIdPresent,
    recoveryStage: fields.recoveryStage,
    providerStatus: fields.providerStatus ?? null,
    providerUrlSource: fields.providerUrlSource ?? null,
  };
  if (event === "recraft_poll_failed") console.warn(`[xeriamo-design] ${event}`, payload);
  else console.info(`[xeriamo-design] ${event}`, payload);
}

/**
 * Extracts the acceptance identity from the installed fal contract while also
 * accepting the camel-case and wrapped shapes returned by older compatible
 * transports. The value is never exposed to the product client or logs.
 */
export function extractFalDesignQueueRequestId(
  value: unknown,
  seen: Set<object> = new Set(),
): string | null {
  if (typeof value === "string") return value.trim() || null;
  if (!value || typeof value !== "object" || seen.has(value)) return null;
  seen.add(value);
  const record = value as Record<string, unknown>;
  const direct = [record.request_id, record.requestId].find(
    (candidate): candidate is string => typeof candidate === "string" && candidate.trim().length > 0,
  );
  if (direct) return direct.trim();
  for (const key of ["queue", "data", "response"] as const) {
    const nested = record[key];
    if (nested && typeof nested === "object") {
      const requestId = extractFalDesignQueueRequestId(nested, seen);
      if (requestId) return requestId;
    }
  }
  return null;
}

export function assertFalDesignQueueUrl(value: string) {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("FAL_DESIGN_QUEUE_URL_INVALID");
  }
  if (parsed.protocol !== "https:" || parsed.hostname !== FAL_QUEUE_HOST
    || parsed.port || parsed.username || parsed.password || parsed.hash) {
    throw new Error("FAL_DESIGN_QUEUE_URL_UNTRUSTED");
  }
  return value;
}

/** Captures the immutable queue resource URLs returned by queue.submit(). */
export function extractFalDesignQueueHandle(
  value: unknown,
  endpoint: DesignEndpoint,
  seen: Set<object> = new Set(),
): DesignProviderQueueHandle | null {
  if (!value || typeof value !== "object" || seen.has(value)) return null;
  seen.add(value);
  const record = value as Record<string, unknown>;
  const requestId = [record.request_id, record.requestId].find(
    (candidate): candidate is string => typeof candidate === "string" && candidate.trim().length > 0,
  );
  const statusUrl = [record.status_url, record.statusUrl].find(
    (candidate): candidate is string => typeof candidate === "string" && candidate.trim().length > 0,
  );
  const responseUrl = [record.response_url, record.responseUrl].find(
    (candidate): candidate is string => typeof candidate === "string" && candidate.trim().length > 0,
  );
  const cancelUrl = [record.cancel_url, record.cancelUrl].find(
    (candidate): candidate is string => typeof candidate === "string" && candidate.trim().length > 0,
  ) ?? null;
  if (requestId && statusUrl && responseUrl) {
    return {
      requestId: requestId.trim(),
      endpoint,
      statusUrl: assertFalDesignQueueUrl(statusUrl.trim()),
      responseUrl: assertFalDesignQueueUrl(responseUrl.trim()),
      cancelUrl: cancelUrl ? assertFalDesignQueueUrl(cancelUrl.trim()) : null,
    };
  }
  for (const key of ["queue", "data", "response"] as const) {
    const nested = record[key];
    if (nested && typeof nested === "object") {
      const handle = extractFalDesignQueueHandle(nested, endpoint, seen);
      if (handle) return handle;
    }
  }
  return null;
}

/** Conservative compatibility for manifests created before Xeriamo persisted
 * fal's authoritative queue URLs. It is one bounded observation only: callers
 * never probe alternate endpoints and never resubmit the accepted request. */
export function buildFalDesignQueueObservationUrl(
  endpoint: DesignEndpoint,
  requestId: string,
  stage: FalQueueStage,
) {
  if (!RECRAFT_ENDPOINTS.has(endpoint)) throw new Error("DESIGN_QUEUE_ENDPOINT_UNSUPPORTED");
  const normalizedRequestId = requestId.trim();
  if (!normalizedRequestId || normalizedRequestId.length > 512) throw new Error("DESIGN_QUEUE_REQUEST_ID_INVALID");
  const suffix = stage === "status" ? "/status?logs=0" : "";
  return `https://queue.fal.run/${endpoint}/requests/${encodeURIComponent(normalizedRequestId)}${suffix}`;
}

function resolveFalDesignQueueObservation(
  endpoint: DesignEndpoint,
  requestId: string,
  stage: FalQueueStage,
  queueHandle?: DesignProviderQueueHandle | null,
): { url: string; source: FalQueueUrlSource } {
  if (!queueHandle) {
    return { url: buildFalDesignQueueObservationUrl(endpoint, requestId, stage), source: "legacy-reconstructed" };
  }
  if (queueHandle.endpoint !== endpoint || queueHandle.requestId !== requestId) {
    throw new Error("FAL_DESIGN_QUEUE_HANDLE_MISMATCH");
  }
  return {
    url: assertFalDesignQueueUrl(stage === "status" ? queueHandle.statusUrl : queueHandle.responseUrl),
    source: "authoritative",
  };
}

class FalDesignQueueObservationError extends Error {
  constructor(readonly status: number, readonly body: unknown) {
    super(`FAL_DESIGN_QUEUE_HTTP_${status}`);
    this.name = "FalDesignQueueObservationError";
  }
}

async function readFalQueueResponse(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";
  let body: unknown = null;
  if (contentType.includes("application/json")) {
    body = await response.json().catch(() => null);
  } else {
    body = await response.text().catch(() => null);
  }
  if (!response.ok) throw new FalDesignQueueObservationError(response.status, body);
  return body;
}

export function createFalDesignQueueObserver(
  credentials: string,
  fetcher: typeof fetch = fetch,
) {
  async function request(
    endpoint: DesignEndpoint,
    requestId: string,
    stage: FalQueueStage,
    queueHandle?: DesignProviderQueueHandle | null,
  ) {
    const observation = resolveFalDesignQueueObservation(endpoint, requestId, stage, queueHandle);
    const response = await fetcher(observation.url, {
      method: "GET",
      headers: { Authorization: `Key ${credentials}`, Accept: "application/json" },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(FAL_QUEUE_TIMEOUT_MS),
    });
    try {
      const value = await readFalQueueResponse(response);
      if (stage === "result") {
        logRecraftQueue("recraft_result_recovered", {
          endpoint, requestIdPresent: true, recoveryStage: stage, providerStatus: response.status,
          providerUrlSource: observation.source,
        });
      }
      return value;
    } catch (error) {
      logRecraftQueue("recraft_poll_failed", {
        endpoint,
        requestIdPresent: true,
        recoveryStage: stage,
        providerStatus: error instanceof FalDesignQueueObservationError ? error.status : response.status,
        providerUrlSource: observation.source,
      });
      throw error;
    }
  }
  return {
    async status(
      endpoint: DesignEndpoint,
      requestId: string,
      queueHandle?: DesignProviderQueueHandle | null,
    ): Promise<FalQueueStatus> {
      const value = await request(endpoint, requestId, "status", queueHandle);
      const status = value && typeof value === "object"
        ? (value as { status?: unknown }).status
        : null;
      if (status !== "IN_QUEUE" && status !== "IN_PROGRESS" && status !== "COMPLETED") {
        throw new Error("FAL_DESIGN_QUEUE_STATUS_INVALID");
      }
      if (status === "COMPLETED") {
        logRecraftQueue("recraft_poll_endpoint_match", {
          endpoint, requestIdPresent: true, recoveryStage: "status", providerStatus: status,
          providerUrlSource: queueHandle ? "authoritative" : "legacy-reconstructed",
        });
      }
      return status;
    },
    result(endpoint: DesignEndpoint, requestId: string, queueHandle?: DesignProviderQueueHandle | null) {
      return request(endpoint, requestId, "result", queueHandle);
    },
  };
}

function defaultTransport(credentials: string): FalDesignTransport {
  const client: FalClient = createFalClient({ credentials });
  const recraftQueue = createFalDesignQueueObserver(credentials);
  return {
    upload(reference) {
      return client.storage.upload(new Blob([Uint8Array.from(reference.bytes)], { type: reference.mimeType }), {
        lifecycle: { expiresIn: "1d" },
      });
    },
    async submit(endpoint, input) {
      if (isRecraftEndpoint(endpoint)) {
        logRecraftQueue("recraft_submit", {
          endpoint, requestIdPresent: false, recoveryStage: "submit",
        });
      }
      const queued = await client.queue.submit(endpoint as never, {
        input: input as never,
        storageSettings: { expiresIn: "1d" },
      });
      const requestId = extractFalDesignQueueRequestId(queued);
      if (!requestId) throw new Error("FAL_DESIGN_QUEUE_ACCEPTANCE_INVALID");
      let queueHandle: DesignProviderQueueHandle | null = null;
      try {
        queueHandle = extractFalDesignQueueHandle(queued, endpoint);
      } catch {
        // Acceptance is still financially meaningful. Persist the request ID,
        // then fail conservatively rather than following an untrusted URL.
      }
      if (isRecraftEndpoint(endpoint)) {
        logRecraftQueue("recraft_accepted", {
          endpoint, requestIdPresent: true, recoveryStage: "submit",
        });
      }
      return { requestId, queueHandle };
    },
    async wait(endpoint, requestId, queueHandle) {
      if (isRecraftEndpoint(endpoint)) {
        while (await recraftQueue.status(endpoint, requestId, queueHandle) !== "COMPLETED") {
          await new Promise((resolve) => setTimeout(resolve, 1_000));
        }
        return;
      }
      await client.queue.subscribeToStatus(endpoint as never, {
        requestId,
        mode: "polling",
        pollInterval: 1_000,
        logs: false,
      });
    },
    async status(endpoint, requestId, queueHandle) {
      if (isRecraftEndpoint(endpoint)) {
        return await recraftQueue.status(endpoint, requestId, queueHandle) === "COMPLETED" ? "COMPLETED" : "RUNNING";
      }
      const status = await client.queue.status(endpoint as never, {
        requestId,
        logs: false,
      });
      return status.status === "COMPLETED" ? "COMPLETED" : "RUNNING";
    },
    async result(endpoint, requestId, queueHandle) {
      if (isRecraftEndpoint(endpoint)) return recraftQueue.result(endpoint, requestId, queueHandle);
      const response = await client.queue.result(endpoint as never, { requestId });
      return response.data;
    },
  };
}

type FalMedia = { url?: unknown; content_type?: unknown; width?: unknown; height?: unknown };
function mediaCandidates(value: unknown): FalMedia[] {
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  const candidates = [record.images, record.image, record.svg, record.output];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate.filter((item): item is FalMedia => Boolean(item) && typeof item === "object");
    if (candidate && typeof candidate === "object") return [candidate as FalMedia];
    if (typeof candidate === "string") return [{ url: candidate }];
  }
  return [];
}

export function normalizeFalDesignResults(value: unknown, vector: boolean): DesignProviderResult[] {
  return mediaCandidates(value).flatMap((item) => {
    if (typeof item.url !== "string" || !item.url) return [];
    return [{
      url: item.url,
      mimeType: vector
        ? "image/svg+xml"
        : typeof item.content_type === "string" ? item.content_type : "image/png",
      width: typeof item.width === "number" && item.width > 0 ? Math.round(item.width) : null,
      height: typeof item.height === "number" && item.height > 0 ? Math.round(item.height) : null,
    }];
  });
}

export class FalDesignProvider implements DesignProvider {
  constructor(
    private readonly credentials: string | undefined = process.env.FAL_KEY,
    private readonly transport: FalDesignTransport | null = null,
  ) {}

  isConfigured() { return Boolean(this.transport || this.credentials?.trim()); }

  async generate(input: Parameters<DesignProvider["generate"]>[0]) {
    if (!this.isConfigured()) throw new Error("DESIGN_PROVIDER_NOT_CONFIGURED");
    const transport = this.transport ?? defaultTransport(this.credentials!.trim());
    const referenceUrl = input.reference ? await transport.upload(input.reference) : null;
    const providerPrompt = buildDesignProviderPrompt(input.setup);
    const prepared = buildDesignProviderInput({ setup: input.setup, providerPrompt, referenceUrl });
    let requestId: string | null = null;
    let queueHandle: DesignProviderQueueHandle | null = null;
    try {
      const submitted = await transport.submit(prepared.endpoint, prepared.payload);
      requestId = typeof submitted === "string" ? submitted : submitted.requestId;
      queueHandle = typeof submitted === "string" ? null : submitted.queueHandle;
      await input.onAccepted?.(requestId, prepared.endpoint, queueHandle ?? undefined);
      if (isRecraftEndpoint(prepared.endpoint) && !queueHandle && typeof submitted !== "string") {
        throw new Error("FAL_DESIGN_QUEUE_ACCEPTANCE_URLS_INVALID");
      }
      await transport.wait(prepared.endpoint, requestId, queueHandle);
      const data = await transport.result(prepared.endpoint, requestId, queueHandle);
      const results = normalizeFalDesignResults(data, input.setup.outputMode === "VECTOR");
      if (!results.length) throw new Error("DESIGN_PROVIDER_RESULT_EMPTY");
      return { providerModel: prepared.endpoint, providerRequestId: requestId, providerPrompt, results };
    } catch (error) {
      const normalized = normalizeDesignProviderError(error, input.setup.model);
      if (normalized) throw normalized;
      if (requestId) throw new DesignProviderUnknownOutcomeError(requestId, prepared.endpoint);
      throw error;
    }
  }

  async recover(input: Parameters<NonNullable<DesignProvider["recover"]>>[0]) {
    if (!this.isConfigured()) throw new Error("DESIGN_PROVIDER_NOT_CONFIGURED");
    const transport = this.transport ?? defaultTransport(this.credentials!.trim());
    try {
      if (!transport.status) return null;
      const status = await transport.status(
        input.providerModel,
        input.providerRequestId,
        input.providerQueueHandle,
      );
      if (status !== "COMPLETED") return null;
      const data = await transport.result(
        input.providerModel,
        input.providerRequestId,
        input.providerQueueHandle,
      );
      const results = normalizeFalDesignResults(data, input.setup.outputMode === "VECTOR");
      if (!results.length) throw new Error("DESIGN_PROVIDER_RESULT_EMPTY");
      return {
        providerModel: input.providerModel,
        providerRequestId: input.providerRequestId,
        providerPrompt: input.providerPrompt,
        results,
      };
    } catch (error) {
      const normalized = normalizeDesignProviderError(error, input.setup.model);
      if (normalized) throw normalized;
      throw error;
    }
  }
}
