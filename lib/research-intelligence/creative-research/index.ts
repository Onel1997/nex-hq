/**
 * Creative Research & Direction Studio — public API.
 */

export {
  CREATIVE_RESEARCH_VERSION,
  CREATIVE_DIRECTION_HANDOFF_MISSION,
  DRAFT_SELECTION_NEXT_STEP,
  NO_PATTERN_EVIDENCE_NOTE,
  PHRASE_QUALITY_THRESHOLD,
} from "./types";

export type {
  ResearchMode,
  ProviderMode,
  DesignIdeaStatus,
  CollectionStatus,
  FrontBackConfiguration,
  ExecutionDifficulty,
  GeneratorSource,
  VisualStructureId,
  TypographyFamily,
  OptionalPatternEvidence,
  PhraseQualityScores,
  DesignIdea,
  WeeklyDesignIdeasInput,
  WeeklyDesignIdeasResult,
  CollectionCreatorInput,
  CollectionCreatorResult,
  CollectionPlan,
  ProviderCostEstimate,
  RunProviderUsage,
  CreativeDirectionHandoff,
  CreativeQualityVerdict,
  CreativeResearchReportSection,
} from "./types";

export {
  DEFAULT_PROVIDER_MODE,
  PROVIDER_MODE_LABELS,
  allowedProviderKeys,
  shouldSyncProviders,
  shouldRunPatternIntelligence,
  shouldRunFullFusionPipeline,
  estimateProviderCost,
  buildProviderUsage,
  parseProviderMode,
  parseResearchMode,
} from "./provider-mode";

export {
  GENERIC_PHRASE_BLACKLIST,
  phraseSimilarity,
  isGenericPhrase,
  isWeakPhraseFragment,
  isNearDuplicatePhrase,
  isNearDuplicateConcept,
  matchesCatalogProductName,
  evaluatePhraseQuality,
  evaluateDesignIdeaQuality,
  dedupeDesignIdeas,
  filterQualityDesignIdeas,
  alternativesHaveStructuralVariety,
} from "./quality-layer";

export {
  planVisualDiversity,
  evaluateRunDiversity,
  VISUAL_STRUCTURES,
} from "./diversity-planner";

export {
  loadCreativeHistory,
  saveCreativeHistory,
  recordCreativeRunIdeas,
  recentPhrases,
  isExcludedByHistory,
  clearCreativeHistoryForTests,
} from "./history-store";

export {
  generateWeeklyDesignIdeas,
  creativeDirectionSummaryFromIdeas,
  draftNextStepForCount,
  selectedNextStep,
  emptyPatternEvidence,
  buildPatternEvidenceFromTraits,
} from "./idea-generator";

export { generateCollectionPlan } from "./collection-generator";

export {
  patternEvidenceFromSection,
  runWeeklyDesignIdeasEngine,
  runCollectionCreatorEngine,
  buildCreativeDirectionHandoff,
  selectDesignIdea,
  rejectDesignIdea,
  shortlistDesignIdea,
  applySelectionToCreativeCopy,
} from "./engine";
