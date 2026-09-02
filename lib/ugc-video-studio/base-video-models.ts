import type {
  UgcBaseVideoResolution,
  UgcBaseVideoVariant,
  UgcVideoGenerationSetup,
} from "@/lib/ugc-video-studio/contracts";

export const HAILUO_23_STANDARD_BASE_MODEL_ID =
  "hailuo-2-3-standard-base" as const;
export const HAILUO_23_FAST_BASE_MODEL_ID = "hailuo-2-3-fast-base" as const;
export const PIXVERSE_C1_BASE_MODEL_ID = "pixverse-c1-base" as const;
export const KLING_25_TURBO_PRO_BASE_MODEL_ID =
  "kling-2-5-turbo-pro-base" as const;
export const WAN_22_A14B_BASE_MODEL_ID = "wan-2-2-a14b-base" as const;
export const SEEDANCE_2_FAST_BASE_MODEL_ID =
  "seedance-2-fast-base" as const;

export const BASE_VIDEO_MODEL_IDS = [
  HAILUO_23_STANDARD_BASE_MODEL_ID,
  HAILUO_23_FAST_BASE_MODEL_ID,
  PIXVERSE_C1_BASE_MODEL_ID,
  KLING_25_TURBO_PRO_BASE_MODEL_ID,
  WAN_22_A14B_BASE_MODEL_ID,
  SEEDANCE_2_FAST_BASE_MODEL_ID,
] as const;
export type UgcBaseVideoModelId = (typeof BASE_VIDEO_MODEL_IDS)[number];

export const DEFAULT_BASE_VIDEO_MODEL_ID = PIXVERSE_C1_BASE_MODEL_ID;

export type UgcBaseVideoClientModelDefinition = {
  id: UgcBaseVideoModelId;
  name: string;
  description: string;
  badge: string | null;
  supportsTextToVideo: boolean;
  supportsImageToVideo: boolean;
  supportedDurations: readonly UgcVideoGenerationSetup["duration"][];
  variants: Partial<Record<UgcBaseVideoVariant, {
    aspectRatios: readonly UgcVideoGenerationSetup["aspectRatio"][];
    resolutions: readonly UgcBaseVideoResolution[];
    audioSupported: boolean;
  }>>;
};

export const BASE_VIDEO_CLIENT_MODELS: readonly UgcBaseVideoClientModelDefinition[] =
  Object.freeze([
    {
      id: HAILUO_23_STANDARD_BASE_MODEL_ID,
      name: "Hailuo 2.3 Standard",
      description: "Günstige Text-zu-Video-Entwürfe · 6 oder 10 Sek.",
      badge: null,
      supportsTextToVideo: true,
      supportsImageToVideo: false,
      supportedDurations: ["6", "10"],
      variants: { TEXT_TO_VIDEO: { aspectRatios: ["AUTO"], resolutions: ["768p"], audioSupported: false } },
    },
    {
      id: HAILUO_23_FAST_BASE_MODEL_ID,
      name: "Hailuo 2.3 Fast",
      description:
        "Günstigste Bild-zu-Video-Varianten · Startbild erforderlich",
      badge: null,
      supportsTextToVideo: false,
      supportsImageToVideo: true,
      supportedDurations: ["6", "10"],
      variants: { IMAGE_TO_VIDEO: { aspectRatios: ["AUTO"], resolutions: ["768p"], audioSupported: false } },
    },
    {
      id: PIXVERSE_C1_BASE_MODEL_ID,
      name: "PixVerse C1",
      description: "Günstige flexible Basisvideos · 5–15 Sek.",
      badge: "Günstigster direkter 5-Sek.-T2V-Test",
      supportsTextToVideo: true,
      supportsImageToVideo: true,
      supportedDurations: ["5", "10", "15"],
      variants: {
        TEXT_TO_VIDEO: { aspectRatios: ["16:9", "4:3", "1:1", "3:4", "9:16", "21:9"], resolutions: ["720p"], audioSupported: true },
        IMAGE_TO_VIDEO: { aspectRatios: ["AUTO"], resolutions: ["720p"], audioSupported: true },
      },
    },
    {
      id: KLING_25_TURBO_PRO_BASE_MODEL_ID,
      name: "Kling 2.5 Turbo Pro",
      description: "Starker Qualitäts-/Preis-Mittelweg · 5 oder 10 Sek.",
      badge: null,
      supportsTextToVideo: true,
      supportsImageToVideo: true,
      supportedDurations: ["5", "10"],
      variants: {
        TEXT_TO_VIDEO: { aspectRatios: ["16:9", "9:16", "1:1"], resolutions: ["AUTO"], audioSupported: false },
        IMAGE_TO_VIDEO: { aspectRatios: ["AUTO"], resolutions: ["AUTO"], audioSupported: false },
      },
    },
    {
      id: WAN_22_A14B_BASE_MODEL_ID,
      name: "Wan 2.2",
      description: "Kontrollierbare 720p-Basisvideos · 5 oder 10 Sek.",
      badge: null,
      supportsTextToVideo: true,
      supportsImageToVideo: true,
      supportedDurations: ["5", "10"],
      variants: {
        TEXT_TO_VIDEO: { aspectRatios: ["16:9", "9:16", "1:1"], resolutions: ["480p", "580p", "720p"], audioSupported: false },
        IMAGE_TO_VIDEO: { aspectRatios: ["AUTO", "16:9", "9:16", "1:1"], resolutions: ["480p", "580p", "720p"], audioSupported: false },
      },
    },
    {
      id: SEEDANCE_2_FAST_BASE_MODEL_ID,
      name: "Seedance 2 Fast",
      description: "Premium-Basisvideo · höhere Kosten",
      badge: "Premium",
      supportsTextToVideo: true,
      supportsImageToVideo: true,
      supportedDurations: ["5", "10", "15"],
      variants: {
        TEXT_TO_VIDEO: { aspectRatios: ["AUTO", "21:9", "16:9", "4:3", "1:1", "3:4", "9:16"], resolutions: ["480p", "720p"], audioSupported: true },
        IMAGE_TO_VIDEO: { aspectRatios: ["AUTO", "21:9", "16:9", "4:3", "1:1", "3:4", "9:16"], resolutions: ["480p", "720p"], audioSupported: true },
      },
    },
  ]);

export function isUgcBaseVideoModelId(
  modelId: string,
): modelId is UgcBaseVideoModelId {
  return (BASE_VIDEO_MODEL_IDS as readonly string[]).includes(modelId);
}

export function baseVideoClientModel(modelId: string) {
  return BASE_VIDEO_CLIENT_MODELS.find((model) => model.id === modelId) ?? null;
}

export function baseVideoOwnerEstimateKey(input: {
  modelId: string;
  variant: UgcBaseVideoVariant;
  duration: string;
  resolution: UgcBaseVideoResolution;
  generateAudio: boolean;
}): string {
  return [
    input.modelId,
    input.variant,
    input.duration,
    input.resolution,
    input.generateAudio ? "audio" : "silent",
  ].join("|");
}
