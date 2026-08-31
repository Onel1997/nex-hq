export const DESIGN_UTILITY_OPERATIONS = ["BACKGROUND_REMOVE", "UPSCALE"] as const;
export type DesignUtilityOperation = (typeof DESIGN_UTILITY_OPERATIONS)[number];

export const DESIGN_UTILITY_PRICING_VERSION = "xeriamo-design-utilities-v1" as const;

export const DESIGN_UTILITY_CONFIG = Object.freeze({
  BACKGROUND_REMOVE: Object.freeze({
    endpoint: "fal-ai/ideogram/remove-background",
    providerCostUsdMicros: 10_000,
    providerCostSource: "OWNER-provided fal estimate: USD 0.01 per image (2026-08-31)",
    pricingRuleId: "design-background-remove-v1",
  }),
  UPSCALE: Object.freeze({
    endpoint: "fal-ai/esrgan",
    providerCostUsdMicros: 19_980,
    providerCostSource: "fal ESRGAN published USD 0.00111/compute-second × conservative V1 18-second estimate; verify against first controlled job",
    providerUnitCostUsdMicros: 1_110,
    estimatedComputeSeconds: 18,
    pricingRuleId: "design-upscale-2x-v1",
  }),
});

export function resolveDesignUtilityConfig(operation: DesignUtilityOperation) {
  return DESIGN_UTILITY_CONFIG[operation];
}

export function buildDesignUtilityProviderInput(input: {
  operation: DesignUtilityOperation;
  imageUrl: string;
}) {
  const config = resolveDesignUtilityConfig(input.operation);
  if (input.operation === "BACKGROUND_REMOVE") {
    return { endpoint: config.endpoint, payload: { image_url: input.imageUrl } } as const;
  }
  return {
    endpoint: config.endpoint,
    payload: {
      image_url: input.imageUrl,
      model: "RealESRGAN_x2plus",
      scale: 2,
      face: false,
      output_format: "png",
      tile: 0,
    },
  } as const;
}
