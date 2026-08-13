/**
 * Phase 2.3D / 2.3D.4 — Reference Package persistence types.
 */

import type { IdentityConsistencyDecision } from "./identity-consistency";
import type { AngleDirection } from "./angle-direction";
import type {
  ProviderDirectionStrategy,
  ProviderRequestedDirection,
} from "./provider-direction-fallback";
import type { ProfileIdentityMode } from "./profile-identity-preservation";
import type {
  HumanIdentityReview,
} from "./human-identity-override";
import type { DerivationType } from "./mirror-salvage";
import type {
  ReferencePackageAttemptStatus,
  ReferencePackageSlot,
} from "./slots";
import { isReferencePackageSlot } from "./slots";

export type ReferencePackageAttemptProvider = "openai" | "derived_local";

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
  provider: ReferencePackageAttemptProvider;
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
  /**
   * How the provider prompt direction was chosen.
   * Canonical requested slot remains `reference_slot`.
   */
  provider_direction_strategy: ProviderDirectionStrategy | null;
  /** Direction instruction actually sent to the provider. */
  provider_requested_direction: ProviderRequestedDirection | null;
  /** Profile-only identity mode (null for front / three-quarter). */
  profile_identity_mode: ProfileIdentityMode | null;
  /** Profile prompt builder version (null for non-profile). */
  profile_prompt_version: string | null;
  /**
   * Human review of machine identity — never rewrites identity_decision.
   * null/none = no human identity override decision yet.
   */
  human_identity_review: HumanIdentityReview | null;
  human_identity_reviewed_at: string | null;
  human_identity_reviewed_by: string | null;
  human_identity_override_reason: string | null;
  identity_override_version: string | null;
  /** Source asset for local deterministic salvage (2.3D.9). */
  derived_from_asset_id: string | null;
  derivation_type: DerivationType | null;
  derived_at: string | null;
  derived_by: string | null;
  /** Paid regeneration targeting an accepted reference (2.3D.10). */
  replacement_for_asset_id: string | null;
  replacement_for_slot: ReferencePackageSlot | null;
  replacement_candidate: boolean;
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
  /** Canonical slot — never rewritten by inverted fallback. */
  reference_slot: ReferencePackageSlot;
  status?: ReferencePackageAttemptStatus;
  provider?: ReferencePackageAttemptProvider;
  provider_direction_strategy?: ProviderDirectionStrategy;
  provider_requested_direction?: ProviderRequestedDirection;
  profile_identity_mode?: ProfileIdentityMode | null;
  profile_prompt_version?: string | null;
  derived_from_asset_id?: string | null;
  derivation_type?: DerivationType | null;
  derived_at?: string | null;
  derived_by?: string | null;
  replacement_for_asset_id?: string | null;
  replacement_for_slot?: ReferencePackageSlot | null;
  replacement_candidate?: boolean;
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
  /** Canonical reconciled state (Phase 2.3D.11). */
  state: import("./reconcile-reference-package-state").ReferencePackageSlotState;
  /** @deprecated Prefer `state` — legacy attempt status alias. */
  status: ReferencePackageAttemptStatus;
  latestAttempt: ReferencePackageAttempt | null;
  /** Active approved usable asset for this slot (from reconciler). */
  acceptedAssetId: string | null;
  pendingReplacementAssetId: string | null;
  usable: boolean;
  replacementState: import("./reconcile-reference-package-state").ReplacementState;
  replacementPredecessorMissing: boolean;
  provenance: import("./reconcile-reference-package-state").ReferenceProvenance;
  attemptHistory: ReferencePackageAttempt[];
  identityDecision: IdentityConsistencyDecision | null;
  humanReview: "approved" | "rejected" | "pending" | null;
  angleManuallyReassigned: boolean;
  angleDirection: AngleDirection | null;
  detectedOrientation: ReferencePackageAttempt["detected_orientation"];
  wrongCameraDirection: boolean;
  /** Next prepare would propose inverted provider fallback. */
  invertedFallbackEligible: boolean;
  /** Automatic paid retries stopped after exhausted fallback. */
  directionGenerationUnreliable: boolean;
  providerDirectionStrategy: ProviderDirectionStrategy | null;
  providerRequestedDirection: ProviderRequestedDirection | null;
  humanIdentityReview: HumanIdentityReview | null;
  /** Qualifier when accepted via mismatch override. */
  acceptedViaHumanIdentityOverride: boolean;
  identitySourceConfidence:
    | "machine_match"
    | "human_warning_approved"
    | "human_mismatch_override"
    | null;
  coverageLabel: string | null;
};

export type ReferencePackageStatusView = {
  personaId: string;
  masterReferenceId: string | null;
  session: ReferencePackageSession | null;
  slots: ReferencePackageSlotView[];
  /** Canonical reconciled package state (Phase 2.3D.11). */
  referencePackageState: import("./reconcile-reference-package-state").ReconciledReferencePackageState;
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
  detected_orientation?:
    | "image_left"
    | "image_right"
    | "frontal"
    | "profile_left"
    | "profile_right"
    | "uncertain"
    | null;
  attempt_id?: string;
  reassigned_from?: ReferencePackageSlot | null;
  reassigned_at?: string | null;
  reassigned_by?: string | null;
  angle_review_source?: AngleReviewSource;
  angle_review_decision?: AngleReviewDecision;
  provider_direction_strategy?: ProviderDirectionStrategy | null;
  provider_requested_direction?: ProviderRequestedDirection | null;
  profile_identity_mode?: ProfileIdentityMode | null;
  profile_prompt_version?: string | null;
  human_identity_review?: HumanIdentityReview | null;
  human_identity_reviewed_at?: string | null;
  human_identity_reviewed_by?: string | null;
  human_identity_override_reason?: string | null;
  identity_override_version?: string | null;
  identity_source_confidence?:
    | "machine_match"
    | "human_warning_approved"
    | "human_mismatch_override"
    | null;
  derivation_type?: DerivationType | null;
  derived_from_asset_id?: string | null;
  derived_at?: string | null;
  derived_by?: string | null;
  original_requested_slot?: ReferencePackageSlot | null;
  replacement_for_asset_id?: string | null;
  replacement_for_slot?: ReferencePackageSlot | null;
  replacement_candidate?: boolean | null;
  superseded_by_asset_id?: string | null;
  superseded_at?: string | null;
  replacement_approved_at?: string | null;
  replacement_approved_by?: string | null;
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
  detectedOrientation?:
    | "image_left"
    | "image_right"
    | "frontal"
    | "profile_left"
    | "profile_right"
    | "uncertain"
    | null;
  requestedSlot?: ReferencePackageSlot;
  effectiveSlot?: ReferencePackageSlot;
  reassignedFrom?: ReferencePackageSlot | null;
  reassignedAt?: string | null;
  reassignedBy?: string | null;
  angleReviewSource?: AngleReviewSource;
  angleReviewDecision?: AngleReviewDecision;
  providerDirectionStrategy?: ProviderDirectionStrategy | null;
  providerRequestedDirection?: ProviderRequestedDirection | null;
  profileIdentityMode?: ProfileIdentityMode | null;
  profilePromptVersion?: string | null;
  humanIdentityReview?: HumanIdentityReview | null;
  humanIdentityReviewedAt?: string | null;
  humanIdentityReviewedBy?: string | null;
  humanIdentityOverrideReason?: string | null;
  identityOverrideVersion?: string | null;
  identitySourceConfidence?:
    | "machine_match"
    | "human_warning_approved"
    | "human_mismatch_override"
    | null;
  derivationType?: DerivationType | null;
  derivedFromAssetId?: string | null;
  derivedAt?: string | null;
  derivedBy?: string | null;
  originalRequestedSlot?: ReferencePackageSlot | null;
  replacementForAssetId?: string | null;
  replacementForSlot?: ReferencePackageSlot | null;
  replacementCandidate?: boolean | null;
  supersededByAssetId?: string | null;
  supersededAt?: string | null;
  replacementApprovedAt?: string | null;
  replacementApprovedBy?: string | null;
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
    detected_orientation: meta.detectedOrientation ?? null,
    reassigned_from: meta.reassignedFrom ?? null,
    reassigned_at: meta.reassignedAt ?? null,
    reassigned_by: meta.reassignedBy ?? null,
    angle_review_source: meta.angleReviewSource ?? null,
    angle_review_decision: meta.angleReviewDecision ?? null,
    provider_direction_strategy: meta.providerDirectionStrategy ?? null,
    provider_requested_direction: meta.providerRequestedDirection ?? null,
    profile_identity_mode: meta.profileIdentityMode ?? null,
    profile_prompt_version: meta.profilePromptVersion ?? null,
    human_identity_review: meta.humanIdentityReview ?? null,
    human_identity_reviewed_at: meta.humanIdentityReviewedAt ?? null,
    human_identity_reviewed_by: meta.humanIdentityReviewedBy ?? null,
    human_identity_override_reason: meta.humanIdentityOverrideReason ?? null,
    identity_override_version: meta.identityOverrideVersion ?? null,
    identity_source_confidence: meta.identitySourceConfidence ?? null,
    derivation_type: meta.derivationType ?? null,
    derived_from_asset_id: meta.derivedFromAssetId ?? null,
    derived_at: meta.derivedAt ?? null,
    derived_by: meta.derivedBy ?? null,
    original_requested_slot: meta.originalRequestedSlot ?? requested,
    replacement_for_asset_id: meta.replacementForAssetId ?? null,
    replacement_for_slot: meta.replacementForSlot ?? null,
    replacement_candidate: meta.replacementCandidate ?? null,
    superseded_by_asset_id: meta.supersededByAssetId ?? null,
    superseded_at: meta.supersededAt ?? null,
    replacement_approved_at: meta.replacementApprovedAt ?? null,
    replacement_approved_by: meta.replacementApprovedBy ?? null,
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
      detected_orientation?: string | null;
      attempt_id?: string;
      reassigned_from?: string | null;
      reassigned_at?: string | null;
      reassigned_by?: string | null;
      angle_review_source?: string | null;
      angle_review_decision?: string | null;
      provider_direction_strategy?: string | null;
      provider_requested_direction?: string | null;
      profile_identity_mode?: string | null;
      profile_prompt_version?: string | null;
      human_identity_review?: string | null;
      human_identity_reviewed_at?: string | null;
      human_identity_reviewed_by?: string | null;
      human_identity_override_reason?: string | null;
      identity_override_version?: string | null;
      identity_source_confidence?: string | null;
      derivation_type?: string | null;
      derived_from_asset_id?: string | null;
      derived_at?: string | null;
      derived_by?: string | null;
      original_requested_slot?: string | null;
      replacement_for_asset_id?: string | null;
      replacement_for_slot?: string | null;
      replacement_candidate?: boolean | null;
      superseded_by_asset_id?: string | null;
      superseded_at?: string | null;
      replacement_approved_at?: string | null;
      replacement_approved_by?: string | null;
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

    const providerStrategy =
      raw.provider_direction_strategy === "canonical" ||
      raw.provider_direction_strategy === "inverted_fallback"
        ? raw.provider_direction_strategy
        : null;

    const providerRequested =
      typeof raw.provider_requested_direction === "string" &&
      isReferencePackageSlot(raw.provider_requested_direction)
        ? raw.provider_requested_direction
        : null;

    const profileMode =
      raw.profile_identity_mode === "profile_identity_preservation_v1"
        ? raw.profile_identity_mode
        : null;

    return {
      slot: effectiveRaw,
      requested_slot: requestedRaw,
      effective_slot: effectiveRaw,
      master_reference_id: raw.master_reference_id,
      identity_decision: decision,
      angle_direction: angleDirection,
      detected_orientation:
        raw.detected_orientation === "image_left" ||
        raw.detected_orientation === "image_right" ||
        raw.detected_orientation === "frontal" ||
        raw.detected_orientation === "profile_left" ||
        raw.detected_orientation === "profile_right" ||
        raw.detected_orientation === "uncertain"
          ? raw.detected_orientation
          : null,
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
      provider_direction_strategy: providerStrategy,
      provider_requested_direction: providerRequested,
      profile_identity_mode: profileMode,
      profile_prompt_version:
        typeof raw.profile_prompt_version === "string"
          ? raw.profile_prompt_version
          : null,
      human_identity_review:
        raw.human_identity_review === "approved_override" ||
        raw.human_identity_review === "rejected" ||
        raw.human_identity_review === "none"
          ? raw.human_identity_review
          : null,
      human_identity_reviewed_at:
        typeof raw.human_identity_reviewed_at === "string"
          ? raw.human_identity_reviewed_at
          : null,
      human_identity_reviewed_by:
        typeof raw.human_identity_reviewed_by === "string"
          ? raw.human_identity_reviewed_by
          : null,
      human_identity_override_reason:
        typeof raw.human_identity_override_reason === "string"
          ? raw.human_identity_override_reason
          : null,
      identity_override_version:
        typeof raw.identity_override_version === "string"
          ? raw.identity_override_version
          : null,
      identity_source_confidence:
        raw.identity_source_confidence === "machine_match" ||
        raw.identity_source_confidence === "human_warning_approved" ||
        raw.identity_source_confidence === "human_mismatch_override"
          ? raw.identity_source_confidence
          : null,
      derivation_type:
        raw.derivation_type === "horizontal_mirror"
          ? raw.derivation_type
          : null,
      derived_from_asset_id:
        typeof raw.derived_from_asset_id === "string"
          ? raw.derived_from_asset_id
          : null,
      derived_at:
        typeof raw.derived_at === "string" ? raw.derived_at : null,
      derived_by:
        typeof raw.derived_by === "string" ? raw.derived_by : null,
      original_requested_slot:
        typeof raw.original_requested_slot === "string" &&
        isReferencePackageSlot(raw.original_requested_slot)
          ? raw.original_requested_slot
          : null,
      replacement_for_asset_id:
        typeof raw.replacement_for_asset_id === "string"
          ? raw.replacement_for_asset_id
          : null,
      replacement_for_slot:
        typeof raw.replacement_for_slot === "string" &&
        isReferencePackageSlot(raw.replacement_for_slot)
          ? raw.replacement_for_slot
          : null,
      replacement_candidate:
        raw.replacement_candidate === true ? true : null,
      superseded_by_asset_id:
        typeof raw.superseded_by_asset_id === "string"
          ? raw.superseded_by_asset_id
          : null,
      superseded_at:
        typeof raw.superseded_at === "string" ? raw.superseded_at : null,
      replacement_approved_at:
        typeof raw.replacement_approved_at === "string"
          ? raw.replacement_approved_at
          : null,
      replacement_approved_by:
        typeof raw.replacement_approved_by === "string"
          ? raw.replacement_approved_by
          : null,
    };
  } catch {
    return null;
  }
}
