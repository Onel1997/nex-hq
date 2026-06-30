import type { DesignStudioBrief } from "@/agents/design/studio-brief";
import type { LibraryArtworkSpec } from "@/lib/design/design-library/types";
import type { CommercialScoreBreakdown } from "@/lib/design/commercial-design-director/commercial-score";
import { evaluateBuyerCuriosity } from "@/lib/design/design-knowledge/buyer-curiosity";
import { evaluateWearabilityCompositionMatch } from "@/lib/design/design-knowledge/wearability";

export const BUYER_PSYCHOLOGY_DIMENSIONS = [
  "curiosity",
  "emotion",
  "identity",
  "exclusivity",
  "luxury",
  "wearability",
  "versatility",
  "fashionRelevance",
  "socialMediaPotential",
  "conversationValue",
] as const;

export type BuyerPsychologyDimension = (typeof BUYER_PSYCHOLOGY_DIMENSIONS)[number];

export interface BuyerPsychologyProfile {
  curiosity: number;
  emotion: number;
  identity: number;
  exclusivity: number;
  luxury: number;
  wearability: number;
  versatility: number;
  fashionRelevance: number;
  socialMediaPotential: number;
  conversationValue: number;
  overall: number;
  wouldWear: boolean;
  wouldStopScrolling: boolean;
  notes: string[];
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function evaluateBuyerPsychology(
  brief: DesignStudioBrief,
  spec: LibraryArtworkSpec,
  commercialScore: CommercialScoreBreakdown,
): BuyerPsychologyProfile {
  const notes: string[] = [];
  const titleWords = brief.title.split(/\s+/).filter(Boolean).length;
  const typeLayers = spec.typography.filter((t) => t.layer === "typography").length;
  const curiosityProfile = evaluateBuyerCuriosity(brief, spec);

  const curiosity = clamp(
    curiosityProfile.dimensions.curiosity * 0.45 +
      (titleWords >= 2 ? 10 : 4) +
      commercialScore.originality * 0.2 +
      (brief.visualConcept.toLowerCase().includes("between") ||
      brief.visualConcept.toLowerCase().includes("only")
        ? 8
        : 0) +
      (typeLayers >= 3 ? 6 : 0),
  );

  const emotion = clamp(
    commercialScore.emotionalImpact * 0.65 +
      (brief.designDescription.length > 80 ? 8 : 0) +
      (brief.role.toLowerCase().includes("hero") ? 6 : 0),
  );

  const identity = clamp(
    curiosityProfile.dimensions.identity * 0.4 +
      commercialScore.collectionConsistency * 0.25 +
      commercialScore.streetwearAppeal * 0.2 +
      (brief.visualElements.length >= 3 ? 6 : 0),
  );

  const exclusivity = clamp(
    (brief.role.toLowerCase().includes("limited") ? 18 : 8) +
      (brief.campaignPotential ? 10 : 0) +
      commercialScore.premiumFeeling * 0.35,
  );

  const luxury = clamp(commercialScore.luxury * 0.7 + commercialScore.premiumFeeling * 0.3);

  const wearabilityMatch = spec.wearabilityDirection
    ? evaluateWearabilityCompositionMatch(spec)
    : null;

  const wearability = clamp(
    commercialScore.wearability * 0.6 +
      (wearabilityMatch?.weeklyWearable ? 14 : 0) +
      (wearabilityMatch?.feelsPremium ? 10 : 0) +
      (brief.product.toLowerCase().includes("tee") ||
      brief.product.toLowerCase().includes("hoodie")
        ? 8
        : 0),
  );

  const versatility = clamp(
    wearability * 0.45 +
      (spec.colors.ink !== spec.colors.secondary ? 8 : 0) +
      (brief.colorPalette.length >= 2 ? 6 : 0) +
      (spec.layout.id.includes("oversized") ? 8 : 0),
  );

  const fashionRelevance = clamp(
    commercialScore.fashionAppeal * 0.55 +
      commercialScore.streetwearAppeal * 0.35 +
      (spec.style.id.includes("editorial") ? 8 : 0),
  );

  const socialMediaPotential = clamp(
    curiosityProfile.dimensions.shareability * 0.35 +
      commercialScore.shareability * 0.3 +
      curiosity * 0.2 +
      emotion * 0.1 +
      (titleWords >= 2 && titleWords <= 4 ? 6 : 0),
  );

  const conversationValue = clamp(
    emotion * 0.35 +
      identity * 0.25 +
      exclusivity * 0.2 +
      curiosity * 0.2,
  );

  const overall = clamp(
    curiosity * 0.08 +
      emotion * 0.12 +
      identity * 0.1 +
      exclusivity * 0.08 +
      luxury * 0.1 +
      wearability * 0.14 +
      versatility * 0.08 +
      fashionRelevance * 0.1 +
      socialMediaPotential * 0.1 +
      conversationValue * 0.1,
  );

  const isStatementRole =
    brief.role.toLowerCase().includes("hero") || brief.role.toLowerCase().includes("statement");

  const wouldWear = isStatementRole
    ? curiosityProfile.dimensions.identity >= 68 &&
      commercialScore.wearability >= 72 &&
      (curiosityProfile.wouldWearSignal >= 66 ||
        curiosityProfile.desireSignal >= 68 ||
        curiosityProfile.dimensions.premiumSimplicity >= 65)
    : (curiosityProfile.wouldWearSignal >= 72 || commercialScore.wearability >= 80) &&
      (wearabilityMatch?.weeklyWearable ?? commercialScore.wearability >= 80) &&
      (identity >= 70 || curiosityProfile.dimensions.identity >= 72) &&
      (luxury >= 68 || curiosityProfile.dimensions.luxuryRestraint >= 70);
  const wouldStopScrolling =
    curiosityProfile.scrollStopPotential >= 72 ||
    (socialMediaPotential >= 75 &&
      curiosity >= 70 &&
      curiosityProfile.dimensions.visualHook >= 72 &&
      commercialScore.typographyQuality >= 72);

  if (!wouldWear) notes.push("wearability or identity signal is too weak for daily rotation");
  if (!wouldStopScrolling) notes.push("visual hook may not stop scrolling in feed");
  if (curiosityProfile.penalties.length > 0) {
    notes.push(`curiosity penalties: ${curiosityProfile.penalties.slice(0, 2).join("; ")}`);
  }
  if (curiosityProfile.rewards.length > 0) {
    notes.push(`curiosity rewards: ${curiosityProfile.rewards.slice(0, 2).join("; ")}`);
  }
  if (luxury < 72) notes.push("luxury perception below premium streetwear bar");
  if (emotion < 70) notes.push("emotional pull is underdeveloped");

  return {
    curiosity,
    emotion,
    identity,
    exclusivity,
    luxury,
    wearability,
    versatility,
    fashionRelevance,
    socialMediaPotential,
    conversationValue,
    overall,
    wouldWear,
    wouldStopScrolling,
    notes,
  };
}
