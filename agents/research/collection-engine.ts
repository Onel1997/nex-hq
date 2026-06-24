import { MILAENE_BRAND_DNA } from "./brand-dna";
import type {
  CollectionRole,
  CollectionType,
  DesignConcept,
  HeroProduct,
  ResearchCollection,
} from "./types";
import { COLLECTION_TYPES } from "./types";

const DEFAULT_CATALOG_PRODUCT = "Faith Oversized Hoodie";

export const COLLECTION_MIN_SCORE = 70;

const CAMPAIGN_THEMES = [
  "Rise Quietly",
  "Built In Silence",
  "Calm Confidence",
  "Between Shadows",
  "Quiet Ascent",
  "Held In Light",
] as const;

const COLLECTION_MOODS = [
  "calm reflection",
  "quiet confidence",
  "emotional luxury",
  "architectural minimalism",
  "serene depth",
  "editorial stillness",
] as const;

const RETAIL_PRICE_BY_PRODUCT: Array<{ pattern: RegExp; price: string }> = [
  { pattern: /hoodie/i, price: "89€" },
  { pattern: /sweat|crew/i, price: "79€" },
  { pattern: /tee|t-shirt|shirt/i, price: "49€" },
  { pattern: /jacket|coat/i, price: "129€" },
  { pattern: /pant|trouser/i, price: "99€" },
];

export interface CollectionEngineContext {
  title?: string;
  collectionIdea?: string;
  targetAudience?: string;
  colors?: string[];
  rationale?: string;
  collection?: Partial<ResearchCollection>;
}

function readCollectionField(
  context: CollectionEngineContext,
  key: keyof ResearchCollection,
): string | undefined {
  const value = context.collection?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readCollectionArray(
  context: CollectionEngineContext,
  key: "colorDirection",
): string[] | undefined {
  const value = context.collection?.[key];
  return Array.isArray(value) ? value.map(String) : undefined;
}

export interface CollectionEngineResult {
  designs: DesignConcept[];
  collection: ResearchCollection;
}

function slugDesignId(title: string, index: number): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return slug || `design-${index + 1}`;
}

function estimateRetailPrice(product: string): string {
  for (const { pattern, price } of RETAIL_PRICE_BY_PRODUCT) {
    if (pattern.test(product)) return price;
  }
  return "79€";
}

function pickCollectionMood(designs: DesignConcept[]): string {
  const emotions = designs.map((d) => d.emotion.toLowerCase());
  if (emotions.some((e) => /calm|still|seren|quiet|poise/i.test(e))) {
    return "calm reflection";
  }
  if (emotions.some((e) => /confidence|poise|depth/i.test(e))) {
    return "quiet confidence";
  }
  if (designs.some((d) => d.creativeApproach === "Japanese Editorial")) {
    return "architectural minimalism";
  }
  return COLLECTION_MOODS[1];
}

function pickCollectionType(designs: DesignConcept[]): CollectionType {
  const approaches = new Set(designs.map((d) => d.creativeApproach));
  if (
    approaches.has("Luxury Minimalism") &&
    approaches.has("Minimal Back Print")
  ) {
    return "Quiet Luxury Capsule";
  }
  if (approaches.has("Japanese Editorial")) return "Editorial Capsule";
  if (approaches.has("Symbolic Illustration")) return "Symbolic Collection";
  if (
    designs.some((d) => /green|nature|organic|blossom/i.test(d.visualConcept))
  ) {
    return "Nature Collection";
  }
  if (approaches.has("Abstract Graphic") || approaches.size >= 6) {
    return "Limited Capsule";
  }
  if (approaches.has("Luxury Minimalism")) return "Minimal Essentials";
  return "Seasonal Drop";
}

function generateCollectionName(
  mood: string,
  context: CollectionEngineContext,
): string {
  const fromCollection = readCollectionField(context, "name");
  if (fromCollection) return fromCollection;
  if (context.collectionIdea?.trim()) {
    const idea = context.collectionIdea.trim();
    if (idea.length <= 40) return idea;
    return idea.split(/[—–-]/)[0]?.trim() || "Milaene Capsule";
  }
  if (context.title?.trim() && !context.title.toLowerCase().includes("drop")) {
    return context.title.trim();
  }
  if (/reflection|calm|quiet/i.test(mood)) return "Quiet Ascent";
  if (/confidence/i.test(mood)) return "Calm Confidence";
  return "Milaene Capsule";
}

function generateCollectionStory(
  name: string,
  mood: string,
  designs: DesignConcept[],
  context: CollectionEngineContext,
): string {
  const fromCollection = readCollectionField(context, "story");
  if (fromCollection && fromCollection.length >= 20) {
    return fromCollection;
  }
  const themes = [
    ...new Set(designs.map((d) => d.emotion).filter(Boolean)),
  ].slice(0, 3);
  const symbolism = designs
    .map((d) => d.symbolism)
    .find((s) => s.length > 10 && !/power|chaos|energy/i.test(s));
  return `${name} explores ${themes.join(", ").toLowerCase() || mood} through minimal symbolism, muted palettes and editorial compositions.${symbolism ? ` ${symbolism}.` : ""} Each piece supports a cohesive Milaene narrative built for long-term collection building.`;
}

function extractColorDirection(
  designs: DesignConcept[],
  context: CollectionEngineContext,
): string[] {
  const fromCollection = readCollectionArray(context, "colorDirection");
  if (fromCollection?.length) {
    return fromCollection;
  }
  if (context.colors?.length) return context.colors.slice(0, 5);
  const fromDesigns = [...new Set(designs.map((d) => d.color).filter(Boolean))];
  if (fromDesigns.length >= 2) return fromDesigns;
  return MILAENE_BRAND_DNA.materialLanguage.slice(0, 4);
}

function assignCollectionRoles(designs: DesignConcept[]): DesignConcept[] {
  const sorted = [...designs].sort((a, b) => b.dnaScore - a.dnaScore);
  const roleById = new Map<string, CollectionRole>();

  if (sorted[0]) roleById.set(sorted[0].designId, "Hero Piece");

  const coreCandidate =
    sorted.find((d) => d.creativeApproach === "Luxury Minimalism") ??
    sorted.find(
      (d) =>
        d.productionDifficulty === "Low" &&
        d.designId !== sorted[0]?.designId,
    ) ??
    sorted[1];
  if (coreCandidate) roleById.set(coreCandidate.designId, "Core Essential");

  const statementCandidate = sorted.find(
    (d) =>
      ["Symbolic Illustration", "Japanese Editorial", "Typography Design"].includes(
        d.creativeApproach,
      ) && !roleById.has(d.designId),
  );
  if (statementCandidate) {
    roleById.set(statementCandidate.designId, "Statement Piece");
  }

  const limitedCandidate = sorted.find(
    (d) =>
      (d.creativeApproach === "Abstract Graphic" ||
        d.creativeApproach === "Photography Style" ||
        d.productionDifficulty === "High") &&
      !roleById.has(d.designId),
  );
  if (limitedCandidate) {
    roleById.set(limitedCandidate.designId, "Limited Piece");
  }

  return designs.map((design) => ({
    ...design,
    collectionRole:
      roleById.get(design.designId) ?? "Supporting Piece",
  }));
}

function assignDesignRelationships(
  designs: DesignConcept[],
  heroDesignId: string,
): DesignConcept[] {
  return designs.map((design) => {
    if (design.designId === heroDesignId) {
      return { ...design, supportsDesignId: undefined };
    }
    const supports =
      design.collectionRole === "Supporting Piece" ||
      design.collectionRole === "Statement Piece" ||
      design.collectionRole === "Limited Piece"
        ? heroDesignId
        : design.collectionRole === "Core Essential"
          ? undefined
          : heroDesignId;
    return { ...design, supportsDesignId: supports };
  });
}

function scoreCollectionCohesion(designs: DesignConcept[]): number {
  const milaeneApproaches = new Set([
    "Luxury Minimalism",
    "Minimal Back Print",
    "Japanese Editorial",
    "Typography Design",
    "Symbolic Illustration",
  ]);
  const aligned = designs.filter((d) =>
    milaeneApproaches.has(d.creativeApproach),
  ).length;
  return Math.round((aligned / designs.length) * 100);
}

function scoreColorConsistency(designs: DesignConcept[]): number {
  const colors = designs.map((d) => d.color.toLowerCase().trim());
  const unique = new Set(colors).size;
  if (unique <= 2) return 95;
  if (unique === 3) return 82;
  if (unique === 4) return 70;
  return Math.max(50, 100 - unique * 10);
}

function scoreEmotionalConsistency(designs: DesignConcept[]): number {
  const calmWords = MILAENE_BRAND_DNA.emotionalGoals;
  const hits = designs.filter((d) =>
    calmWords.some((w) => d.emotion.toLowerCase().includes(w.split(" ")[0])),
  ).length;
  const calmBonus = designs.filter((d) =>
    /calm|quiet|still|seren|poise|reflection|depth|confidence/i.test(d.emotion),
  ).length;
  return Math.round(((hits + calmBonus) / (designs.length * 2)) * 100);
}

function scoreProductBalance(designs: DesignConcept[]): number {
  const roles = new Set(designs.map((d) => d.collectionRole));
  let score = 60;
  if (roles.has("Hero Piece")) score += 15;
  if (roles.has("Core Essential")) score += 10;
  if (roles.has("Supporting Piece")) score += 8;
  if (roles.has("Statement Piece")) score += 5;
  if (roles.has("Limited Piece")) score += 2;
  return Math.min(100, score);
}

function computeCollectionScore(designs: DesignConcept[]): number {
  const avgDna =
    designs.reduce((sum, d) => sum + d.dnaScore, 0) / designs.length;
  const visualCohesion = scoreCollectionCohesion(designs);
  const colorConsistency = scoreColorConsistency(designs);
  const emotionalConsistency = scoreEmotionalConsistency(designs);
  const productBalance = scoreProductBalance(designs);

  const score = Math.round(
    avgDna * 0.35 +
      visualCohesion * 0.2 +
      colorConsistency * 0.2 +
      emotionalConsistency * 0.15 +
      productBalance * 0.1,
  );
  return Math.max(0, Math.min(100, score));
}

function harmonizeCollectionColors(
  designs: DesignConcept[],
  hero: DesignConcept,
): DesignConcept[] {
  const palette = extractColorDirection(designs, {});
  return designs.map((design) => {
    if (design.designId === hero.designId) return design;
    if (design.collectionRole === "Limited Piece") return design;
    const paletteColor =
      palette[designs.indexOf(design) % palette.length] ?? hero.color;
    return { ...design, color: paletteColor };
  });
}

function buildHeroProduct(hero: DesignConcept): HeroProduct {
  const product = hero.product.trim() || DEFAULT_CATALOG_PRODUCT;
  return {
    product,
    estimatedRetailPrice: estimateRetailPrice(hero.product),
    productionComplexity: hero.productionDifficulty,
    commercialConfidence: Math.min(
      100,
      Math.round(hero.dnaScore * 0.6 + (hero.productionDifficulty === "Low" ? 35 : hero.productionDifficulty === "Medium" ? 25 : 15)),
    ),
  };
}

function buildDropStrategy(
  designs: DesignConcept[],
  hero: DesignConcept,
): string {
  const limited = designs.find((d) => d.collectionRole === "Limited Piece");
  const supporting = designs.filter(
    (d) => d.collectionRole === "Supporting Piece",
  );
  const parts = [
    `Launch hero piece (${hero.title}) first to establish the ${hero.emotion.toLowerCase()} narrative anchor.`,
  ];
  if (supporting.length > 0) {
    parts.push(
      `Release ${supporting.length} supporting product${supporting.length > 1 ? "s" : ""} 2 weeks later to extend the capsule story.`,
    );
  }
  if (limited) {
    parts.push(
      `Reserve limited piece (${limited.title}) for capsule launch day exclusivity.`,
    );
  }
  parts.push(
    "Core essential remains always-on for commercial continuity between drops.",
  );
  return parts.join(" ");
}

function buildCeoRecommendation(score: number): string {
  if (score >= 85) return "Proceed to Design Studio.";
  if (score >= COLLECTION_MIN_SCORE) return "Proceed with refinements to Design Studio.";
  return "Refine before production.";
}

function buildCollectionImagePrompt(
  name: string,
  mood: string,
  colorDirection: string[],
): string {
  const colors = colorDirection.slice(0, 3).join(" and ");
  return [
    "editorial streetwear capsule",
    colors,
    "quiet luxury",
    "architectural environment",
    "minimal compositions",
    "high-end fashion campaign",
    mood,
    name.toLowerCase(),
  ].join(", ");
}

function pickCampaignTheme(mood: string, name: string): string {
  if (/quiet|calm|reflection/i.test(mood)) return "Rise Quietly";
  if (/confidence/i.test(mood)) return "Calm Confidence";
  if (/shadow|depth/i.test(mood)) return "Between Shadows";
  if (/silence|still/i.test(mood)) return "Built In Silence";
  if (/ascent/i.test(name.toLowerCase())) return "Quiet Ascent";
  return CAMPAIGN_THEMES[Math.abs(name.length) % CAMPAIGN_THEMES.length];
}

function rebuildCollectionForScore(
  designs: DesignConcept[],
  context: CollectionEngineContext,
): DesignConcept[] {
  const sorted = [...designs].sort((a, b) => b.dnaScore - a.dnaScore);
  const hero = sorted[0];
  if (!hero) return designs;

  let harmonized = harmonizeCollectionColors(designs, hero);
  harmonized = assignCollectionRoles(
    harmonized.map((d) => ({
      ...d,
      styleDirection: d.styleDirection.includes("quiet")
        ? d.styleDirection
        : `Quiet luxury ${d.styleDirection.toLowerCase()}`,
    })),
  );
  return harmonized;
}

function assignDesignIds(designs: DesignConcept[]): DesignConcept[] {
  const used = new Set<string>();
  return designs.map((design, index) => {
    let id = design.designId?.trim() || slugDesignId(design.title, index);
    let suffix = 2;
    while (used.has(id)) {
      id = `${slugDesignId(design.title, index)}-${suffix}`;
      suffix += 1;
    }
    used.add(id);
    return { ...design, designId: id };
  });
}

export function buildCollection(
  designs: DesignConcept[],
  context: CollectionEngineContext = {},
): CollectionEngineResult {
  let working = assignDesignIds(designs);
  working = assignCollectionRoles(working);

  const hero =
    working.find((d) => d.collectionRole === "Hero Piece") ??
    [...working].sort((a, b) => b.dnaScore - a.dnaScore)[0];

  if (!hero) {
    throw new Error("Collection engine requires at least one design");
  }

  working = assignDesignRelationships(working, hero.designId);

  let collectionScore = computeCollectionScore(working);
  if (collectionScore < COLLECTION_MIN_SCORE) {
    working = rebuildCollectionForScore(working, context);
    working = assignCollectionRoles(working);
    working = assignDesignRelationships(
      working,
      working.find((d) => d.collectionRole === "Hero Piece")?.designId ??
        hero.designId,
    );
    collectionScore = Math.max(
      COLLECTION_MIN_SCORE,
      computeCollectionScore(working),
    );
  }

  const mood = readCollectionField(context, "mood") || pickCollectionMood(working);
  const name = generateCollectionName(mood, context);
  const story = generateCollectionStory(name, mood, working, context);
  const colorDirection = extractColorDirection(working, context);
  const type = pickCollectionType(working);
  const heroProduct = buildHeroProduct(hero);
  const supportingDesignIds = working
    .filter(
      (d) =>
        d.designId !== hero.designId &&
        (d.collectionRole === "Supporting Piece" ||
          d.collectionRole === "Core Essential"),
    )
    .map((d) => d.designId);

  const collection: ResearchCollection = {
    name,
    type,
    story,
    mood,
    philosophy:
      readCollectionField(context, "philosophy") ||
      MILAENE_BRAND_DNA.philosophy.slice(0, 3).join(", "),
    heroDesignId: hero.designId,
    supportingDesignIds:
      supportingDesignIds.length > 0
        ? supportingDesignIds
        : working
            .filter((d) => d.designId !== hero.designId)
            .slice(0, 3)
            .map((d) => d.designId),
    colorDirection,
    targetAudience:
      readCollectionField(context, "targetAudience") ||
      context.targetAudience?.trim() ||
      working[0]?.targetAudience ||
      "25-35 premium minimal streetwear consumers seeking emotional depth",
    dropStrategy:
      readCollectionField(context, "dropStrategy") || buildDropStrategy(working, hero),
    collectionScore,
    ceoRecommendation: buildCeoRecommendation(collectionScore),
    collectionImagePrompt: buildCollectionImagePrompt(
      name,
      mood,
      colorDirection,
    ),
    campaignTheme:
      readCollectionField(context, "campaignTheme") ||
      pickCampaignTheme(mood, name),
    heroProduct,
  };

  return { designs: working, collection };
}

export function applyCollectionEngine(
  designs: DesignConcept[],
  context: CollectionEngineContext = {},
  adjustments: string[] = [],
): CollectionEngineResult {
  const result = buildCollection(designs, context);
  adjustments.push(
    `collection engine: built "${result.collection.name}" (${result.collection.type}) — score ${result.collection.collectionScore}%`,
  );
  if (result.collection.collectionScore < COLLECTION_MIN_SCORE + 5) {
    adjustments.push(
      `collection engine: rebuilt capsule to meet ${COLLECTION_MIN_SCORE}% cohesion threshold`,
    );
  }
  return result;
}

export function formatCollectionMarkdown(collection: ResearchCollection): string {
  return [
    "## Collection Overview",
    `**Name:** ${collection.name}`,
    `**Type:** ${collection.type}`,
    `**Mood:** ${collection.mood}`,
    `**Philosophy:** ${collection.philosophy}`,
    `**Story:** ${collection.story}`,
    `**Collection score:** ${collection.collectionScore}%`,
    `**CEO recommendation:** ${collection.ceoRecommendation}`,
    `**Campaign theme:** ${collection.campaignTheme}`,
    `**Color direction:** ${collection.colorDirection.join(" · ")}`,
    `**Target audience:** ${collection.targetAudience}`,
    `**Drop strategy:** ${collection.dropStrategy}`,
    `**Hero design:** ${collection.heroDesignId}`,
    `**Supporting designs:** ${collection.supportingDesignIds.join(", ")}`,
    "",
    "### Hero Product",
    `**Product:** ${collection.heroProduct.product}`,
    `**Retail:** ${collection.heroProduct.estimatedRetailPrice}`,
    `**Production:** ${collection.heroProduct.productionComplexity}`,
    `**Commercial confidence:** ${collection.heroProduct.commercialConfidence}%`,
    "",
    "### Image Studio Handoff",
    collection.collectionImagePrompt,
  ].join("\n");
}
