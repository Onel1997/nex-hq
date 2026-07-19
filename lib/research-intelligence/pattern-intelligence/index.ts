export {
  runPatternIntelligenceEngine,
  buildCatalogReferenceIndex,
  isCatalogProductReference,
  isExistingCatalogProduct,
  normalizeProductReference,
  stripVariantFromTitle,
  classifyEntity,
  dedupeByNormalizedLabel,
  isCreativeOpportunityEntity,
  isNoiseEntity,
  passesOpportunityQualityGate,
  parseStructuredMaterials,
  buildDesignStudioNextStep,
  resolveProductTarget,
  CORE_PRODUCT_TARGETS,
  capScoreBySourceAgreement,
  uniqueSourceCount,
  buildDesignLanguage,
  deriveRecommendedSilhouette,
  aggregatePatterns,
  findDominantTraits,
  DESIGN_STUDIO_MISSION,
  PATTERN_INTELLIGENCE_VERSION,
} from "./engine";

export { extractPatternFromProduct, extractPatternsFromCatalog, stripProductName, INSUFFICIENT_SHOPIFY_EVIDENCE } from "./extractor";

export type {
  AggregatedDesignPattern,
  BrandLearningInsight,
  DesignLanguage,
  PatternIntelligenceSection,
  PatternDimension,
  IntelligenceEntityKind,
} from "./types";

export type { CatalogReferenceIndex } from "./catalog-filter";
