/**
 * Research Intelligence — AI Fashion Research Director (Phase 5.0–5.2).
 *
 * Architecture:
 *   Provider Layer → Normalization → Intelligence → Fusion → Evaluation → Reasoning → Recommendation → Report
 *
 * Phase 5.2 delivers deterministic recommendations and weighted fusion ranking.
 */

// Standard models & unified output
export * from "./types";
export * from "./models";

// Layer exports
export * from "./normalization";
export * from "./intelligence";
export * from "./fusion";
export * from "./confidence";
export * from "./evaluation";

// Reasoning + recommendation + report layers
export * from "./reasoning";
export * from "./recommendation";
export * from "./report";

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
