/**
 * Research Intelligence — AI Fashion Research Director foundation (Phase 5.0).
 *
 * Architecture:
 *   Provider Layer → Normalization → Intelligence → Fusion → Reasoning → Recommendation → Report
 *
 * Phase 5.0 delivers normalization contracts, standard models, intelligence assembly,
 * and the provider-agnostic Fusion Engine producing UnifiedResearchIntelligence.
 *
 * Scoring, reasoning, confidence computation, and recommendation generation
 * are intentionally deferred to later phases.
 */

// Standard models & unified output
export * from "./types";
export * from "./models";

// Layer exports
export * from "./normalization";
export * from "./intelligence";
export * from "./fusion";

// Future layer contracts (stubs only in Phase 5.0)
export * from "./reasoning";
export * from "./recommendation";

// Pipeline convenience
export {
  ResearchIntelligencePipeline,
  runResearchIntelligencePipeline,
  fuseNormalizedIntelligence,
  createFusionEngine,
} from "./fusion";

export { createNormalizerRegistry } from "./normalization";

export {
  createDefaultResearchNormalizerRegistry,
  createTestEnvelope,
  normalizeFixture,
  ALL_RESEARCH_NORMALIZERS,
} from "./normalizers";

export type {
  ResearchIntelligencePipelineConfig,
  PipelineRunInput,
  PipelineRunResult,
} from "./fusion/pipeline";
