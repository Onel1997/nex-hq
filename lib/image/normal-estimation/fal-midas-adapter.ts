import { createHash } from "node:crypto";
import { createFalClient } from "@fal-ai/client";
import { loadImage } from "canvas";
import { z } from "zod";
import {
  FAL_MIDAS_ADAPTER_VERSION,
  FAL_MIDAS_MODEL,
  type NormalEstimationProvider,
  type NormalEstimationProviderDescriptor,
  type NormalEstimationProviderInput,
  type NormalEstimationProviderResult,
  NormalEstimationProviderOutcomeUnknownError,
} from "@/lib/image/normal-estimation/types";

const imageSchema = z.object({ url: z.string().min(1), width: z.number().int().positive().nullable().optional(), height: z.number().int().positive().nullable().optional() }).passthrough();
const outputSchema = z.object({ depth_map: imageSchema, normal_map: imageSchema }).passthrough();

export type FalMidasConfig = { apiKey: string; model: string; maximumCostUsd: number };
export type FalMidasClient = { subscribe(model: string, options: { input: { image_url: string }; logs: false; mode: "polling"; headers: Record<string, string>; storageSettings: { expiresIn: "1h" } }): Promise<{ data: unknown; requestId: string }> };

export function readFalMidasConfig(): FalMidasConfig | null {
  const apiKey = process.env.FAL_KEY?.trim();
  const raw = process.env.NEXHQ_MIDAS_COST_MAX_USD?.trim();
  if (!apiKey || !raw) return null;
  const maximumCostUsd = Number(raw);
  if (!Number.isFinite(maximumCostUsd) || maximumCostUsd < 0) throw new Error("NEXHQ_MIDAS_COST_MAX_USD must be a non-negative number.");
  return { apiKey, model: process.env.NEXHQ_MIDAS_MODEL?.trim() || FAL_MIDAS_MODEL, maximumCostUsd };
}

function trusted(hostname: string) {
  return ["fal.media", "fal.ai", "fal.run"].some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
}
async function download(urlValue: string, request: typeof fetch) {
  const data = /^data:(image\/(?:png|jpeg|webp));base64,([a-z0-9+/=]+)$/i.exec(urlValue);
  if (data) return { bytes: Buffer.from(data[2]!, "base64"), mimeType: data[1]! };
  const url = new URL(urlValue);
  if (url.protocol !== "https:" || !trusted(url.hostname)) throw new Error("fal MiDaS returned an untrusted output URL.");
  const response = await request(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`fal MiDaS normal-map download failed with HTTP ${response.status}.`);
  const mimeType = response.headers.get("content-type")?.split(";")[0] ?? "image/png";
  if (!mimeType.startsWith("image/")) throw new Error("fal MiDaS normal response was not an image.");
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length || bytes.length > 50 * 1024 * 1024) throw new Error("fal MiDaS returned an invalid image size.");
  return { bytes, mimeType };
}

export class FalMidasNormalProvider implements NormalEstimationProvider {
  private readonly client: FalMidasClient | null;
  constructor(private readonly config: FalMidasConfig | null = readFalMidasConfig(), client?: FalMidasClient, private readonly request: typeof fetch = fetch) {
    this.client = client ?? (config ? createFalClient({ credentials: config.apiKey, retry: { maxRetries: 0 } }) as FalMidasClient : null);
  }
  isConfigured() { return Boolean(this.config && this.client); }
  describe(): NormalEstimationProviderDescriptor {
    if (!this.config || !this.client) throw new Error("fal MiDaS ist serverseitig nicht konfiguriert.");
    return { provider: "fal", model: this.config.model, adapterVersion: FAL_MIDAS_ADAPTER_VERSION, maximumCostUsd: this.config.maximumCostUsd };
  }
  async estimateNormals(input: NormalEstimationProviderInput): Promise<NormalEstimationProviderResult> {
    const descriptor = this.describe();
    let response: Awaited<ReturnType<FalMidasClient["subscribe"]>>;
    try {
      response = await this.client!.subscribe(descriptor.model, {
        input: { image_url: `data:${input.baseImage.mimeType};base64,${input.baseImage.bytes.toString("base64")}` },
        logs: false,
        mode: "polling",
        headers: {
          "Idempotency-Key": input.idempotencyKey,
          "X-NexHQ-Request-Binding": createHash("sha256").update(`${input.jobId}:${input.baseImage.checksumSha256}`).digest("hex"),
        },
        storageSettings: { expiresIn: "1h" },
      });
    } catch (error) {
      // subscribe combines queue submission and polling. A transport error at
      // this boundary cannot prove that fal did not accept/charge the request.
      // Convert it to an explicit unknown outcome so runtime recovery never
      // performs a blind duplicate paid call.
      throw new NormalEstimationProviderOutcomeUnknownError(
        error instanceof Error ? error.message : undefined,
      );
    }
    const output = outputSchema.parse(response.data);
    const downloaded = await download(output.normal_map.url, this.request);
    const decoded = await loadImage(downloaded.bytes);
    if ((output.normal_map.width != null && output.normal_map.width !== decoded.width) || (output.normal_map.height != null && output.normal_map.height !== decoded.height)) throw new Error("fal MiDaS normal metadata does not match downloaded bytes.");
    return {
      provider: "fal", model: descriptor.model, adapterVersion: descriptor.adapterVersion,
      providerRequestId: response.requestId || null, jobId: input.jobId,
      sourceBaseChecksumSha256: input.baseImage.checksumSha256,
      normalMapBytes: downloaded.bytes, outputWidth: decoded.width, outputHeight: decoded.height,
      outputMimeType: downloaded.mimeType, depthOutputIncluded: Boolean(output.depth_map.url),
    };
  }
}
