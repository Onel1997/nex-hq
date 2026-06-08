import type { NormalizedImageAsset } from "./normalized";

export interface ImageAssetSpec {
  id: string;
  type: NormalizedImageAsset["type"];
  title: string;
  dimensions: string;
  platform: string;
  variant?: string;
}

/** Core production package — exactly one asset per spec, no duplicates. */
export const CORE_ASSET_SPECS: ImageAssetSpec[] = [
  {
    id: "core-hero-banner",
    type: "hero_banner",
    title: "Hero Banner",
    dimensions: "1920x1080",
    platform: "website",
  },
  {
    id: "core-mockup-hero_product",
    type: "product_mockup",
    title: "Product Mockup",
    dimensions: "1536x2048",
    platform: "product",
    variant: "hero_product",
  },
  {
    id: "core-mockup-flat_lay",
    type: "product_mockup",
    title: "Flat Lay",
    dimensions: "2048x2048",
    platform: "product",
    variant: "flat_lay",
  },
  {
    id: "core-mockup-lifestyle",
    type: "product_mockup",
    title: "Lifestyle Mockup",
    dimensions: "1536x2048",
    platform: "product",
    variant: "lifestyle",
  },
  {
    id: "core-campaign-key-visual",
    type: "campaign_key_visual",
    title: "Campaign Key Visual",
    dimensions: "1920x1080",
    platform: "campaign",
  },
  {
    id: "core-instagram-carousel",
    type: "instagram_carousel",
    title: "Instagram Carousel",
    dimensions: "1080x1350",
    platform: "instagram",
  },
  {
    id: "core-reels-concept",
    type: "reels_concept",
    title: "Reels Concept",
    dimensions: "1080x1920",
    platform: "instagram_reels",
  },
  {
    id: "core-tiktok-concept",
    type: "tiktok_concept",
    title: "TikTok Concept",
    dimensions: "1080x1920",
    platform: "tiktok",
  },
];

/** Advanced production package — extends the same collection, no second campaign. */
export const ADVANCED_ASSET_SPECS: ImageAssetSpec[] = [
  {
    id: "advanced-landing-hero",
    type: "landing_section",
    title: "Landing Hero",
    dimensions: "1920x1080",
    platform: "website",
    variant: "hero",
  },
  {
    id: "advanced-landing-product-grid",
    type: "landing_section",
    title: "Landing Product Grid",
    dimensions: "1600x900",
    platform: "website",
    variant: "product_grid",
  },
  {
    id: "advanced-instagram-grid",
    type: "instagram_grid",
    title: "Instagram Grid",
    dimensions: "1080x1080",
    platform: "instagram",
    variant: "lifestyle_scene",
  },
  {
    id: "advanced-campaign-social",
    type: "campaign_visual",
    title: "Paid Social Visual",
    dimensions: "1080x1080",
    platform: "paid_social",
    variant: "social_creative",
  },
  {
    id: "advanced-launch-teaser",
    type: "launch_teaser",
    title: "Launch Teaser",
    dimensions: "1080x1350",
    platform: "instagram",
    variant: "launch_teaser",
  },
];

export const CORE_SPEC_IDS = new Set(CORE_ASSET_SPECS.map((s) => s.id));
export const ADVANCED_SPEC_IDS = new Set(ADVANCED_ASSET_SPECS.map((s) => s.id));

export function findAssetSpec(id: string): ImageAssetSpec | undefined {
  return (
    CORE_ASSET_SPECS.find((s) => s.id === id) ??
    ADVANCED_ASSET_SPECS.find((s) => s.id === id)
  );
}

export function assetDedupKey(asset: Pick<NormalizedImageAsset, "type" | "variant">): string {
  if (asset.variant) return `${asset.type}:${asset.variant}`;
  return asset.type;
}
