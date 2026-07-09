export type {
  RecommendationContext,
  RecommendationEngine,
} from "./interfaces";
export {
  defaultRecommendationEngine,
  enrichIntelligenceWithRecommendations,
  generateRecommendations,
  RECOMMENDATION_ENGINE_VERSION,
} from "./interfaces";
export { RECOMMENDATION_ENGINE_VERSION as RECOMMENDATION_ENGINE_IMPL_VERSION } from "./engine";
