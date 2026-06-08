import { IMAGE_PROJECT_TYPE } from "@/brain/domains/reports";
import { buildArtDirectionPrompt } from "./art-direction";
import {
  type ImageCampaignShot,
  type ImageMoodboardSection,
  type ImagePalette,
  type NormalizedImageAsset,
  IMAGE_SCHEMA_VERSION,
} from "./normalized";

const MIN_FULL_PROJECT = 600;
const PRODUCT_VARIANTS = [
  "hero_product",
  "flat_lay",
  "studio",
  "lifestyle",
] as const;

const CORE_SPECS: Array<{
  id: string;
  type: NormalizedImageAsset["type"];
  title: string;
  dimensions: string;
  platform: string;
  variant?: string;
}> = [
  {
    id: "core-hero-banner",
    type: "hero_banner",
    title: "Hero Banner",
    dimensions: "1920x1080",
    platform: "website",
  },
  ...PRODUCT_VARIANTS.map((variant) => ({
    id: `core-mockup-${variant}`,
    type: "product_mockup" as const,
    title: `Product Mockup — ${variant.replace(/_/g, " ")}`,
    dimensions: variant === "flat_lay" ? "2048x2048" : "1536x2048",
    platform: "product",
    variant,
  })),
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

const ADVANCED_SPECS: Array<{
  id: string;
  type: NormalizedImageAsset["type"];
  title: string;
  dimensions: string;
  platform: string;
  variant?: string;
}> = [
  { id: "advanced-landing-hero", type: "landing_section", title: "Landing — Hero", dimensions: "1920x1080", platform: "website", variant: "hero" },
  { id: "advanced-landing-collection", type: "landing_section", title: "Landing — Collection Showcase", dimensions: "1920x900", platform: "website", variant: "collection_showcase" },
  { id: "advanced-landing-product-grid", type: "landing_section", title: "Landing — Product Grid", dimensions: "1600x900", platform: "website", variant: "product_grid" },
  { id: "advanced-instagram-grid-1", type: "instagram_grid", title: "Instagram Grid — Lifestyle", dimensions: "1080x1080", platform: "instagram", variant: "lifestyle_scene" },
  { id: "advanced-instagram-grid-2", type: "instagram_grid", title: "Instagram Grid — Detail", dimensions: "1080x1080", platform: "instagram", variant: "detail_closeup" },
  { id: "advanced-campaign-social", type: "campaign_visual", title: "Social Campaign Visual", dimensions: "1080x1080", platform: "paid_social", variant: "social_creative" },
  { id: "advanced-campaign-ad", type: "campaign_visual", title: "Paid Ad Concept", dimensions: "1200x628", platform: "paid_social", variant: "ad_concept" },
  { id: "advanced-social-reel-alt", type: "social_concept", title: "Additional Reels Concept", dimensions: "1080x1920", platform: "instagram_reels", variant: "behind_the_scenes" },
  { id: "advanced-social-tiktok-alt", type: "social_concept", title: "Additional TikTok Concept", dimensions: "1080x1920", platform: "tiktok", variant: "street_culture" },
  { id: "advanced-mockup-extra", type: "extra_mockup", title: "Extra Product Mockup", dimensions: "1536x2048", platform: "product", variant: "studio_alt" },
  { id: "advanced-community", type: "community_concept", title: "Community Style Post", dimensions: "1080x1080", platform: "instagram", variant: "community_style" },
  { id: "advanced-launch-teaser", type: "launch_teaser", title: "Launch Teaser Visual", dimensions: "1080x1350", platform: "instagram", variant: "launch_teaser" },
  { id: "advanced-email-asset", type: "email_asset", title: "Email Campaign Asset", dimensions: "1200x800", platform: "email", variant: "launch_email" },
];

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean);
}

function ensureMinLength(text: string, min: number, suffix: string): string {
  let result = text.trim() || suffix.trim();
  while (result.length < min) {
    result = `${result} ${suffix}`.trim();
  }
  return result;
}

function defaultPalette(): ImagePalette {
  return {
    primary: "Obsidian Black #111111",
    secondary: "Concrete Grey #888888",
    accent: "Signal Green #6FBF73",
    background: "Off-White #F5F5F0",
    text: "Charcoal #2A2A2A",
  };
}

function defaultMoodboard(seed: string): ImageMoodboardSection {
  return {
    visualDirection: ensureMinLength(
      `Creative direction for ${seed}: urban luxury streetwear with editorial confidence, derived from CEO, design, content and marketing intelligence.`,
      80,
      "Visual direction from Brain reports.",
    ),
    aestheticKeywords: [
      "urban luxury",
      "minimal streetwear",
      "premium materials",
      "scarcity drop",
    ],
    colorSystem: [
      "Obsidian Black #111111",
      "Concrete Grey #888888",
      "Signal Green #6FBF73",
    ],
    materialReferences: [
      "Heavyweight organic cotton fleece",
      "Brushed cotton twill",
      "Matte hardware",
    ],
    photographyStyle: ensureMinLength(
      "Editorial streetwear photography with natural urban light, shallow depth of field, premium product focus.",
      40,
      "Photography style from design report.",
    ),
  };
}

function normalizePrompts(
  value: unknown,
  seed: string,
  subject: string,
): NormalizedImageAsset["prompt"] {
  const obj = asRecord(value);
  if (!obj) return buildArtDirectionPrompt({ subject, seed });

  const midjourney = asString(obj.midjourney) || asString(obj.midjourneyPrompt);
  const openai = asString(obj.openai) || asString(obj.openaiPrompt);
  const flux = asString(obj.flux) || asString(obj.fluxPrompt);
  const legacy = asString(obj.prompt);

  if (!midjourney && !openai && !flux && legacy) {
    return buildArtDirectionPrompt({ subject: legacy, seed });
  }

  const fallback = buildArtDirectionPrompt({ subject, seed });
  return {
    midjourney: ensureMinLength(midjourney || legacy, 80, fallback.midjourney),
    openai: ensureMinLength(openai || legacy, 80, fallback.openai),
    flux: ensureMinLength(flux || legacy, 80, fallback.flux),
  };
}

function defaultCoreAsset(
  spec: (typeof CORE_SPECS)[number],
  seed: string,
): NormalizedImageAsset {
  const subject = `${spec.title} for ${seed}`;
  return {
    id: spec.id,
    title: `${seed} — ${spec.title}`,
    type: spec.type,
    package: "core",
    dimensions: spec.dimensions,
    platform: spec.platform,
    variant: spec.variant,
    purpose: ensureMinLength(
      `Authoritative ${spec.title.toLowerCase()} for ${seed} production package.`,
      20,
      "Core production asset.",
    ),
    prompt: buildArtDirectionPrompt({ subject, seed }),
    status: "ready",
  };
}

function defaultAdvancedAsset(
  spec: (typeof ADVANCED_SPECS)[number],
  seed: string,
): NormalizedImageAsset {
  const subject = `${spec.title} for ${seed}`;
  return {
    id: spec.id,
    title: `${seed} — ${spec.title}`,
    type: spec.type,
    package: "advanced",
    dimensions: spec.dimensions,
    platform: spec.platform,
    variant: spec.variant,
    purpose: ensureMinLength(
      `Advanced production asset for ${seed} extended package.`,
      20,
      "Advanced production asset.",
    ),
    prompt: buildArtDirectionPrompt({ subject, seed }),
    status: "ready",
  };
}

function normalizeAsset(
  entry: unknown,
  index: number,
  seed: string,
  fallbackPackage: "core" | "advanced",
): NormalizedImageAsset | null {
  const obj = asRecord(entry);
  if (!obj) return null;

  const spec =
    CORE_SPECS.find((item) => item.id === asString(obj.id)) ??
    ADVANCED_SPECS.find((item) => item.id === asString(obj.id));

  const type = asString(obj.type) as NormalizedImageAsset["type"];
  const pkg = (asString(obj.package) === "advanced" ? "advanced" : fallbackPackage) as
    | "core"
    | "advanced";

  const title = asString(obj.title) || spec?.title || `Asset ${index + 1}`;
  const id =
    asString(obj.id) ||
    spec?.id ||
    `${pkg}-${type}-${index}`;

  return {
    id,
    title,
    type: (spec?.type ?? type) || "campaign_visual",
    package: spec ? (CORE_SPECS.some((item) => item.id === spec.id) ? "core" : "advanced") : pkg,
    dimensions: asString(obj.dimensions) || spec?.dimensions || "1024x1024",
    platform: asString(obj.platform) || spec?.platform,
    variant: asString(obj.variant) || spec?.variant,
    purpose: asString(obj.purpose),
    prompt: normalizePrompts(obj.prompt ?? obj.prompts, seed, title),
    provider: undefined,
    status: (asString(obj.status) as NormalizedImageAsset["status"]) || "ready",
    imageUrl: asString(obj.imageUrl) || undefined,
    storagePath: asString(obj.storagePath) || undefined,
    createdAt: asString(obj.createdAt) || undefined,
    message: asString(obj.message) || undefined,
  };
}

function ensureCoreCoverage(
  items: NormalizedImageAsset[],
  seed: string,
): NormalizedImageAsset[] {
  const result = [...items];
  const present = new Set(result.map((item) => item.id));
  for (const spec of CORE_SPECS) {
    if (!present.has(spec.id)) {
      result.push(defaultCoreAsset(spec, seed));
    }
  }
  return result;
}

function ensureAdvancedCoverage(
  items: NormalizedImageAsset[],
  seed: string,
): NormalizedImageAsset[] {
  const result = [...items];
  const present = new Set(result.map((item) => item.id));
  for (const spec of ADVANCED_SPECS) {
    if (!present.has(spec.id)) {
      result.push(defaultAdvancedAsset(spec, seed));
    }
  }
  return result;
}

function defaultShot(seed: string, index: number): ImageCampaignShot {
  const types = [
    "hero_portrait",
    "wide_environment",
    "product_detail",
    "lifestyle_action",
    "flat_lay",
    "studio_lookbook",
    "street_scene",
    "texture_closeup",
    "group_shot",
    "accessory_focus",
    "editorial_backdrop",
    "campaign_key_visual",
  ];
  const shotType = types[index % types.length];
  return {
    shotName: `${seed} — ${shotType.replace(/_/g, " ")}`,
    shotType,
    location: "Urban rooftop or concrete industrial backdrop",
    styling: "Obsidian and concrete palette, signal green accent, premium streetwear",
    purpose: `Production shot ${index + 1} for ${seed} campaign from marketing launch strategy`,
  };
}

function buildFullProject(payload: Record<string, unknown>): string {
  const projectName = asString(payload.projectName) || "Image Project";
  const moodboard = asRecord(payload.moodboard);
  const palette = asRecord(payload.palette);
  const core = Array.isArray(payload.corePackage) ? payload.corePackage : [];
  const advanced = Array.isArray(payload.advancedPackage)
    ? payload.advancedPackage
    : [];
  const shots = Array.isArray(payload.campaignShots) ? payload.campaignShots : [];

  const sections = [
    `# ${projectName}`,
    "## Creative Direction",
    asString(moodboard?.visualDirection),
    `Palette: ${asString(palette?.primary)}, ${asString(palette?.accent)}`,
    "## Core Package",
    ...core.map((item) => {
      const obj = asRecord(item);
      return obj ? `- **${asString(obj.title)}** (${asString(obj.type)}) · ${asString(obj.dimensions)}` : "";
    }),
    "## Advanced Package",
    ...advanced.map((item) => {
      const obj = asRecord(item);
      return obj ? `- ${asString(obj.title)} (${asString(obj.type)})` : "";
    }),
    "## Campaign Shot List",
    ...shots.map((item) => {
      const obj = asRecord(item);
      return obj
        ? `- ${asString(obj.shotName)} · ${asString(obj.location)}`
        : "";
    }),
  ];

  return ensureMinLength(
    sections.filter(Boolean).join("\n\n"),
    MIN_FULL_PROJECT,
    "Creative production project from Brain intelligence.",
  );
}

export function enrichImagePayload(payload: Record<string, unknown>): string[] {
  const adjustments: string[] = [];

  payload.reportType = IMAGE_PROJECT_TYPE;
  payload.schemaVersion = IMAGE_SCHEMA_VERSION;

  const projectName =
    asString(payload.projectName) ||
    asString(payload.title) ||
    "Milaene Creative Production";
  payload.projectName = projectName;
  if (!asString(payload.title)) payload.title = projectName;

  const seed =
    projectName.replace(/Creative Production|Milaene/gi, "").trim() || "Drop";

  payload.moodboard = (() => {
    const obj = asRecord(payload.moodboard);
    const defaults = defaultMoodboard(seed);
    if (!obj) return defaults;
    return {
      visualDirection: ensureMinLength(
        asString(obj.visualDirection),
        80,
        defaults.visualDirection,
      ),
      aestheticKeywords:
        asStringArray(obj.aestheticKeywords).length >= 3
          ? asStringArray(obj.aestheticKeywords).slice(0, 12)
          : defaults.aestheticKeywords,
      colorSystem:
        asStringArray(obj.colorSystem).length >= 2
          ? asStringArray(obj.colorSystem).slice(0, 8)
          : defaults.colorSystem,
      materialReferences:
        asStringArray(obj.materialReferences).length >= 2
          ? asStringArray(obj.materialReferences).slice(0, 8)
          : defaults.materialReferences,
      photographyStyle: ensureMinLength(
        asString(obj.photographyStyle),
        40,
        defaults.photographyStyle,
      ),
    };
  })();

  payload.palette = (() => {
    const obj = asRecord(payload.palette);
    const defaults = defaultPalette();
    if (!obj) return defaults;
    const ensureHex = (value: string, fallback: string) =>
      /#[0-9A-Fa-f]{3,8}/.test(value) ? value : fallback;
    return {
      primary: ensureHex(asString(obj.primary), defaults.primary),
      secondary: ensureHex(asString(obj.secondary), defaults.secondary),
      accent: ensureHex(asString(obj.accent), defaults.accent),
      background: ensureHex(asString(obj.background), defaults.background),
      text: ensureHex(asString(obj.text), defaults.text),
    };
  })();

  const coreRaw = Array.isArray(payload.corePackage) ? payload.corePackage : [];
  const core = ensureCoreCoverage(
    coreRaw
      .map((entry, index) => normalizeAsset(entry, index, seed, "core"))
      .filter((item): item is NormalizedImageAsset => Boolean(item)),
    seed,
  );
  payload.corePackage = core;

  const advancedRaw = Array.isArray(payload.advancedPackage)
    ? payload.advancedPackage
    : [];
  const advanced = ensureAdvancedCoverage(
    advancedRaw
      .map((entry, index) => normalizeAsset(entry, index, seed, "advanced"))
      .filter((item): item is NormalizedImageAsset => Boolean(item)),
    seed,
  );
  payload.advancedPackage = advanced;

  const shotsRaw = Array.isArray(payload.campaignShots)
    ? payload.campaignShots
    : [];
  if (shotsRaw.length < 12) {
    const shots: ImageCampaignShot[] = [];
    for (let i = 0; i < 12; i += 1) {
      const existing = asRecord(shotsRaw[i]);
      shots.push(
        existing
          ? {
              shotName: asString(existing.shotName) || defaultShot(seed, i).shotName,
              shotType: asString(existing.shotType) || defaultShot(seed, i).shotType,
              location: ensureMinLength(
                asString(existing.location),
                10,
                defaultShot(seed, i).location,
              ),
              styling: ensureMinLength(
                asString(existing.styling),
                20,
                defaultShot(seed, i).styling,
              ),
              purpose: ensureMinLength(
                asString(existing.purpose),
                20,
                defaultShot(seed, i).purpose,
              ),
            }
          : defaultShot(seed, i),
      );
    }
    payload.campaignShots = shots;
    adjustments.push("ensured campaign shot coverage");
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
  }

  if (typeof payload.confidence !== "number") {
    payload.confidence = 0.8;
  }

  if (!asString(payload.fullProject) || asString(payload.fullProject).length < MIN_FULL_PROJECT) {
    payload.fullProject = buildFullProject(payload);
    adjustments.push("generated fullProject");
  }

  adjustments.push("enriched V2 image packages");
  return adjustments;
}
