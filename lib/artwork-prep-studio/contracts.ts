import { z } from "zod";

export const ARTWORK_PREP_CONTRACT_VERSION = "xeriamo-artwork-prep-v1" as const;
export const ARTWORK_PREP_LOCAL_STORAGE_KEY = "xeriamo-artwork-prep-project-v1" as const;
export const ARTWORK_PREP_RASTER_MAX_BYTES = 20 * 1024 * 1024;
export const ARTWORK_PREP_SVG_MAX_BYTES = 5 * 1024 * 1024;
export const ARTWORK_PREP_PROVIDER_MAX_BYTES = 10 * 1024 * 1024;
export const ARTWORK_PREP_OUTPUT_MAX_BYTES = 50 * 1024 * 1024;
export const ARTWORK_PREP_MAX_DIMENSION = 10_000;
export const ARTWORK_PREP_MAX_PIXELS = 40_000_000;

export const artworkPrepMimeTypeSchema = z.enum([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
]);

export const artworkPrepProviderOperationSchema = z.enum([
  "BACKGROUND_REMOVE",
  "UPSCALE",
]);
export const artworkPrepJobKindSchema = z.enum(["UTILITY", "PRINT", "LOCAL"]);
export const artworkPrepUpscaleFactorSchema = z.union([z.literal(2), z.literal(4)]);

export const artworkPrepSourceRequestSchema = z.union([
  z.object({
    projectId: z.string().uuid(),
    tempReferenceId: z.string().uuid(),
    title: z.string().trim().min(1).max(160),
  }).strict(),
  z.object({
    projectId: z.string().uuid(),
    libraryAssetId: z.string().uuid(),
  }).strict(),
]);

export const artworkPrepProcessRequestSchema = z.discriminatedUnion("operation", [
  z.object({
    operation: z.literal("BACKGROUND_REMOVE"),
    projectId: z.string().uuid(),
    jobId: z.string().uuid(),
    sourceAssetId: z.string().uuid(),
  }).strict(),
  z.object({
    operation: z.literal("UPSCALE"),
    projectId: z.string().uuid(),
    jobId: z.string().uuid(),
    sourceAssetId: z.string().uuid(),
    factor: artworkPrepUpscaleFactorSchema,
  }).strict(),
  z.object({
    operation: z.literal("BACKGROUND_COLOR"),
    projectId: z.string().uuid(),
    jobId: z.string().uuid(),
    sourceAssetId: z.string().uuid(),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  }).strict(),
  z.object({
    operation: z.literal("PRINT_FILE"),
    projectId: z.string().uuid(),
    jobId: z.string().uuid(),
    sourceAssetId: z.string().uuid(),
  }).strict(),
]);

export const artworkPrepQuoteRequestSchema = z.object({
  operation: artworkPrepProviderOperationSchema,
  factor: artworkPrepUpscaleFactorSchema.optional(),
}).strict();

export const artworkPrepAssetSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  mimeType: artworkPrepMimeTypeSchema,
  byteLength: z.number().int().positive(),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
  hasAlpha: z.boolean(),
  hasTransparency: z.boolean(),
  operation: z.enum([
    "ARTWORK_ORIGINAL",
    "BACKGROUND_REMOVE",
    "BACKGROUND_COLOR",
    "UPSCALE",
    "PRINT_FILE_300_DPI",
  ]).nullable(),
  derivedFromAssetId: z.string().uuid().nullable(),
  upscaleFactor: artworkPrepUpscaleFactorSchema.nullable(),
  backgroundColor: z.string().nullable(),
  rasterSourceUpscaled: z.boolean().nullable(),
  createdAt: z.string(),
  contentUrl: z.string(),
  downloadUrl: z.string(),
});
export type ArtworkPrepAsset = z.infer<typeof artworkPrepAssetSchema>;

export const artworkPrepProjectSchema = z.object({
  version: z.literal(ARTWORK_PREP_CONTRACT_VERSION),
  projectId: z.string().uuid(),
  originalAssetId: z.string().uuid().nullable(),
  currentAssetId: z.string().uuid().nullable(),
  variantAssetIds: z.array(z.string().uuid()).max(40),
  pendingJobs: z.array(z.object({
    id: z.string().uuid(),
    kind: artworkPrepJobKindSchema,
  }).strict()).max(12),
}).strict();
export type ArtworkPrepProject = z.infer<typeof artworkPrepProjectSchema>;

export function recommendedArtworkUpscaleFactor(width: number, height: number): 2 | 4 | null {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  const requiredScale = Math.min(4_050 / width, 5_400 / height);
  if (requiredScale <= 1) return null;
  return requiredScale <= 2 ? 2 : 4;
}
