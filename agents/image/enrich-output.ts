import { IMAGE_REPORT_TYPE } from "@/brain/domains/reports";
import {
  IMAGE_ASSET_TYPES,
  type ImageAsset,
  type ImageAssetType,
} from "./types";

const MIN_FULL_PROJECT = 800;
const MIN_PROMPT = 50;

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function ensureMinLength(text: string, min: number, suffix: string): string {
  let result = text.trim() || suffix.trim();
  while (result.length < min) {
    result = `${result} ${suffix}`.trim();
  }
  return result;
}

const DEFAULT_DIMENSIONS: Record<ImageAssetType, string> = {
  moodboard: "2048x2048",
  hoodie_mockup: "1536x2048",
  tshirt_mockup: "1536x2048",
  cargo_mockup: "1536x2048",
  campaign_visual: "1920x1080",
  landing_page_hero: "1920x1080",
  instagram_post: "1080x1080",
  instagram_story: "1080x1920",
  tiktok_cover: "1080x1920",
  email_banner: "1200x600",
  lookbook_page: "2048x2732",
};

const DEFAULT_PLATFORMS: Record<ImageAssetType, string> = {
  moodboard: "internal",
  hoodie_mockup: "internal",
  tshirt_mockup: "internal",
  cargo_mockup: "internal",
  campaign_visual: "campaign",
  landing_page_hero: "web",
  instagram_post: "instagram",
  instagram_story: "instagram",
  tiktok_cover: "tiktok",
  email_banner: "email",
  lookbook_page: "lookbook",
};

function defaultAsset(
  assetType: ImageAssetType,
  seed: string,
  index: number,
): ImageAsset {
  const label = assetType.replace(/_/g, " ");
  return {
    assetName: `${seed} — ${label} ${index + 1}`,
    assetType,
    purpose: ensureMinLength(
      `Visual asset for ${label} supporting ${seed} launch`,
      15,
      "Derived from design, content and marketing intelligence.",
    ),
    platform: DEFAULT_PLATFORMS[assetType],
    prompt: ensureMinLength(
      `Urban luxury streetwear ${label} for ${seed}. ` +
        "Color palette from design report, hero products in focus, " +
        "campaign mood from marketing strategy, brand story from content report. " +
        "Photorealistic, premium lighting, minimal composition, Milaene aesthetic.",
      MIN_PROMPT,
      "Creative direction from Brain intelligence reports.",
    ),
    dimensions: DEFAULT_DIMENSIONS[assetType],
    styleNotes: ensureMinLength(
      `Milaene visual language: confident, minimal, culturally fluent. ` +
        `${seed} collection story, design direction and marketing concept integrated.`,
      15,
      "Style notes from brand rules and design report.",
    ),
  };
}

function normalizeAsset(entry: unknown, index: number, seed: string): ImageAsset | null {
  const obj = asRecord(entry);
  if (!obj) return null;

  const rawType = asString(obj.assetType);
  const assetType = IMAGE_ASSET_TYPES.includes(rawType as ImageAssetType)
    ? (rawType as ImageAssetType)
    : "campaign_visual";

  const assetName =
    asString(obj.assetName) || asString(obj.name) || `${seed} Asset ${index + 1}`;

  return {
    assetName,
    assetType,
    purpose: ensureMinLength(
      asString(obj.purpose),
      15,
      "Visual purpose from campaign and design intelligence.",
    ),
    platform: asString(obj.platform) || DEFAULT_PLATFORMS[assetType],
    prompt: ensureMinLength(
      asString(obj.prompt),
      MIN_PROMPT,
      `Image prompt for ${assetName} derived from design, content and marketing reports.`,
    ),
    dimensions:
      asString(obj.dimensions) || DEFAULT_DIMENSIONS[assetType],
    styleNotes: ensureMinLength(
      asString(obj.styleNotes),
      15,
      "Premium urban luxury streetwear — Milaene brand rules.",
    ),
  };
}

function ensureAssetCoverage(assets: ImageAsset[], seed: string): ImageAsset[] {
  const result = [...assets];
  const present = new Set(result.map((a) => a.assetType));

  const requiredTypes: ImageAssetType[] = [
    "moodboard",
    "hoodie_mockup",
    "tshirt_mockup",
    "campaign_visual",
    "landing_page_hero",
    "instagram_post",
    "instagram_story",
    "tiktok_cover",
    "lookbook_page",
  ];

  for (const assetType of requiredTypes) {
    if (!present.has(assetType)) {
      result.push(defaultAsset(assetType, seed, result.length));
      present.add(assetType);
    }
  }

  return result.slice(0, 48);
}

function buildFullProject(payload: Record<string, unknown>): string {
  const projectName = asString(payload.projectName) || "Image-Projekt";
  const assets = Array.isArray(payload.assets) ? payload.assets : [];

  const sections = [
    `# ${projectName}`,
    "## Visual Direction",
    asString(payload.visualDirection),
    "## Collection Story",
    asString(payload.collectionStory),
    "## Moodboard",
    asString(payload.moodboard),
    "## Campaign Concept",
    asString(payload.campaignConcept),
    "## Assets",
    ...assets.map((asset, i) => {
      const obj = asRecord(asset);
      if (!obj) return "";
      return [
        `### ${i + 1}. ${asString(obj.assetName)} (${asString(obj.assetType)})`,
        `**Platform:** ${asString(obj.platform)} | **Dimensions:** ${asString(obj.dimensions)}`,
        `**Purpose:** ${asString(obj.purpose)}`,
        `**Prompt:** ${asString(obj.prompt)}`,
        `**Style Notes:** ${asString(obj.styleNotes)}`,
      ].join("\n");
    }),
  ];

  return ensureMinLength(
    sections.filter(Boolean).join("\n\n"),
    MIN_FULL_PROJECT,
    "Vollständiges Image-Projekt basierend auf Design-, Content-, Marketing- und CEO-Intelligence.",
  );
}

export function enrichImagePayload(
  payload: Record<string, unknown>,
): string[] {
  const adjustments: string[] = [];

  if (!payload.reportType) {
    payload.reportType = IMAGE_REPORT_TYPE;
    adjustments.push("set reportType=image-report");
  }

  const projectName =
    asString(payload.projectName) || asString(payload.title) || "Milaene Visual Project";
  if (!asString(payload.projectName)) {
    payload.projectName = projectName;
    adjustments.push("generated projectName");
  }

  if (!asString(payload.title)) {
    payload.title = projectName;
    adjustments.push("set title from projectName");
  }

  const seed = projectName.replace(/Visual Project|Milaene/gi, "").trim() || "Drop";

  if (!asString(payload.visualDirection) || asString(payload.visualDirection).length < 100) {
    payload.visualDirection = ensureMinLength(
      asString(payload.visualDirection) ||
        `Creative direction for ${seed}: Urban luxury streetwear visual system integrating ` +
          "collection story, color palette, hero products and marketing campaign concept. " +
          "Art direction: confident, minimal, premium — derived from design and content reports.",
      100,
      "Visual direction from design report and brand rules.",
    );
    adjustments.push("enriched visualDirection");
  }

  if (!asString(payload.collectionStory) || asString(payload.collectionStory).length < 80) {
    payload.collectionStory = ensureMinLength(
      asString(payload.collectionStory) ||
        `Collection story for ${seed} from design report — silhouettes, materials and hero SKUs ` +
          "aligned with content brand narrative and CEO launch strategy.",
      80,
      "Collection story from design intelligence.",
    );
    adjustments.push("enriched collectionStory");
  }

  if (!asString(payload.moodboard) || asString(payload.moodboard).length < 80) {
    payload.moodboard = ensureMinLength(
      asString(payload.moodboard) ||
        `Moodboard direction for ${seed}: palette swatches, texture references, urban environment cues, ` +
          "streetwear culture signals and premium material close-ups from design report.",
      80,
      "Moodboard creative brief from design report.",
    );
    adjustments.push("enriched moodboard");
  }

  if (!asString(payload.campaignConcept) || asString(payload.campaignConcept).length < 80) {
    payload.campaignConcept = ensureMinLength(
      asString(payload.campaignConcept) ||
        `Campaign visual concept for ${seed} from marketing report — launch narrative, ` +
          "channel-specific creative angles, influencer aesthetic and drop scarcity signals.",
      80,
      "Campaign concept from marketing intelligence.",
    );
    adjustments.push("enriched campaignConcept");
  }

  const assetRaw = Array.isArray(payload.assets) ? payload.assets : [];
  const assets = assetRaw
    .map((entry, index) => normalizeAsset(entry, index, seed))
    .filter((a): a is ImageAsset => Boolean(a));

  const covered = ensureAssetCoverage(assets, seed);
  if (covered.length !== assets.length || assets.length < 8) {
    payload.assets = covered;
    adjustments.push("ensured asset coverage");
  } else {
    payload.assets = assets;
  }

  if (
    !Array.isArray(payload.sourceReportTitles) ||
    (payload.sourceReportTitles as unknown[]).length === 0
  ) {
    payload.sourceReportTitles = [
      "Design Report",
      "Content Report",
      "Marketing Report",
    ];
    adjustments.push("generated sourceReportTitles");
  }

  if (typeof payload.confidence !== "number") {
    payload.confidence = 0.75;
    adjustments.push("default confidence");
  }

  if (!asString(payload.fullProject) || asString(payload.fullProject).length < MIN_FULL_PROJECT) {
    payload.fullProject = buildFullProject(payload);
    adjustments.push("generated fullProject");
  }

  return adjustments;
}
