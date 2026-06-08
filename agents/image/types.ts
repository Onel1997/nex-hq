import { IMAGE_PROJECT_TYPE } from "@/brain/domains/reports";
import { z } from "zod";

export const IMAGE_PROJECT_TYPE_VALUE = IMAGE_PROJECT_TYPE;

export const IMAGE_PRODUCTION_PRIORITIES = ["high", "medium", "low"] as const;
export type ImageProductionPriority =
  (typeof IMAGE_PRODUCTION_PRIORITIES)[number];

export const PRODUCT_MOCKUP_TYPES = [
  "hero_product",
  "flat_lay",
  "studio",
  "lifestyle",
] as const;

export const CAMPAIGN_VISUAL_TYPES = [
  "launch_campaign",
  "social_creative",
  "instagram_carousel",
  "ad_concept",
] as const;

export const LANDING_ASSET_TYPES = [
  "hero_banner",
  "collection_header",
  "product_section",
] as const;

const detailedString = (min: number) => z.string().min(min);
const keywordList = (min: number, max: number) =>
  z.array(z.string().min(2)).min(min).max(max);

export const imageAiPromptsSchema = z.object({
  midjourney: detailedString(40),
  openai: detailedString(40),
  flux: detailedString(40),
});

export const imageMoodboardSchema = z.object({
  visualDirection: detailedString(80),
  aestheticKeywords: keywordList(3, 20),
  colorSystem: keywordList(2, 12),
  materialReferences: keywordList(2, 12),
  photographyStyle: detailedString(40),
});

export const imageProductMockupSchema = z.object({
  name: z.string().min(1),
  conceptType: z.enum(PRODUCT_MOCKUP_TYPES),
  description: detailedString(40),
  prompts: imageAiPromptsSchema,
  dimensions: z.string().min(3),
});

export const imageCampaignVisualSchema = z.object({
  name: z.string().min(1),
  conceptType: z.enum(CAMPAIGN_VISUAL_TYPES),
  description: detailedString(40),
  platform: z.string().min(2),
  prompts: imageAiPromptsSchema,
  dimensions: z.string().min(3),
});

export const imageLandingPageAssetSchema = z.object({
  name: z.string().min(1),
  conceptType: z.enum(LANDING_ASSET_TYPES),
  description: detailedString(40),
  prompts: imageAiPromptsSchema,
  dimensions: z.string().min(3),
});

export const imageProductionChecklistSchema = z.object({
  assetName: z.string().min(1),
  priority: z.enum(IMAGE_PRODUCTION_PRIORITIES),
  platform: z.string().min(2),
  purpose: detailedString(15),
});

export const imageOutputSchema = z.object({
  title: z.string().min(1),
  reportType: z.literal(IMAGE_PROJECT_TYPE),
  projectName: z.string().min(1),
  moodboard: imageMoodboardSchema,
  productMockups: z.array(imageProductMockupSchema).min(4).max(20),
  campaignVisuals: z.array(imageCampaignVisualSchema).min(4).max(20),
  landingPageAssets: z.array(imageLandingPageAssetSchema).min(3).max(12),
  productionChecklist: z.array(imageProductionChecklistSchema).min(8).max(48),
  confidence: z.number().min(0).max(1),
  sourceReportTitles: z.array(z.string()).min(1),
  fullProject: detailedString(800),
});

export type ImageAiPrompts = z.infer<typeof imageAiPromptsSchema>;
export type ImageMoodboardSection = z.infer<typeof imageMoodboardSchema>;
export type ImageProductMockup = z.infer<typeof imageProductMockupSchema>;
export type ImageCampaignVisual = z.infer<typeof imageCampaignVisualSchema>;
export type ImageLandingPageAsset = z.infer<typeof imageLandingPageAssetSchema>;
export type ImageProductionChecklistItem = z.infer<
  typeof imageProductionChecklistSchema
>;
export type ImageOutput = z.infer<typeof imageOutputSchema>;

export interface ImageRunInput {
  brief: string;
  workspaceId: string;
  workspaceName: string;
}

export interface ImageRunResult {
  reportId: string;
  reportRecordId: string;
  title: string;
  projectName: string;
  moodboard: ImageMoodboardSection;
  productMockups: ImageProductMockup[];
  campaignVisuals: ImageCampaignVisual[];
  landingPageAssets: ImageLandingPageAsset[];
  productionChecklist: ImageProductionChecklistItem[];
  confidence: number;
  sourceReportTitles: string[];
  contextRecordCount: number;
  primaryReportCounts: Record<
    "ceo-report" | "design-report" | "content-report" | "marketing-report",
    number
  >;
}
