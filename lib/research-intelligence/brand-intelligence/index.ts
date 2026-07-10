export {
  runBrandIntelligenceEngine,
  runBrandIntelligenceEngineSync,
} from "./engine";
export {
  BRAND_FIT_THRESHOLD,
  computeBrandFitDimensions,
  computeBrandFitScore,
  deriveLaunchPriority,
  scoreOpportunityText,
  tierFromScore,
} from "./scoring";
export { brandFitTierFromScore } from "../confidence/brand-profile";
export {
  emptyShopifyLearningContext,
  loadShopifyLearningContext,
} from "./shopify-learning";
export {
  BRAND_INTELLIGENCE_VERSION,
  type BrandFitDimension,
  type BrandFitTier,
  type BrandIntelligenceEngineInput,
  type BrandIntelligenceEngineResult,
  type BrandIntelligenceSection,
  type LaunchPriority,
  type ScoredOpportunity,
  type ShopifyLearningContext,
} from "./types";

export { MILAENE_BRAND_PROFILE } from "../confidence/brand-profile";
