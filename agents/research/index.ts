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
  assertRelationshipTargets,
  finalizeRelationshipTargets,
  rebuildCollectionFromFinalizedDesigns,
  mergeHeroAnalysisIntoDesign,
} from "./final-consistency-pass";
export type { FinalConsistencyResult } from "./final-consistency-pass";
export {
  normalizeCollectionRoles,
  applyEmotionalRepairPass,
  assertRoleConsistency,
  ROLE_ASSIGNMENT_PRIORITY,
} from "./role-consistency";
export {
  translateEmotionToMilaeneVisuals,
  buildMilaeneTranslation,
  applyMilaeneDnaCaps,
  scoreSymbolicAbstraction,
  sanitizeMilaeneArtDirection,
  detectMilaeneEmotionCategories,
  hasLiteralEmotionalImagery,
  logMilaeneTranslation,
  milaeneToVisualSymbols,
  createMotifTokenCounts,
  extractTrackedMotifTokens,
  ensureCollectionDnaDiversity,
  applyHeroProductionSafety,
  clampHeroPrintSize,
  requiresHighHeroProduction,
  assertDnaScoreDiversity,
  rescoreDnaForRole,
  ROLE_DNA_RANGES,
  ROLE_DNA_TARGETS,
  TRACKED_MOTIF_TOKENS,
  MILAENE_FORBIDDEN_VISUALS,
} from "./milaene-translation";
export type {
  MilaeneVisualLanguage,
  MilaeneTranslationResult,
  MilaeneEmotionCategory,
  MilaeneTranslationOptions,
  TrackedMotifToken,
} from "./milaene-translation";
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
export {
  computeDynamicCollectionScore,
} from "./collection-scoring";
export type { CollectionScoreBreakdown } from "./collection-scoring";
export {
  applyFinalQualityGate,
  replaceWeakDesigns,
  enforceHardQualityGate,
  designFailsQualityGate,
  isWeakNonHeroDesign,
  isGenericVisualConcept,
  isGenericTitle,
  hasStaleArtDirection,
  logFinalQualityScores,
  roundDesignScores,
} from "./quality-gate";
export type { FinalQualityScores, FinalQualityGateResult } from "./quality-gate";
export {
  buildEmotionalVisualLanguage,
  applyEmotionalVisualLanguage,
  applyCollectionEmotionalVisualLanguage,
  assertEmotionalVisualMatch,
  repairEmotionalVisualMismatch,
  ensureEmotionalVisualMatch,
  isEmotionalVisualStrictMode,
  logFinalEmotionalVisual,
  scoreEmotionalDnaAlignment,
  resolveEmotionalVisualFamilies,
} from "./emotional-visual";
export type {
  EmotionalVisualLanguage,
  EmotionalVisualFamily,
  EmotionalVisualMatchResult,
} from "./emotional-visual";
export {
  analyzeThemeEmotion,
  analyzeCollectionEmotion,
  applyNarrativeHeroFields,
  buildHeroEmotionalNarrative,
  buildNarrativeSymbolism,
  buildNarrativeVisualConcept,
  buildThemeEmotionalNarrative,
  computeEmotionalStrength,
  isGenericEmotionalMessage,
  pickNarrativeHeroTitle,
  EMOTIONAL_STRENGTH_CEO_MIN,
} from "./emotional-intelligence";
export type {
  ThemeEmotionalAnalysis,
  EmotionalStrengthBreakdown,
} from "./emotional-intelligence";
export {
  buildThemeRoleFallbackConcept,
} from "./theme-fallback";
export type { ThemeFallbackInput } from "./theme-fallback";
export {
  resolveThemeProfile,
  pickThemeEmotion,
  buildThemeHeroTitle,
  getThemeRoleTitle,
  getThemeEmotionalAnalysis,
} from "./theme-vocabulary";
export type { ThemeProfile, ThemeRoleTitles } from "./theme-vocabulary";
export { roundPercent, ABSOLUTE_DNA_FLOOR } from "./score-coercion";
export {
  applyCeoConsistency,
  applyFinalCollectionScore,
  assertCeoConsistency,
  assertCollectionScoreCaps,
  assertCollectionScoreUnlocked,
  isCeoApproved,
  isHeroCeoApproved,
  collectHeroApprovalMetrics,
  limitCommercialScore,
  balanceHeroCommercialFloor,
  applyCollectionCaps,
  capCollectionScore,
  buildCeoRecommendation,
  buildConsistentAdPotential,
  logCeoConsistency,
  logFinalCollectionAuthority,
  CEO_HERO_SCORE_MIN,
  CEO_DNA_SCORE_MIN,
  CEO_COMMERCIAL_SCORE_MIN,
  CEO_EMOTIONAL_STRENGTH_MIN,
} from "./ceo-consistency";
export type {
  HeroApprovalMetrics,
  CeoConsistencyResult,
  FinalCollectionScoreResult,
} from "./ceo-consistency";
