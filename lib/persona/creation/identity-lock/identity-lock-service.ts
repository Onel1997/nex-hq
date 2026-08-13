/**
 * Phase 2.4A / 2.4C — Official Brand Face Identity Lock service.
 * No provider calls. Atomic fail-closed lock from reconciled Reference Package state.
 */

import { randomUUID } from "node:crypto";
import { PersonaDomainError } from "@/lib/persona/domain/errors";
import type { Persona, PersonaReferenceAsset, WorkspaceScope } from "@/lib/persona/domain/types";
import { logPersonaAuditEvent } from "@/lib/persona/audit/persona-events";
import { getPersonaRepository } from "@/lib/persona/repositories/factory";
import { getCreationRepository } from "@/lib/persona/creation/creation-factory";
import { getReferencePackageRepository } from "../reference-package/repository";
import { reconcileReferencePackageState } from "../reference-package/reconcile-reference-package-state";
import {
  findMasterIdentityReference,
  getMasterIdentityReferenceForPersona,
} from "../master-identity-reference";
import { promoteToHistoricallyProtectedIdentity } from "@/lib/persona/face-novelty-memory/historical-protection-promotion";
import { SupabaseNoveltyRepository } from "@/lib/persona/face-novelty-memory/supabase-novelty-repository";
import { isSupabaseConfigured } from "@/lib/supabase/admin";
import { validateIdentityLockEligibility } from "./pre-lock-validation";
import { getIdentityLockRepository } from "./repository";
import type {
  IdentityLockEligibilityView,
  LockedBrandIdentity,
  PersonaIdentityLockSnapshot,
} from "./types";
import { IDENTITY_LOCK_POLICY_VERSION } from "./types";
import { coerceUuidOrNull } from "./uuid";

export { coerceUuidOrNull } from "./uuid";

export type IdentityLockStage =
  | "confirm"
  | "pre_lock_validation"
  | "load_context"
  | "fingerprint"
  | "snapshot_insert"
  | "persona_update"
  | "historical_protection"
  | "audit"
  | "dto"
  | "already_locked"
  | "recover_partial";

export type HistoricalProtectionPromotionStatus =
  | "promoted"
  | "skipped_no_record"
  | "skipped_non_supabase"
  | "failed_nonblocking";

export class IdentityLockError extends PersonaDomainError {
  readonly stage: IdentityLockStage;
  readonly requestId: string;

  constructor(
    message: string,
    stage: IdentityLockStage,
    requestId: string,
    details?: Record<string, unknown>,
  ) {
    super(message, "WORKFLOW", { ...details, stage, requestId });
    this.name = "IdentityLockError";
    this.stage = stage;
    this.requestId = requestId;
  }
}

function personaRepo() {
  return getPersonaRepository();
}

function creationRepo() {
  return getCreationRepository();
}

function pkgRepo() {
  return getReferencePackageRepository();
}

function lockRepo() {
  return getIdentityLockRepository();
}

export function isPersonaIdentityLocked(persona: Pick<Persona, "identity_lock_status">): boolean {
  return persona.identity_lock_status === "approved";
}

export function collectLockedIdentityAssetIds(
  snapshot: PersonaIdentityLockSnapshot | null,
  master: PersonaReferenceAsset | null,
): Set<string> {
  const ids = new Set<string>();
  if (master) ids.add(master.id);
  if (!snapshot) return ids;
  ids.add(snapshot.master_reference_asset_id);
  ids.add(snapshot.front_asset_id);
  ids.add(snapshot.three_quarter_left_asset_id);
  ids.add(snapshot.three_quarter_right_asset_id);
  ids.add(snapshot.left_profile_asset_id);
  ids.add(snapshot.right_profile_asset_id);
  return ids;
}

export function assertLockedIdentityAssetMutable(input: {
  persona: Pick<Persona, "identity_lock_status">;
  asset: Pick<PersonaReferenceAsset, "id">;
  snapshot: PersonaIdentityLockSnapshot | null;
  master: PersonaReferenceAsset | null;
}): { ok: true } | { ok: false; reason: string } {
  if (!isPersonaIdentityLocked(input.persona)) return { ok: true };
  const lockedIds = collectLockedIdentityAssetIds(input.snapshot, input.master);
  if (lockedIds.has(input.asset.id)) {
    return {
      ok: false,
      reason:
        "Locked Brand Identity assets cannot be modified. Create an Identity Revision to change the official package.",
    };
  }
  return { ok: true };
}

async function loadLockContext(scope: WorkspaceScope, personaId: string) {
  const persona = await personaRepo().getPersona(scope, personaId);
  if (!persona) {
    throw new PersonaDomainError("Persona not found", "NOT_FOUND", { personaId });
  }
  const [attempts, assets, masterBundle] = await Promise.all([
    pkgRepo().listAttemptsForPersona(scope, personaId),
    personaRepo().listReferenceAssets(scope, personaId),
    getMasterIdentityReferenceForPersona(scope, personaId),
  ]);
  const reconciled = reconcileReferencePackageState({ attempts, assets });
  const master = masterBundle?.reference ?? findMasterIdentityReference(assets);
  return { persona, attempts, assets, reconciled, master };
}

export async function getIdentityLockEligibility(
  scope: WorkspaceScope,
  personaId: string,
): Promise<IdentityLockEligibilityView> {
  const { persona, assets, reconciled, master } = await loadLockContext(scope, personaId);
  const nextLockVersion = (persona.identity_lock_version || 1) + 1;
  return validateIdentityLockEligibility({
    persona,
    reconciled,
    master,
    assets,
    nextLockVersion,
  });
}

async function promoteHistoricalProtectionIfPersisted(input: {
  workspaceId: string;
  candidateId: string;
  actorId?: string | null;
}): Promise<{
  status: HistoricalProtectionPromotionStatus;
  promoted: boolean;
  error?: string;
}> {
  if (creationRepo().kind !== "supabase" || !isSupabaseConfigured()) {
    return { status: "skipped_non_supabase", promoted: false };
  }
  try {
    const result = await promoteToHistoricallyProtectedIdentity(
      new SupabaseNoveltyRepository(),
      {
        workspaceId: input.workspaceId,
        candidateId: input.candidateId,
        status: "identity_locked",
        reason: "identity_locked",
        source: "identity_lock.lock_brand_identity",
        actorId: coerceUuidOrNull(input.actorId) ?? input.actorId ?? null,
      },
    );
    if (!result.promoted) {
      return { status: "skipped_no_record", promoted: false };
    }
    return { status: "promoted", promoted: true };
  } catch (err) {
    return {
      status: "failed_nonblocking",
      promoted: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function slotAssetMap(preview: NonNullable<IdentityLockEligibilityView["preview"]>) {
  const bySlot = Object.fromEntries(
    preview.canonicalReferences.map((r) => [r.slot, r.assetId]),
  ) as Record<string, string>;
  return {
    front_asset_id: bySlot.front!,
    three_quarter_left_asset_id: bySlot.three_quarter_left!,
    three_quarter_right_asset_id: bySlot.three_quarter_right!,
    left_profile_asset_id: bySlot.left_profile!,
    right_profile_asset_id: bySlot.right_profile!,
  };
}

function wrapDbError(
  err: unknown,
  stage: IdentityLockStage,
  requestId: string,
): IdentityLockError {
  if (err instanceof IdentityLockError) return err;
  const message =
    err instanceof Error
      ? err.message
      : typeof err === "object" &&
          err &&
          "message" in err &&
          typeof (err as { message: unknown }).message === "string"
        ? (err as { message: string }).message
        : "Identity Lock persistence failed";
  const code =
    typeof err === "object" && err && "code" in err
      ? String((err as { code: unknown }).code ?? "")
      : undefined;
  return new IdentityLockError(message, stage, requestId, {
    dbCode: code,
    cause: err,
  });
}

async function finalizePersonaLockFields(
  scope: WorkspaceScope,
  personaId: string,
  snapshot: PersonaIdentityLockSnapshot,
): Promise<Persona> {
  return personaRepo().updatePersona(scope, personaId, {
    identity_lock_status: "approved",
    identity_lock_version: snapshot.identity_lock_version,
    identity_locked_at: snapshot.identity_locked_at,
    image_identity_ready: true,
  });
}

async function writeLockAudit(input: {
  scope: WorkspaceScope;
  personaId: string;
  snapshot: PersonaIdentityLockSnapshot;
  canonicalAssetIds: string[];
  historicalProtection: {
    status: HistoricalProtectionPromotionStatus;
    promoted: boolean;
    error?: string;
  };
  recovered?: boolean;
  skippedDuplicate?: boolean;
}): Promise<void> {
  if (input.skippedDuplicate) return;
  await logPersonaAuditEvent({
    workspaceId: input.scope.workspaceId,
    eventType: "persona.identity_locked",
    recordId: input.personaId,
    actorId: input.scope.actorId,
    payload: {
      personaId: input.personaId,
      workspaceId: input.scope.workspaceId,
      masterAssetId: input.snapshot.master_reference_asset_id,
      canonicalAssetIds: input.canonicalAssetIds,
      referencePackageFingerprint: input.snapshot.reference_package_fingerprint,
      identityLockVersion: input.snapshot.identity_lock_version,
      lockedAt: input.snapshot.identity_locked_at,
      lockedBy: input.snapshot.identity_locked_by,
      machineMatchCount: input.snapshot.provenance_counts.machineMatchCount,
      warningApprovedCount: input.snapshot.provenance_counts.warningApprovedCount,
      mismatchOverrideCount: input.snapshot.provenance_counts.mismatchOverrideCount,
      derivedReferenceCount: input.snapshot.provenance_counts.derivedReferenceCount,
      historicalProtection: input.historicalProtection,
      recovered: Boolean(input.recovered),
    },
  });
}

/**
 * Lock Brand Identity after explicit confirmation.
 * Re-runs pre-lock validation; fails closed if state changed since preview.
 * Idempotent: already-locked / partial snapshot recover without duplicates.
 */
export async function lockBrandIdentity(
  scope: WorkspaceScope,
  personaId: string,
  input: { confirmIdentityLock: boolean },
): Promise<{
  persona: Persona;
  snapshot: PersonaIdentityLockSnapshot;
  providerCalled: false;
  recovered: boolean;
  alreadyLocked: boolean;
  requestId: string;
  historicalProtectionPromotion: HistoricalProtectionPromotionStatus;
}> {
  const requestId = randomUUID();

  if (!input.confirmIdentityLock) {
    throw new IdentityLockError(
      "Explicit confirmation required to lock Brand Identity.",
      "confirm",
      requestId,
    );
  }

  let ctx;
  try {
    ctx = await loadLockContext(scope, personaId);
  } catch (err) {
    throw wrapDbError(err, "load_context", requestId);
  }

  const existingSnapshot = await lockRepo().getLatestSnapshotForPersona(scope, personaId);

  // Already locked → return existing snapshot, no duplicate writes.
  if (isPersonaIdentityLocked(ctx.persona) && existingSnapshot) {
    return {
      persona: ctx.persona,
      snapshot: existingSnapshot,
      providerCalled: false,
      recovered: false,
      alreadyLocked: true,
      requestId,
      historicalProtectionPromotion: "skipped_no_record",
    };
  }

  // Partial write recovery: snapshot exists, persona not yet approved.
  if (existingSnapshot && !isPersonaIdentityLocked(ctx.persona)) {
    let updated: Persona;
    try {
      updated = await finalizePersonaLockFields(scope, personaId, existingSnapshot);
    } catch (err) {
      throw wrapDbError(err, "persona_update", requestId);
    }

    const sourceCandidate = ctx.persona.source_candidate_id
      ? await creationRepo().getCandidate(scope, ctx.persona.source_candidate_id)
      : await creationRepo().findCandidateByConvertedPersonaId(scope, personaId);

    let historicalProtection: {
      status: HistoricalProtectionPromotionStatus;
      promoted: boolean;
      error?: string;
    } = { status: "skipped_no_record", promoted: false };
    if (sourceCandidate) {
      historicalProtection = await promoteHistoricalProtectionIfPersisted({
        workspaceId: scope.workspaceId,
        candidateId: sourceCandidate.id,
        actorId: scope.actorId,
      });
    }

    await writeLockAudit({
      scope,
      personaId,
      snapshot: existingSnapshot,
      canonicalAssetIds: existingSnapshot.canonical_references.map((r) => r.assetId),
      historicalProtection,
      recovered: true,
    });

    return {
      persona: updated,
      snapshot: existingSnapshot,
      providerCalled: false,
      recovered: true,
      alreadyLocked: false,
      requestId,
      historicalProtectionPromotion: historicalProtection.status,
    };
  }

  const nextLockVersion = (ctx.persona.identity_lock_version || 1) + 1;
  const eligibility = validateIdentityLockEligibility({
    persona: ctx.persona,
    reconciled: ctx.reconciled,
    master: ctx.master,
    assets: ctx.assets,
    nextLockVersion,
  });

  if (!eligibility.eligibleForIdentityLock || !eligibility.preview || !ctx.master) {
    throw new IdentityLockError(
      eligibility.blockingReasons[0] ??
        "Identity Lock blocked — Reference Package requirements not met.",
      "pre_lock_validation",
      requestId,
      { blockingReasons: eligibility.blockingReasons },
    );
  }

  const lockedAt = new Date().toISOString();
  const slotIds = slotAssetMap(eligibility.preview);
  const lockedBy = coerceUuidOrNull(scope.actorId);

  let snapshot: PersonaIdentityLockSnapshot;
  try {
    snapshot = await lockRepo().createSnapshot(scope, {
      persona_id: personaId,
      source_candidate_id: ctx.persona.source_candidate_id,
      source_creation_project_id: ctx.persona.source_creation_project_id,
      master_reference_asset_id: eligibility.preview.masterReferenceAssetId,
      master_checksum: ctx.master.checksum,
      ...slotIds,
      canonical_references: eligibility.preview.canonicalReferences,
      identity_lock_version: nextLockVersion,
      identity_locked_at: lockedAt,
      identity_locked_by: lockedBy,
      reference_package_version: ctx.reconciled.reconcilerVersion,
      reference_package_fingerprint: eligibility.preview.referencePackageFingerprint,
      provenance_counts: eligibility.preview.provenanceCounts,
      policy_version: IDENTITY_LOCK_POLICY_VERSION,
    });
  } catch (err) {
    throw wrapDbError(err, "snapshot_insert", requestId);
  }

  let updated: Persona;
  try {
    updated = await finalizePersonaLockFields(scope, personaId, snapshot);
  } catch (err) {
    // Snapshot already persisted — leave it for idempotent recovery on retry.
    throw wrapDbError(err, "persona_update", requestId);
  }

  const sourceCandidate = ctx.persona.source_candidate_id
    ? await creationRepo().getCandidate(scope, ctx.persona.source_candidate_id)
    : await creationRepo().findCandidateByConvertedPersonaId(scope, personaId);

  let historicalProtection: {
    status: HistoricalProtectionPromotionStatus;
    promoted: boolean;
    error?: string;
  } = { status: "skipped_no_record", promoted: false };
  if (sourceCandidate) {
    historicalProtection = await promoteHistoricalProtectionIfPersisted({
      workspaceId: scope.workspaceId,
      candidateId: sourceCandidate.id,
      actorId: scope.actorId,
    });
  }

  await writeLockAudit({
    scope,
    personaId,
    snapshot,
    canonicalAssetIds: eligibility.preview.canonicalReferences.map((r) => r.assetId),
    historicalProtection,
  });

  return {
    persona: updated,
    snapshot,
    providerCalled: false,
    recovered: false,
    alreadyLocked: false,
    requestId,
    historicalProtectionPromotion: historicalProtection.status,
  };
}

export async function resolveLockedBrandIdentity(
  scope: WorkspaceScope,
  personaId: string,
): Promise<LockedBrandIdentity | null> {
  const persona = await personaRepo().getPersona(scope, personaId);
  if (!persona || !isPersonaIdentityLocked(persona)) return null;

  const snapshot = await lockRepo().getLatestSnapshotForPersona(scope, personaId);
  if (!snapshot) return null;

  const assets = await personaRepo().listReferenceAssets(scope, personaId);
  const assetById = new Map(assets.map((a) => [a.id, a]));
  const master = assetById.get(snapshot.master_reference_asset_id);
  if (!master) return null;

  const canonicalReferences = snapshot.canonical_references
    .map((ref) => {
      const reference = assetById.get(ref.assetId);
      if (!reference) return null;
      return {
        slot: ref.slot,
        reference,
        provenance: ref.provenance,
        identitySourceConfidence: ref.identitySourceConfidence,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r != null);

  if (canonicalReferences.length !== snapshot.canonical_references.length) return null;

  return {
    personaId,
    role: persona.role,
    masterReference: master,
    canonicalReferences,
    identityFingerprint: snapshot.reference_package_fingerprint,
    lockVersion: snapshot.identity_lock_version,
    lockedAt: snapshot.identity_locked_at,
    imageUseApproved: persona.image_use_approved,
    videoUseApproved: persona.video_use_approved,
    brandCastApproved: persona.approved,
    imageIdentityReady: persona.image_identity_ready,
    videoIdentityReady: persona.video_identity_ready,
  };
}

export async function getIdentityLockSnapshot(
  scope: WorkspaceScope,
  personaId: string,
): Promise<PersonaIdentityLockSnapshot | null> {
  return lockRepo().getLatestSnapshotForPersona(scope, personaId);
}
