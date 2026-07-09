export { FusionEngine, createFusionEngine, fuseNormalizedIntelligence } from "./engine";
export { ResearchIntelligencePipeline, runResearchIntelligencePipeline } from "./pipeline";
export {
  buildSourceSupport,
  directionBoost,
  extractColorTerms,
  rankOpportunityTerms,
  rankSignalsByWeight,
  rankTrendClusters,
} from "./weighted-fusion";
export type { WeightedItem, WeightedTerm } from "./weighted-fusion";
export type {
  FusionEngineConfig,
  FusionInput,
  FusionOutput,
} from "./types";
export { FUSION_ENGINE_VERSION } from "./types";
