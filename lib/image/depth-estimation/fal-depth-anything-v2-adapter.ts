import { createHash } from "node:crypto";

import { createFalClient } from "@fal-ai/client";
import { loadImage } from "canvas";
import { z } from "zod";

import {
  FAL_DEPTH_ANYTHING_V2_ADAPTER_VERSION,
  FAL_DEPTH_ANYTHING_V2_MODEL,
  type DepthEstimationProvider,
  type DepthEstimationProviderDescriptor,
  type DepthEstimationProviderInput,
  type DepthEstimationProviderResult,
} from "@/lib/image/depth-estimation/types";

const falImageSchema = z
  .object({
    url: z.string().min(1),
    content_type: z.string().nullable().optional(),
    width: z.number().int().positive().nullable().optional(),
    height: z.number().int().positive().nullable().optional(),
  })
  .passthrough();
const falOutputSchema = z.object({ image: falImageSchema }).passthrough();

export type FalDepthConfig = {
  apiKey: string;
  model: string;
  maximumCostUsd: number;
};

export type FalDepthClient = {
  subscribe(
    model: string,
    options: {
      input: { image_url: string };
      logs: false;
      mode: "polling";
      headers: Record<string, string>;
      storageSettings: { expiresIn: "1h" };
    },
  ): Promise<{ data: unknown; requestId: string }>;
};

function configuredMaximumCost(value: string | undefined): number | null {
  if (!value?.trim()) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error("NEXHQ_DEPTH_COST_MAX_USD must be a non-negative number.");
  }
  return parsed;
}

export function readFalDepthConfig(): FalDepthConfig | null {
  const apiKey = process.env.FAL_KEY?.trim();
  if (!apiKey) return null;
  const maximumCostUsd = configuredMaximumCost(
    process.env.NEXHQ_DEPTH_COST_MAX_USD,
  );
  // fal currently exposes this endpoint as compute-priced rather than a stable
  // fixed per-image price. NexHQ therefore refuses to invent a maximum and
  // requires the owner-configured cap before a paid job can be prepared.
  if (maximumCostUsd === null) return null;
  return {
    apiKey,
    model: process.env.NEXHQ_DEPTH_MODEL?.trim() || FAL_DEPTH_ANYTHING_V2_MODEL,
    maximumCostUsd,
  };
}

function isTrustedFalMediaHost(hostname: string): boolean {
  return ["fal.media", "fal.ai", "fal.run"].some(
    (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
  );
}

async function downloadDepthMap(urlValue: string, request: typeof fetch) {
  const data = /^data:(image\/(?:png|jpeg|webp));base64,([a-z0-9+/=]+)$/i.exec(
    urlValue,
  );
  if (data) return { bytes: Buffer.from(data[2]!, "base64"), mimeType: data[1]! };
  const url = new URL(urlValue);
  if (url.protocol !== "https:" || !isTrustedFalMediaHost(url.hostname)) {
    throw new Error("fal Depth Anything returned an untrusted output URL.");
  }
  const response = await request(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`fal depth-map download failed with HTTP ${response.status}.`);
  }
  const mimeType = response.headers.get("content-type")?.split(";")[0] ?? "image/png";
  if (!mimeType.startsWith("image/")) {
    throw new Error("fal Depth Anything response was not an image.");
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length || bytes.length > 50 * 1024 * 1024) {
    throw new Error("fal Depth Anything returned an invalid image size.");
  }
  return { bytes, mimeType };
}

export class FalDepthAnythingV2Provider implements DepthEstimationProvider {
  private readonly client: FalDepthClient | null;

  constructor(
    private readonly config: FalDepthConfig | null = readFalDepthConfig(),
    client?: FalDepthClient,
    private readonly request: typeof fetch = fetch,
  ) {
    this.client =
      client ??
      (config
        ? (createFalClient({
            credentials: config.apiKey,
            retry: { maxRetries: 0 },
          }) as FalDepthClient)
        : null);
  }

  isConfigured(): boolean {
    return Boolean(this.config && this.client);
  }

  describe(): DepthEstimationProviderDescriptor {
    if (!this.config || !this.client) {
      throw new Error("fal Depth Anything V2 ist serverseitig nicht konfiguriert.");
    }
    return {
      provider: "fal",
      model: this.config.model,
      adapterVersion: FAL_DEPTH_ANYTHING_V2_ADAPTER_VERSION,
      maximumCostUsd: this.config.maximumCostUsd,
    };
  }

  async estimateDepth(
    input: DepthEstimationProviderInput,
  ): Promise<DepthEstimationProviderResult> {
    const descriptor = this.describe();
    const result = await this.client!.subscribe(descriptor.model, {
      input: {
        image_url: `data:${input.baseImage.mimeType};base64,${input.baseImage.bytes.toString("base64")}`,
      },
      logs: false,
      mode: "polling",
      headers: {
        "Idempotency-Key": input.idempotencyKey,
        "X-NexHQ-Request-Binding": createHash("sha256")
          .update(`${input.jobId}:${input.baseImage.checksumSha256}`)
          .digest("hex"),
      },
      storageSettings: { expiresIn: "1h" },
    });
    const output = falOutputSchema.parse(result.data);
    const downloaded = await downloadDepthMap(output.image.url, this.request);
    const decoded = await loadImage(downloaded.bytes);
    if (
      (output.image.width != null && output.image.width !== decoded.width) ||
      (output.image.height != null && output.image.height !== decoded.height)
    ) {
      throw new Error("fal depth-map metadata does not match the downloaded bytes.");
    }
    return {
      provider: "fal",
      model: descriptor.model,
      adapterVersion: descriptor.adapterVersion,
      providerRequestId: result.requestId || null,
      jobId: input.jobId,
      sourceBaseChecksumSha256: input.baseImage.checksumSha256,
      depthMapBytes: downloaded.bytes,
      outputWidth: decoded.width,
      outputHeight: decoded.height,
      outputMimeType: downloaded.mimeType,
    };
  }
}
