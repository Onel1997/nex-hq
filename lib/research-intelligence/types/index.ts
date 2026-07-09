export type {
  DataProvenanceMode,
  IntelligenceDomain,
  ProviderContributionManifest,
  ProviderProvenance,
  ProviderSourceKey,
} from "./provider-source";
export { asProviderSourceKey } from "./provider-source";

export type {
  NormalizedSignal,
  NormalizedSignalCategory,
  SignalDirection,
  SignalEntity,
  SignalEntityType,
} from "./signals";

export type {
  TrendCluster,
  TrendHorizon,
  TrendIntelligence,
  TrendObservation,
  TrendSubjectType,
} from "./trends";

export type {
  MarketChannel,
  MarketIntelligence,
  MarketMovement,
  MarketSegment,
  PriceBandObservation,
} from "./market";

export type {
  CommercialIntelligence,
  CommercialOpportunity,
  CommercialSignalStrength,
  DemandIndicator,
  ProductInsight,
} from "./commercial";

export type {
  BrandIntelligence,
  BrandMention,
  BrandMomentum,
  BrandSignalType,
  DesignerSignal,
} from "./brand";

export type {
  ConfidenceEvidence,
  ConfidenceFactor,
  ConfidenceIntelligence,
  ConfidenceScore,
  ConfidenceScoreId,
  ConfidenceTier,
  DomainConfidence,
} from "./confidence";
export { CONFIDENCE_SCORE_IDS, emptyConfidenceIntelligence } from "./confidence";

export type {
  BrandFitReasoning,
  ResearchReasoningIntelligence,
  RiskReasoning,
  ScoreEvidenceSummary,
  SourceReasoning,
} from "./reasoning";
export {
  emptyResearchReasoningIntelligence,
  RESEARCH_REASONING_VERSION,
} from "./reasoning";

export type {
  RecommendationAudience,
  RecommendationEvidence,
  RecommendationIntelligence,
  RecommendationPriority,
  RecommendationSourceSupport,
  RecommendationType,
  ResearchRecommendation,
} from "./recommendation";
export {
  emptyRecommendationIntelligence,
  RECOMMENDATION_ENGINE_MODEL_VERSION,
} from "./recommendation";

export type { FusionManifest, UnifiedResearchIntelligence } from "./unified";
export { UNIFIED_INTELLIGENCE_VERSION } from "./unified";
