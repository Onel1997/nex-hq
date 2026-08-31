import { createFalClient, type FalClient } from "@fal-ai/client";

import { buildDesignProviderInput, buildDesignProviderPrompt, DESIGN_ENDPOINTS } from "@/lib/design-studio/model-config";
import type { DesignEndpoint } from "@/lib/design-studio/model-config";
import type { DesignProvider, DesignProviderReference, DesignProviderResult } from "@/lib/design-studio/provider";
import { DesignProviderUnknownOutcomeError } from "@/lib/design-studio/provider";
import { normalizeDesignProviderError } from "@/lib/design-studio/provider-errors";

export type FalDesignTransport = {
  upload(reference: DesignProviderReference): Promise<string>;
  submit(endpoint: DesignEndpoint, input: Record<string, unknown>): Promise<string>;
  wait(endpoint: DesignEndpoint, requestId: string): Promise<void>;
  status?(endpoint: DesignEndpoint, requestId: string): Promise<"RUNNING" | "COMPLETED">;
  result(endpoint: DesignEndpoint, requestId: string): Promise<unknown>;
};

type FalQueueStage = "status" | "result";
type FalQueueStatus = "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED";

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
  },
) {
  const payload = {
    routeClass: fields.endpoint,
    requestIdPresent: fields.requestIdPresent,
    recoveryStage: fields.recoveryStage,
    providerStatus: fields.providerStatus ?? null,
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

/**
 * fal queue requests are scoped to the full accepted endpoint. In
 * @fal-ai/client 1.10.1 queue.status()/result() parse the endpoint and drop
 * path segments after owner/alias; Recraft V4 route classes require those
 * segments. Keep the exact allowlisted endpoint from submission here.
 */
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
  async function request(endpoint: DesignEndpoint, requestId: string, stage: FalQueueStage) {
    const response = await fetcher(buildFalDesignQueueObservationUrl(endpoint, requestId, stage), {
      method: "GET",
      headers: { Authorization: `Key ${credentials}`, Accept: "application/json" },
      cache: "no-store",
    });
    try {
      const value = await readFalQueueResponse(response);
      if (stage === "result") {
        logRecraftQueue("recraft_result_recovered", {
          endpoint, requestIdPresent: true, recoveryStage: stage, providerStatus: response.status,
        });
      }
      return value;
    } catch (error) {
      logRecraftQueue("recraft_poll_failed", {
        endpoint,
        requestIdPresent: true,
        recoveryStage: stage,
        providerStatus: error instanceof FalDesignQueueObservationError ? error.status : response.status,
      });
      throw error;
    }
  }
  return {
    async status(endpoint: DesignEndpoint, requestId: string): Promise<FalQueueStatus> {
      const value = await request(endpoint, requestId, "status");
      const status = value && typeof value === "object"
        ? (value as { status?: unknown }).status
        : null;
      if (status !== "IN_QUEUE" && status !== "IN_PROGRESS" && status !== "COMPLETED") {
        throw new Error("FAL_DESIGN_QUEUE_STATUS_INVALID");
      }
      if (status === "COMPLETED") {
        logRecraftQueue("recraft_poll_endpoint_match", {
          endpoint, requestIdPresent: true, recoveryStage: "status", providerStatus: status,
        });
      }
      return status;
    },
    result(endpoint: DesignEndpoint, requestId: string) {
      return request(endpoint, requestId, "result");
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
      if (isRecraftEndpoint(endpoint)) {
        logRecraftQueue("recraft_accepted", {
          endpoint, requestIdPresent: true, recoveryStage: "submit",
        });
      }
      return requestId;
    },
    async wait(endpoint, requestId) {
      if (isRecraftEndpoint(endpoint)) {
        while (await recraftQueue.status(endpoint, requestId) !== "COMPLETED") {
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
    async status(endpoint, requestId) {
      if (isRecraftEndpoint(endpoint)) {
        return await recraftQueue.status(endpoint, requestId) === "COMPLETED" ? "COMPLETED" : "RUNNING";
      }
      const status = await client.queue.status(endpoint as never, {
        requestId,
        logs: false,
      });
      return status.status === "COMPLETED" ? "COMPLETED" : "RUNNING";
    },
    async result(endpoint, requestId) {
      if (isRecraftEndpoint(endpoint)) return recraftQueue.result(endpoint, requestId);
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
    try {
      requestId = await transport.submit(prepared.endpoint, prepared.payload);
      await input.onAccepted?.(requestId, prepared.endpoint);
      await transport.wait(prepared.endpoint, requestId);
      const data = await transport.result(prepared.endpoint, requestId);
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
      const status = await transport.status(input.providerModel, input.providerRequestId);
      if (status !== "COMPLETED") return null;
      const data = await transport.result(input.providerModel, input.providerRequestId);
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
