import { resolveDesignUtilityConfig } from "@/lib/design-studio/utility-config";

export const ARTWORK_PREP_PRICING_VERSION = "xeriamo-artwork-prep-owner-estimate-v1" as const;

export function artworkPrepOwnerEstimate(input: {
  operation: "BACKGROUND_REMOVE" | "UPSCALE";
  factor?: 2 | 4;
}) {
  const config = resolveDesignUtilityConfig(input.operation);
  const micros = input.operation === "UPSCALE" && input.factor === 4
    ? config.providerCostUsdMicros * 2
    : config.providerCostUsdMicros;
  return {
    financialMode: "OWNER_ESTIMATE_ONLY" as const,
    estimatedCostUsdMicros: micros,
    label: `ca. ${(micros / 1_000_000).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`,
    pricingVersion: ARTWORK_PREP_PRICING_VERSION,
  };
}
