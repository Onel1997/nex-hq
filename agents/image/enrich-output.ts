import { IMAGE_PROJECT_TYPE } from "@/brain/domains/reports";
import {
  CAMPAIGN_VISUAL_TYPES,
  LANDING_ASSET_TYPES,
  PRODUCT_MOCKUP_TYPES,
  type ImageAiPrompts,
  type ImageCampaignVisual,
  type ImageLandingPageAsset,
  type ImageMoodboardSection,
  type ImageProductMockup,
  type ImageProductionChecklistItem,
} from "./types";

const MIN_FULL_PROJECT = 800;
const MIN_PROMPT = 40;

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value === "string" && value.trim()) {
    return value
      .split(/\n|,|;/)
      .map((item) => item.replace(/^[-*•]\s*/, "").trim())
      .filter(Boolean);
  }
  return [];
}

function ensureMinLength(text: string, min: number, suffix: string): string {
  let result = text.trim() || suffix.trim();
  while (result.length < min) {
    result = `${result} ${suffix}`.trim();
  }
  return result;
}

function defaultPrompts(seed: string, subject: string): ImageAiPrompts {
  const base =
    `${subject} for ${seed}. Urban luxury streetwear, Milaene aesthetic, ` +
    "premium lighting, minimal composition, photorealistic, derived from CEO, design, content and marketing intelligence.";
  return {
    midjourney: ensureMinLength(
      `${base} --ar 4:5 --style raw --v 6`,
      MIN_PROMPT,
      "Midjourney prompt from Brain intelligence.",
    ),
    openai: ensureMinLength(
      `Photorealistic ${subject} for ${seed}. Premium streetwear brand Milaene, obsidian and concrete palette, signal green accent.`,
      MIN_PROMPT,
      "OpenAI image prompt from design and content reports.",
    ),
    flux: ensureMinLength(
      `${subject}, ${seed} collection, urban luxury streetwear editorial, high-end fashion photography, 8k detail`,
      MIN_PROMPT,
      "Flux prompt from marketing and design intelligence.",
    ),
  };
}

function normalizePrompts(
  value: unknown,
  seed: string,
  subject: string,
): ImageAiPrompts {
  const obj = asRecord(value);
  if (!obj) return defaultPrompts(seed, subject);

  const legacyPrompt = asString(obj.prompt);
  const fallback = legacyPrompt || subject;

  return {
    midjourney: ensureMinLength(
      asString(obj.midjourney) || legacyPrompt,
      MIN_PROMPT,
      defaultPrompts(seed, fallback).midjourney,
    ),
    openai: ensureMinLength(
      asString(obj.openai) || legacyPrompt,
      MIN_PROMPT,
      defaultPrompts(seed, fallback).openai,
    ),
    flux: ensureMinLength(
      asString(obj.flux) || legacyPrompt,
      MIN_PROMPT,
      defaultPrompts(seed, fallback).flux,
    ),
  };
}

function defaultMoodboard(seed: string): ImageMoodboardSection {
  return {
    visualDirection: ensureMinLength(
      `Visual direction for ${seed}: Urban luxury streetwear integrating collection story, color palette from design report, brand narrative from content report, and launch strategy from marketing and CEO intelligence. Confident, minimal, premium — Milaene brand rules.`,
      80,
      "Creative direction from design and CEO reports.",
    ),
    aestheticKeywords: [
      "urban luxury",
      "minimal streetwear",
      "premium materials",
      "city culture",
      "scarcity drop",
    ],
    colorSystem: [
      "Obsidian Black #0A0A0A",
      "Concrete Grey #8A8A8A",
      "Signal Green accent",
      "Off-White #F5F5F0",
    ],
    materialReferences: [
      "Heavyweight organic cotton fleece",
      "Brushed cotton twill",
      "Matte hardware",
      "Structured cap wool blend",
    ],
    photographyStyle: ensureMinLength(
      "Editorial streetwear photography: natural urban light, shallow depth of field, confident model posture, concrete and glass environments, premium product focus, no stock aesthetic.",
      40,
      "Photography style from design report and brand rules.",
    ),
  };
}

function normalizeMoodboard(
  value: unknown,
  seed: string,
  legacy?: Record<string, unknown>,
): ImageMoodboardSection {
  const obj = asRecord(value);
  const defaults = defaultMoodboard(seed);

  const legacyDirection =
    asString(legacy?.visualDirection) || asString(legacy?.moodboard);

  return {
    visualDirection: ensureMinLength(
      asString(obj?.visualDirection) || legacyDirection,
      80,
      defaults.visualDirection,
    ),
    aestheticKeywords: (() => {
      const items = asStringArray(obj?.aestheticKeywords);
      return items.length >= 3 ? items.slice(0, 20) : defaults.aestheticKeywords;
    })(),
    colorSystem: (() => {
      const items = asStringArray(obj?.colorSystem);
      return items.length >= 2 ? items.slice(0, 12) : defaults.colorSystem;
    })(),
    materialReferences: (() => {
      const items = asStringArray(obj?.materialReferences);
      return items.length >= 2 ? items.slice(0, 12) : defaults.materialReferences;
    })(),
    photographyStyle: ensureMinLength(
      asString(obj?.photographyStyle),
      40,
      defaults.photographyStyle,
    ),
  };
}

const MOCKUP_LABELS: Record<(typeof PRODUCT_MOCKUP_TYPES)[number], string> = {
  hero_product: "Hero Product Mockup",
  flat_lay: "Flat Lay Concept",
  studio: "Studio Concept",
  lifestyle: "Lifestyle Concept",
};

const CAMPAIGN_LABELS: Record<(typeof CAMPAIGN_VISUAL_TYPES)[number], string> =
  {
    launch_campaign: "Launch Campaign Image",
    social_creative: "Social Media Creative",
    instagram_carousel: "Instagram Carousel Concept",
    ad_concept: "Ad Concept",
  };

const LANDING_LABELS: Record<(typeof LANDING_ASSET_TYPES)[number], string> = {
  hero_banner: "Hero Banner Concept",
  collection_header: "Collection Header Visual",
  product_section: "Product Section Visual",
};

const MOCKUP_DIMENSIONS: Record<(typeof PRODUCT_MOCKUP_TYPES)[number], string> =
  {
    hero_product: "1536x2048",
    flat_lay: "2048x2048",
    studio: "1920x1080",
    lifestyle: "1920x1080",
  };

const CAMPAIGN_DIMENSIONS: Record<
  (typeof CAMPAIGN_VISUAL_TYPES)[number],
  string
> = {
  launch_campaign: "1920x1080",
  social_creative: "1080x1080",
  instagram_carousel: "1080x1350",
  ad_concept: "1200x628",
};

const LANDING_DIMENSIONS: Record<
  (typeof LANDING_ASSET_TYPES)[number],
  string
> = {
  hero_banner: "1920x1080",
  collection_header: "1920x600",
  product_section: "1600x900",
};

function defaultMockup(
  conceptType: (typeof PRODUCT_MOCKUP_TYPES)[number],
  seed: string,
): ImageProductMockup {
  const label = MOCKUP_LABELS[conceptType];
  return {
    name: `${seed} — ${label}`,
    conceptType,
    description: ensureMinLength(
      `${label} for ${seed} derived from design hero products, color palette and content brand narrative.`,
      40,
      "Product mockup from design intelligence.",
    ),
    prompts: defaultPrompts(seed, label),
    dimensions: MOCKUP_DIMENSIONS[conceptType],
  };
}

function defaultCampaign(
  conceptType: (typeof CAMPAIGN_VISUAL_TYPES)[number],
  seed: string,
): ImageCampaignVisual {
  const label = CAMPAIGN_LABELS[conceptType];
  const platform =
    conceptType === "instagram_carousel"
      ? "instagram"
      : conceptType === "ad_concept"
        ? "paid_social"
        : conceptType === "launch_campaign"
          ? "campaign"
          : "social";

  return {
    name: `${seed} — ${label}`,
    conceptType,
    description: ensureMinLength(
      `${label} for ${seed} launch from marketing strategy, content social package and CEO launch priorities.`,
      40,
      "Campaign visual from marketing intelligence.",
    ),
    platform,
    prompts: defaultPrompts(seed, label),
    dimensions: CAMPAIGN_DIMENSIONS[conceptType],
  };
}

function defaultLanding(
  conceptType: (typeof LANDING_ASSET_TYPES)[number],
  seed: string,
): ImageLandingPageAsset {
  const label = LANDING_LABELS[conceptType];
  return {
    name: `${seed} — ${label}`,
    conceptType,
    description: ensureMinLength(
      `${label} for ${seed} storefront aligned with content landing page copy and design collection story.`,
      40,
      "Landing asset from content and design reports.",
    ),
    prompts: defaultPrompts(seed, label),
    dimensions: LANDING_DIMENSIONS[conceptType],
  };
}

function normalizeMockup(
  entry: unknown,
  index: number,
  seed: string,
): ImageProductMockup | null {
  const obj = asRecord(entry);
  if (!obj) return null;

  const rawType = asString(obj.conceptType);
  const conceptType = PRODUCT_MOCKUP_TYPES.includes(
    rawType as (typeof PRODUCT_MOCKUP_TYPES)[number],
  )
    ? (rawType as (typeof PRODUCT_MOCKUP_TYPES)[number])
    : PRODUCT_MOCKUP_TYPES[index % PRODUCT_MOCKUP_TYPES.length];

  const name =
    asString(obj.name) ||
    asString(obj.assetName) ||
    `${seed} — ${MOCKUP_LABELS[conceptType]}`;

  return {
    name,
    conceptType,
    description: ensureMinLength(
      asString(obj.description) || asString(obj.purpose),
      40,
      defaultMockup(conceptType, seed).description,
    ),
    prompts: normalizePrompts(obj.prompts ?? obj, seed, name),
    dimensions:
      asString(obj.dimensions) || MOCKUP_DIMENSIONS[conceptType],
  };
}

function normalizeCampaign(
  entry: unknown,
  index: number,
  seed: string,
): ImageCampaignVisual | null {
  const obj = asRecord(entry);
  if (!obj) return null;

  const rawType = asString(obj.conceptType);
  const conceptType = CAMPAIGN_VISUAL_TYPES.includes(
    rawType as (typeof CAMPAIGN_VISUAL_TYPES)[number],
  )
    ? (rawType as (typeof CAMPAIGN_VISUAL_TYPES)[number])
    : CAMPAIGN_VISUAL_TYPES[index % CAMPAIGN_VISUAL_TYPES.length];

  const name =
    asString(obj.name) ||
    asString(obj.assetName) ||
    `${seed} — ${CAMPAIGN_LABELS[conceptType]}`;

  return {
    name,
    conceptType,
    description: ensureMinLength(
      asString(obj.description) || asString(obj.purpose),
      40,
      defaultCampaign(conceptType, seed).description,
    ),
    platform:
      asString(obj.platform) || defaultCampaign(conceptType, seed).platform,
    prompts: normalizePrompts(obj.prompts ?? obj, seed, name),
    dimensions:
      asString(obj.dimensions) || CAMPAIGN_DIMENSIONS[conceptType],
  };
}

function normalizeLanding(
  entry: unknown,
  index: number,
  seed: string,
): ImageLandingPageAsset | null {
  const obj = asRecord(entry);
  if (!obj) return null;

  const rawType = asString(obj.conceptType);
  const conceptType = LANDING_ASSET_TYPES.includes(
    rawType as (typeof LANDING_ASSET_TYPES)[number],
  )
    ? (rawType as (typeof LANDING_ASSET_TYPES)[number])
    : LANDING_ASSET_TYPES[index % LANDING_ASSET_TYPES.length];

  const name =
    asString(obj.name) ||
    asString(obj.assetName) ||
    `${seed} — ${LANDING_LABELS[conceptType]}`;

  return {
    name,
    conceptType,
    description: ensureMinLength(
      asString(obj.description) || asString(obj.purpose),
      40,
      defaultLanding(conceptType, seed).description,
    ),
    prompts: normalizePrompts(obj.prompts ?? obj, seed, name),
    dimensions:
      asString(obj.dimensions) || LANDING_DIMENSIONS[conceptType],
  };
}

function ensureMockupCoverage(
  items: ImageProductMockup[],
  seed: string,
): ImageProductMockup[] {
  const result = [...items];
  const present = new Set(result.map((item) => item.conceptType));

  for (const conceptType of PRODUCT_MOCKUP_TYPES) {
    if (!present.has(conceptType)) {
      result.push(defaultMockup(conceptType, seed));
    }
  }

  return result.slice(0, 20);
}

function ensureCampaignCoverage(
  items: ImageCampaignVisual[],
  seed: string,
): ImageCampaignVisual[] {
  const result = [...items];
  const present = new Set(result.map((item) => item.conceptType));

  for (const conceptType of CAMPAIGN_VISUAL_TYPES) {
    if (!present.has(conceptType)) {
      result.push(defaultCampaign(conceptType, seed));
    }
  }

  return result.slice(0, 20);
}

function ensureLandingCoverage(
  items: ImageLandingPageAsset[],
  seed: string,
): ImageLandingPageAsset[] {
  const result = [...items];
  const present = new Set(result.map((item) => item.conceptType));

  for (const conceptType of LANDING_ASSET_TYPES) {
    if (!present.has(conceptType)) {
      result.push(defaultLanding(conceptType, seed));
    }
  }

  return result.slice(0, 12);
}

function buildChecklist(
  mockups: ImageProductMockup[],
  campaigns: ImageCampaignVisual[],
  landing: ImageLandingPageAsset[],
): ImageProductionChecklistItem[] {
  const items: ImageProductionChecklistItem[] = [];

  const add = (
    assetName: string,
    platform: string,
    purpose: string,
    priority: ImageProductionChecklistItem["priority"],
  ) => {
    items.push({
      assetName,
      platform,
      purpose: ensureMinLength(purpose, 15, "Production asset from Brain intelligence."),
      priority,
    });
  };

  for (const mockup of mockups) {
    add(
      mockup.name,
      "internal",
      mockup.description,
      mockup.conceptType === "hero_product" ? "high" : "medium",
    );
  }

  for (const visual of campaigns) {
    add(
      visual.name,
      visual.platform,
      visual.description,
      visual.conceptType === "launch_campaign" ? "high" : "medium",
    );
  }

  for (const asset of landing) {
    add(
      asset.name,
      "web",
      asset.description,
      asset.conceptType === "hero_banner" ? "high" : "medium",
    );
  }

  while (items.length < 8) {
    add(
      `Additional asset ${items.length + 1}`,
      "multi",
      "Supplementary visual from image project enrichment pipeline.",
      "low",
    );
  }

  return items.slice(0, 48);
}

function buildFullProject(payload: Record<string, unknown>): string {
  const projectName = asString(payload.projectName) || "Image-Projekt";
  const moodboard = asRecord(payload.moodboard);
  const mockups = Array.isArray(payload.productMockups)
    ? payload.productMockups
    : [];
  const campaigns = Array.isArray(payload.campaignVisuals)
    ? payload.campaignVisuals
    : [];
  const landing = Array.isArray(payload.landingPageAssets)
    ? payload.landingPageAssets
    : [];
  const checklist = Array.isArray(payload.productionChecklist)
    ? payload.productionChecklist
    : [];

  const sections = [
    `# ${projectName}`,
    "## 1. Moodboard",
    `**Visual Direction:** ${asString(moodboard?.visualDirection)}`,
    `**Photography Style:** ${asString(moodboard?.photographyStyle)}`,
    `**Keywords:** ${asStringArray(moodboard?.aestheticKeywords).join(", ")}`,
    `**Color System:** ${asStringArray(moodboard?.colorSystem).join(", ")}`,
    `**Materials:** ${asStringArray(moodboard?.materialReferences).join(", ")}`,
    "## 2. Product Mockups",
    ...mockups.map((item, index) => {
      const obj = asRecord(item);
      if (!obj) return "";
      const prompts = asRecord(obj.prompts);
      return [
        `### ${index + 1}. ${asString(obj.name)} (${asString(obj.conceptType)})`,
        asString(obj.description),
        `**Midjourney:** ${asString(prompts?.midjourney)}`,
        `**OpenAI:** ${asString(prompts?.openai)}`,
        `**Flux:** ${asString(prompts?.flux)}`,
      ].join("\n");
    }),
    "## 3. Campaign Visuals",
    ...campaigns.map((item, index) => {
      const obj = asRecord(item);
      if (!obj) return "";
      const prompts = asRecord(obj.prompts);
      return [
        `### ${index + 1}. ${asString(obj.name)} (${asString(obj.conceptType)})`,
        `**Platform:** ${asString(obj.platform)}`,
        asString(obj.description),
        `**Midjourney:** ${asString(prompts?.midjourney)}`,
        `**OpenAI:** ${asString(prompts?.openai)}`,
        `**Flux:** ${asString(prompts?.flux)}`,
      ].join("\n");
    }),
    "## 4. Landing Page Assets",
    ...landing.map((item, index) => {
      const obj = asRecord(item);
      if (!obj) return "";
      const prompts = asRecord(obj.prompts);
      return [
        `### ${index + 1}. ${asString(obj.name)} (${asString(obj.conceptType)})`,
        asString(obj.description),
        `**Midjourney:** ${asString(prompts?.midjourney)}`,
        `**OpenAI:** ${asString(prompts?.openai)}`,
        `**Flux:** ${asString(prompts?.flux)}`,
      ].join("\n");
    }),
    "## 5. Production Checklist",
    ...checklist.map((item) => {
      const obj = asRecord(item);
      if (!obj) return "";
      return `- [${asString(obj.priority)?.toUpperCase()}] ${asString(obj.assetName)} · ${asString(obj.platform)} — ${asString(obj.purpose)}`;
    }),
  ];

  return ensureMinLength(
    sections.filter(Boolean).join("\n\n"),
    MIN_FULL_PROJECT,
    "Vollständiges Visual Production Project aus CEO-, Design-, Content- und Marketing-Intelligence.",
  );
}

function migrateLegacyAssets(
  payload: Record<string, unknown>,
  seed: string,
): string[] {
  const adjustments: string[] = [];
  const legacyAssets = Array.isArray(payload.assets) ? payload.assets : [];

  if (
    legacyAssets.length > 0 &&
    (!Array.isArray(payload.productMockups) ||
      (payload.productMockups as unknown[]).length === 0)
  ) {
    const mockups: ImageProductMockup[] = [];
    const campaigns: ImageCampaignVisual[] = [];
    const landing: ImageLandingPageAsset[] = [];

    for (const [index, entry] of legacyAssets.entries()) {
      const obj = asRecord(entry);
      if (!obj) continue;
      const assetType = asString(obj.assetType);
      const name = asString(obj.assetName) || `${seed} Asset ${index + 1}`;
      const prompts = normalizePrompts(obj, seed, name);
      const description = ensureMinLength(
        asString(obj.purpose),
        40,
        `Legacy asset migrated to structured image project for ${seed}.`,
      );

      if (assetType.includes("mockup") || assetType === "moodboard") {
        mockups.push(
          normalizeMockup(
            {
              name,
              conceptType: "hero_product",
              description,
              prompts,
              dimensions: asString(obj.dimensions),
            },
            index,
            seed,
          ) ?? defaultMockup("hero_product", seed),
        );
      } else if (
        assetType.includes("instagram") ||
        assetType.includes("tiktok") ||
        assetType === "campaign_visual"
      ) {
        campaigns.push(
          normalizeCampaign(
            {
              name,
              conceptType: "social_creative",
              description,
              platform: asString(obj.platform),
              prompts,
              dimensions: asString(obj.dimensions),
            },
            index,
            seed,
          ) ?? defaultCampaign("social_creative", seed),
        );
      } else if (assetType.includes("landing") || assetType.includes("hero")) {
        landing.push(
          normalizeLanding(
            {
              name,
              conceptType: "hero_banner",
              description,
              prompts,
              dimensions: asString(obj.dimensions),
            },
            index,
            seed,
          ) ?? defaultLanding("hero_banner", seed),
        );
      }
    }

    if (mockups.length) payload.productMockups = mockups;
    if (campaigns.length) payload.campaignVisuals = campaigns;
    if (landing.length) payload.landingPageAssets = landing;
    adjustments.push("migrated legacy assets array");
  }

  return adjustments;
}

export function enrichImagePayload(
  payload: Record<string, unknown>,
): string[] {
  const adjustments: string[] = [];

  if (
    !payload.reportType ||
    payload.reportType === "image-report" ||
    payload.reportType === "image_report"
  ) {
    payload.reportType = IMAGE_PROJECT_TYPE;
    adjustments.push("set reportType=image-project");
  }

  const projectName =
    asString(payload.projectName) ||
    asString(payload.title) ||
    "Milaene Visual Production Project";
  if (!asString(payload.projectName)) {
    payload.projectName = projectName;
    adjustments.push("generated projectName");
  }

  if (!asString(payload.title)) {
    payload.title = projectName;
    adjustments.push("set title from projectName");
  }

  const seed =
    projectName.replace(/Visual Production Project|Milaene/gi, "").trim() ||
    "Drop";

  adjustments.push(...migrateLegacyAssets(payload, seed));

  payload.moodboard = normalizeMoodboard(payload.moodboard, seed, payload);
  adjustments.push("enriched moodboard");

  const mockupRaw = Array.isArray(payload.productMockups)
    ? payload.productMockups
    : [];
  const mockups = ensureMockupCoverage(
    mockupRaw
      .map((entry, index) => normalizeMockup(entry, index, seed))
      .filter((item): item is ImageProductMockup => Boolean(item)),
    seed,
  );
  payload.productMockups = mockups;
  if (mockupRaw.length !== mockups.length) {
    adjustments.push("ensured product mockup coverage");
  }

  const campaignRaw = Array.isArray(payload.campaignVisuals)
    ? payload.campaignVisuals
    : [];
  const campaigns = ensureCampaignCoverage(
    campaignRaw
      .map((entry, index) => normalizeCampaign(entry, index, seed))
      .filter((item): item is ImageCampaignVisual => Boolean(item)),
    seed,
  );
  payload.campaignVisuals = campaigns;
  if (campaignRaw.length !== campaigns.length) {
    adjustments.push("ensured campaign visual coverage");
  }

  const landingRaw = Array.isArray(payload.landingPageAssets)
    ? payload.landingPageAssets
    : [];
  const landing = ensureLandingCoverage(
    landingRaw
      .map((entry, index) => normalizeLanding(entry, index, seed))
      .filter((item): item is ImageLandingPageAsset => Boolean(item)),
    seed,
  );
  payload.landingPageAssets = landing;
  if (landingRaw.length !== landing.length) {
    adjustments.push("ensured landing page asset coverage");
  }

  const checklistRaw = Array.isArray(payload.productionChecklist)
    ? payload.productionChecklist
    : [];
  if (checklistRaw.length < 8) {
    payload.productionChecklist = buildChecklist(mockups, campaigns, landing);
    adjustments.push("generated production checklist");
  } else {
    payload.productionChecklist = checklistRaw
      .map((entry) => {
        const obj = asRecord(entry);
        if (!obj) return null;
        const priorityRaw = asString(obj.priority).toLowerCase();
        const priority =
          priorityRaw === "high" || priorityRaw === "medium" || priorityRaw === "low"
            ? priorityRaw
            : "medium";
        return {
          assetName: asString(obj.assetName) || asString(obj.name) || "Asset",
          priority,
          platform: asString(obj.platform) || "multi",
          purpose: ensureMinLength(
            asString(obj.purpose),
            15,
            "Production purpose from image project.",
          ),
        } satisfies ImageProductionChecklistItem;
      })
      .filter((item): item is ImageProductionChecklistItem => Boolean(item));
  }

  if (
    !Array.isArray(payload.sourceReportTitles) ||
    (payload.sourceReportTitles as unknown[]).length === 0
  ) {
    payload.sourceReportTitles = [
      "CEO Report",
      "Design Report",
      "Marketing Report",
      "Content Report",
    ];
    adjustments.push("generated sourceReportTitles");
  }

  if (typeof payload.confidence !== "number") {
    payload.confidence = 0.75;
    adjustments.push("default confidence");
  }

  if (
    !asString(payload.fullProject) ||
    asString(payload.fullProject).length < MIN_FULL_PROJECT
  ) {
    payload.fullProject = buildFullProject(payload);
    adjustments.push("generated fullProject");
  }

  return adjustments;
}
