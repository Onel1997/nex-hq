import { applyBrandDnaAnalysis } from "./brand-dna";
import {
  enrichDesignRelationships,
  ROLE_DNA_MINIMUMS,
} from "./collection-intelligence";
import {
  normalizeDesignPrintArea,
  visualConceptFingerprint,
} from "./design-concept";
import { REGEN_DNA_TARGET } from "./hero-regeneration";
import {
  COLLECTION_ARC,
  COLLECTION_ROLES,
  type CollectionDnaRankingEntry,
  type CollectionRole,
  type CreativeApproach,
  type DesignConcept,
  type DesignResearchOutput,
  type HeroAnalysis,
  type RelationshipGraphNode,
  type ResearchCollection,
  type StoryPosition,
} from "./types";

const ROLE_TO_ARC: Record<CollectionRole, StoryPosition> = {
  "Hero Piece": "Reflection",
  "Core Essential": "Introduction",
  "Statement Piece": "Tension",
  "Supporting Piece": "Resolution",
  "Limited Piece": "Closure",
};

const LAUNCH_ORDER_ROLES: CollectionRole[] = [
  "Hero Piece",
  "Supporting Piece",
  "Statement Piece",
  "Core Essential",
  "Limited Piece",
];

const NON_HERO_ROLES: CollectionRole[] = [
  "Core Essential",
  "Statement Piece",
  "Supporting Piece",
  "Limited Piece",
];

interface RoleFallbackProfile {
  approach: CreativeApproach;
  titleLabel: string;
  emotion: string;
  product: string;
  printArea: string;
  productionDifficulty: DesignConcept["productionDifficulty"];
  visualConcept: string;
  designDescription: string;
  printSize: string;
}

const ROLE_FALLBACK_PROFILES: Record<CollectionRole, RoleFallbackProfile> = {
  "Hero Piece": {
    approach: "Japanese Editorial",
    titleLabel: "Campaign Hero",
    emotion: "Presence",
    product: "Faith Oversized Hoodie",
    printArea: "Front",
    productionDifficulty: "Medium",
    visualConcept: "Campaign-scale editorial centerpiece with dominant focal hierarchy",
    designDescription: "Launch hero with campaign-scale symbolic presence",
    printSize: "30 cm editorial graphic",
  },
  "Core Essential": {
    approach: "Luxury Minimalism",
    titleLabel: "Core Essential Tee",
    emotion: "Calm",
    product: "Faith Tee",
    printArea: "Front",
    productionDifficulty: "Low",
    visualConcept:
      "Wearable commercial essential — minimal chest mark with quiet luxury restraint and repeatable everyday appeal",
    designDescription:
      "Commercial foundation piece — simple, distinct, and always-on for capsule continuity",
    printSize: "8 cm minimal chest mark",
  },
  "Statement Piece": {
    approach: "Symbolic Illustration",
    titleLabel: "Statement Graphic",
    emotion: "Depth",
    product: "Faith Oversized Hoodie",
    printArea: "Back",
    productionDifficulty: "Medium",
    visualConcept:
      "Stronger symbolic graphic with layered illustration — artistic peak without replacing the hero anchor",
    designDescription:
      "Statement expression with bolder symbolism and editorial back placement",
    printSize: "26 cm back graphic",
  },
  "Supporting Piece": {
    approach: "Minimal Back Print",
    titleLabel: "Supporting Quiet",
    emotion: "Reflection",
    product: "Faith Hoodie",
    printArea: "Back",
    productionDifficulty: "Low",
    visualConcept:
      "Subtle secondary piece — restrained back print that reinforces the hero without competing for attention",
    designDescription:
      "Quiet supporting design with micro back placement and narrative reinforcement",
    printSize: "6 cm back icon",
  },
  "Limited Piece": {
    approach: "Abstract Graphic",
    titleLabel: "Limited Capsule",
    emotion: "Silence",
    product: "Faith Oversized Hoodie",
    printArea: "Front",
    productionDifficulty: "High",
    visualConcept:
      "Exclusive limited expression — abstract panel with premium placement, material contrast, and drop-day exclusivity",
    designDescription:
      "Limited capsule closer with elevated production detail and experimental composition",
    printSize: "32 cm abstract front panel",
  },
};

const ROLE_PREDICATES: Record<
  CollectionRole,
  (design: DesignConcept) => boolean
> = {
  "Hero Piece": () => true,
  "Core Essential": (design) =>
    design.creativeApproach === "Luxury Minimalism" ||
    design.productionDifficulty === "Low",
  "Statement Piece": (design) =>
    ["Symbolic Illustration", "Japanese Editorial", "Typography Design"].includes(
      design.creativeApproach,
    ),
  "Supporting Piece": (design) =>
    design.creativeApproach === "Minimal Back Print" ||
    design.printArea.toLowerCase().includes("back"),
  "Limited Piece": (design) =>
    design.creativeApproach === "Abstract Graphic" ||
    design.creativeApproach === "Photography Style" ||
    design.productionDifficulty === "High",
};

export interface FinalConsistencyResult {
  designs: DesignConcept[];
  collection: ResearchCollection;
}

function extractDnaFromWhyHero(whyHero: string): number | undefined {
  const match = whyHero.match(/(\d{2,3})%\s*Milaene DNA/i);
  if (!match) return undefined;
  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function mergeHeroAnalysisIntoDesign(
  design: DesignConcept,
  heroAnalysis: HeroAnalysis | undefined,
  collection: ResearchCollection,
): DesignConcept {
  if (!heroAnalysis) {
    return { ...design, collectionRole: "Hero Piece", supportsDesignId: undefined };
  }

  const dnaFromAnalysis = extractDnaFromWhyHero(heroAnalysis.whyHero);
  const regenFloor = collection.heroRegeneration ? REGEN_DNA_TARGET : 0;
  const dnaScore = Math.max(
    design.dnaScore,
    dnaFromAnalysis ?? 0,
    regenFloor,
  );

  return {
    ...design,
    collectionRole: "Hero Piece",
    supportsDesignId: undefined,
    dnaScore,
    heroScore: heroAnalysis.heroScore,
    commercialScore: heroAnalysis.commercialScore,
    campaignPotential: heroAnalysis.campaignPotential,
  };
}

function titleApproachKey(design: DesignConcept): string {
  return `${design.title.trim().toLowerCase()}::${design.creativeApproach}`;
}

function isDuplicateDesign(
  design: DesignConcept,
  seenIds: Set<string>,
  seenTitleApproach: Set<string>,
  seenTitles: Set<string>,
  seenApproaches: Set<CreativeApproach>,
  seenFingerprints: Set<string>,
): boolean {
  const fingerprint = visualConceptFingerprint(design.visualConcept);
  const titleKey = design.title.trim().toLowerCase();

  if (seenIds.has(design.designId)) return true;
  if (seenTitleApproach.has(titleApproachKey(design))) return true;
  if (seenTitles.has(titleKey)) return true;
  if (seenApproaches.has(design.creativeApproach)) return true;
  if (fingerprint.length > 0 && seenFingerprints.has(fingerprint)) return true;

  return false;
}

function trackDesign(
  design: DesignConcept,
  seenIds: Set<string>,
  seenTitleApproach: Set<string>,
  seenTitles: Set<string>,
  seenApproaches: Set<CreativeApproach>,
  seenFingerprints: Set<string>,
): void {
  const fingerprint = visualConceptFingerprint(design.visualConcept);
  seenIds.add(design.designId);
  seenTitleApproach.add(titleApproachKey(design));
  seenTitles.add(design.title.trim().toLowerCase());
  seenApproaches.add(design.creativeApproach);
  if (fingerprint.length > 0) seenFingerprints.add(fingerprint);
}

function resolveHeroDesign(
  designs: DesignConcept[],
  collection: ResearchCollection,
): DesignConcept {
  const regenHeroId = collection.heroRegeneration?.newHeroId;
  const byRegen =
    regenHeroId && designs.find((design) => design.designId === regenHeroId);
  if (byRegen) return byRegen;

  const byCollectionId = designs.find(
    (design) => design.designId === collection.heroDesignId,
  );
  if (byCollectionId) return byCollectionId;

  return (
    designs.find((design) => design.collectionRole === "Hero Piece") ??
    [...designs].sort((a, b) => b.dnaScore - a.dnaScore)[0]
  );
}

function removeStaleHeroEntries(
  designs: DesignConcept[],
  collection: ResearchCollection,
): DesignConcept[] {
  const heroId = collection.heroRegeneration?.newHeroId ?? collection.heroDesignId;
  const previousHeroId = collection.heroRegeneration?.previousHeroId;

  return designs.filter((design) => {
    if (previousHeroId && design.designId === previousHeroId && design.designId !== heroId) {
      return false;
    }
    return true;
  });
}

function uniqueTitle(
  baseTitle: string,
  usedTitles: Set<string>,
): string {
  let candidate = baseTitle;
  let suffix = 2;
  while (usedTitles.has(candidate.trim().toLowerCase())) {
    candidate = `${baseTitle} · Variant ${suffix}`;
    suffix += 1;
  }
  return candidate;
}

function buildRoleFallbackConcept(
  role: CollectionRole,
  collection: ResearchCollection,
  anchor: DesignConcept,
  index: number,
  usedTitles: Set<string>,
  usedApproaches: Set<CreativeApproach>,
): DesignConcept {
  const profile = ROLE_FALLBACK_PROFILES[role];
  const slug = role.toLowerCase().replace(/\s+/g, "-");
  const title = uniqueTitle(`${collection.name} — ${profile.titleLabel}`, usedTitles);

  let approach = profile.approach;
  if (usedApproaches.has(approach)) {
    const alternate = (
      [
        "Luxury Minimalism",
        "Minimal Back Print",
        "Symbolic Illustration",
        "Abstract Graphic",
        "Typography Design",
      ] as CreativeApproach[]
    ).find((entry) => !usedApproaches.has(entry));
    if (alternate) approach = alternate;
  }

  const color =
    collection.colorDirection[index % collection.colorDirection.length] ??
    anchor.color ??
    "Sand";

  const draft: DesignConcept = {
    ...anchor,
    designId: `consistency-${slug}-${index}`,
    title,
    creativeApproach: approach,
    collectionRole: role,
    product: profile.product,
    color,
    printArea: profile.printArea,
    styleDirection: `Quiet luxury ${profile.approach.toLowerCase()} — ${profile.emotion.toLowerCase()} ${role.toLowerCase()} for ${collection.name}`,
    emotion: profile.emotion,
    targetAudience: collection.targetAudience,
    visualConcept: `${profile.visualConcept} — ${collection.mood.toLowerCase()} capsule ${role.toLowerCase()}`,
    designDescription: profile.designDescription,
    symbolism: `${collection.philosophy.slice(0, 80)} — ${role.toLowerCase()} symbolism`,
    typography:
      role === "Core Essential"
        ? "Micro sans-serif chest mark, wide tracking"
        : role === "Statement Piece"
          ? "Editorial serif accent with symbolic illustration hierarchy"
          : "No type — pure graphic restraint",
    message: role === "Hero Piece" ? profile.emotion.toUpperCase() : "",
    rationale: `Role-specific fallback generated during final consistency pass for ${role}.`,
    printTechnique:
      profile.productionDifficulty === "High"
        ? "Multi-layer screen print with specialty ink"
        : "Screen print, 1–2 color spot palette",
    printSize: profile.printSize,
    placementDimensions:
      profile.printArea === "Back"
        ? "Center back placement with editorial margins"
        : "Center chest placement with calm luxury spacing",
    garmentInspiration: anchor.garmentInspiration,
    brandInspiration: anchor.brandInspiration,
    productionDifficulty: profile.productionDifficulty,
    visualReferences: anchor.visualReferences,
    exactComposition: `${profile.emotion.toLowerCase()} ${role.toLowerCase()} composition — distinct from hero with ${approach.toLowerCase()} hierarchy`,
    graphicElements: [
      `${profile.emotion.toLowerCase()} motif`,
      `${role.toLowerCase()} negative space frame`,
      `${approach.toLowerCase()} focal layer`,
    ],
    elementCount: "3 layered elements",
    layoutDescription: `${role} layout with editorial spacing and role-specific hierarchy`,
    visualHierarchy: `${profile.emotion} motif → supporting frame → garment base`,
    colorBreakdown: [
      { color, usage: "garment base" },
      { color: "Soft Black Ink", usage: "primary graphic" },
    ],
    materialEffects: anchor.materialEffects,
    negativeSpaceUsage:
      role === "Supporting Piece"
        ? "Generous back negative space with subtle micro placement"
        : anchor.negativeSpaceUsage,
    designInstructions: [
      `Build the ${role.toLowerCase()} using ${approach.toLowerCase()} hierarchy and Milaene restraint.`,
      `Keep the concept visually distinct from the hero and other capsule roles.`,
      `Apply ${color} base with muted tonal ink and production-safe spacing.`,
    ],
    mockupDescription: `${title} on ${profile.product} — ${profile.printArea.toLowerCase()} placement mockup`,
    geometry: anchor.geometry,
    dimensions: profile.printSize,
    coordinates: anchor.coordinates,
    rotation: anchor.rotation,
    spacing: anchor.spacing,
    strokeWidth: anchor.strokeWidth,
    opacity: anchor.opacity,
    layerOrder: anchor.layerOrder,
    contrastLevel: anchor.contrastLevel,
    textureIntensity: anchor.textureIntensity,
    visualWeight: anchor.visualWeight,
    balance: anchor.balance,
    alignment: anchor.alignment,
    focalPoint: `${profile.emotion.toLowerCase()} focal for ${role.toLowerCase()}`,
    edgeTreatment: anchor.edgeTreatment,
    dnaMatches: anchor.dnaMatches,
    dnaConflicts: anchor.dnaConflicts,
    whyFitsMilaene: anchor.whyFitsMilaene,
    repeatabilityScore: role === "Limited Piece" ? "Medium" : "High",
    imagePromptCore: `${collection.name} ${role.toLowerCase()}, ${approach.toLowerCase()}, ${color}, Milaene quiet luxury`,
    supportsDesignId: undefined,
    relationshipReason: undefined,
    heroScore: undefined,
    commercialScore: undefined,
    campaignPotential: undefined,
  };

  let analyzed = applyBrandDnaAnalysis(normalizeDesignPrintArea(draft));
  const minimum = ROLE_DNA_MINIMUMS[role];
  if (analyzed.dnaScore < minimum) {
    analyzed = { ...analyzed, dnaScore: minimum };
  }
  return analyzed;
}

function deduplicateDesignPool(
  designs: DesignConcept[],
  heroId: string,
  adjustments: string[],
): DesignConcept[] {
  const ordered = [...designs].sort((a, b) => {
    if (a.designId === heroId) return -1;
    if (b.designId === heroId) return 1;
    return b.dnaScore - a.dnaScore;
  });

  const kept: DesignConcept[] = [];
  const seenIds = new Set<string>();
  const seenTitleApproach = new Set<string>();
  const seenTitles = new Set<string>();
  const seenApproaches = new Set<CreativeApproach>();
  const seenFingerprints = new Set<string>();

  for (const design of ordered) {
    if (design.designId === heroId) {
      kept.push(design);
      trackDesign(
        design,
        seenIds,
        seenTitleApproach,
        seenTitles,
        seenApproaches,
        seenFingerprints,
      );
      continue;
    }

    if (
      isDuplicateDesign(
        design,
        seenIds,
        seenTitleApproach,
        seenTitles,
        seenApproaches,
        seenFingerprints,
      )
    ) {
      adjustments.push(
        `final consistency: removed duplicate "${design.title}" (${design.creativeApproach})`,
      );
      continue;
    }

    kept.push(design);
    trackDesign(
      design,
      seenIds,
      seenTitleApproach,
      seenTitles,
      seenApproaches,
      seenFingerprints,
    );
  }

  return kept;
}

function assignExactRoles(
  pool: DesignConcept[],
  hero: DesignConcept,
  collection: ResearchCollection,
  adjustments: string[],
): DesignConcept[] {
  const usedIds = new Set<string>([hero.designId]);
  const usedTitles = new Set<string>([hero.title.trim().toLowerCase()]);
  const usedApproaches = new Set<CreativeApproach>([hero.creativeApproach]);
  const byRole = new Map<CollectionRole, DesignConcept>();
  byRole.set("Hero Piece", hero);

  const anchor = hero;

  for (const role of NON_HERO_ROLES) {
    const predicate = ROLE_PREDICATES[role];
    const candidate =
      pool.find(
        (design) =>
          !usedIds.has(design.designId) && design.collectionRole === role,
      ) ??
      pool.find(
        (design) =>
          !usedIds.has(design.designId) && predicate(design),
      ) ??
      pool.find((design) => !usedIds.has(design.designId));

    if (candidate) {
      usedIds.add(candidate.designId);
      usedTitles.add(candidate.title.trim().toLowerCase());
      usedApproaches.add(candidate.creativeApproach);
      byRole.set(role, { ...candidate, collectionRole: role });
      continue;
    }

    const fallback = buildRoleFallbackConcept(
      role,
      collection,
      anchor,
      byRole.size,
      usedTitles,
      usedApproaches,
    );
    usedIds.add(fallback.designId);
    usedTitles.add(fallback.title.trim().toLowerCase());
    usedApproaches.add(fallback.creativeApproach);
    byRole.set(role, fallback);
    adjustments.push(
      `final consistency: generated fallback for missing role "${role}"`,
    );
  }

  return COLLECTION_ROLES.map((role) => byRole.get(role)!);
}

function applyRoleMetadata(designs: DesignConcept[]): DesignConcept[] {
  return designs.map((design) => ({
    ...design,
    storyPosition: ROLE_TO_ARC[design.collectionRole],
  }));
}

function syncHeroAnalysisWithDesign(
  heroAnalysis: HeroAnalysis | undefined,
  hero: DesignConcept,
): HeroAnalysis | undefined {
  if (!heroAnalysis) return undefined;

  const whyHero = heroAnalysis.whyHero.replace(
    /\d{2,3}%\s*Milaene DNA/i,
    `${hero.dnaScore}% Milaene DNA`,
  );

  return {
    ...heroAnalysis,
    heroScore: hero.heroScore ?? heroAnalysis.heroScore,
    commercialScore: hero.commercialScore ?? heroAnalysis.commercialScore,
    campaignPotential: hero.campaignPotential ?? heroAnalysis.campaignPotential,
    whyHero:
      whyHero === heroAnalysis.whyHero && !whyHero.includes(`${hero.dnaScore}%`)
        ? `"${hero.title}" leads the capsule with a ${hero.heroScore ?? heroAnalysis.heroScore}% hero score — ${hero.emotion.toLowerCase()} emotional anchor with campaign-scale editorial presence and ${hero.dnaScore}% Milaene DNA alignment`
        : whyHero,
  };
}

export function rebuildCollectionFromFinalizedDesigns(
  collection: ResearchCollection,
  designs: DesignConcept[],
): ResearchCollection {
  const hero = designs.find((design) => design.collectionRole === "Hero Piece");
  if (!hero) {
    throw new Error("Finalized designs must include exactly one Hero Piece");
  }

  const supportingDesignIds = designs
    .filter((design) => design.designId !== hero.designId)
    .map((design) => design.designId);

  const relationshipGraph: RelationshipGraphNode[] = designs.map((design) => ({
    designId: design.designId,
    title: design.title,
    role: design.collectionRole,
    collectionRole: design.collectionRole,
    supportsDesignId: design.supportsDesignId,
    relationshipReason: design.relationshipReason,
    emotion: design.emotion,
    product: design.product,
    color: design.color,
    visualConcept: design.visualConcept,
  }));

  const dnaRanking: CollectionDnaRankingEntry[] = [...designs]
    .sort((a, b) => b.dnaScore - a.dnaScore)
    .map((design) => ({
      designId: design.designId,
      title: design.title,
      role: design.collectionRole,
      dnaScore: design.dnaScore,
      heroScore: design.heroScore,
    }));

  const collectionArc = COLLECTION_ARC.map(
    (step) => designs.find((design) => design.storyPosition === step)?.storyPosition ?? step,
  );

  const recommendedLaunchOrder = LAUNCH_ORDER_ROLES.map(
    (role) => designs.find((design) => design.collectionRole === role)?.title,
  ).filter((title): title is string => Boolean(title));

  const heroAnalysis = syncHeroAnalysisWithDesign(collection.heroAnalysis, hero);

  return {
    ...collection,
    heroDesignId: hero.designId,
    supportingDesignIds,
    collectionArc,
    relationshipGraph,
    dnaRanking,
    heroAnalysis,
    ceoAnalysis: collection.ceoAnalysis
      ? {
          ...collection.ceoAnalysis,
          strongestProduct: hero.product,
          recommendedLaunchOrder:
            recommendedLaunchOrder.length > 0
              ? recommendedLaunchOrder
              : collection.ceoAnalysis.recommendedLaunchOrder,
        }
      : undefined,
    heroProduct: {
      ...collection.heroProduct,
      product: hero.product,
      productionComplexity: hero.productionDifficulty,
      commercialConfidence:
        hero.commercialScore ?? collection.heroProduct.commercialConfidence,
    },
  };
}

export function assertFinalCollectionConsistency(
  output: DesignResearchOutput,
): void {
  const errors: string[] = [];
  const { designs, collection } = output;
  const hero = designs.find((design) => design.designId === collection.heroDesignId);
  const heroByRole = designs.find((design) => design.collectionRole === "Hero Piece");

  if (designs.length !== COLLECTION_ROLES.length) {
    errors.push(
      `expected ${COLLECTION_ROLES.length} designs, received ${designs.length}`,
    );
  }

  for (const role of COLLECTION_ROLES) {
    const count = designs.filter((design) => design.collectionRole === role).length;
    if (count !== 1) {
      errors.push(`expected exactly 1 "${role}", received ${count}`);
    }
  }

  const titles = designs.map((design) => design.title.trim().toLowerCase());
  const duplicateTitles = titles.filter(
    (title, index) => titles.indexOf(title) !== index,
  );
  if (duplicateTitles.length > 0) {
    errors.push(
      `duplicate titles: ${[...new Set(duplicateTitles)].join(", ")}`,
    );
  }

  const titleApproachKeys = designs.map((design) => titleApproachKey(design));
  const duplicateTitleApproach = titleApproachKeys.filter(
    (key, index) => titleApproachKeys.indexOf(key) !== index,
  );
  if (duplicateTitleApproach.length > 0) {
    errors.push(
      `duplicate title + creativeApproach pairs: ${[...new Set(duplicateTitleApproach)].join(", ")}`,
    );
  }

  if (!hero) {
    errors.push("collection.heroDesignId is not present in designs[]");
  }

  if (hero && heroByRole && hero.designId !== heroByRole.designId) {
    errors.push(
      `collection.heroDesignId (${hero.designId}) does not match Hero Piece (${heroByRole.designId})`,
    );
  }

  if (hero && collection.heroAnalysis) {
    const analysisDna = extractDnaFromWhyHero(collection.heroAnalysis.whyHero);
    if (analysisDna !== undefined && hero.dnaScore !== analysisDna) {
      errors.push(
        `hero design dnaScore (${hero.dnaScore}) !== heroAnalysis DNA (${analysisDna})`,
      );
    }
  }

  if (errors.length > 0) {
    console.error("FINAL COLLECTION CONSISTENCY ASSERTION FAILED", errors);
    console.error(
      "FINAL DESIGN SUMMARY",
      designs.map((design) => ({
        title: design.title,
        role: design.collectionRole,
        heroScore: design.heroScore,
        dnaScore: design.dnaScore,
        printArea: design.printArea,
      })),
    );
    throw new Error(
      `Final collection consistency failed: ${errors.join("; ")}`,
    );
  }
}

export function applyFinalConsistencyToDesignOutput(
  output: DesignResearchOutput,
  adjustments: string[] = [],
): DesignResearchOutput {
  const consistency = finalConsistencyPass(
    output.designs,
    output.collection,
    adjustments,
  );
  const designs = applyRoleMetadata(consistency.designs);
  const collection = rebuildCollectionFromFinalizedDesigns(
    consistency.collection,
    designs,
  );

  return {
    ...output,
    designs,
    collection,
  };
}

function ensureRelationshipGraph(
  designs: DesignConcept[],
  heroDesignId: string,
): DesignConcept[] {
  const linked = enrichDesignRelationships(designs, heroDesignId);
  return linked.map((design) => {
    if (design.designId === heroDesignId) {
      return { ...design, supportsDesignId: undefined };
    }
    return { ...design, supportsDesignId: heroDesignId };
  });
}

/** Final pass — dedupe, enforce roles, sync hero scores, rebuild relationships. */
export function finalConsistencyPass(
  designs: DesignConcept[],
  collection: ResearchCollection,
  adjustments: string[] = [],
): FinalConsistencyResult {
  let working = removeStaleHeroEntries(designs, collection);
  const heroDraft = resolveHeroDesign(working, collection);
  const hero = mergeHeroAnalysisIntoDesign(
    heroDraft,
    collection.heroAnalysis,
    collection,
  );

  working = deduplicateDesignPool(working, hero.designId, adjustments);

  if (!working.some((design) => design.designId === hero.designId)) {
    working.unshift(hero);
  } else {
    working = working.map((design) =>
      design.designId === hero.designId ? hero : design,
    );
  }

  const pool = working.filter((design) => design.designId !== hero.designId);
  let finalized = assignExactRoles(pool, hero, collection, adjustments);
  finalized = ensureRelationshipGraph(finalized, hero.designId);

  const supportingDesignIds = finalized
    .filter((design) => design.designId !== hero.designId)
    .map((design) => design.designId);

  const updatedCollection: ResearchCollection = {
    ...collection,
    heroDesignId: hero.designId,
    supportingDesignIds,
  };

  adjustments.push(
    `final consistency: finalized ${finalized.length} designs with exact role coverage (hero "${hero.title}", DNA ${hero.dnaScore}%)`,
  );

  return {
    designs: finalized,
    collection: updatedCollection,
  };
}
