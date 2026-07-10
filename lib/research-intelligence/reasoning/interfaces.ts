import type { Locale } from "@/lib/i18n/config";
import type { ConfidenceIntelligence } from "../types/confidence";
import type { ResearchReasoningIntelligence } from "../types/reasoning";
import { RESEARCH_REASONING_VERSION } from "../types/reasoning";
import type { UnifiedResearchIntelligence } from "../types";

/**
 * Reasoning layer contract — Phase 5.1.
 *
 * Transforms fused intelligence into structured narratives, causal links,
 * and cross-domain insights. Deterministic — no LLM calls.
 */
export interface ReasoningContext {
  workspaceId?: string;
  locale?: Locale;
  generatedAt: string;
}

/** @deprecated Use ResearchReasoningIntelligence — retained for layer interface compatibility. */
export interface ReasoningArtifact {
  id: string;
  domain: string;
  summary: string;
  evidenceIds: string[];
}

/** @deprecated Use ResearchReasoningIntelligence — retained for layer interface compatibility. */
export interface ReasoningResult {
  artifacts: ReasoningArtifact[];
  narratives: string[];
  generatedAt: string;
}

export interface ReasoningLayer {
  reason(
    intelligence: UnifiedResearchIntelligence,
    confidence: ConfidenceIntelligence,
    context: ReasoningContext,
  ): ResearchReasoningIntelligence;
}

export { RESEARCH_REASONING_VERSION };
