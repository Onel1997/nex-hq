/**
 * Phase 2.0E / 2.2G — Which stored embeddings may enter the live comparison pool.
 *
 * Phase 2.2G: cross-project historical blocking uses protected identities only.
 * Same-run allowed faces still participate when currentCreationProjectId matches.
 */

export type { NoveltyLiveEvidenceShape } from "./historical-protection";
export {
  isEmbeddingEligibleForComparison,
  isAllowedNoveltyDecision,
  isHistoricalBlockingProtectionStatus,
  normalizeHistoricalProtectionStatus,
  resolveStrongerProtectionStatus,
  HISTORICAL_FACE_PROTECTION_STATUSES,
  HISTORICAL_BLOCKING_PROTECTION_STATUSES,
} from "./historical-protection";
export type {
  HistoricalFaceProtectionStatus,
  HistoricalBlockingProtectionStatus,
  HistoricalProtectionPromotionReason,
} from "./historical-protection";
