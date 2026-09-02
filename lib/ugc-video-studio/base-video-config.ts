import type {
  UgcBaseVideoVariant,
  UgcVideoGenerationSetup,
} from "@/lib/ugc-video-studio/contracts";
import {
  HAILUO_23_FAST_BASE_MODEL_ID,
  HAILUO_23_STANDARD_BASE_MODEL_ID,
  isUgcBaseVideoModelId,
  KLING_25_TURBO_PRO_BASE_MODEL_ID,
  PIXVERSE_C1_BASE_MODEL_ID,
  SEEDANCE_2_FAST_BASE_MODEL_ID,
  WAN_22_A14B_BASE_MODEL_ID,
  type UgcBaseVideoModelId,
} from "@/lib/ugc-video-studio/base-video-models";
export const BASE_VIDEO_PRICING_VERSION =
  "xeriamo-base-video-owner-provider-cost-v1" as const;

export const HAILUO_23_STANDARD_T2V_ENDPOINT =
  "fal-ai/minimax/hailuo-2.3/standard/text-to-video" as const;
export const HAILUO_23_FAST_I2V_ENDPOINT =
  "fal-ai/minimax/hailuo-2.3-fast/standard/image-to-video" as const;
export const PIXVERSE_C1_T2V_ENDPOINT =
  "fal-ai/pixverse/c1/text-to-video" as const;
export const PIXVERSE_C1_I2V_ENDPOINT =
  "fal-ai/pixverse/c1/image-to-video" as const;
export const KLING_25_TURBO_PRO_T2V_ENDPOINT =
  "fal-ai/kling-video/v2.5-turbo/pro/text-to-video" as const;
export const KLING_25_TURBO_PRO_I2V_ENDPOINT =
  "fal-ai/kling-video/v2.5-turbo/pro/image-to-video" as const;
export const WAN_22_A14B_T2V_ENDPOINT =
  "fal-ai/wan/v2.2-a14b/text-to-video" as const;
export const WAN_22_A14B_I2V_ENDPOINT =
  "fal-ai/wan/v2.2-a14b/image-to-video" as const;
export const SEEDANCE_2_FAST_T2V_ENDPOINT =
  "bytedance/seedance-2.0/fast/text-to-video" as const;
export const SEEDANCE_2_FAST_I2V_ENDPOINT =
  "bytedance/seedance-2.0/fast/image-to-video" as const;

export type FalBaseVideoEndpoint =
  | typeof HAILUO_23_STANDARD_T2V_ENDPOINT
  | typeof HAILUO_23_FAST_I2V_ENDPOINT
  | typeof PIXVERSE_C1_T2V_ENDPOINT
  | typeof PIXVERSE_C1_I2V_ENDPOINT
  | typeof KLING_25_TURBO_PRO_T2V_ENDPOINT
  | typeof KLING_25_TURBO_PRO_I2V_ENDPOINT
  | typeof WAN_22_A14B_T2V_ENDPOINT
  | typeof WAN_22_A14B_I2V_ENDPOINT
  | typeof SEEDANCE_2_FAST_T2V_ENDPOINT
  | typeof SEEDANCE_2_FAST_I2V_ENDPOINT;

type BaseVideoVariantDefinition = {
  endpoint: FalBaseVideoEndpoint;
  durations: readonly UgcVideoGenerationSetup["duration"][];
  aspectRatios: readonly UgcVideoGenerationSetup["aspectRatio"][];
  resolutions: readonly UgcVideoGenerationSetup["baseVideo"]["resolution"][];
  audioSupported: boolean;
};

export type BaseVideoServerModelDefinition = {
  modelId: UgcBaseVideoModelId;
  pricingVersion: typeof BASE_VIDEO_PRICING_VERSION;
  maxPromptUtf8Bytes: number | null;
  variants: Partial<Record<UgcBaseVideoVariant, BaseVideoVariantDefinition>>;
  estimateUsd: (input: {
    duration: UgcVideoGenerationSetup["duration"];
    resolution: UgcVideoGenerationSetup["baseVideo"]["resolution"];
    generateAudio: boolean;
  }) => number;
};

const ratios = ["16:9", "9:16", "1:1"] as const;
const seedanceRatios = [
  "AUTO",
  "21:9",
  "16:9",
  "4:3",
  "1:1",
  "3:4",
  "9:16",
] as const;

function perSecond(rate: number) {
  return (input: { duration: UgcVideoGenerationSetup["duration"] }) =>
    Number((rate * Number(input.duration)).toFixed(5));
}

export const BASE_VIDEO_SERVER_MODEL_REGISTRY: Readonly<
  Record<UgcBaseVideoModelId, BaseVideoServerModelDefinition>
> = Object.freeze({
  [HAILUO_23_STANDARD_BASE_MODEL_ID]: {
    modelId: HAILUO_23_STANDARD_BASE_MODEL_ID,
    pricingVersion: BASE_VIDEO_PRICING_VERSION,
    maxPromptUtf8Bytes: null,
    variants: {
      TEXT_TO_VIDEO: {
        endpoint: HAILUO_23_STANDARD_T2V_ENDPOINT,
        durations: ["6", "10"],
        aspectRatios: ["AUTO"],
        resolutions: ["768p"],
        audioSupported: false,
      },
    },
    estimateUsd: ({ duration }) => (duration === "6" ? 0.28 : 0.56),
  },
  [HAILUO_23_FAST_BASE_MODEL_ID]: {
    modelId: HAILUO_23_FAST_BASE_MODEL_ID,
    pricingVersion: BASE_VIDEO_PRICING_VERSION,
    maxPromptUtf8Bytes: null,
    variants: {
      IMAGE_TO_VIDEO: {
        endpoint: HAILUO_23_FAST_I2V_ENDPOINT,
        durations: ["6", "10"],
        aspectRatios: ["AUTO"],
        resolutions: ["768p"],
        audioSupported: false,
      },
    },
    estimateUsd: ({ duration }) => (duration === "6" ? 0.19 : 0.32),
  },
  [PIXVERSE_C1_BASE_MODEL_ID]: {
    modelId: PIXVERSE_C1_BASE_MODEL_ID,
    pricingVersion: BASE_VIDEO_PRICING_VERSION,
    maxPromptUtf8Bytes: 2048,
    variants: {
      TEXT_TO_VIDEO: {
        endpoint: PIXVERSE_C1_T2V_ENDPOINT,
        durations: ["5", "10", "15"],
        aspectRatios: [
          "16:9",
          "4:3",
          "1:1",
          "3:4",
          "9:16",
          "21:9",
        ],
        resolutions: ["720p"],
        audioSupported: true,
      },
      IMAGE_TO_VIDEO: {
        endpoint: PIXVERSE_C1_I2V_ENDPOINT,
        durations: ["5", "10", "15"],
        aspectRatios: ["AUTO"],
        resolutions: ["720p"],
        audioSupported: true,
      },
    },
    estimateUsd: ({ duration, generateAudio }) =>
      Number(((generateAudio ? 0.065 : 0.05) * Number(duration)).toFixed(5)),
  },
  [KLING_25_TURBO_PRO_BASE_MODEL_ID]: {
    modelId: KLING_25_TURBO_PRO_BASE_MODEL_ID,
    pricingVersion: BASE_VIDEO_PRICING_VERSION,
    maxPromptUtf8Bytes: null,
    variants: {
      TEXT_TO_VIDEO: {
        endpoint: KLING_25_TURBO_PRO_T2V_ENDPOINT,
        durations: ["5", "10"],
        aspectRatios: ratios,
        resolutions: ["AUTO"],
        audioSupported: false,
      },
      IMAGE_TO_VIDEO: {
        endpoint: KLING_25_TURBO_PRO_I2V_ENDPOINT,
        durations: ["5", "10"],
        aspectRatios: ["AUTO"],
        resolutions: ["AUTO"],
        audioSupported: false,
      },
    },
    estimateUsd: perSecond(0.07),
  },
  [WAN_22_A14B_BASE_MODEL_ID]: {
    modelId: WAN_22_A14B_BASE_MODEL_ID,
    pricingVersion: BASE_VIDEO_PRICING_VERSION,
    maxPromptUtf8Bytes: null,
    variants: {
      TEXT_TO_VIDEO: {
        endpoint: WAN_22_A14B_T2V_ENDPOINT,
        durations: ["5", "10"],
        aspectRatios: ratios,
        resolutions: ["480p", "580p", "720p"],
        audioSupported: false,
      },
      IMAGE_TO_VIDEO: {
        endpoint: WAN_22_A14B_I2V_ENDPOINT,
        durations: ["5", "10"],
        aspectRatios: ["AUTO", ...ratios],
        resolutions: ["480p", "580p", "720p"],
        audioSupported: false,
      },
    },
    estimateUsd: ({ duration, resolution }) => {
      const rate = resolution === "480p" ? 0.04 : resolution === "580p" ? 0.06 : 0.08;
      return Number((rate * Number(duration)).toFixed(5));
    },
  },
  [SEEDANCE_2_FAST_BASE_MODEL_ID]: {
    modelId: SEEDANCE_2_FAST_BASE_MODEL_ID,
    pricingVersion: BASE_VIDEO_PRICING_VERSION,
    maxPromptUtf8Bytes: null,
    variants: {
      TEXT_TO_VIDEO: {
        endpoint: SEEDANCE_2_FAST_T2V_ENDPOINT,
        durations: ["5", "10", "15"],
        aspectRatios: seedanceRatios,
        resolutions: ["480p", "720p"],
        audioSupported: true,
      },
      IMAGE_TO_VIDEO: {
        endpoint: SEEDANCE_2_FAST_I2V_ENDPOINT,
        durations: ["5", "10", "15"],
        aspectRatios: seedanceRatios,
        resolutions: ["480p", "720p"],
        audioSupported: true,
      },
    },
    estimateUsd: perSecond(0.2419),
  },
});

export class UgcBaseVideoInputError extends Error {
  constructor(
    readonly code:
      | "BASE_VIDEO_MODEL_UNAVAILABLE"
      | "BASE_VIDEO_PROMPT_REQUIRED"
      | "BASE_VIDEO_PROMPT_TOO_LONG"
      | "BASE_VIDEO_START_IMAGE_REQUIRED"
      | "BASE_VIDEO_START_IMAGE_UNSUPPORTED"
      | "BASE_VIDEO_DURATION_UNSUPPORTED"
      | "BASE_VIDEO_ASPECT_UNSUPPORTED"
      | "BASE_VIDEO_RESOLUTION_UNSUPPORTED"
      | "BASE_VIDEO_AUDIO_UNSUPPORTED",
    message: string,
  ) {
    super(message);
    this.name = "UgcBaseVideoInputError";
  }
}

export function baseVideoServerModel(modelId: string) {
  return isUgcBaseVideoModelId(modelId)
    ? BASE_VIDEO_SERVER_MODEL_REGISTRY[modelId]
    : null;
}

export function resolveBaseVideoVariant(input: {
  modelId: string;
  hasStartImage: boolean;
}): UgcBaseVideoVariant {
  const model = baseVideoServerModel(input.modelId);
  if (!model) {
    throw new UgcBaseVideoInputError(
      "BASE_VIDEO_MODEL_UNAVAILABLE",
      "Dieses Basisvideo-Modell ist nicht verfügbar.",
    );
  }
  if (input.hasStartImage && model.variants.IMAGE_TO_VIDEO) {
    return "IMAGE_TO_VIDEO";
  }
  if (!input.hasStartImage && model.variants.TEXT_TO_VIDEO) {
    return "TEXT_TO_VIDEO";
  }
  if (!input.hasStartImage) {
    throw new UgcBaseVideoInputError(
      "BASE_VIDEO_START_IMAGE_REQUIRED",
      "Für dieses Modell ist ein Startbild erforderlich.",
    );
  }
  throw new UgcBaseVideoInputError(
    "BASE_VIDEO_START_IMAGE_UNSUPPORTED",
    "Dieses Modell unterstützt kein Startbild.",
  );
}

export function assertUgcBaseVideoSetup(
  setup: UgcVideoGenerationSetup,
): BaseVideoVariantDefinition & {
  model: BaseVideoServerModelDefinition;
  variant: UgcBaseVideoVariant;
  startImageReferenceId: string | null;
} {
  const model = baseVideoServerModel(setup.modelId);
  if (!model || setup.mode !== "BASE_VIDEO") {
    throw new UgcBaseVideoInputError(
      "BASE_VIDEO_MODEL_UNAVAILABLE",
      "Dieses Basisvideo-Modell ist nicht verfügbar.",
    );
  }
  if (!setup.prompt.trim()) {
    throw new UgcBaseVideoInputError(
      "BASE_VIDEO_PROMPT_REQUIRED",
      "Füge zuerst einen Prompt hinzu.",
    );
  }
  if (
    model.maxPromptUtf8Bytes !== null &&
    Buffer.byteLength(setup.prompt, "utf8") > model.maxPromptUtf8Bytes
  ) {
    throw new UgcBaseVideoInputError(
      "BASE_VIDEO_PROMPT_TOO_LONG",
      "Der Prompt ist für dieses Modell zu lang.",
    );
  }
  const startImageReferenceId = setup.baseVideo.startImageReferenceId;
  const referenced = startImageReferenceId
    ? setup.references.find((reference) => reference.id === startImageReferenceId)
    : null;
  if (startImageReferenceId && !referenced) {
    throw new UgcBaseVideoInputError(
      "BASE_VIDEO_START_IMAGE_UNSUPPORTED",
      "Das Startbild konnte nicht eindeutig zugeordnet werden.",
    );
  }
  if (startImageReferenceId && referenced?.mediaType !== "IMAGE") {
    throw new UgcBaseVideoInputError(
      "BASE_VIDEO_START_IMAGE_UNSUPPORTED",
      "Das Startbild konnte nicht eindeutig zugeordnet werden.",
    );
  }
  if (
    setup.references.some(
      (reference) =>
        reference.mediaType !== "IMAGE" || reference.id !== startImageReferenceId,
    ) ||
    setup.references.length > 1
  ) {
    throw new UgcBaseVideoInputError(
      "BASE_VIDEO_START_IMAGE_UNSUPPORTED",
      "Für ein Basisvideo ist höchstens ein Startbild erlaubt.",
    );
  }
  const variant = resolveBaseVideoVariant({
    modelId: setup.modelId,
    hasStartImage: Boolean(referenced),
  });
  if (variant !== setup.baseVideo.variant) {
    throw new UgcBaseVideoInputError(
      "BASE_VIDEO_START_IMAGE_UNSUPPORTED",
      "Die Basisvideo-Variante stimmt nicht mit dem Startbild überein.",
    );
  }
  const variantDefinition = model.variants[variant]!;
  if (!variantDefinition.durations.includes(setup.duration)) {
    throw new UgcBaseVideoInputError(
      "BASE_VIDEO_DURATION_UNSUPPORTED",
      "Die ausgewählte Dauer wird von diesem Modell nicht unterstützt.",
    );
  }
  if (!variantDefinition.aspectRatios.includes(setup.aspectRatio)) {
    throw new UgcBaseVideoInputError(
      "BASE_VIDEO_ASPECT_UNSUPPORTED",
      "Das ausgewählte Format wird von diesem Modell nicht unterstützt.",
    );
  }
  if (!variantDefinition.resolutions.includes(setup.baseVideo.resolution)) {
    throw new UgcBaseVideoInputError(
      "BASE_VIDEO_RESOLUTION_UNSUPPORTED",
      "Die ausgewählte Auflösung wird von diesem Modell nicht unterstützt.",
    );
  }
  if (setup.baseVideo.generateAudio && !variantDefinition.audioSupported) {
    throw new UgcBaseVideoInputError(
      "BASE_VIDEO_AUDIO_UNSUPPORTED",
      "Dieses Modell unterstützt keine Audioerzeugung.",
    );
  }
  return {
    ...variantDefinition,
    model,
    variant,
    startImageReferenceId,
  };
}

export function estimateUgcBaseVideoCostUsd(
  setup: UgcVideoGenerationSetup,
): number {
  const resolved = assertUgcBaseVideoSetup(setup);
  return resolved.model.estimateUsd({
    duration: setup.duration,
    resolution: setup.baseVideo.resolution,
    generateAudio: setup.baseVideo.generateAudio,
  });
}

export function baseVideoEndpointForSetup(
  setup: UgcVideoGenerationSetup,
): FalBaseVideoEndpoint {
  return assertUgcBaseVideoSetup(setup).endpoint;
}

export function wanBaseVideoFramePreset(duration: string): {
  numFrames: 81 | 161;
  framesPerSecond: 16;
} {
  if (duration === "5") return { numFrames: 81, framesPerSecond: 16 };
  if (duration === "10") return { numFrames: 161, framesPerSecond: 16 };
  throw new UgcBaseVideoInputError(
    "BASE_VIDEO_DURATION_UNSUPPORTED",
    "Wan 2.2 unterstützt in Xeriamo nur 5 oder 10 Sekunden.",
  );
}
