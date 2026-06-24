/**
 * Research Agent — market intelligence and structured reporting.
 * MVP: generate reports via OpenAI and persist to workspace Brain.
 */

export { runResearch } from "./run";
export { parseResearchOutput, ResearchParseError, isDesignResearchPayload, isCollectionOnlyResearchPayload } from "./parse-output";
export { saveResearchToBrain } from "./save";
export { retrieveResearchKnowledge } from "./retrieve-context";
export type {
  ResearchRunInput,
  ResearchRunResult,
  ResearchDesignBriefOutput,
  ResearchOutput,
  DesignResearchOutput,
  DesignConcept,
  CreativeApproach,
  BrandDna,
  CollectionRole,
  CollectionType,
  HeroProduct,
  RepeatabilityScore,
  ResearchCollection,
  CeoAnalysis,
  HeroAnalysis,
  LaunchApproval,
  CampaignPotential,
  StoryPosition,
  ParsedResearchOutput,
  ResearchType,
} from "./types";
export {
  applyCollectionEngine,
  buildCollection,
  COLLECTION_MIN_SCORE,
  formatCollectionMarkdown,
} from "./collection-engine";
export type { CollectionEngineContext, CollectionEngineResult } from "./collection-engine";
export {
  applyCollectionPipeline,
  breakRelationshipCycles,
} from "./collection-pipeline";
export type { CollectionPipelineResult } from "./collection-pipeline";
export { MILAENE_EMOTIONAL_VOCABULARY } from "./emotional-vocabulary";
export {
  applyCollectionIntelligence,
  calculateDesignSimilarity,
  deduplicateDesignConcepts,
  enforceCollectionRoles,
  enrichDesignRelationships,
  buildCeoAnalysis,
  applyRoleDnaMinimums,
  CollectionIntelligenceError,
  DUPLICATE_SIMILARITY_THRESHOLD,
  ROLE_DNA_MINIMUMS,
  formatCollectionIntelligenceMarkdown,
} from "./collection-intelligence";
export {
  applyHeroEngine,
  calculateCommercialScore,
  calculateHeroScore,
  assessCampaignPotential,
  validateExactCollectionRoles,
  isWeakHeroVisual,
  hasStrongVisualIdentity,
  formatHeroEngineMarkdown,
  HERO_DNA_TARGET,
} from "./hero-engine";
export {
  applyBrandDnaAnalysis,
  analyzeBrandDna,
  DNA_MIN_SCORE,
  MILAENE_BRAND_DNA,
} from "./brand-dna";
export type { BrandDnaDefinition, BrandDnaAnalysis } from "./brand-dna";
export {
  BALANCE_TYPES,
  CONTRAST_LEVELS,
  COLLECTION_ROLES,
  COLLECTION_TYPES,
  COLLECTION_ARC,
  CAMPAIGN_POTENTIAL_LEVELS,
  CREATIVE_APPROACHES,
  PRODUCTION_DIFFICULTY_LEVELS,
  REPEATABILITY_SCORES,
  VISUAL_WEIGHTS,
  brandDnaSchema,
  colorBreakdownEntrySchema,
  heroProductSchema,
  researchCollectionSchema,
} from "./types";
export type { ColorBreakdownEntry } from "./types";
export {
  coerceConceptField,
  normalizeDesignConcept,
  normalizeDesignConcepts,
  diversifyDesignConcepts,
  normalizeCreativeApproach,
  summarizeDesignConcept,
  summarizeDesignConcepts,
  formatDesignConceptMarkdown,
  formatColorBreakdown,
  visualConceptFingerprint,
} from "./design-concept";
