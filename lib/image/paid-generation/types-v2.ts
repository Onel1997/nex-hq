import { z } from "zod";

import { IMAGE_GENERATION_PROVIDERS } from "@/agents/image/types-generation";
import {
  imageGenerationInputSnapshotSchema,
  imageMasterArtworkSnapshotSchema,
} from "@/lib/image/paid-generation/types";
import { brandModelTraceSchema } from "@/lib/persona/domain/brand-model-contract";
import {
  normalizedQuadSchema,
  printSurfaceSchema,
} from "@/lib/image/print-surface/types";
import { productVisualInputSchema } from "@/lib/product-library/product-reference-package";
import { productProductionBindingV2Schema } from "@/lib/product-library/types";
import { semanticPrintPlacementSnapshotSchema } from "@/lib/image/semantic-print-placement";
import {
  COMPOSITOR_VERSION_V1,
  COMPOSITOR_VERSION_V2,
  COMPOSITOR_VERSION_V3,
  fabricAwareIntegrationSettingsSchema,
} from "@/lib/image/artwork-compositing/types";
import { socialCreativeDirectionV1Schema } from "@/lib/image/social-creative-direction";
import {
  normalizedPrintAreaSchema,
  ownerArtworkPlacementSchema,
} from "@/lib/product-library/product-family";
import { garmentSegmentationPolicySchema } from "@/lib/image/garment-segmentation/types";
import { STRICT_CONTAIN_FIT_VERSION } from "@/lib/image/artwork-compositing/strict-contain-fit";
import { ownerPrintFootprintSchema } from "@/lib/image/owner-print-footprint";
import { orientedFrontPrintPlanePolicySchema } from "@/lib/image/deterministic-runtime/oriented-front-print-plane-v2";
import { depthEstimationPolicySchema } from "@/lib/image/depth-estimation/types";
import { normalEstimationPolicySchema } from "@/lib/image/normal-estimation/types";
import { printReadyStageAContractSchema } from "@/lib/image/deterministic-runtime/print-ready-stage-a";
import { ownerVerticalPlacementSchema } from "@/lib/image/owner-vertical-placement";

export const IMAGE_GENERATION_INPUT_VERSION_V2 =
  "image-generation-input-v2" as const;
export const IMAGE_PRODUCTION_MODES = [
  "DETERMINISTIC_COMPOSITE",
  "DRAFT_GENERATIVE_ARTWORK",
] as const;

export const baseImageGenerationSettingsSchema = z
  .object({
    provider: z.enum(IMAGE_GENERATION_PROVIDERS),
    model: z.string().min(1),
    dimensions: z.string().min(1),
    quality: z.enum(["low", "medium", "high", "auto"]),
    assetCount: z.literal(1),
    personaStrategy: z.literal("MASTER_IDENTITY_REFERENCE"),
    productStrategy: z.enum([
      "PRODUCT_REFERENCES_AND_METADATA",
      "PRODUCT_METADATA_ONLY",
    ]),
    artworkStrategy: z.enum([
      "NO_MASTER_ARTWORK_INPUT",
      "SECONDARY_MASTER_ARTWORK_REFERENCE",
    ]),
    prompt: z.string().min(1),
  })
  .strict();

export const deterministicCompositingSettingsSchema = z
  .object({
    compositorVersion: z.enum([
      COMPOSITOR_VERSION_V1,
      COMPOSITOR_VERSION_V2,
      COMPOSITOR_VERSION_V3,
    ]),
    artworkPlacementMode: z
      .enum([
        "LEGACY_PERSPECTIVE_FILL",
        "CONTAIN_UNIFORM_ASPECT_LOCKED",
      ])
      .optional(),
    sampling: z.enum(["NEAREST_SOURCE_PIXEL", "BILINEAR_SOURCE_PIXEL"]),
    blending: z.enum([
      "SOURCE_OVER",
      "SOURCE_OVER_WITH_UNIFORM_SHADING",
      "FABRIC_AWARE_PRINT_V1",
    ]),
    shadingFactor: z.number().min(0).max(1),
    fabricIntegration: fabricAwareIntegrationSettingsSchema.optional(),
    artworkContainFit: z
      .object({
        contractVersion: z.literal(STRICT_CONTAIN_FIT_VERSION),
        fitMode: z.literal("CONTAIN"),
        ratioPreserved: z.literal(true),
        cropAllowed: z.literal(false),
        distortionAllowed: z.literal(false),
        failureMode: z.literal("FAIL_CLOSED"),
      })
      .strict()
      .optional(),
    automaticProviderRetryOnCompositeFailure: z.literal(false),
  })
  .strict()
  .superRefine((settings, ctx) => {
    if (
      (settings.compositorVersion === COMPOSITOR_VERSION_V2 ||
        settings.compositorVersion === COMPOSITOR_VERSION_V3) &&
      settings.artworkPlacementMode !== "CONTAIN_UNIFORM_ASPECT_LOCKED"
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["artworkPlacementMode"],
        message:
          "Current compositors require strict uniform aspect-ratio placement.",
      });
    }
    if (
      settings.compositorVersion === COMPOSITOR_VERSION_V3 &&
      !settings.fabricIntegration
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["fabricIntegration"],
        message:
          "Fabric-aware compositor v3 requires frozen integration settings.",
      });
    }
  });

export const printSurfaceProductionOverrideSchema = z
  .object({
    contractVersion: z.literal("print-surface-production-override-v1"),
    basePrintSurfaceId: z.string().min(1),
    basePrintSurfaceVersion: z.number().int().positive(),
    quad: normalizedQuadSchema,
    provenance: z.enum([
      "OWNER_JOB_FINE_TUNING",
      "NEXHQ_FRONT_LARGE_TUNING_V1",
      "NEXHQ_FRONT_LARGE_TUNING_V2",
      "NEXHQ_FRONT_LARGE_TUNING_V3",
      "NEXHQ_FRONT_LARGE_TUNING_V4",
    ]),
  })
  .strict();

export const imageGenerationInputSnapshotV2Schema = z
  .object({
    version: z.literal(IMAGE_GENERATION_INPUT_VERSION_V2),
    productionMode: z.enum(IMAGE_PRODUCTION_MODES),
    workspaceId: z.string().uuid(),
    brandModel: brandModelTraceSchema.extend({
      displayName: z.string().min(1),
      masterIdentityAssetId: z.string().min(1),
    }),
    identityConditioning: z
      .object({
        contractVersion: z.literal("brand-model-production-identity-v1"),
        authoritySource: z.literal("PERSONA_MASTER_IDENTITY_LOCK"),
        identityLockActive: z.literal(true),
        genericIdentityFallbackAllowed: z.literal(false),
        providerStrategy: z.literal(
          "MASTER_PLUS_CANONICAL_SUPPORT_PACKAGE_HIGH_FIDELITY",
        ),
        masterIdentityAssetId: z.string().min(1),
        supportingReferenceCount: z.literal(5),
        referencePackageVersion: z.string().min(1),
        referencePackageFingerprint: z.string().min(1),
        outputConsistencyGate: z
          .object({
            required: z.boolean(),
            contractVersion: z.literal(
              "nexhq-brand-model-identity-consistency-v1",
            ),
            evaluatorVersion: z.literal("local-vladmandic-1.7.x-v1"),
            thresholdVersion: z.literal("v1.0.0"),
            maximumEuclideanDistance: z.literal(0.55),
            failureMode: z.literal("FAIL_CLOSED"),
          })
          .strict(),
      })
      .strict()
      .optional(),
    product: productProductionBindingV2Schema,
    productVisualInput: productVisualInputSchema,
    masterArtwork: imageMasterArtworkSnapshotSchema,
    printSurface: printSurfaceSchema,
    printSurfaceOverride: printSurfaceProductionOverrideSchema.optional(),
    semanticPlacement: semanticPrintPlacementSnapshotSchema.optional(),
    productFamilyPlacement: z
      .object({
        contractVersion: z.literal("product-family-production-placement-v1"),
        productFamilyId: z.string().min(1),
        colorKey: z.string().min(1),
        side: z.enum(["FRONT", "BACK"]),
        placementTemplateId: z.string().min(1),
        placementTemplateVersion: z.number().int().positive(),
        printableArea: normalizedPrintAreaSchema,
        ownerPlacement: ownerArtworkPlacementSchema,
        artworkFit: z
          .object({
            contractVersion: z.literal(STRICT_CONTAIN_FIT_VERSION),
            fitMode: z.literal("CONTAIN"),
            ratioPreserved: z.literal(true),
            cropAllowed: z.literal(false),
            distortionAllowed: z.literal(false),
            failureMode: z.literal("FAIL_CLOSED"),
          })
          .strict()
          .optional(),
        ownerPrintFootprint: ownerPrintFootprintSchema.optional(),
        ownerVerticalPlacement: ownerVerticalPlacementSchema.optional(),
        orientedFrontPrintPlane: orientedFrontPrintPlanePolicySchema.optional(),
        outputMapping: z.enum([
          "GENERATED_GARMENT_RELATIVE_V1",
          "GENERATED_GARMENT_RELATIVE_V2",
          "GENERATED_GARMENT_RELATIVE_V3",
        ]),
      })
      .strict()
      .optional(),
    garmentSegmentationPolicy: garmentSegmentationPolicySchema.optional(),
    normalEstimationPolicy: normalEstimationPolicySchema.optional(),
    depthEstimationPolicy: depthEstimationPolicySchema.optional(),
    printReadyStageA: printReadyStageAContractSchema.optional(),
    shot: z
      .object({
        assetId: z.string().min(1),
        assetType: z.string().min(1),
        title: z.string().min(1),
        scene: z.string().min(1),
        lighting: z.string().min(1),
        poseDirection: z.string().nullable(),
        campaignDirection: z.string().min(1),
      })
      .strict(),
    creativeDirection: socialCreativeDirectionV1Schema.optional(),
    production: z
      .object({
        projectId: z.string().uuid(),
        projectVersion: z.number().int().positive(),
        reportRecordId: z.string().uuid(),
        reportId: z.string().uuid(),
      })
      .strict(),
    baseGeneration: baseImageGenerationSettingsSchema,
    compositing: deterministicCompositingSettingsSchema,
  })
  .strict()
  .superRefine((snapshot, ctx) => {
    if (
      snapshot.identityConditioning &&
      (snapshot.identityConditioning.masterIdentityAssetId !==
        snapshot.brandModel.masterIdentityAssetId ||
        snapshot.identityConditioning.referencePackageVersion !==
          snapshot.brandModel.referencePackageVersion ||
        snapshot.identityConditioning.referencePackageFingerprint !==
          snapshot.brandModel.referencePackageFingerprint)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["identityConditioning"],
        message:
          "Frozen Brand Model conditioning must bind the exact selected Identity Lock package.",
      });
    }
    if (
      snapshot.productionMode === "DETERMINISTIC_COMPOSITE" &&
      snapshot.baseGeneration.artworkStrategy !== "NO_MASTER_ARTWORK_INPUT"
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["baseGeneration", "artworkStrategy"],
        message:
          "Deterministic base generation cannot receive Master Artwork pixels.",
      });
    }
    if (
      snapshot.productionMode === "DRAFT_GENERATIVE_ARTWORK" &&
      snapshot.baseGeneration.artworkStrategy !==
        "SECONDARY_MASTER_ARTWORK_REFERENCE"
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["baseGeneration", "artworkStrategy"],
        message:
          "Draft generative mode must be explicit about its Master Artwork conditioning reference.",
      });
    }
    if (
      snapshot.product.authority === "SHOPIFY_LIVE" &&
      snapshot.productVisualInput.authority !== "SHOPIFY_LIVE"
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["productVisualInput", "authority"],
        message:
          "Live Shopify production context requires a Shopify-live visual input.",
      });
    }
    if (
      snapshot.product.productProfileId !==
      snapshot.productVisualInput.productProfileId
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["productVisualInput", "productProfileId"],
        message:
          "Product visual input must bind the exact frozen Product profile.",
      });
    }
    if (
      snapshot.productVisualInput.contractVersion ===
        "product-visual-input-v2" &&
      snapshot.product.profileVersion !==
        snapshot.productVisualInput.profileVersion
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["productVisualInput", "profileVersion"],
        message:
          "Product visual input must bind the exact Product Profile version.",
      });
    }
    if (
      snapshot.product.shopifyProductId !==
      snapshot.productVisualInput.shopifyProductId
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["productVisualInput", "shopifyProductId"],
        message:
          "Product visual input must bind the exact frozen production product.",
      });
    }
    if (snapshot.product.variantId !== snapshot.productVisualInput.variantId) {
      ctx.addIssue({
        code: "custom",
        path: ["productVisualInput", "variantId"],
        message:
          "Product visual input must bind the exact frozen production variant.",
      });
    }
    if (
      snapshot.baseGeneration.productStrategy ===
        "PRODUCT_REFERENCES_AND_METADATA" &&
      snapshot.productVisualInput.referencePackage.references.length === 0
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["productVisualInput", "referencePackage", "references"],
        message:
          "Product-reference strategy requires at least one frozen reference.",
      });
    }
    for (const [
      index,
      reference,
    ] of snapshot.productVisualInput.referencePackage.references.entries()) {
      if (!reference.contentChecksumSha256 || !reference.privateStoragePath) {
        ctx.addIssue({
          code: "custom",
          path: ["productVisualInput", "referencePackage", "references", index],
          message:
            "Paid v2 inputs require checksummed private Product references frozen before confirmation.",
        });
      }
    }
    if (snapshot.semanticPlacement) {
      if (
        snapshot.semanticPlacement.resolvedPrintSurfaceId !==
          snapshot.printSurface.printSurfaceId ||
        snapshot.semanticPlacement.resolvedPrintSurfaceVersion !==
          snapshot.printSurface.version ||
        snapshot.semanticPlacement.resolvedRegion !==
          snapshot.printSurface.region
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["semanticPlacement"],
          message:
            "Semantic placement must bind the exact frozen PrintSurface identity, version, and region.",
        });
      }
    }
    if (
      snapshot.creativeDirection &&
      snapshot.creativeDirection.shotType !== snapshot.shot.assetId
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["creativeDirection", "shotType"],
        message:
          "Creative direction must bind the exact frozen single shot.",
      });
    }
    if (
      snapshot.garmentSegmentationPolicy &&
      snapshot.productFamilyPlacement?.outputMapping !==
        "GENERATED_GARMENT_RELATIVE_V3"
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["garmentSegmentationPolicy"],
        message:
          "SAM 3 segmentation is frozen only for garment-relative V3 Product Family jobs.",
      });
    }
    if (
      snapshot.normalEstimationPolicy &&
      (!snapshot.garmentSegmentationPolicy ||
        snapshot.productFamilyPlacement?.outputMapping !==
          "GENERATED_GARMENT_RELATIVE_V3" ||
        snapshot.productFamilyPlacement?.orientedFrontPrintPlane?.contractVersion !==
          "nexhq-oriented-front-print-plane-v2.2-normal-assisted")
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["normalEstimationPolicy"],
        message:
          "MiDaS normal evidence is frozen only for SAM-authoritative V3 jobs using normal-assisted oriented registration.",
      });
    }
    if (
      snapshot.depthEstimationPolicy &&
      (!snapshot.garmentSegmentationPolicy ||
        snapshot.productFamilyPlacement?.outputMapping !==
          "GENERATED_GARMENT_RELATIVE_V3" ||
        snapshot.semanticPlacement?.placementPreset !== "FRONT_LARGE" ||
        !snapshot.printReadyStageA)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["depthEstimationPolicy"],
        message:
          "Real depth is frozen only for print-ready V3 FRONT_LARGE jobs with SAM authority.",
      });
    }
    if (
      snapshot.printReadyStageA &&
      (snapshot.semanticPlacement?.placementPreset !== "FRONT_LARGE" ||
        snapshot.productFamilyPlacement?.side !== "FRONT" ||
        !/shirt|tee/i.test(snapshot.product.productType))
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["printReadyStageA"],
        message:
          "Print-ready Stage A v1 applies only to front-facing T-shirt FRONT_LARGE jobs.",
      });
    }
    const ownerFootprint =
      snapshot.productFamilyPlacement?.ownerPrintFootprint;
    if (
      ownerFootprint &&
      (snapshot.productFamilyPlacement?.outputMapping !==
        "GENERATED_GARMENT_RELATIVE_V3" ||
        snapshot.semanticPlacement?.placementPreset !== "FRONT_LARGE" ||
        ownerFootprint.ownerPlacement.templateId !==
          snapshot.productFamilyPlacement.placementTemplateId ||
        ownerFootprint.ownerPlacement.templateVersion !==
          snapshot.productFamilyPlacement.placementTemplateVersion)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["productFamilyPlacement", "ownerPrintFootprint"],
        message:
          "Owner Print Footprint must bind the exact V3 FRONT_LARGE Product Family template.",
      });
    }
    const ownerVertical =
      snapshot.productFamilyPlacement?.ownerVerticalPlacement;
    if (
      ownerVertical &&
      (snapshot.productFamilyPlacement?.side !== "FRONT" ||
        snapshot.semanticPlacement?.placementPreset !==
          ownerVertical.placementPreset ||
        snapshot.productFamilyPlacement.ownerPlacement.uniformScale !==
          ownerVertical.ownerScale ||
        snapshot.productFamilyPlacement.ownerPlacement.offsetX !==
          ownerVertical.ownerOffsetX ||
        snapshot.productFamilyPlacement.ownerPlacement.offsetY !==
          ownerVertical.ownerOffsetY)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["productFamilyPlacement", "ownerVerticalPlacement"],
        message:
          "Owner Vertical Placement must bind the exact frozen front-placement authority.",
      });
    }
    const orientedPlane =
      snapshot.productFamilyPlacement?.orientedFrontPrintPlane;
    if (
      orientedPlane &&
      (snapshot.productFamilyPlacement?.outputMapping !==
        "GENERATED_GARMENT_RELATIVE_V3" ||
        snapshot.productFamilyPlacement.side !== "FRONT" ||
        !/shirt|tee/i.test(snapshot.product.productType) ||
        ![
          "FRONT_LARGE",
          "FRONT_CENTER_CHEST",
          "FRONT_LEFT_CHEST",
        ].includes(snapshot.semanticPlacement?.placementPreset ?? ""))
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["productFamilyPlacement", "orientedFrontPrintPlane"],
        message:
          "Oriented Front Print Plane V2 applies only to supported front T-shirt placements with V3 registration.",
      });
    }
    if (
      snapshot.printSurfaceOverride &&
      (snapshot.printSurfaceOverride.basePrintSurfaceId !==
        snapshot.printSurface.printSurfaceId ||
        snapshot.printSurfaceOverride.basePrintSurfaceVersion !==
          snapshot.printSurface.version)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["printSurfaceOverride"],
        message:
          "A production override must bind the exact canonical PrintSurface version.",
      });
    }
  });

export type ImageGenerationInputSnapshotV2 = z.infer<
  typeof imageGenerationInputSnapshotV2Schema
>;

/** Effective geometry for one job; canonical Product truth remains unchanged. */
export function effectivePrintSurfaceForSnapshot(
  snapshot: ImageGenerationInputSnapshotV2,
) {
  if (!snapshot.printSurfaceOverride) return snapshot.printSurface;
  const [topLeft, topRight, bottomRight] = snapshot.printSurfaceOverride.quad;
  const nexHqRectangle = snapshot.printSurfaceOverride.provenance.startsWith(
    "NEXHQ_FRONT_LARGE_TUNING_",
  );
  return printSurfaceSchema.parse({
    ...snapshot.printSurface,
    quad: snapshot.printSurfaceOverride.quad,
    ...(nexHqRectangle
      ? {
          boundingBox: {
            x: topLeft.x,
            y: topLeft.y,
            width: topRight.x - topLeft.x,
            height: bottomRight.y - topRight.y,
          },
          orientationDegrees: 0,
          perspectiveAnchors: [],
          safeMargin: { top: 0, right: 0, bottom: 0, left: 0 },
          artworkScale: 1,
          rotationDegrees: 0,
          warpMode: "NONE",
        }
      : {}),
    provenance: {
      source: "SHOT_CALIBRATION",
      calibratedBy: null,
      calibratedAt: null,
    },
  });
}
export const anyImageGenerationInputSnapshotSchema = z.union([
  imageGenerationInputSnapshotSchema,
  imageGenerationInputSnapshotV2Schema,
]);
export type AnyImageGenerationInputSnapshot = z.infer<
  typeof anyImageGenerationInputSnapshotSchema
>;

export const mockupReviewDimensionSchema = z.enum([
  "PASS",
  "NEEDS_REVIEW",
  "FAIL",
]);
export const mockupHumanReviewSchema = z
  .object({
    contractVersion: z.literal("mockup-human-review-v1"),
    overallStatus: z.enum(["REVIEW_REQUIRED", "APPROVED", "REJECTED"]),
    identity: mockupReviewDimensionSchema,
    productFidelity: mockupReviewDimensionSchema,
    artworkFidelityExact: mockupReviewDimensionSchema,
    placement: mockupReviewDimensionSchema,
    perspective: mockupReviewDimensionSchema,
    lightingIntegration: mockupReviewDimensionSchema,
    reviewedBy: z.string().min(1).nullable(),
    reviewedAt: z.string().datetime().nullable(),
    note: z.string().nullable(),
  })
  .superRefine((review, ctx) => {
    if (
      review.overallStatus !== "REVIEW_REQUIRED" &&
      (!review.reviewedBy || !review.reviewedAt)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["reviewedBy"],
        message: "Approval or rejection requires a human actor and timestamp.",
      });
    }
  });

export type MockupHumanReview = z.infer<typeof mockupHumanReviewSchema>;
