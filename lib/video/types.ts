import { z } from "zod";
import { brandModelTraceSchema } from "@/lib/persona/domain/brand-model-contract";
import { productProductionBindingV2Schema } from "@/lib/product-library/types";
import { productVisualInputSchema } from "@/lib/product-library/product-reference-package";
import { imageMasterArtworkSnapshotSchema } from "@/lib/image/paid-generation/types";

export const VIDEO_INPUT_VERSION = "video-generation-input-v1" as const;
export const VIDEO_PRODUCTION_MODES = [
  "IMAGE_TO_VIDEO_APPROVED_ASSET",
  "PRODUCT_MODEL_VIDEO",
  "CAMPAIGN_VIDEO",
  "SOCIAL_VIDEO",
  "PRODUCT_DETAIL_VIDEO",
  "ECOMMERCE_VIDEO",
  "DRAFT_GENERATIVE_VIDEO",
] as const;
export const videoProductionModeSchema = z.enum(VIDEO_PRODUCTION_MODES);
export const videoMovementSchema = z.enum([
  "SUBTLE",
  "SLOW_WALK",
  "WALK_TOWARD_CAMERA",
  "WALK_AWAY",
  "FULL_TURN",
  "TORSO_TURN",
  "SHOW_PRODUCT",
  "MOVE_FABRIC",
  "SHOW_ZIPPER",
  "LEG_DETAIL",
  "WALK_PAST_CAMERA",
  "CUSTOM",
]);
export const videoCameraSchema = z.enum([
  "STATIC",
  "SLOW_PUSH_IN",
  "SLOW_PULL_OUT",
  "LATERAL",
  "TRACKING",
  "ORBIT",
  "LIGHT_HANDHELD",
  "CLOSE_UP",
  "LOW_ANGLE",
  "EYE_LEVEL",
  "CUSTOM",
]);
export const videoTypeSchema = z.enum([
  "PRODUCT_MODEL",
  "CAMPAIGN",
  "SOCIAL",
  "PRODUCT_DETAIL",
  "ECOMMERCE",
]);
export const videoAspectRatioSchema = z.enum(["9:16", "4:5", "1:1", "16:9"]);
export const videoDurationSchema = z.union([
  z.literal(3),
  z.literal(5),
  z.literal(8),
  z.literal(10),
]);

export const videoBrandModelEligibilitySchema = z
  .object({
    personaId: z.string().min(1),
    brandModelId: z.string().min(1),
    lockVersion: z.number().int().positive(),
    identityFingerprint: z.string().min(1),
    identityLocked: z.boolean(),
    videoIdentityReady: z.boolean(),
    videoUseApproved: z.boolean(),
    referenceRightsConfirmed: z.boolean(),
    eligible: z.boolean(),
    blockers: z.array(z.string()),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (
      v.eligible &&
      (!v.identityLocked ||
        !v.videoIdentityReady ||
        !v.videoUseApproved ||
        !v.referenceRightsConfirmed ||
        v.blockers.length)
    )
      ctx.addIssue({
        code: "custom",
        message: "Video eligibility cannot bypass Persona authority.",
      });
  });

export const approvedImageVideoSourceSchema = z
  .object({
    sourceAssetId: z.string().uuid(),
    workspaceId: z.string().uuid(),
    imageProductionProjectId: z.string().uuid(),
    imageGenerationJobId: z.string().uuid(),
    inputFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    checksum: z.string().regex(/^[a-f0-9]{64}$/),
    storagePath: z.string().min(1),
    reviewStatus: z.literal("APPROVED"),
    brandModel: brandModelTraceSchema,
    artwork: z
      .object({
        artworkId: z.string().min(1),
        designId: z.string().min(1),
        version: z.string().min(1),
        checksum: z.string().regex(/^[a-f0-9]{64}$/),
      })
      .strict(),
    product: z
      .object({
        productProfileId: z.string().min(1),
        profileVersion: z.number().int().positive(),
        authority: z.enum(["SHOPIFY_LIVE", "MANUAL_PROFILE"]),
        variantId: z.string().min(1),
      })
      .strict(),
    shotId: z.string().min(1),
    approvedBy: z.string().min(1),
    approvedAt: z.string().datetime(),
    generatedAt: z.string().datetime(),
  })
  .strict();

export const videoDirectionSchema = z
  .object({
    videoType: videoTypeSchema,
    movement: videoMovementSchema,
    customMovement: z.string().max(1000).nullable(),
    camera: videoCameraSchema,
    customCamera: z.string().max(1000).nullable(),
    scene: z.string().min(1).max(1000),
    lighting: z.string().min(1).max(500),
    durationSeconds: videoDurationSchema,
    aspectRatio: videoAspectRatioSchema,
    resolution: z.string().min(1),
    fps: z.number().int().positive().nullable(),
    garmentVisibility: z.enum(["HIGH", "MEDIUM", "LOW"]),
    artworkVisibilityPriority: z.enum(["CRITICAL", "HIGH", "MEDIUM"]),
    pacing: z.enum(["CALM", "BALANCED", "DYNAMIC"]),
    startPose: z.string().max(500).nullable(),
    endPose: z.string().max(500).nullable(),
    loopPreference: z.boolean(),
    platformIntent: z.enum([
      "GENERAL",
      "REELS",
      "TIKTOK",
      "STORY",
      "SOCIAL_FEED",
      "CAMPAIGN",
    ]),
    audioIntent: z.enum(["NONE", "LATER", "PROVIDER"]),
  })
  .strict();

export const videoGenerationInputV1Schema = z
  .object({
    version: z.literal(VIDEO_INPUT_VERSION),
    workspaceId: z.string().uuid(),
    productionMode: videoProductionModeSchema,
    persona: z
      .object({
        trace: brandModelTraceSchema,
        displayName: z.string().min(1),
        eligibility: videoBrandModelEligibilitySchema,
      })
      .strict(),
    product: productProductionBindingV2Schema,
    productVisualInput: productVisualInputSchema,
    artwork: imageMasterArtworkSnapshotSchema,
    sourceVisual: approvedImageVideoSourceSchema,
    direction: videoDirectionSchema,
    production: z
      .object({
        projectId: z.string().uuid(),
        projectVersion: z.number().int().positive(),
        shotId: z.string().min(1),
      })
      .strict(),
    provider: z
      .object({
        provider: z.string().min(1),
        model: z.string().min(1),
        executionMode: z.enum(["FAKE", "REAL"]),
        assetCount: z.literal(1),
        sourceStrategy: z.literal("APPROVED_IMAGE_TO_VIDEO"),
        identityStrategy: z.literal("APPROVED_IMAGE_PLUS_PERSONA_TRACE"),
        productStrategy: z.literal("FROZEN_PRODUCT_REFERENCES"),
        artworkStrategy: z.literal("SOURCE_IMAGE_ONLY_NO_REDRAW_GUARANTEE"),
      })
      .strict(),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.product.productProfileId !== v.productVisualInput.productProfileId)
      ctx.addIssue({
        code: "custom",
        path: ["productVisualInput"],
        message: "Exact Product Profile mismatch.",
      });
    if (
      v.sourceVisual.brandModel.identityFingerprint !==
      v.persona.trace.identityFingerprint
    )
      ctx.addIssue({
        code: "custom",
        path: ["sourceVisual", "brandModel"],
        message: "Approved source Brand Model mismatch.",
      });
    if (v.sourceVisual.artwork.checksum !== v.artwork.checksum)
      ctx.addIssue({
        code: "custom",
        path: ["sourceVisual", "artwork"],
        message: "Approved source Artwork mismatch.",
      });
    if (
      v.sourceVisual.product.productProfileId !== v.product.productProfileId ||
      v.sourceVisual.product.profileVersion !== v.product.profileVersion ||
      v.sourceVisual.product.variantId !== v.product.variantId
    )
      ctx.addIssue({
        code: "custom",
        path: ["sourceVisual", "product"],
        message: "Approved source Product lineage mismatch.",
      });
  });
export type VideoGenerationInputV1 = z.infer<
  typeof videoGenerationInputV1Schema
>;

export const videoEstimateSchema = z
  .object({
    minimum: z.number().nonnegative(),
    maximum: z.number().nonnegative(),
    currency: z.string().length(3),
    basis: z.string().min(1),
    providerCallCount: z.literal(1),
  })
  .strict();
export const VIDEO_JOB_STATUSES = [
  "awaiting_confirmation",
  "confirmed",
  "running",
  "succeeded",
  "failed",
  "unknown_outcome",
  "cancelled",
] as const;
export const videoJobSchema = z
  .object({
    id: z.string().uuid(),
    workspaceId: z.string().uuid(),
    projectId: z.string().uuid(),
    createdBy: z.string().min(1),
    inputSnapshot: videoGenerationInputV1Schema,
    inputFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    estimate: videoEstimateSchema,
    status: z.enum(VIDEO_JOB_STATUSES),
    confirmationExpiresAt: z.string().datetime(),
    confirmedBy: z.string().nullable(),
    confirmedAt: z.string().datetime().nullable(),
    attemptCount: z.number().int().nonnegative(),
    providerRequestId: z.string().nullable(),
    resultAssetId: z.string().uuid().nullable(),
    failureCode: z.string().nullable(),
    failureMessage: z.string().nullable(),
    safeRetryAllowed: z.boolean(),
    unknownOutcomeReason: z.string().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict();
export type VideoJob = z.infer<typeof videoJobSchema>;

export const videoReviewChecklistSchema = z
  .object({
    identity: z.boolean(),
    product: z.boolean(),
    artwork: z.boolean(),
    naturalMovement: z.boolean(),
    camera: z.boolean(),
    productVisible: z.boolean(),
    artworkVisible: z.boolean(),
    noArtifacts: z.boolean(),
    overallQuality: z.boolean(),
  })
  .strict();
export const videoAssetSchema = z
  .object({
    id: z.string().uuid(),
    workspaceId: z.string().uuid(),
    projectId: z.string().uuid(),
    jobId: z.string().uuid(),
    inputFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    storagePath: z.string().min(1),
    checksum: z.string().regex(/^[a-f0-9]{64}$/),
    mimeType: z.string().min(1),
    provider: z.string().min(1),
    model: z.string().min(1),
    providerRequestId: z.string().min(1),
    sourceImageAssetId: z.string().uuid(),
    durationSeconds: z.number().positive(),
    aspectRatio: videoAspectRatioSchema,
    width: z.number().int().positive().nullable(),
    height: z.number().int().positive().nullable(),
    codec: z.string().nullable(),
    container: z.string().nullable(),
    provenance: z.record(z.string(), z.unknown()),
    reviewStatus: z.enum(["REVIEW_REQUIRED", "APPROVED", "REJECTED"]),
    reviewChecklist: videoReviewChecklistSchema.nullable(),
    reviewedBy: z.string().nullable(),
    reviewedAt: z.string().datetime().nullable(),
    reviewNote: z.string().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict();
export type VideoAsset = z.infer<typeof videoAssetSchema>;
export const videoProjectSchema = z
  .object({
    id: z.string().uuid(),
    workspaceId: z.string().uuid(),
    version: z.number().int().positive(),
    name: z.string().min(1),
    status: z.enum([
      "DRAFT",
      "READY",
      "RUNNING",
      "REVIEW",
      "COMPLETE",
      "ARCHIVED",
    ]),
    currentSnapshot: z.record(z.string(), z.unknown()).nullable(),
    createdBy: z.string().min(1),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict();
export type VideoProject = z.infer<typeof videoProjectSchema>;
export function toVideoJobView(job: VideoJob) {
  return {
    ...job,
    inputSnapshot: {
      ...job.inputSnapshot,
      sourceVisual: {
        ...job.inputSnapshot.sourceVisual,
        storagePath: "PRIVATE",
      },
      productVisualInput: {
        ...job.inputSnapshot.productVisualInput,
        referencePackage: {
          ...job.inputSnapshot.productVisualInput.referencePackage,
          references:
            job.inputSnapshot.productVisualInput.referencePackage.references.map(
              (r) => ({ ...r, privateStoragePath: null }),
            ),
        },
      },
    },
  };
}
export function toVideoAssetView(asset: VideoAsset | null) {
  return asset ? { ...asset, storagePath: "PRIVATE" } : null;
}
