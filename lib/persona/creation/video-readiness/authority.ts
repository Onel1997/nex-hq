import type { Persona } from "@/lib/persona/domain/types";
import type { LockedBrandIdentity } from "../identity-lock/types";

function currentLockBindingMatches(
  persona: Persona,
  locked: LockedBrandIdentity | null,
  prefix: "ready" | "approval",
): boolean {
  if (!locked) return false;
  if (prefix === "ready") {
    return (
      persona.video_identity_review_id != null &&
      persona.video_identity_ready_lock_snapshot_id ===
        locked.identityLockSnapshotId &&
      persona.video_identity_ready_lock_version === locked.lockVersion &&
      persona.video_identity_ready_identity_fingerprint ===
        locked.identityFingerprint &&
      persona.video_identity_ready_reference_package_fingerprint ===
        locked.referencePackageFingerprint
    );
  }
  return (
    persona.video_use_approval_review_id != null &&
    persona.video_use_approval_review_id === persona.video_identity_review_id &&
    persona.video_use_approval_lock_snapshot_id === locked.identityLockSnapshotId &&
    persona.video_use_approval_lock_version === locked.lockVersion &&
    persona.video_use_approval_identity_fingerprint === locked.identityFingerprint &&
    persona.video_use_approval_reference_package_fingerprint ===
      locked.referencePackageFingerprint
  );
}

export function isCurrentVideoIdentityReady(
  persona: Persona,
  locked: LockedBrandIdentity | null,
): boolean {
  const currentReferences = locked
    ? [
        locked.masterReference,
        ...locked.canonicalReferences.map((entry) => entry.reference),
      ]
    : [];
  return (
    persona.video_identity_ready === true &&
    currentReferences.length === 6 &&
    currentReferences.every((reference) => reference.rights_confirmed) &&
    currentLockBindingMatches(persona, locked, "ready")
  );
}

export function isCurrentVideoUseApproved(
  persona: Persona,
  locked: LockedBrandIdentity | null,
): boolean {
  return (
    persona.video_use_approved === true &&
    isCurrentVideoIdentityReady(persona, locked) &&
    currentLockBindingMatches(persona, locked, "approval")
  );
}

export function currentVideoAuthorityTrace(
  persona: Persona,
  locked: LockedBrandIdentity,
) {
  return {
    reviewId: persona.video_identity_review_id ?? null,
    identityLockSnapshotId: locked.identityLockSnapshotId,
    identityLockVersion: locked.lockVersion,
    identityFingerprint: locked.identityFingerprint,
    referencePackageFingerprint: locked.referencePackageFingerprint,
    videoIdentityReady: isCurrentVideoIdentityReady(persona, locked),
    videoUseApproved: isCurrentVideoUseApproved(persona, locked),
  };
}
