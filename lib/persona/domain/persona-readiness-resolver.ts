/**
 * Phase 2.4B — Authoritative Persona readiness from reconciled Reference Package.
 *
 * Single source of truth for header, Reference Package panel, and Identity Lock.
 * No provider calls.
 */

import type {
  Persona,
  PersonaReferenceAsset,
  PersonaReadinessReport,
  PersonaReadinessState,
  ReferenceCompleteness,
  WorkspaceScope,
} from "@/lib/persona/domain/types";
import {
  isProfileComplete,
  listApprovalPrerequisiteGaps,
} from "@/lib/persona/domain/readiness";
import { getPersonaRepository } from "@/lib/persona/repositories/factory";
import { getReferencePackageRepository } from "@/lib/persona/creation/reference-package/repository";
import {
  reconcileReferencePackageState,
  type ReconciledReferencePackageState,
} from "@/lib/persona/creation/reference-package/reconcile-reference-package-state";
import {
  findMasterIdentityReference,
  parseMasterIdentityNotes,
} from "@/lib/persona/creation/master-identity-reference";
import { isPersonaIdentityLocked } from "@/lib/persona/creation/identity-lock/identity-lock-service";
import { validateIdentityLockEligibility } from "@/lib/persona/creation/identity-lock/pre-lock-validation";
import type { IdentityLockEligibilityView } from "@/lib/persona/creation/identity-lock/types";
import { REFERENCE_PACKAGE_SLOTS } from "@/lib/persona/creation/reference-package/slots";
import { PersonaDomainError } from "@/lib/persona/domain/errors";

export const PERSONA_VISUAL_STATUSES = [
  "references_incomplete",
  "reference_package_ready",
  "identity_locked",
  "image_ready",
  "brand_cast_approved",
] as const;

export type PersonaVisualStatus = (typeof PERSONA_VISUAL_STATUSES)[number];

export type PersonaCanonicalReadiness = {
  personaId: string;
  referencePackageReady: boolean;
  referenceCoverage: { accepted: number; required: number };
  activeCanonicalAssetIds: Record<string, string | null>;
  referencesComplete: boolean;
  identityLocked: boolean;
  identityReady: boolean;
  imageIdentityReady: boolean;
  videoIdentityReady: boolean;
  imageUseApproved: boolean;
  videoUseApproved: boolean;
  brandCastApproved: boolean;
  visualStatus: PersonaVisualStatus;
  blockingReasons: string[];
  masterReferenceId: string | null;
  masterImmutable: boolean;
  eligibleForIdentityLock: boolean;
  identityLockEligibility: IdentityLockEligibilityView;
  reconciled: ReconciledReferencePackageState;
  /** Backward-compatible report for existing consumers. */
  legacyReport: PersonaReadinessReport;
};

function deriveVisualStatus(input: {
  referencesComplete: boolean;
  identityLocked: boolean;
  imageUseApproved: boolean;
  brandCastApproved: boolean;
}): PersonaVisualStatus {
  if (input.brandCastApproved) return "brand_cast_approved";
  if (input.imageUseApproved && input.identityLocked) return "image_ready";
  if (input.identityLocked) return "identity_locked";
  if (input.referencesComplete) return "reference_package_ready";
  return "references_incomplete";
}

function visualToLegacyState(
  visual: PersonaVisualStatus,
  profileComplete: boolean,
  imageReady: boolean,
  videoReady: boolean,
  productionReady: boolean,
  archived: boolean,
): PersonaReadinessState {
  if (archived) return "archived";
  if (productionReady) return "production_ready";
  if (videoReady) return "video_ready";
  if (imageReady) return "image_ready";
  if (visual === "identity_locked") return "identity_locked";
  if (visual === "reference_package_ready") return "reference_package_ready";
  if (!profileComplete) return "profile_incomplete";
  return "references_incomplete";
}

/**
 * Pure readiness calculation from already-loaded facts.
 * referencesComplete derives ONLY from reconcileReferencePackageState.
 */
export function resolvePersonaReadinessFromFacts(input: {
  persona: Persona;
  assets: readonly PersonaReferenceAsset[];
  reconciled: ReconciledReferencePackageState;
}): PersonaCanonicalReadiness {
  const { persona, assets, reconciled } = input;
  const master = findMasterIdentityReference(assets);
  const masterImmutable = Boolean(
    master && parseMasterIdentityNotes(master.notes)?.immutable_source_reference,
  );

  const referencePackageReady = reconciled.referencePackageReady;
  const referencesComplete =
    referencePackageReady &&
    reconciled.acceptedCount === reconciled.requiredCount &&
    reconciled.requiredCount === REFERENCE_PACKAGE_SLOTS.length;

  const identityLocked = isPersonaIdentityLocked(persona);
  const imageIdentityReady = Boolean(persona.image_identity_ready) || identityLocked;
  const videoIdentityReady = Boolean(persona.video_identity_ready);
  const imageUseApproved = Boolean(persona.image_use_approved);
  const videoUseApproved = Boolean(persona.video_use_approved);
  const brandCastApproved = Boolean(
    persona.brand_cast_approved ||
      (persona.approved && persona.status === "Approved"),
  );

  const identityReady = identityLocked && imageIdentityReady;

  const nextLockVersion = (persona.identity_lock_version || 1) + 1;
  const identityLockEligibility = validateIdentityLockEligibility({
    persona,
    reconciled,
    master,
    assets,
    nextLockVersion,
  });

  // Invariant: header and Identity Lock eligibility share this reconciler result.
  if (
    referencesComplete &&
    identityLockEligibility.eligibleForIdentityLock === false &&
    !identityLocked &&
    identityLockEligibility.blockingReasons.every((r) => r !== "Identity already locked")
  ) {
    // Eligibility may still block on Master metadata even when coverage is 5/5.
    // That is intentional — do not force eligible=true.
  }

  const visualStatus = deriveVisualStatus({
    referencesComplete,
    identityLocked,
    imageUseApproved,
    brandCastApproved,
  });

  const blockingReasons: string[] = [];
  if (!referencesComplete) {
    blockingReasons.push(
      `Reference Package incomplete (${reconciled.acceptedCount}/${reconciled.requiredCount})`,
    );
    for (const slot of reconciled.slots) {
      if (!slot.countsTowardCoverage) {
        blockingReasons.push(`${slot.slot}: ${slot.state}`);
      }
    }
  }
  if (!identityLocked) blockingReasons.push("Identity not locked");
  if (!imageUseApproved) blockingReasons.push("Image use not approved");
  if (!videoUseApproved) blockingReasons.push("Video use not approved");
  if (!brandCastApproved) blockingReasons.push("Brand Cast not approved");

  const activeCanonicalAssetIds: Record<string, string | null> = {};
  for (const slot of REFERENCE_PACKAGE_SLOTS) {
    const row = reconciled.slots.find((s) => s.slot === slot);
    activeCanonicalAssetIds[slot] =
      row && row.countsTowardCoverage ? row.activeAssetId : null;
  }

  const profile_complete = isProfileComplete(persona);
  const approvalGaps = listApprovalPrerequisiteGaps(persona, [...assets]);

  const completeness: ReferenceCompleteness = {
    front_portrait: Boolean(activeCanonicalAssetIds.front),
    left_profile: Boolean(activeCanonicalAssetIds.left_profile),
    right_profile: Boolean(activeCanonicalAssetIds.right_profile),
    full_body_front: assets.some(
      (a) =>
        a.status === "approved" &&
        (a.asset_type === "full_body" || a.framing === "full_body") &&
        a.view_angle === "front",
    ),
    full_body_side_or_three_quarter: assets.some(
      (a) =>
        a.status === "approved" &&
        (a.asset_type === "full_body" ||
          a.asset_type === "three_quarter" ||
          a.framing === "full_body" ||
          a.framing === "half_body") &&
        (a.view_angle === "left_profile" ||
          a.view_angle === "right_profile" ||
          a.view_angle === "three_quarter_left" ||
          a.view_angle === "three_quarter_right"),
    ),
    neutral_expression: assets.some(
      (a) =>
        a.status === "approved" &&
        /neutral|ruhig|calm|composed/i.test(a.expression || ""),
    ),
    optional_video_reference: assets.some((a) => a.asset_type === "video_reference"),
    // Stage B identity package completeness — NOT legacy full-body checklist.
    visually_complete: referencesComplete,
  };

  const image_ready = identityLocked && imageUseApproved && referencesComplete;
  const video_ready = image_ready && videoUseApproved;
  const production_ready = image_ready && video_ready;
  const archived = persona.status === "Archived";

  const state = visualToLegacyState(
    visualStatus,
    profile_complete,
    image_ready,
    video_ready,
    production_ready,
    archived,
  );

  // Hard invariant: reconciled 5/5 must never surface as references_incomplete.
  if (referencesComplete && state === "references_incomplete") {
    throw new Error(
      "INVARIANT: referencesComplete=true but readiness state is references_incomplete",
    );
  }

  const states: PersonaReadinessState[] = [];
  if (archived) {
    states.push("archived");
  } else {
    if (!profile_complete) states.push("profile_incomplete");
    if (!referencesComplete) states.push("references_incomplete");
    if (visualStatus === "reference_package_ready") states.push("reference_package_ready");
    if (visualStatus === "identity_locked" || identityLocked) states.push("identity_locked");
    if (image_ready) states.push("image_ready");
    if (video_ready) states.push("video_ready");
    if (production_ready) states.push("production_ready");
  }

  const missing = archived
    ? ["archived"]
    : [
        ...(!referencesComplete ? ["reference_package_incomplete"] : []),
        ...(!identityLocked ? ["identity_not_locked"] : []),
        ...approvalGaps.filter(
          (g) =>
            g !== "approved_primary_portrait" &&
            g !== "approved_body_reference" &&
            !g.startsWith("rights_confirmed:"),
        ),
      ];

  const legacyReport: PersonaReadinessReport = {
    state,
    states: states.length > 0 ? states : [state],
    profile_complete,
    references_complete: referencesComplete,
    image_ready,
    video_ready,
    production_ready,
    missing,
    completeness,
  };

  return {
    personaId: persona.id,
    referencePackageReady,
    referenceCoverage: {
      accepted: reconciled.acceptedCount,
      required: reconciled.requiredCount,
    },
    activeCanonicalAssetIds,
    referencesComplete,
    identityLocked,
    identityReady,
    imageIdentityReady,
    videoIdentityReady,
    imageUseApproved,
    videoUseApproved,
    brandCastApproved,
    visualStatus,
    blockingReasons,
    masterReferenceId: master?.id ?? null,
    masterImmutable,
    eligibleForIdentityLock: identityLockEligibility.eligibleForIdentityLock,
    identityLockEligibility,
    reconciled,
    legacyReport,
  };
}

export async function resolvePersonaReadiness(
  scope: WorkspaceScope,
  personaId: string,
): Promise<PersonaCanonicalReadiness> {
  const personaRepo = getPersonaRepository();
  const persona = await personaRepo.getPersona(scope, personaId);
  if (!persona) {
    throw new PersonaDomainError("Persona not found", "NOT_FOUND", { personaId });
  }
  const [assets, attempts] = await Promise.all([
    personaRepo.listReferenceAssets(scope, personaId),
    getReferencePackageRepository().listAttemptsForPersona(scope, personaId),
  ]);
  const reconciled = reconcileReferencePackageState({ attempts, assets });
  return resolvePersonaReadinessFromFacts({ persona, assets, reconciled });
}
