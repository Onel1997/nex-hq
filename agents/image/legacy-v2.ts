import { z } from "zod";

/** @deprecated Image Agent V2 — kept for legacy migration and enrich-packages. */
export const IMAGE_SCHEMA_VERSION_V2 = "2.0" as const;

export const IMAGE_ASSET_PACKAGES = ["core", "advanced"] as const;
export type ImageAssetPackage = (typeof IMAGE_ASSET_PACKAGES)[number];

export const IMAGE_ASSET_STATUSES_V2 = [
  "ready",
  "generating",
  "completed",
  "failed",
] as const;

export const IMAGE_ASSET_TYPES_V2 = [
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
export type LegacyImageAssetType = (typeof IMAGE_ASSET_TYPES_V2)[number];

const detailedString = (min: number) => z.string().min(min);

export const legacyImageAiPromptsSchema = z.object({
  midjourney: detailedString(80),
  openai: detailedString(80),
  flux: detailedString(80),
});

export const legacyNormalizedImageAssetSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  type: z.enum(IMAGE_ASSET_TYPES_V2),
  package: z.enum(IMAGE_ASSET_PACKAGES),
  dimensions: z.string().min(3),
  platform: z.string().optional(),
  purpose: z.string().optional(),
  variant: z.string().optional(),
  prompt: legacyImageAiPromptsSchema,
  provider: z
    .enum(["openai", "flux", "replicate", "midjourney"])
    .optional(),
  status: z.enum(IMAGE_ASSET_STATUSES_V2).default("ready"),
  imageUrl: z.string().url().optional(),
  storagePath: z.string().optional(),
  createdAt: z.string().optional(),
  message: z.string().optional(),
});

export const legacyImageCampaignShotSchema = z.object({
  shotName: z.string().min(1),
  shotType: z.string().min(2),
  location: detailedString(10),
  styling: detailedString(20),
  purpose: detailedString(20),
});

export type LegacyNormalizedImageAsset = z.infer<
  typeof legacyNormalizedImageAssetSchema
>;
export type LegacyImageCampaignShot = z.infer<
  typeof legacyImageCampaignShotSchema
>;

export const CORE_ASSET_TYPES: LegacyImageAssetType[] = [
  "hero_banner",
  "product_mockup",
  "campaign_key_visual",
  "instagram_carousel",
  "reels_concept",
  "tiktok_concept",
];

export const ADVANCED_ASSET_TYPES: LegacyImageAssetType[] = [
  "landing_section",
  "instagram_grid",
  "campaign_visual",
  "social_concept",
  "extra_mockup",
  "community_concept",
  "launch_teaser",
  "email_asset",
];
