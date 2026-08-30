import { z } from "zod";

export const CREATIVE_STUDIO_CONTRACT_VERSION =
  "nexhq-creative-studio-v1" as const;

export const CREATIVE_ASPECT_RATIOS = [
  "AUTO",
  "1:1",
  "3:4",
  "4:3",
  "2:3",
  "3:2",
  "9:16",
  "16:9",
  "5:4",
  "4:5",
  "21:9",
] as const;
export const CREATIVE_QUALITIES = ["1K", "2K", "4K"] as const;
export const CREATIVE_BATCH_SIZES = [1, 2, 3, 4] as const;
export const CREATIVE_GLOBAL_REFERENCE_LIMIT = 14 as const;
export const CREATIVE_REFERENCE_MAX_BYTES = 8 * 1024 * 1024;
export const CREATIVE_REFERENCE_TOTAL_MAX_BYTES = 18 * 1024 * 1024;
export const CREATIVE_REFERENCE_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/avif",
] as const;
export const CREATIVE_OUTPUT_TYPES = [
  "MOCKUP",
  "SOCIAL_ASSET",
  "CAMPAIGN",
  "PRODUCT_IMAGE",
  "EDITORIAL",
  "STREETWEAR_ASSET",
] as const;
export const CREATIVE_REFERENCE_ROLES = [
  "NONE",
  "IDENTITY",
  "FACE",
  "MODEL",
  "PRODUCT",
  "OUTFIT",
  "DESIGN",
  "SCENE",
  "STYLE",
] as const;

export const creativeReferenceRoleSchema = z.enum(CREATIVE_REFERENCE_ROLES);
export type CreativeReferenceRole = z.infer<typeof creativeReferenceRoleSchema>;

export const creativeReferenceMetadataSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    mimeType: z.string().min(1),
    byteLength: z.number().int().nonnegative(),
    role: creativeReferenceRoleSchema,
    order: z.number().int().nonnegative(),
  })
  .strict();
export type CreativeReferenceMetadata = z.infer<
  typeof creativeReferenceMetadataSchema
>;

export const creativeReferenceSourceSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("LIBRARY_REFERENCE"),
      libraryAssetId: z.string().uuid(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("GENERATED_RESULT_REFERENCE"),
      sourceJobId: z.string().uuid(),
      sourceResultId: z.string().min(1).max(160),
    })
    .strict(),
  z.object({ kind: z.literal("LOCAL_FILE_REFERENCE") }).strict(),
]);
export type CreativeReferenceSource = z.infer<
  typeof creativeReferenceSourceSchema
>;

export type CreativeReferenceImage = CreativeReferenceMetadata & {
  previewUrl: string;
  file: File;
  /** Client/recovery provenance only. Never enters the provider setup payload. */
  source: CreativeReferenceSource;
};

export const creativeReferenceSnapshotEntrySchema = z
  .object({
    referenceId: z.string().min(1),
    order: z.number().int().nonnegative(),
    role: creativeReferenceRoleSchema,
    source: creativeReferenceSourceSchema,
    filename: z.string().min(1).max(255),
    mimeType: z.string().min(1).max(120),
    byteLength: z.number().int().nonnegative(),
    checksumSha256: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .nullable(),
  })
  .strict();
export type CreativeReferenceSnapshotEntry = z.infer<
  typeof creativeReferenceSnapshotEntrySchema
>;

export const creativeReferenceSnapshotSchema = z
  .object({
    version: z.literal("xeriano-creative-reference-snapshot-v1"),
    jobId: z.string().uuid(),
    createdAt: z.string().datetime(),
    references: z
      .array(creativeReferenceSnapshotEntrySchema)
      .max(CREATIVE_GLOBAL_REFERENCE_LIMIT),
  })
  .strict();
export type CreativeReferenceSnapshot = z.infer<
  typeof creativeReferenceSnapshotSchema
>;

export const creativeGenerationSetupSchema = z
  .object({
    contractVersion: z.literal(CREATIVE_STUDIO_CONTRACT_VERSION),
    prompt: z.string().trim().min(1).max(12000),
    modelId: z.string().min(1),
    aspectRatio: z.enum(CREATIVE_ASPECT_RATIOS),
    quality: z.enum(CREATIVE_QUALITIES),
    batchSize: z.union([
      z.literal(1),
      z.literal(2),
      z.literal(3),
      z.literal(4),
    ]),
    outputType: z.enum(CREATIVE_OUTPUT_TYPES),
    references: z
      .array(creativeReferenceMetadataSchema)
      .max(CREATIVE_GLOBAL_REFERENCE_LIMIT),
    advanced: z
      .object({
        identityStrength: z.number().min(0).max(1),
        referenceStrength: z.number().min(0).max(1),
        styleStrength: z.number().min(0).max(1),
        productFidelity: z.number().min(0).max(1),
        designFidelity: z.number().min(0).max(1),
        realism: z.number().min(0).max(1),
        negativePrompt: z.string().max(4000),
        seed: z.number().int().nonnegative().nullable(),
      })
      .strict(),
  })
  .strict();
export type CreativeGenerationSetup = z.infer<
  typeof creativeGenerationSetupSchema
>;

export const savedCreativePromptSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().trim().min(1).max(120),
    description: z.string().max(500),
    tags: z.array(z.string().min(1).max(40)).max(12),
    favorite: z.boolean(),
    prompt: z.string().min(1).max(12000),
    modelId: z.string().min(1),
    aspectRatio: z.enum(CREATIVE_ASPECT_RATIOS),
    quality: z.enum(CREATIVE_QUALITIES),
    batchSize: z.union([
      z.literal(1),
      z.literal(2),
      z.literal(3),
      z.literal(4),
    ]),
    outputType: z.enum(CREATIVE_OUTPUT_TYPES),
    advanced: creativeGenerationSetupSchema.shape.advanced.optional(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    lastUsedAt: z.string().datetime().nullable(),
  })
  .strict();
export type SavedCreativePrompt = z.infer<typeof savedCreativePromptSchema>;

export const creativeResultSchema = z
  .object({
    id: z.string().min(1),
    url: z.string().min(1),
    downloadUrl: z.string().min(1).nullable(),
    mimeType: z.string().min(1),
    width: z.number().int().positive().nullable(),
    height: z.number().int().positive().nullable(),
    favorite: z.boolean(),
    provider: z.string().min(1).optional(),
    providerModel: z.string().min(1).optional(),
    providerRequestId: z.string().min(1).nullable().optional(),
    libraryAssetId: z.string().uuid().optional(),
    creationId: z.string().uuid().optional(),
  })
  .strict();
export type CreativeResult = z.infer<typeof creativeResultSchema>;

export const creativeRunSchema = z
  .object({
    id: z.string().min(1),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    status: z.enum([
      "PREPARED",
      "RUNNING",
      "SUCCEEDED",
      "PARTIALLY_SUCCEEDED",
      "FAILED",
      "UNKNOWN_OUTCOME",
      "PROVIDER_NOT_CONNECTED",
    ]),
    setup: creativeGenerationSetupSchema,
    results: z.array(creativeResultSchema),
    message: z.string().max(1000).nullable(),
    provider: z.string().min(1).optional(),
    providerModel: z.string().min(1).optional(),
    providerRequestId: z.string().min(1).nullable().optional(),
    providerPrompt: z.string().max(20000).optional(),
    estimatedMaximumCostUsd: z.number().nonnegative().nullable().optional(),
    /** Recovery sidecar for UI state only; not part of provider execution. */
    referenceSnapshot: creativeReferenceSnapshotSchema.optional(),
  })
  .strict();
export type CreativeRun = z.infer<typeof creativeRunSchema>;

export const creativeStudioPersistedStateSchema = z
  .object({
    version: z.literal(1),
    prompts: z.array(savedCreativePromptSchema),
    runs: z.array(creativeRunSchema),
  })
  .strict();
export type CreativeStudioPersistedState = z.infer<
  typeof creativeStudioPersistedStateSchema
>;

export const DEFAULT_CREATIVE_ADVANCED_SETTINGS: CreativeGenerationSetup["advanced"] =
  Object.freeze({
    identityStrength: 0.8,
    referenceStrength: 0.75,
    styleStrength: 0.65,
    productFidelity: 0.85,
    designFidelity: 0.9,
    realism: 0.8,
    negativePrompt: "",
    seed: null,
  });

export const CREATIVE_OUTPUT_TYPE_LABELS: Record<
  CreativeGenerationSetup["outputType"],
  string
> = {
  MOCKUP: "Mockup",
  SOCIAL_ASSET: "Social-Motiv",
  CAMPAIGN: "Kampagnenbild",
  PRODUCT_IMAGE: "Produktbild",
  EDITORIAL: "Editorial",
  STREETWEAR_ASSET: "Streetwear-Motiv",
};

export const CREATIVE_REFERENCE_ROLE_LABELS: Record<
  CreativeReferenceRole,
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
};
