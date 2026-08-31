import { createFalClient, type FalClient } from "@fal-ai/client";

import { buildDesignProviderInput, buildDesignProviderPrompt } from "@/lib/design-studio/model-config";
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

function defaultTransport(credentials: string): FalDesignTransport {
  const client: FalClient = createFalClient({ credentials });
  return {
    upload(reference) {
      return client.storage.upload(new Blob([Uint8Array.from(reference.bytes)], { type: reference.mimeType }), {
        lifecycle: { expiresIn: "1d" },
      });
    },
    async submit(endpoint, input) {
      const queued = await client.queue.submit(endpoint as never, {
        input: input as never,
        storageSettings: { expiresIn: "1d" },
      });
      return queued.request_id;
    },
    async wait(endpoint, requestId) {
      await client.queue.subscribeToStatus(endpoint as never, {
        requestId,
        mode: "polling",
        pollInterval: 1_000,
        logs: false,
      });
    },
    async status(endpoint, requestId) {
      const status = await client.queue.status(endpoint as never, {
        requestId,
        logs: false,
      });
      return status.status === "COMPLETED" ? "COMPLETED" : "RUNNING";
    },
    async result(endpoint, requestId) {
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
