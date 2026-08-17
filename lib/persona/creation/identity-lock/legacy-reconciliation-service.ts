/**
 * Human recovery for immutable legacy locks that predate persisted review
 * provenance. This service never rewrites the historical snapshot. An accepted
 * review creates a new lock version over the exact same durable identity
 * package; a rejected review records the decision and leaves authority closed.
 */

import { randomUUID } from "node:crypto";
import { logPersonaAuditEvent } from "@/lib/persona/audit/persona-events";
import { getCreationRepository } from "@/lib/persona/creation/creation-factory";
import {
  IDENTITY_REVIEW_CHECK_KEYS,
  type IdentityReviewChecklist,
  type PersonaIdentityReview,
} from "@/lib/persona/domain/creation-types";
import { PersonaDomainError } from "@/lib/persona/domain/errors";
import type { Persona, WorkspaceScope } from "@/lib/persona/domain/types";
import { getPersonaRepository } from "@/lib/persona/repositories/factory";
import {
  findMasterIdentityReference,
  getMasterIdentityReferenceForPersona,
} from "../master-identity-reference";
import { getReferencePackageRepository } from "../reference-package/repository";
import { reconcileReferencePackageState } from "../reference-package/reconcile-reference-package-state";
import type { ReferencePackageSlot } from "../reference-package/slots";
import { REFERENCE_PACKAGE_SLOTS } from "../reference-package/slots";
import { computeReferencePackageFingerprint } from "./fingerprint";
import { evaluateIdentityReviewQualityGate } from "./identity-review-quality-gate";
import { diagnoseLegacyIdentityLockReconciliation } from "./legacy-reconciliation";
import { validateIdentityPackageEvidence } from "./pre-lock-validation";
import { getIdentityLockRepository } from "./repository";
import {
  IDENTITY_LOCK_POLICY_VERSION,
  type LockedCanonicalReferenceSnapshot,
  type PersonaIdentityLockSnapshot,
} from "./types";
import { coerceUuidOrNull } from "./uuid";
import { countProvenance } from "./provenance";

export const LEGACY_RECONCILIATION_REVIEW_KIND =
  "legacy_identity_reconciliation" as const;
export const LEGACY_RECONCILIATION_REASON =
  "missing_historical_identity_review_provenance" as const;
export const LEGACY_RECONCILIATION_CONTEXT_KEY =
  "__nexhq_legacy_reconciliation" as const;

export type LegacyReconciliationDecision = "approved" | "rejected";

export type LegacyReconciliationConfirmations = {
  masterIdentityReferenceCorrect: boolean;
  requiredReferenceCoverageReviewed: boolean;
  samePersonAcrossReferences: boolean;
  noObviousIdentityMismatch: boolean;
  acceptableForImageUse: boolean;
  remainOfficialBrandModelIdentity: boolean;
};

export type LegacyReconciliationReviewContext = {
  kind: typeof LEGACY_RECONCILIATION_REVIEW_KIND;
  reason: typeof LEGACY_RECONCILIATION_REASON;
  decision: LegacyReconciliationDecision;
  operationId: string;
  sourceIdentityLockSnapshotId: string;
  sourceIdentityLockVersion: number;
  sourceReferencePackageFingerprint: string;
  reviewedMasterReferenceAssetId: string;
  reviewedCanonicalReferenceAssetIds: string[];
  packageMatchedHistoricalSnapshot: true;
  confirmations: LegacyReconciliationConfirmations;
};

type LegacyReconciliationChecklist = IdentityReviewChecklist & {
  [LEGACY_RECONCILIATION_CONTEXT_KEY]: LegacyReconciliationReviewContext;
};

export type LegacyIdentityReconciliationView = {
  personaId: string;
  personaName: string;
  requiresHumanReconciliation: boolean;
  status: string;
  sourceSnapshot: {
    id: string;
    lockVersion: number;
    lockedAt: string;
    masterReferenceAssetId: string;
    canonicalReferences: LockedCanonicalReferenceSnapshot[];
    referencePackageFingerprint: string;
  } | null;
  currentPackage: {
    masterReferenceAssetId: string | null;
    canonicalReferences: LockedCanonicalReferenceSnapshot[];
    coverage: { accepted: number; required: number };
    referencePackageReady: boolean;
    packageMatchesHistoricalSnapshot: boolean;
  };
  currentApprovals: {
    imageUseApproved: boolean;
    videoUseApproved: boolean;
    brandCastApproved: boolean;
  };
  canReconcile: boolean;
  blockingReasons: string[];
  providerCalled: false;
};

export type SubmitLegacyIdentityReconciliationInput = {
  operationId: string;
  expectedSnapshotId: string;
  expectedLockVersion: number;
  decision: LegacyReconciliationDecision;
  acknowledgeHistoricalProvenanceMissing: true;
  checklist: IdentityReviewChecklist;
  confirmations: LegacyReconciliationConfirmations;
  reviewerNotes?: string;
};

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

export function readLegacyReconciliationReviewContext(
  review: PersonaIdentityReview,
): LegacyReconciliationReviewContext | null {
  const value = (review.checklist as unknown as Record<string, unknown>)[
    LEGACY_RECONCILIATION_CONTEXT_KEY
  ];
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const confirmations = row.confirmations;
  if (!confirmations || typeof confirmations !== "object") return null;
  const c = confirmations as Record<string, unknown>;
  if (
    row.kind !== LEGACY_RECONCILIATION_REVIEW_KIND ||
    row.reason !== LEGACY_RECONCILIATION_REASON ||
    (row.decision !== "approved" && row.decision !== "rejected") ||
    typeof row.operationId !== "string" ||
    typeof row.sourceIdentityLockSnapshotId !== "string" ||
    typeof row.sourceIdentityLockVersion !== "number" ||
    typeof row.sourceReferencePackageFingerprint !== "string" ||
    typeof row.reviewedMasterReferenceAssetId !== "string" ||
    !isStringArray(row.reviewedCanonicalReferenceAssetIds) ||
    row.packageMatchedHistoricalSnapshot !== true ||
    typeof c.masterIdentityReferenceCorrect !== "boolean" ||
    typeof c.requiredReferenceCoverageReviewed !== "boolean" ||
    typeof c.samePersonAcrossReferences !== "boolean" ||
    typeof c.noObviousIdentityMismatch !== "boolean" ||
    typeof c.acceptableForImageUse !== "boolean" ||
    typeof c.remainOfficialBrandModelIdentity !== "boolean"
  ) {
    return null;
  }
  return value as LegacyReconciliationReviewContext;
}

function sameCanonicalPackage(
  current: readonly LockedCanonicalReferenceSnapshot[],
  historical: readonly LockedCanonicalReferenceSnapshot[],
): boolean {
  if (current.length !== REFERENCE_PACKAGE_SLOTS.length) return false;
  if (historical.length !== REFERENCE_PACKAGE_SLOTS.length) return false;
  return REFERENCE_PACKAGE_SLOTS.every((slot) => {
    const a = current.find((item) => item.slot === slot);
    const b = historical.find((item) => item.slot === slot);
    return Boolean(
      a &&
        b &&
        a.assetId === b.assetId &&
        a.checksum === b.checksum &&
        a.provenance === b.provenance &&
        a.identitySourceConfidence === b.identitySourceConfidence &&
        a.referenceProvenance === b.referenceProvenance &&
        a.effectiveSlot === b.effectiveSlot,
    );
  });
}

async function loadReconciliationContext(scope: WorkspaceScope, personaId: string) {
  const persona = await getPersonaRepository().getPersona(scope, personaId);
  if (!persona) {
    throw new PersonaDomainError("Persona not found", "NOT_FOUND", {
      personaId,
      workspaceId: scope.workspaceId,
    });
  }
  const [snapshot, attempts, assets, masterBundle, reviews, diagnostic] =
    await Promise.all([
      getIdentityLockRepository().getLatestSnapshotForPersona(scope, personaId),
      getReferencePackageRepository().listAttemptsForPersona(scope, personaId),
      getPersonaRepository().listReferenceAssets(scope, personaId),
      getMasterIdentityReferenceForPersona(scope, personaId),
      getCreationRepository().listIdentityReviews(scope, personaId),
      diagnoseLegacyIdentityLockReconciliation(scope, personaId),
    ]);
  const master = masterBundle?.reference ?? findMasterIdentityReference(assets);
  const reconciled = reconcileReferencePackageState({ attempts, assets });
  const evidence = validateIdentityPackageEvidence({ reconciled, master, assets });
  const packageMatchesHistoricalSnapshot = Boolean(
    snapshot &&
      master &&
      master.id === snapshot.master_reference_asset_id &&
      master.checksum === snapshot.master_checksum &&
      reconciled.reconcilerVersion === snapshot.reference_package_version &&
      sameCanonicalPackage(
        evidence.canonicalReferences,
        snapshot.canonical_references,
      ),
  );
  return {
    persona,
    snapshot,
    reviews,
    master,
    reconciled,
    evidence,
    diagnostic,
    packageMatchesHistoricalSnapshot,
  };
}

function reconciliationBlockingReasons(
  ctx: Awaited<ReturnType<typeof loadReconciliationContext>>,
): string[] {
  const reasons = [...ctx.evidence.blockingReasons];
  if (!ctx.snapshot) reasons.push("Historical Identity Lock snapshot is missing");
  if (
    ctx.snapshot &&
    ctx.snapshot.identity_lock_version !== ctx.persona.identity_lock_version
  ) {
    reasons.push("Persona does not point to the latest Identity Lock version");
  }
  if (!ctx.diagnostic.requiresHumanReconciliation) {
    reasons.push("Identity Lock does not require legacy reconciliation");
  }
  if (ctx.snapshot && !ctx.packageMatchesHistoricalSnapshot) {
    reasons.push(
      "Current Master or Reference Package differs from the historical lock; use a supported Identity Revision instead",
    );
  }
  return [...new Set(reasons)];
}

export async function getLegacyIdentityReconciliationView(
  scope: WorkspaceScope,
  personaId: string,
): Promise<LegacyIdentityReconciliationView> {
  const ctx = await loadReconciliationContext(scope, personaId);
  const blockingReasons = reconciliationBlockingReasons(ctx);
  return {
    personaId: ctx.persona.id,
    personaName: ctx.persona.name,
    requiresHumanReconciliation: ctx.diagnostic.requiresHumanReconciliation,
    status: ctx.diagnostic.status,
    sourceSnapshot: ctx.snapshot
      ? {
          id: ctx.snapshot.id,
          lockVersion: ctx.snapshot.identity_lock_version,
          lockedAt: ctx.snapshot.identity_locked_at,
          masterReferenceAssetId: ctx.snapshot.master_reference_asset_id,
          canonicalReferences: ctx.snapshot.canonical_references,
          referencePackageFingerprint:
            ctx.snapshot.reference_package_fingerprint,
        }
      : null,
    currentPackage: {
      masterReferenceAssetId: ctx.evidence.masterReferenceId,
      canonicalReferences: ctx.evidence.canonicalReferences,
      coverage: ctx.evidence.coverage,
      referencePackageReady: ctx.evidence.referencePackageReady,
      packageMatchesHistoricalSnapshot: ctx.packageMatchesHistoricalSnapshot,
    },
    currentApprovals: {
      imageUseApproved: ctx.persona.image_use_approved,
      videoUseApproved: ctx.persona.video_use_approved,
      brandCastApproved: Boolean(ctx.persona.brand_cast_approved),
    },
    canReconcile:
      ctx.diagnostic.requiresHumanReconciliation &&
      Boolean(ctx.snapshot) &&
      blockingReasons.length === 0,
    blockingReasons,
    providerCalled: false,
  };
}

function assertExpectedSource(
  snapshot: PersonaIdentityLockSnapshot | null,
  input: SubmitLegacyIdentityReconciliationInput,
): asserts snapshot is PersonaIdentityLockSnapshot {
  if (!snapshot) {
    throw new PersonaDomainError(
      "Historical Identity Lock snapshot is missing.",
      "WORKFLOW",
    );
  }
  if (
    snapshot.id !== input.expectedSnapshotId ||
    snapshot.identity_lock_version !== input.expectedLockVersion
  ) {
    throw new PersonaDomainError(
      "Identity Lock changed after the reconciliation view was opened. Review the current package again.",
      "WORKFLOW",
      {
        expectedSnapshotId: input.expectedSnapshotId,
        expectedLockVersion: input.expectedLockVersion,
        actualSnapshotId: snapshot.id,
        actualLockVersion: snapshot.identity_lock_version,
      },
    );
  }
}

function buildStoredChecklist(
  input: SubmitLegacyIdentityReconciliationInput,
  snapshot: PersonaIdentityLockSnapshot,
  canonicalReferences: readonly LockedCanonicalReferenceSnapshot[],
): LegacyReconciliationChecklist {
  return {
    ...input.checklist,
    [LEGACY_RECONCILIATION_CONTEXT_KEY]: {
      kind: LEGACY_RECONCILIATION_REVIEW_KIND,
      reason: LEGACY_RECONCILIATION_REASON,
      decision: input.decision,
      operationId: input.operationId,
      sourceIdentityLockSnapshotId: snapshot.id,
      sourceIdentityLockVersion: snapshot.identity_lock_version,
      sourceReferencePackageFingerprint:
        snapshot.reference_package_fingerprint,
      reviewedMasterReferenceAssetId: snapshot.master_reference_asset_id,
      reviewedCanonicalReferenceAssetIds: canonicalReferences.map(
        (reference) => reference.assetId,
      ),
      packageMatchedHistoricalSnapshot: true,
      confirmations: input.confirmations,
    },
  };
}

function requireApprovedHumanDecision(
  input: SubmitLegacyIdentityReconciliationInput,
): void {
  const missingConfirmations = Object.entries(input.confirmations)
    .filter(([, value]) => value !== true)
    .map(([key]) => key);
  if (missingConfirmations.length > 0) {
    throw new PersonaDomainError(
      "Every legacy reconciliation confirmation must be explicitly accepted.",
      "WORKFLOW",
      { missingConfirmations },
    );
  }
  const reviewGate = evaluateIdentityReviewQualityGate({
    id: "pending-reconciliation-review",
    workspace_id: "pending",
    persona_id: "pending",
    checklist: input.checklist,
    all_passed: IDENTITY_REVIEW_CHECK_KEYS.every(
      (key) => input.checklist[key] === true,
    ),
    reviewer_notes: input.reviewerNotes ?? "",
    reviewed_by: "pending",
    reviewed_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  if (!reviewGate.identityLockPassed || !reviewGate.imageIdentityReady) {
    throw new PersonaDomainError(
      reviewGate.blockingReasons[0] ??
        "Current identity review does not pass the Image identity gate.",
      "WORKFLOW",
      { blockingReasons: reviewGate.blockingReasons },
    );
  }
}

function slotIds(references: readonly LockedCanonicalReferenceSnapshot[]) {
  const bySlot = new Map(references.map((reference) => [reference.slot, reference.assetId]));
  const required = (slot: ReferencePackageSlot) => {
    const value = bySlot.get(slot);
    if (!value) {
      throw new PersonaDomainError(`${slot}: canonical asset missing`, "WORKFLOW");
    }
    return value;
  };
  return {
    front_asset_id: required("front"),
    three_quarter_left_asset_id: required("three_quarter_left"),
    three_quarter_right_asset_id: required("three_quarter_right"),
    left_profile_asset_id: required("left_profile"),
    right_profile_asset_id: required("right_profile"),
  };
}

async function writeReconciliationAudit(input: {
  scope: WorkspaceScope;
  personaId: string;
  review: PersonaIdentityReview;
  sourceSnapshot: PersonaIdentityLockSnapshot;
  newSnapshot?: PersonaIdentityLockSnapshot;
}) {
  await logPersonaAuditEvent({
    workspaceId: input.scope.workspaceId,
    eventType: "persona.legacy_identity_reconciliation_reviewed",
    recordId: input.personaId,
    actorId: input.scope.actorId,
    payload: {
      reviewKind: LEGACY_RECONCILIATION_REVIEW_KIND,
      reconciliationReason: LEGACY_RECONCILIATION_REASON,
      decision:
        readLegacyReconciliationReviewContext(input.review)?.decision ?? null,
      reviewId: input.review.id,
      reviewedAt: input.review.reviewed_at,
      reviewedBy: input.review.reviewed_by,
      sourceIdentityLockSnapshotId: input.sourceSnapshot.id,
      sourceIdentityLockVersion: input.sourceSnapshot.identity_lock_version,
      newIdentityLockSnapshotId: input.newSnapshot?.id ?? null,
      newIdentityLockVersion: input.newSnapshot?.identity_lock_version ?? null,
    },
  });
}

/**
 * Persists only the owner's present-tense decision. It never claims the new
 * review existed at the time of the historical lock.
 */
export async function submitLegacyIdentityReconciliation(
  scope: WorkspaceScope,
  personaId: string,
  input: SubmitLegacyIdentityReconciliationInput,
): Promise<{
  decision: LegacyReconciliationDecision;
  review: PersonaIdentityReview;
  persona: Persona;
  sourceSnapshot: PersonaIdentityLockSnapshot;
  newSnapshot: PersonaIdentityLockSnapshot | null;
  approvalsPreserved: true;
  providerCalled: false;
}> {
  const ctx = await loadReconciliationContext(scope, personaId);

  // A retry may arrive after the immutable vN+1 snapshot was inserted but
  // before the Persona pointer was updated. Recover only the exact operation,
  // actor, source snapshot and linked review; never adopt an unrelated lock.
  const retryReview = ctx.reviews.find((review) => {
    const meta = readLegacyReconciliationReviewContext(review);
    return meta?.operationId === input.operationId;
  });
  const retryMeta = retryReview
    ? readLegacyReconciliationReviewContext(retryReview)
    : null;
  if (
    input.decision === "approved" &&
    retryReview &&
    retryMeta?.decision === "approved" &&
    retryMeta.sourceIdentityLockSnapshotId === input.expectedSnapshotId &&
    retryMeta.sourceIdentityLockVersion === input.expectedLockVersion &&
    retryReview.reviewed_by === scope.actorId &&
    ctx.snapshot?.identity_lock_version === input.expectedLockVersion + 1 &&
    ctx.snapshot.identity_review_id === retryReview.id
  ) {
    const sourceSnapshot =
      await getIdentityLockRepository().getSnapshotByVersion(
        scope,
        personaId,
        input.expectedLockVersion,
      );
    assertExpectedSource(sourceSnapshot, input);
    const retryGate = evaluateIdentityReviewQualityGate(retryReview);
    if (!retryGate.identityLockPassed || !retryGate.imageIdentityReady) {
      throw new PersonaDomainError(
        "Persisted reconciliation review no longer passes the identity gate.",
        "WORKFLOW",
      );
    }
    const persona = await getPersonaRepository().updatePersona(scope, personaId, {
      identity_lock_status: "approved",
      identity_lock_version: ctx.snapshot.identity_lock_version,
      identity_locked_at: ctx.snapshot.identity_locked_at,
      image_identity_ready: retryGate.imageIdentityReady,
      video_identity_ready: retryGate.videoIdentityReady,
    });
    return {
      decision: "approved",
      review: retryReview,
      persona,
      sourceSnapshot,
      newSnapshot: ctx.snapshot,
      approvalsPreserved: true,
      providerCalled: false,
    };
  }

  assertExpectedSource(ctx.snapshot, input);

  const blockers = reconciliationBlockingReasons(ctx);
  if (blockers.length > 0) {
    throw new PersonaDomainError(blockers[0], "WORKFLOW", {
      blockingReasons: blockers,
    });
  }

  if (!scope.actorId) {
    throw new PersonaDomainError(
      "Authenticated owner actor is required for reconciliation.",
      "AUTHENTICATION_REQUIRED",
    );
  }

  if (input.decision === "approved") requireApprovedHumanDecision(input);
  if (input.decision === "rejected" && !input.reviewerNotes?.trim()) {
    throw new PersonaDomainError(
      "A rejection note is required.",
      "WORKFLOW",
    );
  }

  const existingReview = ctx.reviews.find((review) => {
    const meta = readLegacyReconciliationReviewContext(review);
    return meta?.operationId === input.operationId;
  });
  if (
    existingReview &&
    readLegacyReconciliationReviewContext(existingReview)?.decision !==
      input.decision
  ) {
    throw new PersonaDomainError(
      "This reconciliation operation ID was already used for another decision.",
      "WORKFLOW",
    );
  }

  const storedChecklist = buildStoredChecklist(
    input,
    ctx.snapshot,
    ctx.evidence.canonicalReferences,
  );
  const allPassed = IDENTITY_REVIEW_CHECK_KEYS.every(
    (key) => input.checklist[key] === true,
  );
  const review =
    existingReview ??
    (await getCreationRepository().createIdentityReview(scope, {
      persona_id: personaId,
      checklist: storedChecklist,
      all_passed: allPassed,
      reviewer_notes: input.reviewerNotes?.trim() ?? "",
      reviewed_by: scope.actorId,
      reviewed_at: new Date().toISOString(),
    }));

  if (input.decision === "rejected") {
    if (!existingReview) {
      await writeReconciliationAudit({
        scope,
        personaId,
        review,
        sourceSnapshot: ctx.snapshot,
      });
    }
    return {
      decision: "rejected",
      review,
      persona: ctx.persona,
      sourceSnapshot: ctx.snapshot,
      newSnapshot: null,
      approvalsPreserved: true,
      providerCalled: false,
    };
  }

  const reviewGate = evaluateIdentityReviewQualityGate(review);
  if (
    !reviewGate.identityLockPassed ||
    !reviewGate.imageIdentityReady ||
    !review.reviewed_at
  ) {
    throw new PersonaDomainError(
      reviewGate.blockingReasons[0] ??
        "Persisted reconciliation review does not pass the identity gate.",
      "WORKFLOW",
      { blockingReasons: reviewGate.blockingReasons },
    );
  }

  const nextLockVersion = ctx.snapshot.identity_lock_version + 1;
  const alreadyCreated = await getIdentityLockRepository().getSnapshotByVersion(
    scope,
    personaId,
    nextLockVersion,
  );
  if (alreadyCreated?.identity_review_id !== review.id) {
    if (alreadyCreated) {
      throw new PersonaDomainError(
        "A newer Identity Lock already exists. Reload before reconciling.",
        "WORKFLOW",
      );
    }
  }

  const referencePackageFingerprint = computeReferencePackageFingerprint({
    masterAssetId: ctx.snapshot.master_reference_asset_id,
    masterChecksum: ctx.snapshot.master_checksum,
    canonicalReferences: ctx.evidence.canonicalReferences,
    lockVersion: nextLockVersion,
    referencePackageVersion: ctx.reconciled.reconcilerVersion,
  });
  const lockedAt = new Date().toISOString();
  const newSnapshot =
    alreadyCreated ??
    (await getIdentityLockRepository().createSnapshot(scope, {
      persona_id: personaId,
      source_candidate_id: ctx.snapshot.source_candidate_id,
      source_creation_project_id: ctx.snapshot.source_creation_project_id,
      master_reference_asset_id: ctx.snapshot.master_reference_asset_id,
      master_checksum: ctx.snapshot.master_checksum,
      ...slotIds(ctx.evidence.canonicalReferences),
      canonical_references: ctx.evidence.canonicalReferences,
      identity_lock_version: nextLockVersion,
      identity_locked_at: lockedAt,
      identity_locked_by: coerceUuidOrNull(scope.actorId),
      identity_review_id: review.id,
      identity_reviewed_at: review.reviewed_at,
      identity_reviewed_by: review.reviewed_by,
      reference_package_version: ctx.reconciled.reconcilerVersion,
      reference_package_fingerprint: referencePackageFingerprint,
      provenance_counts: countProvenance(ctx.evidence.canonicalReferences),
      policy_version: IDENTITY_LOCK_POLICY_VERSION,
    }));

  // Approval columns are deliberately omitted. The package is byte-for-byte
  // equivalent to the historical lock, so existing Image/Brand Cast decisions
  // remain semantically attached to the same identity. Video approval remains
  // independent and is never granted here.
  const persona = await getPersonaRepository().updatePersona(scope, personaId, {
    identity_lock_status: "approved",
    identity_lock_version: newSnapshot.identity_lock_version,
    identity_locked_at: newSnapshot.identity_locked_at,
    image_identity_ready: reviewGate.imageIdentityReady,
    video_identity_ready: reviewGate.videoIdentityReady,
  });

  if (!alreadyCreated) {
    await writeReconciliationAudit({
      scope,
      personaId,
      review,
      sourceSnapshot: ctx.snapshot,
      newSnapshot,
    });
    await logPersonaAuditEvent({
      workspaceId: scope.workspaceId,
      eventType: "persona.legacy_identity_reconciled",
      recordId: personaId,
      actorId: scope.actorId,
      payload: {
        reviewId: review.id,
        sourceIdentityLockSnapshotId: ctx.snapshot.id,
        sourceIdentityLockVersion: ctx.snapshot.identity_lock_version,
        newIdentityLockSnapshotId: newSnapshot.id,
        newIdentityLockVersion: newSnapshot.identity_lock_version,
        approvalsPreserved: true,
      },
    });
  }

  return {
    decision: "approved",
    review,
    persona,
    sourceSnapshot: ctx.snapshot,
    newSnapshot,
    approvalsPreserved: true,
    providerCalled: false,
  };
}

export function createLegacyReconciliationOperationId(): string {
  return randomUUID();
}
