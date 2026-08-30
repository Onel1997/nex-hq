import { z } from "zod";

export const XERIANO_CREATION_PAGE_SIZE = 24 as const;

export const xerianoCreationTypeSchema = z.enum(["IMAGE", "VIDEO"]);
export const xerianoCreationReferenceSchema = z.object({
  id: z.string().uuid(),
  order: z.number().int().nonnegative(),
  role: z.string().min(1).max(80),
  sourceKind: z.enum([
    "LIBRARY_REFERENCE",
    "GENERATED_RESULT_REFERENCE",
    "LOCAL_FILE_REFERENCE",
  ]),
  filename: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(120),
  byteLength: z.number().int().positive(),
  checksumSha256: z.string().regex(/^[a-f0-9]{64}$/),
  contentUrl: z.string().min(1),
  source: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("LIBRARY_REFERENCE"), libraryAssetId: z.string().uuid() }),
    z.object({ kind: z.literal("GENERATED_RESULT_REFERENCE"), sourceJobId: z.string().uuid(), sourceResultId: z.string().min(1) }),
    z.object({ kind: z.literal("LOCAL_FILE_REFERENCE") }),
  ]),
});

export const xerianoCreationSchema = z.object({
  id: z.string().uuid(),
  assetId: z.string().uuid(),
  creationType: xerianoCreationTypeSchema,
  sourceStudio: z.enum(["CREATIVE_STUDIO", "UGC_VIDEO_STUDIO"]),
  sourceJobId: z.string().min(1).max(160),
  sourceResultId: z.string().min(1).max(160),
  title: z.string().min(1).max(160),
  mimeType: z.string().min(1),
  originalPrompt: z.string().min(1).max(12000),
  modelId: z.string().min(1).max(200),
  settings: z.record(z.string(), z.unknown()),
  creditCost: z.number().int().nonnegative(),
  favorite: z.boolean(),
  status: z.enum(["SUCCEEDED", "PARTIAL"]),
  createdAt: z.string(),
  resultContentUrl: z.string().min(1),
  resultDownloadUrl: z.string().min(1),
  references: z.array(xerianoCreationReferenceSchema).max(64).optional(),
});

export type XerianoCreation = z.infer<typeof xerianoCreationSchema>;
export type XerianoCreationReference = z.infer<
  typeof xerianoCreationReferenceSchema
>;

export type XerianoCreationOpenMode = "edit" | "recreate";

export function creationStudioHref(
  creationId: string,
  mode: XerianoCreationOpenMode,
) {
  return `/app/creative-studio?creation=${encodeURIComponent(creationId)}&mode=${mode}`;
}

export function creationVideoHref(assetId: string) {
  return `/app/ugc-video-studio?libraryAsset=${encodeURIComponent(assetId)}`;
}
