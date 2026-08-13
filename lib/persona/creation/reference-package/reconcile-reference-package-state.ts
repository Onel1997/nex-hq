/**
 * Phase 2.3D.11 — Authoritative Reference Package state reconciler.
 *
 * Single deterministic state machine derived from persisted attempts + assets.
 * All coverage, slot status, readiness, and delete guards must use this module.
 */

import type { SlotCoverageResolution } from "./coverage";
import type { PersonaReferenceAsset } from "@/lib/persona/domain/types";
import {
  getAttemptEffectiveSlot,
  parseReferencePackageAssetNotes,
  type ReferencePackageAttempt,
} from "./types";
import {
  REFERENCE_PACKAGE_SLOTS,
  type ReferencePackageAttemptStatus,
  type ReferencePackageSlot,
} from "./slots";
import { isAngleDirectionUsable, type AngleDirection } from "./angle-direction";
import type { IdentityConsistencyDecision } from "./identity-consistency";
import {
  isMismatchOverrideUsable,
  resolveIdentitySourceConfidence,
  type HumanIdentityReview,
  type IdentitySourceConfidence,
} from "./human-identity-override";
import {
  attemptsHistoryForSlot,
  isCurrentlyAcceptedUsable,
  isIdentityDecisionEligibleForHumanApproval,
  latestAttemptPerSlot,
} from "./coverage";

export const REFERENCE_PACKAGE_RECONCILER_VERSION =
  "reference-package-reconciler-v1.0.0" as const;

export type ReferencePackageSlotState =
  | "accepted"
  | "review"
  | "wrong_camera_direction"
  | "identity_warning"
  | "identity_mismatch"
  | "rejected"
  | "missing";

export type ReplacementState =
  | "none"
  | "pending"
  | "approved"
  | "rejected"
  | "predecessor_missing";

export type ReferenceProvenance =
  | "generated"
  | "mirror_derivation"
  | "reassigned"
  | "replacement";

export type ReconciledSlotHistoryEntry = {
  attemptId: string;
  assetId: string | null;
  label: string;
  attemptStatus: ReferencePackageAttempt["status"];
  assetStatus: string | null;
};

export type ReconciledReferencePackageSlot = {
  slot: ReferencePackageSlot;
  activeAssetId: string | null;
  activeAttemptId: string | null;
  state: ReferencePackageSlotState;
  usable: boolean;
  machineIdentity: IdentityConsistencyDecision | null;
  humanIdentityReview: HumanIdentityReview | null;
  cameraDirection: AngleDirection | null;
  effectiveSlot: ReferencePackageSlot;
  provenance: ReferenceProvenance;
  replacementState: ReplacementState;
  replacementPredecessorMissing: boolean;
  pendingReplacementAssetId: string | null;
  history: ReconciledSlotHistoryEntry[];
  /** Legacy attempt status for existing consumers. */
  legacyStatus: ReferencePackageAttemptStatus;
  latestAttempt: ReferencePackageAttempt | null;
  attemptHistory: ReferencePackageAttempt[];
  identityDecision: IdentityConsistencyDecision | null;
  humanReview: "approved" | "rejected" | "pending" | null;
  angleManuallyReassigned: boolean;
  angleDirection: AngleDirection | null;
  detectedOrientation: ReferencePackageAttempt["detected_orientation"];
  wrongCameraDirection: boolean;
  acceptedViaHumanIdentityOverride: boolean;
  identitySourceConfidence: IdentitySourceConfidence | null;
  coverageLabel: string | null;
  countsTowardCoverage: boolean;
};

export type ReconciledReferencePackageState = {
  reconcilerVersion: typeof REFERENCE_PACKAGE_RECONCILER_VERSION;
  reconciledAt: string;
  slots: ReconciledReferencePackageSlot[];
  acceptedCount: number;
  requiredCount: number;
  referencePackageReady: boolean;
  auditEvents: string[];
};

type AssetAttemptPair = {
  asset: PersonaReferenceAsset;
  attempt: ReferencePackageAttempt;
  meta: NonNullable<ReturnType<typeof parseReferencePackageAssetNotes>>;
};

function assetEffectiveSlot(
  asset: PersonaReferenceAsset,
  attempt: ReferencePackageAttempt | null,
): ReferencePackageSlot | null {
  const meta = parseReferencePackageAssetNotes(asset.notes);
  if (meta?.effective_slot) return meta.effective_slot;
  if (meta?.slot) return meta.slot;
  if (attempt) return getAttemptEffectiveSlot(attempt);
  return null;
}

function attemptRecency(a: ReferencePackageAttempt): string {
  return a.reassigned_at && a.reassigned_at > a.updated_at
    ? a.reassigned_at
    : a.updated_at;
}

function isPendingReplacementCandidate(
  asset: PersonaReferenceAsset,
  attempt: ReferencePackageAttempt,
): boolean {
  if (asset.status !== "review") return false;
  const meta = parseReferencePackageAssetNotes(asset.notes);
  return attempt.replacement_candidate === true || meta?.replacement_candidate === true;
}

/** Approved replacement that no longer depends on predecessor existence. */
export function isFinalizedApprovedReplacement(
  asset: PersonaReferenceAsset,
  attempt: ReferencePackageAttempt | null,
): boolean {
  if (asset.status !== "approved") return false;
  const meta = parseReferencePackageAssetNotes(asset.notes);
  if (meta?.replacement_approved_at) return true;
  if (
    meta?.replacement_for_asset_id &&
    meta.replacement_candidate !== true &&
    asset.status === "approved"
  ) {
    return true;
  }
  if (
    attempt &&
    attempt.replacement_for_asset_id &&
    !attempt.replacement_candidate &&
    attempt.status === "accepted"
  ) {
    return true;
  }
  // Orphan recovery: approved asset with replacement lineage is authoritative.
  if (
    asset.status === "approved" &&
    (meta?.replacement_for_asset_id || attempt?.replacement_for_asset_id)
  ) {
    return true;
  }
  return false;
}

function predecessorMissing(
  asset: PersonaReferenceAsset,
  attempt: ReferencePackageAttempt | null,
  assets: readonly PersonaReferenceAsset[],
): boolean {
  const meta = parseReferencePackageAssetNotes(asset.notes);
  const predecessorId =
    attempt?.replacement_for_asset_id ?? meta?.replacement_for_asset_id ?? null;
  if (!predecessorId) return false;
  return !assets.some((a) => a.id === predecessorId);
}

function resolveProvenance(
  attempt: ReferencePackageAttempt,
  meta: ReturnType<typeof parseReferencePackageAssetNotes>,
): ReferenceProvenance {
  if (
    attempt.derivation_type === "horizontal_mirror" ||
    attempt.provider === "derived_local"
  ) {
    return "mirror_derivation";
  }
  if (attempt.reassigned_from || meta?.reassigned_from) return "reassigned";
  if (
    attempt.replacement_for_asset_id ||
    meta?.replacement_for_asset_id ||
    meta?.replacement_approved_at
  ) {
    return "replacement";
  }
  return "generated";
}

/** Derive usability from persisted facts — does not weaken existing safety rules. */
export function deriveReferenceUsability(input: {
  slot: ReferencePackageSlot;
  attempt: ReferencePackageAttempt | null;
  asset: PersonaReferenceAsset | null;
}): boolean {
  if (!input.attempt || !input.asset) return false;
  if (input.asset.status !== "approved") return false;

  const effective = assetEffectiveSlot(input.asset, input.attempt);
  if (effective !== input.slot) return false;

  return isCurrentlyAcceptedUsable({
    attempt: input.attempt,
    asset: input.asset,
  });
}

function collectSlotPairs(
  slot: ReferencePackageSlot,
  attempts: readonly ReferencePackageAttempt[],
  assets: readonly PersonaReferenceAsset[],
): AssetAttemptPair[] {
  const history = attemptsHistoryForSlot(attempts, slot);
  const pairs: AssetAttemptPair[] = [];
  const seen = new Set<string>();

  for (const attempt of history) {
    if (!attempt.generated_asset_id) continue;
    const asset = assets.find((a) => a.id === attempt.generated_asset_id);
    if (!asset) continue;
    if (asset.status === "superseded" || asset.status === "archived") continue;

    let meta = parseReferencePackageAssetNotes(asset.notes);
    const effective = meta?.effective_slot ?? meta?.slot ?? getAttemptEffectiveSlot(attempt);
    if (effective !== slot) continue;

    if (!meta) {
      meta = {
        slot: effective,
        requested_slot: attempt.reference_slot,
        effective_slot: effective,
        master_reference_id: attempt.master_reference_id,
        identity_decision: attempt.identity_decision,
        angle_direction: attempt.angle_direction,
        detected_orientation: attempt.detected_orientation,
        attempt_id: attempt.id,
      } as AssetAttemptPair["meta"];
    }

    if (seen.has(asset.id)) continue;
    seen.add(asset.id);
    pairs.push({ asset, attempt, meta });
  }

  for (const asset of assets) {
    if (seen.has(asset.id)) continue;
    const meta = parseReferencePackageAssetNotes(asset.notes);
    if (!meta) continue;
    const effective = meta.effective_slot ?? meta.slot;
    if (effective !== slot) continue;
    if (asset.status === "superseded" || asset.status === "archived") continue;
    const attempt =
      attempts.find((a) => a.generated_asset_id === asset.id) ??
      (meta.attempt_id
        ? attempts.find((a) => a.id === meta.attempt_id) ?? null
        : null);
    if (!attempt) continue;
    seen.add(asset.id);
    pairs.push({ asset, attempt, meta });
  }

  return pairs;
}

function pickDeterministicApproved(
  candidates: AssetAttemptPair[],
): AssetAttemptPair | null {
  if (candidates.length === 0) return null;
  const sorted = [...candidates].sort((a, b) => {
    const aFinal = isFinalizedApprovedReplacement(a.asset, a.attempt) ? 1 : 0;
    const bFinal = isFinalizedApprovedReplacement(b.asset, b.attempt) ? 1 : 0;
    if (aFinal !== bFinal) return bFinal - aFinal;
    const aApproved = a.meta.replacement_approved_at ?? a.asset.updated_at;
    const bApproved = b.meta.replacement_approved_at ?? b.asset.updated_at;
    if (aApproved !== bApproved) return bApproved.localeCompare(aApproved);
    return attemptRecency(b.attempt).localeCompare(attemptRecency(a.attempt));
  });
  return sorted[0] ?? null;
}

function findPendingReplacement(
  slot: ReferencePackageSlot,
  attempts: readonly ReferencePackageAttempt[],
  assets: readonly PersonaReferenceAsset[],
): AssetAttemptPair | null {
  const pendingAttempts = attempts
    .filter(
      (a) =>
        a.replacement_candidate &&
        (a.replacement_for_slot === slot || getAttemptEffectiveSlot(a) === slot),
    )
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  for (const attempt of pendingAttempts) {
    if (!attempt.generated_asset_id) continue;
    const asset = assets.find((a) => a.id === attempt.generated_asset_id);
    if (!asset) continue;
    const meta = parseReferencePackageAssetNotes(asset.notes);
    if (!meta) continue;
    if (isPendingReplacementCandidate(asset, attempt)) {
      return { asset, attempt, meta };
    }
  }
  return null;
}

function mapCanonicalState(input: {
  usable: boolean;
  attempt: ReferencePackageAttempt | null;
  asset: PersonaReferenceAsset | null;
  pendingReplacement: AssetAttemptPair | null;
}): ReferencePackageSlotState {
  if (input.usable) return "accepted";

  const { attempt, asset } = input;
  if (!attempt) return "missing";

  const angleBad =
    attempt.angle_direction === "incorrect" ||
    (attempt.angle_direction === "uncertain" &&
      attempt.detected_orientation != null);

  if (angleBad) return "wrong_camera_direction";

  const decision = attempt.identity_decision;

  if (decision === "identity_mismatch") {
    if (attempt.human_identity_review === "approved_override" && asset?.status === "approved") {
      return "accepted";
    }
    return "identity_mismatch";
  }

  if (decision === "identity_warning") {
    if (asset?.status === "rejected" || asset?.status === "archived") {
      return "rejected";
    }
    if (asset?.status === "approved") return "accepted";
    return "identity_warning";
  }

  if (asset?.status === "rejected" || asset?.status === "archived") {
    return "rejected";
  }

  if (input.pendingReplacement) return "review";

  if (asset?.status === "review" || asset?.status === "uploaded") {
    return "review";
  }

  if (attempt.status === "failed") return "wrong_camera_direction";
  if (attempt.status === "rejected") return "rejected";
  if (attempt.status === "missing") return "missing";

  return "review";
}

function mapLegacyStatus(state: ReferencePackageSlotState): ReferencePackageAttemptStatus {
  switch (state) {
    case "accepted":
      return "accepted";
    case "wrong_camera_direction":
      return "failed";
    case "identity_mismatch":
      return "mismatch";
    case "identity_warning":
    case "review":
      return "review";
    case "rejected":
      return "rejected";
    case "missing":
      return "missing";
  }
}

function buildHistory(
  slot: ReferencePackageSlot,
  attempts: readonly ReferencePackageAttempt[],
  assets: readonly PersonaReferenceAsset[],
): ReconciledSlotHistoryEntry[] {
  return attemptsHistoryForSlot(attempts, slot).map((attempt) => {
    const asset = attempt.generated_asset_id
      ? assets.find((a) => a.id === attempt.generated_asset_id) ?? null
      : null;
    let label = `Attempt — ${attempt.status}`;
    if (attempt.replacement_candidate) label = "Replacement candidate";
    if (asset?.status === "superseded") label = "Superseded";
    if (asset && isFinalizedApprovedReplacement(asset, attempt)) {
      label = "Approved replacement";
    } else if (asset?.status === "approved" && deriveReferenceUsability({ slot, attempt, asset })) {
      label = "Accepted";
    } else if (asset?.status === "rejected" && attempt.replacement_candidate) {
      label = "Replacement rejected";
    }
    return {
      attemptId: attempt.id,
      assetId: asset?.id ?? null,
      label,
      attemptStatus: attempt.status,
      assetStatus: asset?.status ?? null,
    };
  });
}

function reconcileSlot(
  slot: ReferencePackageSlot,
  attempts: readonly ReferencePackageAttempt[],
  assets: readonly PersonaReferenceAsset[],
  countedAssetIds: Set<string>,
  auditEvents: string[],
): ReconciledReferencePackageSlot {
  const history = attemptsHistoryForSlot(attempts, slot);
  const latestAttempt = latestAttemptPerSlot(attempts).get(slot) ?? null;
  const latestAsset = latestAttempt?.generated_asset_id
    ? assets.find((a) => a.id === latestAttempt.generated_asset_id) ?? null
    : null;

  const latestRejectedNonReplacement = Boolean(
    latestAttempt &&
      latestAsset?.status === "rejected" &&
      !latestAttempt.replacement_candidate,
  );

  const pairs = collectSlotPairs(slot, attempts, assets);
  let approvedUsable = pairs.filter((p) =>
    deriveReferenceUsability({ slot, attempt: p.attempt, asset: p.asset }),
  );

  if (latestRejectedNonReplacement) {
    approvedUsable = [];
  }

  const pendingReplacement = findPendingReplacement(slot, attempts, assets);

  let active: AssetAttemptPair | null = pickDeterministicApproved(approvedUsable);

  if (approvedUsable.length > 1) {
    auditEvents.push("reference_package.multiple_active_reconciled");
  }

  let replacementState: ReplacementState = "none";
  let replacementPredecessorMissing = false;

  if (active && isFinalizedApprovedReplacement(active.asset, active.attempt)) {
    replacementState = predecessorMissing(active.asset, active.attempt, assets)
      ? "predecessor_missing"
      : "approved";
    replacementPredecessorMissing = replacementState === "predecessor_missing";
  } else if (pendingReplacement) {
    replacementState = "pending";
    if (!active) {
      // Incumbent still authoritative for coverage during pending review.
      const incumbentCandidates = pairs.filter(
        (p) =>
          !isPendingReplacementCandidate(p.asset, p.attempt) &&
          deriveReferenceUsability({ slot, attempt: p.attempt, asset: p.asset }),
      );
      active = pickDeterministicApproved(incumbentCandidates);
    }
  } else if (
    latestAttempt?.replacement_candidate &&
    latestAttempt.generated_asset_id
  ) {
    const latestAsset = assets.find((a) => a.id === latestAttempt.generated_asset_id);
    if (latestAsset?.status === "rejected") {
      replacementState = "rejected";
      const incumbentCandidates = pairs.filter((p) =>
        deriveReferenceUsability({ slot, attempt: p.attempt, asset: p.asset }),
      );
      active = pickDeterministicApproved(incumbentCandidates);
    }
  }

  // Evidence-only selection when no approved usable asset exists.
  const evidenceAttempt = pendingReplacement?.attempt ?? latestAttempt ?? active?.attempt ?? null;
  const evidenceAsset =
    pendingReplacement?.asset ??
    (latestAttempt?.generated_asset_id
      ? assets.find((a) => a.id === latestAttempt.generated_asset_id) ?? null
      : null) ??
    active?.asset ??
    null;

  const usable = Boolean(
    active && deriveReferenceUsability({ slot, attempt: active.attempt, asset: active.asset }),
  );

  let countsTowardCoverage = usable;
  if (countsTowardCoverage && active) {
    if (countedAssetIds.has(active.asset.id)) {
      countsTowardCoverage = false;
    } else {
      countedAssetIds.add(active.asset.id);
    }
  }

  const state = usable
    ? "accepted"
    : mapCanonicalState({
        usable: false,
        attempt: evidenceAttempt,
        asset: evidenceAsset,
        pendingReplacement,
      });

  const displayAttempt = active?.attempt ?? evidenceAttempt;
  const displayAsset = active?.asset ?? evidenceAsset;
  const provenance = displayAttempt
    ? resolveProvenance(
        displayAttempt,
        parseReferencePackageAssetNotes(displayAsset?.notes ?? "") ??
          active?.meta ??
          null,
      )
    : "generated";

  const humanReview =
    displayAsset?.status === "approved"
      ? "approved"
      : displayAsset?.status === "rejected" ||
          displayAsset?.status === "archived" ||
          displayAsset?.status === "superseded"
        ? "rejected"
        : displayAsset?.status === "review" || displayAsset?.status === "uploaded"
          ? "pending"
          : null;

  const coverageLabel = countsTowardCoverage
    ? replacementState === "pending"
      ? "Accepted — replacement pending"
      : displayAttempt?.identity_decision === "identity_mismatch" &&
          displayAttempt?.human_identity_review === "approved_override"
        ? "Accepted — Human Identity Override"
        : replacementState === "predecessor_missing"
          ? "Accepted — replacement (predecessor archived)"
          : "Accepted"
    : state === "identity_warning"
      ? "Identity warning — review required"
      : state === "identity_mismatch"
        ? "Identity mismatch"
        : state === "wrong_camera_direction"
          ? "Wrong camera direction"
          : null;

  return {
    slot,
    activeAssetId: active?.asset.id ?? null,
    activeAttemptId: active?.attempt.id ?? null,
    state,
    usable: countsTowardCoverage,
    machineIdentity: displayAttempt?.identity_decision ?? null,
    humanIdentityReview: displayAttempt?.human_identity_review ?? null,
    cameraDirection: displayAttempt?.angle_direction ?? null,
    effectiveSlot: slot,
    provenance,
    replacementState,
    replacementPredecessorMissing,
    pendingReplacementAssetId: pendingReplacement?.asset.id ?? null,
    history: buildHistory(slot, attempts, assets),
    legacyStatus: mapLegacyStatus(state),
    latestAttempt,
    attemptHistory: history,
    identityDecision: displayAttempt?.identity_decision ?? null,
    humanReview,
    angleManuallyReassigned: Boolean(
      displayAttempt?.reassigned_from ||
        (displayAttempt?.effective_slot &&
          displayAttempt.effective_slot !== displayAttempt.reference_slot),
    ),
    angleDirection: displayAttempt?.angle_direction ?? null,
    detectedOrientation: displayAttempt?.detected_orientation ?? null,
    wrongCameraDirection: state === "wrong_camera_direction",
    acceptedViaHumanIdentityOverride: Boolean(
      countsTowardCoverage &&
        displayAttempt?.identity_decision === "identity_mismatch" &&
        displayAttempt?.human_identity_review === "approved_override",
    ),
    identitySourceConfidence: resolveIdentitySourceConfidence({
      identityDecision: displayAttempt?.identity_decision,
      humanIdentityReview: displayAttempt?.human_identity_review,
      assetApproved: active?.asset.status === "approved",
    }),
    coverageLabel,
    countsTowardCoverage,
  };
}

/** Authoritative Reference Package reconciliation from persisted facts. */
export function reconcileReferencePackageState(input: {
  attempts: readonly ReferencePackageAttempt[];
  assets: readonly PersonaReferenceAsset[];
}): ReconciledReferencePackageState {
  const countedAssetIds = new Set<string>();
  const auditEvents: string[] = [];

  const slots = REFERENCE_PACKAGE_SLOTS.map((slot) =>
    reconcileSlot(slot, input.attempts, input.assets, countedAssetIds, auditEvents),
  );

  const acceptedCount = slots.filter((s) => s.usable && s.countsTowardCoverage).length;

  return {
    reconcilerVersion: REFERENCE_PACKAGE_RECONCILER_VERSION,
    reconciledAt: new Date().toISOString(),
    slots,
    acceptedCount,
    requiredCount: REFERENCE_PACKAGE_SLOTS.length,
    referencePackageReady: acceptedCount === REFERENCE_PACKAGE_SLOTS.length,
    auditEvents,
  };
}

/** Whether an asset may be deleted without breaking active package state. */
export function assertReferenceAssetDeletable(input: {
  asset: PersonaReferenceAsset;
  isMaster: boolean;
  reconciled: ReconciledReferencePackageState;
}): { ok: true } | { ok: false; reason: string } {
  if (input.isMaster) {
    return {
      ok: false,
      reason: "Master Identity Reference cannot be deleted.",
    };
  }

  const meta = parseReferencePackageAssetNotes(input.asset.notes);
  if (!meta) {
    return { ok: true };
  }

  const slot = meta.effective_slot ?? meta.slot;
  const row = input.reconciled.slots.find((s) => s.slot === slot);
  if (row?.activeAssetId === input.asset.id && row.usable) {
    return {
      ok: false,
      reason:
        "Current active accepted reference cannot be deleted. Use Regenerate accepted angle to propose a replacement.",
    };
  }

  if (input.asset.status === "superseded") {
    return { ok: true };
  }

  return { ok: true };
}

/** Map reconciled slot to legacy coverage row for gradual migration. */
export function toLegacyCoverageSlot(
  row: ReconciledReferencePackageSlot,
): {
  slot: ReferencePackageSlot;
  status: ReferencePackageAttemptStatus;
  latestAttempt: ReferencePackageAttempt | null;
  activeAssetId: string | null;
  incumbentAcceptedAssetId: string | null;
  pendingReplacementAssetId: string | null;
  countsTowardCoverage: boolean;
  attemptHistory: ReferencePackageAttempt[];
  identityDecision: IdentityConsistencyDecision | null;
  humanReview: "approved" | "rejected" | "pending" | null;
  angleManuallyReassigned: boolean;
  angleDirection: AngleDirection | null;
  detectedOrientation: ReferencePackageAttempt["detected_orientation"];
  wrongCameraDirection: boolean;
  humanIdentityReview: HumanIdentityReview | null;
  acceptedViaHumanIdentityOverride: boolean;
  identitySourceConfidence: IdentitySourceConfidence | null;
  coverageLabel: string | null;
} {
  return {
    slot: row.slot,
    status: row.legacyStatus,
    latestAttempt: row.latestAttempt,
    activeAssetId: row.activeAssetId,
    incumbentAcceptedAssetId: row.usable ? row.activeAssetId : null,
    pendingReplacementAssetId: row.pendingReplacementAssetId,
    countsTowardCoverage: row.countsTowardCoverage,
    attemptHistory: row.attemptHistory,
    identityDecision: row.identityDecision,
    humanReview: row.humanReview,
    angleManuallyReassigned: row.angleManuallyReassigned,
    angleDirection: row.angleDirection,
    detectedOrientation: row.detectedOrientation,
    wrongCameraDirection: row.wrongCameraDirection,
    humanIdentityReview: row.humanIdentityReview,
    acceptedViaHumanIdentityOverride: row.acceptedViaHumanIdentityOverride,
    identitySourceConfidence: row.identitySourceConfidence,
    coverageLabel: row.coverageLabel,
  };
}

/** Legacy coverage wrapper — delegates to reconciler (Phase 2.3D.11). */
export function resolveReferencePackageSlotCoverage(input: {
  attempts: readonly ReferencePackageAttempt[];
  assets: readonly PersonaReferenceAsset[];
}): {
  slots: SlotCoverageResolution[];
  acceptedCount: number;
  referencePackageReady: boolean;
} {
  const reconciled = reconcileReferencePackageState(input);
  return {
    slots: reconciled.slots.map(toLegacyCoverageSlot),
    acceptedCount: reconciled.acceptedCount,
    referencePackageReady: reconciled.referencePackageReady,
  };
}
