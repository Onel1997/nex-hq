import {
  KLING_MOTION_DURATION_CHOICES,
  type UgcVideoGenerationSetup,
  type UgcVideoMode,
  type UgcVideoReferenceType,
} from "@/lib/ugc-video-studio/contracts";
import { BASE_VIDEO_CLIENT_MODELS } from "@/lib/ugc-video-studio/base-video-models";

export type UgcVideoModelAvailability = "LIVE" | "READY_TO_CONNECT" | "PLANNED";

type UgcVideoEditMediaProfileBase = {
  allowedMimeTypes: readonly ["video/mp4", "video/quicktime"];
  minDurationSeconds: number;
  maxDurationSeconds: number;
  minFps: number | null;
  maxFps: number | null;
  normalizedFps: number;
  maxBytes: number;
};

export type UgcVideoEditMediaProfile = UgcVideoEditMediaProfileBase &
  (
    | {
        dimensionPolicy: "AXIS_BOUNDS";
        minWidth: number;
        minHeight: number;
        maxWidth: number;
        maxHeight: number;
      }
    | {
        /** fal documents Seedance input resolution as an approximate 480p–720p band. */
        dimensionPolicy: "PIXEL_AREA_BOUNDS";
        minPixelArea: number;
        maxPixelArea: number;
        maxLongEdge: number;
      }
  );

export type UgcVideoModelDefinition = {
  id: string;
  providerId: string;
  providerModelId: string | null;
  name: string;
  description: string;
  badge: string | null;
  availability: UgcVideoModelAvailability;
  maximumReferences: number;
  supportedReferenceTypes: readonly UgcVideoReferenceType[];
  supportedDurations: readonly UgcVideoGenerationSetup["duration"][];
  supportedAspectRatios: readonly UgcVideoGenerationSetup["aspectRatio"][];
  supportedQualities: readonly UgcVideoGenerationSetup["quality"][];
  supportedBitrates: readonly UgcVideoGenerationSetup["bitrate"][];
  settingsKind:
    | "SEEDANCE"
    | "KLING_MOTION_CONTROL"
    | "VIDEO_EDIT"
    | "BASE_VIDEO"
    | "GENERIC";
  modeCompatibility: readonly UgcVideoMode[];
  visibleInProductMode: boolean;
  providerCostUsdMicrosPerSecond: number | null;
  pricingVersion: string | null;
  characterReferenceStrategy: "NONE" | "KLING_ELEMENT" | "SEEDANCE_IMAGE";
  videoEditMediaProfile: UgcVideoEditMediaProfile | null;
};

const VIDEO_EDIT_MIME_TYPES = ["video/mp4", "video/quicktime"] as const;

export const KLING_O3_PRO_EDIT_MEDIA_PROFILE = Object.freeze({
  dimensionPolicy: "AXIS_BOUNDS" as const,
  minWidth: 720,
  minHeight: 720,
  maxWidth: 3_840,
  maxHeight: 3_840,
  minDurationSeconds: 3,
  maxDurationSeconds: 15.05,
  minFps: 24,
  maxFps: 60,
  normalizedFps: 30,
  maxBytes: 200 * 1024 * 1024,
  allowedMimeTypes: VIDEO_EDIT_MIME_TYPES,
});

export const KLING_O1_STANDARD_EDIT_MEDIA_PROFILE = Object.freeze({
  dimensionPolicy: "AXIS_BOUNDS" as const,
  minWidth: 720,
  minHeight: 720,
  maxWidth: 2_160,
  maxHeight: 2_160,
  minDurationSeconds: 3,
  maxDurationSeconds: 10.05,
  minFps: 24,
  maxFps: 60,
  normalizedFps: 30,
  maxBytes: 200 * 1024 * 1024,
  allowedMimeTypes: VIDEO_EDIT_MIME_TYPES,
});

export const SEEDANCE_2_FAST_EDIT_MEDIA_PROFILE = Object.freeze({
  // The API describes reference inputs as approximately 480p (640x640) to
  // 720p (834x1112), rather than imposing Kling's per-axis bounds.
  dimensionPolicy: "PIXEL_AREA_BOUNDS" as const,
  minPixelArea: 640 * 640,
  maxPixelArea: 834 * 1_112,
  maxLongEdge: 1_112,
  minDurationSeconds: 2,
  maxDurationSeconds: 15,
  minFps: null,
  maxFps: null,
  normalizedFps: 30,
  maxBytes: 50 * 1024 * 1024,
  allowedMimeTypes: VIDEO_EDIT_MIME_TYPES,
});

const ALL_DURATIONS = Array.from({ length: 27 }, (_, index) =>
  String(index + 4),
) as UgcVideoGenerationSetup["duration"][];

const SEEDANCE_RATIOS: readonly UgcVideoGenerationSetup["aspectRatio"][] = [
  "AUTO",
  "21:9",
  "16:9",
  "4:3",
  "1:1",
  "3:4",
  "9:16",
];

export const KLING_O3_PRO_EDIT_MODEL_ID = "kling-o3-pro-video-edit" as const;
export const KLING_O1_STANDARD_EDIT_MODEL_ID = "kling-o1-standard-video-edit" as const;
export const SEEDANCE_2_FAST_EDIT_MODEL_ID = "seedance-2-fast-video-edit" as const;
export const AUTO_RECOMMENDED_VIDEO_EDIT_MODEL_ID = "auto-recommended-video-edit" as const;

export const KLING_O3_PRO_EDIT_ENDPOINT =
  "fal-ai/kling-video/o3/pro/video-to-video/edit" as const;
export const KLING_O1_STANDARD_EDIT_ENDPOINT =
  "fal-ai/kling-video/o1/standard/video-to-video/edit" as const;
export const SEEDANCE_2_FAST_EDIT_ENDPOINT =
  "bytedance/seedance-2.0/fast/reference-to-video" as const;

export const RECOMMENDED_VIDEO_EDIT_MODEL_ID = KLING_O3_PRO_EDIT_MODEL_ID;
export const VIDEO_EDIT_PRICING_VERSION = "xeriamo-video-edit-provider-cost-v1" as const;

export const VIDEO_EDIT_MODEL_IDS = [
  KLING_O3_PRO_EDIT_MODEL_ID,
  KLING_O1_STANDARD_EDIT_MODEL_ID,
  SEEDANCE_2_FAST_EDIT_MODEL_ID,
] as const;
export type UgcVideoEditModelId = (typeof VIDEO_EDIT_MODEL_IDS)[number];

const O3_DURATIONS: readonly UgcVideoGenerationSetup["duration"][] = [
  "5", "6", "7", "8", "9", "10",
];
const O1_DURATIONS: readonly UgcVideoGenerationSetup["duration"][] = [
  "5", "6", "7", "8", "9", "10",
];
const SEEDANCE_2_FAST_DURATIONS: readonly UgcVideoGenerationSetup["duration"][] = [
  "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15",
];

export const UGC_VIDEO_MODEL_REGISTRY: readonly UgcVideoModelDefinition[] =
  Object.freeze([
    {
      id: "seedance-2.5",
      providerId: "fal",
      providerModelId: "bytedance/seedance-2.5/reference-to-video",
      name: "Seedance 2.5",
      description: "Starke UGC-Bewegung mit Bild-, Video- und Audio-Referenzen.",
      badge: "Verbunden",
      availability: "LIVE",
      maximumReferences: 50,
      supportedReferenceTypes: ["IMAGE", "VIDEO", "AUDIO"],
      supportedDurations: ALL_DURATIONS,
      supportedAspectRatios: SEEDANCE_RATIOS,
      supportedQualities: ["480p", "720p", "1080p"],
      supportedBitrates: ["STANDARD", "HIGH"],
      settingsKind: "SEEDANCE",
      modeCompatibility: [],
      visibleInProductMode: false,
      providerCostUsdMicrosPerSecond: null,
      pricingVersion: "seedance-2.5-provider-cost-v1",
      characterReferenceStrategy: "NONE",
      videoEditMediaProfile: null,
    },
    {
      id: "kling-v3-pro-motion-control",
      providerId: "fal",
      providerModelId: "fal-ai/kling-video/v3/pro/motion-control",
      name: "Kling V3 Pro Motion Control",
      description:
        "Starke Identitäts- und Bewegungsübernahme aus Bild + Referenzvideo.",
      badge: "Identität",
      availability: "LIVE",
      maximumReferences: 3,
      supportedReferenceTypes: ["IMAGE", "VIDEO"],
      supportedDurations: KLING_MOTION_DURATION_CHOICES,
      supportedAspectRatios: [],
      supportedQualities: [],
      supportedBitrates: [],
      settingsKind: "KLING_MOTION_CONTROL",
      modeCompatibility: ["MOTION_CONTROL"],
      visibleInProductMode: true,
      providerCostUsdMicrosPerSecond: 168_000,
      pricingVersion: "kling-v3-pro-motion-control-provider-cost-v1",
      characterReferenceStrategy: "NONE",
      videoEditMediaProfile: null,
    },
    {
      id: KLING_O3_PRO_EDIT_MODEL_ID,
      providerId: "fal",
      providerModelId: KLING_O3_PRO_EDIT_ENDPOINT,
      name: "Kling O3 Pro",
      description: "Premium Personen-Ersetzung mit starker Szenen- und Bewegungstreue.",
      badge: null,
      availability: "LIVE",
      maximumReferences: 2,
      supportedReferenceTypes: ["IMAGE", "VIDEO"],
      supportedDurations: O3_DURATIONS,
      supportedAspectRatios: ["AUTO"],
      supportedQualities: ["720p"],
      supportedBitrates: ["STANDARD"],
      settingsKind: "VIDEO_EDIT",
      modeCompatibility: ["VIDEO_EDIT"],
      visibleInProductMode: true,
      providerCostUsdMicrosPerSecond: 168_000,
      pricingVersion: VIDEO_EDIT_PRICING_VERSION,
      characterReferenceStrategy: "KLING_ELEMENT",
      videoEditMediaProfile: KLING_O3_PRO_EDIT_MEDIA_PROFILE,
    },
    {
      id: KLING_O1_STANDARD_EDIT_MODEL_ID,
      providerId: "fal",
      providerModelId: KLING_O1_STANDARD_EDIT_ENDPOINT,
      name: "Kling O1 Standard",
      description: "Schnelle und günstigere Personen-Ersetzung.",
      badge: null,
      availability: "LIVE",
      maximumReferences: 2,
      supportedReferenceTypes: ["IMAGE", "VIDEO"],
      supportedDurations: O1_DURATIONS,
      supportedAspectRatios: ["AUTO"],
      supportedQualities: ["720p"],
      supportedBitrates: ["STANDARD"],
      settingsKind: "VIDEO_EDIT",
      modeCompatibility: ["VIDEO_EDIT"],
      visibleInProductMode: true,
      providerCostUsdMicrosPerSecond: 126_000,
      pricingVersion: VIDEO_EDIT_PRICING_VERSION,
      characterReferenceStrategy: "KLING_ELEMENT",
      videoEditMediaProfile: KLING_O1_STANDARD_EDIT_MEDIA_PROFILE,
    },
    {
      id: SEEDANCE_2_FAST_EDIT_MODEL_ID,
      providerId: "fal",
      providerModelId: SEEDANCE_2_FAST_EDIT_ENDPOINT,
      name: "Seedance 2 Fast",
      description: "Schnelle Video-Bearbeitung mit mehreren Referenzen · 720p.",
      badge: "Fast",
      availability: "LIVE",
      maximumReferences: 2,
      supportedReferenceTypes: ["IMAGE", "VIDEO"],
      supportedDurations: SEEDANCE_2_FAST_DURATIONS,
      supportedAspectRatios: ["AUTO"],
      supportedQualities: ["720p"],
      supportedBitrates: ["STANDARD"],
      settingsKind: "VIDEO_EDIT",
      modeCompatibility: ["VIDEO_EDIT"],
      visibleInProductMode: true,
      providerCostUsdMicrosPerSecond: 145_150,
      pricingVersion: VIDEO_EDIT_PRICING_VERSION,
      characterReferenceStrategy: "SEEDANCE_IMAGE",
      videoEditMediaProfile: SEEDANCE_2_FAST_EDIT_MEDIA_PROFILE,
    },
    ...BASE_VIDEO_CLIENT_MODELS.map((model) => ({
      id: model.id,
      providerId: "fal",
      // Base-video endpoint selection is variant-specific and remains in the
      // server-only execution registry, never in the shared browser registry.
      providerModelId: null,
      name: model.name,
      description: model.description,
      badge: model.badge,
      availability: "LIVE" as const,
      maximumReferences: 1,
      supportedReferenceTypes: ["IMAGE"] as const,
      supportedDurations: model.supportedDurations,
      supportedAspectRatios: [
        "AUTO",
        "21:9",
        "16:9",
        "4:3",
        "1:1",
        "3:4",
        "9:16",
      ] as const,
      supportedQualities: ["480p", "720p"] as const,
      supportedBitrates: ["STANDARD"] as const,
      settingsKind: "BASE_VIDEO" as const,
      modeCompatibility: ["BASE_VIDEO"] as const,
      visibleInProductMode: false,
      providerCostUsdMicrosPerSecond: null,
      pricingVersion: null,
      characterReferenceStrategy: "NONE" as const,
      videoEditMediaProfile: null,
    })),
    {
      id: "minimax",
      providerId: "minimax",
      providerModelId: null,
      name: "MiniMax",
      description: "Dynamische Social-Clips und ausdrucksstarke Bewegung.",
      badge: "Demnächst",
      availability: "PLANNED",
      maximumReferences: 2,
      supportedReferenceTypes: ["IMAGE"],
      supportedDurations: ["5", "6", "10"],
      supportedAspectRatios: ["16:9", "9:16"],
      supportedQualities: ["720p", "1080p"],
      supportedBitrates: ["STANDARD"],
      settingsKind: "GENERIC",
      modeCompatibility: [],
      visibleInProductMode: false,
      providerCostUsdMicrosPerSecond: null,
      pricingVersion: null,
      characterReferenceStrategy: "NONE",
      videoEditMediaProfile: null,
    },
    {
      id: "veo",
      providerId: "google",
      providerModelId: null,
      name: "Veo",
      description: "Premium-Videos mit natürlicher Sprache und Audio.",
      badge: "Demnächst",
      availability: "PLANNED",
      maximumReferences: 3,
      supportedReferenceTypes: ["IMAGE", "VIDEO"],
      supportedDurations: ["4", "5", "6", "8"],
      supportedAspectRatios: ["16:9", "9:16"],
      supportedQualities: ["720p", "1080p"],
      supportedBitrates: ["STANDARD"],
      settingsKind: "GENERIC",
      modeCompatibility: [],
      visibleInProductMode: false,
      providerCostUsdMicrosPerSecond: null,
      pricingVersion: null,
      characterReferenceStrategy: "NONE",
      videoEditMediaProfile: null,
    },
    {
      id: "sora",
      providerId: "openai",
      providerModelId: null,
      name: "Sora",
      description: "Promptstarke Videoerstellung für zukünftige Flows.",
      badge: "Geplant",
      availability: "PLANNED",
      maximumReferences: 1,
      supportedReferenceTypes: ["IMAGE"],
      supportedDurations: ["5", "10", "15"],
      supportedAspectRatios: ["16:9", "9:16", "1:1"],
      supportedQualities: ["720p", "1080p"],
      supportedBitrates: ["STANDARD"],
      settingsKind: "GENERIC",
      modeCompatibility: [],
      visibleInProductMode: false,
      providerCostUsdMicrosPerSecond: null,
      pricingVersion: null,
      characterReferenceStrategy: "NONE",
      videoEditMediaProfile: null,
    },
  ]);

export const DEFAULT_UGC_VIDEO_MODEL_ID = "seedance-2.5" as const;

export function ugcVideoModelById(
  modelId: string,
): UgcVideoModelDefinition | null {
  return UGC_VIDEO_MODEL_REGISTRY.find((model) => model.id === modelId) ?? null;
}

export function isUgcVideoEditModelId(modelId: string): modelId is UgcVideoEditModelId {
  return (VIDEO_EDIT_MODEL_IDS as readonly string[]).includes(modelId);
}

export function resolveRecommendedVideoEditModelId(
  requestedModelId: string,
): UgcVideoEditModelId | null {
  const resolved = requestedModelId === AUTO_RECOMMENDED_VIDEO_EDIT_MODEL_ID
    ? RECOMMENDED_VIDEO_EDIT_MODEL_ID
    : requestedModelId;
  return isUgcVideoEditModelId(resolved) ? resolved : null;
}

export function videoEditModelDefinitions(): readonly UgcVideoModelDefinition[] {
  return UGC_VIDEO_MODEL_REGISTRY.filter((model) => model.modeCompatibility.includes("VIDEO_EDIT"));
}

export function ugcVideoModelAvailabilityLabel(
  availability: UgcVideoModelAvailability,
): string {
  if (availability === "LIVE") return "Live";
  if (availability === "READY_TO_CONNECT") return "Verbindung vorbereitet";
  return "Geplant";
}
