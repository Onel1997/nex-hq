import { z } from "zod";
import { IMAGE_PROJECT_TYPE } from "@/brain/domains/reports";

export const IMAGE_SCHEMA_VERSION = "2.0" as const;

export const IMAGE_ASSET_PACKAGES = ["core", "advanced"] as const;
export type ImageAssetPackage = (typeof IMAGE_ASSET_PACKAGES)[number];

export const IMAGE_ASSET_STATUSES = [
  "ready",
  "generating",
  "completed",
  "failed",
] as const;
export type ImageAssetStatus = (typeof IMAGE_ASSET_STATUSES)[number];

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

export const CORE_ASSET_TYPES: ImageAssetType[] = [
  "hero_banner",
  "product_mockup",
  "campaign_key_visual",
  "instagram_carousel",
  "reels_concept",
  "tiktok_concept",
];

export const ADVANCED_ASSET_TYPES: ImageAssetType[] = [
  "landing_section",
  "instagram_grid",
  "campaign_visual",
  "social_concept",
  "extra_mockup",
  "community_concept",
  "launch_teaser",
  "email_asset",
];

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

export const normalizedImageAssetSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  type: z.enum(IMAGE_ASSET_TYPES),
  package: z.enum(IMAGE_ASSET_PACKAGES),
  dimensions: z.string().min(3),
  platform: z.string().optional(),
  purpose: z.string().optional(),
  variant: z.string().optional(),
  prompt: imageAiPromptsSchema,
  provider: z
    .enum(["openai", "flux", "replicate", "midjourney"])
    .optional(),
  status: z.enum(IMAGE_ASSET_STATUSES).default("ready"),
  imageUrl: z.string().url().optional(),
  storagePath: z.string().optional(),
  createdAt: z.string().optional(),
  message: z.string().optional(),
});

export const imageCampaignShotSchema = z.object({
  shotName: z.string().min(1),
  shotType: z.string().min(2),
  location: detailedString(10),
  styling: detailedString(20),
  purpose: detailedString(20),
});

export const imageOutputSchema = z.object({
  title: z.string().min(1),
  reportType: z.literal(IMAGE_PROJECT_TYPE),
  schemaVersion: z.literal(IMAGE_SCHEMA_VERSION).default(IMAGE_SCHEMA_VERSION),
  projectName: z.string().min(1),
  moodboard: imageMoodboardSchema,
  palette: imagePaletteSchema,
  corePackage: z.array(normalizedImageAssetSchema).min(7).max(16),
  advancedPackage: z.array(normalizedImageAssetSchema).max(32),
  campaignShots: z.array(imageCampaignShotSchema).min(12).max(24),
  confidence: z.number().min(0).max(1),
  sourceReportTitles: z.array(z.string()).min(1),
  fullProject: detailedString(600),
});

export type ImageAiPrompts = z.infer<typeof imageAiPromptsSchema>;
export type ImageMoodboardSection = z.infer<typeof imageMoodboardSchema>;
export type ImagePalette = z.infer<typeof imagePaletteSchema>;
export type NormalizedImageAsset = z.infer<typeof normalizedImageAssetSchema>;
export type ImageCampaignShot = z.infer<typeof imageCampaignShotSchema>;
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
  schemaVersion: typeof IMAGE_SCHEMA_VERSION;
  moodboard: ImageMoodboardSection;
  palette: ImagePalette;
  corePackage: NormalizedImageAsset[];
  advancedPackage: NormalizedImageAsset[];
  campaignShots: ImageCampaignShot[];
  confidence: number;
  sourceReportTitles: string[];
  contextRecordCount: number;
  primaryReportCounts: Record<
    "ceo-report" | "design-report" | "content-report" | "marketing-report",
    number
  >;
}

export function countImageAssets(
  core: NormalizedImageAsset[],
  advanced: NormalizedImageAsset[],
): number {
  return core.length + advanced.length;
}

export function findImageAsset<
  T extends { id: string; prompt: ImageAiPrompts; dimensions: string; title: string; type: string },
>(
  sections: {
    corePackage?: T[];
    advancedPackage?: T[];
  },
  assetId: string,
): T | undefined {
  return [...(sections.corePackage ?? []), ...(sections.advancedPackage ?? [])].find(
    (asset) => asset.id === assetId,
  );
}
