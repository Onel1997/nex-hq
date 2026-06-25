import {
  enrichDesignRelationships,
} from "./collection-intelligence";
import { computeDynamicCollectionScore } from "./collection-scoring";
import {
  applyCeoConsistency,
  applyFinalCollectionScore,
} from "./ceo-consistency";
import {
  applyEmotionalRepairPass,
  assertRoleConsistency,
  normalizeCollectionRoles,
} from "./role-consistency";
import { applyBrandDnaAnalysis } from "./brand-dna";
import {
  applyCollectionEmotionalVisualLanguage,
} from "./emotional-visual";
import {
  assertDnaScoreDiversity,
  ensureCollectionDnaDiversity,
} from "./milaene-translation";
import {
  visualConceptFingerprint,
} from "./design-concept";
import { assertCeoConsistency } from "./ceo-consistency";
import {
  applyFinalQualityGate,
  designFailsQualityGate,
  enforceHardQualityGate,
} from "./quality-gate";
import { buildThemeRoleFallbackConcept } from "./theme-fallback";
import { roundPercent } from "./score-coercion";
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
  "Core Essential": "Pain",
  "Statement Piece": "Conflict",
  "Supporting Piece": "Acceptance",
  "Limited Piece": "Memory",
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
  const dnaScore = roundPercent(Math.max(design.dnaScore, dnaFromAnalysis ?? 0));

  return {
    ...design,
    collectionRole: "Hero Piece",
    supportsDesignId: undefined,
    dnaScore,
    heroScore:
      heroAnalysis.heroScore !== undefined
        ? roundPercent(heroAnalysis.heroScore)
        : undefined,
    commercialScore:
      heroAnalysis.commercialScore !== undefined
        ? roundPercent(heroAnalysis.commercialScore)
        : undefined,
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

function buildRoleFallbackConcept(
  role: CollectionRole,
  collection: ResearchCollection,
  anchor: DesignConcept,
  index: number,
  usedTitles: Set<string>,
  usedApproaches: Set<CreativeApproach>,
): DesignConcept {
  const color =
    collection.colorDirection[index % collection.colorDirection.length] ??
    anchor.color ??
    "Sand";

  return buildThemeRoleFallbackConcept({
    role,
    collection,
    designId: `consistency-${role.toLowerCase().replace(/\s+/g, "-")}-${index}`,
    color,
    usedTitles,
    emotionIndex: index,
    usedApproaches,
  });
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
    const passesGate = (design: DesignConcept) => !designFailsQualityGate(design);
    const candidate =
      pool.find(
        (design) =>
          !usedIds.has(design.designId) &&
          design.collectionRole === role &&
          passesGate(design),
      ) ??
      pool.find(
        (design) =>
          !usedIds.has(design.designId) &&
          predicate(design) &&
          passesGate(design),
      ) ??
      pool.find(
        (design) => !usedIds.has(design.designId) && passesGate(design),
      ) ??
      pool.find((design) => !usedIds.has(design.designId));

    if (candidate && !designFailsQualityGate(candidate)) {
      usedIds.add(candidate.designId);
      usedTitles.add(candidate.title.trim().toLowerCase());
      usedApproaches.add(candidate.creativeApproach);
      byRole.set(role, { ...candidate, collectionRole: role });
      continue;
    }

    if (candidate && designFailsQualityGate(candidate)) {
      adjustments.push(
        `final consistency: skipped weak candidate "${candidate.title}" for "${role}" — generating theme fallback`,
      );
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

  assertRoleConsistency(designs);

  for (const design of designs) {
    if (design.designId === collection.heroDesignId) {
      if (design.supportsDesignId !== undefined) {
        errors.push(`hero "${design.title}" must not have supportsDesignId`);
      }
      continue;
    }
    if (design.supportsDesignId !== collection.heroDesignId) {
      errors.push(
        `"${design.title}" (${design.collectionRole}) must support hero ${collection.heroDesignId}, received ${design.supportsDesignId ?? "none"}`,
      );
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
        commercialScore: design.commercialScore,
        printArea: design.printArea,
      })),
    );
    throw new Error(
      `Final collection consistency failed: ${errors.join("; ")}`,
    );
  }

  for (const design of designs) {
    if (design.dnaScore < 60) {
      throw new Error(
        `Final quality gate: "${design.title}" has DNA ${design.dnaScore}% — minimum is 60%`,
      );
    }
  }

  if (hero) {
    assertCeoConsistency(collection, hero, collection.heroAnalysis);
  }

  assertDnaScoreDiversity(designs);

  if (!collection.scoreLocked) {
    throw new Error("Final collection score authority was not applied");
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
  let designs = applyEmotionalRepairPass(
    consistency.designs,
    consistency.collection,
    adjustments,
  );
  designs = normalizeCollectionRoles(designs, adjustments);
  assertRoleConsistency(designs);
  designs = applyCollectionEmotionalVisualLanguage(designs, consistency.collection);
  designs = designs.map((design) => applyBrandDnaAnalysis(design));
  designs = ensureCollectionDnaDiversity(designs, adjustments);
  designs = applyRoleMetadata(designs);
  const heroDesignId =
    designs.find((design) => design.collectionRole === "Hero Piece")?.designId ??
    consistency.collection.heroDesignId;
  designs = ensureRelationshipGraph(designs, heroDesignId);
  let collection = rebuildCollectionFromFinalizedDesigns(
    consistency.collection,
    designs,
  );

  const hero = designs.find((design) => design.designId === collection.heroDesignId);
  const heroAnalysis = collection.heroAnalysis;

  if (hero && heroAnalysis) {
    const rawBreakdown = computeDynamicCollectionScore(designs, collection);
    const ceoResult = applyCeoConsistency(
      collection,
      hero,
      heroAnalysis,
      designs,
      rawBreakdown.collectionScore,
    );
    designs = designs.map((design) =>
      design.designId === ceoResult.hero.designId ? ceoResult.hero : design,
    );
    const finalResult = applyFinalCollectionScore(
      ceoResult.collection,
      ceoResult.hero,
      ceoResult.heroAnalysis,
      ceoResult.rawCollectionScore,
      adjustments,
    );
    designs = designs.map((design) =>
      design.designId === finalResult.hero.designId ? finalResult.hero : design,
    );
    collection = finalResult.collection;
  }

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
  const { designs: strengthenedPool, replacedDesignCount: poolReplaced } =
    enforceHardQualityGate(pool, collection, adjustments);
  let finalized = assignExactRoles(strengthenedPool, hero, collection, adjustments);
  finalized = ensureRelationshipGraph(finalized, hero.designId);

  const { designs: qualityDesigns, collection: qualityCollection, scores } =
    applyFinalQualityGate(finalized, collection, adjustments, poolReplaced);

  finalized = qualityDesigns;

  const supportingDesignIds = finalized
    .filter((design) => design.designId !== hero.designId)
    .map((design) => design.designId);

  const updatedCollection: ResearchCollection = {
    ...qualityCollection,
    heroDesignId: hero.designId,
    supportingDesignIds,
  };

  adjustments.push(
    `final consistency: finalized ${finalized.length} designs with exact role coverage (hero "${hero.title}", DNA ${hero.dnaScore}%, collection score ${scores.collectionScore}%)`,
  );

  return {
    designs: finalized,
    collection: updatedCollection,
  };
}
