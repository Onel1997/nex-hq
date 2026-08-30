import type {
  UgcVideoGenerationSetup,
  UgcVideoReferenceType,
} from "@/lib/ugc-video-studio/contracts";

export type UgcVideoModelAvailability = "LIVE" | "READY_TO_CONNECT" | "PLANNED";

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
  settingsKind: "SEEDANCE" | "KLING_MOTION_CONTROL" | "GENERIC";
};

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
      supportedDurations: ALL_DURATIONS.filter((duration) => Number(duration) <= 30),
      supportedAspectRatios: [],
      supportedQualities: [],
      supportedBitrates: [],
      settingsKind: "KLING_MOTION_CONTROL",
    },
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
    },
  ]);

export const DEFAULT_UGC_VIDEO_MODEL_ID = "seedance-2.5" as const;

export function ugcVideoModelById(
  modelId: string,
): UgcVideoModelDefinition | null {
  return UGC_VIDEO_MODEL_REGISTRY.find((model) => model.id === modelId) ?? null;
}

export function ugcVideoModelAvailabilityLabel(
  availability: UgcVideoModelAvailability,
): string {
  if (availability === "LIVE") return "Live";
  if (availability === "READY_TO_CONNECT") return "Verbindung vorbereitet";
  return "Geplant";
}
