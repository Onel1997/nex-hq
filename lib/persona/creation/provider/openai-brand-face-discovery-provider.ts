/**
 * Phase 2.2A — OpenAI Images as a BrandFaceDiscoveryProvider.
 * Keeps OpenAI available; not the required/default A1 discovery provider when fal is configured.
 * Does not delete or replace OpenAiCandidateGenerator batch path.
 * Server-side usage only (never import from client components).
 */
import { generateOpenAiImage } from "@/agents/image/providers/openai-images-provider";
import { isOpenAiImagesConfigured } from "@/agents/image/providers/openai-images-provider";
import {
  OPENAI_IMAGE_COST_EUR_MAX,
  OPENAI_IMAGE_COST_EUR_MIN,
} from "./cost";
import {
  DiscoveryProviderError,
  type BrandFaceDiscoveryGenerateInput,
  type BrandFaceDiscoveryGenerateResult,
  type BrandFaceDiscoveryProvider,
} from "./brand-face-discovery-provider";

const DEFAULT_TIMEOUT_MS = 180_000;

export class OpenAiBrandFaceDiscoveryProvider implements BrandFaceDiscoveryProvider {
  readonly providerName = "openai" as const;
  readonly modelName = "gpt-image-1";
  readonly supportsSeed = false;
  readonly supportsDeterministicGeneration = false;
  readonly supportsAbortSignal = true;

  isConfigured(): boolean {
    return isOpenAiImagesConfigured();
  }

  estimateUnitCostEur(): { min: number; max: number; status: "estimated" } {
    return {
      min: OPENAI_IMAGE_COST_EUR_MIN,
      max: OPENAI_IMAGE_COST_EUR_MAX,
      status: "estimated",
    };
  }

  async generateDiscoveryCandidate(
    input: BrandFaceDiscoveryGenerateInput,
  ): Promise<BrandFaceDiscoveryGenerateResult> {
    if (!this.isConfigured()) {
      throw new DiscoveryProviderError({
        message: "OPENAI_API_KEY missing",
        code: "discovery_provider_not_configured",
        providerName: "openai",
      });
    }

    const providerStartedAt = new Date().toISOString();
    const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const controller = new AbortController();
    const onAbort = () => controller.abort();
    input.abortSignal?.addEventListener("abort", onAbort, { once: true });
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const generated = await generateOpenAiImage({
        prompt: input.prompt,
        dimensions: "1024x1024",
        assetType: "persona_candidate",
        signal: controller.signal,
      });

      if (!generated.imageBytes) {
        throw new DiscoveryProviderError({
          message: "OpenAI returned no image bytes",
          code: "openai_empty_result",
          providerName: "openai",
        });
      }

      const band = this.estimateUnitCostEur();
      return {
        providerName: "openai",
        providerModel: this.modelName,
        // OpenAI Images does not honor an explicit seed; persist derived seed for audit only.
        providerSeed: input.providerSeed,
        providerRequestId: generated.providerRequestId ?? generated.providerId ?? null,
        providerResultId: generated.providerRequestId ?? null,
        imageBytes: generated.imageBytes,
        mimeType: "image/png",
        estimatedCostEur: Number(((band.min + band.max) / 2).toFixed(4)),
        costStatus: "estimated",
        providerStartedAt,
        providerCompletedAt: new Date().toISOString(),
        metadata: {
          supportsSeed: false,
          note: "OpenAI Images does not support deterministic seeds; seed persisted for attempt identity only.",
        },
      };
    } catch (error) {
      if (
        controller.signal.aborted ||
        (error instanceof Error && error.name === "AbortError")
      ) {
        throw new DiscoveryProviderError({
          message: "openai discovery request timed out or aborted",
          code: "provider_timeout",
          providerName: "openai",
        });
      }
      if (error instanceof DiscoveryProviderError) throw error;
      throw new DiscoveryProviderError({
        message: error instanceof Error ? error.message : "openai provider failure",
        code: "openai_provider_failed",
        providerName: "openai",
      });
    } finally {
      clearTimeout(timer);
      input.abortSignal?.removeEventListener("abort", onAbort);
    }
  }
}
