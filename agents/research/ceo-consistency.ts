import { computeDynamicCollectionScore } from "./collection-scoring";
import {
  ensureEmotionalVisualMatch,
  logFinalEmotionalVisual,
  scoreEmotionalDnaAlignment,
} from "./emotional-visual";
import {
  calculateCommercialScore,
  scoreEmotionalStrength,
} from "./hero-engine";
import {
  commercialConfidenceLevel,
  roundPercent,
} from "./score-coercion";
import type {
  CampaignPotential,
  DesignConcept,
  HeroAnalysis,
  ResearchCollection,
} from "./types";

export const CEO_HERO_SCORE_MIN = 80;
export const CEO_DNA_SCORE_MIN = 80;
export const CEO_COMMERCIAL_SCORE_MIN = 80;
export const CEO_EMOTIONAL_STRENGTH_MIN = 70;
export const CEO_REJECTED_COLLECTION_CAP = 69;
export const CEO_REJECTED_COMMERCIAL_CAP = 85;
export const CEO_DNA_COLLECTION_CAP = 74;
export const CEO_EMOTIONAL_COLLECTION_CAP = 72;

const REJECTED_POSITIVE_PHRASES =
  /\b(high commercial confidence|strong launch candidate|ready for launch|ceo-grade launch confidence)\b/i;

export interface HeroApprovalMetrics {
  heroScore: number;
  dnaScore: number;
  commercialScore: number;
  campaignPotential: CampaignPotential;
  emotionalStrength: number;
}

export interface CeoConsistencyResult {
  ceoApproved: boolean;
  metrics: HeroApprovalMetrics;
  limitedCommercialScore: number;
  rawCollectionScore: number;
  scoreCapsApplied: string[];
  heroAnalysis: HeroAnalysis;
  collection: ResearchCollection;
  hero: DesignConcept;
}

export interface FinalCollectionScoreResult {
  collection: ResearchCollection;
  hero: DesignConcept;
  rawCollectionScore: number;
  finalCollectionScore: number;
  capsApplied: string[];
  ceoApproved: boolean;
  heroDnaScore: number;
  emotionalStrength: number;
}

export function assertCollectionScoreUnlocked(
  collection: ResearchCollection,
): void {
  if (collection.scoreLocked) {
    throw new Error("COLLECTION_SCORE_LOCK_VIOLATION");
  }
}

export function parseEmotionalStrengthPercent(
  emotionalStrength: string | undefined,
): number {
  if (!emotionalStrength) return 0;
  const match = emotionalStrength.match(/—\s*(\d+(?:\.\d+)?)\s*%/);
  if (!match) return 0;
  return roundPercent(Number.parseFloat(match[1]));
}

export function collectHeroApprovalMetrics(
  hero: DesignConcept,
  analysis?: HeroAnalysis,
): HeroApprovalMetrics {
  const emotionalStrength = analysis
    ? parseEmotionalStrengthPercent(analysis.emotionalStrength)
    : roundPercent(scoreEmotionalStrength(hero));

  return {
    heroScore: roundPercent(hero.heroScore ?? analysis?.heroScore ?? 0),
    dnaScore: roundPercent(hero.dnaScore),
    commercialScore: roundPercent(
      hero.commercialScore ??
        analysis?.commercialScore ??
        calculateCommercialScore(hero),
    ),
    campaignPotential:
      hero.campaignPotential ?? analysis?.campaignPotential ?? "low",
    emotionalStrength,
  };
}

/** Hero approved only when every launch metric meets the CEO threshold. */
export function isCeoApproved(metrics: HeroApprovalMetrics): boolean {
  return (
    metrics.heroScore >= CEO_HERO_SCORE_MIN &&
    metrics.dnaScore >= CEO_DNA_SCORE_MIN &&
    metrics.commercialScore >= CEO_COMMERCIAL_SCORE_MIN &&
    metrics.campaignPotential === "high" &&
    metrics.emotionalStrength >= CEO_EMOTIONAL_STRENGTH_MIN
  );
}

export function buildCeoRecommendation(ceoApproved: boolean): string {
  return ceoApproved
    ? "Proceed to Design Studio. Launch approved."
    : "Do not launch yet — refine or regenerate Hero Piece.";
}

export function limitCommercialScore(
  rawCommercial: number,
  metrics: HeroApprovalMetrics,
  ceoApproved: boolean,
): { commercialScore: number; capsApplied: string[] } {
  const capsApplied: string[] = [];
  let score = roundPercent(rawCommercial);

  const metricCap = Math.min(metrics.heroScore, metrics.dnaScore + 5);
  if (score > metricCap) {
    score = metricCap;
    capsApplied.push(`metricCap:${metricCap}`);
  }

  if (!ceoApproved && score > CEO_REJECTED_COMMERCIAL_CAP) {
    score = CEO_REJECTED_COMMERCIAL_CAP;
    capsApplied.push(`rejectedCommercialCap:${CEO_REJECTED_COMMERCIAL_CAP}`);
  }

  if (metrics.emotionalStrength < 60) {
    score = Math.max(0, score - 10);
    capsApplied.push("emotionalPenalty:-10");
  }

  return { commercialScore: roundPercent(score), capsApplied };
}

/** Hard caps applied once at final collection score authority. */
export function applyCollectionCaps(
  rawCollectionScore: number,
  ceoApproved: boolean,
  heroDnaScore: number,
  emotionalStrength: number,
): { collectionScore: number; capsApplied: string[] } {
  const capsApplied: string[] = [];
  const limits = [roundPercent(rawCollectionScore)];

  if (!ceoApproved) {
    limits.push(CEO_REJECTED_COLLECTION_CAP);
    capsApplied.push(`rejected:${CEO_REJECTED_COLLECTION_CAP}`);
  }

  if (heroDnaScore < CEO_DNA_SCORE_MIN) {
    limits.push(CEO_DNA_COLLECTION_CAP);
    capsApplied.push(`dnaCollectionCap:${CEO_DNA_COLLECTION_CAP}`);
  }

  if (emotionalStrength < CEO_EMOTIONAL_STRENGTH_MIN) {
    limits.push(CEO_EMOTIONAL_COLLECTION_CAP);
    capsApplied.push(`emotionalCollectionCap:${CEO_EMOTIONAL_COLLECTION_CAP}`);
  }

  const collectionScore = Math.min(...limits);
  return { collectionScore: roundPercent(collectionScore), capsApplied };
}

/** @deprecated Use applyCollectionCaps */
export function capCollectionScore(
  rawScore: number,
  ceoApproved: boolean,
  metrics: HeroApprovalMetrics,
): { collectionScore: number; capsApplied: string[] } {
  return applyCollectionCaps(
    rawScore,
    ceoApproved,
    metrics.dnaScore,
    metrics.emotionalStrength,
  );
}

export function assertCollectionScoreCaps(input: {
  collectionScore: number;
  ceoApproved: boolean;
  heroDnaScore: number;
  emotionalStrength: number;
}): void {
  if (!input.ceoApproved && input.collectionScore > CEO_REJECTED_COLLECTION_CAP) {
    throw new Error("CEO_COLLECTION_SCORE_VIOLATION");
  }

  if (
    input.heroDnaScore < CEO_DNA_SCORE_MIN &&
    input.collectionScore > CEO_DNA_COLLECTION_CAP
  ) {
    throw new Error("DNA_SCORE_CAP_VIOLATION");
  }

  if (
    input.emotionalStrength < CEO_EMOTIONAL_STRENGTH_MIN &&
    input.collectionScore > CEO_EMOTIONAL_COLLECTION_CAP
  ) {
    throw new Error("EMOTIONAL_CAP_VIOLATION");
  }
}

export function buildConsistentAdPotential(
  ceoApproved: boolean,
  campaignPotential: CampaignPotential,
): string {
  if (!ceoApproved) {
    if (campaignPotential === "low") {
      return "Low — refine visual impact before using as campaign anchor";
    }
    return "Medium — viable for lookbook and social, not ready for homepage hero ads";
  }

  if (campaignPotential === "high") {
    return "High — suitable for homepage banner, Instagram ads, and launch hero product";
  }
  if (campaignPotential === "medium") {
    return "Medium — viable for lookbook and social, may need visual amplification for paid ads";
  }
  return "Low — refine visual impact before using as campaign anchor";
}

export function adPotentialTier(adPotential: string): "high" | "medium" | "low" {
  const lower = adPotential.trim().toLowerCase();
  if (lower.startsWith("high")) return "high";
  if (lower.startsWith("medium")) return "medium";
  return "low";
}

export function capCommercialConfidenceScore(
  score: number,
  ceoApproved: boolean,
): number {
  const rounded = roundPercent(score);
  if (ceoApproved) return rounded;
  return Math.min(rounded, 84);
}

export function buildLaunchApprovalCopy(
  hero: DesignConcept,
  analysis: HeroAnalysis,
  ceoApproved: boolean,
  limitedCommercialScore: number,
): NonNullable<ResearchCollection["ceoAnalysis"]>["launchApproval"] {
  const repeatability = hero.repeatabilityScore.toLowerCase();

  return {
    approved: ceoApproved,
    emotionalImpact: ceoApproved
      ? `${hero.emotion} symbolism delivers sufficient emotional resonance for a Milaene launch narrative`
      : `${hero.emotion} symbolism delivers insufficient emotional resonance — strengthen narrative before launch`,
    commercialStrength: ceoApproved
      ? `${limitedCommercialScore}% commercial score with ${repeatability} repeatability — launch metrics aligned`
      : `${limitedCommercialScore}% commercial score with ${repeatability} repeatability — below launch threshold, commercial strengthening required`,
    adPerformanceExpectations: ceoApproved
      ? analysis.campaignPotential === "high"
        ? "Expect strong homepage conversion and Instagram engagement — hero reads at thumbnail and billboard scale"
        : "Moderate paid social performance — organic lookbook strong, paid ads may need tighter crop"
      : "Paid ad scale deferred — refine hero before homepage or Instagram hero placement",
  };
}

export function sanitizeRejectedCopy(text: string, ceoApproved: boolean): string {
  if (ceoApproved) return text;
  return text.replace(REJECTED_POSITIVE_PHRASES, "launch refinement required");
}

export function logCeoConsistency(input: {
  metrics: HeroApprovalMetrics;
  limitedCommercialScore: number;
  rawCollectionScore: number;
  ceoApproved: boolean;
  scoreCapsApplied: string[];
}): void {
  console.log("FINAL CEO CONSISTENCY:");
  console.log(`heroScore: ${input.metrics.heroScore}`);
  console.log(`dnaScore: ${input.metrics.dnaScore}`);
  console.log(`emotionalStrength: ${input.metrics.emotionalStrength}`);
  console.log(`commercialScore: ${input.limitedCommercialScore}`);
  console.log(`rawCollectionScore: ${input.rawCollectionScore}`);
  console.log(`ceoApproved: ${input.ceoApproved}`);
  console.log(
    `scoreCapsApplied: ${input.scoreCapsApplied.length > 0 ? input.scoreCapsApplied.join(", ") : "none (collection caps apply at final authority)"}`,
  );
}

export function logFinalCollectionAuthority(input: {
  rawCollectionScore: number;
  finalCollectionScore: number;
  heroDnaScore: number;
  emotionalStrength: number;
  ceoApproved: boolean;
  capsApplied: string[];
  scoreLocked: boolean;
}): void {
  console.log("FINAL COLLECTION AUTHORITY");
  console.log(`rawCollectionScore: ${input.rawCollectionScore}`);
  console.log(`finalCollectionScore: ${input.finalCollectionScore}`);
  console.log(`heroDNA: ${input.heroDnaScore}`);
  console.log(`emotionalStrength: ${input.emotionalStrength}`);
  console.log(`ceoApproved: ${input.ceoApproved}`);
  console.log(
    `capsApplied: ${input.capsApplied.length > 0 ? input.capsApplied.join(", ") : "none"}`,
  );
  console.log(`scoreLocked: ${input.scoreLocked}`);
}

export function assertCeoConsistency(
  collection: ResearchCollection,
  hero: DesignConcept,
  heroAnalysis?: HeroAnalysis,
): void {
  const metrics = collectHeroApprovalMetrics(hero, heroAnalysis);
  const ceoApproved = isCeoApproved(metrics);
  const { commercialScore } = limitCommercialScore(
    metrics.commercialScore,
    metrics,
    ceoApproved,
  );
  const adTier = adPotentialTier(
    heroAnalysis?.adPotential ?? collection.ceoAnalysis?.adPotential ?? "",
  );

  assertCollectionScoreCaps({
    collectionScore: collection.collectionScore,
    ceoApproved,
    heroDnaScore: metrics.dnaScore,
    emotionalStrength: metrics.emotionalStrength,
  });

  const errors: string[] = [];

  if (!ceoApproved) {
    if (commercialScore > CEO_REJECTED_COMMERCIAL_CAP) {
      errors.push(
        `commercialScore ${commercialScore} exceeds rejected cap ${CEO_REJECTED_COMMERCIAL_CAP}`,
      );
    }
    if (adTier === "high") {
      errors.push("adPotential must not be high when CEO rejected");
    }
    if (REJECTED_POSITIVE_PHRASES.test(collection.ceoRecommendation ?? "")) {
      errors.push("ceoRecommendation contains positive launch wording while rejected");
    }
    const confidence = collection.ceoAnalysis?.commercialConfidence;
    if (
      confidence !== undefined &&
      commercialConfidenceLevel(roundPercent(confidence)) === "High"
    ) {
      errors.push("commercialConfidence must not be High when CEO rejected");
    }
  }

  if (errors.length > 0) {
    console.error("CEO CONSISTENCY ASSERTION FAILED", errors);
    throw new Error(`CEO consistency failed: ${errors.join("; ")}`);
  }
}

/**
 * Sync CEO-owned fields (commercialConfidence, adPotential, recommendation, hero state).
 * Does not apply final collection score caps — use applyFinalCollectionScore after this.
 */
export function applyCeoConsistency(
  collection: ResearchCollection,
  hero: DesignConcept,
  heroAnalysis: HeroAnalysis,
  designs: DesignConcept[],
  rawCollectionScore?: number,
): CeoConsistencyResult {
  assertCollectionScoreUnlocked(collection);

  const metrics = collectHeroApprovalMetrics(hero, heroAnalysis);
  const ceoApproved = isCeoApproved(metrics);

  const { commercialScore: limitedCommercialScore, capsApplied: commercialCaps } =
    limitCommercialScore(metrics.commercialScore, metrics, ceoApproved);

  const rawScore = roundPercent(
    rawCollectionScore ??
      computeDynamicCollectionScore(designs, collection).collectionScore,
  );

  const adPotential = buildConsistentAdPotential(
    ceoApproved,
    metrics.campaignPotential,
  );

  const syncedHeroAnalysis: HeroAnalysis = {
    ...heroAnalysis,
    heroScore: metrics.heroScore,
    commercialScore: limitedCommercialScore,
    campaignPotential: metrics.campaignPotential,
    emotionalStrength: `${hero.emotion} — ${metrics.emotionalStrength}% emotional resonance through Milaene symbolic language`,
    adPotential,
    whyHero: sanitizeRejectedCopy(heroAnalysis.whyHero, ceoApproved),
  };

  const launchApproval = buildLaunchApprovalCopy(
    hero,
    syncedHeroAnalysis,
    ceoApproved,
    limitedCommercialScore,
  );

  const commercialConfidence = capCommercialConfidenceScore(
    Math.round(
      (limitedCommercialScore + metrics.dnaScore + metrics.heroScore) / 3,
    ),
    ceoApproved,
  );

  const syncedHero: DesignConcept = {
    ...hero,
    dnaScore: metrics.dnaScore,
    heroScore: metrics.heroScore,
    commercialScore: limitedCommercialScore,
    campaignPotential: metrics.campaignPotential,
  };

  const syncedDesigns = designs.map((design) =>
    design.designId === hero.designId ? syncedHero : design,
  );

  const syncedCollection: ResearchCollection = {
    ...collection,
    collectionScore: rawScore,
    ceoRecommendation: buildCeoRecommendation(ceoApproved),
    heroStatus: ceoApproved ? "approved" : "rejected",
    heroAnalysis: syncedHeroAnalysis,
    heroProduct: {
      ...collection.heroProduct,
      commercialConfidence,
    },
    ceoAnalysis: collection.ceoAnalysis
      ? {
          ...collection.ceoAnalysis,
          commercialConfidence,
          adPotential: sanitizeRejectedCopy(adPotential, ceoApproved),
          launchApproval,
        }
      : {
          strongestProduct: hero.product,
          weakestProduct: hero.product,
          recommendedLaunchOrder: [hero.title],
          productionRisk: "Production risk assessed after CEO consistency pass",
          commercialConfidence,
          adPotential,
          launchApproval,
        },
  };

  logCeoConsistency({
    metrics,
    limitedCommercialScore,
    rawCollectionScore: rawScore,
    ceoApproved,
    scoreCapsApplied: commercialCaps,
  });

  return {
    ceoApproved,
    metrics,
    limitedCommercialScore,
    rawCollectionScore: rawScore,
    scoreCapsApplied: commercialCaps,
    heroAnalysis: syncedHeroAnalysis,
    collection: syncedCollection,
    hero: syncedHero,
  };
}

/**
 * Terminal collection score authority — applies hard caps, locks the score, and asserts.
 * Nothing may mutate collectionScore after this step.
 */
export function applyFinalCollectionScore(
  collection: ResearchCollection,
  hero: DesignConcept,
  heroAnalysis: HeroAnalysis,
  rawCollectionScore?: number,
  adjustments: string[] = [],
): FinalCollectionScoreResult {
  assertCollectionScoreUnlocked(collection);

  const repairedHero = ensureEmotionalVisualMatch(hero, collection, adjustments);

  const metrics = collectHeroApprovalMetrics(repairedHero, heroAnalysis);
  const ceoApproved = isCeoApproved(metrics);
  const raw = roundPercent(rawCollectionScore ?? collection.collectionScore);

  const { collectionScore: finalCollectionScore, capsApplied } = applyCollectionCaps(
    raw,
    ceoApproved,
    metrics.dnaScore,
    metrics.emotionalStrength,
  );

  assertCollectionScoreCaps({
    collectionScore: finalCollectionScore,
    ceoApproved,
    heroDnaScore: metrics.dnaScore,
    emotionalStrength: metrics.emotionalStrength,
  });

  const lockedCollection: ResearchCollection = {
    ...collection,
    collectionScore: finalCollectionScore,
    scoreLocked: true,
  };

  logFinalCollectionAuthority({
    rawCollectionScore: raw,
    finalCollectionScore,
    heroDnaScore: metrics.dnaScore,
    emotionalStrength: metrics.emotionalStrength,
    ceoApproved,
    capsApplied,
    scoreLocked: true,
  });

  logFinalEmotionalVisual({
    emotion: repairedHero.emotion,
    visualLanguage: repairedHero.visualLanguage,
    symbolism: repairedHero.symbolism,
    composition: repairedHero.exactComposition,
    negativeSpace: repairedHero.negativeSpaceUsage,
    dnaAlignment: scoreEmotionalDnaAlignment(repairedHero),
  });

  return {
    collection: lockedCollection,
    hero: repairedHero,
    rawCollectionScore: raw,
    finalCollectionScore,
    capsApplied,
    ceoApproved,
    heroDnaScore: metrics.dnaScore,
    emotionalStrength: metrics.emotionalStrength,
  };
}

/** Convenience for hero-engine approval checks. */
export function isHeroCeoApproved(
  hero: DesignConcept,
  analysis: HeroAnalysis,
): boolean {
  return isCeoApproved(collectHeroApprovalMetrics(hero, analysis));
}
