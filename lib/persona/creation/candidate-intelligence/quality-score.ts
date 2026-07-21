/**
 * Phase 1.6B — Honest casting scores (rule-based brief fit).
 *
 * Separates:
 * - briefFit — metadata/brief/variation/wardrobe heuristics only
 * - technicalCompleteness — Stage A asset coverage facts
 * - visualEvaluation — not performed unless an evaluator result is supplied
 *
 * Does NOT call any vision model. Dimensions like commercialFace are
 * brief-fit heuristics, not verified visual judgments.
 */

import type {
  CandidateAssetType,
  PersonaCreationProject,
  PersonaCandidate,
} from "../../domain/creation-types";
import { STAGE_A_ASSET_TYPES } from "../../domain/creation-types";
import type { CandidateVariationProfile } from "./variations";
import {
  buildCastingRecommendation,
  type CastingRecommendation,
} from "./casting-recommendations";
import {
  emptyVisualEvaluation,
  type VisualCastingEvaluation,
  type VisualEvaluationStatus,
} from "./visual-evaluator";

export interface CandidateQualityDimensions {
  /** Brief-fit heuristic for commercial casting direction — not visual. */
  commercialFace: number;
  brandRecall: number;
  memorability: number;
  premiumPresence: number;
  campaignVersatility: number;
  eyeContact: number;
  facialBalance: number;
  lifestyleAuthenticity: number;
  communityAppeal: number;
  socialMediaPresence: number;
  streetwearMatch: number;
  /** @deprecated Prefer commercialFace — kept for older stored assessments. */
  commercialQuality: number;
  faceConsistency: number;
  luxuryFeeling: number;
  brandMatch: number;
  lighting: number;
  poseQuality: number;
  editorialQuality: number;
  authenticity: number;
  relatability: number;
  lifestyleFit: number;
  /** Always equals briefFit — not a fabricated visual commercial score. */
  overall: number;
}

export interface CandidateQualityScoreHonesty {
  briefFitLabel: "Brief Fit";
  technicalLabel: "Technical Completeness";
  visualLabel: "Not visually evaluated";
}

export interface CandidateQualityAssessment {
  dimensions: CandidateQualityDimensions;
  /** Brief / variation / wardrobe / usage metadata fit (0–100). */
  briefFit: number;
  /** Stage A asset coverage facts (0–100). 1 of 3 ≈ 33. */
  technicalCompleteness: number;
  /** Visual casting — default not_performed; optional evaluator result. */
  visualEvaluation: VisualCastingEvaluation;
  scoreHonesty: CandidateQualityScoreHonesty;
  strengths: string[];
  risks: string[];
  /** Channel suggestions derived from brief-fit dimensions only. */
  casting: CastingRecommendation;
  reviews: {
    fashionFit: string;
    bodyProportion: string;
    faceConsistency: string;
    realism: string;
    castingAnalysis: string;
    commercialPotential: string;
    brandCompatibility: string;
    campaignReadiness: string;
    marketFit: string;
    lifestylePresence: string;
    identityStrength: string;
    memorability: string;
  };
  method: "rule_based_brief_fit_v1";
}

const SCORE_HONESTY: CandidateQualityScoreHonesty = {
  briefFitLabel: "Brief Fit",
  technicalLabel: "Technical Completeness",
  visualLabel: "Not visually evaluated",
};

/** Soft ceiling so complete briefs land roughly in the 45–85 band. */
const BRIEF_DIM_SOFT_MAX = 85;
const BRIEF_DIM_SOFT_MIN = 42;

function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(n)));
}

/** Clamp brief-fit dimension heuristics into a realistic band. */
function briefDim(n: number): number {
  return clamp(n, BRIEF_DIM_SOFT_MIN, BRIEF_DIM_SOFT_MAX);
}

function filled(value: string | null | undefined): boolean {
  return Boolean(value && value.trim().length > 0);
}

function textBlob(parts: Array<string | null | undefined>): string {
  return parts.filter(Boolean).join(" ").toLowerCase();
}

/**
 * Blob for positive cue matching — drops Avoid: lines and negated phrases
 * so "not aggressive" / "Avoid: runway" do not trigger penalties or boosts.
 */
function cueMatchingBlob(parts: Array<string | null | undefined>): string {
  const filtered = parts
    .filter((p): p is string => Boolean(p && p.trim()))
    .filter((p) => !/^\s*avoid\s*:/i.test(p));
  return textBlob(filtered).replace(
    /\b(?:not|no|never|without|avoid(?:ing)?)\s+[\w/-]+(?:\s+[\w/-]+){0,3}/g,
    " ",
  );
}

function countHits(haystack: string, needles: string[]): number {
  return needles.reduce((n, needle) => (haystack.includes(needle) ? n + 1 : n), 0);
}

function briefCompleteness(project: PersonaCreationProject): number {
  const fields = [
    project.age_range,
    project.gender_presentation,
    project.body_type,
    project.skin_tone_direction,
    project.face_shape_direction,
    project.hair_direction,
    project.eye_direction,
    project.expression_direction,
    project.fashion_style,
    project.personality,
    project.visual_keywords,
  ];
  const hits = fields.filter(filled).length;
  return (hits / fields.length) * 100;
}

/**
 * Technical completeness from Stage A asset coverage only.
 * Full set (3 angles) = 100; A1 discovery with 1 asset ≈ 33.
 */
function technicalCompletenessScore(assetTypes: CandidateAssetType[]): number {
  const required = STAGE_A_ASSET_TYPES;
  if (required.length === 0) return 0;
  const have = new Set(assetTypes);
  const hits = required.filter((t) => have.has(t)).length;
  return clamp((hits / required.length) * 100);
}

const LIFESTYLE_CUES = [
  "streetwear",
  "lifestyle",
  "hoodie",
  "heavyweight",
  "oversized",
  "urban",
  "authentic",
  "community",
  "instagram",
  "relaxed",
  "everyday",
  "weekend",
  "creator",
];

const FASHION_WEEK_PENALTY_CUES = [
  "fashion week",
  "runway",
  "vogue",
  "editorial intensity",
  "high-fashion",
  "catwalk",
  "magazine cover",
  "ceo",
  "corporate",
  "aggressive",
  "intimidating",
];

const COMMERCIAL_FACE_CUES = [
  "friendly",
  "approachable",
  "eye contact",
  "soft eye",
  "calm confidence",
  "natural",
  "sympath",
  "follow",
];

const MEMORABILITY_CUES = [
  "distinct",
  "unique",
  "signature",
  "memorable",
  "character",
  "different person",
];

/**
 * Score a candidate from project brief + variation + asset coverage.
 * Optional visualEvaluation is stored as-is; default is not_performed.
 * Never invokes a vision model.
 */
export function assessCandidateQuality(params: {
  project: PersonaCreationProject;
  variation: CandidateVariationProfile;
  assetTypes: CandidateAssetType[];
  qualityMode?: string | null;
  visualEvaluation?: VisualCastingEvaluation;
}): CandidateQualityAssessment {
  const completeness = briefCompleteness(params.project);
  const technicalCompleteness = technicalCompletenessScore(params.assetTypes);
  const mode = params.qualityMode ?? params.project.quality_mode ?? "premium_editorial";

  const modeBoost =
    mode === "ultra_brand_cast" ? 4 : mode === "premium_editorial" ? 2 : 0;

  const brandKeywordHit = filled(params.project.visual_keywords) ? 4 : 0;
  const fashionHit = filled(params.project.fashion_style) ? 4 : 0;
  const variationClarity = params.variation.promptLines.length >= 3 ? 5 : 2;
  const identityClarity = filled(params.variation.identityDescriptor) ? 5 : 0;
  const wardrobeClarity = filled(params.variation.wardrobe) ? 4 : 0;

  const cueParts = [
    params.project.fashion_style,
    params.project.visual_keywords,
    params.project.personality,
    params.project.expression_direction,
    params.project.preferred_outfits,
    params.variation.aesthetic,
    params.variation.presence,
    params.variation.wardrobe,
    params.variation.expression,
    params.variation.posture,
    params.variation.faceStructure,
    params.variation.eyeShape,
    params.variation.identityDescriptor,
    ...params.variation.promptLines,
  ];
  const blob = cueMatchingBlob(cueParts);

  const lifestyleHits = countHits(blob, LIFESTYLE_CUES);
  const fashionWeekHits = countHits(blob, FASHION_WEEK_PENALTY_CUES);
  const commercialHits = countHits(blob, COMMERCIAL_FACE_CUES);
  const memoryHits = countHits(blob, MEMORABILITY_CUES);
  const lifestyleBoost = Math.min(12, lifestyleHits * 2);
  const fashionPenalty = Math.min(18, fashionWeekHits * 7);

  // --- Brief-fit dimension heuristics (metadata only; soft-capped) ---

  const faceConsistency = briefDim(
    52 + variationClarity + identityClarity * 0.6 + (completeness > 60 ? 4 : 0),
  );

  const eyeContact = briefDim(
    48 +
      commercialHits * 3 +
      (blob.includes("eye contact") || blob.includes("soft eye") || blob.includes("open")
        ? 8
        : 2) +
      (blob.includes("aggressive") || blob.includes("scowl") || blob.includes("intimidating")
        ? -12
        : 0),
  );

  const facialBalance = briefDim(
    50 +
      identityClarity * 0.5 +
      (blob.includes("balanced") || blob.includes("natural") || blob.includes("soft")
        ? 7
        : 2) +
      variationClarity * 0.5 -
      (blob.includes("razor") || blob.includes("hollow fashion") ? 8 : 0),
  );

  const commercialFace = briefDim(
    48 +
      completeness * 0.1 +
      commercialHits * 3.5 +
      eyeContact * 0.08 +
      facialBalance * 0.08 +
      lifestyleBoost * 0.35 +
      modeBoost -
      fashionPenalty * 0.55,
  );

  const brandRecall = briefDim(
    46 +
      brandKeywordHit +
      fashionHit +
      lifestyleBoost * 0.45 +
      identityClarity +
      memoryHits * 3 -
      fashionPenalty * 0.45,
  );

  const memorability = briefDim(
    45 +
      identityClarity +
      memoryHits * 4 +
      variationClarity +
      (blob.includes("different person") || blob.includes("unique") ? 7 : 2) -
      fashionPenalty * 0.25,
  );

  const premiumPresence = briefDim(
    46 +
      modeBoost +
      (blob.includes("premium") || blob.includes("luxury") || blob.includes("quiet")
        ? 8
        : 3) +
      lifestyleBoost * 0.35 -
      fashionPenalty * 0.4,
  );

  const campaignVersatility = briefDim(
    46 +
      lifestyleBoost * 0.4 +
      commercialHits * 2 +
      wardrobeClarity +
      (blob.includes("relaxed") || blob.includes("versatile") || blob.includes("everyday")
        ? 7
        : 2) -
      fashionPenalty * 0.35,
  );

  const commercialQuality = commercialFace;

  const luxuryFeeling = briefDim(
    44 +
      modeBoost +
      (blob.includes("premium") || blob.includes("luxury") ? 7 : 3) +
      lifestyleBoost * 0.3 -
      fashionPenalty * 0.35,
  );

  const brandMatch = briefDim(
    48 +
      completeness * 0.18 +
      brandKeywordHit +
      fashionHit +
      lifestyleBoost * 0.4 +
      wardrobeClarity -
      fashionPenalty * 0.85,
  );

  // Lighting / pose are brief-intent proxies only — not image analysis.
  const lighting = briefDim(
    50 +
      modeBoost +
      (blob.includes("daylight") || blob.includes("soft") ? 6 : 1),
  );

  const poseQuality = briefDim(
    48 +
      variationClarity +
      (blob.includes("relaxed") || blob.includes("natural") || blob.includes("loose")
        ? 7
        : 1) -
      (blob.includes("aggressive") || blob.includes("catwalk") ? 10 : 0),
  );

  const editorialQuality = briefDim(
    42 + modeBoost + Math.min(8, variationClarity) - fashionPenalty * 0.45,
  );

  const authenticity = briefDim(
    50 +
      identityClarity +
      lifestyleBoost * 0.85 +
      (blob.includes("authentic") || blob.includes("real person") || blob.includes("instagram")
        ? 7
        : 2) -
      fashionPenalty * 0.9,
  );
  const lifestyleAuthenticity = authenticity;

  const relatability = briefDim(
    48 +
      lifestyleBoost * 0.85 +
      (blob.includes("friendly") ||
      blob.includes("approachable") ||
      blob.includes("sympath") ||
      blob.includes("follow")
        ? 8
        : 2) -
      fashionPenalty * 0.85,
  );

  const lifestyleFit = briefDim(
    47 + lifestyleBoost * 1.1 + fashionHit + wardrobeClarity - fashionPenalty * 0.9,
  );

  const socialMediaPresence = briefDim(
    46 +
      lifestyleBoost * 0.8 +
      (blob.includes("instagram") || blob.includes("creator") || blob.includes("community")
        ? 8
        : 3) +
      relatability * 0.08 -
      fashionPenalty * 0.4,
  );

  const streetwearMatch = briefDim(
    46 +
      lifestyleBoost * 0.95 +
      wardrobeClarity +
      (blob.includes("tee") ||
      blob.includes("hoodie") ||
      blob.includes("heavyweight") ||
      blob.includes("streetwear")
        ? 10
        : 3) -
      fashionPenalty * 0.95,
  );

  const communityAppeal = briefDim(
    (authenticity + relatability + lifestyleFit + socialMediaPresence) / 4,
  );

  /**
   * Brief Fit — weighted metadata signals only.
   * Overall MUST equal briefFit (honest: not a visual commercial score).
   */
  const briefFit = clamp(
    commercialFace * 0.18 +
      streetwearMatch * 0.18 +
      authenticity * 0.16 +
      brandMatch * 0.16 +
      communityAppeal * 0.1 +
      campaignVersatility * 0.08 +
      lifestyleFit * 0.08 +
      memorability * 0.06,
  );
  const overall = briefFit;

  const strengths = buildStrengths({
    commercialFace,
    brandRecall,
    campaignVersatility,
    lifestyleAuthenticity,
    premiumPresence,
    streetwearMatch,
    communityAppeal,
    memorability,
    eyeContact,
    authenticity,
    relatability,
    briefFit,
    variationLabel: params.variation.label,
  });

  const risks = buildRisks({
    commercialFace,
    editorialQuality,
    authenticity,
    communityAppeal,
    fashionWeekHits,
    technicalCompleteness,
    completeness,
    briefFit,
    blob,
  });

  const dimensions: CandidateQualityDimensions = {
    commercialFace,
    brandRecall,
    memorability,
    premiumPresence,
    campaignVersatility,
    eyeContact,
    facialBalance,
    lifestyleAuthenticity,
    communityAppeal,
    socialMediaPresence,
    streetwearMatch,
    commercialQuality,
    faceConsistency,
    luxuryFeeling,
    brandMatch,
    lighting,
    poseQuality,
    editorialQuality,
    authenticity,
    relatability,
    lifestyleFit,
    overall,
  };

  const casting = buildCastingRecommendation(dimensions);
  const visualEvaluation = params.visualEvaluation ?? emptyVisualEvaluation();

  return {
    dimensions,
    briefFit,
    technicalCompleteness,
    visualEvaluation,
    scoreHonesty: SCORE_HONESTY,
    strengths,
    risks,
    casting,
    reviews: {
      fashionFit: `Brief-fit streetwear ${clamp(streetwearMatch)} — ${params.project.fashion_style || "premium streetwear"} × ${params.variation.style} (metadata only).`,
      bodyProportion: `Body direction “${params.variation.body}” across ${params.assetTypes.length} asset(s); technical completeness ${technicalCompleteness}.`,
      faceConsistency: `Identity metadata consistency ${faceConsistency} — “${params.variation.id}” (not visual face-match).`,
      realism: `Not visually evaluated — technical completeness ${technicalCompleteness}; brief authenticity heuristic ${lifestyleAuthenticity}.`,
      castingAnalysis: `Brief Fit ${briefFit} · Commercial Face (brief heuristic) ${commercialFace} · Memorability ${memorability}. Casting channels are brief-fit based.`,
      commercialPotential: `Brief commercial heuristic ${commercialFace} — Brand Recall ${brandRecall}, Premium Presence ${premiumPresence}. Not a visual commercial score.`,
      brandCompatibility: `Brief brand match ${brandMatch} — Streetwear Match ${streetwearMatch}.`,
      campaignReadiness: `${casting.campaignReadinessLabel} (brief-fit based)`,
      marketFit: `${casting.marketFitLabel} (brief-fit based)`,
      lifestylePresence: `Lifestyle brief fit ${lifestyleFit} — authenticity-led direction.`,
      identityStrength: `Identity descriptor strength ${faceConsistency} — metadata lock, not image verification.`,
      memorability: `Memorability heuristic ${memorability} — distinct casting signature in brief/variation text.`,
    },
    method: "rule_based_brief_fit_v1",
  };
}

function buildStrengths(input: {
  commercialFace: number;
  brandRecall: number;
  campaignVersatility: number;
  lifestyleAuthenticity: number;
  premiumPresence: number;
  streetwearMatch: number;
  communityAppeal: number;
  memorability: number;
  eyeContact: number;
  authenticity: number;
  relatability: number;
  briefFit: number;
  variationLabel: string;
}): string[] {
  const strengths: string[] = [];
  if (input.briefFit >= 70) strengths.push("Strong brief fit");
  if (input.commercialFace >= 68) strengths.push("Commercial face direction (brief)");
  if (input.brandRecall >= 66) strengths.push("High brand recall direction");
  if (input.campaignVersatility >= 66) strengths.push("Campaign versatility (brief)");
  if (input.lifestyleAuthenticity >= 68) strengths.push("Authentic lifestyle direction");
  if (input.eyeContact >= 66 && input.relatability >= 62) {
    strengths.push("Approachable presence direction");
  }
  if (input.streetwearMatch >= 66 && input.premiumPresence >= 62) {
    strengths.push("Premium streetwear direction");
  }
  if (input.communityAppeal >= 66) strengths.push("Strong community appeal direction");
  if (input.memorability >= 66) strengths.push("Distinct casting signature");
  if (input.authenticity >= 70) strengths.push("Strong authenticity / real-person energy");
  if (strengths.length === 0) {
    strengths.push("Balanced brief-fit profile — review against brief");
  }
  return [...strengths.slice(0, 5), `Casting role: ${input.variationLabel}`];
}

function buildRisks(input: {
  commercialFace: number;
  editorialQuality: number;
  authenticity: number;
  communityAppeal: number;
  fashionWeekHits: number;
  technicalCompleteness: number;
  completeness: number;
  briefFit: number;
  blob: string;
}): string[] {
  const risks: string[] = [];

  if (input.commercialFace >= 80 && input.authenticity < 62) {
    risks.push("Too commercial (brief direction)");
  }
  if (input.editorialQuality >= 68 && input.authenticity < 62) {
    risks.push("Too editorial (brief direction)");
  }
  if (
    input.blob.includes("aggressive") ||
    input.blob.includes("intimidating") ||
    input.blob.includes("scowl")
  ) {
    risks.push("Too aggressive");
  }
  if (
    (input.blob.includes("teen") ||
      input.blob.includes("underage") ||
      input.blob.includes("boyish")) &&
    !input.blob.includes("adult")
  ) {
    risks.push("Too young");
  }
  if (
    input.blob.includes("ceo") ||
    input.blob.includes("executive") ||
    (input.blob.includes("mature") && input.blob.includes("corporate"))
  ) {
    risks.push("Too mature");
  }
  if (input.communityAppeal < 55) {
    risks.push("Weak community appeal (brief)");
  }
  if (input.authenticity < 58) {
    risks.push("Authenticity below Brand Face bar — may read too model-like");
  }
  if (input.fashionWeekHits > 0) {
    risks.push("Fashion-week / high-fashion cues detected — lifestyle direction at risk");
  }
  if (input.technicalCompleteness < 100) {
    risks.push(
      `Incomplete Stage A set — technical completeness ${input.technicalCompleteness}/100`,
    );
  }
  if (input.completeness < 55) {
    risks.push("Thin brief — brand match is estimate-only");
  }
  if (input.briefFit < 55) {
    risks.push("Brief fit below casting bar — manual review advised");
  }
  risks.push("Not visually evaluated — scores are brief-fit / technical only");

  return risks.slice(0, 6);
}

export function qualityFieldsForCandidate(
  assessment: CandidateQualityAssessment,
): Pick<
  PersonaCandidate,
  | "brand_fit_score"
  | "identity_consistency_score"
  | "realism_score"
  | "video_suitability_score"
  | "visual_strengths"
  | "visual_risks"
  | "fashion_fit_review"
  | "body_proportion_review"
  | "face_consistency_review"
  | "realism_review"
  | "image_suitability_label"
  | "video_suitability_label"
> {
  const d = assessment.dimensions;
  const briefFit = assessment.briefFit;
  return {
    brand_fit_score: briefFit,
    identity_consistency_score: d.faceConsistency,
    // Do not claim visual realism — technical coverage + muted brief authenticity.
    realism_score: clamp(
      Math.min(
        72,
        assessment.technicalCompleteness * 0.5 + Math.min(d.authenticity, 65) * 0.3,
      ),
    ),
    video_suitability_score: clamp(
      assessment.technicalCompleteness * 0.5 +
        d.faceConsistency * 0.25 +
        d.campaignVersatility * 0.15 +
        Math.min(d.poseQuality, 70) * 0.1,
    ),
    visual_strengths: assessment.strengths.join(" · "),
    visual_risks: assessment.risks.join(" · "),
    fashion_fit_review: assessment.reviews.fashionFit,
    body_proportion_review: assessment.reviews.bodyProportion,
    face_consistency_review: assessment.reviews.faceConsistency,
    realism_review: assessment.reviews.realism,
    image_suitability_label: `brief_fit_v1:overall_${briefFit}`,
    video_suitability_label:
      assessment.technicalCompleteness >= 100 && d.lifestyleAuthenticity >= 62
        ? "manual_heuristic:brief_identity_stable_for_video_review"
        : "manual_heuristic:not_video_ready_brief_or_incomplete",
  };
}

/**
 * Prefer briefFit, then dimensions.overall, then denormalized brand_fit.
 */
export function readCandidateOverallScore(
  generationSettings: Record<string, unknown> | null | undefined,
  fallbackBrandFit?: number | null,
): number | null {
  const qa = generationSettings?.qualityAssessment as
    | {
        briefFit?: number;
        dimensions?: { overall?: number };
        brand_fit_score?: number;
      }
    | undefined;
  if (typeof qa?.briefFit === "number") return qa.briefFit;
  if (typeof qa?.dimensions?.overall === "number") return qa.dimensions.overall;
  if (typeof fallbackBrandFit === "number") return fallbackBrandFit;
  return null;
}

/**
 * Read casting scores from stored assessment.
 * commercialFace is a brief-fit heuristic — not a verified visual score.
 */
export function readCandidateCastingScores(
  generationSettings: Record<string, unknown> | null | undefined,
): {
  overall: number | null;
  briefFit: number | null;
  technicalCompleteness: number | null;
  visualStatus: VisualEvaluationStatus | null;
  /** Brief-fit heuristic only — not verified visual commercial score. */
  commercialFace: number | null;
  brandMatch: number | null;
  streetwearMatch: number | null;
  authenticity: number | null;
  strengths: string[];
  risks: string[];
  bestFor: string[];
  primaryUse: string | null;
} {
  const qa = generationSettings?.qualityAssessment as
    | {
        briefFit?: number;
        technicalCompleteness?: number;
        visualEvaluation?: { status?: VisualEvaluationStatus };
        dimensions?: Record<string, number>;
        strengths?: string[];
        risks?: string[];
        casting?: { bestFor?: string[]; primaryUse?: string };
        method?: string;
      }
    | undefined;
  const d = qa?.dimensions ?? {};

  const briefFit =
    typeof qa?.briefFit === "number"
      ? qa.briefFit
      : typeof d.overall === "number"
        ? d.overall
        : null;

  const commercialFace =
    typeof d.commercialFace === "number"
      ? d.commercialFace
      : typeof d.commercialQuality === "number"
        ? d.commercialQuality
        : null;

  const visualStatus =
    qa?.visualEvaluation?.status ??
    (qa ? ("not_performed" as VisualEvaluationStatus) : null);

  return {
    overall: briefFit,
    briefFit,
    technicalCompleteness:
      typeof qa?.technicalCompleteness === "number" ? qa.technicalCompleteness : null,
    visualStatus,
    commercialFace,
    brandMatch: typeof d.brandMatch === "number" ? d.brandMatch : null,
    streetwearMatch: typeof d.streetwearMatch === "number" ? d.streetwearMatch : null,
    authenticity:
      typeof d.lifestyleAuthenticity === "number"
        ? d.lifestyleAuthenticity
        : typeof d.authenticity === "number"
          ? d.authenticity
          : null,
    strengths: Array.isArray(qa?.strengths) ? qa.strengths : [],
    risks: Array.isArray(qa?.risks) ? qa.risks : [],
    bestFor: Array.isArray(qa?.casting?.bestFor) ? qa.casting.bestFor : [],
    primaryUse:
      typeof qa?.casting?.primaryUse === "string" ? qa.casting.primaryUse : null,
  };
}
