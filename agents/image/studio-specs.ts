import type {
  ImageOutputCategory,
  ImageStudioAssetType,
} from "./studio-schema";

export interface StudioAssetSpec {
  id: string;
  assetType: ImageStudioAssetType;
  outputCategory: ImageOutputCategory;
  title: string;
  platform: string;
  dimensions: string;
  priority: "hero" | "core" | "support";
}

/** Minimum production brief — Milaene Creative Studio V3. */
export const STUDIO_ASSET_SPECS: StudioAssetSpec[] = [
  {
    id: "prod-studio-hero",
    assetType: "studio_shot",
    outputCategory: "product_photography",
    title: "Hero Studio Shot",
    platform: "ecommerce",
    dimensions: "2048x2048",
    priority: "hero",
  },
  {
    id: "prod-studio-alt",
    assetType: "studio_shot",
    outputCategory: "product_photography",
    title: "Alternate Studio Angle",
    platform: "ecommerce",
    dimensions: "2048x2048",
    priority: "core",
  },
  {
    id: "prod-ecom-front",
    assetType: "ecommerce_image",
    outputCategory: "product_photography",
    title: "E-commerce Front View",
    platform: "shopify",
    dimensions: "2048x2048",
    priority: "hero",
  },
  {
    id: "prod-ecom-back",
    assetType: "ecommerce_image",
    outputCategory: "product_photography",
    title: "E-commerce Back View",
    platform: "shopify",
    dimensions: "2048x2048",
    priority: "core",
  },
  {
    id: "prod-detail-fabric",
    assetType: "detail_shot",
    outputCategory: "product_photography",
    title: "Fabric Detail",
    platform: "product",
    dimensions: "1536x1536",
    priority: "core",
  },
  {
    id: "prod-detail-hardware",
    assetType: "detail_shot",
    outputCategory: "product_photography",
    title: "Construction Detail",
    platform: "product",
    dimensions: "1536x1536",
    priority: "support",
  },
  {
    id: "edit-street-hero",
    assetType: "editorial_streetwear",
    outputCategory: "editorial_campaign",
    title: "Streetwear Editorial Hero",
    platform: "campaign",
    dimensions: "1920x2400",
    priority: "hero",
  },
  {
    id: "edit-street-env",
    assetType: "editorial_streetwear",
    outputCategory: "editorial_campaign",
    title: "Urban Environment Editorial",
    platform: "campaign",
    dimensions: "1920x2400",
    priority: "core",
  },
  {
    id: "edit-luxury-hero",
    assetType: "editorial_luxury",
    outputCategory: "editorial_campaign",
    title: "Luxury Editorial Hero",
    platform: "campaign",
    dimensions: "1920x2400",
    priority: "hero",
  },
  {
    id: "edit-luxury-portrait",
    assetType: "editorial_luxury",
    outputCategory: "editorial_campaign",
    title: "Luxury Portrait Editorial",
    platform: "campaign",
    dimensions: "1920x2400",
    priority: "core",
  },
  {
    id: "social-ig-post-1",
    assetType: "instagram_post",
    outputCategory: "social_media",
    title: "Instagram Feed Post",
    platform: "instagram",
    dimensions: "1080x1350",
    priority: "core",
  },
  {
    id: "social-ig-post-2",
    assetType: "instagram_post",
    outputCategory: "social_media",
    title: "Instagram Product Focus",
    platform: "instagram",
    dimensions: "1080x1350",
    priority: "core",
  },
  {
    id: "social-story-1",
    assetType: "story_slide",
    outputCategory: "social_media",
    title: "Story Slide — Reveal",
    platform: "instagram_stories",
    dimensions: "1080x1920",
    priority: "core",
  },
  {
    id: "social-story-2",
    assetType: "story_slide",
    outputCategory: "social_media",
    title: "Story Slide — Drop Countdown",
    platform: "instagram_stories",
    dimensions: "1080x1920",
    priority: "support",
  },
  {
    id: "social-carousel",
    assetType: "carousel_image",
    outputCategory: "social_media",
    title: "Carousel Slide",
    platform: "instagram",
    dimensions: "1080x1350",
    priority: "core",
  },
  {
    id: "social-tiktok-cover",
    assetType: "tiktok_cover",
    outputCategory: "social_media",
    title: "TikTok Cover",
    platform: "tiktok",
    dimensions: "1080x1920",
    priority: "core",
  },
  {
    id: "lookbook-outfit-1",
    assetType: "lookbook_outfit",
    outputCategory: "lookbook",
    title: "Lookbook Outfit I",
    platform: "lookbook",
    dimensions: "1920x2400",
    priority: "hero",
  },
  {
    id: "lookbook-outfit-2",
    assetType: "lookbook_outfit",
    outputCategory: "lookbook",
    title: "Lookbook Outfit II",
    platform: "lookbook",
    dimensions: "1920x2400",
    priority: "core",
  },
  {
    id: "lookbook-outfit-3",
    assetType: "lookbook_outfit",
    outputCategory: "lookbook",
    title: "Lookbook Outfit III",
    platform: "lookbook",
    dimensions: "1920x2400",
    priority: "core",
  },
  {
    id: "lookbook-outfit-4",
    assetType: "lookbook_outfit",
    outputCategory: "lookbook",
    title: "Lookbook Outfit IV",
    platform: "lookbook",
    dimensions: "1920x2400",
    priority: "support",
  },
  {
    id: "launch-collection-cover",
    assetType: "collection_cover",
    outputCategory: "launch_assets",
    title: "Collection Cover",
    platform: "website",
    dimensions: "2400x1600",
    priority: "hero",
  },
  {
    id: "launch-hero",
    assetType: "hero_image",
    outputCategory: "launch_assets",
    title: "Launch Hero Image",
    platform: "website",
    dimensions: "1920x1080",
    priority: "hero",
  },
  {
    id: "launch-banner",
    assetType: "launch_banner",
    outputCategory: "launch_assets",
    title: "Launch Banner",
    platform: "website",
    dimensions: "1920x800",
    priority: "core",
  },
];

export const STUDIO_SPECS_BY_CATEGORY = STUDIO_ASSET_SPECS.reduce<
  Record<ImageOutputCategory, StudioAssetSpec[]>
>(
  (acc, spec) => {
    (acc[spec.outputCategory] ??= []).push(spec);
    return acc;
  },
  {
    product_photography: [],
    editorial_campaign: [],
    social_media: [],
    lookbook: [],
    launch_assets: [],
  },
);
