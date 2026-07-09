import type { BrainImageSections } from "@/brain/domains/reports";
import { buildArtDirectionPrompt } from "./art-direction";
import { normalizeStudioSections } from "./enrich-studio";
import {
  type LegacyImageCampaignShot,
  type LegacyNormalizedImageAsset,
  IMAGE_SCHEMA_VERSION_V2,
} from "./legacy-v2";
import type { ImageMoodboardSection, ImagePalette } from "./studio-schema";

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function normalizePrompts(
  value: unknown,
  collectionName: string,
  subject: string,
): LegacyNormalizedImageAsset["prompt"] {
  const obj = asRecord(value);
  if (!obj?.midjourney && !obj?.openai && !obj?.flux) {
    const single = asString(obj?.prompt) || asString(obj?.openaiPrompt);
    if (single.length >= 40) {
      return {
        midjourney: single,
        openai: single,
        flux: single,
      };
    }
    return buildArtDirectionPrompt({ subject, collectionName });
  }
  return {
    midjourney: asString(obj.midjourney) || asString(obj.midjourneyPrompt),
    openai: asString(obj.openai) || asString(obj.openaiPrompt),
    flux: asString(obj.flux) || asString(obj.fluxPrompt),
  };
}

function mergeGeneratedState(
  asset: LegacyNormalizedImageAsset,
  generated?: BrainImageSections["generatedAssets"],
): LegacyNormalizedImageAsset {
  if (!generated?.length) return asset;
  const legacyKeyPrefix = asset.id;
  const hit = generated.find(
    (item) =>
      item.assetKey === legacyKeyPrefix ||
      item.assetKey.startsWith(`${legacyKeyPrefix}:`) ||
      item.assetName === asset.title,
  );
  if (!hit) return asset;
  return {
    ...asset,
    status: hit.status === "completed" ? "completed" : hit.status === "failed" ? "failed" : hit.status === "generating" ? "generating" : asset.status,
    imageUrl: hit.url ?? asset.imageUrl,
    storagePath: hit.storagePath ?? asset.storagePath,
    provider: hit.provider,
    createdAt: hit.createdAt ?? asset.createdAt,
    message: hit.message,
  };
}

export function isV2ImageSections(
  sections: BrainImageSections | Record<string, unknown>,
): boolean {
  const record = sections as Record<string, unknown>;
  return (
    record.schemaVersion === IMAGE_SCHEMA_VERSION_V2 ||
    (Array.isArray(record.corePackage) &&
      (record.corePackage as unknown[]).length > 0 &&
      !Array.isArray(record.productionAssets))
  );
}

export function migrateLegacyImageSections(
  raw: BrainImageSections,
  collectionName = raw.projectName,
): BrainImageSections {
  if (isV2ImageSections(raw)) {
    return {
      ...raw,
      schemaVersion: IMAGE_SCHEMA_VERSION_V2,
      corePackage: raw.corePackage ?? [],
      advancedPackage: raw.advancedPackage ?? [],
    };
  }

  const core: LegacyNormalizedImageAsset[] = [];
  const advanced: LegacyNormalizedImageAsset[] = [];
  const generated = raw.generatedAssets;

  const hero = raw.heroBanner;
  if (hero) {
    core.push(
      mergeGeneratedState(
        {
          id: "core-hero-banner",
          title: asString(hero.headline) || "Hero Banner",
          type: "hero_banner",
          package: "core",
          dimensions: "1920x1080",
          platform: "website",
          purpose: asString(hero.subheadline),
          prompt: {
            midjourney: asString(hero.midjourneyPrompt),
            openai: asString(hero.openaiPrompt),
            flux: asString(hero.fluxPrompt),
          },
          status: "ready",
        },
        generated,
      ),
    );
  }

  for (const [index, mockup] of asArray(raw.productMockups).entries()) {
    const obj = asRecord(mockup);
    if (!obj) continue;
    const conceptType = asString(obj.conceptType) || `mockup_${index}`;
    core.push(
      mergeGeneratedState(
        {
          id: `core-mockup-${conceptType}`,
          title: asString(obj.name) || `Product Mockup ${index + 1}`,
          type: "product_mockup",
          package: "core",
          variant: conceptType,
          dimensions: asString(obj.dimensions) || "1536x2048",
          platform: "product",
          purpose: asString(obj.description),
          prompt: normalizePrompts(
            obj.prompts,
            collectionName,
            asString(obj.name) || "product mockup",
          ),
          status: "ready",
        },
        generated,
      ),
    );
  }

  const campaignKey =
    asArray(raw.campaignVisuals).find((item) => {
      const obj = asRecord(item);
      return (
        asString(obj?.conceptType) === "launch_campaign" ||
        asString(obj?.name).toLowerCase().includes("key")
      );
    }) ?? asArray(raw.campaignVisuals)[0];

  if (campaignKey) {
    const obj = asRecord(campaignKey);
    if (obj) {
      core.push(
        mergeGeneratedState(
          {
            id: "core-campaign-key-visual",
            title: asString(obj.name) || "Campaign Key Visual",
            type: "campaign_key_visual",
            package: "core",
            dimensions: asString(obj.dimensions) || "1920x1080",
            platform: asString(obj.platform) || "campaign",
            purpose: asString(obj.description),
            prompt: normalizePrompts(
              obj.prompts,
              collectionName,
              "campaign key visual",
            ),
            status: "ready",
          },
          generated,
        ),
      );
    }
  }

  const carousel =
    asArray(raw.campaignVisuals).find(
      (item) => asString(asRecord(item)?.conceptType) === "instagram_carousel",
    ) ?? asArray(raw.instagramGrid)[0];

  if (carousel) {
    const obj = asRecord(carousel);
    if (obj) {
      core.push(
        mergeGeneratedState(
          {
            id: "core-instagram-carousel",
            title: asString(obj.name) || "Instagram Carousel",
            type: "instagram_carousel",
            package: "core",
            dimensions: asString(obj.dimensions) || "1080x1350",
            platform: "instagram",
            purpose: asString(obj.description),
            prompt: normalizePrompts(obj.prompts ?? obj, collectionName, "instagram carousel"),
            status: "ready",
          },
          generated,
        ),
      );
    }
  }

  const reel = asArray(raw.reelsConcepts)[0];
  if (reel) {
    const obj = asRecord(reel);
    if (obj) {
      core.push(
        mergeGeneratedState(
          {
            id: "core-reels-concept",
            title: asString(obj.name) || "Reels Concept",
            type: "reels_concept",
            package: "core",
            dimensions: "1080x1920",
            platform: "instagram_reels",
            purpose: asString(obj.description),
            prompt: normalizePrompts(obj.prompts, collectionName, "reels concept"),
            status: "ready",
          },
          generated,
        ),
      );
    }
  }

  const tiktok = asArray(raw.tiktokConcepts)[0];
  if (tiktok) {
    const obj = asRecord(tiktok);
    if (obj) {
      core.push(
        mergeGeneratedState(
          {
            id: "core-tiktok-concept",
            title: asString(obj.name) || "TikTok Concept",
            type: "tiktok_concept",
            package: "core",
            dimensions: "1080x1920",
            platform: "tiktok",
            purpose: asString(obj.description),
            prompt: normalizePrompts(obj.prompts, collectionName, "tiktok concept"),
            status: "ready",
          },
          generated,
        ),
      );
    }
  }

  for (const [index, section] of asArray(raw.landingAssets).entries()) {
    const obj = asRecord(section);
    if (!obj) continue;
    advanced.push({
      id: `advanced-landing-${asString(obj.sectionType) || index}`,
      title: asString(obj.sectionTitle) || `Landing Section ${index + 1}`,
      type: "landing_section",
      package: "advanced",
      variant: asString(obj.sectionType),
      dimensions: "1920x1080",
      platform: "website",
      purpose: asString(obj.purpose),
      prompt: buildArtDirectionPrompt({
        subject: asString(obj.visualDirection) || asString(obj.sectionTitle),
        collectionName,
      }),
      status: "ready",
    });
  }

  for (const [index, item] of asArray(raw.landingPageAssets).entries()) {
    const obj = asRecord(item);
    if (!obj) continue;
    if (asString(obj.conceptType) === "hero_banner") continue;
    advanced.push({
      id: `advanced-landing-page-${asString(obj.conceptType) || index}`,
      title: asString(obj.name) || `Landing Asset ${index + 1}`,
      type: "landing_section",
      package: "advanced",
      variant: asString(obj.conceptType),
      dimensions: asString(obj.dimensions) || "1920x1080",
      platform: "website",
      purpose: asString(obj.description),
      prompt: normalizePrompts(obj.prompts, collectionName, asString(obj.name)),
      status: "ready",
    });
  }

  for (const [index, item] of asArray(raw.instagramGrid).entries()) {
    const obj = asRecord(item);
    if (!obj || index === 0) continue;
    advanced.push({
      id: `advanced-instagram-grid-${asString(obj.conceptType) || index}`,
      title: asString(obj.name) || `Instagram Grid ${index + 1}`,
      type: "instagram_grid",
      package: "advanced",
      variant: asString(obj.conceptType),
      dimensions: "1080x1080",
      platform: "instagram",
      purpose: asString(obj.description),
      prompt: normalizePrompts(obj.prompts, collectionName, asString(obj.name)),
      status: "ready",
    });
  }

  for (const [index, item] of asArray(raw.campaignVisuals).entries()) {
    const obj = asRecord(item);
    if (!obj) continue;
    const conceptType = asString(obj.conceptType);
    if (
      conceptType === "launch_campaign" ||
      conceptType === "instagram_carousel"
    ) {
      continue;
    }
    advanced.push({
      id: `advanced-campaign-${conceptType || index}`,
      title: asString(obj.name) || `Campaign Visual ${index + 1}`,
      type: "campaign_visual",
      package: "advanced",
      variant: conceptType,
      dimensions: asString(obj.dimensions) || "1200x628",
      platform: asString(obj.platform) || "paid_social",
      purpose: asString(obj.description),
      prompt: normalizePrompts(obj.prompts, collectionName, asString(obj.name)),
      status: "ready",
    });
  }

  for (const [index, item] of asArray(raw.reelsConcepts).entries()) {
    if (index === 0) continue;
    const obj = asRecord(item);
    if (!obj) continue;
    advanced.push({
      id: `advanced-reels-${asString(obj.conceptType) || index}`,
      title: asString(obj.name) || `Reels Concept ${index + 1}`,
      type: "social_concept",
      package: "advanced",
      variant: asString(obj.conceptType),
      dimensions: "1080x1920",
      platform: "instagram_reels",
      purpose: asString(obj.description),
      prompt: normalizePrompts(obj.prompts, collectionName, asString(obj.name)),
      status: "ready",
    });
  }

  for (const [index, item] of asArray(raw.tiktokConcepts).entries()) {
    if (index === 0) continue;
    const obj = asRecord(item);
    if (!obj) continue;
    advanced.push({
      id: `advanced-tiktok-${asString(obj.conceptType) || index}`,
      title: asString(obj.name) || `TikTok Concept ${index + 1}`,
      type: "social_concept",
      package: "advanced",
      variant: asString(obj.conceptType),
      dimensions: "1080x1920",
      platform: "tiktok",
      purpose: asString(obj.description),
      prompt: normalizePrompts(obj.prompts, collectionName, asString(obj.name)),
      status: "ready",
    });
  }

  const campaignShots: LegacyImageCampaignShot[] = asArray(raw.campaignShots)
    .map((item) => {
      const obj = asRecord(item);
      if (!obj) return null;
      return {
        shotName: asString(obj.shotName) || "Shot",
        shotType: asString(obj.shotType) || "editorial",
        location: asString(obj.location) || "Urban location",
        styling: asString(obj.styling) || "Streetwear styling",
        purpose: asString(obj.purpose) || "Campaign production",
      };
    })
    .filter((item): item is LegacyImageCampaignShot => Boolean(item));

  return {
    schemaVersion: IMAGE_SCHEMA_VERSION_V2,
    projectName: raw.projectName,
    moodboard: raw.moodboard,
    palette: raw.palette,
    corePackage: core,
    advancedPackage: advanced,
    campaignShots,
    sourceReportTitles: raw.sourceReportTitles,
    generatedAssets: raw.generatedAssets,
    productionChecklist: raw.productionChecklist,
  };
}

export function normalizeImageSections(
  sections: BrainImageSections | undefined,
): BrainImageSections | undefined {
  if (!sections) return undefined;

  if (sections.productionAssets?.length) {
    return sections;
  }

  const normalized = normalizeStudioSections(
    sections as unknown as Record<string, unknown>,
    sections.collectionName ?? sections.projectName,
  );

  if (normalized) {
    return normalized as unknown as BrainImageSections;
  }

  return migrateLegacyImageSections(sections, sections.projectName);
}
