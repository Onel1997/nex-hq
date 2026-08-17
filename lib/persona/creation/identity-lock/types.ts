/**
 * Phase 2.4A — Official Brand Face Identity Lock types.
 */

import type { ReferencePackageSlot } from "../reference-package/slots";
import type { ReferenceProvenance } from "../reference-package/reconcile-reference-package-state";
import type { IdentitySourceConfidence } from "../reference-package/human-identity-override";
import type { PersonaReferenceAsset } from "@/lib/persona/domain/types";
import type { PersonaIdentityReview } from "@/lib/persona/domain/creation-types";

export const IDENTITY_LOCK_POLICY_VERSION = "identity-lock-v1.0.0" as const;

/** Provenance preserved in the immutable identity snapshot. */
export type IdentityLockReferenceProvenance =
  | "machine_match"
  | "human_warning_approved"
  | "human_mismatch_override"
  | "derived_mirror"
  | "reassigned"
  | "replacement_approved";

export type LockedCanonicalReferenceSnapshot = {
  slot: ReferencePackageSlot;
  assetId: string;
  checksum: string;
  provenance: IdentityLockReferenceProvenance;
  identitySourceConfidence: IdentitySourceConfidence | null;
  referenceProvenance: ReferenceProvenance;
  effectiveSlot: ReferencePackageSlot;
};

export type IdentityLockProvenanceCounts = {
  machineMatchCount: number;
  warningApprovedCount: number;
  mismatchOverrideCount: number;
  derivedReferenceCount: number;
  reassignedCount: number;
  replacementApprovedCount: number;
};

export type PersonaIdentityLockSnapshot = {
  id: string;
  workspace_id: string;
  persona_id: string;
  source_candidate_id: string | null;
  source_creation_project_id: string | null;
  master_reference_asset_id: string;
  master_checksum: string;
  front_asset_id: string;
  three_quarter_left_asset_id: string;
  three_quarter_right_asset_id: string;
  left_profile_asset_id: string;
  right_profile_asset_id: string;
  canonical_references: LockedCanonicalReferenceSnapshot[];
  identity_lock_version: number;
  identity_locked_at: string;
  identity_locked_by: string | null;
  /** Persisted human quality-gate evidence used for this immutable lock. */
  identity_review_id: string | null;
  identity_reviewed_at: string | null;
  identity_reviewed_by: string | null;
  reference_package_version: string;
  reference_package_fingerprint: string;
  provenance_counts: IdentityLockProvenanceCounts;
  policy_version: typeof IDENTITY_LOCK_POLICY_VERSION;
  created_at: string;
};

export type IdentityLockEligibilityView = {
  eligibleForIdentityLock: boolean;
  blockingReasons: string[];
  alreadyLocked: boolean;
  coverage: { accepted: number; required: number };
  referencePackageReady: boolean;
  masterReferenceId: string | null;
  masterImmutable: boolean;
  identityReview: PersonaIdentityReview | null;
  identityReviewPassed: boolean;
  preview: IdentityLockPreview | null;
};

export type IdentityLockPreview = {
  masterReferenceAssetId: string;
  canonicalReferences: LockedCanonicalReferenceSnapshot[];
  referencePackageFingerprint: string;
  identityLockVersion: number;
  provenanceCounts: IdentityLockProvenanceCounts;
  identityReviewId: string;
  identityReviewedAt: string;
  identityReviewedBy: string | null;
};

/** Resolved immutable Persona lock aggregate used to build downstream contracts. */
export type LockedBrandIdentity = {
  identityLockSnapshotId: string;
  personaId: string;
  role: string;
  masterReference: PersonaReferenceAsset;
  canonicalReferences: Array<{
    slot: ReferencePackageSlot;
    reference: PersonaReferenceAsset;
    provenance: IdentityLockReferenceProvenance;
    identitySourceConfidence: IdentitySourceConfidence | null;
  }>;
  identityFingerprint: string;
  referencePackageFingerprint: string;
  lockVersion: number;
  lockedAt: string;
  policyVersion: typeof IDENTITY_LOCK_POLICY_VERSION;
  referencePackageVersion: string;
  sourceCandidateId: string | null;
  sourceCreationProjectId: string | null;
  imageUseApproved: boolean;
  videoUseApproved: boolean;
  brandCastApproved: boolean;
  imageIdentityReady: boolean;
  videoIdentityReady: boolean;
  identityReview: {
    id: string;
    reviewedAt: string;
    reviewedBy: string | null;
  };
};

export type CreateIdentityLockSnapshotInput = Omit<
  PersonaIdentityLockSnapshot,
  "id" | "created_at" | "workspace_id"
>;
