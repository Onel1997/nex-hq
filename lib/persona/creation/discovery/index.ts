/**
 * Phase 2.2A — Discovery Diversity Engine public API.
 */

export {
  DISCOVERY_DIVERSITY_PROFILES,
  diversityProfileForSlot,
  listDiscoveryDiversityProfiles,
  type DiversityRegionId,
  type DiscoveryDiversityProfile,
} from "./diversity-profiles";

export {
  validatePreProviderCrossSlotDiversity,
  planDiverseDiscoveryCast,
  type PreProviderDiversityIssue,
  type PreProviderDiversityResult,
} from "./preflight-diversity";

export {
  DISCOVERY_RUN_STATES,
  isTerminalDiscoveryRunState,
  resolveDiscoveryRunState,
  isBiologicalCastingRejection,
  type DiscoveryRunState,
  type DiscoveryAttemptStatus,
} from "./run-states";

export {
  buildDiscoveryCompletionBudget,
  createBudgetLedger,
  canSpendAttempt,
  recordAttemptSpend,
  unitCostBand,
  type DiscoveryCompletionBudget,
  type DiscoveryBudgetLedger,
} from "./completion-budget";

export {
  runDiscoveryCompletion,
  type NoveltyEvalDecision,
  type SlotPlan,
  type CompletionEngineDeps,
  type RunDiscoveryCompletionInput,
  type RunDiscoveryCompletionResult,
} from "./completion-engine";

export type {
  DiscoveryAttemptRecord,
  DiscoveryRunLedger,
  DiscoveryAttemptRepository,
} from "./attempt-types";

export { MemoryDiscoveryAttemptRepository } from "./attempt-repository";
export { SupabaseDiscoveryAttemptRepository } from "./supabase-attempt-repository";

export {
  buildFinalDiscoveryBoard,
  assertBoardIsCurrentRunOnly,
  type FinalBoardCard,
} from "./board-final-slots";

export {
  selectDiscoveryCandidate,
  type SelectedDiscoveryIdentity,
} from "./selection-handoff";

export {
  buildPairwiseSimilarityDiagnostic,
  type PairwiseSimilarityDiagnostic,
  type PairwiseSimilarityEntry,
} from "./pairwise-similarity-diagnostic";

export {
  shouldUseDiscoveryCompletionEngine,
  runOfficialBrandFaceA1DiscoveryCompletion,
  resolveBudgetFromConfirmationPayload,
  buildDiscoveryProgressSnapshot,
  type DiscoveryProgressSnapshot,
  type LiveA1CompletionResult,
} from "./live-a1-completion-orchestrator";
