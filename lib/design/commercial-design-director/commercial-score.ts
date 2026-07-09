import type { DesignStudioBrief } from "@/agents/design/studio-brief";
import type { LibraryArtworkSpec } from "@/lib/design/design-library/types";
import { scoreArtworkSpec } from "@/lib/design/design-library/quality/score";
import { analyzePremiumSvg } from "@/lib/design/design-library/templates/premium/quality-gate";
import { evaluateBuyerCuriosity } from "@/lib/design/design-knowledge/buyer-curiosity";
import { evaluateWearabilityCompositionMatch } from "@/lib/design/design-knowledge/wearability";
import { evaluateCommercialTypography } from "@/lib/design/commercial-design-director/typography";

const BLUEPRINT_TEMPLATES = new Set(["technical-blueprint"]);

/** Designs must score at or above this to proceed to production. */
export const COMMERCIAL_APPROVAL_THRESHOLD = 90;

export const COMMERCIAL_SCORE_DIMENSIONS = [
  "luxury",
  "originality",
  "streetwearAppeal",
  "fashionAppeal",
  "commercialPotential",
  "collectionConsistency",
  "typographyQuality",
  "compositionQuality",
  "wearability",
  "printQuality",
  "emotionalImpact",
  "shareability",
  "premiumFeeling",
] as const;

export type CommercialScoreDimension = (typeof COMMERCIAL_SCORE_DIMENSIONS)[number];

export interface CommercialScoreBreakdown {
  luxury: number;
  originality: number;
  streetwearAppeal: number;
  fashionAppeal: number;
  commercialPotential: number;
  collectionConsistency: number;
  typographyQuality: number;
  compositionQuality: number;
  wearability: number;
  printQuality: number;
  emotionalImpact: number;
  shareability: number;
  premiumFeeling: number;
  overall: number;
  /** Primary KPI — would someone buy this at €44.90–64.90? */
  wouldBuy: boolean;
}

export interface CommercialScoreInput {
  brief: DesignStudioBrief;
  spec: LibraryArtworkSpec;
  svg?: string;
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function countSvgTexts(svg: string): number {
  return (svg.match(/<text\b/g) ?? []).length;
}

function countSvgGroups(svg: string): number {
  return (svg.match(/<g id="/g) ?? []).length;
}

function hasPremiumTypography(svg: string, spec: LibraryArtworkSpec): boolean {
  if (svg.includes("premium-type-") && (svg.includes("clip-path=") || svg.includes("textLength="))) {
    return true;
  }
  return spec.typography.some(
    (t) =>
      t.id.startsWith("hero-type-") &&
      (t.variant === "ghost" || t.variant === "cropped" || t.clipPathId || t.textLength),
  );
}

function typographyLayerCount(spec: LibraryArtworkSpec): number {
  return spec.typography.filter((t) => t.layer === "typography").length;
}

function decorLayerCount(spec: LibraryArtworkSpec): number {
  return spec.typography.filter((t) => t.layer === "decorative").length;
}

/** Score a design against commercial viability — not SVG complexity. */
export function scoreCommercialDesign(input: CommercialScoreInput): CommercialScoreBreakdown {
  const { brief, spec, svg } = input;
  const libraryScore = scoreArtworkSpec(spec);
  const premiumStats = svg ? analyzePremiumSvg(svg) : null;

  const wearMatch = evaluateWearabilityCompositionMatch(spec);
  const placement = spec.wearabilityDirection?.placement;
  const typographyAssessment = evaluateCommercialTypography(spec);
  const curiosity = evaluateBuyerCuriosity(brief, spec);
  const curiosityBoost = curiosity.overall >= 72 ? 6 : curiosity.overall >= 65 ? 4 : 0;
  const scrollBoost =
    curiosity.scrollStopPotential >= 75 ? 8 : curiosity.scrollStopPotential >= 68 ? 5 : 0;
  const desireBoost = curiosity.wouldBuySignal >= 72 ? 5 : 0;
  const oversizedPlacement =
    placement?.id === "oversized-back" ||
    placement?.id === "oversized-front" ||
    (placement?.densityAllowance ?? 0) >= 0.7;

  const luxury = clamp(
    libraryScore.luxuryFeeling * 0.42 +
      libraryScore.negativeSpaceUse * 0.38 +
      (brief.materialEffects.toLowerCase().includes("vintage") ? 8 : 0) +
      (spec.style.id.includes("minimal") || spec.style.id.includes("luxury") ? 8 : 0) +
      (wearMatch.feelsPremium ? 10 : 0) +
      (wearMatch.agesWell ? 6 : 0) +
      (oversizedPlacement && spec.style.id.includes("editorial") ? 4 : 0),
  );

  const originality = clamp(
    libraryScore.originality * 0.55 +
      (spec.template.id.includes("editorial") || spec.template.id.includes("oversized") ? 10 : 0) -
      (BLUEPRINT_TEMPLATES.has(spec.template.id) ? 18 : 0) +
      (typographyAssessment.conceptHits.length >= 3 ? 8 : 0) +
      curiosity.dimensions.memorability * 0.12 +
      (curiosity.hookHits.includes("unexpected-overlap") ? 4 : 0),
  );

  const streetwearAppeal = clamp(
    libraryScore.apparelReadiness * 0.4 +
      libraryScore.commercialPotential * 0.35 +
      (brief.product.toLowerCase().includes("oversized") ? 12 : 0) +
      (spec.layout.id.includes("oversized") ? 10 : 0),
  );

  const fashionAppeal = clamp(
    libraryScore.emotionalTranslation * 0.35 +
      libraryScore.visualBalance * 0.25 +
      libraryScore.typographyHierarchy * 0.25 +
      (spec.style.id.includes("editorial") || spec.style.id.includes("fashion") ? 8 : 0),
  );

  const commercialPotential = clamp(
    (brief.commercialScore ?? libraryScore.commercialPotential) * 0.55 +
      libraryScore.commercialPotential * 0.45,
  );

  const collectionConsistency = clamp(
    libraryScore.brandConsistency * 0.5 +
      (brief.dnaScore ?? 70) * 0.35 +
      (brief.campaignPotential ? 8 : 0),
  );

  const typeLayers = typographyLayerCount(spec);
  const decorLayers = decorLayerCount(spec);
  const typographyQuality = clamp(
    libraryScore.typographyHierarchy * 0.35 +
      typographyAssessment.score * 0.35 +
      (typeLayers >= 3 ? 14 : typeLayers >= 2 ? 6 : -12) +
      (decorLayers >= 2 ? 8 : 0) +
      (svg && hasPremiumTypography(svg, spec) ? 12 : 0) +
      (premiumStats && premiumStats.typographyGroups >= 4 ? 8 : 0) +
      typographyAssessment.scrollStopBoost * 0.15,
  );

  const compositionQuality = clamp(
    libraryScore.compositionRichness * 0.35 +
      libraryScore.visualBalance * 0.3 +
      libraryScore.negativeSpaceUse * 0.2 +
      (spec.symbols.length >= 2 ? 6 : -8) +
      (spec.ornaments.length >= 2 ? 4 : 0),
  );

  const wearability = clamp(
    libraryScore.apparelReadiness * 0.5 +
      (brief.printArea.toLowerCase().includes("oversized") || oversizedPlacement ? 10 : 0) +
      (spec.layout.id.includes("oversized") || spec.layout.id.includes("chest") ? 8 : 0) -
      (svg && countSvgGroups(svg) > 80 ? 10 : 0) +
      (wearMatch.aligned ? 14 : wearMatch.score >= 68 ? 8 : 0) +
      (wearMatch.weeklyWearable ? 10 : 0) +
      (wearMatch.feelsPremium ? 6 : 0),
  );

  const printQuality = clamp(
    libraryScore.printReadiness * 0.55 +
      (brief.printReadinessScore ?? 75) * 0.35 +
      (brief.productionMethod.toLowerCase().includes("screen") ? 4 : 0),
  );

  const emotionalImpact = clamp(
    libraryScore.emotionalTranslation * 0.5 +
      (brief.visualConcept.length > 40 ? 6 : 0) +
      (brief.designDescription.length > 60 ? 4 : 0) +
      curiosity.dimensions.curiosity * 0.18 +
      curiosity.dimensions.mystery * 0.1 +
      desireBoost,
  );

  const shareability = clamp(
    commercialPotential * 0.25 +
      emotionalImpact * 0.2 +
      typographyQuality * 0.18 +
      fashionAppeal * 0.12 +
      typographyAssessment.scrollStopBoost * 0.1 +
      curiosity.dimensions.shareability * 0.15 +
      scrollBoost,
  );

  const premiumFeeling = clamp(
    luxury * 0.32 +
      typographyQuality * 0.22 +
      compositionQuality * 0.18 +
      typographyAssessment.luxuryBoost * 0.08 +
      curiosity.dimensions.premiumSimplicity * 0.12 +
      curiosity.dimensions.luxuryRestraint * 0.08 +
      (brief.materialEffects.toLowerCase().includes("luxury") ||
      brief.materialEffects.toLowerCase().includes("vintage")
        ? 8
        : 0) +
      (wearMatch.feelsPremium ? 8 : 0) +
      (wearMatch.aligned ? 4 : 0),
  );

  const overall = clamp(
    luxury * 0.09 +
      originality * 0.07 +
      streetwearAppeal * 0.1 +
      fashionAppeal * 0.08 +
      commercialPotential * 0.1 +
      collectionConsistency * 0.07 +
      typographyQuality * 0.1 +
      compositionQuality * 0.09 +
      wearability * 0.09 +
      printQuality * 0.05 +
      emotionalImpact * 0.07 +
      shareability * 0.05 +
      premiumFeeling * 0.04 +
      curiosityBoost,
  );

  const wouldBuy =
    overall >= COMMERCIAL_APPROVAL_THRESHOLD &&
    (wearability >= 80 || curiosity.wouldWearSignal >= 74) &&
    (premiumFeeling >= 76 || curiosity.wouldBuySignal >= 74) &&
    !(svg && countSvgTexts(svg) <= 2 && typeLayers <= 1);

  return {
    luxury,
    originality,
    streetwearAppeal,
    fashionAppeal,
    commercialPotential,
    collectionConsistency,
    typographyQuality,
    compositionQuality,
    wearability,
    printQuality,
    emotionalImpact,
    shareability,
    premiumFeeling,
    overall,
    wouldBuy,
  };
}

export function passesCommercialGate(score: CommercialScoreBreakdown): boolean {
  return score.overall >= COMMERCIAL_APPROVAL_THRESHOLD && score.wouldBuy;
}

export function weakestCommercialDimensions(
  score: CommercialScoreBreakdown,
  limit = 4,
): CommercialScoreDimension[] {
  return [...COMMERCIAL_SCORE_DIMENSIONS]
    .sort((a, b) => score[a] - score[b])
    .slice(0, limit);
}
