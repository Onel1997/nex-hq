import type { DesignGenerationSetup } from "@/lib/design-studio/contracts";
import { resolveDesignEndpoint, resolveDesignOutputDimensions } from "@/lib/design-studio/model-config";

export const DESIGN_PROVIDER_COST_VERSION = "fal-design-public-pricing-2026-09-08-v3" as const;
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
  GPT_IMAGE_2: Object.freeze({
    TEXT: Object.freeze({
      STANDARD: Object.freeze({ "1:1": 53_000, "4:5": 53_000, "3:4": 37_000, "2:3": 42_000 }),
      HIGH: Object.freeze({ "1:1": 211_000, "4:5": 211_000, "3:4": 145_000, "2:3": 165_000 }),
    }),
    EDIT: Object.freeze({
      STANDARD: Object.freeze({ "1:1": 61_000, "4:5": 61_000, "3:4": 43_000, "2:3": 54_000 }),
      HIGH: Object.freeze({ "1:1": 219_000, "4:5": 219_000, "3:4": 151_000, "2:3": 178_000 }),
    }),
  }),
});

export function resolveDesignProviderCost(setup: Pick<DesignGenerationSetup, "model" | "quality" | "outputMode" | "aspectRatio" | "resolution" | "count" | "reference">) {
  const dimensions = resolveDesignOutputDimensions(setup as DesignGenerationSetup);
  const unitCostMicros = setup.model === "IDEOGRAM_4"
    ? Math.ceil(
        DESIGN_PROVIDER_COST_MICROS.IDEOGRAM_4[setup.quality]
        * dimensions.width * dimensions.height / 1_000_000,
      )
    : setup.model === "GPT_IMAGE_2"
      ? DESIGN_PROVIDER_COST_MICROS.GPT_IMAGE_2[setup.reference ? "EDIT" : "TEXT"]
          [setup.quality === "HIGH" ? "HIGH" : "STANDARD"][setup.aspectRatio]
      : DESIGN_PROVIDER_COST_MICROS.RECRAFT_4[setup.outputMode];
  return {
    providerModel: resolveDesignEndpoint(setup as DesignGenerationSetup),
    unitCostMicros,
    totalCostMicros: unitCostMicros * setup.count,
    version: DESIGN_PROVIDER_COST_VERSION,
    source: setup.model === "IDEOGRAM_4"
      ? "fal Ideogram V4 published per-megapixel pricing reviewed 2026-08-31"
      : setup.model === "GPT_IMAGE_2"
        ? "fal GPT Image 2 published canonical-size pricing reviewed 2026-09-08; 4:5 uses the conservative published 1:1 ceiling"
        : "fal Recraft V4 published per-image pricing reviewed 2026-08-31",
  };
}
