import { COLLECTION_ROLES, type DesignConcept, type ResearchCollection } from "./types";
import { visualConceptFingerprint } from "./design-concept";

export interface CollectionScoreBreakdown {
  averageDna: number;
  roleCompleteness: number;
  heroApproval: number;
  duplicatePenalty: number;
  weakDesignPenalty: number;
  campaignCohesion: number;
  productBalance: number;
  collectionScore: number;
}

function averageDna(designs: DesignConcept[]): number {
  if (designs.length === 0) return 0;
  return Math.round(
    designs.reduce((sum, d) => sum + d.dnaScore, 0) / designs.length,
  );
}

function scoreRoleCompleteness(designs: DesignConcept[]): number {
  const roles = new Set(designs.map((d) => d.collectionRole));
  const present = COLLECTION_ROLES.filter((role) => roles.has(role)).length;
  return Math.round((present / COLLECTION_ROLES.length) * 100);
}

function scoreHeroApproval(collection: ResearchCollection): number {
  if (collection.heroStatus === "approved") return 100;
  if (collection.heroAnalysis?.campaignPotential === "high") return 75;
  if (collection.heroAnalysis?.campaignPotential === "medium") return 55;
  return 35;
}

function computeDuplicatePenalty(designs: DesignConcept[]): number {
  const titles = designs.map((d) => d.title.trim().toLowerCase());
  const duplicateTitles = titles.length - new Set(titles).size;

  const fingerprints = designs
    .map((d) => visualConceptFingerprint(d.visualConcept))
    .filter(Boolean);
  const duplicateFingerprints =
    fingerprints.length - new Set(fingerprints).size;

  const approaches = designs.map((d) => d.creativeApproach);
  const duplicateApproaches = approaches.length - new Set(approaches).size;

  return Math.min(
    30,
    duplicateTitles * 12 + duplicateFingerprints * 8 + duplicateApproaches * 5,
  );
}

function computeWeakDesignPenalty(designs: DesignConcept[]): number {
  let penalty = 0;
  for (const design of designs) {
    if (design.dnaScore < 60) penalty += 15;
    else if (design.dnaScore < 70) penalty += 6;
    if (design.campaignPotential === "low") penalty += 8;
  }
  return Math.min(35, penalty);
}

function scoreCampaignCohesion(designs: DesignConcept[]): number {
  const emotions = designs.map((d) => d.emotion.toLowerCase().trim());
  const uniqueEmotions = new Set(emotions).size;
  const emotionScore =
    uniqueEmotions <= 3 ? 90 : uniqueEmotions === 4 ? 75 : 60;

  const colors = designs.map((d) => d.color.toLowerCase().trim());
  const uniqueColors = new Set(colors).size;
  const colorScore =
    uniqueColors <= 2 ? 95 : uniqueColors === 3 ? 80 : uniqueColors === 4 ? 68 : 55;

  return Math.round(emotionScore * 0.45 + colorScore * 0.55);
}

function scoreProductBalance(designs: DesignConcept[]): number {
  const products = new Set(designs.map((d) => d.product.trim().toLowerCase()));
  const roles = new Set(designs.map((d) => d.collectionRole));
  let score = 55;
  if (products.size >= 2 && products.size <= 4) score += 20;
  if (roles.has("Hero Piece")) score += 10;
  if (roles.has("Core Essential")) score += 8;
  if (roles.has("Supporting Piece")) score += 5;
  if (roles.has("Statement Piece")) score += 5;
  return Math.min(100, score);
}

/** Dynamic collection score — not a fixed floor value. */
export function computeDynamicCollectionScore(
  designs: DesignConcept[],
  collection: ResearchCollection,
): CollectionScoreBreakdown {
  const avgDnaScore = averageDna(designs);
  const roleCompleteness = scoreRoleCompleteness(designs);
  const heroApproval = scoreHeroApproval(collection);
  const duplicatePenalty = computeDuplicatePenalty(designs);
  const weakDesignPenalty = computeWeakDesignPenalty(designs);
  const campaignCohesion = scoreCampaignCohesion(designs);
  const productBalance = scoreProductBalance(designs);

  const raw =
    avgDnaScore * 0.28 +
    roleCompleteness * 0.12 +
    heroApproval * 0.15 +
    campaignCohesion * 0.2 +
    productBalance * 0.1 +
    (100 - duplicatePenalty) * 0.08 +
    (100 - weakDesignPenalty) * 0.07;

  const collectionScore = Math.max(0, Math.min(100, Math.round(raw)));

  return {
    averageDna: avgDnaScore,
    roleCompleteness,
    heroApproval,
    duplicatePenalty,
    weakDesignPenalty,
    campaignCohesion,
    productBalance,
    collectionScore,
  };
}
