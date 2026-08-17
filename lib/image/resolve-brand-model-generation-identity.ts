import { PersonaDomainError } from "@/lib/persona/domain/errors";
import type {
  BrandModelContract,
  BrandModelTrace,
} from "@/lib/persona/domain/brand-model-contract";
import type {
  PersonaReferenceAsset,
  WorkspaceScope,
} from "@/lib/persona/domain/types";
import {
  getIdentityLockSnapshot,
  resolveLockedBrandIdentity,
} from "@/lib/persona/creation/identity-lock";
import type {
  LockedBrandIdentity,
  PersonaIdentityLockSnapshot,
} from "@/lib/persona/creation/identity-lock/types";
import { buildImageStudioPersonaHandoff } from "@/lib/persona/future/image-studio-hooks";
import { downloadPersonaReferenceAssetBytes } from "@/lib/persona/storage/reference-storage";
import {
  brandModelTracesEqual,
  imageGenerationIdentityTraceSchema,
  type ImageIdentityConstraints,
  type ImageGenerationIdentityTrace,
} from "./image-generation-identity-contract";
import { createImageBrandModelProductionContext } from "./brand-model-production-context";

const BLOCKED_REFERENCE_STATUSES = new Set([
  "rejected",
  "archived",
  "superseded",
]);

export type ResolvedImageIdentityInput = {
  trace: ImageGenerationIdentityTrace;
  masterReference: {
    assetId: string;
    checksum: string;
    mimeType: string;
    bytes: Buffer;
  };
  supportingReferences: Array<{
    role:
      | "front"
      | "three_quarter_left"
      | "three_quarter_right"
      | "left_profile"
      | "right_profile";
    assetId: string;
    checksum: string;
    mimeType: string;
  }>;
  constraints: ImageIdentityConstraints;
};

export type ResolveImageGenerationIdentityDependencies = {
  downloadMasterBytes: typeof downloadPersonaReferenceAssetBytes;
};

function assertReferenceUsable(
  asset: PersonaReferenceAsset,
  role: string,
): void {
  if (BLOCKED_REFERENCE_STATUSES.has(asset.status)) {
    throw new PersonaDomainError(
      `Locked ${role} reference is ${asset.status} and cannot be used for generation.`,
      "BRAND_MODEL_INELIGIBLE",
      { assetId: asset.id, role, status: asset.status },
    );
  }
  if (!asset.rights_confirmed) {
    throw new PersonaDomainError(
      "Locked Brand Model reference rights are not confirmed.",
      "BRAND_MODEL_INELIGIBLE",
      { assetId: asset.id, role },
    );
  }
  if (!asset.mime_type.startsWith("image/")) {
    throw new PersonaDomainError(
      `Locked ${role} reference is not an image.`,
      "INVALID_REFERENCE_ASSET",
      { assetId: asset.id, role, mimeType: asset.mime_type },
    );
  }
}

function assertTraceMatchesContract(
  expected: BrandModelTrace,
  contract: BrandModelContract,
): void {
  const actual = createImageBrandModelProductionContext({
    consumer: "image",
    contract,
    assetAccess: [],
  }).trace;
  if (!brandModelTracesEqual(expected, actual)) {
    throw new PersonaDomainError(
      "The selected Brand Model identity trace is stale or mismatched.",
      "BRAND_MODEL_VERSION_MISMATCH",
      { expected, actual },
    );
  }
}

function assertLockedAssetsMatchSnapshot(
  locked: LockedBrandIdentity,
  snapshot: PersonaIdentityLockSnapshot | null,
): asserts snapshot is PersonaIdentityLockSnapshot {
  const currentBySlot = new Map(
    locked.canonicalReferences.map((entry) => [entry.slot, entry.reference]),
  );
  const supportMatches =
    snapshot?.canonical_references.length === 5 &&
    snapshot.canonical_references.every((entry) => {
      const current = currentBySlot.get(entry.slot);
      return (
        current?.id === entry.assetId && current.checksum === entry.checksum
      );
    });
  if (
    !snapshot ||
    snapshot.id !== locked.identityLockSnapshotId ||
    snapshot.identity_lock_version !== locked.lockVersion ||
    snapshot.reference_package_version !== locked.referencePackageVersion ||
    snapshot.reference_package_fingerprint !==
      locked.referencePackageFingerprint ||
    snapshot.master_reference_asset_id !== locked.masterReference.id ||
    snapshot.master_checksum !== locked.masterReference.checksum ||
    !supportMatches
  ) {
    throw new PersonaDomainError(
      "The persisted Persona references no longer match the immutable Identity Lock snapshot.",
      "BRAND_MODEL_VERSION_MISMATCH",
    );
  }
}

/**
 * Generation-time Persona authority boundary.
 *
 * The browser supplies only a safe BrandModelTrace. This function reloads the
 * current Persona authority, rejects stale versions, resolves the exact locked
 * package, and downloads only the authoritative Master bytes from private
 * storage. Supporting references remain exact locked support evidence and are
 * not promoted to alternate identity sources.
 */
export async function resolveBrandModelGenerationIdentity(
  scope: WorkspaceScope,
  selectedTrace: BrandModelTrace,
  dependencies: Partial<ResolveImageGenerationIdentityDependencies> = {},
): Promise<ResolvedImageIdentityInput> {
  const handoff = await buildImageStudioPersonaHandoff(
    scope,
    selectedTrace.personaId,
    {
      expectedIdentity: {
        identityLockSnapshotId: selectedTrace.identityLockSnapshotId,
        identityLockVersion: selectedTrace.identityLockVersion,
        identityFingerprint: selectedTrace.identityFingerprint,
      },
      resolveAssetAccess: false,
    },
  );
  if (handoff.contract.brandModelId !== selectedTrace.brandModelId) {
    throw new PersonaDomainError(
      "Brand Model identity does not match the selected Persona.",
      "BRAND_MODEL_VERSION_MISMATCH",
    );
  }
  assertTraceMatchesContract(selectedTrace, handoff.contract);

  const locked = await resolveLockedBrandIdentity(
    scope,
    selectedTrace.personaId,
  );
  if (!locked) {
    throw new PersonaDomainError(
      "The current locked Brand Model package cannot be resolved.",
      "BRAND_MODEL_INELIGIBLE",
    );
  }
  if (
    locked.identityLockSnapshotId !== selectedTrace.identityLockSnapshotId ||
    locked.lockVersion !== selectedTrace.identityLockVersion ||
    locked.identityFingerprint !== selectedTrace.identityFingerprint ||
    locked.referencePackageVersion !== selectedTrace.referencePackageVersion ||
    locked.referencePackageFingerprint !==
      selectedTrace.referencePackageFingerprint
  ) {
    throw new PersonaDomainError(
      "The selected Brand Model lock changed before generation. Refresh and re-plan.",
      "BRAND_MODEL_VERSION_MISMATCH",
    );
  }
  const snapshot = await getIdentityLockSnapshot(
    scope,
    selectedTrace.personaId,
  );
  assertLockedAssetsMatchSnapshot(locked, snapshot);

  const master = locked.masterReference;
  assertReferenceUsable(master, "Master Identity");
  if (locked.canonicalReferences.length !== 5) {
    throw new PersonaDomainError(
      "The locked Brand Model does not contain the canonical 5/5 package.",
      "BRAND_MODEL_INELIGIBLE",
    );
  }
  for (const entry of locked.canonicalReferences) {
    assertReferenceUsable(entry.reference, entry.slot);
    if (entry.reference.status !== "approved") {
      throw new PersonaDomainError(
        `Locked supporting reference ${entry.slot} is not approved.`,
        "BRAND_MODEL_INELIGIBLE",
        { assetId: entry.reference.id, status: entry.reference.status },
      );
    }
  }

  const download =
    dependencies.downloadMasterBytes ?? downloadPersonaReferenceAssetBytes;
  const masterBytes = await download({
    workspaceId: scope.workspaceId,
    storagePath: master.storage_path,
    mimeType: master.mime_type,
    expectedChecksum: master.checksum,
  });

  // Detect a lock advance that occurred while private bytes were resolving.
  const afterDownload = await resolveLockedBrandIdentity(
    scope,
    selectedTrace.personaId,
  );
  if (
    !afterDownload ||
    afterDownload.identityLockSnapshotId !== selectedTrace.identityLockSnapshotId ||
    afterDownload.lockVersion !== selectedTrace.identityLockVersion ||
    afterDownload.identityFingerprint !== selectedTrace.identityFingerprint ||
    afterDownload.referencePackageVersion !==
      selectedTrace.referencePackageVersion ||
    afterDownload.referencePackageFingerprint !==
      selectedTrace.referencePackageFingerprint
  ) {
    throw new PersonaDomainError(
      "The Brand Model lock changed while references were being prepared. Refresh and re-plan.",
      "BRAND_MODEL_VERSION_MISMATCH",
    );
  }
  const snapshotAfterDownload = await getIdentityLockSnapshot(
    scope,
    selectedTrace.personaId,
  );
  assertLockedAssetsMatchSnapshot(afterDownload, snapshotAfterDownload);

  const supportingReferences = locked.canonicalReferences.map((entry) => ({
    role: entry.slot,
    assetId: entry.reference.id,
    checksum: entry.reference.checksum,
    mimeType: entry.reference.mime_type,
  }));
  const trace = imageGenerationIdentityTraceSchema.parse({
    brandModel: selectedTrace,
    referencePackageVersion: locked.referencePackageVersion,
    masterIdentityAssetId: master.id,
    masterIdentityChecksum: master.checksum,
    supportingReferences,
  });
  const constraints = handoff.contract.identity.constraints;

  return {
    trace,
    masterReference: {
      assetId: master.id,
      checksum: master.checksum,
      mimeType: master.mime_type,
      bytes: masterBytes,
    },
    supportingReferences,
    constraints: {
      displayName: handoff.contract.displayName,
      canonicalIdentityDescription:
        constraints.canonicalIdentityDescription,
      immutableFeatures: constraints.immutableFeatures,
      prohibitedChanges: constraints.prohibitedChanges,
      approvedHairVariations: constraints.approvedHairVariations,
      approvedExpressionRange: constraints.approvedExpressionRange,
      approvedBodyProportions: constraints.approvedBodyProportions,
      approvedAgeRange: constraints.approvedAgeRange,
      defaultStyling: constraints.defaultStyling,
    },
  };
}
