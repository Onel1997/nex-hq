import { createFalClient, type FalClient } from "@fal-ai/client";
import { buildDesignUtilityProviderInput, type DesignUtilityOperation } from "@/lib/design-studio/utility-config";

export class DesignUtilityUnknownOutcomeError extends Error {
  constructor(readonly requestId: string, readonly endpoint: string) {
    super("DESIGN_UTILITY_PROVIDER_OUTCOME_UNKNOWN");
  }
}

export type FalUtilityTransport = {
  upload(bytes: Buffer, mimeType: string): Promise<string>;
  submit(endpoint: string, payload: Record<string, unknown>): Promise<string>;
  wait(endpoint: string, requestId: string): Promise<void>;
  result(endpoint: string, requestId: string): Promise<unknown>;
};

function defaultTransport(credentials: string): FalUtilityTransport {
  const client: FalClient = createFalClient({ credentials });
  return {
    upload(bytes, mimeType) {
      return client.storage.upload(new Blob([Uint8Array.from(bytes)], { type: mimeType }), { lifecycle: { expiresIn: "1d" } });
    },
    async submit(endpoint, payload) {
      const queued = await client.queue.submit(endpoint as never, { input: payload as never, storageSettings: { expiresIn: "1d" } });
      return queued.request_id;
    },
    async wait(endpoint, requestId) {
      await client.queue.subscribeToStatus(endpoint as never, { requestId, mode: "polling", pollInterval: 1_000, logs: false });
    },
    async result(endpoint, requestId) {
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
    onAccepted?: (requestId: string, endpoint: string) => Promise<void> | void;
  }) {
    if (!this.isConfigured()) throw new Error("DESIGN_UTILITY_PROVIDER_NOT_CONFIGURED");
    const transport = this.transport ?? defaultTransport(this.credentials!.trim());
    const imageUrl = await transport.upload(input.sourceBytes, input.sourceMimeType);
    const prepared = buildDesignUtilityProviderInput({ operation: input.operation, imageUrl });
    let requestId: string | null = null;
    try {
      requestId = await transport.submit(prepared.endpoint, prepared.payload as Record<string, unknown>);
      await input.onAccepted?.(requestId, prepared.endpoint);
      await transport.wait(prepared.endpoint, requestId);
      const url = resultUrl(await transport.result(prepared.endpoint, requestId));
      if (!url) throw new Error("DESIGN_UTILITY_RESULT_EMPTY");
      return { requestId, endpoint: prepared.endpoint, url };
    } catch (error) {
      if (requestId) throw new DesignUtilityUnknownOutcomeError(requestId, prepared.endpoint);
      throw error;
    }
  }
}
