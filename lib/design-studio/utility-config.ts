export const DESIGN_UTILITY_OPERATIONS = ["BACKGROUND_REMOVE", "UPSCALE"] as const;
export type DesignUtilityOperation = (typeof DESIGN_UTILITY_OPERATIONS)[number];

export const DESIGN_UTILITY_PRICING_VERSION = "xeriamo-design-utilities-v1" as const;

export const DESIGN_UTILITY_CONFIG = Object.freeze({
  BACKGROUND_REMOVE: Object.freeze({
    endpoint: "fal-ai/ideogram/remove-background",
    providerCostUsdMicros: 10_000,
    providerCostSource: "fal Ideogram Remove Background published USD 0.01 per image, reviewed 2026-09-08",
    maxInputBytes: 10 * 1024 * 1024,
    pricingRuleId: "design-background-remove-v1",
  }),
  UPSCALE: Object.freeze({
    endpoint: "fal-ai/esrgan",
    providerCostUsdMicros: 19_980,
    providerCostSource: "fal ESRGAN published USD 0.00111/compute-second × conservative V1 18-second estimate; verify against first controlled job",
    providerUnitCostUsdMicros: 1_110,
    estimatedComputeSeconds: 18,
    pricingRuleId: "design-upscale-2x-v1",
    maxInputBytes: 50 * 1024 * 1024,
  }),
});

export function resolveDesignUtilityConfig(operation: DesignUtilityOperation) {
  return DESIGN_UTILITY_CONFIG[operation];
}

export function buildDesignUtilityProviderInput(input: {
  operation: DesignUtilityOperation;
  imageUrl: string;
  upscaleFactor?: 2 | 4;
}) {
  const config = resolveDesignUtilityConfig(input.operation);
  if (input.operation === "BACKGROUND_REMOVE") {
    return { endpoint: config.endpoint, payload: { image_url: input.imageUrl } } as const;
  }
  return {
    endpoint: config.endpoint,
    payload: {
      image_url: input.imageUrl,
      model: input.upscaleFactor === 4 ? "RealESRGAN_x4plus" : "RealESRGAN_x2plus",
      scale: input.upscaleFactor ?? 2,
      face: false,
      output_format: "png",
      tile: 0,
    },
  } as const;
}
