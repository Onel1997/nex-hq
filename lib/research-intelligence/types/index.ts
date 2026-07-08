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
  ConfidenceFactor,
  ConfidenceIntelligence,
  ConfidenceTier,
  DomainConfidence,
} from "./confidence";
export { emptyConfidenceIntelligence } from "./confidence";

export type {
  RecommendationAudience,
  RecommendationIntelligence,
  RecommendationPriority,
  ResearchRecommendation,
} from "./recommendation";
export { emptyRecommendationIntelligence } from "./recommendation";

export type { FusionManifest, UnifiedResearchIntelligence } from "./unified";
export { UNIFIED_INTELLIGENCE_VERSION } from "./unified";
