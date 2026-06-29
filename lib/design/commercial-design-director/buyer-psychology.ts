import type { DesignStudioBrief } from "@/agents/design/studio-brief";
import type { LibraryArtworkSpec } from "@/lib/design/design-library/types";
import type { CommercialScoreBreakdown } from "@/lib/design/commercial-design-director/commercial-score";

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

  const curiosity = clamp(
    (titleWords >= 2 ? 12 : 4) +
      commercialScore.originality * 0.35 +
      (brief.visualConcept.toLowerCase().includes("between") ||
      brief.visualConcept.toLowerCase().includes("only")
        ? 10
        : 0) +
      (typeLayers >= 3 ? 8 : 0),
  );

  const emotion = clamp(
    commercialScore.emotionalImpact * 0.65 +
      (brief.designDescription.length > 80 ? 8 : 0) +
      (brief.role.toLowerCase().includes("hero") ? 6 : 0),
  );

  const identity = clamp(
    commercialScore.collectionConsistency * 0.4 +
      commercialScore.streetwearAppeal * 0.35 +
      (brief.visualElements.length >= 3 ? 8 : 0),
  );

  const exclusivity = clamp(
    (brief.role.toLowerCase().includes("limited") ? 18 : 8) +
      (brief.campaignPotential ? 10 : 0) +
      commercialScore.premiumFeeling * 0.35,
  );

  const luxury = clamp(commercialScore.luxury * 0.7 + commercialScore.premiumFeeling * 0.3);

  const wearability = clamp(
    commercialScore.wearability * 0.75 +
      (brief.product.toLowerCase().includes("tee") ||
      brief.product.toLowerCase().includes("hoodie")
        ? 10
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
    commercialScore.shareability * 0.5 +
      curiosity * 0.25 +
      emotion * 0.15 +
      (titleWords >= 2 && titleWords <= 4 ? 8 : 0),
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

  const wouldWear = wearability >= 80 && identity >= 72 && luxury >= 70;
  const wouldStopScrolling =
    socialMediaPotential >= 78 && curiosity >= 72 && commercialScore.typographyQuality >= 75;

  if (!wouldWear) notes.push("wearability or identity signal is too weak for daily rotation");
  if (!wouldStopScrolling) notes.push("visual hook may not stop scrolling in feed");
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
