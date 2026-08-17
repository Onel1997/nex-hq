import { z } from "zod";
import { brandModelTraceSchema } from "@/lib/persona/domain/brand-model-contract";
import { productProductionContextSchema } from "@/lib/image/product-production-context";
import { approvedMasterArtworkSchema } from "@/lib/design/master-artwork-authority/types";
import { imageGenerationProvenanceSchema } from "@/lib/image/image-generation-identity-contract";

export const IMAGE_PRODUCTION_PROJECT_VERSION =
  "image-production-project-v1" as const;

const projectArtworkSchema = approvedMasterArtworkSchema.omit({
  storagePath: true,
});

export const imageProductionShotSchema = z
  .object({
    id: z.string().min(1),
    assetType: z.string().min(1),
    title: z.string().min(1),
    prompt: z.string().min(1),
    scene: z.string().min(1),
    lighting: z.string().min(1),
    poseDirection: z.string().min(1).nullable(),
    dimensions: z.string().min(1),
  })
  .strict();

export const imageProductionProjectSchema = z
  .object({
    contractVersion: z.literal(IMAGE_PRODUCTION_PROJECT_VERSION),
    id: z.string().uuid(),
    workspaceId: z.string().uuid(),
    reportRecordId: z.string().uuid(),
    reportId: z.string().uuid(),
    projectName: z.string().min(1),
    campaignDirection: z
      .object({
        visualDirection: z.string().min(1),
        collectionName: z.string().min(1).nullable(),
      })
      .strict(),
    brandModel: brandModelTraceSchema,
    masterArtwork: projectArtworkSchema,
    productContext: productProductionContextSchema,
    shotPlan: z.array(imageProductionShotSchema).min(1),
    status: z.enum(["READY", "IN_PRODUCTION", "REVIEW", "COMPLETE", "ARCHIVED"]),
    version: z.number().int().positive(),
    createdBy: z.string().min(1),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict();

export type ImageProductionProject = z.infer<
  typeof imageProductionProjectSchema
>;
export type ImageProductionShot = z.infer<typeof imageProductionShotSchema>;

export const IMAGE_ASSET_REVIEW_STATUSES = [
  "GENERATED",
  "REVIEW_REQUIRED",
  "APPROVED",
  "REJECTED",
] as const;

export const imageProductionAssetSchema = z
  .object({
    id: z.string().uuid(),
    workspaceId: z.string().uuid(),
    productionProjectId: z.string().uuid(),
    generationJobId: z.string().uuid(),
    shotId: z.string().min(1),
    inputFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    brandModel: brandModelTraceSchema,
    masterArtwork: z
      .object({
        id: z.string().uuid(),
        designId: z.string().min(1),
        version: z.string().min(1),
        checksum: z.string().regex(/^[a-f0-9]{64}$/),
      })
      .strict(),
    productContext: productProductionContextSchema,
    provider: z.enum(["openai", "flux"]),
    model: z.string().min(1),
    providerRequestId: z.string().nullable(),
    storagePath: z.string().min(1),
    provenance: imageGenerationProvenanceSchema,
    reviewStatus: z.enum(IMAGE_ASSET_REVIEW_STATUSES),
    reviewedBy: z.string().nullable(),
    reviewedAt: z.string().datetime().nullable(),
    reviewNote: z.string().nullable(),
    generatedAt: z.string().datetime(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict();

export type ImageProductionAsset = z.infer<typeof imageProductionAssetSchema>;

export type ImageProductionAssetView = Omit<ImageProductionAsset, "storagePath"> & {
  accessUrl: string | null;
  accessExpiresAt: string | null;
};

export const reviewImageProductionAssetRequestSchema = z
  .object({
    reviewStatus: z.enum(["APPROVED", "REJECTED"]),
    note: z.string().max(2000).nullable().default(null),
  })
  .strict();
