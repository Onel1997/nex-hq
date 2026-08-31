import {
  KLING_V3_PRO_MOTION_PRICE_PER_SECOND_USD,
  getKlingMotionCostCap,
  KLING_V3_PRO_MOTION_CONTROL_MODEL_ID,
  KLING_V3_PRO_MOTION_PRICING_VERSION,
} from "@/lib/ugc-video-studio/kling-motion-config";
import {
  estimateSeedanceMaximumCostUsd,
  getUgcVideoProviderPublicConfig as getSeedancePublicConfig,
  SEEDANCE_25_PRICING_VERSION,
  SEEDANCE_25_REFERENCE_MODEL_ID,
} from "@/lib/ugc-video-studio/seedance-config";
import {
  UGC_VIDEO_ASPECT_RATIOS,
  UGC_VIDEO_DURATIONS,
  UGC_VIDEO_QUALITIES,
} from "@/lib/ugc-video-studio/contracts";
import { UGC_VIDEO_RESULT_MAX_BYTES } from "@/lib/ugc-video-studio/storage-policy";

export type UgcVideoPublicModelConfig = {
  modelId: "seedance-2.5" | "kling-v3-pro-motion-control";
  provider: "fal";
  providerModel: string;
  credentialConfigured: boolean;
  costCapConfigured: boolean;
  storageConfigured: boolean;
  ready: boolean;
  ownerReady: boolean;
  costCapUsd: number | null;
  costCapEnvironmentName:
    | "NEXHQ_UGC_SEEDANCE_COST_MAX_USD"
    | "NEXHQ_UGC_KLING_MOTION_COST_MAX_USD";
  pricingVersion: string;
};

export type UgcVideoProviderPublicConfig = {
  models: Record<
    "seedance-2.5" | "kling-v3-pro-motion-control",
    UgcVideoPublicModelConfig
  >;
  resultStorageLimitBytes: number;
  ownerPricing: {
    seedanceEstimatesUsd: Record<string, number>;
    klingPerSecondUsd: number;
  };
};

export function ugcOwnerEstimateKey(input: {
  quality: string;
  aspectRatio: string;
  duration: string;
  hasVideoReference: boolean;
}): string {
  return `${input.quality}|${input.aspectRatio}|${input.duration}|${input.hasVideoReference ? "video" : "image"}`;
}

export function getUgcVideoProviderPublicConfig(
  environment: NodeJS.ProcessEnv = process.env,
): UgcVideoProviderPublicConfig {
  const seedance = getSeedancePublicConfig(environment);
  const klingCostCapUsd = getKlingMotionCostCap(environment);
  const credentialConfigured = Boolean(environment.FAL_KEY?.trim());
  const storageConfigured = Boolean(
    environment.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      environment.SUPABASE_SERVICE_ROLE_KEY?.trim(),
  );
  const seedanceEstimatesUsd: Record<string, number> = {};
  for (const quality of UGC_VIDEO_QUALITIES) {
    for (const aspectRatio of UGC_VIDEO_ASPECT_RATIOS) {
      for (const duration of UGC_VIDEO_DURATIONS) {
        for (const hasVideoReference of [false, true]) {
          seedanceEstimatesUsd[
            ugcOwnerEstimateKey({ quality, aspectRatio, duration, hasVideoReference })
          ] = estimateSeedanceMaximumCostUsd({
            quality,
            aspectRatio,
            duration,
            hasVideoReference,
          });
        }
      }
    }
  }
  return {
    models: {
      "seedance-2.5": {
        modelId: "seedance-2.5",
        provider: "fal",
        providerModel: SEEDANCE_25_REFERENCE_MODEL_ID,
        credentialConfigured: seedance.credentialConfigured,
        costCapConfigured: seedance.costCapConfigured,
        storageConfigured: seedance.storageConfigured,
        ready: seedance.ready,
        ownerReady:
          seedance.credentialConfigured && seedance.storageConfigured,
        costCapUsd: seedance.costCapUsd,
        costCapEnvironmentName: "NEXHQ_UGC_SEEDANCE_COST_MAX_USD",
        pricingVersion: SEEDANCE_25_PRICING_VERSION,
      },
      "kling-v3-pro-motion-control": {
        modelId: "kling-v3-pro-motion-control",
        provider: "fal",
        providerModel: KLING_V3_PRO_MOTION_CONTROL_MODEL_ID,
        credentialConfigured,
        costCapConfigured: klingCostCapUsd !== null,
        storageConfigured,
        ready:
          credentialConfigured && klingCostCapUsd !== null && storageConfigured,
        ownerReady: credentialConfigured && storageConfigured,
        costCapUsd: klingCostCapUsd,
        costCapEnvironmentName: "NEXHQ_UGC_KLING_MOTION_COST_MAX_USD",
        pricingVersion: KLING_V3_PRO_MOTION_PRICING_VERSION,
      },
    },
    resultStorageLimitBytes: UGC_VIDEO_RESULT_MAX_BYTES,
    ownerPricing: {
      seedanceEstimatesUsd,
      klingPerSecondUsd: KLING_V3_PRO_MOTION_PRICE_PER_SECOND_USD,
    },
  };
}

export function ugcVideoPublicModelConfig(
  config: UgcVideoProviderPublicConfig,
  modelId: string,
): UgcVideoPublicModelConfig | null {
  return modelId === "seedance-2.5" || modelId === "kling-v3-pro-motion-control"
    ? config.models[modelId]
    : null;
}
