import { PersonaDomainError } from "@/lib/persona/domain/errors";
import type { Persona, WorkspaceScope } from "@/lib/persona/domain/types";
import { getPersonaRepository } from "@/lib/persona/repositories/factory";
import { coerceUuidOrNull } from "../identity-lock/identity-lock-service";
import { resolveLockedBrandIdentity } from "../identity-lock";
import { getReferenceRightsView } from "../reference-rights";
import {
  VIDEO_IDENTITY_REVIEW_KEYS,
  VIDEO_IDENTITY_REVIEW_VERSION,
  videoIdentityReviewEvidenceSchema,
  type SubmitVideoIdentityReviewInput,
  type VideoIdentityReadinessView,
  type VideoIdentityReviewEvidence,
} from "./types";
import { getVideoIdentityReviewRepository } from "./repository";
import {
  isCurrentVideoIdentityReady,
  isCurrentVideoUseApproved,
} from "./authority";

function requireAuthenticatedOwner(scope: WorkspaceScope): string {
  const actor = coerceUuidOrNull(scope.actorId);
  if (!actor) {
    throw new PersonaDomainError(
      "Für die Video-Identitätsprüfung ist ein authentifizierter Eigentümer erforderlich.",
      "AUTHENTICATION_REQUIRED",
    );
  }
  return actor;
}

async function loadContext(scope: WorkspaceScope, personaId: string) {
  const persona = await getPersonaRepository().getPersona(scope, personaId);
  if (!persona) {
    throw new PersonaDomainError("Persona not found", "NOT_FOUND", { personaId });
  }
  const lockedIdentity = await resolveLockedBrandIdentity(scope, personaId);
  if (!lockedIdentity) {
    throw new PersonaDomainError(
      "Vor der Video-Identitätsprüfung ist ein gültiger aktueller Identity Lock erforderlich.",
      "WORKFLOW",
      { personaId },
    );
  }
  const uniqueAssets = new Set([
    lockedIdentity.masterReference.id,
    ...lockedIdentity.canonicalReferences.map((entry) => entry.reference.id),
  ]);
  const requiredSlots = new Set([
    "front",
    "three_quarter_left",
    "three_quarter_right",
    "left_profile",
    "right_profile",
  ]);
  const slots = new Set(lockedIdentity.canonicalReferences.map((entry) => entry.slot));
  const referencePackageSufficientForV1 =
    lockedIdentity.canonicalReferences.length === 5 &&
    uniqueAssets.size === 6 &&
    [...requiredSlots].every((slot) => slots.has(slot as never));
  const referenceRightsConfirmed = [
    lockedIdentity.masterReference,
    ...lockedIdentity.canonicalReferences.map((entry) => entry.reference),
  ].every((reference) => reference.rights_confirmed);
  return {
    persona,
    lockedIdentity,
    referencePackageSufficientForV1,
    referenceRightsConfirmed,
  };
}

function reviewMatchesCurrentLock(
  review: VideoIdentityReviewEvidence,
  context: Awaited<ReturnType<typeof loadContext>>,
): boolean {
  const locked = context.lockedIdentity;
  return (
    review.personaId === context.persona.id &&
    review.identityLockSnapshotId === locked.identityLockSnapshotId &&
    review.identityLockVersion === locked.lockVersion &&
    review.identityFingerprint === locked.identityFingerprint &&
    review.referencePackageFingerprint === locked.referencePackageFingerprint &&
    review.masterReferenceAssetId === locked.masterReference.id &&
    review.canonicalReferenceAssetIds.length === 5 &&
    review.canonicalReferenceAssetIds.every(
      (id, index) => id === locked.canonicalReferences[index]?.reference.id,
    )
  );
}

export async function getVideoIdentityReadinessView(
  scope: WorkspaceScope,
  personaId: string,
): Promise<VideoIdentityReadinessView> {
  const context = await loadContext(scope, personaId);
  const reviews = await getVideoIdentityReviewRepository().listForPersona(
    scope,
    personaId,
  );
  const currentReview = reviews.find((review) =>
    reviewMatchesCurrentLock(review, context),
  ) ?? null;
  const rightsView = await getReferenceRightsView(scope, personaId);
  const exactRightsEvidence = Boolean(rightsView.exactAuditedConfirmation);
  const blockers: string[] = [];
  if (!context.referencePackageSufficientForV1) {
    blockers.push("Master-Referenz und fünf kanonische Blickwinkel sind unvollständig.");
  }
  if (!context.referenceRightsConfirmed || !exactRightsEvidence) {
    blockers.push("Die Referenzrechte für den aktuellen Identity Lock sind nicht bestätigt.");
  }
  if (context.persona.identity_lock_status === "needs_revision") {
    blockers.push("Die Identität muss zuerst überarbeitet werden.");
  }
  return {
    personaId,
    personaName: context.persona.name,
    identityLockSnapshotId: context.lockedIdentity.identityLockSnapshotId,
    identityLockVersion: context.lockedIdentity.lockVersion,
    identityFingerprint: context.lockedIdentity.identityFingerprint,
    referencePackageFingerprint:
      context.lockedIdentity.referencePackageFingerprint,
    masterReferenceAssetId: context.lockedIdentity.masterReference.id,
    canonicalReferences: context.lockedIdentity.canonicalReferences.map((entry) => ({
      assetId: entry.reference.id,
      role: entry.slot,
      rightsConfirmed: entry.reference.rights_confirmed,
    })),
    referenceRightsConfirmed:
      context.referenceRightsConfirmed && exactRightsEvidence,
    referencePackageSufficientForV1:
      context.referencePackageSufficientForV1,
    videoIdentityReady: isCurrentVideoIdentityReady(
      context.persona,
      context.lockedIdentity,
    ),
    videoUseApproved: isCurrentVideoUseApproved(
      context.persona,
      context.lockedIdentity,
    ),
    currentReview,
    canReview: blockers.length === 0,
    blockers,
    providerCalled: false,
  };
}

function assertExpectedLock(
  input: SubmitVideoIdentityReviewInput,
  context: Awaited<ReturnType<typeof loadContext>>,
) {
  const locked = context.lockedIdentity;
  if (
    input.expectedIdentityLockSnapshotId !== locked.identityLockSnapshotId ||
    input.expectedIdentityLockVersion !== locked.lockVersion ||
    input.expectedIdentityFingerprint !== locked.identityFingerprint ||
    input.expectedReferencePackageFingerprint !== locked.referencePackageFingerprint
  ) {
    throw new PersonaDomainError(
      "Der Identity Lock oder das Referenzpaket hat sich seit Öffnen der Prüfung geändert.",
      "BRAND_MODEL_VERSION_MISMATCH",
      { personaId: context.persona.id },
    );
  }
}

function sameEvidence(
  existing: VideoIdentityReviewEvidence,
  expected: Omit<VideoIdentityReviewEvidence, "createdAt">,
) {
  const { createdAt: _createdAt, ...existingComparable } = existing;
  void _createdAt;
  return JSON.stringify(existingComparable) === JSON.stringify(expected);
}

export async function submitVideoIdentityReview(
  scope: WorkspaceScope,
  personaId: string,
  input: SubmitVideoIdentityReviewInput,
): Promise<{ persona: Persona; review: VideoIdentityReviewEvidence; providerCalled: false }> {
  const reviewerId = requireAuthenticatedOwner(scope);
  const context = await loadContext(scope, personaId);
  assertExpectedLock(input, context);
  const rightsView = await getReferenceRightsView(scope, personaId);
  if (
    !context.referencePackageSufficientForV1 ||
    !context.referenceRightsConfirmed ||
    !rightsView.exactAuditedConfirmation
  ) {
    throw new PersonaDomainError(
      "Video-Identitätsprüfung blockiert: Referenzpaket oder Referenzrechte sind nicht vollständig bestätigt.",
      "WORKFLOW",
    );
  }
  const checklistPassed = VIDEO_IDENTITY_REVIEW_KEYS.every(
    (key) => input.checklist[key] === true,
  );
  if (input.decision === "APPROVE" && !checklistPassed) {
    throw new PersonaDomainError(
      "Alle Prüfpunkte müssen bestätigt sein, bevor die Video-Identität bereit ist.",
      "WORKFLOW",
    );
  }
  const repository = getVideoIdentityReviewRepository();
  const existing = await repository.getByOperationId(scope, input.operationId);
  const reviewedAt = existing?.reviewedAt ?? new Date().toISOString();
  const evidence = videoIdentityReviewEvidenceSchema.parse({
    evidenceVersion: VIDEO_IDENTITY_REVIEW_VERSION,
    operationId: input.operationId,
    workspaceId: scope.workspaceId,
    personaId,
    identityLockSnapshotId: context.lockedIdentity.identityLockSnapshotId,
    identityLockVersion: context.lockedIdentity.lockVersion,
    identityFingerprint: context.lockedIdentity.identityFingerprint,
    referencePackageFingerprint:
      context.lockedIdentity.referencePackageFingerprint,
    masterReferenceAssetId: context.lockedIdentity.masterReference.id,
    canonicalReferenceAssetIds: context.lockedIdentity.canonicalReferences.map(
      (entry) => entry.reference.id,
    ),
    reviewerId,
    reviewedAt,
    checklist: input.checklist,
    decision: input.decision,
    note: input.note?.trim() || null,
  });
  if (existing && !sameEvidence(existing, evidence)) {
    throw new PersonaDomainError(
      "Diese Prüfungs-ID gehört bereits zu einer anderen Entscheidung.",
      "WORKFLOW",
    );
  }
  // Production repository applies the immutable review event and current
  // Persona authority projection in one database transaction. Memory tests
  // exercise the same decision semantics without a database RPC.
  const review = await repository.create(scope, evidence);
  const approved = review.decision === "APPROVE";
  const isIdempotentCurrentReview =
    existing != null &&
    context.persona.video_identity_review_id === existing.operationId &&
    isCurrentVideoIdentityReady(context.persona, context.lockedIdentity);
  const clearUseApproval = {
    video_use_approved: false,
    video_use_approved_at: null,
    video_use_approved_by: null,
    video_use_approval_review_id: null,
    video_use_approval_lock_snapshot_id: null,
    video_use_approval_lock_version: null,
    video_use_approval_identity_fingerprint: null,
    video_use_approval_reference_package_fingerprint: null,
  } as const;
  const patch = approved
    ? {
        video_identity_ready: true,
        video_identity_review_id: review.operationId,
        video_identity_ready_at: review.reviewedAt,
        video_identity_ready_by: reviewerId,
        video_identity_ready_lock_snapshot_id:
          context.lockedIdentity.identityLockSnapshotId,
        video_identity_ready_lock_version: context.lockedIdentity.lockVersion,
        video_identity_ready_identity_fingerprint:
          context.lockedIdentity.identityFingerprint,
        video_identity_ready_reference_package_fingerprint:
          context.lockedIdentity.referencePackageFingerprint,
        // A genuinely new review is a new authority decision. Retrying the
        // same operation must not revoke a later explicit use approval.
        ...(!isIdempotentCurrentReview ? clearUseApproval : {}),
      }
    : {
        video_identity_ready: false,
        video_identity_review_id: review.operationId,
        video_identity_ready_at: null,
        video_identity_ready_by: null,
        video_identity_ready_lock_snapshot_id: null,
        video_identity_ready_lock_version: null,
        video_identity_ready_identity_fingerprint: null,
        video_identity_ready_reference_package_fingerprint: null,
        ...clearUseApproval,
      };
  const persona =
    repository.kind === "supabase"
      ? await getPersonaRepository().getPersona(scope, personaId)
      : await getPersonaRepository().updatePersona(scope, personaId, patch);
  if (!persona) {
    throw new PersonaDomainError("Persona not found after Video review", "NOT_FOUND");
  }
  return { persona, review, providerCalled: false };
}
