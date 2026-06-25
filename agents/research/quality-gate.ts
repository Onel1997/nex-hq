import { applyCeoConsistency, buildCeoRecommendation } from "./ceo-consistency";
import { computeDynamicCollectionScore } from "./collection-scoring";
import {
  assessCampaignPotential,
  buildHeroAnalysis,
  calculateCommercialScore,
  calculateHeroScore,
} from "./hero-engine";
import { ABSOLUTE_DNA_FLOOR, roundPercent } from "./score-coercion";
import { buildThemeRoleFallbackConcept } from "./theme-fallback";
import type {
  DesignConcept,
  HeroAnalysis,
  ResearchCollection,
} from "./types";

export { ABSOLUTE_DNA_FLOOR };

const GENERIC_VISUAL_PATTERNS: RegExp[] = [
  /\b(minimal lines|abstract shapes|soft pattern|flowing forms|subtle effect|artistic lines)\b/i,
  /\b(simple graphic|basic design|generic|placeholder|template)\b/i,
  /\b(editorial symbolic composition with (dominant )?focal hierarchy)\b/i,
  /\b(campaign centerpiece — editorial symbolic composition)\b/i,
  /\b(quiet luxury restraint with muted tonal)\b/i,
  /\b(wearable commercial essential — \d+ cm)/i,
  /\b(subtle supporting back mark)\b/i,
];

const GENERIC_TITLE_PATTERNS: RegExp[] = [
  /\bmilaene\s+luxury\s+minimalism\b/i,
  /\bmilaene\s+minimal\s+back\s+print\b/i,
  /\bmilaene\s+typography\s+design\b/i,
  /\bcore\s+essential\s+tee\b/i,
  /\bsupporting\s+quiet\b/i,
  /\bstatement\s+graphic\b/i,
  /\blimited\s+capsule\b/i,
  /\s+reinforced\b/i,
  /\bluxury\s+minimalism\b/i,
  /\bminimal\s+back\s+print\b/i,
  /\btypography\s+design\b/i,
];

const MAX_QUALITY_PASSES = 3;

export function isGenericVisualConcept(visualConcept: string): boolean {
  const trimmed = visualConcept.trim();
  if (trimmed.length < 24) return true;
  return GENERIC_VISUAL_PATTERNS.some((pattern) => pattern.test(trimmed));
}

export function isGenericTitle(title: string): boolean {
  return GENERIC_TITLE_PATTERNS.some((pattern) => pattern.test(title));
}

export function hasStaleArtDirection(design: DesignConcept): boolean {
  const motifTokens = design.visualConcept
    .toLowerCase()
    .split(/\s+/)
    .filter((token) => token.length > 4)
    .slice(0, 4);

  if (motifTokens.length === 0) return false;

  const artCorpus = [
    design.exactComposition,
    design.layoutDescription,
    design.mockupDescription,
    design.graphicElements.join(" "),
    design.designInstructions.join(" "),
    design.imagePromptCore,
  ]
    .join(" ")
    .toLowerCase();

  const overlap = motifTokens.filter((token) => artCorpus.includes(token)).length;
  if (overlap < 1) return true;

  if (
    design.graphicElements.some((element) =>
      /\b(focal layer|negative space frame|motif)\b/i.test(element) &&
      !design.visualConcept.toLowerCase().includes(element.toLowerCase().slice(0, 8)),
    )
  ) {
    return true;
  }

  return false;
}

export function designFailsQualityGate(design: DesignConcept): boolean {
  if (design.dnaScore < ABSOLUTE_DNA_FLOOR) return true;
  if (design.campaignPotential === "low") return true;
  if (isGenericTitle(design.title)) return true;
  if (isGenericVisualConcept(design.visualConcept)) return true;
  if (hasStaleArtDirection(design)) return true;
  return false;
}

export function roundDesignScores(design: DesignConcept): DesignConcept {
  const commercialScore =
    design.commercialScore !== undefined
      ? roundPercent(design.commercialScore)
      : undefined;

  return {
    ...design,
    dnaScore: roundPercent(design.dnaScore),
    heroScore:
      design.heroScore !== undefined ? roundPercent(design.heroScore) : undefined,
    commercialScore,
  };
}

function replaceFailingDesign(
  design: DesignConcept,
  collection: ResearchCollection,
  usedTitles: Set<string>,
  usedApproaches: Set<DesignConcept["creativeApproach"]>,
  heroDesignId: string | undefined,
  index: number,
): DesignConcept {
  const color =
    collection.colorDirection[index % collection.colorDirection.length] ??
    design.color ??
    "Sand";

  return buildThemeRoleFallbackConcept({
    role: design.collectionRole,
    collection,
    designId: `quality-${design.collectionRole.toLowerCase().replace(/\s+/g, "-")}-${index}-${Date.now() % 10000}`,
    color,
    usedTitles,
    emotionIndex: index,
    heroDesignId,
    usedApproaches,
  });
}

/** Hard gate — replace failing non-hero designs until all pass or max passes reached. */
export function enforceHardQualityGate(
  designs: DesignConcept[],
  collection: ResearchCollection,
  adjustments: string[] = [],
): { designs: DesignConcept[]; replacedDesignCount: number } {
  const hero = designs.find((d) => d.collectionRole === "Hero Piece");
  const heroDesignId = hero?.designId;
  let working = designs.map(roundDesignScores);
  let replacedDesignCount = 0;

  for (let pass = 0; pass < MAX_QUALITY_PASSES; pass++) {
    const usedTitles = new Set(working.map((d) => d.title.trim().toLowerCase()));
    const usedApproaches = new Set(working.map((d) => d.creativeApproach));
    let replacedThisPass = 0;

    working = working.map((design, index) => {
      if (design.collectionRole === "Hero Piece") {
        return roundDesignScores(design);
      }
      if (!designFailsQualityGate(design)) {
        return roundDesignScores(design);
      }

      const replacement = replaceFailingDesign(
        design,
        collection,
        usedTitles,
        usedApproaches,
        heroDesignId,
        index,
      );

      usedTitles.add(replacement.title.trim().toLowerCase());
      usedApproaches.add(replacement.creativeApproach);
      replacedThisPass += 1;
      replacedDesignCount += 1;

      adjustments.push(
        `quality gate: replaced failing "${design.title}" (${design.collectionRole}, DNA ${design.dnaScore}%) with theme fallback "${replacement.title}"`,
      );

      return replacement;
    });

    if (replacedThisPass === 0) break;
  }

  return { designs: working, replacedDesignCount };
}

/** @deprecated Use enforceHardQualityGate */
export function replaceWeakDesigns(
  designs: DesignConcept[],
  collection: ResearchCollection,
  adjustments: string[] = [],
): { designs: DesignConcept[]; replacedDesignCount: number } {
  return enforceHardQualityGate(designs, collection, adjustments);
}

export interface FinalQualityScores {
  collectionScore: number;
  averageDna: number;
  weakestDesign: string;
  replacedDesignCount: number;
  ceoApproved: boolean;
  heroScore: number;
}

export function logFinalQualityScores(scores: FinalQualityScores): void {
  console.log("FINAL QUALITY SCORES:");
  console.log(`- collectionScore: ${scores.collectionScore}`);
  console.log(`- averageDNA: ${scores.averageDna}`);
  console.log(`- weakestDesign: ${scores.weakestDesign}`);
  console.log(`- replacedDesignCount: ${scores.replacedDesignCount}`);
  console.log(`- ceoApproved: ${scores.ceoApproved}`);
}

export interface FinalQualityGateResult {
  designs: DesignConcept[];
  collection: ResearchCollection;
  scores: FinalQualityScores;
}

function syncCollectionCeoState(
  collection: ResearchCollection,
  hero: DesignConcept,
  peers: DesignConcept[],
  designs: DesignConcept[],
  collectionScore: number,
): { collection: ResearchCollection; designs: DesignConcept[]; ceoApproved: boolean } {
  const heroAnalysis = buildHeroAnalysis(hero, peers);
  const result = applyCeoConsistency(
    collection,
    hero,
    heroAnalysis,
    designs,
    collectionScore,
  );
  return {
    collection: result.collection,
    designs: result.collection.heroDesignId
      ? designs.map((d) =>
          d.designId === result.hero.designId ? result.hero : d,
        )
      : designs,
    ceoApproved: result.ceoApproved,
  };
}

/** Final quality gate before returning design research output. */
export function applyFinalQualityGate(
  designs: DesignConcept[],
  collection: ResearchCollection,
  adjustments: string[] = [],
  priorReplacedCount = 0,
): FinalQualityGateResult {
  const { designs: gatedDesigns, replacedDesignCount: gateReplaced } =
    enforceHardQualityGate(designs, collection, adjustments);

  const replacedDesignCount = priorReplacedCount + gateReplaced;
  const hero = gatedDesigns.find((d) => d.collectionRole === "Hero Piece");
  const peers = gatedDesigns.filter((d) => d.designId !== hero?.designId);

  const roundedDesigns = gatedDesigns.map((design) => {
    const commercialScore = roundPercent(
      design.commercialScore ?? calculateCommercialScore(design),
    );
    const enriched = { ...design, commercialScore };

    if (design.collectionRole === "Hero Piece") {
      return roundDesignScores({
        ...enriched,
        heroScore: roundPercent(
          calculateHeroScore({ ...enriched, commercialScore }, peers),
        ),
        campaignPotential:
          design.campaignPotential ??
          assessCampaignPotential(enriched, commercialScore),
      });
    }

    const campaignPotential =
      design.campaignPotential ?? assessCampaignPotential(enriched, commercialScore);

    return roundDesignScores({
      ...enriched,
      campaignPotential:
        campaignPotential === "low" ? "medium" : campaignPotential,
    });
  });

  const breakdown = computeDynamicCollectionScore(roundedDesigns, collection);
  const weakest = [...roundedDesigns].sort((a, b) => a.dnaScore - b.dnaScore)[0];

  const heroDesign =
    roundedDesigns.find((d) => d.designId === hero?.designId) ?? hero;

  const ceoSync = heroDesign
    ? syncCollectionCeoState(
        collection,
        heroDesign,
        peers,
        roundedDesigns,
        breakdown.collectionScore,
      )
    : {
        collection: {
          ...collection,
          collectionScore: Math.min(roundPercent(breakdown.collectionScore), 69),
          ceoRecommendation: buildCeoRecommendation(false),
        },
        designs: roundedDesigns,
        ceoApproved: false,
      };

  const scores: FinalQualityScores = {
    collectionScore: ceoSync.collection.collectionScore,
    averageDna: roundPercent(breakdown.averageDna),
    heroScore: roundPercent(
      ceoSync.designs.find((d) => d.collectionRole === "Hero Piece")?.heroScore ??
        collection.heroAnalysis?.heroScore ??
        0,
    ),
    weakestDesign: weakest
      ? `${weakest.title} (${weakest.dnaScore}%)`
      : "none",
    replacedDesignCount,
    ceoApproved: ceoSync.ceoApproved,
  };

  logFinalQualityScores(scores);

  for (const design of ceoSync.designs) {
    if (design.dnaScore < ABSOLUTE_DNA_FLOOR) {
      console.error(
        `FINAL QUALITY GATE: "${design.title}" still below DNA floor (${design.dnaScore}%)`,
      );
    }
  }

  return {
    designs: ceoSync.designs,
    collection: ceoSync.collection,
    scores,
  };
}

export function isWeakNonHeroDesign(design: DesignConcept): boolean {
  if (design.collectionRole === "Hero Piece") return false;
  return designFailsQualityGate(design);
}
