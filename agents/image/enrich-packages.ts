import type { BrainImageSections } from "@/brain/domains/reports";
import { IMAGE_PROJECT_TYPE } from "@/brain/domains/reports";
import {
  ADVANCED_ASSET_SPECS,
  CORE_ASSET_SPECS,
  findAssetSpec,
} from "./asset-specs";
import { buildArtDirectionPrompt } from "./art-direction";
import {
  type ImageCollectionIdentity,
  formatAssetTitle,
  resolveIdentityFromPayload,
} from "./collection-identity";
import { dedupeImageAssets, matchAssetToSpec } from "./dedupe-assets";
import { migrateLegacyImageSections } from "./migrate-legacy";
import {
  type LegacyImageCampaignShot,
  type LegacyNormalizedImageAsset,
  IMAGE_SCHEMA_VERSION_V2,
} from "./legacy-v2";
import type { ImageMoodboardSection, ImagePalette } from "./studio-schema";

const LEGACY_IMAGE_PAYLOAD_KEYS = [
  "heroBanner",
  "hero_banner",
  "productMockups",
  "product_mockups",
  "campaignVisuals",
  "campaign_visuals",
  "landingPageAssets",
  "landing_page_assets",
  "landingAssets",
  "landing_assets",
  "instagramGrid",
  "instagram_grid",
  "reelsConcepts",
  "reels_concepts",
  "tiktokConcepts",
  "tiktok_concepts",
  "generatedAssets",
  "generated_assets",
  "productionChecklist",
  "production_checklist",
] as const;

const PALETTE_SLOTS = [
  "primary",
  "secondary",
  "accent",
  "background",
  "text",
] as const satisfies ReadonlyArray<keyof ImagePalette>;

const MIN_FULL_PROJECT = 600;

export interface EnrichImageOptions {
  collectionIdentity?: ImageCollectionIdentity;
}

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

function hasLegacyImageFields(payload: Record<string, unknown>): boolean {
  return LEGACY_IMAGE_PAYLOAD_KEYS.some((key) => payload[key] !== undefined);
}

export function stripLegacyImageFields(
  payload: Record<string, unknown>,
): string[] {
  const removed: string[] = [];
  for (const key of LEGACY_IMAGE_PAYLOAD_KEYS) {
    if (payload[key] !== undefined) {
      delete payload[key];
      removed.push(key);
    }
  }
  return removed;
}

function normalizeMoodboard(
  value: unknown,
  identity: ImageCollectionIdentity,
): ImageMoodboardSection {
  const defaults = defaultMoodboard(identity);

  if (typeof value === "string") {
    const label = value.trim();
    return {
      visualDirection: ensureMinLength(
        label
          ? `Creative direction — ${label}: urban luxury streetwear with editorial confidence, derived from CEO, design, content and marketing intelligence.`
          : defaults.visualDirection,
        80,
        defaults.visualDirection,
      ),
      aestheticKeywords: defaults.aestheticKeywords,
      colorSystem: defaults.colorSystem,
      materialReferences: defaults.materialReferences,
      photographyStyle: defaults.photographyStyle,
    };
  }

  const obj = asRecord(value);
  if (!obj) return defaults;

  return {
    visualDirection: ensureMinLength(
      asString(obj.visualDirection) || asString(obj.title) || asString(obj.name),
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
}

function formatPaletteColor(name: string, hex: string): string {
  const normalizedHex = hex.trim();
  if (!normalizedHex) return "";
  if (!name.trim()) return normalizedHex;
  return `${name.trim()} ${normalizedHex.startsWith("#") ? normalizedHex : `#${normalizedHex}`}`;
}

function normalizePalette(value: unknown): ImagePalette {
  const defaults = defaultPalette();

  if (Array.isArray(value)) {
    const result = { ...defaults };
    for (let i = 0; i < PALETTE_SLOTS.length; i += 1) {
      const entry = value[i];
      const obj = asRecord(entry);
      if (!obj) continue;
      const formatted = formatPaletteColor(
        asString(obj.name) || asString(obj.label) || asString(obj.role),
        asString(obj.hex) || asString(obj.value) || asString(obj.color),
      );
      if (formatted && /#[0-9A-Fa-f]{3,8}/.test(formatted)) {
        result[PALETTE_SLOTS[i]] = formatted;
      }
    }
    return result;
  }

  const obj = asRecord(value);
  if (!obj) return defaults;

  const ensureHex = (raw: string, fallback: string) =>
    /#[0-9A-Fa-f]{3,8}/.test(raw) ? raw : fallback;

  return {
    primary: ensureHex(asString(obj.primary), defaults.primary),
    secondary: ensureHex(asString(obj.secondary), defaults.secondary),
    accent: ensureHex(asString(obj.accent), defaults.accent),
    background: ensureHex(asString(obj.background), defaults.background),
    text: ensureHex(asString(obj.text), defaults.text),
  };
}

function normalizeCampaignShot(
  existing: Record<string, unknown> | undefined,
  identity: ImageCollectionIdentity,
  index: number,
): LegacyImageCampaignShot {
  const fallback = defaultShot(identity, index);
  if (!existing) return fallback;

  const shotName = asString(existing.shotName);
  const shotType = asString(existing.shotType);

  const shotLabel =
    shotName && shotName.includes("—")
      ? shotName.split("—").pop()?.trim() ?? fallback.shotType.replace(/_/g, " ")
      : shotType.length >= 2
        ? shotType.replace(/_/g, " ")
        : fallback.shotType.replace(/_/g, " ");

  return {
    shotName: formatAssetTitle(identity.collectionName, shotLabel),
    shotType: shotType.length >= 2 ? shotType : fallback.shotType,
    location: ensureMinLength(asString(existing.location), 10, fallback.location),
    styling: ensureMinLength(asString(existing.styling), 20, fallback.styling),
    purpose: ensureMinLength(asString(existing.purpose), 20, fallback.purpose),
  };
}

function normalizeCampaignShots(
  shotsRaw: unknown[],
  identity: ImageCollectionIdentity,
): LegacyImageCampaignShot[] {
  const sourceCount = shotsRaw.length;
  const targetCount =
    sourceCount < 12 ? 12 : Math.min(sourceCount, 24);
  const shots: LegacyImageCampaignShot[] = [];

  for (let i = 0; i < targetCount; i += 1) {
    shots.push(normalizeCampaignShot(asRecord(shotsRaw[i]), identity, i));
  }

  return shots;
}

function defaultMoodboard(identity: ImageCollectionIdentity): ImageMoodboardSection {
  const { collectionName, campaignName } = identity;
  return {
    visualDirection: ensureMinLength(
      `Creative direction for ${collectionName} (${campaignName}): urban luxury streetwear with editorial confidence, derived from CEO, design, content and marketing intelligence.`,
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
  identity: ImageCollectionIdentity,
  subject: string,
): LegacyNormalizedImageAsset["prompt"] {
  const obj = asRecord(value);
  if (!obj) return buildArtDirectionPrompt({ subject, collectionName: identity.collectionName, campaignName: identity.campaignName });

  const midjourney = asString(obj.midjourney) || asString(obj.midjourneyPrompt);
  const openai = asString(obj.openai) || asString(obj.openaiPrompt);
  const flux = asString(obj.flux) || asString(obj.fluxPrompt);
  const legacy = asString(obj.prompt);

  if (!midjourney && !openai && !flux && legacy) {
    return buildArtDirectionPrompt({ subject: legacy, collectionName: identity.collectionName, campaignName: identity.campaignName });
  }

  const fallback = buildArtDirectionPrompt({ subject, collectionName: identity.collectionName, campaignName: identity.campaignName });
  return {
    midjourney: ensureMinLength(midjourney || legacy, 80, fallback.midjourney),
    openai: ensureMinLength(openai || legacy, 80, fallback.openai),
    flux: ensureMinLength(flux || legacy, 80, fallback.flux),
  };
}

function defaultCoreAsset(
  spec: (typeof CORE_ASSET_SPECS)[number],
  identity: ImageCollectionIdentity,
): LegacyNormalizedImageAsset {
  const { collectionName, campaignName } = identity;
  const subject = `${spec.title} for ${collectionName} (${campaignName})`;
  return {
    id: spec.id,
    title: formatAssetTitle(collectionName, spec.title),
    type: spec.type,
    package: "core",
    dimensions: spec.dimensions,
    platform: spec.platform,
    variant: spec.variant,
    purpose: ensureMinLength(
      `Authoritative ${spec.title.toLowerCase()} for ${collectionName} core production package.`,
      20,
      "Core production asset.",
    ),
    prompt: buildArtDirectionPrompt({ subject, collectionName, campaignName }),
    status: "ready",
  };
}

function defaultAdvancedAsset(
  spec: (typeof ADVANCED_ASSET_SPECS)[number],
  identity: ImageCollectionIdentity,
): LegacyNormalizedImageAsset {
  const { collectionName, campaignName } = identity;
  const subject = `${spec.title} for ${collectionName} (${campaignName})`;
  return {
    id: spec.id,
    title: formatAssetTitle(collectionName, spec.title),
    type: spec.type,
    package: "advanced",
    dimensions: spec.dimensions,
    platform: spec.platform,
    variant: spec.variant,
    purpose: ensureMinLength(
      `Advanced production asset extending ${collectionName} with ${spec.title.toLowerCase()}.`,
      20,
      "Advanced production asset.",
    ),
    prompt: buildArtDirectionPrompt({ subject, collectionName, campaignName }),
    status: "ready",
  };
}

function normalizeAsset(
  entry: unknown,
  index: number,
  identity: ImageCollectionIdentity,
  fallbackPackage: "core" | "advanced",
  specs: typeof CORE_ASSET_SPECS | typeof ADVANCED_ASSET_SPECS,
): LegacyNormalizedImageAsset | null {
  const obj = asRecord(entry);
  if (!obj) return null;

  const idHint = asString(obj.id);
  const typeHint = asString(obj.type) as LegacyNormalizedImageAsset["type"];
  const variantHint = asString(obj.variant);

  const spec =
    findAssetSpec(idHint) ??
    matchAssetToSpec(
      {
        id: idHint || `${fallbackPackage}-${typeHint}-${index}`,
        title: "",
        type: typeHint || "campaign_visual",
        package: fallbackPackage,
        dimensions: "",
        variant: variantHint || undefined,
        prompt: { midjourney: "", openai: "", flux: "" },
        status: "ready",
      },
      specs,
    );

  const pkg = (asString(obj.package) === "advanced" ? "advanced" : fallbackPackage) as
    | "core"
    | "advanced";
  const assetTypeLabel = spec?.title ?? `Asset ${index + 1}`;
  const id = spec?.id ?? idHint ?? `${pkg}-${typeHint}-${index}`;

  return {
    id,
    title: formatAssetTitle(identity.collectionName, assetTypeLabel),
    type: spec?.type ?? typeHint ?? "campaign_visual",
    package: spec
      ? CORE_ASSET_SPECS.some((item) => item.id === spec.id)
        ? "core"
        : "advanced"
      : pkg,
    dimensions: asString(obj.dimensions) || spec?.dimensions || "1024x1024",
    platform: asString(obj.platform) || spec?.platform,
    variant: variantHint || spec?.variant,
    purpose: ensureMinLength(
      asString(obj.purpose),
      20,
      `Production asset for ${identity.collectionName} ${assetTypeLabel.toLowerCase()}.`,
    ),
    prompt: normalizePrompts(
      obj.prompt ?? obj.prompts,
      identity,
      formatAssetTitle(identity.collectionName, assetTypeLabel),
    ),
    provider: undefined,
    status: (asString(obj.status) as LegacyNormalizedImageAsset["status"]) || "ready",
    imageUrl: asString(obj.imageUrl) || undefined,
    storagePath: asString(obj.storagePath) || undefined,
    createdAt: asString(obj.createdAt) || undefined,
    message: asString(obj.message) || undefined,
  };
}

function ensureCoreCoverage(
  items: LegacyNormalizedImageAsset[],
  identity: ImageCollectionIdentity,
): LegacyNormalizedImageAsset[] {
  const deduped = dedupeImageAssets(items);
  const bySpec = new Map<string, LegacyNormalizedImageAsset>();

  for (const asset of deduped) {
    const spec = matchAssetToSpec(asset, CORE_ASSET_SPECS);
    if (spec) bySpec.set(spec.id, { ...asset, id: spec.id, package: "core" });
  }

  for (const spec of CORE_ASSET_SPECS) {
    if (!bySpec.has(spec.id)) {
      bySpec.set(spec.id, defaultCoreAsset(spec, identity));
    } else {
      const asset = bySpec.get(spec.id)!;
      bySpec.set(spec.id, {
        ...asset,
        title: formatAssetTitle(identity.collectionName, spec.title),
        type: spec.type,
        variant: spec.variant,
        dimensions: spec.dimensions,
        platform: spec.platform,
      });
    }
  }

  return CORE_ASSET_SPECS.map((spec) => bySpec.get(spec.id)!);
}

function ensureAdvancedCoverage(
  items: LegacyNormalizedImageAsset[],
  identity: ImageCollectionIdentity,
): LegacyNormalizedImageAsset[] {
  const deduped = dedupeImageAssets(items);
  const bySpec = new Map<string, LegacyNormalizedImageAsset>();

  for (const asset of deduped) {
    const spec = matchAssetToSpec(asset, ADVANCED_ASSET_SPECS);
    if (spec) bySpec.set(spec.id, { ...asset, id: spec.id, package: "advanced" });
  }

  for (const spec of ADVANCED_ASSET_SPECS) {
    if (!bySpec.has(spec.id)) {
      bySpec.set(spec.id, defaultAdvancedAsset(spec, identity));
    } else {
      const asset = bySpec.get(spec.id)!;
      bySpec.set(spec.id, {
        ...asset,
        title: formatAssetTitle(identity.collectionName, spec.title),
        type: spec.type,
        variant: spec.variant,
        dimensions: spec.dimensions,
        platform: spec.platform,
      });
    }
  }

  return ADVANCED_ASSET_SPECS.map((spec) => bySpec.get(spec.id)!);
}

function defaultShot(identity: ImageCollectionIdentity, index: number): LegacyImageCampaignShot {
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
  const shotLabel = shotType.replace(/_/g, " ");
  return {
    shotName: formatAssetTitle(identity.collectionName, shotLabel),
    shotType,
    location: "Urban rooftop or concrete industrial backdrop",
    styling: "Obsidian and concrete palette, signal green accent, premium streetwear",
    purpose: `Production shot ${index + 1} for ${identity.collectionName} (${identity.campaignName}) from marketing launch strategy`,
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

export function enrichImagePayload(
  payload: Record<string, unknown>,
  options?: EnrichImageOptions,
): string[] {
  const adjustments: string[] = [];

  payload.reportType = IMAGE_PROJECT_TYPE;
  payload.schemaVersion = IMAGE_SCHEMA_VERSION_V2;

  const identity = resolveIdentityFromPayload(
    payload,
    options?.collectionIdentity,
  );
  payload.projectName = identity.projectName;
  payload.collectionName = identity.collectionName;
  payload.campaignName = identity.campaignName;
  payload.title = asString(payload.title) || identity.projectName;

  const coreEmpty =
    !Array.isArray(payload.corePackage) || payload.corePackage.length === 0;
  if (coreEmpty && hasLegacyImageFields(payload)) {
    const migrated = migrateLegacyImageSections(
      payload as unknown as BrainImageSections,
      identity.collectionName,
    );
    payload.corePackage = migrated.corePackage ?? [];
    payload.advancedPackage = migrated.advancedPackage ?? [];
    if (migrated.campaignShots?.length) {
      payload.campaignShots = migrated.campaignShots;
    }
    if (migrated.sourceReportTitles?.length) {
      payload.sourceReportTitles = migrated.sourceReportTitles;
    }
    adjustments.push("migrated legacy top-level fields to V2 packages");
  }

  if (typeof payload.moodboard === "string") {
    adjustments.push("converted string moodboard to V2 object");
  }
  payload.moodboard = normalizeMoodboard(payload.moodboard, identity);

  if (Array.isArray(payload.palette)) {
    adjustments.push("converted array palette to V2 object");
  }
  payload.palette = normalizePalette(payload.palette);

  const coreRaw = Array.isArray(payload.corePackage) ? payload.corePackage : [];
  const core = ensureCoreCoverage(
    coreRaw
      .map((entry, index) =>
        normalizeAsset(entry, index, identity, "core", CORE_ASSET_SPECS),
      )
      .filter((item): item is LegacyNormalizedImageAsset => Boolean(item)),
    identity,
  );
  payload.corePackage = core;
  adjustments.push(`normalized core package for ${identity.collectionName}`);

  const advancedRaw = Array.isArray(payload.advancedPackage)
    ? payload.advancedPackage
    : [];
  const advanced = ensureAdvancedCoverage(
    advancedRaw
      .map((entry, index) =>
        normalizeAsset(entry, index, identity, "advanced", ADVANCED_ASSET_SPECS),
      )
      .filter((item): item is LegacyNormalizedImageAsset => Boolean(item)),
    identity,
  );
  payload.advancedPackage = advanced;
  adjustments.push(`normalized advanced package for ${identity.collectionName}`);

  const shotsRaw = Array.isArray(payload.campaignShots)
    ? payload.campaignShots
    : [];
  const normalizedShots = normalizeCampaignShots(shotsRaw, identity);
  if (normalizedShots.length !== shotsRaw.length || shotsRaw.length < 12) {
    adjustments.push("normalized campaignShots to V2 schema");
  }
  payload.campaignShots = normalizedShots;

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

  const stripped = stripLegacyImageFields(payload);
  if (stripped.length > 0) {
    adjustments.push(`stripped legacy fields: ${stripped.join(", ")}`);
  }

  adjustments.push("enriched V2 image packages");
  return adjustments;
}

/** Build a schemaVersion 2.0-only image project payload from enriched data. */
export function buildV2ImageOutput(
  payload: Record<string, unknown>,
  options?: EnrichImageOptions,
): Record<string, unknown> {
  enrichImagePayload(payload, options);
  return {
    title: payload.title,
    reportType: payload.reportType,
    schemaVersion: IMAGE_SCHEMA_VERSION_V2,
    projectName: payload.projectName,
    moodboard: payload.moodboard,
    palette: payload.palette,
    corePackage: payload.corePackage,
    advancedPackage: payload.advancedPackage,
    campaignShots: payload.campaignShots,
    confidence: payload.confidence,
    sourceReportTitles: payload.sourceReportTitles,
    fullProject: payload.fullProject,
  };
}
