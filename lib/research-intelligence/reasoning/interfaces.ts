import type { UnifiedResearchIntelligence } from "../types";

/**
 * Reasoning layer contract — Phase 5.1+.
 *
 * Transforms fused intelligence into structured narratives, causal links,
 * and cross-domain insights. Not implemented in Phase 5.0.
 */
export interface ReasoningContext {
  workspaceId?: string;
  locale?: string;
  generatedAt: string;
}

export interface ReasoningArtifact {
  id: string;
  domain: string;
  summary: string;
  evidenceIds: string[];
}

export interface ReasoningResult {
  artifacts: ReasoningArtifact[];
  narratives: string[];
  generatedAt: string;
}

export interface ReasoningLayer {
  reason(
    intelligence: UnifiedResearchIntelligence,
    context: ReasoningContext,
  ): ReasoningResult;
}

/** Stub — reasoning not implemented in Phase 5.0. */
export const REASONING_LAYER_VERSION = "5.0.0-stub";
