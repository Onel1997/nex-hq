/**
 * Canonical Persona-owned downstream contract.
 *
 * This module is deliberately persistence/provider agnostic so browser and
 * server consumers validate the same contract without importing repositories.
 */

import { z } from "zod";
import {
  REFERENCE_STATUSES,
  SOURCE_TYPES,
} from "./types";
import { REFERENCE_PACKAGE_SLOTS } from "../creation/reference-package/slots";
import { IDENTITY_SOURCE_CONFIDENCES } from "../creation/reference-package/human-identity-override";
import { brandModelEligibilitySchema } from "../creation/use-approvals/types";

export const BRAND_MODEL_CONTRACT_VERSION = "brand-model-v1" as const;

export const BRAND_MODEL_CONSUMERS = ["image", "video"] as const;
export type BrandModelConsumer = (typeof BRAND_MODEL_CONSUMERS)[number];

export const IDENTITY_LOCK_REFERENCE_PROVENANCE = [
  "machine_match",
  "human_warning_approved",
  "human_mismatch_override",
  "derived_mirror",
  "reassigned",
  "replacement_approved",
] as const;

const nullableTimestampSchema = z.string().min(1).nullable();

export const brandModelReferenceContractSchema = z
  .object({
    assetId: z.string().min(1),
    checksum: z.string().min(1),
    mimeType: z.string().min(1),
    width: z.number().int().positive().nullable(),
    height: z.number().int().positive().nullable(),
    status: z.enum(REFERENCE_STATUSES),
    sourceType: z.enum(SOURCE_TYPES),
    rightsConfirmed: z.boolean(),
  })
  .strict();

export const brandModelCanonicalReferenceContractSchema =
  brandModelReferenceContractSchema.extend({
    slot: z.enum(REFERENCE_PACKAGE_SLOTS),
    provenance: z.enum(IDENTITY_LOCK_REFERENCE_PROVENANCE),
    identitySourceConfidence: z
      .enum(IDENTITY_SOURCE_CONFIDENCES)
      .nullable(),
  });

export const brandModelContractSchema = z
  .object({
    contractVersion: z.literal(BRAND_MODEL_CONTRACT_VERSION),
    issuedAt: z.string().min(1),
    workspaceId: z.string().min(1),
    personaId: z.string().min(1),
    brandModelId: z.string().min(1),
    displayName: z.string().min(1),
    role: z.string(),
    sourceUpdatedAt: z.string().min(1),
    identity: z
      .object({
        locked: z.boolean(),
        identityLockSnapshotId: z.string().min(1).nullable(),
        lockVersion: z.number().int().positive().nullable(),
        lockedAt: nullableTimestampSchema,
        fingerprint: z.string().min(1).nullable(),
        policyVersion: z.string().min(1).nullable(),
        identityReview: z
          .object({
            id: z.string().min(1),
            reviewedAt: z.string().min(1),
            reviewedBy: z.string().nullable(),
          })
          .strict()
          .nullable(),
        provenance: z
          .object({
            sourceCandidateId: z.string().nullable(),
            sourceCreationProjectId: z.string().nullable(),
          })
          .strict(),
        referencePackage: z
          .object({
            version: z.string().min(1).nullable(),
            fingerprint: z.string().min(1).nullable(),
          })
          .strict(),
        masterIdentityReference:
          brandModelReferenceContractSchema.nullable(),
        approvedReferencePackage: z.array(
          brandModelCanonicalReferenceContractSchema,
        ),
        constraints: z
          .object({
            canonicalIdentityDescription: z.string(),
            immutableFeatures: z.string(),
            flexibleFeatures: z.string(),
            prohibitedChanges: z.string(),
            approvedHairVariations: z.string(),
            approvedExpressionRange: z.string(),
            approvedBodyProportions: z.string(),
            approvedAgeRange: z.string(),
            defaultStyling: z.string(),
          })
          .strict(),
      })
      .strict(),
    approvals: z
      .object({
        brandCastApproved: z.boolean(),
        brandCastApprovedAt: nullableTimestampSchema,
        brandCastApprovedBy: z.string().nullable(),
        imageUseApproved: z.boolean(),
        imageUseApprovedAt: nullableTimestampSchema,
        imageUseApprovedBy: z.string().nullable(),
        videoUseApproved: z.boolean(),
        videoUseApprovedAt: nullableTimestampSchema,
        videoUseApprovedBy: z.string().nullable(),
      })
      .strict(),
    eligibility: brandModelEligibilitySchema,
  })
  .strict();

export type BrandModelReferenceContract = z.infer<
  typeof brandModelReferenceContractSchema
>;
export type BrandModelCanonicalReferenceContract = z.infer<
  typeof brandModelCanonicalReferenceContractSchema
>;
export type BrandModelContract = z.infer<typeof brandModelContractSchema>;

export const brandModelTraceSchema = z
  .object({
    contractVersion: z.literal(BRAND_MODEL_CONTRACT_VERSION),
    brandModelId: z.string().min(1),
    personaId: z.string().min(1),
    identityLockSnapshotId: z.string().min(1),
    identityLockVersion: z.number().int().positive(),
    identityFingerprint: z.string().min(1),
    referencePackageVersion: z.string().min(1),
    referencePackageFingerprint: z.string().min(1),
  })
  .strict();

export type BrandModelTrace = z.infer<typeof brandModelTraceSchema>;

export function traceBrandModelContract(
  contract: BrandModelContract,
): BrandModelTrace {
  const identityLockSnapshotId = contract.identity.identityLockSnapshotId;
  const identityLockVersion = contract.identity.lockVersion;
  const identityFingerprint = contract.identity.fingerprint;
  const referencePackageFingerprint =
    contract.identity.referencePackage.fingerprint;
  const referencePackageVersion = contract.identity.referencePackage.version;
  if (
    !identityLockSnapshotId ||
    !identityLockVersion ||
    !identityFingerprint ||
    !referencePackageVersion ||
    !referencePackageFingerprint
  ) {
    throw new Error("Brand Model contract does not contain a locked identity trace.");
  }
  return brandModelTraceSchema.parse({
    contractVersion: contract.contractVersion,
    brandModelId: contract.brandModelId,
    personaId: contract.personaId,
    identityLockSnapshotId,
    identityLockVersion,
    identityFingerprint,
    referencePackageVersion,
    referencePackageFingerprint,
  });
}

export const brandModelSummarySchema = z
  .object({
    contractVersion: z.literal(BRAND_MODEL_CONTRACT_VERSION),
    consumer: z.enum(BRAND_MODEL_CONSUMERS),
    workspaceId: z.string().min(1),
    personaId: z.string().min(1),
    brandModelId: z.string().min(1),
    displayName: z.string().min(1),
    role: z.string(),
    identityLockSnapshotId: z.string().min(1),
    identityLockVersion: z.number().int().positive(),
    identityFingerprint: z.string().min(1),
    eligible: z.literal(true),
  })
  .strict();

export type BrandModelSummary = z.infer<typeof brandModelSummarySchema>;

export const brandModelAssetAccessSchema = z
  .object({
    assetId: z.string().min(1),
    delivery: z.literal("short_lived_signed_url"),
    url: z.string().url(),
    expiresAt: z.string().min(1),
  })
  .strict();

export type BrandModelAssetAccess = z.infer<
  typeof brandModelAssetAccessSchema
>;

export const brandModelHandoffSchema = z
  .object({
    consumer: z.enum(BRAND_MODEL_CONSUMERS),
    contract: brandModelContractSchema,
    assetAccess: z.array(brandModelAssetAccessSchema),
  })
  .strict();

export type BrandModelHandoff = z.infer<typeof brandModelHandoffSchema>;

export const expectedBrandModelIdentitySchema = z
  .object({
    identityLockSnapshotId: z.string().min(1),
    identityLockVersion: z.number().int().positive(),
    identityFingerprint: z.string().min(1),
  })
  .strict();

export type ExpectedBrandModelIdentity = z.infer<
  typeof expectedBrandModelIdentitySchema
>;
