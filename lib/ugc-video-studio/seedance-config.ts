import type { UgcVideoGenerationSetup } from "@/lib/ugc-video-studio/contracts";
import { UGC_VIDEO_RESULT_MAX_BYTES } from "@/lib/ugc-video-studio/storage-policy";

export const SEEDANCE_25_REFERENCE_MODEL_ID =
  "bytedance/seedance-2.5/reference-to-video" as const;
export const SEEDANCE_25_PRICING_VERSION =
  "fal-public-token-pricing-2026-08-27" as const;
export const SEEDANCE_25_COST_CAP_ENV =
  "NEXHQ_UGC_SEEDANCE_COST_MAX_USD" as const;

const TOKEN_RATE_PER_THOUSAND_USD = {
  "480p": 0.0214,
  "720p": 0.0214,
  "1080p": 0.0234,
} as const;

const DIMENSIONS: Record<
  UgcVideoGenerationSetup["quality"],
  Record<UgcVideoGenerationSetup["aspectRatio"], readonly [number, number]>
> = {
  "480p": {
    AUTO: [640, 640],
    "21:9": [992, 432],
    "16:9": [864, 496],
    "4:3": [752, 560],
    "1:1": [640, 640],
    "3:4": [560, 752],
    "9:16": [496, 864],
  },
  "720p": {
    AUTO: [960, 960],
    "21:9": [1470, 630],
    "16:9": [1280, 720],
    "4:3": [1112, 834],
    "1:1": [960, 960],
    "3:4": [834, 1112],
    "9:16": [720, 1280],
  },
  "1080p": {
    AUTO: [1440, 1440],
    "21:9": [2205, 945],
    "16:9": [1920, 1080],
    "4:3": [1668, 1251],
    "1:1": [1440, 1440],
    "3:4": [1251, 1668],
    "9:16": [1080, 1920],
  },
};

export function parseUgcVideoCostCap(value: string | undefined): number | null {
  if (!value?.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/**
 * fal bills Seedance by generated frame tokens. With a video reference the
 * reference duration is billable too; because the browser duration is not a
 * secure billing authority, this maximum assumes the documented 30.2s input
 * budget whenever any video reference is present.
 */
export function estimateSeedanceMaximumCostUsd(input: {
  quality: UgcVideoGenerationSetup["quality"];
  aspectRatio: UgcVideoGenerationSetup["aspectRatio"];
  duration: UgcVideoGenerationSetup["duration"];
  hasVideoReference: boolean;
}): number {
  const [width, height] = DIMENSIONS[input.quality][input.aspectRatio];
  const outputSeconds = Number(input.duration);
  const billableSeconds =
    outputSeconds + (input.hasVideoReference ? 30.2 : 0);
  const tokens = (width * height * billableSeconds * 24) / 1024;
  const videoReferenceMultiplier = input.hasVideoReference ? 0.6 : 1;
  const cost =
    (tokens / 1000) *
    TOKEN_RATE_PER_THOUSAND_USD[input.quality] *
    videoReferenceMultiplier;
  return Number(cost.toFixed(2));
}

export class UgcVideoCostCapError extends Error {
  readonly code = "UGC_VIDEO_COST_CAP_NOT_CONFIGURED" as const;

  constructor(
    readonly estimatedMaximumCostUsd: number,
    readonly configuredCostCapUsd: number | null,
  ) {
    super(
      configuredCostCapUsd === null
        ? "Das Kostenlimit für dieses Modell ist noch nicht eingerichtet."
        : "Das gewählte Setup überschreitet das eingerichtete Kostenlimit.",
    );
    this.name = "UgcVideoCostCapError";
  }
}

export function assertSeedanceCostAllowed(input: {
  setup: UgcVideoGenerationSetup;
  configuredCostCapUsd: number | null;
}): number {
  const estimatedMaximumCostUsd = estimateSeedanceMaximumCostUsd({
    quality: input.setup.quality,
    aspectRatio: input.setup.aspectRatio,
    duration: input.setup.duration,
    hasVideoReference: input.setup.references.some(
      (reference) => reference.mediaType === "VIDEO",
    ),
  });
  if (
    input.configuredCostCapUsd === null ||
    estimatedMaximumCostUsd > input.configuredCostCapUsd
  ) {
    throw new UgcVideoCostCapError(
      estimatedMaximumCostUsd,
      input.configuredCostCapUsd,
    );
  }
  return estimatedMaximumCostUsd;
}

export type UgcVideoProviderPublicConfig = {
  modelId: "seedance-2.5";
  provider: "fal";
  providerModel: typeof SEEDANCE_25_REFERENCE_MODEL_ID;
  credentialConfigured: boolean;
  costCapConfigured: boolean;
  storageConfigured: boolean;
  ready: boolean;
  costCapUsd: number | null;
  pricingVersion: typeof SEEDANCE_25_PRICING_VERSION;
  resultStorageLimitBytes: number;
};

export function getUgcVideoProviderPublicConfig(
  environment: NodeJS.ProcessEnv = process.env,
): UgcVideoProviderPublicConfig {
  const costCapUsd = parseUgcVideoCostCap(
    environment[SEEDANCE_25_COST_CAP_ENV],
  );
  const credentialConfigured = Boolean(environment.FAL_KEY?.trim());
  const storageConfigured = Boolean(
    environment.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      environment.SUPABASE_SERVICE_ROLE_KEY?.trim(),
  );
  return {
    modelId: "seedance-2.5",
    provider: "fal",
    providerModel: SEEDANCE_25_REFERENCE_MODEL_ID,
    credentialConfigured,
    costCapConfigured: costCapUsd !== null,
    storageConfigured,
    ready: credentialConfigured && costCapUsd !== null && storageConfigured,
    costCapUsd,
    pricingVersion: SEEDANCE_25_PRICING_VERSION,
    resultStorageLimitBytes: UGC_VIDEO_RESULT_MAX_BYTES,
  };
}
