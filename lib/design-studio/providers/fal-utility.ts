import { createFalClient, type FalClient } from "@fal-ai/client";
import { buildDesignUtilityProviderInput, type DesignUtilityOperation } from "@/lib/design-studio/utility-config";
import type { DesignUtilityQueueHandle } from "@/lib/design-studio/utility-contracts";

export class DesignUtilityUnknownOutcomeError extends Error {
  constructor(readonly requestId: string, readonly endpoint: string) {
    super("DESIGN_UTILITY_PROVIDER_OUTCOME_UNKNOWN");
  }
}

export type FalUtilityTransport = {
  upload(bytes: Buffer, mimeType: string): Promise<string>;
  submit(endpoint: string, payload: Record<string, unknown>): Promise<string | { requestId: string; queueHandle: DesignUtilityQueueHandle | null }>;
  wait(endpoint: string, requestId: string, queueHandle?: DesignUtilityQueueHandle | null): Promise<void>;
  status?(endpoint: string, requestId: string, queueHandle?: DesignUtilityQueueHandle | null): Promise<"RUNNING" | "COMPLETED">;
  result(endpoint: string, requestId: string, queueHandle?: DesignUtilityQueueHandle | null): Promise<unknown>;
};

const FAL_QUEUE_HOST = "queue.fal.run";

function assertUtilityQueueUrl(value: string) {
  const parsed = new URL(value);
  if (parsed.protocol !== "https:" || parsed.hostname !== FAL_QUEUE_HOST || parsed.port
    || parsed.username || parsed.password || parsed.hash) throw new Error("FAL_UTILITY_QUEUE_URL_UNTRUSTED");
  return value;
}

export function extractFalUtilityQueueHandle(
  value: unknown,
  endpoint: string,
  seen: Set<object> = new Set(),
): DesignUtilityQueueHandle | null {
  if (!value || typeof value !== "object" || seen.has(value)) return null;
  seen.add(value);
  const record = value as Record<string, unknown>;
  const requestId = typeof record.request_id === "string" ? record.request_id : typeof record.requestId === "string" ? record.requestId : null;
  const statusUrl = typeof record.status_url === "string" ? record.status_url : typeof record.statusUrl === "string" ? record.statusUrl : null;
  const responseUrl = typeof record.response_url === "string" ? record.response_url : typeof record.responseUrl === "string" ? record.responseUrl : null;
  const cancelUrl = typeof record.cancel_url === "string" ? record.cancel_url : typeof record.cancelUrl === "string" ? record.cancelUrl : null;
  if (requestId && statusUrl && responseUrl) {
    return {
      requestId,
      endpoint,
      statusUrl: assertUtilityQueueUrl(statusUrl),
      responseUrl: assertUtilityQueueUrl(responseUrl),
      cancelUrl: cancelUrl ? assertUtilityQueueUrl(cancelUrl) : null,
    };
  }
  for (const key of ["queue", "data", "response"] as const) {
    const nested = record[key];
    if (nested && typeof nested === "object") {
      const handle = extractFalUtilityQueueHandle(nested, endpoint, seen);
      if (handle) return handle;
    }
  }
  return null;
}

function defaultTransport(credentials: string): FalUtilityTransport {
  const client: FalClient = createFalClient({ credentials });
  async function observe(url: string) {
    const response = await fetch(assertUtilityQueueUrl(url), {
      headers: { Authorization: `Key ${credentials}`, Accept: "application/json" },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(30_000),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(`FAL_UTILITY_QUEUE_HTTP_${response.status}`);
    return data;
  }
  return {
    upload(bytes, mimeType) {
      return client.storage.upload(new Blob([Uint8Array.from(bytes)], { type: mimeType }), { lifecycle: { expiresIn: "1d" } });
    },
    async submit(endpoint, payload) {
      const queued = await client.queue.submit(endpoint as never, { input: payload as never, storageSettings: { expiresIn: "1d" } });
      const requestId = queued.request_id;
      return { requestId, queueHandle: extractFalUtilityQueueHandle(queued, endpoint) };
    },
    async wait(endpoint, requestId, queueHandle) {
      if (queueHandle) {
        if (queueHandle.endpoint !== endpoint || queueHandle.requestId !== requestId) throw new Error("FAL_UTILITY_QUEUE_HANDLE_MISMATCH");
        while (true) {
          const status = (await observe(queueHandle.statusUrl) as { status?: unknown } | null)?.status;
          if (status === "COMPLETED") break;
          if (status !== "IN_QUEUE" && status !== "IN_PROGRESS") throw new Error("FAL_UTILITY_QUEUE_STATUS_INVALID");
          await new Promise((resolve) => setTimeout(resolve, 1_000));
        }
        return;
      }
      await client.queue.subscribeToStatus(endpoint as never, { requestId, mode: "polling", pollInterval: 1_000, logs: false });
    },
    async status(endpoint, requestId, queueHandle) {
      if (queueHandle) {
        if (queueHandle.endpoint !== endpoint || queueHandle.requestId !== requestId) throw new Error("FAL_UTILITY_QUEUE_HANDLE_MISMATCH");
        const value = await observe(queueHandle.statusUrl) as { status?: unknown } | null;
        if (value?.status === "COMPLETED") return "COMPLETED";
        if (value?.status === "IN_QUEUE" || value?.status === "IN_PROGRESS") return "RUNNING";
        throw new Error("FAL_UTILITY_QUEUE_STATUS_INVALID");
      }
      const value = await client.queue.status(endpoint as never, { requestId, logs: false });
      return value.status === "COMPLETED" ? "COMPLETED" : "RUNNING";
    },
    async result(endpoint, requestId, queueHandle) {
      if (queueHandle) {
        if (queueHandle.endpoint !== endpoint || queueHandle.requestId !== requestId) throw new Error("FAL_UTILITY_QUEUE_HANDLE_MISMATCH");
        return observe(queueHandle.responseUrl);
      }
      return (await client.queue.result(endpoint as never, { requestId })).data;
    },
  };
}

function resultUrl(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  for (const candidate of [record.image, record.output, record.images]) {
    const item = Array.isArray(candidate) ? candidate[0] : candidate;
    if (typeof item === "string" && item) return item;
    if (item && typeof item === "object" && typeof (item as Record<string, unknown>).url === "string") {
      return (item as Record<string, unknown>).url as string;
    }
  }
  if (record.data && typeof record.data === "object") return resultUrl(record.data);
  return null;
}

export class FalDesignUtilityProvider {
  constructor(
    private readonly credentials: string | undefined = process.env.FAL_KEY,
    private readonly transport: FalUtilityTransport | null = null,
  ) {}
  isConfigured() { return Boolean(this.transport || this.credentials?.trim()); }
  async generate(input: {
    operation: DesignUtilityOperation;
    sourceBytes: Buffer;
    sourceMimeType: string;
    upscaleFactor?: 2 | 4;
    onAccepted?: (requestId: string, endpoint: string, queueHandle?: DesignUtilityQueueHandle) => Promise<void> | void;
  }) {
    if (!this.isConfigured()) throw new Error("DESIGN_UTILITY_PROVIDER_NOT_CONFIGURED");
    const transport = this.transport ?? defaultTransport(this.credentials!.trim());
    const imageUrl = await transport.upload(input.sourceBytes, input.sourceMimeType);
    const prepared = buildDesignUtilityProviderInput({
      operation: input.operation,
      imageUrl,
      ...(input.upscaleFactor ? { upscaleFactor: input.upscaleFactor } : {}),
    });
    let requestId: string | null = null;
    try {
      const submitted = await transport.submit(prepared.endpoint, prepared.payload as Record<string, unknown>);
      requestId = typeof submitted === "string" ? submitted : submitted.requestId;
      const queueHandle = typeof submitted === "string" ? null : submitted.queueHandle;
      await input.onAccepted?.(requestId, prepared.endpoint, queueHandle ?? undefined);
      await transport.wait(prepared.endpoint, requestId, queueHandle);
      const url = resultUrl(await transport.result(prepared.endpoint, requestId, queueHandle));
      if (!url) throw new Error("DESIGN_UTILITY_RESULT_EMPTY");
      return { requestId, endpoint: prepared.endpoint, url };
    } catch (error) {
      if (requestId) throw new DesignUtilityUnknownOutcomeError(requestId, prepared.endpoint);
      throw error;
    }
  }

  async recover(input: {
    operation: DesignUtilityOperation;
    providerRequestId: string;
    providerModel: string;
    providerQueueHandle: DesignUtilityQueueHandle | null;
    upscaleFactor?: 2 | 4 | null;
  }) {
    if (!this.isConfigured()) return null;
    const expected = buildDesignUtilityProviderInput({
      operation: input.operation,
      imageUrl: "https://placeholder.invalid/source",
      ...(input.upscaleFactor ? { upscaleFactor: input.upscaleFactor } : {}),
    }).endpoint;
    if (input.providerModel !== expected) throw new Error("DESIGN_UTILITY_PROVIDER_MISMATCH");
    const transport = this.transport ?? defaultTransport(this.credentials!.trim());
    if (!transport.status) return null;
    const status = await transport.status(input.providerModel, input.providerRequestId, input.providerQueueHandle);
    if (status !== "COMPLETED") return null;
    const url = resultUrl(await transport.result(input.providerModel, input.providerRequestId, input.providerQueueHandle));
    if (!url) throw new Error("DESIGN_UTILITY_RESULT_EMPTY");
    return { requestId: input.providerRequestId, endpoint: input.providerModel, url };
  }
}
