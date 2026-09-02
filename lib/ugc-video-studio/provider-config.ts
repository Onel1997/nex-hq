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
import {
  KLING_O1_STANDARD_EDIT_MODEL_ID,
  KLING_O3_PRO_EDIT_MODEL_ID,
  RECOMMENDED_VIDEO_EDIT_MODEL_ID,
  SEEDANCE_2_FAST_EDIT_MODEL_ID,
  VIDEO_EDIT_MODEL_IDS,
  ugcVideoModelById,
  type UgcVideoEditModelId,
} from "@/lib/ugc-video-studio/model-registry";
import { BASE_VIDEO_SERVER_MODEL_REGISTRY } from "@/lib/ugc-video-studio/base-video-config";
import {
  BASE_VIDEO_CLIENT_MODELS,
  baseVideoOwnerEstimateKey,
} from "@/lib/ugc-video-studio/base-video-models";

export type UgcVideoPublicModelId =
  | "seedance-2.5"
  | "kling-v3-pro-motion-control"
  | UgcVideoEditModelId;

export type UgcVideoPublicModelConfig = {
  modelId: UgcVideoPublicModelId;
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
    | "NEXHQ_UGC_KLING_MOTION_COST_MAX_USD"
    | null;
  pricingVersion: string;
};

export type UgcVideoProviderPublicConfig = {
  models: Record<
    UgcVideoPublicModelId,
    UgcVideoPublicModelConfig
  >;
  recommendedVideoEditModelId: UgcVideoEditModelId;
  resultStorageLimitBytes: number;
  ownerPricing: {
    seedanceEstimatesUsd: Record<string, number>;
    klingPerSecondUsd: number;
    videoEditEstimatesUsd: Record<string, number>;
    baseVideoEstimatesUsd: Record<string, number>;
  };
  baseVideoOwnerPilot: {
    enabled: boolean;
    credentialConfigured: boolean;
    storageConfigured: boolean;
    ready: boolean;
    modelIds: string[];
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
  options: { includeBaseVideoOwnerPilot?: boolean } = {},
): UgcVideoProviderPublicConfig {
  const seedance = getSeedancePublicConfig(environment);
  const klingCostCapUsd = getKlingMotionCostCap(environment);
  const credentialConfigured = Boolean(environment.FAL_KEY?.trim());
  const storageConfigured = Boolean(
    environment.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      environment.SUPABASE_SERVICE_ROLE_KEY?.trim(),
  );
  const seedanceEstimatesUsd: Record<string, number> = {};
  const videoEditEstimatesUsd: Record<string, number> = {};
  const baseVideoEstimatesUsd: Record<string, number> = {};
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
  for (const modelId of VIDEO_EDIT_MODEL_IDS) {
    const model = ugcVideoModelById(modelId)!;
    for (const duration of model.supportedDurations) {
      videoEditEstimatesUsd[`${modelId}|${duration}`] = Number(
        ((model.providerCostUsdMicrosPerSecond! * Number(duration)) / 1_000_000).toFixed(5),
      );
    }
  }
  for (const clientModel of options.includeBaseVideoOwnerPilot
    ? BASE_VIDEO_CLIENT_MODELS
    : []) {
    const serverModel = BASE_VIDEO_SERVER_MODEL_REGISTRY[clientModel.id];
    for (const [variant, variantDefinition] of Object.entries(serverModel.variants)) {
      if (!variantDefinition) continue;
      for (const duration of variantDefinition.durations) {
        for (const resolution of variantDefinition.resolutions) {
          for (const generateAudio of variantDefinition.audioSupported
            ? [false, true]
            : [false]) {
            baseVideoEstimatesUsd[
              baseVideoOwnerEstimateKey({
                modelId: clientModel.id,
                variant: variant as "TEXT_TO_VIDEO" | "IMAGE_TO_VIDEO",
                duration,
                resolution,
                generateAudio,
              })
            ] = serverModel.estimateUsd({
              duration,
              resolution,
              generateAudio,
            });
          }
        }
      }
    }
  }
  const videoEditModel = (modelId: UgcVideoEditModelId): UgcVideoPublicModelConfig => {
    const model = ugcVideoModelById(modelId)!;
    return {
      modelId,
      provider: "fal",
      providerModel: model.providerModelId!,
      credentialConfigured,
      costCapConfigured: true,
      storageConfigured,
      ready: credentialConfigured && storageConfigured,
      ownerReady: credentialConfigured && storageConfigured,
      costCapUsd: null,
      costCapEnvironmentName: null,
      pricingVersion: model.pricingVersion!,
    };
  };
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
      [KLING_O3_PRO_EDIT_MODEL_ID]: videoEditModel(KLING_O3_PRO_EDIT_MODEL_ID),
      [KLING_O1_STANDARD_EDIT_MODEL_ID]: videoEditModel(KLING_O1_STANDARD_EDIT_MODEL_ID),
      [SEEDANCE_2_FAST_EDIT_MODEL_ID]: videoEditModel(SEEDANCE_2_FAST_EDIT_MODEL_ID),
    },
    recommendedVideoEditModelId: RECOMMENDED_VIDEO_EDIT_MODEL_ID,
    resultStorageLimitBytes: UGC_VIDEO_RESULT_MAX_BYTES,
    ownerPricing: {
      seedanceEstimatesUsd,
      klingPerSecondUsd: KLING_V3_PRO_MOTION_PRICE_PER_SECOND_USD,
      videoEditEstimatesUsd,
      baseVideoEstimatesUsd,
    },
    baseVideoOwnerPilot: {
      enabled: Boolean(options.includeBaseVideoOwnerPilot),
      credentialConfigured,
      storageConfigured,
      ready: credentialConfigured && storageConfigured,
      modelIds: options.includeBaseVideoOwnerPilot
        ? BASE_VIDEO_CLIENT_MODELS.map((model) => model.id)
        : [],
    },
  };
}

export function ugcVideoPublicModelConfig(
  config: UgcVideoProviderPublicConfig,
  modelId: string,
): UgcVideoPublicModelConfig | null {
  return Object.hasOwn(config.models, modelId)
    ? config.models[modelId as UgcVideoPublicModelId]
    : null;
}
