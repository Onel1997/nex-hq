/**
 * Phase 2.2A — fal.ai FLUX Brand Face Discovery provider.
 * Server-side usage only (never import from client components).
 * Uses official @fal-ai/client. Never exposes FAL_KEY.
 *
 * Live calls are gated; unit tests inject a fake FalClient — no paid calls.
 */
import {
  FAL_FLUX_IMAGE_COST_EUR_MAX,
  FAL_FLUX_IMAGE_COST_EUR_MIN,
  isFalConfigured,
  readFalKey,
  resolveFalModel,
} from "./discovery-provider-config";
import {
  DiscoveryProviderError,
  type BrandFaceDiscoveryGenerateInput,
  type BrandFaceDiscoveryGenerateResult,
  type BrandFaceDiscoveryProvider,
} from "./brand-face-discovery-provider";

export type FalSubscribeResult = {
  data: {
    images?: Array<{ url?: string; content_type?: string }>;
    seed?: number;
  };
  requestId?: string;
};

export type FalClientLike = {
  subscribe: (
    model: string,
    options: {
      input: Record<string, unknown>;
      abortSignal?: AbortSignal;
    },
  ) => Promise<FalSubscribeResult>;
};

const DEFAULT_TIMEOUT_MS = 180_000;

async function downloadImage(url: string, signal?: AbortSignal): Promise<{
  bytes: Buffer;
  mimeType: string;
}> {
  const res = await fetch(url, { signal });
  if (!res.ok) {
    throw new DiscoveryProviderError({
      message: `Failed to download fal image (${res.status})`,
      code: "fal_image_download_failed",
      providerName: "fal_flux",
    });
  }
  const mimeType = res.headers.get("content-type") || "image/jpeg";
  const ab = await res.arrayBuffer();
  return { bytes: Buffer.from(ab), mimeType };
}

export class FalFluxDiscoveryProvider implements BrandFaceDiscoveryProvider {
  readonly providerName = "fal_flux" as const;
  readonly supportsSeed = true;
  readonly supportsDeterministicGeneration = true;
  readonly supportsAbortSignal = true;

  private readonly model: string;
  private readonly clientFactory: () => Promise<FalClientLike>;
  private readonly injectedClient: boolean;

  constructor(options?: {
    model?: string;
    clientFactory?: () => Promise<FalClientLike>;
  }) {
    this.model = options?.model ?? resolveFalModel();
    this.injectedClient = Boolean(options?.clientFactory);
    this.clientFactory =
      options?.clientFactory ??
      (async () => {
        const key = readFalKey();
        if (!key) {
          throw new DiscoveryProviderError({
            message: "FAL_KEY is not configured",
            code: "discovery_provider_not_configured",
            providerName: "fal_flux",
          });
        }
        const mod = await import("@fal-ai/client");
        const fal = mod.fal;
        fal.config({ credentials: key });
        return {
          subscribe: (model, opts) =>
            fal.subscribe(model, {
              input: opts.input,
              ...(opts.abortSignal ? { abortSignal: opts.abortSignal } : {}),
            }) as Promise<FalSubscribeResult>,
        };
      });
  }

  get modelName(): string {
    return this.model;
  }

  isConfigured(): boolean {
    return isFalConfigured();
  }

  estimateUnitCostEur(): { min: number; max: number; status: "estimated" } {
    return {
      min: FAL_FLUX_IMAGE_COST_EUR_MIN,
      max: FAL_FLUX_IMAGE_COST_EUR_MAX,
      status: "estimated",
    };
  }

  async generateDiscoveryCandidate(
    input: BrandFaceDiscoveryGenerateInput,
  ): Promise<BrandFaceDiscoveryGenerateResult> {
    if (!this.injectedClient && !this.isConfigured()) {
      throw new DiscoveryProviderError({
        message: "FAL_KEY missing",
        code: "discovery_provider_not_configured",
        providerName: "fal_flux",
      });
    }

    const providerStartedAt = new Date().toISOString();
    const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const controller = new AbortController();
    const onAbort = () => controller.abort();
    input.abortSignal?.addEventListener("abort", onAbort, { once: true });
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let requestId: string | null = null;
    try {
      if (controller.signal.aborted) {
        throw new DiscoveryProviderError({
          message: "fal request aborted before start",
          code: "provider_timeout",
          providerName: "fal_flux",
        });
      }

      const client = await this.clientFactory();
      const result = await client.subscribe(this.model, {
        input: {
          prompt: input.prompt,
          image_size: "portrait_4_3",
          num_images: 1,
          seed: input.providerSeed,
          output_format: "png",
          enable_safety_checker: true,
        },
        abortSignal: controller.signal,
      });

      requestId = result.requestId ?? null;
      const imageUrl = result.data.images?.[0]?.url;
      if (!imageUrl) {
        throw new DiscoveryProviderError({
          message: "fal returned no image url",
          code: "fal_empty_result",
          providerName: "fal_flux",
          providerRequestId: requestId,
        });
      }

      const { bytes, mimeType } = await downloadImage(imageUrl, controller.signal);
      const band = this.estimateUnitCostEur();
      const estimatedCostEur = Number(((band.min + band.max) / 2).toFixed(4));
      const providerCompletedAt = new Date().toISOString();

      return {
        providerName: "fal_flux",
        providerModel: this.model,
        providerSeed: result.data.seed ?? input.providerSeed,
        providerRequestId: requestId,
        providerResultId: requestId,
        imageBytes: bytes,
        mimeType,
        estimatedCostEur,
        costStatus: "estimated",
        providerStartedAt,
        providerCompletedAt,
        metadata: {
          imageSize: "portrait_4_3",
          numImages: 1,
        },
      };
    } catch (error) {
      if (
        controller.signal.aborted ||
        (error instanceof Error && error.name === "AbortError")
      ) {
        throw new DiscoveryProviderError({
          message: "fal discovery request timed out or aborted",
          code: "provider_timeout",
          providerName: "fal_flux",
          providerRequestId: requestId,
        });
      }
      if (error instanceof DiscoveryProviderError) throw error;
      throw new DiscoveryProviderError({
        message: error instanceof Error ? error.message : "fal provider failure",
        code: "fal_provider_failed",
        providerName: "fal_flux",
        providerRequestId: requestId,
      });
    } finally {
      clearTimeout(timer);
      input.abortSignal?.removeEventListener("abort", onAbort);
    }
  }
}
