/**
 * Persona Studio Phase 1.5 — quality modes (UX-facing, not provider brands).
 */

import type { CandidateAssetType, GenerationStage, QualityMode } from "../domain/creation-types";
import {
  DEFAULT_CANDIDATE_COUNT,
  QUALITY_MODES,
  STAGE_A_ASSET_TYPES,
  STAGE_B_ASSET_TYPES,
} from "../domain/creation-types";

export type { QualityMode };
export { QUALITY_MODES };

export const DEFAULT_QUALITY_MODE: QualityMode = "premium_editorial";

export type OpenAiPersonaQuality = "low" | "medium" | "high";

export interface QualityModeProfile {
  id: QualityMode;
  label: string;
  expectedRealism: string;
  expectedIdentityConsistency: string;
  defaultCandidateCount: number;
  imagesPerCandidateDiscovery: number;
  estimatedMinutesPerCandidate: number;
  imageSuitability: string;
  videoSuitability: string;
  openaiQuality: OpenAiPersonaQuality;
  costMultiplier: number;
  identityConsistentExpansionSupported: boolean;
  note: string;
}

export const QUALITY_MODE_PROFILES: Record<QualityMode, QualityModeProfile> = {
  draft_discovery: {
    id: "draft_discovery",
    label: "Draft Discovery",
    expectedRealism: "Good for direction exploration",
    expectedIdentityConsistency: "Not identity-locked — exploration only",
    defaultCandidateCount: DEFAULT_CANDIDATE_COUNT,
    imagesPerCandidateDiscovery: STAGE_A_ASSET_TYPES.length,
    estimatedMinutesPerCandidate: 0.6,
    imageSuitability: "Direction preview",
    videoSuitability: "Not suitable for video lock",
    openaiQuality: "low",
    costMultiplier: 0.7,
    identityConsistentExpansionSupported: false,
    note: "Fast casting sketches. Not for final Brand Cast approval.",
  },
  premium_editorial: {
    id: "premium_editorial",
    label: "Premium Editorial",
    expectedRealism: "Commercial fashion-editorial realism",
    expectedIdentityConsistency: "Requires manual identity review",
    defaultCandidateCount: DEFAULT_CANDIDATE_COUNT,
    imagesPerCandidateDiscovery: STAGE_A_ASSET_TYPES.length,
    estimatedMinutesPerCandidate: 1.1,
    imageSuitability: "Strong for image Brand Cast",
    videoSuitability: "Heuristic only — video lock is separate",
    openaiQuality: "high",
    costMultiplier: 1.4,
    identityConsistentExpansionSupported: false,
    note: "Default for Milaene. Photoreal casting with mandatory identity review.",
  },
  ultra_brand_cast: {
    id: "ultra_brand_cast",
    label: "Ultra Brand Cast",
    expectedRealism: "Highest available photoreal quality",
    expectedIdentityConsistency: "Requires manual identity review + reference package",
    defaultCandidateCount: DEFAULT_CANDIDATE_COUNT,
    imagesPerCandidateDiscovery: STAGE_A_ASSET_TYPES.length,
    estimatedMinutesPerCandidate: 1.5,
    imageSuitability: "Best available for final image faces",
    videoSuitability: "Still requires separate video suitability review",
    openaiQuality: "high",
    costMultiplier: 1.8,
    identityConsistentExpansionSupported: false,
    note: "Maximum quality for hero faces. Cost is higher; confirmation required.",
  },
};

export function getQualityModeProfile(mode: QualityMode | string): QualityModeProfile {
  if (mode === "draft_discovery" || mode === "premium_editorial" || mode === "ultra_brand_cast") {
    return QUALITY_MODE_PROFILES[mode];
  }
  return QUALITY_MODE_PROFILES[DEFAULT_QUALITY_MODE];
}

export function assetTypesForStageAndMode(
  stage: GenerationStage,
  _mode: QualityMode,
): CandidateAssetType[] {
  if (stage === "discovery") return [...STAGE_A_ASSET_TYPES];
  if (stage === "shortlist_validation") return [...STAGE_B_ASSET_TYPES];
  return [];
}

export const OPENAI_PROVIDER_CAPABILITY = {
  stageADiscovery: true as const,
  stageBIdentityConsistentExpansion: false as const,
  commercialResolution: true as const,
  controlledStyling: true as const,
  distinctCandidates: true as const,
  requiresManualIdentityReview: true as const,
  note:
    "OpenAI gpt-image-1 is suitable for Stage A discovery portraits. " +
    "Same-person reference package expansion is not reliable — " +
    "Stage B requires manual references and identity review.",
};
