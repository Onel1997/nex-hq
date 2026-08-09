/**
 * Phase 2.3D.8 — Explicit human identity override for Stage B references.
 * No provider calls. Machine identity_mismatch evidence is never rewritten.
 */

import { PersonaDomainError } from "@/lib/persona/domain/errors";
import type { WorkspaceScope } from "@/lib/persona/domain/types";
import { getPersonaRepository } from "@/lib/persona/repositories/factory";
import { logPersonaAuditEvent } from "@/lib/persona/audit/persona-events";
import {
  isMasterIdentityReference,
  parseMasterIdentityNotes,
} from "@/lib/persona/creation/master-identity-reference";
import {
  canProposeHumanIdentityOverride,
  HUMAN_IDENTITY_OVERRIDE_REASON_DEFAULT,
  IDENTITY_OVERRIDE_VERSION,
  resolveIdentitySourceConfidence,
} from "./human-identity-override";
import { getReferencePackageRepository } from "./repository";
import {
  buildReferencePackageAssetNotes,
  getAttemptEffectiveSlot,
  parseReferencePackageAssetNotes,
  type ReferencePackageAttempt,
} from "./types";

export type ApproveHumanIdentityOverrideInput = {
  assetId: string;
  /** UI session: user opened Compare with Master. */
  masterCompared: boolean;
  /** Explicit confirmation of the override dialog. */
  overrideConfirmed: boolean;
  reason?: string;
};

export type ApproveHumanIdentityOverrideResult = {
  providerCalled: false;
  newImageGenerated: false;
  assetId: string;
  attemptId: string;
  slot: string;
  machineIdentityDecision: "identity_mismatch";
  identityDistance: number | null;
  identitySimilarity: number | null;
  angleDirection: "correct";
  humanIdentityReview: "approved_override";
  identityOverrideVersion: typeof IDENTITY_OVERRIDE_VERSION;
  identitySourceConfidence: "human_mismatch_override";
  assetStatus: "approved";
  identityDecisionUnchanged: true;
};

export async function approveHumanIdentityOverride(
  scope: WorkspaceScope,
  personaId: string,
  input: ApproveHumanIdentityOverrideInput,
): Promise<ApproveHumanIdentityOverrideResult> {
  if (!input.overrideConfirmed) {
    throw new PersonaDomainError(
      "Explicit confirmation required for human identity override.",
      "WORKFLOW",
    );
  }
  if (!input.masterCompared) {
    throw new PersonaDomainError(
      "Compare with Master is required before identity override.",
      "WORKFLOW",
    );
  }

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
      "Master Identity Reference cannot use identity override.",
      "WORKFLOW",
    );
  }

  const pkgMeta = parseReferencePackageAssetNotes(asset.notes);
  if (!pkgMeta) {
    throw new PersonaDomainError(
      "Only Stage B generated references support identity override.",
      "WORKFLOW",
    );
  }

  const pkgRepo = getReferencePackageRepository();
  const attempts = await pkgRepo.listAttemptsForPersona(scope, personaId);
  const attempt = attempts.find((a) => a.generated_asset_id === asset.id);
  if (!attempt) {
    throw new PersonaDomainError(
      "No Stage B attempt linked to this asset.",
      "NOT_FOUND",
    );
  }

  const gate = canProposeHumanIdentityOverride({
    isMaster: false,
    isStageBGenerated: true,
    identityLocked: persona.identity_lock_status === "approved",
    assetStatus: asset.status,
    identityDecision: attempt.identity_decision,
    angleDirection: attempt.angle_direction,
    masterComparedInSession: input.masterCompared,
    humanIdentityReview: attempt.human_identity_review,
  });
  if (!gate.ok) {
    throw new PersonaDomainError(gate.reason, "WORKFLOW", {
      assetId: asset.id,
      attemptId: attempt.id,
    });
  }

  // Preserve machine evidence — never rewrite identity_decision / distance / similarity.
  const machineDecision = attempt.identity_decision;
  if (machineDecision !== "identity_mismatch") {
    throw new PersonaDomainError(
      "Human identity override applies only to machine identity_mismatch.",
      "WORKFLOW",
    );
  }
  if (attempt.angle_direction !== "correct") {
    throw new PersonaDomainError(
      "Wrong or uncertain camera direction cannot be overridden by identity approval.",
      "WORKFLOW",
    );
  }

  const now = new Date().toISOString();
  const reason =
    input.reason?.trim() || HUMAN_IDENTITY_OVERRIDE_REASON_DEFAULT;
  const reviewedBy = scope.actorId ?? "workspace-user";

  const updatedAttempt = await pkgRepo.updateAttempt(scope, attempt.id, {
    human_identity_review: "approved_override",
    human_identity_reviewed_at: now,
    human_identity_reviewed_by: reviewedBy,
    human_identity_override_reason: reason,
    identity_override_version: IDENTITY_OVERRIDE_VERSION,
    // Keep machine fields identical; only human review + status for coverage.
    identity_decision: attempt.identity_decision,
    identity_distance: attempt.identity_distance,
    identity_similarity: attempt.identity_similarity,
    angle_direction: attempt.angle_direction,
    status: "accepted",
  });

  // Guard: machine evidence must remain mismatch.
  if (updatedAttempt.identity_decision !== "identity_mismatch") {
    throw new PersonaDomainError(
      "FAIL CLOSED: machine identity_decision must remain identity_mismatch after override.",
      "WORKFLOW",
    );
  }

  const identitySourceConfidence = resolveIdentitySourceConfidence({
    identityDecision: updatedAttempt.identity_decision,
    humanIdentityReview: "approved_override",
    assetApproved: true,
  });
  if (identitySourceConfidence !== "human_mismatch_override") {
    throw new PersonaDomainError(
      "FAIL CLOSED: override must expose human_mismatch_override provenance.",
      "WORKFLOW",
    );
  }

  const notes = buildReferencePackageAssetNotes({
    slot: getAttemptEffectiveSlot(updatedAttempt),
    attemptId: updatedAttempt.id,
    masterReferenceId: updatedAttempt.master_reference_id,
    identityDecision: "identity_mismatch",
    angleDirection: updatedAttempt.angle_direction,
    requestedSlot: updatedAttempt.reference_slot,
    effectiveSlot: getAttemptEffectiveSlot(updatedAttempt),
    reassignedFrom: updatedAttempt.reassigned_from,
    reassignedAt: updatedAttempt.reassigned_at,
    reassignedBy: updatedAttempt.reassigned_by,
    angleReviewSource: updatedAttempt.angle_review_source,
    angleReviewDecision: updatedAttempt.angle_review_decision,
    providerDirectionStrategy: updatedAttempt.provider_direction_strategy,
    providerRequestedDirection: updatedAttempt.provider_requested_direction,
    profileIdentityMode: updatedAttempt.profile_identity_mode,
    profilePromptVersion: updatedAttempt.profile_prompt_version,
    humanIdentityReview: "approved_override",
    humanIdentityReviewedAt: now,
    humanIdentityReviewedBy: reviewedBy,
    humanIdentityOverrideReason: reason,
    identityOverrideVersion: IDENTITY_OVERRIDE_VERSION,
    identitySourceConfidence: "human_mismatch_override",
  });

  const updatedAsset = await personaRepo.updateReferenceAsset(scope, asset.id, {
    status: "approved",
    rights_confirmed: true,
    notes,
  });

  if (updatedAsset.id !== asset.id) {
    throw new PersonaDomainError(
      "FAIL CLOSED: identity override must not create a new asset.",
      "WORKFLOW",
    );
  }

  await logPersonaAuditEvent({
    workspaceId: scope.workspaceId,
    eventType: "reference.identity_override_approved",
    recordId: personaId,
    actorId: scope.actorId,
    payload: {
      event: "reference.identity_override_approved",
      personaId,
      assetId: asset.id,
      attemptId: attempt.id,
      slot: getAttemptEffectiveSlot(attempt),
      machineIdentityDecision: "identity_mismatch",
      identityDistance: attempt.identity_distance,
      identitySimilarity: attempt.identity_similarity,
      angleDirection: "correct",
      identityOverrideVersion: IDENTITY_OVERRIDE_VERSION,
      identitySourceConfidence: "human_mismatch_override",
      timestamp: now,
    },
  });

  return {
    providerCalled: false,
    newImageGenerated: false,
    assetId: asset.id,
    attemptId: attempt.id,
    slot: getAttemptEffectiveSlot(attempt),
    machineIdentityDecision: "identity_mismatch",
    identityDistance: attempt.identity_distance,
    identitySimilarity: attempt.identity_similarity,
    angleDirection: "correct",
    humanIdentityReview: "approved_override",
    identityOverrideVersion: IDENTITY_OVERRIDE_VERSION,
    identitySourceConfidence: "human_mismatch_override",
    assetStatus: "approved",
    identityDecisionUnchanged: true,
  };
}

/** Read helper for tests / Identity Lock provenance. */
export function getAttemptIdentityProvenance(
  attempt: Pick<
    ReferencePackageAttempt,
    | "identity_decision"
    | "human_identity_review"
    | "angle_direction"
  >,
  assetApproved: boolean,
) {
  return {
    machineIdentityDecision: attempt.identity_decision,
    humanIdentityReview: attempt.human_identity_review,
    identitySourceConfidence: resolveIdentitySourceConfidence({
      identityDecision: attempt.identity_decision,
      humanIdentityReview: attempt.human_identity_review,
      assetApproved,
    }),
    angleDirection: attempt.angle_direction,
  };
}
