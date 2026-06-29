import type { CommercialScoreBreakdown, CommercialScoreDimension } from "@/lib/design/commercial-design-director/commercial-score";
import type { BuyerPsychologyProfile } from "@/lib/design/commercial-design-director/buyer-psychology";
import type { BrandDnaAssessment } from "@/lib/design/commercial-design-director/brand-dna";
import type { StreetwearAssessment } from "@/lib/design/commercial-design-director/streetwear";
import type { TrendFitAssessment } from "@/lib/design/commercial-design-director/trend-fit";
import type { CollectionFitAssessment } from "@/lib/design/commercial-design-director/collection-fit";
import type { EmotionalAssessment } from "@/lib/design/commercial-design-director/emotion";

export interface DesignCritique {
  approved: boolean;
  overallScore: number;
  primaryKpi: string;
  wouldBuy: boolean;
  wouldWear: boolean;
  wouldStopScrolling: boolean;
  wouldSell: boolean;
  feelsPremium: boolean;
  feelsOriginal: boolean;
  belongsInPremiumStore: boolean;
  strengths: string[];
  weaknesses: string[];
  directorNotes: string[];
}

const DIMENSION_LABELS: Record<CommercialScoreDimension, string> = {
  luxury: "luxury feeling",
  originality: "originality",
  streetwearAppeal: "streetwear appeal",
  fashionAppeal: "fashion appeal",
  commercialPotential: "commercial potential",
  collectionConsistency: "collection consistency",
  typographyQuality: "typography quality",
  compositionQuality: "composition quality",
  wearability: "wearability",
  printQuality: "print quality",
  emotionalImpact: "emotional impact",
  shareability: "shareability",
  premiumFeeling: "premium feeling",
};

function weaknessForDimension(dim: CommercialScoreDimension, score: number): string | undefined {
  if (score >= 82) return undefined;
  const label = DIMENSION_LABELS[dim];
  if (score < 65) return `${label} is critically weak (${score}/100)`;
  if (score < 75) return `${label} needs improvement (${score}/100)`;
  return `${label} is acceptable but not premium (${score}/100)`;
}

/** Senior Creative Director critique — does not create graphics. */
export function buildDesignCritique(input: {
  commercialScore: CommercialScoreBreakdown;
  psychology: BuyerPsychologyProfile;
  brandDna: BrandDnaAssessment;
  streetwear: StreetwearAssessment;
  trendFit: TrendFitAssessment;
  collectionFit: CollectionFitAssessment;
  emotion: EmotionalAssessment;
  weakestDimensions: CommercialScoreDimension[];
}): DesignCritique {
  const {
    commercialScore,
    psychology,
    brandDna,
    streetwear,
    trendFit,
    collectionFit,
    emotion,
    weakestDimensions,
  } = input;

  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const directorNotes: string[] = [];

  if (commercialScore.typographyQuality >= 85) {
    strengths.push("typography reads as fashion artwork, not a merch label");
  }
  if (commercialScore.compositionQuality >= 82) {
    strengths.push("composition has editorial tension and hierarchy");
  }
  if (commercialScore.luxury >= 80) {
    strengths.push("luxury feeling is present — quiet, not loud");
  }
  if (psychology.wouldStopScrolling) {
    strengths.push("would stop scrolling in a premium streetwear feed");
  }
  if (streetwear.belongsOnOversizedTee) {
    strengths.push("belongs on an oversized tee at garment scale");
  }
  if (brandDna.feelsLikeMilaene) {
    strengths.push("reinforces Milaene design language");
  }
  if (emotion.score >= 78) {
    strengths.push(`emotional mood "${emotion.mood}" adds wear-story value`);
  }
  if (collectionFit.narrativeCohesion) {
    strengths.push("fits the collection narrative, not a random graphic");
  }

  for (const dim of weakestDimensions) {
    const note = weaknessForDimension(dim, commercialScore[dim]);
    if (note) weaknesses.push(note);
  }

  if (!psychology.wouldStopScrolling) weaknesses.push("would not stop scrolling");
  if (!psychology.wouldWear) weaknesses.push("I would not confidently wear this");
  if (!brandDna.feelsLikeMilaene) weaknesses.push("does not feel like Milaene");
  if (streetwear.logoMarkRisk) weaknesses.push("reads too much like a logo mark, not a fashion graphic");
  if (commercialScore.compositionQuality < 72) weaknesses.push("composition feels too static");
  if (commercialScore.typographyQuality < 72) weaknesses.push("typography too weak for hero positioning");
  if (commercialScore.premiumFeeling < 72) weaknesses.push("luxury feeling missing at €44.90+ price point");
  if (!collectionFit.scaleCohesion) weaknesses.push("graphic scale mismatches collection role");
  if (trendFit.fastFashionRisk) weaknesses.push("risks fast-fashion trend graphic positioning");
  if (emotion.score < 70) weaknesses.push("not enough emotional value to justify purchase");

  directorNotes.push(
    `Primary KPI: "Would a human buy this shirt at €44.90–64.90?" → ${commercialScore.wouldBuy ? "YES" : "NOT YET"}`,
  );
  directorNotes.push(`Commercial score ${commercialScore.overall}/100 (gate: 90)`);
  directorNotes.push(`Buyer psychology ${psychology.overall}/100 — wear: ${psychology.wouldWear ? "yes" : "no"}`);
  directorNotes.push(`Brand DNA ${brandDna.score}/100 — Milaene: ${brandDna.feelsLikeMilaene ? "yes" : "no"}`);

  const approved = commercialScore.overall >= 90 && commercialScore.wouldBuy;

  return {
    approved,
    overallScore: commercialScore.overall,
    primaryKpi:
      "If this appeared on a premium Shopify store for €44.90–64.90, would someone genuinely want to buy and wear it?",
    wouldBuy: commercialScore.wouldBuy,
    wouldWear: psychology.wouldWear,
    wouldStopScrolling: psychology.wouldStopScrolling,
    wouldSell: commercialScore.commercialPotential >= 82 && psychology.conversationValue >= 70,
    feelsPremium: commercialScore.premiumFeeling >= 78,
    feelsOriginal: commercialScore.originality >= 75,
    belongsInPremiumStore:
      commercialScore.premiumFeeling >= 78 &&
      brandDna.feelsLikeMilaene &&
      streetwear.belongsOnOversizedTee,
    strengths: [...new Set(strengths)],
    weaknesses: [...new Set(weaknesses)],
    directorNotes,
  };
}
