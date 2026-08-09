/**
 * Phase 2.3D.4 — Reassign a Stage B supporting reference to the correct angle slot.
 * No regeneration. No provider calls. Preserves paid asset bytes and history.
 */

import { PersonaDomainError } from "@/lib/persona/domain/errors";
import type { WorkspaceScope } from "@/lib/persona/domain/types";
import { isMasterIdentityReference } from "@/lib/persona/creation/master-identity-reference";
import { getPersonaRepository } from "@/lib/persona/repositories/factory";
import {
  assertSlotMayBeRegenerated,
  resolveReferencePackageSlotCoverage,
} from "./coverage";
import {
  getReferencePackageRepository,
  type ReferencePackageRepository,
} from "./repository";
import {
  isReferencePackageSlot,
  slotToReferenceMeta,
  type ReferencePackageSlot,
} from "./slots";
import {
  buildReferencePackageAssetNotes,
  getAttemptEffectiveSlot,
  parseReferencePackageAssetNotes,
  type ReferencePackageAttempt,
} from "./types";

export type ReassignReferencePackageAngleDeps = {
  repo?: ReferencePackageRepository;
};

function pkgRepo(deps?: ReassignReferencePackageAngleDeps) {
  return deps?.repo ?? getReferencePackageRepository();
}

function personaRepo() {
  return getPersonaRepository();
}

export const TARGET_SLOT_ACCEPTED_MESSAGE =
  "Target slot already has an accepted reference." as const;

/**
 * Reassign a generated supporting reference to another camera-angle slot.
 * Does NOT call any image provider. Does NOT auto-approve.
 */
export async function reassignReferencePackageAngle(
  scope: WorkspaceScope,
  personaId: string,
  input: {
    assetId: string;
    targetSlot: string;
  },
  deps?: ReassignReferencePackageAngleDeps,
): Promise<{
  providerCalled: false;
  assetId: string;
  storagePath: string;
  providerRequestId: string | null;
  costEur: number | null;
  requestedSlot: ReferencePackageSlot;
  effectiveSlot: ReferencePackageSlot;
  reassignedFrom: ReferencePackageSlot;
  attempt: ReferencePackageAttempt;
  autoApproved: false;
  identityDecision: ReferencePackageAttempt["identity_decision"];
}> {
  if (!isReferencePackageSlot(input.targetSlot)) {
    throw new PersonaDomainError("Unknown reference package slot", "VALIDATION", {
      slot: input.targetSlot,
    });
  }
  const targetSlot = input.targetSlot;

  const persona = await personaRepo().getPersona(scope, personaId);
  if (!persona) {
    throw new PersonaDomainError("Persona not found", "NOT_FOUND", { personaId });
  }
  if (persona.identity_lock_status === "approved") {
    throw new PersonaDomainError(
      "Cannot reassign angles after Identity Lock is approved.",
      "WORKFLOW",
      { personaId },
    );
  }

  const asset = await personaRepo().getReferenceAsset(scope, input.assetId);
  if (!asset || asset.persona_id !== personaId) {
    throw new PersonaDomainError("Reference asset not found", "NOT_FOUND", {
      assetId: input.assetId,
    });
  }
  if (isMasterIdentityReference(asset)) {
    throw new PersonaDomainError(
      "Master Identity Reference cannot be reassigned.",
      "WORKFLOW",
      { assetId: asset.id },
    );
  }

  const notesMeta = parseReferencePackageAssetNotes(asset.notes);
  if (!notesMeta) {
    throw new PersonaDomainError(
      "Only Stage B generated supporting references can be reassigned.",
      "WORKFLOW",
      { assetId: asset.id },
    );
  }

  const repo = pkgRepo(deps);
  const attempts = await repo.listAttemptsForPersona(scope, personaId);
  const attempt =
    attempts.find((a) => a.generated_asset_id === asset.id) ??
    (notesMeta.attempt_id
      ? attempts.find((a) => a.id === notesMeta.attempt_id)
      : undefined);
  if (!attempt) {
    throw new PersonaDomainError(
      "No Stage B generation attempt found for this asset.",
      "NOT_FOUND",
      { assetId: asset.id },
    );
  }

  const requestedSlot = attempt.reference_slot;
  const currentEffective = getAttemptEffectiveSlot(attempt);
  if (currentEffective === targetSlot) {
    throw new PersonaDomainError(
      "Asset is already assigned to this angle slot.",
      "WORKFLOW",
      { slot: targetSlot },
    );
  }

  const assets = await personaRepo().listReferenceAssets(scope, personaId);
  const coverage = resolveReferencePackageSlotCoverage({ attempts, assets });
  try {
    assertSlotMayBeRegenerated(coverage, targetSlot);
  } catch {
    throw new PersonaDomainError(TARGET_SLOT_ACCEPTED_MESSAGE, "WORKFLOW", {
      slot: targetSlot,
    });
  }

  const now = new Date().toISOString();
  const actor = scope.actorId ?? "user";

  const identityDecision = attempt.identity_decision;

  const nextAttemptStatus: ReferencePackageAttempt["status"] =
    identityDecision === "identity_mismatch"
      ? "mismatch"
      : attempt.status === "failed"
        ? "failed"
        : "review";

  const updatedAttempt = await repo.updateAttempt(scope, attempt.id, {
    effective_slot: targetSlot,
    reassigned_from: currentEffective,
    reassigned_at: now,
    reassigned_by: actor,
    angle_review_source: "user",
    angle_review_decision: "confirmed",
    status: nextAttemptStatus,
  });

  const meta = slotToReferenceMeta(targetSlot);
  const nextNotes = buildReferencePackageAssetNotes({
    slot: targetSlot,
    attemptId: attempt.id,
    masterReferenceId: attempt.master_reference_id,
    identityDecision: identityDecision ?? "evaluation_failed",
    angleDirection: attempt.angle_direction,
    requestedSlot,
    effectiveSlot: targetSlot,
    reassignedFrom: currentEffective,
    reassignedAt: now,
    reassignedBy: actor,
    angleReviewSource: "user",
    angleReviewDecision: "confirmed",
  });

  // Never auto-approve — demote prior approval/rejection to review for new slot.
  const nextStatus =
    identityDecision === "identity_mismatch" && asset.status === "rejected"
      ? ("rejected" as const)
      : ("review" as const);

  await personaRepo().updateReferenceAsset(scope, asset.id, {
    view_angle: meta.view_angle,
    asset_type: meta.asset_type,
    framing: meta.framing,
    notes: nextNotes,
    status: nextStatus,
    is_primary: false,
  });

  const refreshedAsset = await personaRepo().getReferenceAsset(scope, asset.id);
  if (!refreshedAsset) {
    throw new PersonaDomainError("Asset vanished after reassignment", "NOT_FOUND");
  }
  if (refreshedAsset.storage_path !== asset.storage_path) {
    throw new PersonaDomainError(
      "Reassignment must not alter storage path.",
      "WORKFLOW",
    );
  }
  if (refreshedAsset.status === "approved") {
    throw new PersonaDomainError(
      "Reassignment must never auto-approve.",
      "WORKFLOW",
    );
  }
  if (updatedAttempt.reference_slot !== requestedSlot) {
    throw new PersonaDomainError(
      "Requested slot must remain historically immutable.",
      "WORKFLOW",
    );
  }

  return {
    providerCalled: false,
    assetId: asset.id,
    storagePath: asset.storage_path,
    providerRequestId: attempt.provider_request_id,
    costEur: attempt.cost_eur,
    requestedSlot,
    effectiveSlot: targetSlot,
    reassignedFrom: currentEffective,
    attempt: updatedAttempt,
    autoApproved: false,
    identityDecision,
  };
}
