import type { DesignGenerationSetup } from "@/lib/design-studio/contracts";
import { resolveDesignEndpoint, resolveDesignOutputDimensions } from "@/lib/design-studio/model-config";

export const DESIGN_PROVIDER_COST_VERSION = "fal-design-public-pricing-2026-08-31-v2" as const;
export const DESIGN_PRICING_VERSION = "xeriano-design-generation-pricing-v1" as const;

/**
 * Versioned repository authority used by the shared Xeriamo safety engine.
 * Ideogram costs are conservative integer USD micros per megapixel; Recraft
 * costs are integer USD micros per result. They are deliberately server-only.
 * A later reviewed version replaces this object prospectively.
 */
export const DESIGN_PROVIDER_COST_MICROS = Object.freeze({
  IDEOGRAM_4: Object.freeze({ FAST: 7_500, STANDARD: 15_000, HIGH: 25_000 }),
  RECRAFT_4: Object.freeze({ RASTER: 40_000, VECTOR: 80_000 }),
});

export function resolveDesignProviderCost(setup: Pick<DesignGenerationSetup, "model" | "quality" | "outputMode" | "aspectRatio" | "resolution" | "count" | "reference">) {
  const dimensions = resolveDesignOutputDimensions(setup as DesignGenerationSetup);
  const unitCostMicros = setup.model === "IDEOGRAM_4"
    ? Math.ceil(
        DESIGN_PROVIDER_COST_MICROS.IDEOGRAM_4[setup.quality]
        * dimensions.width * dimensions.height / 1_000_000,
      )
    : DESIGN_PROVIDER_COST_MICROS.RECRAFT_4[setup.outputMode];
  return {
    providerModel: resolveDesignEndpoint(setup as DesignGenerationSetup),
    unitCostMicros,
    totalCostMicros: unitCostMicros * setup.count,
    version: DESIGN_PROVIDER_COST_VERSION,
    source: setup.model === "IDEOGRAM_4"
      ? "fal Ideogram V4 published per-megapixel pricing reviewed 2026-08-31"
      : "fal Recraft V4 published per-image pricing reviewed 2026-08-31",
  };
}
