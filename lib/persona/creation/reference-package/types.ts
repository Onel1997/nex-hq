/**
 * Phase 2.3D / 2.3D.4 — Reference Package persistence types.
 */

import type { IdentityConsistencyDecision } from "./identity-consistency";
import type { AngleDirection } from "./angle-direction";
import type {
  ReferencePackageAttemptStatus,
  ReferencePackageSlot,
} from "./slots";
import { isReferencePackageSlot } from "./slots";

export const REFERENCE_PACKAGE_SESSION_STATUSES = [
  "idle",
  "pending_confirmation",
  "generating",
  "partial",
  "ready",
  "failed",
] as const;

export type ReferencePackageSessionStatus =
  (typeof REFERENCE_PACKAGE_SESSION_STATUSES)[number];

export type ReferencePackageSession = {
  id: string;
  workspace_id: string;
  persona_id: string;
  master_reference_id: string;
  status: ReferencePackageSessionStatus;
  provider: "openai";
  confirmation_token: string | null;
  estimate_hash: string | null;
  estimated_cost_min: number;
  estimated_cost_max: number;
  max_authorized_spend: number;
  image_count: number;
  confirmed_at: string | null;
  consumed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AngleReviewSource = "user" | "system" | null;
export type AngleReviewDecision = "confirmed" | "rejected" | null;

export type ReferencePackageAttempt = {
  id: string;
  workspace_id: string;
  persona_id: string;
  session_id: string;
  master_reference_id: string;
  /** Originally requested generation slot — historically immutable. */
  reference_slot: ReferencePackageSlot;
  /**
   * Live coverage slot after optional user reassignment.
   * Null means effective === reference_slot.
   */
  effective_slot: ReferencePackageSlot | null;
  reassigned_from: ReferencePackageSlot | null;
  reassigned_at: string | null;
  reassigned_by: string | null;
  angle_review_source: AngleReviewSource;
  angle_review_decision: AngleReviewDecision;
  provider: "openai";
  provider_request_id: string | null;
  generated_asset_id: string | null;
  status: ReferencePackageAttemptStatus;
  identity_decision: IdentityConsistencyDecision | null;
  identity_distance: number | null;
  identity_similarity: number | null;
  angle_direction: AngleDirection | null;
  detected_orientation:
    | "image_left"
    | "image_right"
    | "frontal"
    | "profile_left"
    | "profile_right"
    | "uncertain"
    | null;
  detected_yaw_degrees: number | null;
  cost_eur: number | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateReferencePackageSessionInput = {
  persona_id: string;
  master_reference_id: string;
  confirmation_token: string;
  estimate_hash: string;
  estimated_cost_min: number;
  estimated_cost_max: number;
  max_authorized_spend: number;
  image_count: number;
};

export type CreateReferencePackageAttemptInput = {
  session_id: string;
  persona_id: string;
  master_reference_id: string;
  reference_slot: ReferencePackageSlot;
  status?: ReferencePackageAttemptStatus;
};

export type UpdateReferencePackageSessionInput = Partial<
  Omit<
    ReferencePackageSession,
    "id" | "workspace_id" | "persona_id" | "created_at"
  >
>;

export type UpdateReferencePackageAttemptInput = Partial<
  Omit<
    ReferencePackageAttempt,
    "id" | "workspace_id" | "persona_id" | "session_id" | "created_at"
  >
>;

export type ReferencePackageSlotView = {
  slot: ReferencePackageSlot;
  label: string;
  status: ReferencePackageAttemptStatus;
  latestAttempt: ReferencePackageAttempt | null;
  acceptedAssetId: string | null;
  attemptHistory: ReferencePackageAttempt[];
  identityDecision: IdentityConsistencyDecision | null;
  humanReview: "approved" | "rejected" | "pending" | null;
  angleManuallyReassigned: boolean;
  angleDirection: AngleDirection | null;
  detectedOrientation: ReferencePackageAttempt["detected_orientation"];
  wrongCameraDirection: boolean;
};

export type ReferencePackageStatusView = {
  personaId: string;
  masterReferenceId: string | null;
  session: ReferencePackageSession | null;
  slots: ReferencePackageSlotView[];
  acceptedCount: number;
  requiredCount: number;
  referencePackageReady: boolean;
  identityLocked: boolean;
  personaStatus: string;
  provider: "openai";
  imageEditPath: string;
  textOnlyFallbackForbidden: true;
};

/** Notes marker for generated supporting refs — never Master. */
export const REF_PKG_NOTES_PREFIX = "REF_PKG_ANGLE_V1:";

export type ReferencePackageAssetNotesMeta = {
  slot: ReferencePackageSlot;
  requested_slot: ReferencePackageSlot;
  effective_slot: ReferencePackageSlot;
  master_reference_id: string;
  identity_decision: IdentityConsistencyDecision | null;
  angle_direction?: AngleDirection | null;
  attempt_id?: string;
  reassigned_from?: ReferencePackageSlot | null;
  reassigned_at?: string | null;
  reassigned_by?: string | null;
  angle_review_source?: AngleReviewSource;
  angle_review_decision?: AngleReviewDecision;
};

export function getAttemptEffectiveSlot(
  attempt: Pick<ReferencePackageAttempt, "reference_slot" | "effective_slot">,
): ReferencePackageSlot {
  return attempt.effective_slot ?? attempt.reference_slot;
}

export function buildReferencePackageAssetNotes(meta: {
  slot: ReferencePackageSlot;
  attemptId: string;
  masterReferenceId: string;
  identityDecision: IdentityConsistencyDecision;
  angleDirection?: AngleDirection | null;
  requestedSlot?: ReferencePackageSlot;
  effectiveSlot?: ReferencePackageSlot;
  reassignedFrom?: ReferencePackageSlot | null;
  reassignedAt?: string | null;
  reassignedBy?: string | null;
  angleReviewSource?: AngleReviewSource;
  angleReviewDecision?: AngleReviewDecision;
}): string {
  const requested = meta.requestedSlot ?? meta.slot;
  const effective = meta.effectiveSlot ?? meta.slot;
  return `${REF_PKG_NOTES_PREFIX}${JSON.stringify({
    version: 1,
    role: "supporting_reference",
    replaces_master: false,
    slot: effective,
    requested_slot: requested,
    effective_slot: effective,
    attempt_id: meta.attemptId,
    master_reference_id: meta.masterReferenceId,
    identity_decision: meta.identityDecision,
    angle_direction: meta.angleDirection ?? null,
    reassigned_from: meta.reassignedFrom ?? null,
    reassigned_at: meta.reassignedAt ?? null,
    reassigned_by: meta.reassignedBy ?? null,
    angle_review_source: meta.angleReviewSource ?? null,
    angle_review_decision: meta.angleReviewDecision ?? null,
  })}`;
}

export function parseReferencePackageAssetNotes(
  notes: string | null | undefined,
): ReferencePackageAssetNotesMeta | null {
  if (!notes?.startsWith(REF_PKG_NOTES_PREFIX)) return null;
  try {
    const raw = JSON.parse(notes.slice(REF_PKG_NOTES_PREFIX.length)) as {
      slot?: string;
      requested_slot?: string;
      effective_slot?: string;
      master_reference_id?: string;
      replaces_master?: boolean;
      identity_decision?: string;
      angle_direction?: string | null;
      attempt_id?: string;
      reassigned_from?: string | null;
      reassigned_at?: string | null;
      reassigned_by?: string | null;
      angle_review_source?: string | null;
      angle_review_decision?: string | null;
    };
    if (raw.replaces_master === true) return null;
    if (typeof raw.slot !== "string" || typeof raw.master_reference_id !== "string") {
      return null;
    }
    if (!isReferencePackageSlot(raw.slot)) return null;

    const requestedRaw = raw.requested_slot ?? raw.slot;
    const effectiveRaw = raw.effective_slot ?? raw.slot;
    if (!isReferencePackageSlot(requestedRaw)) return null;
    if (!isReferencePackageSlot(effectiveRaw)) return null;

    const decision =
      raw.identity_decision === "identity_match" ||
      raw.identity_decision === "identity_warning" ||
      raw.identity_decision === "identity_mismatch" ||
      raw.identity_decision === "evaluation_failed"
        ? raw.identity_decision
        : null;

    const angleDirection =
      raw.angle_direction === "correct" ||
      raw.angle_direction === "incorrect" ||
      raw.angle_direction === "uncertain"
        ? raw.angle_direction
        : null;

    const reassignedFrom =
      typeof raw.reassigned_from === "string" &&
      isReferencePackageSlot(raw.reassigned_from)
        ? raw.reassigned_from
        : null;

    return {
      slot: effectiveRaw,
      requested_slot: requestedRaw,
      effective_slot: effectiveRaw,
      master_reference_id: raw.master_reference_id,
      identity_decision: decision,
      angle_direction: angleDirection,
      attempt_id: typeof raw.attempt_id === "string" ? raw.attempt_id : undefined,
      reassigned_from: reassignedFrom,
      reassigned_at:
        typeof raw.reassigned_at === "string" ? raw.reassigned_at : null,
      reassigned_by:
        typeof raw.reassigned_by === "string" ? raw.reassigned_by : null,
      angle_review_source:
        raw.angle_review_source === "user" || raw.angle_review_source === "system"
          ? raw.angle_review_source
          : null,
      angle_review_decision:
        raw.angle_review_decision === "confirmed" ||
        raw.angle_review_decision === "rejected"
          ? raw.angle_review_decision
          : null,
    };
  } catch {
    return null;
  }
}
