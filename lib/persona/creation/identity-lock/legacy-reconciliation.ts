/** Read-only diagnostics for review provenance on legacy Identity Locks. */

import { PersonaDomainError } from "@/lib/persona/domain/errors";
import type { WorkspaceScope } from "@/lib/persona/domain/types";
import { getPersonaRepository } from "@/lib/persona/repositories/factory";
import { getCreationRepository } from "../creation-factory";
import { getIdentityLockRepository } from "./repository";
import {
  evaluateIdentityReviewQualityGate,
  selectLatestIdentityReview,
} from "./identity-review-quality-gate";

export type LegacyIdentityLockReconciliationStatus =
  | "not_locked"
  | "missing_snapshot"
  | "linked_review_valid"
  | "linked_review_invalid"
  | "legacy_review_candidate_requires_human_reconciliation"
  | "legacy_review_missing_requires_human_reconciliation";

export type LegacyIdentityLockReconciliationDiagnostic = {
  workspaceId: string;
  personaId: string;
  lockVersion: number | null;
  snapshotId: string | null;
  status: LegacyIdentityLockReconciliationStatus;
  linkedReviewId: string | null;
  candidateReviewId: string | null;
  downstreamEligibleFromSnapshot: boolean;
  requiresHumanReconciliation: boolean;
  reasons: string[];
};

/**
 * Never writes, backfills, unlocks, re-locks, or changes approvals. A review
 * that merely predates a legacy lock is reported only as a candidate; it is not
 * fabricated into authoritative lock provenance.
 */
export async function diagnoseLegacyIdentityLockReconciliation(
  scope: WorkspaceScope,
  personaId: string,
): Promise<LegacyIdentityLockReconciliationDiagnostic> {
  const persona = await getPersonaRepository().getPersona(scope, personaId);
  if (!persona) {
    throw new PersonaDomainError("Persona not found", "NOT_FOUND", {
      personaId,
      workspaceId: scope.workspaceId,
    });
  }

  const locked =
    persona.identity_lock_status === "approved" &&
    persona.identity_lock_version > 0 &&
    Boolean(persona.identity_locked_at);
  if (!locked) {
    return {
      workspaceId: scope.workspaceId,
      personaId,
      lockVersion: null,
      snapshotId: null,
      status: "not_locked",
      linkedReviewId: null,
      candidateReviewId: null,
      downstreamEligibleFromSnapshot: false,
      requiresHumanReconciliation: false,
      reasons: ["Persona identity is not locked"],
    };
  }

  const snapshot = await getIdentityLockRepository().getLatestSnapshotForPersona(
    scope,
    personaId,
  );
  if (!snapshot) {
    return {
      workspaceId: scope.workspaceId,
      personaId,
      lockVersion: persona.identity_lock_version,
      snapshotId: null,
      status: "missing_snapshot",
      linkedReviewId: null,
      candidateReviewId: null,
      downstreamEligibleFromSnapshot: false,
      requiresHumanReconciliation: true,
      reasons: ["Locked Persona has no durable Identity Lock snapshot"],
    };
  }

  const reviews = await getCreationRepository().listIdentityReviews(
    scope,
    personaId,
  );
  if (snapshot.identity_review_id) {
    const review =
      reviews.find((item) => item.id === snapshot.identity_review_id) ?? null;
    const gate = evaluateIdentityReviewQualityGate(review);
    const valid =
      gate.identityLockPassed &&
      Boolean(review?.reviewed_at) &&
      review?.reviewed_at === snapshot.identity_reviewed_at;
    return {
      workspaceId: scope.workspaceId,
      personaId,
      lockVersion: snapshot.identity_lock_version,
      snapshotId: snapshot.id,
      status: valid ? "linked_review_valid" : "linked_review_invalid",
      linkedReviewId: snapshot.identity_review_id,
      candidateReviewId: null,
      downstreamEligibleFromSnapshot: valid,
      requiresHumanReconciliation: !valid,
      reasons: valid
        ? []
        : [
            ...gate.blockingReasons,
            ...(review?.reviewed_at !== snapshot.identity_reviewed_at
              ? ["Snapshot review timestamp does not match the linked review"]
              : []),
          ],
    };
  }

  const candidate = selectLatestIdentityReview(reviews, snapshot.identity_locked_at);
  const candidateGate = evaluateIdentityReviewQualityGate(candidate);
  const candidateValid = candidateGate.identityLockPassed && Boolean(candidate?.reviewed_at);
  return {
    workspaceId: scope.workspaceId,
    personaId,
    lockVersion: snapshot.identity_lock_version,
    snapshotId: snapshot.id,
    status: candidateValid
      ? "legacy_review_candidate_requires_human_reconciliation"
      : "legacy_review_missing_requires_human_reconciliation",
    linkedReviewId: null,
    candidateReviewId: candidateValid ? candidate!.id : null,
    downstreamEligibleFromSnapshot: false,
    requiresHumanReconciliation: true,
    reasons: [
      "Identity Lock snapshot does not record the exact review used at lock time",
      ...(!candidateValid ? candidateGate.blockingReasons : []),
    ],
  };
}
