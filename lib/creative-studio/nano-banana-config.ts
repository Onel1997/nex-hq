import type { CreativeGenerationSetup } from "@/lib/creative-studio/contracts";

export const NANO_BANANA_PRO_TEXT_MODEL_ID =
  "fal-ai/nano-banana-pro" as const;
export const NANO_BANANA_PRO_EDIT_MODEL_ID =
  "fal-ai/nano-banana-pro/edit" as const;
export const NANO_BANANA_PRO_PRICING_VERSION =
  "fal-public-pricing-2026-08-27" as const;
export const NANO_BANANA_PRO_COST_CAP_ENV =
  "NEXHQ_CREATIVE_NANO_BANANA_COST_MAX_USD" as const;

/** Current published fal price per successfully generated image. */
export function nanoBananaUnitPriceUsd(
  quality: CreativeGenerationSetup["quality"],
): number {
  return quality === "4K" ? 0.3 : 0.15;
}

export function estimateNanoBananaMaximumCostUsd(
  quality: CreativeGenerationSetup["quality"],
  batchSize: CreativeGenerationSetup["batchSize"],
): number {
  return Number((nanoBananaUnitPriceUsd(quality) * batchSize).toFixed(2));
}

export function parseCreativeCostCap(
  value: string | undefined,
): number | null {
  if (!value?.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export type CreativeProviderPublicConfig = {
  modelId: "nano-banana-pro";
  provider: "fal";
  providerModel: typeof NANO_BANANA_PRO_EDIT_MODEL_ID;
  credentialConfigured: boolean;
  costCapConfigured: boolean;
  storageConfigured: boolean;
  /** Exact OWNER readiness: provider + durable storage, independent of the legacy cap. */
  ownerReady: boolean;
  ready: boolean;
  costCapUsd: number | null;
  pricingVersion: typeof NANO_BANANA_PRO_PRICING_VERSION;
  estimatedCostsUsd: Record<
    CreativeGenerationSetup["quality"],
    Record<CreativeGenerationSetup["batchSize"], number>
  >;
};

function creativeCostEstimatesUsd(): CreativeProviderPublicConfig["estimatedCostsUsd"] {
  const qualities = ["1K", "2K", "4K"] as const;
  const batchSizes = [1, 2, 3, 4] as const;
  return Object.fromEntries(
    qualities.map((quality) => [
      quality,
      Object.fromEntries(
        batchSizes.map((batchSize) => [
          batchSize,
          estimateNanoBananaMaximumCostUsd(quality, batchSize),
        ]),
      ),
    ]),
  ) as CreativeProviderPublicConfig["estimatedCostsUsd"];
}

export function getCreativeProviderPublicConfig(
  environment: NodeJS.ProcessEnv = process.env,
): CreativeProviderPublicConfig {
  const costCapUsd = parseCreativeCostCap(
    environment[NANO_BANANA_PRO_COST_CAP_ENV],
  );
  const credentialConfigured = Boolean(environment.FAL_KEY?.trim());
  const storageConfigured = Boolean(
    environment.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      environment.SUPABASE_SERVICE_ROLE_KEY?.trim(),
  );
  return {
    modelId: "nano-banana-pro",
    provider: "fal",
    providerModel: NANO_BANANA_PRO_EDIT_MODEL_ID,
    credentialConfigured,
    costCapConfigured: costCapUsd !== null,
    storageConfigured,
    ownerReady: credentialConfigured && storageConfigured,
    ready: credentialConfigured && costCapUsd !== null && storageConfigured,
    costCapUsd,
    pricingVersion: NANO_BANANA_PRO_PRICING_VERSION,
    estimatedCostsUsd: creativeCostEstimatesUsd(),
  };
}

export class CreativeCostCapError extends Error {
  readonly code = "CREATIVE_COST_CAP_NOT_CONFIGURED" as const;

  constructor(
    readonly estimatedMaximumCostUsd: number,
    readonly configuredCostCapUsd: number | null,
  ) {
    super(
      configuredCostCapUsd === null
        ? "Das Kostenlimit für dieses Modell ist noch nicht eingerichtet."
        : "Das gewählte Setup überschreitet das eingerichtete Kostenlimit.",
    );
    this.name = "CreativeCostCapError";
  }
}

export function assertNanoBananaCostAllowed(input: {
  quality: CreativeGenerationSetup["quality"];
  batchSize: CreativeGenerationSetup["batchSize"];
  configuredCostCapUsd: number | null;
}): number {
  const estimatedMaximumCostUsd = estimateNanoBananaMaximumCostUsd(
    input.quality,
    input.batchSize,
  );
  if (
    input.configuredCostCapUsd === null ||
    estimatedMaximumCostUsd > input.configuredCostCapUsd
  ) {
    throw new CreativeCostCapError(
      estimatedMaximumCostUsd,
      input.configuredCostCapUsd,
    );
  }
  return estimatedMaximumCostUsd;
}
