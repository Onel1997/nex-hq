import { z } from "zod";
import {
  brandModelTraceSchema,
  type BrandModelTrace,
} from "@/lib/persona/domain/brand-model-contract";
import { REFERENCE_PACKAGE_SLOTS } from "@/lib/persona/creation/reference-package/slots";
import { productProductionContextSchema } from "@/lib/image/product-production-context";

export const IMAGE_PROVIDER_IDENTITY_STRATEGIES = [
  "openai_master_image_edit_high_fidelity",
  "openai_master_identity_and_artwork_edit_high_fidelity",
] as const;

export type ImageProviderIdentityStrategy =
  (typeof IMAGE_PROVIDER_IDENTITY_STRATEGIES)[number];

/** Persona-owned identity constraints, distinct from garment/campaign inputs. */
export type ImageIdentityConstraints = {
  displayName: string;
  canonicalIdentityDescription: string;
  immutableFeatures: string;
  prohibitedChanges: string;
  approvedHairVariations: string;
  approvedExpressionRange: string;
  approvedBodyProportions: string;
  approvedAgeRange: string;
  defaultStyling: string;
};

export const imageGenerationSupportingReferenceSchema = z
  .object({
    role: z.enum(REFERENCE_PACKAGE_SLOTS),
    assetId: z.string().min(1),
    checksum: z.string().min(1),
    mimeType: z.string().min(1),
  })
  .strict();

/**
 * Safe, durable lineage for an identity-conditioned Image generation attempt.
 * It contains no storage paths, signed URLs, or private bytes.
 */
export const imageGenerationIdentityTraceSchema = z
  .object({
    brandModel: brandModelTraceSchema,
    referencePackageVersion: z.string().min(1),
    masterIdentityAssetId: z.string().min(1),
    masterIdentityChecksum: z.string().min(1),
    supportingReferences: z
      .array(imageGenerationSupportingReferenceSchema)
      .length(5),
  })
  .strict();

export type ImageGenerationIdentityTrace = z.infer<
  typeof imageGenerationIdentityTraceSchema
>;

export const imageGenerationProvenanceSchema = z
  .object({
    attemptId: z.string().uuid(),
    provider: z.enum(["openai", "flux"]),
    model: z.string().min(1),
    providerRequestId: z.string().nullable(),
    identityStrategy: z
      .enum(IMAGE_PROVIDER_IDENTITY_STRATEGIES)
      .nullable(),
    identity: imageGenerationIdentityTraceSchema.nullable(),
    paidGeneration: z
      .object({
        jobId: z.string().uuid(),
        productionProjectId: z.string().uuid(),
        productionProjectVersion: z.number().int().positive(),
        inputFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
        masterArtwork: z
          .object({
            artworkId: z.string().uuid(),
            designId: z.string().min(1),
            version: z.string().min(1),
            checksum: z.string().regex(/^[a-f0-9]{64}$/),
          })
          .strict(),
        product: productProductionContextSchema,
        shotId: z.string().min(1),
      })
      .strict()
      .optional(),
    startedAt: z.string().min(1),
    completedAt: z.string().min(1).nullable(),
  })
  .strict();

export type ImageGenerationProvenance = z.infer<
  typeof imageGenerationProvenanceSchema
>;

export function brandModelTracesEqual(
  left: BrandModelTrace,
  right: BrandModelTrace,
): boolean {
  return (
    left.contractVersion === right.contractVersion &&
    left.brandModelId === right.brandModelId &&
    left.personaId === right.personaId &&
    left.identityLockSnapshotId === right.identityLockSnapshotId &&
    left.identityLockVersion === right.identityLockVersion &&
    left.identityFingerprint === right.identityFingerprint &&
    left.referencePackageVersion === right.referencePackageVersion &&
    left.referencePackageFingerprint === right.referencePackageFingerprint
  );
}
