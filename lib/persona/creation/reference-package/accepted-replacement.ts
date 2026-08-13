/**
 * Phase 2.3D.10 — Regenerate accepted angle with safe replacement.
 *
 * Incumbent accepted reference stays active and counted until user explicitly
 * approves the replacement candidate. No overwrite. No provider calls in tests.
 */

import { PersonaDomainError } from "@/lib/persona/domain/errors";
import type { WorkspaceScope } from "@/lib/persona/domain/types";
import type { PersonaReferenceAsset } from "@/lib/persona/domain/types";
import { getPersonaRepository } from "@/lib/persona/repositories/factory";
import { logPersonaAuditEvent } from "@/lib/persona/audit/persona-events";
import {
  isMasterIdentityReference,
  parseMasterIdentityNotes,
  getMasterIdentityReferenceForPersona,
} from "@/lib/persona/creation/master-identity-reference";
import {
  estimateReferencePackageCost,
  type ReferencePackageDeps,
} from "./service";
import { getReferencePackageRepository } from "./repository";
import {
  isCurrentlyAcceptedUsable,
  isIdentityDecisionEligibleForHumanApproval,
  resolveIncumbentAcceptedForSlot,
  resolvePendingReplacementForSlot,
  resolveReferencePackageSlotCoverage,
} from "./coverage";
import { isAngleDirectionUsable } from "./angle-direction";
import { isMismatchOverrideUsable } from "./human-identity-override";
import {
  buildReferencePackageAssetNotes,
  getAttemptEffectiveSlot,
  parseReferencePackageAssetNotes,
  type ReferencePackageAttempt,
} from "./types";
import {
  isReferencePackageSlot,
  REFERENCE_PACKAGE_SLOT_LABELS,
  type ReferencePackageSlot,
} from "./slots";
import { createConfirmationToken } from "@/lib/persona/creation/paid-confirmation";
import { createHash } from "node:crypto";
import { generateOneAngleForReplacement } from "./service";

export const ACCEPTED_REPLACEMENT_POLICY_VERSION =
  "accepted-replacement-v1.0.0" as const;

function buildReplacementEstimateHash(input: {
  personaId: string;
  masterReferenceId: string;
  imageCount: number;
  estimatedMin: number;
  estimatedMax: number;
}): string {
  const raw = [
    input.personaId,
    input.masterReferenceId,
    "reference_package_replacement",
    "openai",
    String(input.imageCount),
    input.estimatedMin.toFixed(4),
    input.estimatedMax.toFixed(4),
  ].join("|");
  return createHash("sha256").update(raw).digest("hex");
}

export function canProposeAcceptedReplacement(input: {
  isMaster: boolean;
  isStageBGenerated: boolean;
  identityLocked: boolean;
  assetStatus: string;
  slot: ReferencePackageSlot;
  countsTowardCoverage: boolean;
  hasPendingReplacement: boolean;
}): { ok: true } | { ok: false; reason: string } {
  if (input.isMaster) {
    return {
      ok: false,
      reason: "Master Identity Reference cannot be regenerated via replacement.",
    };
  }
  if (!input.isStageBGenerated) {
    return {
      ok: false,
      reason: "Only Stage B generated supporting references support replacement.",
    };
  }
  if (input.identityLocked) {
    return {
      ok: false,
      reason: "Cannot regenerate accepted angle after Identity Lock is finalized.",
    };
  }
  if (!input.countsTowardCoverage) {
    return {
      ok: false,
      reason: "Replacement regeneration requires a currently accepted usable reference.",
    };
  }
  if (input.assetStatus !== "approved") {
    return {
      ok: false,
      reason: "Only approved accepted references can start replacement regeneration.",
    };
  }
  if (input.hasPendingReplacement) {
    return {
      ok: false,
      reason: "A replacement candidate is already pending review for this slot.",
    };
  }
  return { ok: true };
}

export function isReplacementCandidateUsable(input: {
  attempt: Pick<
    ReferencePackageAttempt,
    | "identity_decision"
    | "human_identity_review"
    | "angle_direction"
    | "status"
    | "replacement_candidate"
  >;
  asset: Pick<PersonaReferenceAsset, "status">;
}): boolean {
  if (!input.attempt.replacement_candidate) return false;
  if (input.asset.status !== "review") return false;

  if (
    input.attempt.identity_decision === "identity_mismatch" &&
    input.attempt.human_identity_review === "approved_override" &&
    input.attempt.angle_direction != null &&
    isAngleDirectionUsable(input.attempt.angle_direction)
  ) {
    return input.attempt.status !== "failed" && input.attempt.status !== "rejected";
  }

  if (
    isMismatchOverrideUsable({
      identityDecision: input.attempt.identity_decision,
      humanIdentityReview: input.attempt.human_identity_review,
      angleDirection: input.attempt.angle_direction,
      assetStatus: input.asset.status,
      attemptStatus: input.attempt.status,
    })
  ) {
    return (
      input.attempt.angle_direction != null &&
      isAngleDirectionUsable(input.attempt.angle_direction)
    );
  }

  const decision = input.attempt.identity_decision;
  if (decision === "identity_mismatch" || decision === "evaluation_failed") {
    return false;
  }
  if (
    decision != null &&
    !isIdentityDecisionEligibleForHumanApproval(decision)
  ) {
    return false;
  }
  if (
    input.attempt.angle_direction &&
    !isAngleDirectionUsable(input.attempt.angle_direction)
  ) {
    return false;
  }
  if (input.attempt.status === "failed" || input.attempt.status === "rejected") {
    return false;
  }
  return true;
}

/** Prepare cost estimate for exactly one replacement image — zero provider calls. */
export async function prepareAcceptedAngleReplacement(
  scope: WorkspaceScope,
  personaId: string,
  input: { assetId: string },
  deps?: ReferencePackageDeps,
) {
  const personaRepo = getPersonaRepository();
  const persona = await personaRepo.getPersona(scope, personaId);
  if (!persona) {
    throw new PersonaDomainError("Persona not found", "NOT_FOUND", { personaId });
  }

  const asset = await personaRepo.getReferenceAsset(scope, input.assetId);
  if (!asset || asset.persona_id !== personaId) {
    throw new PersonaDomainError("Reference asset not found", "NOT_FOUND", {
      assetId: input.assetId,
    });
  }

  if (isMasterIdentityReference(asset) || parseMasterIdentityNotes(asset.notes)) {
    throw new PersonaDomainError(
      "Master Identity Reference cannot be regenerated via replacement.",
      "WORKFLOW",
    );
  }

  const pkgMeta = parseReferencePackageAssetNotes(asset.notes);
  if (!pkgMeta) {
    throw new PersonaDomainError(
      "Only Stage B generated supporting references support replacement.",
      "WORKFLOW",
    );
  }

  const slot = pkgMeta.effective_slot ?? pkgMeta.slot;
  if (!isReferencePackageSlot(slot)) {
    throw new PersonaDomainError("Invalid reference slot.", "WORKFLOW");
  }

  const pkgRepo = getReferencePackageRepository();
  const attempts = await pkgRepo.listAttemptsForPersona(scope, personaId);
  const assets = await personaRepo.listReferenceAssets(scope, personaId);
  const coverage = resolveReferencePackageSlotCoverage({ attempts, assets });
  const row = coverage.slots.find((s) => s.slot === slot);
  const pending = resolvePendingReplacementForSlot(slot, attempts, assets);

  const gate = canProposeAcceptedReplacement({
    isMaster: false,
    isStageBGenerated: true,
    identityLocked: persona.identity_lock_status === "approved",
    assetStatus: asset.status,
    slot,
    countsTowardCoverage: row?.countsTowardCoverage === true,
    hasPendingReplacement: pending != null,
  });
  if (!gate.ok) {
    throw new PersonaDomainError(gate.reason, "WORKFLOW", {
      assetId: asset.id,
      slot,
    });
  }

  const master = await getMasterIdentityReferenceForPersona(scope, personaId);
  if (!master) {
    throw new PersonaDomainError(
      "Master Identity Reference is required.",
      "WORKFLOW",
    );
  }

  const estimate = estimateReferencePackageCost([slot]);
  const token = createConfirmationToken();
  const estimateHash = buildReplacementEstimateHash({
    personaId,
    masterReferenceId: master.reference.id,
    imageCount: 1,
    estimatedMin: estimate.estimatedMin,
    estimatedMax: estimate.estimatedMax,
  });

  const session = await pkgRepo.createSession(scope, {
    persona_id: personaId,
    master_reference_id: master.reference.id,
    confirmation_token: token,
    estimate_hash: estimateHash,
    estimated_cost_min: estimate.estimatedMin,
    estimated_cost_max: estimate.estimatedMax,
    max_authorized_spend: estimate.maxAuthorizedSpend,
    image_count: 1,
  });

  return {
    providerCalled: false as const,
    action: "prepare_regenerate_accepted" as const,
    personaId,
    slot,
    slotLabel: REFERENCE_PACKAGE_SLOT_LABELS[slot],
    incumbentAssetId: asset.id,
    sessionId: session.id,
    confirmationToken: token,
    estimate,
    masterReferenceId: master.reference.id,
    policyVersion: ACCEPTED_REPLACEMENT_POLICY_VERSION,
  };
}

/** Confirm + generate exactly one replacement candidate — incumbent unchanged. */
export async function confirmAcceptedAngleReplacement(
  scope: WorkspaceScope,
  personaId: string,
  input: {
    assetId: string;
    confirmationToken: string;
    costConfirmed: boolean;
  },
  deps?: ReferencePackageDeps,
) {
  if (!input.costConfirmed) {
    throw new PersonaDomainError(
      "Explicit cost confirmation required.",
      "WORKFLOW",
    );
  }

  const personaRepo = getPersonaRepository();
  const pkgRepo = getReferencePackageRepository();
  const persona = await personaRepo.getPersona(scope, personaId);
  if (!persona) {
    throw new PersonaDomainError("Persona not found", "NOT_FOUND", { personaId });
  }

  const incumbentAsset = await personaRepo.getReferenceAsset(
    scope,
    input.assetId,
  );
  if (!incumbentAsset || incumbentAsset.persona_id !== personaId) {
    throw new PersonaDomainError("Reference asset not found", "NOT_FOUND", {
      assetId: input.assetId,
    });
  }

  const incumbentSnapshot = {
    id: incumbentAsset.id,
    storagePath: incumbentAsset.storage_path,
    status: incumbentAsset.status,
    notes: incumbentAsset.notes,
  };

  const session = await pkgRepo.findSessionByToken(
    scope,
    input.confirmationToken,
  );
  if (!session || session.persona_id !== personaId) {
    throw new PersonaDomainError("Invalid confirmation token.", "WORKFLOW");
  }
  if (session.consumed_at) {
    throw new PersonaDomainError("Confirmation token already consumed.", "WORKFLOW");
  }
  if (session.image_count !== 1) {
    throw new PersonaDomainError(
      "Replacement confirmation must be for exactly one image.",
      "WORKFLOW",
    );
  }

  const pkgMeta = parseReferencePackageAssetNotes(incumbentAsset.notes);
  if (!pkgMeta) {
    throw new PersonaDomainError("Not a Stage B reference.", "WORKFLOW");
  }
  const slot = pkgMeta.effective_slot ?? pkgMeta.slot;
  if (!isReferencePackageSlot(slot)) {
    throw new PersonaDomainError("Invalid slot.", "WORKFLOW");
  }

  const attemptsBefore = await pkgRepo.listAttemptsForPersona(scope, personaId);
  const assetsBefore = await personaRepo.listReferenceAssets(scope, personaId);
  const coverageBefore = resolveReferencePackageSlotCoverage({
    attempts: attemptsBefore,
    assets: assetsBefore,
  });

  const row = coverageBefore.slots.find((s) => s.slot === slot);
  const pending = resolvePendingReplacementForSlot(slot, attemptsBefore, assetsBefore);
  const gate = canProposeAcceptedReplacement({
    isMaster: false,
    isStageBGenerated: true,
    identityLocked: persona.identity_lock_status === "approved",
    assetStatus: incumbentAsset.status,
    slot,
    countsTowardCoverage: row?.countsTowardCoverage === true,
    hasPendingReplacement: pending != null,
  });
  if (!gate.ok) {
    throw new PersonaDomainError(gate.reason, "WORKFLOW", { assetId: input.assetId });
  }

  const master = await getMasterIdentityReferenceForPersona(scope, personaId);
  if (!master) {
    throw new PersonaDomainError("Master required.", "WORKFLOW");
  }

  const now = new Date().toISOString();
  await pkgRepo.updateSession(scope, session.id, {
    status: "generating",
    confirmed_at: now,
    consumed_at: now,
  });

  const attempt = await generateOneAngleForReplacement(scope, {
    personaId,
    sessionId: session.id,
    masterReferenceId: master.reference.id,
    masterStoragePath: master.reference.storage_path,
    masterMimeType: master.reference.mime_type,
    slot,
    replacementForAssetId: incumbentAsset.id,
    deps,
  });

  const attemptsAfter = await pkgRepo.listAttemptsForPersona(scope, personaId);
  const assetsAfter = await personaRepo.listReferenceAssets(scope, personaId);
  const coverageAfter = resolveReferencePackageSlotCoverage({
    attempts: attemptsAfter,
    assets: assetsAfter,
  });

  const incumbentAfter = await personaRepo.getReferenceAsset(
    scope,
    incumbentSnapshot.id,
  );
  if (
    !incumbentAfter ||
    incumbentAfter.storage_path !== incumbentSnapshot.storagePath ||
    incumbentAfter.status !== incumbentSnapshot.status ||
    incumbentAfter.notes !== incumbentSnapshot.notes
  ) {
    throw new PersonaDomainError(
      "FAIL CLOSED: incumbent accepted reference must remain unchanged after replacement generation.",
      "WORKFLOW",
    );
  }

  if (coverageAfter.acceptedCount !== coverageBefore.acceptedCount) {
    throw new PersonaDomainError(
      "FAIL CLOSED: coverage must remain unchanged while replacement is pending review.",
      "WORKFLOW",
      {
        before: coverageBefore.acceptedCount,
        after: coverageAfter.acceptedCount,
      },
    );
  }

  const newAsset = assetsAfter.find((a) => a.id === attempt.generated_asset_id);
  const newMeta = parseReferencePackageAssetNotes(newAsset?.notes);
  if (!newMeta?.replacement_candidate || !attempt.replacement_candidate) {
    throw new PersonaDomainError(
      "FAIL CLOSED: generated asset must be marked replacement_candidate.",
      "WORKFLOW",
    );
  }

  await pkgRepo.updateSession(scope, session.id, {
    status: coverageAfter.referencePackageReady ? "ready" : "partial",
  });

  await logPersonaAuditEvent({
    workspaceId: scope.workspaceId,
    eventType: "reference.accepted_replacement_generated",
    recordId: personaId,
    actorId: scope.actorId,
    payload: {
      personaId,
      slot,
      incumbentAssetId: incumbentAsset.id,
      replacementAssetId: attempt.generated_asset_id,
      replacementAttemptId: attempt.id,
      policyVersion: ACCEPTED_REPLACEMENT_POLICY_VERSION,
    },
  });

  return {
    providerCalled: true as const,
    openaiCalled: deps?.skipProviderCalls ? (false as const) : (true as const),
    newImageGenerated: true as const,
    incumbentAssetId: incumbentAsset.id,
    replacementAssetId: attempt.generated_asset_id,
    replacementAttemptId: attempt.id,
    slot,
    angleDirection: attempt.angle_direction,
    identityDecision: attempt.identity_decision,
    assetStatus: newAsset?.status ?? "review",
    coverageAcceptedCount: coverageAfter.acceptedCount,
    referencePackageReady: coverageAfter.referencePackageReady,
    policyVersion: ACCEPTED_REPLACEMENT_POLICY_VERSION,
  };
}

/** Reject pending replacement — incumbent stays active. */
export async function rejectAcceptedReplacement(
  scope: WorkspaceScope,
  personaId: string,
  input: { assetId: string },
) {
  const personaRepo = getPersonaRepository();
  const pkgRepo = getReferencePackageRepository();
  const asset = await personaRepo.getReferenceAsset(scope, input.assetId);
  if (!asset || asset.persona_id !== personaId) {
    throw new PersonaDomainError("Reference asset not found", "NOT_FOUND", {
      assetId: input.assetId,
    });
  }

  const meta = parseReferencePackageAssetNotes(asset.notes);
  if (!meta?.replacement_candidate) {
    throw new PersonaDomainError(
      "Only replacement candidates can be rejected via this action.",
      "WORKFLOW",
    );
  }

  const attempts = await pkgRepo.listAttemptsForPersona(scope, personaId);
  const attempt = attempts.find((a) => a.generated_asset_id === asset.id);
  if (!attempt?.replacement_for_asset_id) {
    throw new PersonaDomainError("No replacement attempt linked.", "NOT_FOUND");
  }

  const incumbentId = attempt.replacement_for_asset_id;
  const incumbentBefore = await personaRepo.getReferenceAsset(scope, incumbentId);
  const coverageBefore = resolveReferencePackageSlotCoverage({
    attempts,
    assets: await personaRepo.listReferenceAssets(scope, personaId),
  });

  await personaRepo.updateReferenceAsset(scope, asset.id, {
    status: "rejected",
    is_primary: false,
  });
  await pkgRepo.updateAttempt(scope, attempt.id, {
    status: "rejected",
    error_message: "Replacement rejected — incumbent reference kept.",
  });

  const incumbentAfter = await personaRepo.getReferenceAsset(scope, incumbentId);
  const coverageAfter = resolveReferencePackageSlotCoverage({
    attempts: await pkgRepo.listAttemptsForPersona(scope, personaId),
    assets: await personaRepo.listReferenceAssets(scope, personaId),
  });

  if (incumbentAfter?.status !== incumbentBefore?.status) {
    throw new PersonaDomainError(
      "FAIL CLOSED: incumbent must remain approved after rejection.",
      "WORKFLOW",
    );
  }
  if (coverageAfter.acceptedCount !== coverageBefore.acceptedCount) {
    throw new PersonaDomainError(
      "FAIL CLOSED: coverage must remain unchanged after rejection.",
      "WORKFLOW",
    );
  }

  await logPersonaAuditEvent({
    workspaceId: scope.workspaceId,
    eventType: "reference.accepted_replacement_rejected",
    recordId: personaId,
    actorId: scope.actorId,
    payload: {
      personaId,
      replacementAssetId: asset.id,
      incumbentAssetId: incumbentId,
    },
  });

  return {
    providerCalled: false as const,
    replacementAssetId: asset.id,
    incumbentAssetId: incumbentId,
    incumbentStatus: incumbentAfter?.status ?? null,
    coverageAcceptedCount: coverageAfter.acceptedCount,
  };
}

/** Keep current = reject replacement (alias for UI clarity). */
export async function keepCurrentAcceptedReplacement(
  scope: WorkspaceScope,
  personaId: string,
  input: { assetId: string },
) {
  return rejectAcceptedReplacement(scope, personaId, input);
}

/** Atomically approve replacement and supersede incumbent. */
export async function approveAndReplaceAcceptedReference(
  scope: WorkspaceScope,
  personaId: string,
  input: { assetId: string; replaceConfirmed?: boolean },
) {
  if (input.replaceConfirmed === false) {
    throw new PersonaDomainError(
      "Explicit confirmation required to approve and replace.",
      "WORKFLOW",
    );
  }

  const personaRepo = getPersonaRepository();
  const persona = await personaRepo.getPersona(scope, personaId);
  if (!persona) {
    throw new PersonaDomainError("Persona not found", "NOT_FOUND", { personaId });
  }
  if (persona.identity_lock_status === "approved") {
    throw new PersonaDomainError(
      "Cannot replace accepted reference after Identity Lock is finalized.",
      "WORKFLOW",
    );
  }

  const pkgRepo = getReferencePackageRepository();
  const replacementAsset = await personaRepo.getReferenceAsset(
    scope,
    input.assetId,
  );
  if (!replacementAsset || replacementAsset.persona_id !== personaId) {
    throw new PersonaDomainError("Reference asset not found", "NOT_FOUND", {
      assetId: input.assetId,
    });
  }

  const replacementMeta = parseReferencePackageAssetNotes(replacementAsset.notes);
  if (!replacementMeta?.replacement_candidate) {
    throw new PersonaDomainError(
      "Only replacement candidates can be approved via Approve and replace.",
      "WORKFLOW",
    );
  }

  const attempts = await pkgRepo.listAttemptsForPersona(scope, personaId);
  const replacementAttempt = attempts.find(
    (a) => a.generated_asset_id === replacementAsset.id,
  );
  if (!replacementAttempt?.replacement_for_asset_id) {
    throw new PersonaDomainError("No replacement attempt linked.", "NOT_FOUND");
  }

  if (
    !isReplacementCandidateUsable({
      attempt: replacementAttempt,
      asset: replacementAsset,
    })
  ) {
    throw new PersonaDomainError(
      replacementAttempt.identity_decision === "identity_mismatch"
        ? "Identity mismatch replacement cannot replace the accepted reference."
        : replacementAttempt.angle_direction === "incorrect"
          ? "Wrong camera direction cannot replace the accepted reference."
          : "Replacement candidate is not usable.",
      "WORKFLOW",
    );
  }

  const incumbentId = replacementAttempt.replacement_for_asset_id;
  const incumbentAsset = await personaRepo.getReferenceAsset(scope, incumbentId);
  if (!incumbentAsset || incumbentAsset.status !== "approved") {
    throw new PersonaDomainError(
      "Incumbent accepted reference is no longer active.",
      "WORKFLOW",
    );
  }

  const incumbentAttempt = attempts.find(
    (a) => a.generated_asset_id === incumbentId,
  );

  const slot =
    replacementAttempt.replacement_for_slot ??
    getAttemptEffectiveSlot(replacementAttempt);
  const now = new Date().toISOString();
  const reviewedBy = scope.actorId ?? "workspace-user";

  // Atomic swap: supersede incumbent, approve replacement.
  const incumbentMeta = parseReferencePackageAssetNotes(incumbentAsset.notes);
  const supersededNotes = buildReferencePackageAssetNotes({
    slot: incumbentMeta?.effective_slot ?? incumbentMeta?.slot ?? slot,
    attemptId: incumbentMeta?.attempt_id ?? incumbentAttempt?.id ?? replacementAttempt.id,
    masterReferenceId: incumbentMeta?.master_reference_id ?? replacementAttempt.master_reference_id,
    identityDecision: incumbentMeta?.identity_decision ?? "identity_match",
    angleDirection: incumbentMeta?.angle_direction,
    detectedOrientation: incumbentMeta?.detected_orientation,
    requestedSlot: incumbentMeta?.requested_slot,
    effectiveSlot: incumbentMeta?.effective_slot,
    supersededByAssetId: replacementAsset.id,
    supersededAt: now,
  });

  await personaRepo.updateReferenceAsset(scope, incumbentId, {
    status: "superseded",
    notes: supersededNotes,
    is_primary: false,
    superseded_by_asset_id: replacementAsset.id,
  });

  const approvedNotes = buildReferencePackageAssetNotes({
    slot: replacementMeta.effective_slot ?? replacementMeta.slot,
    attemptId: replacementAttempt.id,
    masterReferenceId: replacementAttempt.master_reference_id,
    identityDecision: replacementAttempt.identity_decision ?? "identity_match",
    angleDirection: replacementAttempt.angle_direction,
    detectedOrientation: replacementAttempt.detected_orientation,
    requestedSlot: replacementMeta.requested_slot,
    effectiveSlot: replacementMeta.effective_slot,
    replacementForAssetId: incumbentId,
    replacementForSlot: slot,
    replacementCandidate: false,
    replacementApprovedAt: now,
    replacementApprovedBy: reviewedBy,
  });

  await personaRepo.updateReferenceAsset(scope, replacementAsset.id, {
    status: "approved",
    rights_confirmed: true,
    notes: approvedNotes,
  });

  await pkgRepo.updateAttempt(scope, replacementAttempt.id, {
    status: "accepted",
    replacement_candidate: false,
  });

  if (incumbentAttempt) {
    await pkgRepo.updateAttempt(scope, incumbentAttempt.id, {
      status: "accepted",
    });
  }

  const assetsAfter = await personaRepo.listReferenceAssets(scope, personaId);
  const attemptsAfter = await pkgRepo.listAttemptsForPersona(scope, personaId);
  const coverageAfter = resolveReferencePackageSlotCoverage({
    attempts: attemptsAfter,
    assets: assetsAfter,
  });

  const activeForSlot = resolveIncumbentAcceptedForSlot(
    slot as ReferencePackageSlot,
    attemptsAfter,
    assetsAfter,
  );
  if (activeForSlot.asset?.id !== replacementAsset.id) {
    throw new PersonaDomainError(
      "FAIL CLOSED: replacement must become the sole active accepted reference.",
      "WORKFLOW",
    );
  }

  const approvedOnSlot = assetsAfter.filter(
    (a) =>
      a.status === "approved" &&
      (parseReferencePackageAssetNotes(a.notes)?.effective_slot === slot ||
        parseReferencePackageAssetNotes(a.notes)?.slot === slot),
  );
  if (approvedOnSlot.length !== 1) {
    throw new PersonaDomainError(
      "FAIL CLOSED: exactly one active approved reference per slot after swap.",
      "WORKFLOW",
      { count: approvedOnSlot.length },
    );
  }

  const supersededAsset = await personaRepo.getReferenceAsset(scope, incumbentId);
  if (supersededAsset?.status !== "superseded") {
    throw new PersonaDomainError(
      "FAIL CLOSED: previous accepted reference must be superseded, not deleted.",
      "WORKFLOW",
    );
  }

  await logPersonaAuditEvent({
    workspaceId: scope.workspaceId,
    eventType: "reference.accepted_replacement_approved",
    recordId: personaId,
    actorId: scope.actorId,
    payload: {
      personaId,
      slot,
      incumbentAssetId: incumbentId,
      replacementAssetId: replacementAsset.id,
      coverageAcceptedCount: coverageAfter.acceptedCount,
    },
  });

  return {
    providerCalled: false as const,
    incumbentAssetId: incumbentId,
    incumbentStatus: "superseded" as const,
    replacementAssetId: replacementAsset.id,
    replacementStatus: "approved" as const,
    slot,
    coverageAcceptedCount: coverageAfter.acceptedCount,
    referencePackageReady: coverageAfter.referencePackageReady,
    policyVersion: ACCEPTED_REPLACEMENT_POLICY_VERSION,
  };
}
