/**
 * Phase 2.2G — Historical biological protection lifecycle.
 *
 * Cross-project novelty blocking must only use identities the user chose to
 * preserve (selected Brand Face / approved persona / Identity Locked /
 * production Brand Cast). Ordinary discovery "allowed" faces are casting
 * data, not permanent forbidden identities.
 *
 * Same-run protection remains separate: within one A/B/C/D cast, allowed
 * faces still block later slots.
 */

export const HISTORICAL_FACE_PROTECTION_STATUSES = [
  "unprotected",
  "selected_brand_face",
  "approved_persona",
  "identity_locked",
  "brand_cast_approved",
] as const;

export type HistoricalFaceProtectionStatus =
  (typeof HISTORICAL_FACE_PROTECTION_STATUSES)[number];

/** Statuses that enter the cross-project historical biological blocking pool. */
export const HISTORICAL_BLOCKING_PROTECTION_STATUSES = [
  "selected_brand_face",
  "approved_persona",
  "identity_locked",
  "brand_cast_approved",
] as const satisfies ReadonlyArray<
  Exclude<HistoricalFaceProtectionStatus, "unprotected">
>;

export type HistoricalBlockingProtectionStatus =
  (typeof HISTORICAL_BLOCKING_PROTECTION_STATUSES)[number];

const PROTECTION_RANK: Record<HistoricalFaceProtectionStatus, number> = {
  unprotected: 0,
  selected_brand_face: 1,
  approved_persona: 2,
  identity_locked: 3,
  brand_cast_approved: 4,
};

export type HistoricalProtectionPromotionReason =
  | "candidate_selected"
  | "persona_converted"
  | "identity_locked"
  | "brand_cast_approved"
  | "novelty_approved";

export type NoveltyLiveEvidenceShape = {
  finalDecision?: string;
} | null;

export function isHistoricalFaceProtectionStatus(
  value: unknown,
): value is HistoricalFaceProtectionStatus {
  return (
    typeof value === "string" &&
    (HISTORICAL_FACE_PROTECTION_STATUSES as readonly string[]).includes(value)
  );
}

export function normalizeHistoricalProtectionStatus(
  value: unknown,
): HistoricalFaceProtectionStatus {
  return isHistoricalFaceProtectionStatus(value) ? value : "unprotected";
}

export function isHistoricalBlockingProtectionStatus(
  status: HistoricalFaceProtectionStatus | null | undefined,
): status is HistoricalBlockingProtectionStatus {
  const normalized = normalizeHistoricalProtectionStatus(status);
  return (
    HISTORICAL_BLOCKING_PROTECTION_STATUSES as readonly string[]
  ).includes(normalized);
}

/**
 * Monotonic strengthen — never downgrade a stronger protection state.
 * Later Identity Lock / Brand Cast approval upgrades the same record.
 */
export function resolveStrongerProtectionStatus(
  current: HistoricalFaceProtectionStatus | null | undefined,
  next: HistoricalBlockingProtectionStatus,
): HistoricalFaceProtectionStatus {
  const from = normalizeHistoricalProtectionStatus(current);
  return PROTECTION_RANK[next] >= PROTECTION_RANK[from] ? next : from;
}

export function isAllowedNoveltyDecision(
  evidence: NoveltyLiveEvidenceShape | undefined,
): boolean {
  if (!evidence || typeof evidence !== "object") {
    // Same-run legacy / missing evidence — treat as allowed for in-run peers.
    return true;
  }
  const decision = evidence.finalDecision;
  if (decision == null || decision === "") {
    return true;
  }
  return decision === "allowed";
}

/**
 * Whether a stored embedding may enter the live biological comparison pool.
 *
 * - Same-run (creationProjectId === currentCreationProjectId): allowed
 *   discovery faces only (rejected/blocked stay out).
 * - Cross-project historical: protected identities only.
 */
export function isEmbeddingEligibleForComparison(input: {
  liveEvaluationEvidence?: NoveltyLiveEvidenceShape;
  historicalProtectionStatus?: HistoricalFaceProtectionStatus | null;
  creationProjectId?: string | null;
  currentCreationProjectId?: string | null;
}): boolean {
  const currentProject = input.currentCreationProjectId?.trim() || "";
  const rowProject = input.creationProjectId?.trim() || "";
  const sameRun = Boolean(currentProject) && rowProject === currentProject;

  if (sameRun) {
    return isAllowedNoveltyDecision(input.liveEvaluationEvidence);
  }

  return isHistoricalBlockingProtectionStatus(
    input.historicalProtectionStatus,
  );
}
