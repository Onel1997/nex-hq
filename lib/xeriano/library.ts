import { z } from "zod";

export const XERIANO_LIBRARY_PAGE_SIZE = 24 as const;
export const XERIANO_DESIGN_MAX_BYTES = 20 * 1024 * 1024;
export const XERIANO_DESIGN_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;

export const xerianoAssetTypeSchema = z.enum(["DESIGN", "IMAGE", "VIDEO", "REFERENCE"]);
export const xerianoLibraryAssetSchema = z.object({
  id: z.string().uuid(),
  accountId: z.string().uuid(),
  ownerUserId: z.string().uuid(),
  assetType: xerianoAssetTypeSchema,
  title: z.string().min(1).max(160),
  description: z.string().max(2000).nullable(),
  sourceStudio: z.enum(["DESIGN_STUDIO", "CREATIVE_STUDIO", "UGC_VIDEO_STUDIO", "UPLOAD"]),
  mimeType: z.string().min(1),
  byteLength: z.number().int().positive().max(50 * 1024 * 1024),
  width: z.number().int().positive().nullable().optional(),
  height: z.number().int().positive().nullable().optional(),
  favorite: z.boolean(),
  tags: z.array(z.string().min(1).max(40)).max(20),
  createdAt: z.string(),
  updatedAt: z.string(),
  creationId: z.string().uuid().nullable().optional(),
  design: z.object({
    operation: z.enum(["BACKGROUND_REMOVE", "UPSCALE", "SVG_TO_PNG"]).nullable(),
    derivedFromAssetId: z.string().uuid().nullable(),
    transparentPreview: z.boolean(),
    canBackgroundRemove: z.boolean(),
    canUpscale: z.boolean(),
    canCreatePng: z.boolean(),
    setup: z.unknown().nullable(),
  }).nullable().optional(),
});
export type XerianoLibraryAsset = z.infer<typeof xerianoLibraryAssetSchema>;

export function deriveDesignAssetCapabilities(input: {
  assetType: string;
  mimeType: string;
  width: number | null;
  height: number | null;
  operation: "BACKGROUND_REMOVE" | "UPSCALE" | "SVG_TO_PNG" | null;
}) {
  if (input.assetType !== "DESIGN") return null;
  const raster = ["image/png", "image/jpeg", "image/webp"].includes(input.mimeType);
  return {
    transparentPreview: input.operation === "BACKGROUND_REMOVE" || input.operation === "SVG_TO_PNG",
    canBackgroundRemove: raster && input.operation !== "BACKGROUND_REMOVE",
    canUpscale: raster && input.width !== null && input.height !== null
      && Math.max(input.width, input.height) <= 2_560,
    canCreatePng: input.mimeType === "image/svg+xml",
  };
}

export const xerianoStudioHandoffSchema = z.object({
  version: z.literal("xeriano-studio-handoff-v1"),
  assetId: z.string().uuid(),
  targetStudio: z.enum(["CREATIVE_STUDIO", "UGC_VIDEO_STUDIO"]),
});

// Outer handoff contract only. The frozen studio result stores remain the
// provenance authority; activation copies or links a result once, without
// changing either studio's provider/finalization lifecycle.
export const xerianoResultLibraryImportSchema = z.object({
  version: z.literal("xeriano-result-library-import-v1"),
  sourceStudio: z.enum(["CREATIVE_STUDIO", "UGC_VIDEO_STUDIO"]),
  sourceJobId: z.string().uuid(),
  sourceResultId: z.string().min(1).max(160),
  title: z.string().min(1).max(160),
});
export type XerianoResultLibraryImport = z.infer<typeof xerianoResultLibraryImportSchema>;

export function handoffHref(
  assetId: string,
  target: "CREATIVE_STUDIO" | "UGC_VIDEO_STUDIO",
  audience: "CUSTOMER" | "OWNER" = "CUSTOMER",
) {
  const root = audience === "OWNER" ? "/hq" : "/app";
  const route = target === "CREATIVE_STUDIO" ? `${root}/creative-studio` : `${root}/ugc-video-studio`;
  return `${route}?libraryAsset=${encodeURIComponent(assetId)}`;
}

export function validateDesignSignature(bytes: Uint8Array, mimeType: string): boolean {
  if (mimeType === "image/png") return bytes.length >= 8 && [137,80,78,71,13,10,26,10].every((v,i) => bytes[i] === v);
  if (mimeType === "image/jpeg") return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mimeType === "image/webp") return bytes.length >= 12 && new TextDecoder().decode(bytes.slice(0,4)) === "RIFF" && new TextDecoder().decode(bytes.slice(8,12)) === "WEBP";
  return false;
}
