/** Persona-owned Brand Model queries and eligibility-gated studio handoffs. */

import type { Persona, PersonaReferenceAsset, WorkspaceScope } from "../domain/types";
import { PersonaDomainError } from "../domain/errors";
import {
  brandModelContractSchema,
  brandModelHandoffSchema,
  brandModelSummarySchema,
  type BrandModelAssetAccess,
  type BrandModelConsumer,
  type BrandModelContract,
  type BrandModelHandoff,
  type BrandModelReferenceContract,
  type BrandModelSummary,
  type ExpectedBrandModelIdentity,
} from "../domain/brand-model-contract";
import type { LockedBrandIdentity } from "../creation/identity-lock/types";
import { resolveLockedBrandIdentity } from "../creation/identity-lock/identity-lock-service";
import { evaluateBrandModelEligibility } from "../creation/use-approvals/eligibility";
import { getPersonaRepository } from "../repositories/factory";
import {
  assertPersonaReferenceStoragePathScope,
  createPersonaReferenceSignedUrl,
} from "../storage/reference-storage";

type LoadedBrandModelAuthority = {
  persona: Persona;
  lockedIdentity: LockedBrandIdentity | null;
  contract: BrandModelContract;
};

export type BrandModelAssetAccessResolver = (input: {
  workspaceId: string;
  asset: PersonaReferenceAsset;
}) => Promise<BrandModelAssetAccess>;

function referenceContract(
  asset: PersonaReferenceAsset,
): BrandModelReferenceContract {
  return {
    assetId: asset.id,
    checksum: asset.checksum,
    mimeType: asset.mime_type,
    width: asset.width,
    height: asset.height,
    status: asset.status,
    sourceType: asset.source_type,
    rightsConfirmed: asset.rights_confirmed,
  };
}

async function loadBrandModelAuthority(
  scope: WorkspaceScope,
  personaId: string,
): Promise<LoadedBrandModelAuthority> {
  const persona = await getPersonaRepository().getPersona(scope, personaId);
  if (!persona) {
    throw new PersonaDomainError("Persona not found", "NOT_FOUND", {
      personaId,
      workspaceId: scope.workspaceId,
    });
  }

  const lockedIdentity = await resolveLockedBrandIdentity(scope, personaId);
  const eligibility = evaluateBrandModelEligibility({ persona, lockedIdentity });
  const contract = brandModelContractSchema.parse({
    contractVersion: "brand-model-v1",
    issuedAt: new Date().toISOString(),
    workspaceId: persona.workspace_id,
    personaId: persona.id,
    brandModelId: persona.id,
    displayName: persona.name,
    role: persona.role,
    sourceUpdatedAt: persona.updated_at,
    identity: {
      locked: eligibility.validIdentityLock,
      identityLockSnapshotId:
        lockedIdentity?.identityLockSnapshotId ?? null,
      lockVersion: lockedIdentity?.lockVersion ?? null,
      lockedAt: lockedIdentity?.lockedAt ?? null,
      fingerprint: lockedIdentity?.identityFingerprint ?? null,
      policyVersion: lockedIdentity?.policyVersion ?? null,
      identityReview: lockedIdentity?.identityReview ?? null,
      provenance: {
        sourceCandidateId: lockedIdentity?.sourceCandidateId ?? null,
        sourceCreationProjectId:
          lockedIdentity?.sourceCreationProjectId ?? null,
      },
      referencePackage: {
        version: lockedIdentity?.referencePackageVersion ?? null,
        fingerprint: lockedIdentity?.referencePackageFingerprint ?? null,
      },
      masterIdentityReference: lockedIdentity
        ? referenceContract(lockedIdentity.masterReference)
        : null,
      approvedReferencePackage:
        lockedIdentity?.canonicalReferences.map((entry) => ({
          ...referenceContract(entry.reference),
          slot: entry.slot,
          provenance: entry.provenance,
          identitySourceConfidence: entry.identitySourceConfidence,
        })) ?? [],
      constraints: {
        canonicalIdentityDescription: persona.canonical_identity_description,
        immutableFeatures: persona.immutable_features,
        flexibleFeatures: persona.flexible_features,
        prohibitedChanges: persona.prohibited_changes,
        approvedHairVariations: persona.approved_hair_variations,
        approvedExpressionRange: persona.approved_expression_range,
        approvedBodyProportions: persona.approved_body_proportions,
        approvedAgeRange: persona.approved_age_range,
        defaultStyling: persona.default_styling,
      },
    },
    approvals: {
      brandCastApproved: eligibility.brandCastApproved,
      brandCastApprovedAt: persona.brand_cast_approved_at,
      brandCastApprovedBy: persona.brand_cast_approved_by,
      imageUseApproved: eligibility.imageUseApproved,
      imageUseApprovedAt: persona.image_use_approved_at,
      imageUseApprovedBy: persona.image_use_approved_by,
      videoUseApproved: eligibility.videoUseApproved,
      videoUseApprovedAt: persona.video_use_approved_at,
      videoUseApprovedBy: persona.video_use_approved_by,
    },
    eligibility,
  });

  return { persona, lockedIdentity, contract };
}

/** Resolve the canonical contract even when ineligible, for safe diagnostics. */
export async function resolveBrandModelContract(
  scope: WorkspaceScope,
  personaId: string,
): Promise<BrandModelContract> {
  return (await loadBrandModelAuthority(scope, personaId)).contract;
}

function blockingReasonsFor(
  contract: BrandModelContract,
  consumer: BrandModelConsumer,
): string[] {
  return consumer === "image"
    ? contract.eligibility.imageBlockingReasons
    : contract.eligibility.videoBlockingReasons;
}

function isEligibleFor(
  contract: BrandModelContract,
  consumer: BrandModelConsumer,
): boolean {
  return consumer === "image"
    ? contract.eligibility.imageEligible
    : contract.eligibility.videoEligible;
}

function assertExpectedIdentity(
  contract: BrandModelContract,
  expected: ExpectedBrandModelIdentity | undefined,
): void {
  if (!expected) return;
  const actual = {
    identityLockSnapshotId: contract.identity.identityLockSnapshotId,
    identityLockVersion: contract.identity.lockVersion,
    identityFingerprint: contract.identity.fingerprint,
  };
  if (
    actual.identityLockSnapshotId !== expected.identityLockSnapshotId ||
    actual.identityLockVersion !== expected.identityLockVersion ||
    actual.identityFingerprint !== expected.identityFingerprint
  ) {
    throw new PersonaDomainError(
      "The selected Brand Model identity version is stale. Re-select the current locked identity before production.",
      "BRAND_MODEL_VERSION_MISMATCH",
      { expected, actual },
    );
  }
}

async function defaultAssetAccessResolver(input: {
  workspaceId: string;
  asset: PersonaReferenceAsset;
}): Promise<BrandModelAssetAccess> {
  assertPersonaReferenceStoragePathScope(
    input.workspaceId,
    input.asset.storage_path,
  );
  const signed = await createPersonaReferenceSignedUrl(input.asset.storage_path);
  return {
    assetId: input.asset.id,
    delivery: "short_lived_signed_url",
    url: signed.signedUrl,
    expiresAt: signed.expiresAt,
  };
}

export async function buildBrandModelHandoff(
  scope: WorkspaceScope,
  personaId: string,
  consumer: BrandModelConsumer,
  options: {
    expectedIdentity?: ExpectedBrandModelIdentity;
    resolveAssetAccess?: boolean;
    assetAccessResolver?: BrandModelAssetAccessResolver;
  } = {},
): Promise<BrandModelHandoff> {
  const authority = await loadBrandModelAuthority(scope, personaId);
  if (!isEligibleFor(authority.contract, consumer)) {
    throw new PersonaDomainError(
      `Brand Model is not eligible for ${consumer} production.`,
      "BRAND_MODEL_INELIGIBLE",
      {
        personaId,
        consumer,
        blockingReasons: blockingReasonsFor(authority.contract, consumer),
      },
    );
  }
  assertExpectedIdentity(authority.contract, options.expectedIdentity);

  let assetAccess: BrandModelAssetAccess[] = [];
  if (options.resolveAssetAccess) {
    const lockedIdentity = authority.lockedIdentity;
    if (!lockedIdentity) {
      throw new PersonaDomainError(
        "Valid locked identity references are unavailable.",
        "BRAND_MODEL_INELIGIBLE",
        { personaId, consumer, blockingReasons: ["Identity Lock unavailable"] },
      );
    }
    const uniqueAssets = new Map<string, PersonaReferenceAsset>();
    uniqueAssets.set(lockedIdentity.masterReference.id, lockedIdentity.masterReference);
    for (const entry of lockedIdentity.canonicalReferences) {
      uniqueAssets.set(entry.reference.id, entry.reference);
    }
    const resolver = options.assetAccessResolver ?? defaultAssetAccessResolver;
    assetAccess = await Promise.all(
      [...uniqueAssets.values()].map((asset) =>
        resolver({ workspaceId: scope.workspaceId, asset }),
      ),
    );
  }

  return brandModelHandoffSchema.parse({
    consumer,
    contract: authority.contract,
    assetAccess,
  });
}

export async function listEligibleBrandModels(
  scope: WorkspaceScope,
  consumer: BrandModelConsumer,
): Promise<BrandModelSummary[]> {
  const personas = await getPersonaRepository().listPersonas(scope);
  const summaries: BrandModelSummary[] = [];
  for (const persona of personas) {
    const authority = await loadBrandModelAuthority(scope, persona.id);
    if (!isEligibleFor(authority.contract, consumer)) continue;
    const snapshotId = authority.contract.identity.identityLockSnapshotId;
    const lockVersion = authority.contract.identity.lockVersion;
    const fingerprint = authority.contract.identity.fingerprint;
    if (!snapshotId || !lockVersion || !fingerprint) continue;
    summaries.push(
      brandModelSummarySchema.parse({
        contractVersion: authority.contract.contractVersion,
        consumer,
        workspaceId: authority.contract.workspaceId,
        personaId: authority.contract.personaId,
        brandModelId: authority.contract.brandModelId,
        displayName: authority.contract.displayName,
        role: authority.contract.role,
        identityLockSnapshotId: snapshotId,
        identityLockVersion: lockVersion,
        identityFingerprint: fingerprint,
        eligible: true,
      }),
    );
  }
  return summaries.sort((a, b) =>
    a.displayName.localeCompare(b.displayName) ||
    a.brandModelId.localeCompare(b.brandModelId),
  );
}
