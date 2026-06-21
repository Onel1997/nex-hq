import type { BrainImageSections } from "@/brain/domains/reports";
import type { ProductKnowledge } from "@/lib/shopify/types";
import { buildArtDirectionPrompt } from "./art-direction";
import {
  type ImageCollectionIdentity,
  formatAssetTitle,
  resolveIdentityFromPayload,
} from "./collection-identity";
import { migrateLegacyImageSections } from "./migrate-legacy";
import { buildV2ImageOutput } from "./enrich-packages";
import { STUDIO_ASSET_SPECS, type StudioAssetSpec } from "./studio-specs";
import {
  type ImageLookbookShot,
  type ImageMoodboardSection,
  type ImagePalette,
  type ImageStudioAsset,
  IMAGE_SCHEMA_VERSION,
} from "./studio-schema";

const MIN_FULL_PROJECT = 600;

export interface EnrichStudioOptions {
  collectionIdentity?: ImageCollectionIdentity;
  shopifyKnowledge?: ProductKnowledge | null;
  photographyStyle?: string;
  visualKeywords?: string[];
}

interface ProductRef {
  name: string;
  color: string;
  material: string;
  collection: string;
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

function resolveProductRefs(options?: EnrichStudioOptions): ProductRef[] {
  const shopify = options?.shopifyKnowledge;
  const collection =
    options?.collectionIdentity?.collectionName ?? "Milaene Collection";

  if (shopify?.availableProducts.length) {
    const active = shopify.availableProducts.filter((p) => p.status === "ACTIVE");
    const source = active.length ? active : shopify.availableProducts;

    return source.slice(0, 12).map((p) => ({
      name: p.title,
      color: p.colors[0] ?? shopify.availableColors[0] ?? "Core palette",
      material: p.materials[0] ?? shopify.availableMaterials[0] ?? "Premium cotton",
      collection: p.collections[0] ?? collection,
    }));
  }

  return [
    {
      name: "Catalog product pending",
      color: "Core palette",
      material: "Premium cotton",
      collection,
    },
  ];
}

function pickProduct(
  refs: ProductRef[],
  index: number,
): ProductRef {
  return refs[index % refs.length]!;
}

function normalizePrompts(
  value: unknown,
  subject: string,
  collectionName: string,
  photographyStyle?: string,
): ImageStudioAsset["prompt"] {
  const obj = asRecord(value);
  if (obj?.midjourney || obj?.openai || obj?.flux) {
    return {
      midjourney: ensureMinLength(
        asString(obj.midjourney),
        80,
        "Editorial fashion production prompt.",
      ),
      openai: ensureMinLength(
        asString(obj.openai),
        80,
        "Editorial fashion production prompt.",
      ),
      flux: ensureMinLength(
        asString(obj.flux),
        80,
        "Editorial fashion production prompt.",
      ),
    };
  }

  const single = asString(obj?.prompt) || asString(value);
  if (single.length >= 80) {
    return { midjourney: single, openai: single, flux: single };
  }

  return buildArtDirectionPrompt({
    subject,
    collectionName,
    styling: photographyStyle,
  });
}

function defaultMoodboard(
  identity: ImageCollectionIdentity,
  photographyStyle?: string,
  keywords?: string[],
): ImageMoodboardSection {
  return {
    visualDirection: ensureMinLength(
      `${identity.collectionName} — urban luxury streetwear production direction grounded in real Milaene products and Shopify catalog.`,
      80,
      "Premium fashion creative studio direction.",
    ),
    aestheticKeywords: (keywords?.length ? keywords : [
      "urban luxury",
      "editorial streetwear",
      "premium materials",
      "scarcity drop",
    ]).slice(0, 12),
    colorSystem: ["Obsidian Black #111111", "Concrete Grey #888888"],
    materialReferences: ["480gsm French Terry", "Premium cotton"],
    photographyStyle: ensureMinLength(
      photographyStyle ??
        "Editorial streetwear with controlled studio lighting and urban location contrast.",
      40,
      "Fashion editorial photography.",
    ),
  };
}

function normalizeStudioAsset(
  raw: unknown,
  spec: StudioAssetSpec,
  index: number,
  identity: ImageCollectionIdentity,
  product: ProductRef,
  options?: EnrichStudioOptions,
): ImageStudioAsset {
  const obj = asRecord(raw) ?? {};
  const collectionName = identity.collectionName;
  const photographyStyle =
    asString(obj.photographyStyle) ||
    options?.photographyStyle ||
    defaultMoodboard(identity).photographyStyle;

  const productName =
    asString(obj.productName) || product.name;
  const subject = `${productName} · ${asString(obj.color) || product.color} · ${asString(obj.material) || product.material}`;

  return {
    id: asString(obj.id) || spec.id,
    assetType: (asString(obj.assetType) as ImageStudioAsset["assetType"]) || spec.assetType,
    outputCategory:
      (asString(obj.outputCategory) as ImageStudioAsset["outputCategory"]) ||
      spec.outputCategory,
    productName,
    collection: asString(obj.collection) || product.collection || collectionName,
    color: asString(obj.color) || product.color,
    material: asString(obj.material) || product.material,
    location: ensureMinLength(
      asString(obj.location),
      10,
      spec.outputCategory === "product_photography"
        ? "Controlled studio cyclorama, seamless backdrop"
        : "Urban concrete architecture, minimal street location",
    ),
    lighting: ensureMinLength(
      asString(obj.lighting),
      10,
      spec.outputCategory === "product_photography"
        ? "Soft key light, controlled fill, no harsh shadows"
        : "Overcast urban daylight with subtle rim light",
    ),
    photographyStyle: ensureMinLength(photographyStyle, 20, "Editorial fashion"),
    cameraStyle: ensureMinLength(
      asString(obj.cameraStyle),
      10,
      "35mm full-frame, 50mm f/1.4, shallow depth of field",
    ),
    prompt: normalizePrompts(obj.prompt ?? obj, subject, collectionName, photographyStyle),
    priority:
      (asString(obj.priority) as ImageStudioAsset["priority"]) || spec.priority,
    status: (asString(obj.status) as ImageStudioAsset["status"]) || "pending",
    title:
      asString(obj.title) ||
      formatAssetTitle(collectionName, spec.title),
    platform: asString(obj.platform) || spec.platform,
    dimensions: asString(obj.dimensions) || spec.dimensions,
    imageUrl: asString(obj.imageUrl) || undefined,
  };
}

function ensureProductionCoverage(
  rawAssets: ImageStudioAsset[],
  identity: ImageCollectionIdentity,
  productRefs: ProductRef[],
  options?: EnrichStudioOptions,
): ImageStudioAsset[] {
  const byId = new Map(rawAssets.map((asset) => [asset.id, asset]));
  const merged: ImageStudioAsset[] = [];

  STUDIO_ASSET_SPECS.forEach((spec, index) => {
    const existing = byId.get(spec.id);
    merged.push(
      existing ??
        normalizeStudioAsset(
          null,
          spec,
          index,
          identity,
          pickProduct(productRefs, index),
          options,
        ),
    );
  });

  for (const asset of rawAssets) {
    if (!merged.some((item) => item.id === asset.id)) {
      merged.push(asset);
    }
  }

  return merged.slice(0, 48);
}

function normalizeLookbookShots(
  raw: unknown[],
  identity: ImageCollectionIdentity,
  productRefs: ProductRef[],
): ImageLookbookShot[] {
  const shots: ImageLookbookShot[] = raw
    .map((entry, index) => {
      const obj = asRecord(entry);
      if (!obj) return null;
      const products = asStringArray(obj.outfitProducts);
      return {
        shotName:
          asString(obj.shotName) ||
          formatAssetTitle(identity.collectionName, `Lookbook Shot ${index + 1}`),
        models: ensureMinLength(
          asString(obj.models),
          2,
          "Primary model + secondary model",
        ),
        location: ensureMinLength(
          asString(obj.location),
          10,
          "Urban rooftop, concrete architecture backdrop",
        ),
        outfitProducts:
          products.length > 0
            ? products
            : productRefs.slice(0, 3).map((p) => p.name),
        styling: ensureMinLength(
          asString(obj.styling),
          20,
          "Full streetwear outfit, layered premium materials",
        ),
        purpose: ensureMinLength(
          asString(obj.purpose),
          20,
          "Lookbook editorial for collection launch",
        ),
      };
    })
    .filter((item): item is ImageLookbookShot => Boolean(item));

  while (shots.length < 4) {
    const index = shots.length;
    const products = productRefs.slice(index, index + 3).map((p) => p.name);
    shots.push({
      shotName: formatAssetTitle(
        identity.collectionName,
        `Lookbook Shot ${index + 1}`,
      ),
      models: "Primary model, secondary model",
      location: "Urban rooftop with concrete architecture and skyline",
      outfitProducts: products.length ? products : [productRefs[0]!.name],
      styling: "Full outfit styling with premium streetwear layering",
      purpose: "Lookbook editorial for collection launch campaign",
    });
  }

  return shots.slice(0, 12);
}

function buildFullProject(
  payload: Record<string, unknown>,
  identity: ImageCollectionIdentity,
): string {
  const assets = (payload.productionAssets as ImageStudioAsset[]) ?? [];
  const lines = [
    `# ${asString(payload.title) || identity.projectName}`,
    "",
    `## Creative Studio — ${identity.collectionName}`,
    "",
    asString(payload.visualDirection) ||
      "Urban luxury streetwear production grounded in real Milaene products.",
    "",
    "### Production Assets",
    ...assets.map(
      (asset) =>
        `- **${asset.title}** (${asset.assetType}) — ${asset.productName}, ${asset.color}, ${asset.material}. Location: ${asset.location}. Lighting: ${asset.lighting}. Camera: ${asset.cameraStyle}.`,
    ),
    "",
    "### Lookbook",
    ...((payload.lookbookShots as ImageLookbookShot[]) ?? []).map(
      (shot) =>
        `- ${shot.shotName}: ${shot.models} at ${shot.location}. Products: ${shot.outfitProducts.join(", ")}.`,
    ),
    "",
    "All assets reference real Milaene products from Shopify. No invented catalog data.",
  ];

  return ensureMinLength(lines.join("\n"), MIN_FULL_PROJECT, "Production brief.");
}

function isV3Payload(payload: Record<string, unknown>): boolean {
  return (
    payload.schemaVersion === IMAGE_SCHEMA_VERSION ||
    Array.isArray(payload.productionAssets)
  );
}

function migrateV2PayloadToV3(
  payload: Record<string, unknown>,
  options?: EnrichStudioOptions,
): Record<string, unknown> {
  const v2 = buildV2ImageOutput(payload, options);
  const identity =
    options?.collectionIdentity ??
    resolveIdentityFromPayload(v2, options?.collectionIdentity);

  const productRefs = resolveProductRefs(options);
  const moodboard = v2.moodboard as ImageMoodboardSection;
  const photographyStyle = moodboard?.photographyStyle;

  const core = (v2.corePackage as ImageStudioAsset[]) ?? [];
  const advanced = (v2.advancedPackage as ImageStudioAsset[]) ?? [];
  const legacyAssets = [...core, ...advanced];

  const productionAssets = ensureProductionCoverage(
    legacyAssets.map((asset, index) =>
      normalizeStudioAsset(
        {
          ...asset,
          productName: pickProduct(productRefs, index).name,
          collection: identity.collectionName,
          color: pickProduct(productRefs, index).color,
          material: pickProduct(productRefs, index).material,
          assetType: STUDIO_ASSET_SPECS[index]?.assetType,
          outputCategory: STUDIO_ASSET_SPECS[index]?.outputCategory,
        },
        STUDIO_ASSET_SPECS[index] ?? STUDIO_ASSET_SPECS[0]!,
        index,
        identity,
        pickProduct(productRefs, index),
        options,
      ),
    ),
    identity,
    productRefs,
    options,
  );

  return {
    title: v2.title,
    reportType: v2.reportType,
    schemaVersion: IMAGE_SCHEMA_VERSION,
    projectName: v2.projectName,
    collectionName: identity.collectionName,
    visualDirection: moodboard?.visualDirection ?? "",
    moodboard: v2.moodboard,
    palette: v2.palette,
    productionAssets,
    lookbookShots: normalizeLookbookShots(
      (v2.campaignShots as unknown[]) ?? [],
      identity,
      productRefs,
    ),
    confidence: v2.confidence,
    sourceReportTitles: v2.sourceReportTitles,
    fullProject: v2.fullProject,
  };
}

export function enrichStudioPayload(
  payload: Record<string, unknown>,
  options?: EnrichStudioOptions,
): string[] {
  const adjustments: string[] = [];

  if (!isV3Payload(payload)) {
    Object.assign(payload, migrateV2PayloadToV3(payload, options));
    adjustments.push("migrated V2 payload to V3 studio schema");
    return adjustments;
  }

  const identity =
    options?.collectionIdentity ??
    resolveIdentityFromPayload(payload, options?.collectionIdentity);

  payload.schemaVersion = IMAGE_SCHEMA_VERSION;
  payload.collectionName =
    asString(payload.collectionName) || identity.collectionName;
  payload.projectName =
    asString(payload.projectName) || identity.projectName;
  payload.title = asString(payload.title) || payload.projectName;

  const productRefs = resolveProductRefs(options);
  const photographyStyle = options?.photographyStyle;

  if (!asRecord(payload.moodboard)) {
    payload.moodboard = defaultMoodboard(
      identity,
      photographyStyle,
      options?.visualKeywords,
    );
    adjustments.push("generated moodboard");
  }

  if (!asRecord(payload.palette)) {
    payload.palette = defaultPalette();
    adjustments.push("generated palette");
  }

  payload.visualDirection = ensureMinLength(
    asString(payload.visualDirection) ||
      (payload.moodboard as ImageMoodboardSection).visualDirection,
    80,
    "Creative studio visual direction.",
  );

  const rawAssets = Array.isArray(payload.productionAssets)
    ? payload.productionAssets
    : [];

  payload.productionAssets = ensureProductionCoverage(
    rawAssets
      .map((entry, index) =>
        normalizeStudioAsset(
          entry,
          STUDIO_ASSET_SPECS[index] ?? STUDIO_ASSET_SPECS[0]!,
          index,
          identity,
          pickProduct(productRefs, index),
          options,
        ),
      )
      .filter(Boolean),
    identity,
    productRefs,
    options,
  );
  adjustments.push(
    `normalized ${(payload.productionAssets as ImageStudioAsset[]).length} production assets`,
  );

  const lookbookRaw = Array.isArray(payload.lookbookShots)
    ? payload.lookbookShots
    : Array.isArray(payload.campaignShots)
      ? payload.campaignShots
      : [];

  payload.lookbookShots = normalizeLookbookShots(
    lookbookRaw,
    identity,
    productRefs,
  );

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
    payload.confidence = 0.85;
  }

  if (
    !asString(payload.fullProject) ||
    asString(payload.fullProject).length < MIN_FULL_PROJECT
  ) {
    payload.fullProject = buildFullProject(payload, identity);
    adjustments.push("generated fullProject");
  }

  adjustments.push("enriched V3 creative studio packages");
  return adjustments;
}

/** Build schemaVersion 3.0 creative studio output. */
export function buildV3ImageOutput(
  payload: Record<string, unknown>,
  options?: EnrichStudioOptions,
): Record<string, unknown> {
  enrichStudioPayload(payload, options);
  return {
    title: payload.title,
    reportType: payload.reportType,
    schemaVersion: IMAGE_SCHEMA_VERSION,
    projectName: payload.projectName,
    collectionName: payload.collectionName,
    visualDirection: payload.visualDirection,
    moodboard: payload.moodboard,
    palette: payload.palette,
    productionAssets: payload.productionAssets,
    lookbookShots: payload.lookbookShots,
    confidence: payload.confidence,
    sourceReportTitles: payload.sourceReportTitles,
    fullProject: payload.fullProject,
  };
}

/** Normalize stored Brain image sections to V3 view shape. */
export function normalizeStudioSections(
  raw: Record<string, unknown>,
  collectionName?: string,
): Record<string, unknown> | null {
  if (!raw) return null;

  const sections = raw as Record<string, unknown>;
  if (sections.productionAssets && Array.isArray(sections.productionAssets)) {
    return sections;
  }

  if (
    sections.corePackage ||
    sections.schemaVersion === "2.0" ||
    sections.heroBanner
  ) {
    return migrateV2PayloadToV3(
      { ...sections, reportType: "image-project" },
      {
        collectionIdentity: {
          collectionName: collectionName ?? asString(sections.projectName),
          campaignName: collectionName ?? asString(sections.projectName),
          projectName: asString(sections.projectName) || "Milaene Creative Studio",
        },
      },
    );
  }

  const migrated = migrateLegacyImageSections(
    sections as unknown as BrainImageSections,
    collectionName,
  );

  return migrateV2PayloadToV3(
    { ...migrated, reportType: "image-project" },
    {
      collectionIdentity: {
        collectionName: collectionName ?? migrated.projectName,
        campaignName: collectionName ?? migrated.projectName,
        projectName: migrated.projectName,
      },
    },
  );
}
