import { z } from "zod";

export const UGC_VIDEO_STUDIO_CONTRACT_VERSION =
  "nexhq-ugc-video-studio-v1" as const;

export const UGC_VIDEO_REFERENCE_TYPES = ["IMAGE", "VIDEO", "AUDIO"] as const;
export const UGC_VIDEO_REFERENCE_ROLES = [
  "NONE",
  "IDENTITY",
  "FACE",
  "MODEL",
  "PRODUCT",
  "OUTFIT",
  "DESIGN",
  "SCENE",
  "STYLE",
  "MOTION",
  "AUDIO",
] as const;
export const UGC_VIDEO_TYPES = [
  "UGC",
  "FIT_CHECK",
  "PRODUCT_VIDEO",
  "SOCIAL_AD",
  "LIFESTYLE",
  "EDITORIAL",
  "TIKTOK_REELS",
  "FREE",
] as const;
export const UGC_VIDEO_DURATIONS = [
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "11",
  "12",
  "13",
  "14",
  "15",
  "16",
  "17",
  "18",
  "19",
  "20",
  "21",
  "22",
  "23",
  "24",
  "25",
  "26",
  "27",
  "28",
  "29",
  "30",
] as const;
export const UGC_VIDEO_ASPECT_RATIOS = [
  "AUTO",
  "21:9",
  "16:9",
  "4:3",
  "1:1",
  "3:4",
  "9:16",
] as const;
export const UGC_VIDEO_QUALITIES = ["480p", "720p", "1080p"] as const;
export const UGC_VIDEO_BITRATES = ["STANDARD", "HIGH"] as const;

export const UGC_VIDEO_REFERENCE_LIMIT = 50;
export const UGC_VIDEO_IMAGE_REFERENCE_LIMIT = 30;
export const UGC_VIDEO_VIDEO_REFERENCE_LIMIT = 10;
export const UGC_VIDEO_AUDIO_REFERENCE_LIMIT = 10;
export const UGC_VIDEO_REFERENCE_TOTAL_MAX_BYTES = 20 * 1024 * 1024;
export const UGC_VIDEO_REFERENCE_MAX_BYTES = {
  IMAGE: 30 * 1024 * 1024,
  VIDEO: 200 * 1024 * 1024,
  AUDIO: 15 * 1024 * 1024,
} as const;

export const UGC_VIDEO_REFERENCE_MIME_TYPES = {
  IMAGE: [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/avif",
  ],
  VIDEO: ["video/mp4", "video/quicktime", "video/webm", "video/x-m4v"],
  AUDIO: ["audio/mpeg", "audio/wav", "audio/x-wav"],
} as const;

export const ugcVideoReferenceTypeSchema = z.enum(UGC_VIDEO_REFERENCE_TYPES);
export type UgcVideoReferenceType = z.infer<
  typeof ugcVideoReferenceTypeSchema
>;
export const ugcVideoReferenceRoleSchema = z.enum(UGC_VIDEO_REFERENCE_ROLES);
export type UgcVideoReferenceRole = z.infer<
  typeof ugcVideoReferenceRoleSchema
>;

export const ugcVideoReferenceMetadataSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1).max(255),
    mimeType: z.string().min(1),
    mediaType: ugcVideoReferenceTypeSchema,
    byteLength: z.number().int().positive(),
    durationSeconds: z.number().positive().max(3600).nullable(),
    role: ugcVideoReferenceRoleSchema,
    order: z.number().int().nonnegative(),
  })
  .strict();
export type UgcVideoReferenceMetadata = z.infer<
  typeof ugcVideoReferenceMetadataSchema
>;

export type UgcVideoReferenceMedia = UgcVideoReferenceMetadata & {
  previewUrl: string;
  file: File;
};

export const ugcVideoAdvancedSettingsSchema = z
  .object({
    seed: z.number().int().nonnegative().nullable(),
    negativePrompt: z.string().max(4000),
    generateAudio: z.boolean(),
  })
  .strict();

export const UGC_VIDEO_KLING_CHARACTER_ORIENTATIONS = [
  "IMAGE",
  "VIDEO",
] as const;

export const DEFAULT_UGC_VIDEO_KLING_MOTION_SETTINGS = Object.freeze({
  characterOrientation: "VIDEO" as const,
  keepOriginalSound: false,
  faceBindingEnabled: true,
  characterImageReferenceId: null as string | null,
  motionVideoReferenceId: null as string | null,
  identityElementReferenceId: null as string | null,
});

export const ugcVideoKlingMotionSettingsSchema = z
  .object({
    characterOrientation: z.enum(UGC_VIDEO_KLING_CHARACTER_ORIENTATIONS),
    keepOriginalSound: z.boolean(),
    faceBindingEnabled: z.boolean(),
    characterImageReferenceId: z.string().min(1).nullable(),
    motionVideoReferenceId: z.string().min(1).nullable(),
    identityElementReferenceId: z.string().min(1).nullable(),
  })
  .strict();
export type UgcVideoKlingMotionSettings = z.infer<
  typeof ugcVideoKlingMotionSettingsSchema
>;

export const ugcVideoGenerationSetupSchema = z
  .object({
    contractVersion: z.literal(UGC_VIDEO_STUDIO_CONTRACT_VERSION),
    prompt: z.string().trim().min(1).max(12000),
    modelId: z.string().min(1),
    duration: z.enum(UGC_VIDEO_DURATIONS),
    aspectRatio: z.enum(UGC_VIDEO_ASPECT_RATIOS),
    quality: z.enum(UGC_VIDEO_QUALITIES),
    bitrate: z.enum(UGC_VIDEO_BITRATES),
    videoType: z.enum(UGC_VIDEO_TYPES),
    references: z
      .array(ugcVideoReferenceMetadataSchema)
      .max(UGC_VIDEO_REFERENCE_LIMIT),
    advanced: ugcVideoAdvancedSettingsSchema,
    klingMotion: ugcVideoKlingMotionSettingsSchema
      .optional()
      .default(DEFAULT_UGC_VIDEO_KLING_MOTION_SETTINGS),
  })
  .strict();
export type UgcVideoGenerationSetup = z.infer<
  typeof ugcVideoGenerationSetupSchema
>;

export const savedUgcVideoPromptSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().trim().min(1).max(120),
    description: z.string().max(500),
    tags: z.array(z.string().min(1).max(40)).max(12),
    favorite: z.boolean(),
    prompt: z.string().min(1).max(12000),
    modelId: z.string().min(1),
    duration: z.enum(UGC_VIDEO_DURATIONS),
    aspectRatio: z.enum(UGC_VIDEO_ASPECT_RATIOS),
    quality: z.enum(UGC_VIDEO_QUALITIES),
    bitrate: z.enum(UGC_VIDEO_BITRATES),
    videoType: z.enum(UGC_VIDEO_TYPES),
    advanced: ugcVideoAdvancedSettingsSchema,
    klingMotion: ugcVideoKlingMotionSettingsSchema
      .optional()
      .default(DEFAULT_UGC_VIDEO_KLING_MOTION_SETTINGS),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    lastUsedAt: z.string().datetime().nullable(),
  })
  .strict();
export type SavedUgcVideoPrompt = z.infer<typeof savedUgcVideoPromptSchema>;

export const ugcVideoResultSchema = z
  .object({
    id: z.string().min(1),
    url: z.string().min(1),
    downloadUrl: z.string().min(1),
    mimeType: z.string().min(1),
    width: z.number().int().positive().nullable(),
    height: z.number().int().positive().nullable(),
    durationSeconds: z.number().positive().nullable(),
    byteLength: z.number().int().positive().nullable(),
    favorite: z.boolean(),
    provider: z.string().min(1),
    providerModel: z.string().min(1),
    providerRequestId: z.string().min(1).nullable(),
  })
  .strict();
export type UgcVideoResult = z.infer<typeof ugcVideoResultSchema>;

export const UGC_VIDEO_PROVIDER_FAILURE_PHASES = [
  "SUBMIT",
  "STATUS",
  "RESULT",
  "RESULT_DOWNLOAD",
] as const;

export const ugcVideoProviderErrorSchema = z
  .object({
    phase: z.enum(UGC_VIDEO_PROVIDER_FAILURE_PHASES),
    httpStatus: z.number().int().min(100).max(599).nullable(),
    providerCode: z.string().max(500).nullable(),
    providerMessage: z.string().max(4000),
    providerBody: z.string().max(24 * 1024).nullable(),
    requestId: z.string().max(500).nullable(),
    endpoint: z.string().max(1000),
    occurredAt: z.string().datetime(),
    truncated: z.boolean(),
  })
  .strict();
export type UgcVideoProviderError = z.infer<
  typeof ugcVideoProviderErrorSchema
>;

export const ugcVideoQueueLogSchema = z
  .object({
    level: z.enum(["STDERR", "STDOUT", "ERROR", "INFO", "WARN", "DEBUG"]),
    message: z.string().max(1000),
    timestamp: z.string().max(100),
  })
  .strict();

export const ugcVideoQueueObservationSchema = z
  .object({
    status: z.enum(["IN_QUEUE", "IN_PROGRESS", "COMPLETED", "FAILED"]),
    queuePosition: z.number().int().nonnegative().nullable(),
    observedAt: z.string().datetime(),
    logs: z.array(ugcVideoQueueLogSchema).max(20),
    inferenceTimeSeconds: z.number().nonnegative().nullable(),
    metrics: z.string().max(4096).nullable(),
    truncated: z.boolean(),
  })
  .strict();
export type UgcVideoQueueObservation = z.infer<
  typeof ugcVideoQueueObservationSchema
>;

export const ugcVideoRunSchema = z
  .object({
    id: z.string().min(1),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    status: z.enum([
      "RUNNING",
      "SUCCEEDED",
      "FAILED",
      "UNKNOWN_OUTCOME",
      "PROVIDER_NOT_CONNECTED",
    ]),
    setup: ugcVideoGenerationSetupSchema,
    results: z.array(ugcVideoResultSchema).max(1),
    message: z.string().max(1000).nullable(),
    provider: z.string().min(1).optional(),
    providerModel: z.string().min(1).optional(),
    providerRequestId: z.string().min(1).nullable().optional(),
    providerPrompt: z.string().max(20000).optional(),
    estimatedMaximumCostUsd: z.number().nonnegative().nullable().optional(),
    actualCostUsd: z.number().nonnegative().nullable().optional(),
    providerError: ugcVideoProviderErrorSchema.nullable().optional(),
    queueObservations: z.array(ugcVideoQueueObservationSchema).max(8).optional(),
  })
  .strict();
export type UgcVideoRun = z.infer<typeof ugcVideoRunSchema>;

export const ugcVideoPersistedStateSchema = z
  .object({
    version: z.literal(1),
    prompts: z.array(savedUgcVideoPromptSchema),
    runs: z.array(ugcVideoRunSchema),
  })
  .strict();
export type UgcVideoPersistedState = z.infer<
  typeof ugcVideoPersistedStateSchema
>;

export const DEFAULT_UGC_VIDEO_ADVANCED_SETTINGS: UgcVideoGenerationSetup["advanced"] =
  Object.freeze({
    seed: null,
    negativePrompt: "",
    generateAudio: true,
  });

export const UGC_VIDEO_TYPE_LABELS: Record<
  UgcVideoGenerationSetup["videoType"],
  string
> = {
  UGC: "UGC",
  FIT_CHECK: "Fit Check",
  PRODUCT_VIDEO: "Produktvideo",
  SOCIAL_AD: "Social Ad",
  LIFESTYLE: "Lifestyle",
  EDITORIAL: "Editorial",
  TIKTOK_REELS: "TikTok / Reels",
  FREE: "Freier Modus",
};

export const UGC_VIDEO_REFERENCE_ROLE_LABELS: Record<
  UgcVideoReferenceRole,
  string
> = {
  NONE: "Keine Rolle",
  IDENTITY: "Identität",
  FACE: "Gesicht",
  MODEL: "Model",
  PRODUCT: "Produkt",
  OUTFIT: "Outfit",
  DESIGN: "Design",
  SCENE: "Szene",
  STYLE: "Stil",
  MOTION: "Bewegung",
  AUDIO: "Audio",
};

export const UGC_VIDEO_BITRATE_LABELS: Record<
  UgcVideoGenerationSetup["bitrate"],
  string
> = {
  STANDARD: "Standard",
  HIGH: "Hoch",
};
