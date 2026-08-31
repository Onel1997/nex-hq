export const XERIANO_CREDIT_PRICING_VERSION =
  "xeriano-generation-pricing-v2-economy" as const;
export const XERIANO_CREDIT_PRICING_EFFECTIVE_DATE = "2026-08-30" as const;

export type XerianoCreditQuoteInput =
  | { modelId: "nano-banana-pro"; quality: "1K" | "2K" | "4K"; count?: 1 | 2 | 3 | 4 }
  | { modelId: "kling-v3-pro-motion-control"; durationSeconds: number }
  | {
      modelId: "ideogram-4" | "recraft-4";
      designModel: "IDEOGRAM_4" | "RECRAFT_4";
      quality: "FAST" | "STANDARD" | "HIGH";
      outputMode: "RASTER" | "VECTOR";
      aspectRatio: "1:1" | "4:5" | "3:4" | "2:3";
      resolution: "2K" | "4K";
      count: 1 | 2 | 4;
      hasReference: boolean;
    }
  | { modelId: "design-background-remove" | "design-upscale"; count: 1 };

/**
 * Customer-safe published sell-price authority. Internal provider costs and
 * safety calculations deliberately live in pricing-engine.ts instead.
 *
 * Nano's OWNER-approved launch price is 15/30 credits. The earlier 10-credit
 * proposal remains an inactive UNSAFE draft. No configured price is silently
 * rewritten by the safety engine.
 */
export const XERIANO_CREDIT_PRICE_REGISTRY = Object.freeze({
  "nano-banana-pro": {
    ruleId: "nano-banana-pro-quality-v2",
    rule: "QUALITY_X_COUNT",
    creditsByQuality: { "1K": 15, "2K": 15, "4K": 30 },
    version: XERIANO_CREDIT_PRICING_VERSION,
    effectiveDate: XERIANO_CREDIT_PRICING_EFFECTIVE_DATE,
    active: true,
    pricingComplete: true,
    customerAvailable: true,
  },
  "kling-v3-pro-motion-control": {
    ruleId: "kling-v3-motion-per-second-v2",
    rule: "PER_SECOND",
    creditsPerSecond: 25,
    version: XERIANO_CREDIT_PRICING_VERSION,
    effectiveDate: XERIANO_CREDIT_PRICING_EFFECTIVE_DATE,
    active: true,
    pricingComplete: true,
    customerAvailable: true,
  },
});

export const XERIANO_NANO_DESIRED_DRAFT = Object.freeze({
  ruleId: "nano-banana-pro-standard-owner-draft-10",
  modelId: "nano-banana-pro" as const,
  quality: "1K" as const,
  configuredCredits: 10,
  active: false,
  pricingComplete: true,
  requiresOwnerReview: true,
});

export const XERIANO_FUTURE_VIDEO_PRICE_TARGETS = Object.freeze([
  { businessLabel: "Kling 3.0 Pro", mappedModelId: null, durationSeconds: 5, audioEnabled: false, credits: 35 },
  { businessLabel: "Kling 3.0 Pro", mappedModelId: null, durationSeconds: 5, audioEnabled: true, credits: 55 },
  { businessLabel: "Veo 3.1 Fast", mappedModelId: null, durationSeconds: 5, audioEnabled: false, credits: 30 },
  { businessLabel: "Veo 3.1 Fast", mappedModelId: null, durationSeconds: 5, audioEnabled: true, credits: 50 },
  { businessLabel: "Veo 3.1 Standard", mappedModelId: null, durationSeconds: 5, audioEnabled: false, credits: 70 },
  { businessLabel: "Veo 3.1 Standard", mappedModelId: null, durationSeconds: 5, audioEnabled: true, credits: 130 },
  { businessLabel: "Seedance 2.0 Fast 720p", mappedModelId: null, durationSeconds: 5, audioEnabled: null, credits: 80 },
  { businessLabel: "Seedance 2.0 Fast 720p", mappedModelId: null, durationSeconds: 10, audioEnabled: null, credits: 160 },
  { businessLabel: "Seedance 2.0 Standard 720p", mappedModelId: null, durationSeconds: 5, audioEnabled: null, credits: 100 },
  { businessLabel: "Seedance 2.0 Standard 720p", mappedModelId: null, durationSeconds: 10, audioEnabled: null, credits: 200 },
  { businessLabel: "Seedance 2.0 Standard 1080p", mappedModelId: null, durationSeconds: 5, audioEnabled: null, credits: 220 },
  { businessLabel: "Seedance 2.0 Standard 1080p", mappedModelId: null, durationSeconds: 10, audioEnabled: null, credits: 440 },
]);

export function quoteXerianoCredits(input: XerianoCreditQuoteInput): number {
  if (input.modelId === "nano-banana-pro") {
    const rule = XERIANO_CREDIT_PRICE_REGISTRY[input.modelId];
    if (!rule.active || !rule.pricingComplete || !rule.customerAvailable) {
      throw new Error("CUSTOMER_PRICING_UNAVAILABLE");
    }
    return rule.creditsByQuality[input.quality] * (input.count ?? 1);
  }
  if (input.modelId === "ideogram-4" || input.modelId === "recraft-4"
    || input.modelId === "design-background-remove" || input.modelId === "design-upscale") {
    throw new Error("DESIGN_PRICE_REQUIRES_SAFETY_ENGINE");
  }
  if (input.modelId !== "kling-v3-pro-motion-control") {
    throw new Error("CUSTOMER_PRICING_UNAVAILABLE");
  }
  const rule = XERIANO_CREDIT_PRICE_REGISTRY[input.modelId];
  if (!rule.active || !rule.pricingComplete || !rule.customerAvailable) {
    throw new Error("CUSTOMER_PRICING_UNAVAILABLE");
  }
  if (!Number.isInteger(input.durationSeconds) || input.durationSeconds <= 0) {
    throw new Error("INVALID_VIDEO_DURATION");
  }
  return rule.creditsPerSecond * input.durationSeconds;
}

export function isCustomerPricedModel(modelId: string): boolean {
  if (!Object.hasOwn(XERIANO_CREDIT_PRICE_REGISTRY, modelId)) return false;
  const rule = XERIANO_CREDIT_PRICE_REGISTRY[
    modelId as keyof typeof XERIANO_CREDIT_PRICE_REGISTRY
  ];
  return rule.active && rule.pricingComplete && rule.customerAvailable;
}

export function getCustomerPublishedPricingDto() {
  return {
    version: XERIANO_CREDIT_PRICING_VERSION,
    models: {
      "nano-banana-pro": {
        modelId: "nano-banana-pro",
        label: "Nano Banana Pro",
        availability: "AVAILABLE",
        creditsByQuality: { ...XERIANO_CREDIT_PRICE_REGISTRY["nano-banana-pro"].creditsByQuality },
      },
      "kling-v3-pro-motion-control": {
        modelId: "kling-v3-pro-motion-control",
        label: "Kling V3 Pro Motion Control",
        availability: "AVAILABLE",
        creditsPerSecond: XERIANO_CREDIT_PRICE_REGISTRY["kling-v3-pro-motion-control"].creditsPerSecond,
      },
      "seedance-2.5": {
        modelId: "seedance-2.5",
        label: "Seedance 2.5",
        availability: "PRICING_INCOMPLETE",
      },
    },
  } as const;
}
