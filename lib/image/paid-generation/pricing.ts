import type { OpenAiImageQuality, OpenAiImageSize } from "@/lib/image/image-generation-config";
import type { ImageCostEstimate } from "./types";

const OUTPUT_PRICES_USD: Record<Exclude<OpenAiImageQuality, "auto">, Record<OpenAiImageSize, number>> = {
  low: { "1024x1024": 0.011, "1536x1024": 0.016, "1024x1536": 0.016 },
  medium: { "1024x1024": 0.042, "1536x1024": 0.063, "1024x1536": 0.063 },
  high: { "1024x1024": 0.167, "1536x1024": 0.25, "1024x1536": 0.25 },
};

export class ImagePricingConfigurationError extends Error {
  constructor(message: string) { super(message); this.name = "ImagePricingConfigurationError"; }
}

/**
 * Output prices are centralized from the official gpt-image-1 model page,
 * checked 2026-08-17. Image-input token cost depends on input detail/size, so
 * the operator must configure a conservative per-attempt allowance.
 */
export function estimateImageGenerationCost(input: {
  size: OpenAiImageSize;
  quality: OpenAiImageQuality;
  inputCostMaximumUsd?: string;
}): ImageCostEstimate {
  const quality = input.quality === "auto" ? "high" : input.quality;
  const allowanceRaw = input.inputCostMaximumUsd ?? process.env.NEXHQ_OPENAI_IMAGE_INPUT_COST_MAX_USD;
  const allowance = allowanceRaw == null || allowanceRaw.trim() === "" ? Number.NaN : Number(allowanceRaw);
  if (!Number.isFinite(allowance) || allowance < 0) {
    throw new ImagePricingConfigurationError(
      "NEXHQ_OPENAI_IMAGE_INPUT_COST_MAX_USD must configure a conservative image-input cost allowance before paid Image preparation.",
    );
  }
  const minimum = OUTPUT_PRICES_USD[quality][input.size];
  return {
    currency: "USD",
    minimum,
    maximum: Number((minimum + allowance).toFixed(4)),
    isMaximumOperatorConfigured: true,
    pricingVersion: "openai-gpt-image-1-2026-08-17",
    basis: "One image output plus operator-configured maximum allowance for two high-fidelity image inputs; taxes and provider pricing changes excluded.",
  };
}
