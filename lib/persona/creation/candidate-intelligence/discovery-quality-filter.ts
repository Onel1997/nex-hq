/**
 * Phase 1.8A — Discovery quality filter for A1 casting portraits.
 *
 * Rejects sub-premium candidates before they surface in the UI.
 * Uses prompt-compliance + brief-fit heuristics (no live vision model).
 * Providers may internally regenerate until the bar is met or attempts exhaust.
 */

import type {
  CandidateAssetType,
  PersonaCreationProject,
} from "../../domain/creation-types";
import type { BuiltCandidatePrompt } from "./prompt-builder";
import { assessCandidateQuality } from "./quality-score";
import {
  PREMIUM_PROMPT_REQUIRED_TOKENS,
  SUBPREMIUM_CASTING_CUES,
  buildPremiumRetryPromptSuffix,
  isOfficialArchetypeSlug,
} from "./premium-casting-direction";
import type { CandidateVariationProfile } from "./variations";

export const DISCOVERY_QUALITY_MIN_BRIEF_FIT = 58;
export const DISCOVERY_QUALITY_MIN_PREMIUM_PRESENCE = 55;
export const DISCOVERY_QUALITY_MIN_EDITORIAL = 52;
export const DISCOVERY_QUALITY_MAX_REGENERATION_ATTEMPTS = 3;

export type DiscoveryQualityVerdict = {
  pass: boolean;
  briefFit: number;
  premiumPresence: number;
  editorialQuality: number;
  reasons: string[];
  shouldRegenerate: boolean;
  attempt: number;
};

export function evaluateDiscoveryCastingQuality(params: {
  built: BuiltCandidatePrompt;
  project: PersonaCreationProject;
  variation: CandidateVariationProfile;
  assetTypes: CandidateAssetType[];
  qualityMode?: string | null;
  attempt?: number;
}): DiscoveryQualityVerdict {
  const attempt = params.attempt ?? 1;
  const reasons: string[] = [];
  const promptLower = params.built.prompt.toLowerCase();
  const negativeLower = params.built.negativePrompt.toLowerCase();
  const slug = params.built.brandArchetype.slug;

  if (!params.built.prompt.includes("STRICT CASTING ROLE")) {
    reasons.push("Missing strict gender role enforcement");
  }

  if (isOfficialArchetypeSlug(slug)) {
    if (slug === "female-lifestyle-hero" && promptLower.includes("only adult male")) {
      reasons.push("Gender violation: female hero must not be male");
    }
    if (
      (slug === "mediterranean-premium-hero" || slug === "urban-community-hero") &&
      promptLower.includes("only adult female")
    ) {
      reasons.push("Gender violation: male hero must not be female");
    }
  }

  for (const cue of SUBPREMIUM_CASTING_CUES) {
    if (promptLower.includes(cue) && !negativeLower.includes(cue)) {
      reasons.push(`Sub-premium cue in prompt: ${cue}`);
    }
  }

  // --- Brief-fit heuristics with premium editorial thresholds ---
  const assessment = assessCandidateQuality({
    project: params.project,
    variation: params.variation,
    assetTypes: params.assetTypes,
    qualityMode: params.qualityMode,
  });

  const briefFit = assessment.briefFit;
  const premiumPresence = assessment.dimensions.premiumPresence;
  const editorialQuality = assessment.dimensions.editorialQuality;

  const premiumPromptCompliant = PREMIUM_PROMPT_REQUIRED_TOKENS.every((token) =>
    promptLower.includes(token.toLowerCase()),
  );

  if (!premiumPromptCompliant) {
    for (const token of PREMIUM_PROMPT_REQUIRED_TOKENS) {
      if (!promptLower.includes(token.toLowerCase())) {
        reasons.push(`Missing premium prompt token: ${token}`);
      }
    }
  }

  if (briefFit < DISCOVERY_QUALITY_MIN_BRIEF_FIT) {
    reasons.push(
      `Brief fit ${briefFit} below discovery bar ${DISCOVERY_QUALITY_MIN_BRIEF_FIT}`,
    );
  }
  if (premiumPresence < DISCOVERY_QUALITY_MIN_PREMIUM_PRESENCE) {
    reasons.push(
      `Premium presence ${premiumPresence} below bar ${DISCOVERY_QUALITY_MIN_PREMIUM_PRESENCE}`,
    );
  }
  // Legacy editorial heuristic under-scores premium campaign prompts — require
  // either compliant premium injection OR minimum editorial brief-fit dimension.
  if (
    !premiumPromptCompliant &&
    editorialQuality < DISCOVERY_QUALITY_MIN_EDITORIAL
  ) {
    reasons.push(
      `Editorial quality ${editorialQuality} below bar ${DISCOVERY_QUALITY_MIN_EDITORIAL}`,
    );
  }

  // Fashion-week runway clones fail discovery even if generation succeeded.
  if (assessment.risks.some((r) => /fashion-week|high-fashion cues/i.test(r))) {
    reasons.push("High-fashion runway cues — not premium streetwear editorial");
  }

  const pass = reasons.length === 0;
  const shouldRegenerate =
    !pass && attempt < DISCOVERY_QUALITY_MAX_REGENERATION_ATTEMPTS;

  return {
    pass,
    briefFit,
    premiumPresence,
    editorialQuality,
    reasons,
    shouldRegenerate,
    attempt,
  };
}

/**
 * Simulated post-generation quality gate for providers without vision.
 * Uses prompt metadata + brief-fit — never claims visual verification.
 */
export function passesDiscoveryQualityGate(params: {
  built: BuiltCandidatePrompt;
  project: PersonaCreationProject;
  variation: CandidateVariationProfile;
  assetTypes: CandidateAssetType[];
  qualityMode?: string | null;
  attempt?: number;
  /** Test hook — force fail on attempt 1 to verify regeneration path. */
  simulateFailUntilAttempt?: number;
}): DiscoveryQualityVerdict {
  if (
    params.simulateFailUntilAttempt != null &&
    (params.attempt ?? 1) < params.simulateFailUntilAttempt
  ) {
    return {
      pass: false,
      briefFit: 40,
      premiumPresence: 40,
      editorialQuality: 40,
      reasons: ["Simulated sub-premium generation for test"],
      shouldRegenerate: (params.attempt ?? 1) < DISCOVERY_QUALITY_MAX_REGENERATION_ATTEMPTS,
      attempt: params.attempt ?? 1,
    };
  }
  return evaluateDiscoveryCastingQuality(params);
}

export { buildPremiumRetryPromptSuffix };
