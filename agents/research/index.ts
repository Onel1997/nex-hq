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
export { normalizeCommercialConfidence, formatCommercialConfidence } from "./types";
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
  assessHeroFailure,
  qualifiesAsHeroCandidate,
  validateExactCollectionRoles,
  isWeakHeroVisual,
  hasStrongVisualIdentity,
  formatHeroEngineMarkdown,
  HERO_DNA_TARGET,
  HERO_SCORE_TARGET,
  HERO_EMOTIONAL_TARGET,
  HERO_VISUAL_TARGET,
} from "./hero-engine";
export {
  regenerateHeroDesign,
  applyHeroRegeneration,
  REGEN_DNA_TARGET,
  REGEN_HERO_SCORE_TARGET,
} from "./hero-regeneration";
export {
  RESEARCH_DETAIL_MODES,
  DEFAULT_RESEARCH_DETAIL_MODE,
  buildDetailModePromptSection,
  compactDesignConceptDetail,
  compactDesignConceptsForDetailMode,
  type ResearchDetailMode,
} from "./detail-mode";
export {
  assertCompleteJsonResponse,
  logResearchResponseSize,
  LARGE_RESEARCH_RESPONSE_THRESHOLD,
} from "./response-guard";
export { finalizeCollectionDesigns } from "./collection-pipeline";
export {
  finalConsistencyPass,
  applyFinalConsistencyToDesignOutput,
  assertFinalCollectionConsistency,
  rebuildCollectionFromFinalizedDesigns,
  mergeHeroAnalysisIntoDesign,
} from "./final-consistency-pass";
export type { FinalConsistencyResult } from "./final-consistency-pass";
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
