/**
 * Rule-based AI Quality Score for Persona candidates (0–100).
 * No vision model — heuristics from brief, variation, lifestyle fit, authenticity.
 *
 * A perfect-looking but low-authenticity candidate must not top the score.
 */

import type {
  CandidateAssetType,
  PersonaCreationProject,
  PersonaCandidate,
} from "../../domain/creation-types";
import { STAGE_A_ASSET_TYPES } from "../../domain/creation-types";
import type { CandidateVariationProfile } from "./variations";

export interface CandidateQualityDimensions {
  faceConsistency: number;
  commercialQuality: number;
  luxuryFeeling: number;
  brandMatch: number;
  lighting: number;
  poseQuality: number;
  editorialQuality: number;
  authenticity: number;
  relatability: number;
  lifestyleFit: number;
  socialMediaPresence: number;
  streetwearMatch: number;
  communityAppeal: number;
  overall: number;
}

export interface CandidateQualityAssessment {
  dimensions: CandidateQualityDimensions;
  strengths: string[];
  risks: string[];
  reviews: {
    fashionFit: string;
    bodyProportion: string;
    faceConsistency: string;
    realism: string;
  };
  method: "rule_based_v2_lifestyle";
}

function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(n)));
}

function filled(value: string | null | undefined): boolean {
  return Boolean(value && value.trim().length > 0);
}

function textBlob(parts: Array<string | null | undefined>): string {
  return parts.filter(Boolean).join(" ").toLowerCase();
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

function assetCoverageScore(assetTypes: CandidateAssetType[]): number {
  const required = STAGE_A_ASSET_TYPES;
  const have = new Set(assetTypes);
  const hits = required.filter((t) => have.has(t)).length;
  const base = (hits / required.length) * 100;
  const bonus = Math.min(8, Math.max(0, assetTypes.length - required.length) * 2);
  return clamp(base + bonus);
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

/**
 * Score a generated candidate using project brief + variation + asset coverage.
 */
export function assessCandidateQuality(params: {
  project: PersonaCreationProject;
  variation: CandidateVariationProfile;
  assetTypes: CandidateAssetType[];
  qualityMode?: string | null;
}): CandidateQualityAssessment {
  const completeness = briefCompleteness(params.project);
  const coverage = assetCoverageScore(params.assetTypes);
  const mode = params.qualityMode ?? params.project.quality_mode ?? "premium_editorial";

  const modeBoost =
    mode === "ultra_brand_cast" ? 6 : mode === "premium_editorial" ? 3 : 0;

  const brandKeywordHit = filled(params.project.visual_keywords) ? 6 : 0;
  const fashionHit = filled(params.project.fashion_style) ? 6 : 0;
  const variationClarity = params.variation.promptLines.length >= 3 ? 8 : 4;
  const identityClarity = filled(params.variation.identityDescriptor) ? 8 : 0;

  const blob = textBlob([
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
    ...params.variation.promptLines,
  ]);

  const lifestyleHits = countHits(blob, LIFESTYLE_CUES);
  const fashionWeekHits = countHits(blob, FASHION_WEEK_PENALTY_CUES);
  const lifestyleBoost = Math.min(18, lifestyleHits * 3);
  const fashionPenalty = Math.min(20, fashionWeekHits * 8);

  const faceConsistency = clamp(
    62 + coverage * 0.28 + variationClarity * 0.4 + identityClarity * 0.3,
  );
  const commercialQuality = clamp(
    56 + completeness * 0.2 + modeBoost + fashionHit + lifestyleBoost * 0.35,
  );
  const luxuryFeeling = clamp(
    48 +
      modeBoost +
      (blob.includes("premium") || blob.includes("luxury") ? 10 : 4) +
      lifestyleBoost * 0.4 -
      fashionPenalty * 0.4,
  );
  const brandMatch = clamp(
    52 + completeness * 0.25 + brandKeywordHit + fashionHit + lifestyleBoost * 0.5 - fashionPenalty,
  );
  const lighting = clamp(
    68 +
      modeBoost +
      (coverage >= 100 ? 6 : 2) +
      (blob.includes("daylight") || blob.includes("soft") ? 4 : 0),
  );
  const poseQuality = clamp(
    58 +
      coverage * 0.25 +
      variationClarity +
      (blob.includes("relaxed") || blob.includes("natural") || blob.includes("loose") ? 8 : 0) -
      (blob.includes("aggressive") || blob.includes("catwalk") ? 12 : 0),
  );
  // Editorial is supporting only — capped so it cannot dominate overall.
  const editorialQuality = clamp(
    42 + modeBoost + Math.min(12, variationClarity) - fashionPenalty * 0.5,
  );

  const authenticity = clamp(
    55 +
      identityClarity +
      lifestyleBoost +
      (blob.includes("authentic") || blob.includes("real person") || blob.includes("instagram")
        ? 10
        : 4) -
      fashionPenalty,
  );
  const relatability = clamp(
    52 +
      lifestyleBoost +
      (blob.includes("friendly") ||
      blob.includes("approachable") ||
      blob.includes("sympath") ||
      blob.includes("follow")
        ? 12
        : 4) -
      fashionPenalty,
  );
  const lifestyleFit = clamp(50 + lifestyleBoost * 1.4 + fashionHit - fashionPenalty);
  const socialMediaPresence = clamp(
    50 +
      lifestyleBoost +
      (blob.includes("instagram") || blob.includes("creator") || blob.includes("community")
        ? 12
        : 5) +
      relatability * 0.15 -
      fashionPenalty * 0.5,
  );
  const streetwearMatch = clamp(
    48 +
      lifestyleBoost * 1.2 +
      (blob.includes("tee") ||
      blob.includes("hoodie") ||
      blob.includes("heavyweight") ||
      blob.includes("streetwear")
        ? 14
        : 4) -
      fashionPenalty,
  );
  const communityAppeal = clamp(
    (authenticity + relatability + lifestyleFit + socialMediaPresence) / 4,
  );

  // Authenticity-heavy overall — low authenticity blocks a top score.
  const overall = clamp(
    authenticity * 0.16 +
      relatability * 0.12 +
      lifestyleFit * 0.14 +
      streetwearMatch * 0.12 +
      communityAppeal * 0.1 +
      socialMediaPresence * 0.08 +
      brandMatch * 0.1 +
      commercialQuality * 0.08 +
      faceConsistency * 0.06 +
      poseQuality * 0.02 +
      editorialQuality * 0.02,
  );

  const strengths: string[] = [];
  const risks: string[] = [];

  if (authenticity >= 75) strengths.push("Strong authenticity / real-person energy");
  if (lifestyleFit >= 70) strengths.push("Clear premium streetwear lifestyle fit");
  if (streetwearMatch >= 70) strengths.push("Wardrobe and streetwear cues land");
  if (communityAppeal >= 70) strengths.push("High community / followability potential");
  if (relatability >= 70) strengths.push("Approachable and relatable casting");
  strengths.push(`Model style: ${params.variation.label}`);

  if (authenticity < 65) {
    risks.push("Authenticity below Brand Face bar — may read too model-like");
  }
  if (fashionWeekHits > 0) {
    risks.push("Fashion-week / high-fashion cues detected — lifestyle direction at risk");
  }
  if (coverage < 100) risks.push("Incomplete Stage A camera set — consistency review needed");
  if (completeness < 55) risks.push("Thin brief — brand match is estimate-only");
  if (overall < 65) risks.push("Overall below premium lifestyle casting bar — manual review advised");

  return {
    dimensions: {
      faceConsistency,
      commercialQuality,
      luxuryFeeling,
      brandMatch,
      lighting,
      poseQuality,
      editorialQuality,
      authenticity,
      relatability,
      lifestyleFit,
      socialMediaPresence,
      streetwearMatch,
      communityAppeal,
      overall,
    },
    strengths,
    risks,
    reviews: {
      fashionFit: `Streetwear lifestyle fit ${clamp(streetwearMatch)} — ${params.project.fashion_style || "premium streetwear"} × ${params.variation.style}.`,
      bodyProportion: `Body “${params.variation.body}” held across ${params.assetTypes.length} assets.`,
      faceConsistency: `Face consistency ${faceConsistency} — unique identity “${params.variation.id}” locked across angles.`,
      realism: `Authenticity ${authenticity} / relatability ${relatability} — rule-based lifestyle scoring (no vision model).`,
    },
    method: "rule_based_v2_lifestyle",
  };
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
  return {
    brand_fit_score: d.brandMatch,
    identity_consistency_score: d.faceConsistency,
    realism_score: clamp((d.authenticity + d.commercialQuality) / 2),
    video_suitability_score: clamp(
      d.poseQuality * 0.35 + d.faceConsistency * 0.35 + d.relatability * 0.3,
    ),
    visual_strengths: assessment.strengths.join(" · "),
    visual_risks: assessment.risks.join(" · "),
    fashion_fit_review: assessment.reviews.fashionFit,
    body_proportion_review: assessment.reviews.bodyProportion,
    face_consistency_review: assessment.reviews.faceConsistency,
    realism_review: assessment.reviews.realism,
    image_suitability_label: `quality_v2:overall_${d.overall}`,
    video_suitability_label:
      d.faceConsistency >= 70 && d.authenticity >= 65
        ? "manual_heuristic:lifestyle_identity_stable_for_video_review"
        : "manual_heuristic:not_video_ready",
  };
}
