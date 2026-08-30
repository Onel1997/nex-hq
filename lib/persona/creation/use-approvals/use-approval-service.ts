/**
 * Phase 2.4D — Explicit Image / Video Use + Brand Cast approvals.
 * Authorization metadata only — never mutates identity snapshot / fingerprint / refs.
 * No OpenAI / FLUX / provider calls. No auto-chaining between gates.
 */

import { PersonaDomainError } from "@/lib/persona/domain/errors";
import type { Persona, WorkspaceScope } from "@/lib/persona/domain/types";
import { logPersonaAuditEvent } from "@/lib/persona/audit/persona-events";
import { getPersonaRepository } from "@/lib/persona/repositories/factory";
import { getCreationRepository } from "@/lib/persona/creation/creation-factory";
import { promoteToHistoricallyProtectedIdentity } from "@/lib/persona/face-novelty-memory/historical-protection-promotion";
import { SupabaseNoveltyRepository } from "@/lib/persona/face-novelty-memory/supabase-novelty-repository";
import { isSupabaseConfigured } from "@/lib/supabase/admin";
import {
  coerceUuidOrNull,
  isPersonaIdentityLocked,
  resolveLockedBrandIdentity,
} from "../identity-lock/identity-lock-service";
import {
  evaluateBrandCastEligibility,
  evaluateBrandModelEligibility,
  evaluateImageUseEligibility,
  evaluateVideoStudioConsumerEligibility,
  evaluateVideoUseEligibility,
  isImageStudioConsumerEligible,
} from "./eligibility";
import type {
  BrandCastMemberCard,
  BrandModelApprovalsView,
  ImageStudioBrandModelEligibility,
  UseApprovalResult,
  VideoStudioBrandModelEligibility,
} from "./types";
import { VIDEO_IDENTITY_READINESS_POLICY } from "./types";
import { createPersonaReferenceSignedUrl } from "@/lib/persona/storage/reference-storage";
import { findMasterIdentityReference } from "../master-identity-reference";
import { createAdminClient } from "@/lib/supabase/admin";
import { randomUUID } from "node:crypto";
import {
  isCurrentVideoIdentityReady,
  isCurrentVideoUseApproved,
} from "../video-readiness/authority";

function personaRepo() {
  return getPersonaRepository();
}

export class UseApprovalError extends PersonaDomainError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "WORKFLOW", details);
    this.name = "UseApprovalError";
  }
}

export async function getBrandModelApprovalsView(
  scope: WorkspaceScope,
  personaId: string,
): Promise<BrandModelApprovalsView> {
  const persona = await personaRepo().getPersona(scope, personaId);
  if (!persona) {
    throw new PersonaDomainError("Persona not found", "NOT_FOUND", { personaId });
  }
  const lockedIdentity = await resolveLockedBrandIdentity(scope, personaId);
  return {
    identityLocked: isPersonaIdentityLocked(persona),
    imageIdentityReady: Boolean(persona.image_identity_ready),
    videoIdentityReady: isCurrentVideoIdentityReady(persona, lockedIdentity),
    imageUse: evaluateImageUseEligibility({ persona, lockedIdentity }),
    videoUse: evaluateVideoUseEligibility({ persona, lockedIdentity }),
    brandCast: evaluateBrandCastEligibility({ persona, lockedIdentity }),
    videoIdentityReadinessPolicy: VIDEO_IDENTITY_READINESS_POLICY,
    lockedIdentity,
    eligibility: evaluateBrandModelEligibility({ persona, lockedIdentity }),
    providerCalled: false,
  };
}

/**
 * Approve for Image Studio after explicit confirmation.
 * Does NOT auto-approve video or Brand Cast.
 */
export async function approveImageUse(
  scope: WorkspaceScope,
  personaId: string,
  input: { confirmImageUseApproval: boolean },
): Promise<UseApprovalResult> {
  if (!input.confirmImageUseApproval) {
    throw new UseApprovalError(
      "Explicit confirmation required to approve Image Studio use.",
      { gate: "image_use" },
    );
  }

  const persona = await personaRepo().getPersona(scope, personaId);
  if (!persona) {
    throw new PersonaDomainError("Persona not found", "NOT_FOUND", { personaId });
  }
  const lockedIdentity = await resolveLockedBrandIdentity(scope, personaId);

  if (persona.image_use_approved) {
    return {
      persona,
      gate: "image_use",
      alreadyApproved: true,
      providerCalled: false,
      auditEmitted: false,
      lockedIdentity,
    };
  }

  const eligibility = evaluateImageUseEligibility({ persona, lockedIdentity });
  if (!eligibility.eligible) {
    throw new UseApprovalError(
      eligibility.blockingReasons[0] ?? "Image use approval blocked",
      { gate: "image_use", blockingReasons: eligibility.blockingReasons },
    );
  }

  const approvedAt = new Date().toISOString();
  const approvedBy = coerceUuidOrNull(scope.actorId);
  const updated = await personaRepo().updatePersona(scope, personaId, {
    image_use_approved: true,
    image_use_approved_at: approvedAt,
    image_use_approved_by: approvedBy,
  });

  await logPersonaAuditEvent({
    workspaceId: scope.workspaceId,
    eventType: "persona.image_use_approved",
    recordId: personaId,
    actorId: scope.actorId,
    payload: {
      personaId,
      approvedAt,
      approvedBy,
      identityLockVersion: lockedIdentity?.lockVersion ?? persona.identity_lock_version,
      identityFingerprint: lockedIdentity?.identityFingerprint ?? null,
    },
  });

  return {
    persona: updated,
    gate: "image_use",
    alreadyApproved: false,
    providerCalled: false,
    auditEmitted: true,
    lockedIdentity,
  };
}

/**
 * Approve for Video Studio after explicit confirmation.
 * Does NOT auto-approve Brand Cast. Never fakes video_identity_ready.
 */
export async function approveVideoUse(
  scope: WorkspaceScope,
  personaId: string,
  input: { confirmVideoUseApproval: boolean },
): Promise<UseApprovalResult> {
  if (!input.confirmVideoUseApproval) {
    throw new UseApprovalError(
      "Explicit confirmation required to approve Video Studio use.",
      { gate: "video_use" },
    );
  }

  const persona = await personaRepo().getPersona(scope, personaId);
  if (!persona) {
    throw new PersonaDomainError("Persona not found", "NOT_FOUND", { personaId });
  }
  const lockedIdentity = await resolveLockedBrandIdentity(scope, personaId);

  if (isCurrentVideoUseApproved(persona, lockedIdentity)) {
    return {
      persona,
      gate: "video_use",
      alreadyApproved: true,
      providerCalled: false,
      auditEmitted: false,
      lockedIdentity,
    };
  }

  const eligibility = evaluateVideoUseEligibility({ persona, lockedIdentity });
  if (!eligibility.eligible) {
    throw new UseApprovalError(
      eligibility.blockingReasons[0] ?? "Video use approval blocked",
      { gate: "video_use", blockingReasons: eligibility.blockingReasons },
    );
  }

  const approvedAt = new Date().toISOString();
  const approvedBy = coerceUuidOrNull(scope.actorId);
  if (!approvedBy) {
    throw new UseApprovalError(
      "Für die Video-Freigabe ist ein authentifizierter Eigentümer erforderlich.",
      { gate: "video_use" },
    );
  }
  if (!lockedIdentity || !persona.video_identity_review_id) {
    throw new UseApprovalError("Die aktuelle Video-Identitätsprüfung fehlt.", {
      gate: "video_use",
    });
  }
  let updated: Persona;
  if (personaRepo().kind === "supabase") {
    const { error } = await createAdminClient().rpc("approve_persona_video_use", {
      p_workspace_id: scope.workspaceId,
      p_persona_id: personaId,
      p_operation_id: randomUUID(),
      p_approved_by: approvedBy,
      p_expected_review_id: persona.video_identity_review_id,
      p_expected_lock_snapshot_id: lockedIdentity.identityLockSnapshotId,
      p_expected_lock_version: lockedIdentity.lockVersion,
      p_expected_identity_fingerprint: lockedIdentity.identityFingerprint,
      p_expected_reference_package_fingerprint:
        lockedIdentity.referencePackageFingerprint,
      p_approved_at: approvedAt,
    });
    if (error) {
      throw new UseApprovalError(
        "Die Video-Freigabe konnte nicht atomar gespeichert werden.",
        { gate: "video_use", reason: error.message },
      );
    }
    const reloaded = await personaRepo().getPersona(scope, personaId);
    if (!reloaded) {
      throw new PersonaDomainError("Persona not found", "NOT_FOUND", { personaId });
    }
    updated = reloaded;
  } else {
    updated = await personaRepo().updatePersona(scope, personaId, {
      video_use_approved: true,
      video_use_approved_at: approvedAt,
      video_use_approved_by: approvedBy,
      video_use_approval_review_id: persona.video_identity_review_id,
      video_use_approval_lock_snapshot_id: lockedIdentity.identityLockSnapshotId,
      video_use_approval_lock_version: lockedIdentity.lockVersion,
      video_use_approval_identity_fingerprint: lockedIdentity.identityFingerprint,
      video_use_approval_reference_package_fingerprint:
        lockedIdentity.referencePackageFingerprint,
    });

    await logPersonaAuditEvent({
      workspaceId: scope.workspaceId,
      eventType: "persona.video_use_approved",
      recordId: personaId,
      actorId: scope.actorId,
      payload: {
        personaId,
        approvedAt,
        approvedBy,
        identityLockSnapshotId: lockedIdentity.identityLockSnapshotId,
        identityLockVersion: lockedIdentity.lockVersion,
        identityFingerprint: lockedIdentity.identityFingerprint,
        referencePackageFingerprint: lockedIdentity.referencePackageFingerprint,
        videoIdentityReviewId: persona.video_identity_review_id,
      },
    });
  }

  return {
    persona: updated,
    gate: "video_use",
    alreadyApproved: false,
    providerCalled: false,
    auditEmitted: true,
    lockedIdentity,
  };
}

/**
 * Approve as Official Brand Cast after explicit confirmation.
 * Keeps the legacy presentation status synchronized after explicit Brand Cast
 * approval. Legacy status alone never grants membership.
 */
export async function approveBrandCast(
  scope: WorkspaceScope,
  personaId: string,
  input: { confirmBrandCastApproval: boolean },
): Promise<UseApprovalResult> {
  if (!input.confirmBrandCastApproval) {
    throw new UseApprovalError(
      "Explicit confirmation required to approve Official Brand Cast.",
      { gate: "brand_cast" },
    );
  }

  const persona = await personaRepo().getPersona(scope, personaId);
  if (!persona) {
    throw new PersonaDomainError("Persona not found", "NOT_FOUND", { personaId });
  }
  const lockedIdentity = await resolveLockedBrandIdentity(scope, personaId);

  const already = persona.brand_cast_approved;

  if (already) {
    return {
      persona,
      gate: "brand_cast",
      alreadyApproved: true,
      providerCalled: false,
      auditEmitted: false,
      lockedIdentity,
    };
  }

  const eligibility = evaluateBrandCastEligibility({ persona, lockedIdentity });
  if (!eligibility.eligible) {
    throw new UseApprovalError(
      eligibility.blockingReasons[0] ?? "Brand Cast approval blocked",
      { gate: "brand_cast", blockingReasons: eligibility.blockingReasons },
    );
  }

  const approvedAt = new Date().toISOString();
  const approvedBy = coerceUuidOrNull(scope.actorId);
  const updated = await personaRepo().updatePersona(scope, personaId, {
    brand_cast_approved: true,
    brand_cast_approved_at: approvedAt,
    brand_cast_approved_by: approvedBy,
    status: "Approved",
  });

  await logPersonaAuditEvent({
    workspaceId: scope.workspaceId,
    eventType: "persona.brand_cast_approved",
    recordId: personaId,
    actorId: scope.actorId,
    payload: {
      personaId,
      approvedAt,
      approvedBy,
      identityLockVersion: lockedIdentity?.lockVersion ?? persona.identity_lock_version,
      identityFingerprint: lockedIdentity?.identityFingerprint ?? null,
      legacyApprovedSynced: true,
      status: "Approved",
    },
  });

  // Best-effort historical protection promotion — non-blocking.
  try {
    const creationRepo = getCreationRepository();
    const sourceCandidate = persona.source_candidate_id
      ? await creationRepo.getCandidate(scope, persona.source_candidate_id)
      : await creationRepo.findCandidateByConvertedPersonaId(scope, personaId);
    if (
      sourceCandidate &&
      creationRepo.kind === "supabase" &&
      isSupabaseConfigured()
    ) {
      await promoteToHistoricallyProtectedIdentity(new SupabaseNoveltyRepository(), {
        workspaceId: scope.workspaceId,
        candidateId: sourceCandidate.id,
        status: "brand_cast_approved",
        reason: "brand_cast_approved",
        source: "use-approvals.approve_brand_cast",
        actorId: approvedBy ?? scope.actorId ?? null,
      });
    }
  } catch {
    // Non-blocking
  }

  return {
    persona: updated,
    gate: "brand_cast",
    alreadyApproved: false,
    providerCalled: false,
    auditEmitted: true,
    lockedIdentity,
  };
}

export async function listImageStudioEligibleBrandModels(
  scope: WorkspaceScope,
): Promise<ImageStudioBrandModelEligibility[]> {
  const personas = await personaRepo().listPersonas(scope);
  const out: ImageStudioBrandModelEligibility[] = [];
  for (const persona of personas) {
    const lockedIdentity = await resolveLockedBrandIdentity(scope, persona.id);
    const eligibility = evaluateBrandModelEligibility({ persona, lockedIdentity });
    if (!isImageStudioConsumerEligible({ persona, lockedIdentity })) continue;
    out.push({
      personaId: persona.id,
      eligible: true,
      identityLocked: eligibility.identityLocked,
      imageIdentityReady: eligibility.imageIdentityReady,
      imageUseApproved: eligibility.imageUseApproved,
      brandCastApproved: eligibility.brandCastApproved,
      blockingReasons: [],
      lockVersion: lockedIdentity!.lockVersion,
      identityFingerprint: lockedIdentity!.identityFingerprint,
    });
  }
  return out;
}

export async function listVideoStudioEligibleBrandModels(
  scope: WorkspaceScope,
): Promise<VideoStudioBrandModelEligibility[]> {
  const personas = await personaRepo().listPersonas(scope);
  const out: VideoStudioBrandModelEligibility[] = [];
  for (const p of personas) {
    const lockedIdentity = await resolveLockedBrandIdentity(scope, p.id);
    const evalResult = evaluateVideoStudioConsumerEligibility({
      persona: p,
      lockedIdentity,
    });
    if (!evalResult.eligible) continue;
    out.push({
      personaId: p.id,
      eligible: true,
      identityLocked: isPersonaIdentityLocked(p),
      videoIdentityReady: isCurrentVideoIdentityReady(p, lockedIdentity),
      videoUseApproved: isCurrentVideoUseApproved(p, lockedIdentity),
      brandCastApproved: Boolean(p.brand_cast_approved),
      blockingReasons: [],
      lockVersion: lockedIdentity!.lockVersion,
      identityFingerprint: lockedIdentity!.identityFingerprint,
    });
  }
  return out;
}

export async function listOfficialBrandCastMembers(
  scope: WorkspaceScope,
): Promise<BrandCastMemberCard[]> {
  const personas = await personaRepo().listPersonas(scope);
  const members: BrandCastMemberCard[] = [];

  for (const persona of personas) {
    const isMember = persona.brand_cast_approved;
    if (!isMember || persona.status === "Archived") continue;

    const assets = await personaRepo().listReferenceAssets(scope, persona.id);
    const locked = await resolveLockedBrandIdentity(scope, persona.id);
    const master =
      locked?.masterReference ??
      findMasterIdentityReference(assets) ??
      assets.find((a) => a.id === persona.primary_reference_asset_id) ??
      null;

    let masterPortraitUrl: string | null = null;
    if (master?.storage_path) {
      try {
        const signed = await createPersonaReferenceSignedUrl(master.storage_path);
        masterPortraitUrl = signed.signedUrl;
      } catch {
        masterPortraitUrl = null;
      }
    }

    let videoStatus: BrandCastMemberCard["videoStatus"] = "not_approved";
    if (isCurrentVideoUseApproved(persona, locked)) videoStatus = "approved";
    else if (!isCurrentVideoIdentityReady(persona, locked)) videoStatus = "not_ready";

    members.push({
      personaId: persona.id,
      displayName: persona.name,
      role: persona.role,
      masterPortraitUrl,
      identityLocked: isPersonaIdentityLocked(persona),
      imageUseApproved: Boolean(persona.image_use_approved),
      videoStatus,
      brandCastApproved: true,
    });
  }

  return members;
}

/** Assert approvals never mutate identity package fields (test helper). */
export function identityPackageFingerprintFromPersona(
  persona: Persona,
  lockedIdentity: { identityFingerprint: string; lockVersion: number } | null,
): {
  fingerprint: string | null;
  lockVersion: number;
  identityLockedAt: string | null;
  imageIdentityReady: boolean;
} {
  return {
    fingerprint: lockedIdentity?.identityFingerprint ?? null,
    lockVersion: lockedIdentity?.lockVersion ?? persona.identity_lock_version,
    identityLockedAt: persona.identity_locked_at,
    imageIdentityReady: persona.image_identity_ready,
  };
}
