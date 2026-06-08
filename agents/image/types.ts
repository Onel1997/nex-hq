import { IMAGE_REPORT_TYPE } from "@/brain/domains/reports";
import { z } from "zod";

export const IMAGE_REPORT_TYPE_VALUE = IMAGE_REPORT_TYPE;

export const IMAGE_ASSET_TYPES = [
  "moodboard",
  "hoodie_mockup",
  "tshirt_mockup",
  "cargo_mockup",
  "campaign_visual",
  "landing_page_hero",
  "instagram_post",
  "instagram_story",
  "tiktok_cover",
  "email_banner",
  "lookbook_page",
] as const;

export type ImageAssetType = (typeof IMAGE_ASSET_TYPES)[number];

const detailedString = (min: number) => z.string().min(min);

export const imageAssetSchema = z.object({
  assetName: z.string().min(1),
  assetType: z.enum(IMAGE_ASSET_TYPES),
  purpose: z.string().min(15),
  platform: z.string().min(2),
  prompt: detailedString(50),
  dimensions: z.string().min(3),
  styleNotes: z.string().min(15),
});

export const imageOutputSchema = z.object({
  title: z.string().min(1),
  reportType: z.literal(IMAGE_REPORT_TYPE),
  projectName: z.string().min(1),
  visualDirection: detailedString(100),
  collectionStory: detailedString(80),
  moodboard: detailedString(80),
  campaignConcept: detailedString(80),
  assets: z.array(imageAssetSchema).min(8).max(48),
  confidence: z.number().min(0).max(1),
  sourceReportTitles: z.array(z.string()).min(1),
  fullProject: detailedString(800),
});

export type ImageAsset = z.infer<typeof imageAssetSchema>;
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
  visualDirection: string;
  collectionStory: string;
  moodboard: string;
  campaignConcept: string;
  assets: ImageAsset[];
  confidence: number;
  sourceReportTitles: string[];
  contextRecordCount: number;
}
