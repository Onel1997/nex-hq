import { z } from "zod";
import { IMAGE_PROJECT_TYPE } from "@/brain/domains/reports";

export const IMAGE_SCHEMA_VERSION = "3.0" as const;
export const IMAGE_SCHEMA_VERSION_V2 = "2.0" as const;

/** Top-level production output categories. */
export const IMAGE_OUTPUT_CATEGORIES = [
  "product_photography",
  "editorial_campaign",
  "social_media",
  "lookbook",
  "launch_assets",
] as const;
export type ImageOutputCategory = (typeof IMAGE_OUTPUT_CATEGORIES)[number];

export const IMAGE_STUDIO_ASSET_TYPES = [
  "studio_shot",
  "ecommerce_image",
  "detail_shot",
  "editorial_streetwear",
  "editorial_luxury",
  "instagram_post",
  "story_slide",
  "carousel_image",
  "tiktok_cover",
  "lookbook_outfit",
  "collection_cover",
  "hero_image",
  "launch_banner",
] as const;
export type ImageStudioAssetType = (typeof IMAGE_STUDIO_ASSET_TYPES)[number];

export const IMAGE_ASSET_PRIORITIES = ["hero", "core", "support"] as const;
export type ImageAssetPriority = (typeof IMAGE_ASSET_PRIORITIES)[number];

export const IMAGE_ASSET_STATUSES = [
  "ready",
  "generating",
  "completed",
  "failed",
  "pending",
] as const;
export type ImageAssetStatus = (typeof IMAGE_ASSET_STATUSES)[number];

const detailedString = (min: number) => z.string().min(min);
const keywordList = (min: number, max: number) =>
  z.array(z.string().min(2)).min(min).max(max);
const colorWithHex = (min: number) =>
  z
    .string()
    .min(min)
    .refine((value) => /#[0-9A-Fa-f]{3,8}/.test(value), {
      message: "Color must include a HEX value",
    });

export const imageAiPromptsSchema = z.object({
  midjourney: detailedString(80),
  openai: detailedString(80),
  flux: detailedString(80),
});

export const imageMoodboardSchema = z.object({
  visualDirection: detailedString(80),
  aestheticKeywords: keywordList(3, 12),
  colorSystem: keywordList(2, 8),
  materialReferences: keywordList(2, 8),
  photographyStyle: detailedString(40),
});

export const imagePaletteSchema = z.object({
  primary: colorWithHex(5),
  secondary: colorWithHex(5),
  accent: colorWithHex(5),
  background: colorWithHex(5),
  text: colorWithHex(5),
});

/** V3 production asset — fashion studio shot brief. */
export const imageStudioAssetSchema = z.object({
  id: z.string().min(1),
  assetType: z.enum(IMAGE_STUDIO_ASSET_TYPES),
  outputCategory: z.enum(IMAGE_OUTPUT_CATEGORIES),
  productName: z.string().min(1),
  collection: z.string().min(1),
  color: z.string().min(1),
  material: z.string().min(1),
  location: detailedString(10),
  lighting: detailedString(10),
  photographyStyle: detailedString(20),
  cameraStyle: detailedString(10),
  prompt: imageAiPromptsSchema,
  priority: z.enum(IMAGE_ASSET_PRIORITIES),
  status: z.enum(IMAGE_ASSET_STATUSES).default("pending"),
  title: z.string().optional(),
  platform: z.string().optional(),
  dimensions: z.string().optional(),
  imageUrl: z.string().url().optional(),
  storagePath: z.string().optional(),
  createdAt: z.string().optional(),
  message: z.string().optional(),
});

export const imageLookbookShotSchema = z.object({
  shotName: z.string().min(1),
  models: z.string().min(2),
  location: detailedString(10),
  outfitProducts: z.array(z.string()).min(1).max(6),
  styling: detailedString(20),
  purpose: detailedString(20),
});

export const imageOutputSchema = z.object({
  title: z.string().min(1),
  reportType: z.literal(IMAGE_PROJECT_TYPE),
  schemaVersion: z.literal(IMAGE_SCHEMA_VERSION).default(IMAGE_SCHEMA_VERSION),
  projectName: z.string().min(1),
  collectionName: z.string().min(1),
  visualDirection: detailedString(80),
  moodboard: imageMoodboardSchema,
  palette: imagePaletteSchema,
  productionAssets: z.array(imageStudioAssetSchema).min(18).max(48),
  lookbookShots: z.array(imageLookbookShotSchema).min(4).max(12),
  confidence: z.number().min(0).max(1),
  sourceReportTitles: z.array(z.string()).min(1),
  fullProject: detailedString(600),
});

export type ImageAiPrompts = z.infer<typeof imageAiPromptsSchema>;
export type ImageMoodboardSection = z.infer<typeof imageMoodboardSchema>;
export type ImagePalette = z.infer<typeof imagePaletteSchema>;
export type ImageStudioAsset = z.infer<typeof imageStudioAssetSchema>;
export type ImageLookbookShot = z.infer<typeof imageLookbookShotSchema>;
export type ImageOutput = z.infer<typeof imageOutputSchema>;

export interface ImageRunInput {
  brief: string;
  workspaceId: string;
  workspaceName: string;
  originTaskId?: string;
}

export interface ImageRunResult {
  reportId: string;
  reportRecordId: string;
  title: string;
  projectName: string;
  collectionName: string;
  schemaVersion: typeof IMAGE_SCHEMA_VERSION;
  visualDirection: string;
  moodboard: ImageMoodboardSection;
  palette: ImagePalette;
  productionAssets: ImageStudioAsset[];
  lookbookShots: ImageLookbookShot[];
  confidence: number;
  sourceReportTitles: string[];
  contextRecordCount: number;
  primaryReportCounts: Record<
    "ceo-report" | "design-report" | "content-report" | "marketing-report",
    number
  >;
}

export function countProductionAssets(assets: ImageStudioAsset[]): number {
  return assets.length;
}

export function findStudioAsset(
  sections: { productionAssets?: ImageStudioAsset[] },
  assetId: string,
): ImageStudioAsset | undefined {
  return sections.productionAssets?.find((asset) => asset.id === assetId);
}

/** Legacy V2 asset types — kept for migration reads. */
export const IMAGE_ASSET_TYPES = [
  "hero_banner",
  "product_mockup",
  "campaign_key_visual",
  "instagram_carousel",
  "reels_concept",
  "tiktok_concept",
  "landing_section",
  "instagram_grid",
  "campaign_visual",
  "social_concept",
  "extra_mockup",
  "community_concept",
  "launch_teaser",
  "email_asset",
] as const;

export type ImageAssetType = (typeof IMAGE_ASSET_TYPES)[number];

export const normalizedImageAssetSchema = imageStudioAssetSchema;
export type NormalizedImageAsset = ImageStudioAsset;

export const imageCampaignShotSchema = imageLookbookShotSchema;
export type ImageCampaignShot = ImageLookbookShot;

export function countImageAssets(
  productionAssets: ImageStudioAsset[],
): number {
  return productionAssets.length;
}

export function findImageAsset(
  sections: { productionAssets?: ImageStudioAsset[] },
  assetId: string,
): ImageStudioAsset | undefined {
  return findStudioAsset(sections, assetId);
}
