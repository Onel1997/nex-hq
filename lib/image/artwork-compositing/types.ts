import { z } from "zod";

import { printRegionSchema, printSurfaceSchema } from "@/lib/image/print-surface/types";
import { STRICT_CONTAIN_FIT_VERSION } from "@/lib/image/artwork-compositing/strict-contain-fit";
import {
  OWNER_PRINT_FOOTPRINT_VERSION,
  ownerPrintFootprintSchema,
} from "@/lib/image/owner-print-footprint";
import {
  ownerVerticalPlacementEvidenceSchema,
  ownerVerticalPlacementSchema,
} from "@/lib/image/owner-vertical-placement";
import { orientedFrontPrintPlaneEvidenceSchema } from "@/lib/image/deterministic-runtime/oriented-front-print-plane-v2";

export const COMPOSITOR_VERSION_V1 =
  "nexhq-deterministic-compositor-v1" as const;
export const COMPOSITOR_VERSION_V2 =
  "nexhq-deterministic-compositor-v2" as const;
export const COMPOSITOR_VERSION_V3 =
  "nexhq-deterministic-compositor-v3-fabric-aware-v1" as const;
export const COMPOSITOR_VERSION = COMPOSITOR_VERSION_V3;
export const COMPOSITOR_VERSIONS = [
  COMPOSITOR_VERSION_V1,
  COMPOSITOR_VERSION_V2,
  COMPOSITOR_VERSION_V3,
] as const;
export const ARTWORK_PLACEMENT_MODES = [
  "LEGACY_PERSPECTIVE_FILL",
  "CONTAIN_UNIFORM_ASPECT_LOCKED",
] as const;

export const strictContainFitDiagnosticsSchema = z
  .object({
    contractVersion: z.literal(STRICT_CONTAIN_FIT_VERSION),
    fitMode: z.literal("CONTAIN"),
    originalArtworkWidth: z.number().int().positive(),
    originalArtworkHeight: z.number().int().positive(),
    originalArtworkAspectRatio: z.number().positive(),
    targetPrintableArea: z
      .object({
        x: z.number(),
        y: z.number(),
        width: z.number().positive(),
        height: z.number().positive(),
      })
      .strict(),
    targetPrintableAreaAspectRatio: z.number().positive(),
    baseContainScale: z.number().positive(),
    effectiveUniformScale: z.number().positive(),
    unusedHorizontalSpace: z.number().nonnegative(),
    unusedVerticalSpace: z.number().nonnegative(),
    ownerOffsetX: z.number().min(-1).max(1),
    ownerOffsetY: z.number().min(-1).max(1),
    ownerScale: z.number().positive().max(1),
    ratioPreserved: z.literal(true),
    cropApplied: z.literal(false),
    distortionApplied: z.literal(false),
  })
  .strict();

const footprintPixelRectSchema = z
  .object({
    x: z.number(),
    y: z.number(),
    width: z.number().positive(),
    height: z.number().positive(),
  })
  .strict();

export const ownerPrintFootprintEvidenceSchema = z
  .object({
    contractVersion: z.literal(OWNER_PRINT_FOOTPRINT_VERSION),
    placementPreset: z.literal("FRONT_LARGE"),
    ownerScale: z.number().min(0.1).max(1),
    ownerOffsetX: z.number().min(-1).max(1),
    ownerOffsetY: z.number().min(-1).max(1),
    marketPrintPrintableArea: z
      .object({
        x: z.number(),
        y: z.number(),
        width: z.number().positive(),
        height: z.number().positive(),
      })
      .strict(),
    initialContainedArtworkRectangle: z
      .object({
        x: z.number(),
        y: z.number(),
        width: z.number().positive(),
        height: z.number().positive(),
      })
      .strict(),
    requestedGarmentWidthRatio: z.number().positive().max(1),
    requestedGarmentHeightRatio: z.number().positive().max(1),
    registeredGarmentWidthRatio: z.number().positive().max(1),
    registeredGarmentHeightRatio: z.number().positive().max(1),
    registrationScaleDelta: z.number().min(-1).max(1),
    preSurfaceFootprint: footprintPixelRectSchema,
    postSurfaceFootprint: footprintPixelRectSchema,
    surfaceAverageAreaChange: z.number().min(-1).max(1),
    surfaceWidthChange: z.number().min(-1).max(1),
    surfaceHeightChange: z.number().min(-1).max(1),
    finalGarmentWidthRatio: z.number().positive().max(1),
    finalGarmentHeightRatio: z.number().positive().max(1),
    totalFootprintShrink: z.number().min(0).max(1),
    footprintPreserved: z.boolean(),
    containApplicationCount: z.literal(1),
    safetyClampReasons: z.array(z.string()),
    failureStage: z
      .enum(["REGISTRATION", "SURFACE", "COMPOSITOR"])
      .nullable(),
  })
  .strict();
export const COMPOSITOR_SAMPLING = "BILINEAR_SOURCE_PIXEL" as const;
export const FABRIC_INTEGRATION_MODE_V1 = "FABRIC_AWARE_PRINT_V1" as const;
export const FABRIC_RESPONSE_VERSION_V1_1 =
  "nexhq-fabric-response-v1.1" as const;
export const FABRIC_RESPONSE_VERSION_V1_2 =
  "nexhq-fabric-response-v1.2-surface-conforming" as const;
export const FABRIC_RESPONSE_VERSION_V1_3 =
  "nexhq-fabric-response-v1.3-depth-aware" as const;
export const FABRIC_RESPONSE_VERSION_V1_4 =
  "nexhq-fabric-response-v1.4-surface-realism" as const;
export const SURFACE_CONFORMING_INTEGRATION_VERSION_V1 =
  "nexhq-surface-conforming-integration-v1" as const;
export const DEPTH_AWARE_SURFACE_INTEGRATION_VERSION_V1 =
  "nexhq-depth-aware-surface-integration-v1" as const;
/**
 * New snapshots only. V1.1 replaces the legacy sleeve-sensitive silhouette
 * width heuristic with a SAM/torso/print-neighbourhood masked depth-plane fit.
 * V1 remains parseable and retains its frozen interpretation for old jobs.
 */
export const DEPTH_AWARE_SURFACE_INTEGRATION_VERSION_V1_1 =
  "nexhq-depth-aware-surface-integration-v1.1-garment-plane" as const;
/**
 * New snapshots only. V1.2 distinguishes low-but-stable validated depth from
 * corrupt/contradictory evidence and blends near-planar depth with SAM, torso,
 * and local fabric evidence. V1/V1.1 remain frozen for historical replay.
 */
export const DEPTH_AWARE_SURFACE_INTEGRATION_VERSION_V1_2 =
  "nexhq-depth-aware-surface-integration-v1.2-hybrid-low-depth" as const;
export const SURFACE_REALISM_REFINEMENT_VERSION_V1 =
  "nexhq-surface-realism-refinement-v1" as const;
export const TYPOGRAPHY_DEFORMATION_METRIC_VERSION_V1 =
  "nexhq-typography-deformation-jacobian-v1" as const;

const normalizedContentBoundsSchema = z
  .object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    width: z.number().min(0).max(1),
    height: z.number().min(0).max(1),
  })
  .strict();

const typographyDominantCellSchema = z
  .object({
    row: z.number().int().nonnegative(),
    column: z.number().int().nonnegative(),
    artworkContentCoverage: z.number().min(0).max(1),
    localHorizontalScaleDeviation: z.number().nonnegative(),
    localVerticalScaleDeviation: z.number().nonnegative(),
    principalScaleDeviation: z.number().nonnegative(),
    localShear: z.number().nonnegative(),
    localAngularDistortionDegrees: z.number().nonnegative(),
    localRotationDegrees: z.number(),
    localAreaScaleDeviation: z.number().nonnegative(),
    neighborJacobianDiscontinuity: z.number().nonnegative(),
    risk: z.number().nonnegative(),
  })
  .strict();

export const typographyDeformationAnalysisSchema = z
  .object({
    metricVersion: z.literal(TYPOGRAPHY_DEFORMATION_METRIC_VERSION_V1),
    contentBoundsNormalized: normalizedContentBoundsSchema.nullable(),
    activeCellCount: z.number().int().nonnegative(),
    ignoredTransparentCellCount: z.number().int().nonnegative(),
    maximumLocalHorizontalScaleDeviation: z.number().nonnegative(),
    maximumLocalVerticalScaleDeviation: z.number().nonnegative(),
    maximumPrincipalScaleDeviation: z.number().nonnegative(),
    maximumLocalShear: z.number().nonnegative(),
    maximumLocalAngularDistortionDegrees: z.number().nonnegative(),
    maximumLocalRotationDegrees: z.number().nonnegative(),
    maximumLocalAreaScaleDeviation: z.number().nonnegative(),
    maximumNeighborJacobianDiscontinuity: z.number().nonnegative(),
    dominantCells: z.array(typographyDominantCellSchema).max(6),
  })
  .strict();

export const surfaceConformingIntegrationSettingsSchema = z
  .object({
    contractVersion: z.literal(SURFACE_CONFORMING_INTEGRATION_VERSION_V1),
    gridColumns: z.number().int().min(5).max(11),
    gridRows: z.number().int().min(5).max(13),
    maximumWarpRatio: z.number().positive().max(0.02),
    silhouetteResponse: z.number().min(0).max(1),
    curvatureResponse: z.number().min(0).max(1),
    foldResponse: z.number().min(0).max(1),
    minimumMaskCoverage: z.number().min(0.98).max(1),
    maximumTypographyDistortion: z.number().positive().max(0.08),
    minimumRealismConfidence: z.number().min(0.5).max(0.9),
  })
  .strict();

export const surfaceIntegrationEvidenceSchema = z
  .object({
    contractVersion: z.literal(SURFACE_CONFORMING_INTEGRATION_VERSION_V1),
    status: z.enum(["READY", "REFUSED"]),
    reason: z.enum([
      "READY",
      "GARMENT_MASK_REQUIRED",
      "PRINT_REGION_TOO_SMALL",
      "MASK_COVERAGE_UNSAFE",
      "SURFACE_EVIDENCE_INSUFFICIENT",
      "EXTREME_SURFACE_GEOMETRY",
      "EXCESSIVE_WARP_REQUIRED",
      "TYPOGRAPHY_DISTORTION_RISK",
    ]),
    warpEnabled: z.boolean(),
    warpStrength: z.number().min(0).max(0.02),
    maximumAppliedWarpPx: z.number().nonnegative(),
    clampReasons: z.array(
      z.enum([
        "MAXIMUM_WARP_BOUND",
        "GARMENT_EDGE_ENVELOPE",
        "TYPOGRAPHY_SAFETY_BOUND",
      ]),
    ),
    curvatureEvidence: z.number().min(0).max(1),
    foldResponseEvidence: z.number().min(0).max(1),
    shadingResponseEvidence: z.number().min(0).max(1),
    textureResponseEvidence: z.number().min(0).max(1),
    maskClippingCoverage: z.number().min(0).max(1),
    effectivePrintRealismConfidence: z.number().min(0).max(1),
    surfaceEvidenceConfidence: z
      .object({
        metricVersion: z.literal(
          "nexhq-surface-evidence-confidence-v1",
        ),
        interpretation: z.literal("SURFACE_EVIDENCE_RELIABILITY"),
        maskReliability: z.number().min(0).max(1),
        geometryStability: z.number().min(0).max(1),
        unclampedNodeFraction: z.number().min(0).max(1),
        typographyUsesSeparateHardGate: z.literal(true),
      })
      .strict()
      .optional(),
    flatOverlayRisk: z.number().min(0).max(1),
    typographyDistortionEstimate: z.number().min(0).max(1),
    typographyDeformation:
      typographyDeformationAnalysisSchema.optional(),
    meshRegularization: z
      .object({
        passes: z.number().int().positive(),
        rawMaximumAppliedWarpPx: z.number().nonnegative(),
        appliedMaximumWarpPx: z.number().nonnegative(),
        rawLegacyNeighborGradientEstimate: z.number().nonnegative(),
        rawJacobianDistortionEstimate: z.number().nonnegative(),
        appliedJacobianDistortionEstimate: z.number().nonnegative(),
        dominantLegacyEdges: z
          .array(
            z
              .object({
                direction: z.enum(["HORIZONTAL", "VERTICAL"]),
                row: z.number().int().nonnegative(),
                column: z.number().int().nonnegative(),
                displacementDeltaPx: z.number().nonnegative(),
                cellSpanPx: z.number().positive(),
                normalizedGradient: z.number().nonnegative(),
              })
              .strict(),
          )
          .max(6),
      })
      .strict()
      .optional(),
    gridColumns: z.number().int().positive(),
    gridRows: z.number().int().positive(),
    deterministic: z.literal(true),
    sourceAuthorityPreserved: z.literal(true),
    failClosedReason: z.string().min(1).nullable(),
  })
  .strict();

export type SurfaceIntegrationEvidence = z.infer<
  typeof surfaceIntegrationEvidenceSchema
>;
export type TypographyDeformationAnalysis = z.infer<
  typeof typographyDeformationAnalysisSchema
>;

export const depthAwareSurfaceIntegrationSettingsSchema = z
  .object({
    contractVersion: z.enum([
      DEPTH_AWARE_SURFACE_INTEGRATION_VERSION_V1,
      DEPTH_AWARE_SURFACE_INTEGRATION_VERSION_V1_1,
      DEPTH_AWARE_SURFACE_INTEGRATION_VERSION_V1_2,
    ]),
    gridColumns: z.number().int().min(5).max(11),
    gridRows: z.number().int().min(5).max(13),
    maximumLocalWarpRatio: z.number().positive().max(0.015),
    planeResponse: z.number().min(0).max(1),
    perspectiveResponse: z.number().min(0).max(1),
    relativeDepthResponse: z.number().min(0).max(1),
    minimumMaskCoverage: z.number().min(0.98).max(1),
    minimumDepthConfidence: z.number().min(0.45).max(0.9),
    minimumSurfaceConfidence: z.number().min(0.5).max(0.9),
    maximumTypographyDistortion: z.number().positive().max(0.08),
  })
  .strict();

export const depthAwareSurfaceEvidenceSchema = z
  .object({
    contractVersion: z.enum([
      DEPTH_AWARE_SURFACE_INTEGRATION_VERSION_V1,
      DEPTH_AWARE_SURFACE_INTEGRATION_VERSION_V1_1,
      DEPTH_AWARE_SURFACE_INTEGRATION_VERSION_V1_2,
    ]),
    status: z.enum(["READY", "REFUSED"]),
    reason: z.enum([
      "READY",
      "GARMENT_MASK_REQUIRED",
      "PRINT_REGION_TOO_SMALL",
      "MASK_COVERAGE_UNSAFE",
      "DEPTH_EVIDENCE_INSUFFICIENT",
      "SURFACE_CONFIDENCE_INSUFFICIENT",
      "UNSAFE_LOCAL_WARP_REQUIRED",
      "TYPOGRAPHY_DISTORTION_RISK",
    ]),
    estimator: z.enum([
      "LOCAL_STAGE_A_RELATIVE_DEPTH_V1",
      "REAL_DEPTH_ANYTHING_V2",
    ]),
    realDepth: z
      .object({
        provider: z.literal("fal"),
        model: z.string().min(1),
        adapterVersion: z.string().min(1),
        depthMapChecksumSha256: z.string().regex(/^[a-f0-9]{64}$/i),
        sourceBaseChecksumSha256: z.string().regex(/^[a-f0-9]{64}$/i),
        dynamicRange: z.number().min(0).max(1),
        discontinuityFraction: z.number().min(0).max(1).optional(),
        minimumDynamicRange: z.number().min(0).max(1).optional(),
        maximumDiscontinuityFraction: z.number().min(0).max(1).optional(),
        localCrossCheckWeight: z.number().min(0).max(1),
      })
      .strict()
      .optional(),
    depthEvidenceAvailable: z.boolean(),
    localPlaneTiltDegrees: z.number().min(-15).max(15),
    localPerspectiveEstimate: z.number().min(0).max(1),
    depthConfidence: z.number().min(0).max(1),
    surfaceConfidence: z.number().min(0).max(1),
    depthQualityClassification: z
      .enum([
        "DEPTH_STRONG",
        "DEPTH_MODERATE",
        "DEPTH_LOW_STABLE",
        "DEPTH_UNSAFE",
      ])
      .optional(),
    surfaceGuidanceMode: z
      .enum([
        "REAL_DEPTH_DOMINANT",
        "HYBRID",
        "NEAR_PLANAR_HYBRID",
        "REFUSED",
      ])
      .optional(),
    realDepthConfidence: z.number().min(0).max(1).optional(),
    torsoStability: z.number().min(0).max(1).optional(),
    localFabricEvidence: z.number().min(0).max(1).optional(),
    depthDiscontinuityStability: z.number().min(0).max(1).optional(),
    depthSampleCoverage: z.number().min(0).max(1).optional(),
    blendedSurfaceConfidence: z.number().min(0).max(1).optional(),
    appliedLocalWarpStrength: z.number().min(0).max(0.02),
    maximumLocalWarpPx: z.number().nonnegative(),
    requestedMaximumLocalWarpPx: z.number().nonnegative().optional(),
    safeBoundedMaximumLocalWarpPx: z.number().nonnegative().optional(),
    rejectedWarpExcessPx: z.number().nonnegative().optional(),
    nodesExceedingBounds: z.number().int().nonnegative().optional(),
    analyzedNodeCount: z.number().int().nonnegative().optional(),
    nodesExceedingBoundsFraction: z.number().min(0).max(1).optional(),
    perspectiveNormalizationDenominator: z.number().positive().optional(),
    requestedPerspectiveWarpPx: z.number().nonnegative().optional(),
    rawDepthPlaneSlopeX: z.number().optional(),
    rawDepthPlaneSlopeY: z.number().optional(),
    normalizedDepthPlaneSlopeX: z.number().optional(),
    normalizedDepthPlaneSlopeY: z.number().optional(),
    robustDepthRange: z.number().nonnegative().optional(),
    depthPlaneSampleCount: z.number().int().nonnegative().optional(),
    depthPlaneRejectedSampleCount: z.number().int().nonnegative().optional(),
    depthPlaneFitMethod: z
      .enum([
        "LEGACY_MASK_WIDTH_SLOPE_V1",
        "GARMENT_MASKED_ROBUST_DEPTH_PLANE_V1",
      ])
      .optional(),
    depthAnalysisScope: z
      .enum([
        "LEGACY_FULL_GARMENT_SPAN",
        "SAM_TORSO_PRINT_NEIGHBORHOOD",
      ])
      .optional(),
    typographyRisk: z.number().min(0).max(1),
    globalFootprintPreserved: z.literal(true),
    secondaryScaleApplied: z.literal(false),
    secondaryTranslationApplied: z.literal(false),
    maskCoverage: z.number().min(0).max(1),
    clampReasons: z.array(
      z.enum([
        "LOCAL_WARP_BOUND",
        "FOOTPRINT_BOUNDARY_PINNED",
        "TYPOGRAPHY_SAFETY_BOUND",
      ]),
    ),
    deterministic: z.literal(true),
    sourceBaseOnly: z.literal(true),
    sourceAuthorityPreserved: z.literal(true),
    failClosedReason: z.string().min(1).nullable(),
  })
  .strict();

export type DepthAwareSurfaceIntegrationSettings = z.infer<
  typeof depthAwareSurfaceIntegrationSettingsSchema
>;
export type DepthAwareSurfaceEvidence = z.infer<
  typeof depthAwareSurfaceEvidenceSchema
>;

export const surfaceRealismRefinementSettingsSchema = z
  .object({
    contractVersion: z.literal(SURFACE_REALISM_REFINEMENT_VERSION_V1),
    maximumAdditionalWarpRatio: z.number().positive().max(0.006),
    planeOrientationResponse: z.number().min(0).max(1),
    surfaceDirectionResponse: z.number().min(0).max(1),
    curvatureResponse: z.number().min(0).max(1),
    minimumEvidenceConfidence: z.number().min(0.45).max(0.9),
    maximumTypographyDistortion: z.number().positive().max(0.08),
    shadingTransferStrength: z.number().min(0).max(0.35),
    textureTransferStrength: z.number().min(0).max(0.2),
    shadingNormalizationRange: z.number().min(32).max(128),
  })
  .strict();

export type SurfaceRealismRefinementSettings = z.infer<
  typeof surfaceRealismRefinementSettingsSchema
>;

export const surfaceRealismRefinementEvidenceSchema = z
  .object({
    contractVersion: z.literal(SURFACE_REALISM_REFINEMENT_VERSION_V1),
    status: z.enum(["READY", "REFUSED"]),
    reason: z.enum([
      "READY",
      "GARMENT_MASK_REQUIRED",
      "PRINT_REGION_TOO_SMALL",
      "SURFACE_DIRECTION_EVIDENCE_INSUFFICIENT",
      "UNSAFE_REFINEMENT_REQUIRED",
      "TYPOGRAPHY_DISTORTION_RISK",
    ]),
    strongerPlaneGuidanceUsed: z.boolean(),
    realDepthUsed: z.boolean(),
    localFallbackUsed: z.boolean(),
    surfaceDirectionEvidenceUsed: z.boolean(),
    footprintPinned: z.literal(true),
    registeredYPreserved: z.literal(true),
    secondContainApplied: z.literal(false),
    secondGlobalScaleApplied: z.literal(false),
    secondGlobalTranslationApplied: z.literal(false),
    horizontalSurfaceSlope: z.number().min(-2).max(2),
    verticalSurfaceSlope: z.number().min(-2).max(2),
    planeGuidanceStrength: z.number().min(0).max(1),
    perspectiveGuidanceStrength: z.number().min(0).max(1),
    curvatureEvidence: z.number().min(0).max(1),
    evidenceConfidence: z.number().min(0).max(1),
    localWarpStrength: z.number().min(0).max(0.02),
    maximumLocalWarpPx: z.number().nonnegative(),
    shadingTransferStrength: z.number().min(0).max(0.35),
    textureTransferStrength: z.number().min(0).max(0.2),
    typographyRisk: z.number().min(0).max(1),
    maskCoverage: z.number().min(0).max(1),
    clampedNodeFraction: z.number().min(0).max(1),
    deterministic: z.literal(true),
    sourceAuthorityPreserved: z.literal(true),
    failClosedReason: z.string().min(1).nullable(),
  })
  .strict();

export type SurfaceRealismRefinementEvidence = z.infer<
  typeof surfaceRealismRefinementEvidenceSchema
>;

export const fabricAwareIntegrationSettingsSchema = z
  .object({
    mode: z.literal(FABRIC_INTEGRATION_MODE_V1),
    maxDisplacementRatio: z.number().min(0).max(0.02),
    lightingStrength: z.number().min(0).max(0.35),
    textureStrength: z.number().min(0).max(0.2),
    inkOpacity: z.number().min(0.9).max(1),
    responseVersion: z
      .enum([
        FABRIC_RESPONSE_VERSION_V1_1,
        FABRIC_RESPONSE_VERSION_V1_2,
        FABRIC_RESPONSE_VERSION_V1_3,
        FABRIC_RESPONSE_VERSION_V1_4,
      ])
      .optional(),
    displacementResponse: z.number().min(1).max(1.2).optional(),
    shadingRange: z.number().min(0.16).max(0.22).optional(),
    surfaceConforming: surfaceConformingIntegrationSettingsSchema.optional(),
    depthAware: depthAwareSurfaceIntegrationSettingsSchema.optional(),
    surfaceRealismRefinement:
      surfaceRealismRefinementSettingsSchema.optional(),
  })
  .strict()
  .superRefine((settings, ctx) => {
    if (
      settings.surfaceConforming &&
      settings.surfaceConforming.maximumWarpRatio >
        settings.maxDisplacementRatio
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["surfaceConforming", "maximumWarpRatio"],
        message:
          "Surface-conforming warp must remain inside the frozen fabric displacement bound.",
      });
    }
    if (settings.depthAware && !settings.surfaceConforming) {
      ctx.addIssue({
        code: "custom",
        path: ["depthAware"],
        message:
          "Depth-aware integration is additive and requires the frozen Surface-Conforming contract.",
      });
    }
    if (
      settings.depthAware &&
      settings.depthAware.maximumLocalWarpRatio >
        settings.maxDisplacementRatio
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["depthAware", "maximumLocalWarpRatio"],
        message:
          "Depth-aware local warp must remain inside the frozen fabric displacement bound.",
      });
    }
    if (settings.surfaceRealismRefinement && !settings.depthAware) {
      ctx.addIssue({
        code: "custom",
        path: ["surfaceRealismRefinement"],
        message:
          "Surface realism refinement is additive and requires the frozen depth-aware contract.",
      });
    }
  });

export type FabricAwareIntegrationSettings = z.infer<
  typeof fabricAwareIntegrationSettingsSchema
>;

export const DEFAULT_FABRIC_AWARE_INTEGRATION: FabricAwareIntegrationSettings =
  Object.freeze({
    mode: FABRIC_INTEGRATION_MODE_V1,
    maxDisplacementRatio: 0.02,
    lightingStrength: 0.35,
    textureStrength: 0.2,
    inkOpacity: 0.92,
    responseVersion: FABRIC_RESPONSE_VERSION_V1_1,
    displacementResponse: 1.12,
    shadingRange: 0.2,
  });

/**
 * New Product Family jobs only. Older frozen jobs do not contain the additive
 * surfaceConforming contract and retain the V1/V1.1 pixel response exactly.
 */
export const DEFAULT_SURFACE_CONFORMING_FABRIC_INTEGRATION: FabricAwareIntegrationSettings =
  Object.freeze({
    ...DEFAULT_FABRIC_AWARE_INTEGRATION,
    responseVersion: FABRIC_RESPONSE_VERSION_V1_2,
    surfaceConforming: Object.freeze({
      contractVersion: SURFACE_CONFORMING_INTEGRATION_VERSION_V1,
      gridColumns: 7,
      gridRows: 9,
      maximumWarpRatio: 0.016,
      silhouetteResponse: 0.42,
      curvatureResponse: 0.58,
      foldResponse: 0.68,
      minimumMaskCoverage: 0.985,
      maximumTypographyDistortion: 0.075,
      minimumRealismConfidence: 0.62,
    }),
  });

/**
 * New T-shirt Product Family jobs only. This freezes the additive local depth
 * guidance while leaving every historical V1/V1.1/V1.2 snapshot untouched.
 */
export const DEFAULT_DEPTH_AWARE_SURFACE_INTEGRATION: FabricAwareIntegrationSettings =
  Object.freeze({
    ...DEFAULT_SURFACE_CONFORMING_FABRIC_INTEGRATION,
    responseVersion: FABRIC_RESPONSE_VERSION_V1_3,
    depthAware: Object.freeze({
      contractVersion: DEPTH_AWARE_SURFACE_INTEGRATION_VERSION_V1_2,
      gridColumns: 7,
      gridRows: 9,
      maximumLocalWarpRatio: 0.012,
      planeResponse: 0.72,
      perspectiveResponse: 0.6,
      relativeDepthResponse: 0.48,
      minimumMaskCoverage: 0.985,
      minimumDepthConfidence: 0.54,
      minimumSurfaceConfidence: 0.6,
      maximumTypographyDistortion: 0.075,
    }),
  });

/**
 * New jobs carrying the explicit owner-vertical-placement authority receive a
 * modestly stronger local response. The outer mesh remains pinned and all
 * global placement counts remain one; historical frozen settings are untouched.
 */
export const DEFAULT_OWNER_VERTICAL_DEPTH_AWARE_SURFACE_INTEGRATION: FabricAwareIntegrationSettings =
  Object.freeze({
    ...DEFAULT_DEPTH_AWARE_SURFACE_INTEGRATION,
    depthAware: Object.freeze({
      ...DEFAULT_DEPTH_AWARE_SURFACE_INTEGRATION.depthAware!,
      maximumLocalWarpRatio: 0.013,
      planeResponse: 0.78,
      perspectiveResponse: 0.66,
      relativeDepthResponse: 0.52,
    }),
  });

/**
 * New eligible T-shirt FRONT_LARGE jobs only. The refinement adds bounded
 * interior plane/normal guidance and stronger scalar light/texture transfer;
 * it cannot alter the pinned owner footprint or the frozen typography gate.
 */
export const DEFAULT_SURFACE_REALISM_REFINEMENT_INTEGRATION: FabricAwareIntegrationSettings =
  Object.freeze({
    ...DEFAULT_OWNER_VERTICAL_DEPTH_AWARE_SURFACE_INTEGRATION,
    responseVersion: FABRIC_RESPONSE_VERSION_V1_4,
    surfaceRealismRefinement: Object.freeze({
      contractVersion: SURFACE_REALISM_REFINEMENT_VERSION_V1,
      maximumAdditionalWarpRatio: 0.0045,
      planeOrientationResponse: 0.86,
      surfaceDirectionResponse: 0.64,
      curvatureResponse: 0.52,
      minimumEvidenceConfidence: 0.56,
      maximumTypographyDistortion: 0.075,
      shadingTransferStrength: 0.28,
      textureTransferStrength: 0.12,
      shadingNormalizationRange: 78,
    }),
  });

export const artworkFidelityContractV1Schema = z.object({
  contractVersion: z.literal("artwork-fidelity-v1"),
  sourceChecksumSha256: z.string().regex(/^[a-f0-9]{64}$/i),
  prohibitedMutations: z.tuple([
    z.literal("TEXT_REWRITE"),
    z.literal("LOGO_REPLACEMENT"),
    z.literal("ELEMENT_REMOVAL"),
    z.literal("ELEMENT_ADDITION"),
    z.literal("RELATIVE_LAYOUT_CHANGE"),
  ]),
  allowedTransforms: z.tuple([
    z.literal("SCALING"),
    z.literal("ROTATION"),
    z.literal("PERSPECTIVE_WARP"),
    z.literal("CLIPPING"),
    z.literal("ALPHA_BLEND"),
    z.literal("PHYSICAL_SHADING"),
    z.literal("PHYSICAL_DISPLACEMENT"),
  ]),
});

export const artworkFidelityContractV2Schema = z.object({
  contractVersion: z.literal("artwork-fidelity-v2"),
  sourceChecksumSha256: z.string().regex(/^[a-f0-9]{64}$/i),
  aspectRatioLocked: z.literal(true),
  prohibitedMutations: z.tuple([
    z.literal("TEXT_REWRITE"),
    z.literal("LOGO_REPLACEMENT"),
    z.literal("ELEMENT_REMOVAL"),
    z.literal("ELEMENT_ADDITION"),
    z.literal("RELATIVE_LAYOUT_CHANGE"),
    z.literal("NON_UNIFORM_SCALE"),
    z.literal("ROTATION"),
    z.literal("PERSPECTIVE_WARP"),
  ]),
  allowedTransforms: z.tuple([
    z.literal("TRANSLATION"),
    z.literal("UNIFORM_SCALING"),
    z.literal("CLIPPING"),
    z.literal("ALPHA_BLEND"),
    z.literal("UNIFORM_PHYSICAL_SHADING"),
  ]),
});

export const artworkFidelityContractV3Schema = z.object({
  contractVersion: z.literal("artwork-fidelity-v3-fabric-aware-v1"),
  sourceChecksumSha256: z.string().regex(/^[a-f0-9]{64}$/i),
  aspectRatioLocked: z.literal(true),
  prohibitedMutations: z.tuple([
    z.literal("TEXT_REWRITE"),
    z.literal("LOGO_REPLACEMENT"),
    z.literal("ELEMENT_REMOVAL"),
    z.literal("ELEMENT_ADDITION"),
    z.literal("RELATIVE_LAYOUT_CHANGE"),
    z.literal("NON_UNIFORM_GLOBAL_SCALE"),
    z.literal("ROTATION"),
    z.literal("UNBOUNDED_WARP"),
  ]),
  allowedTransforms: z.tuple([
    z.literal("TRANSLATION"),
    z.literal("UNIFORM_SCALING"),
    z.literal("BOUNDED_PHYSICAL_DISPLACEMENT"),
    z.literal("LOCAL_PHYSICAL_SHADING"),
    z.literal("ALPHA_BLEND"),
  ]),
  maximumDisplacementRatio: z.number().min(0).max(0.02),
});

export const artworkFidelityContractSchema = z.union([
  artworkFidelityContractV2Schema,
  artworkFidelityContractV3Schema,
]);

export const compositingProvenanceSchema = z.object({
  contractVersion: z.literal("compositing-provenance-v1"),
  compositorVersion: z.enum(COMPOSITOR_VERSIONS),
  masterArtworkId: z.string().uuid(),
  masterArtworkVersion: z.string().min(1),
  masterArtworkChecksumSha256: z.string().regex(/^[a-f0-9]{64}$/i),
  baseImageId: z.string().min(1),
  baseImageChecksumSha256: z.string().regex(/^[a-f0-9]{64}$/i),
  printSurfaceId: z.string().min(1),
  targetPrintRegion: printRegionSchema,
  transformMatrix: z.array(z.number()).length(9),
  blendingStrategy: z.enum([
    "SOURCE_OVER",
    "SOURCE_OVER_WITH_UNIFORM_SHADING",
    "FABRIC_AWARE_PRINT_V1",
  ]),
  shadingFactor: z.number().min(0).max(1),
  samplingStrategy: z.literal("BILINEAR_SOURCE_PIXEL"),
  sourceWidth: z.number().int().positive(),
  sourceHeight: z.number().int().positive(),
  outputWidth: z.number().int().positive(),
  outputHeight: z.number().int().positive(),
  printRegionWidth: z.number().int().positive(),
  printRegionHeight: z.number().int().positive(),
  outputChecksumSha256: z.string().regex(/^[a-f0-9]{64}$/i),
  createdAt: z.string().datetime(),
  artworkPlacementMode: z.enum(ARTWORK_PLACEMENT_MODES).optional(),
  sourceAspectRatio: z.number().positive().optional(),
  effectiveUniformScale: z.number().positive().optional(),
  appliedArtworkRect: z
    .object({
      x: z.number(),
      y: z.number(),
      width: z.number().positive(),
      height: z.number().positive(),
    })
    .strict()
    .optional(),
  containFit: strictContainFitDiagnosticsSchema.optional(),
  ownerPrintFootprint: ownerPrintFootprintEvidenceSchema.optional(),
  ownerVerticalPlacement: ownerVerticalPlacementEvidenceSchema.optional(),
  orientedFrontPrintPlane: orientedFrontPrintPlaneEvidenceSchema.optional(),
  fabricIntegration: z
    .object({
      mode: z.literal(FABRIC_INTEGRATION_MODE_V1),
      maxDisplacementRatio: z.number().min(0).max(0.02),
      maxAppliedDisplacementPx: z.number().nonnegative(),
      lightingStrength: z.number().min(0).max(0.35),
      textureStrength: z.number().min(0).max(0.2),
      inkOpacity: z.number().min(0.9).max(1),
      responseVersion: z
        .enum([
          FABRIC_RESPONSE_VERSION_V1_1,
          FABRIC_RESPONSE_VERSION_V1_2,
          FABRIC_RESPONSE_VERSION_V1_3,
          FABRIC_RESPONSE_VERSION_V1_4,
        ])
        .optional(),
      displacementResponse: z.number().min(1).max(1.2).optional(),
      shadingRange: z.number().min(0.16).max(0.22).optional(),
      surfaceConforming: surfaceConformingIntegrationSettingsSchema.optional(),
      surfaceIntegration: surfaceIntegrationEvidenceSchema.optional(),
      depthAware: depthAwareSurfaceIntegrationSettingsSchema.optional(),
      depthAwareIntegration: depthAwareSurfaceEvidenceSchema.optional(),
      surfaceRealismRefinement:
        surfaceRealismRefinementSettingsSchema.optional(),
      surfaceRealismRefinementEvidence:
        surfaceRealismRefinementEvidenceSchema.optional(),
      minimumAppliedShading: z.number().positive(),
      maximumAppliedShading: z.number().positive(),
      sourceAuthorityPreserved: z.literal(true),
    })
    .strict()
    .optional(),
  garmentMaskClipping: z
    .object({
      contractVersion: z.literal("garment-mask-clipping-v1"),
      maskChecksumSha256: z.string().regex(/^[a-f0-9]{64}$/i),
      sourceBaseChecksumSha256: z.string().regex(/^[a-f0-9]{64}$/i),
      maskWidth: z.number().int().positive(),
      maskHeight: z.number().int().positive(),
      appliedRectMaskCoverage: z.number().min(0).max(1),
      clippedOutputPixelCount: z.number().int().nonnegative(),
      everyAppliedPixelInsideMask: z.literal(true),
    })
    .strict()
    .optional(),
}).superRefine((provenance, ctx) => {
  if (
    provenance.compositorVersion !== COMPOSITOR_VERSION_V2 &&
    provenance.compositorVersion !== COMPOSITOR_VERSION_V3
  )
    return;
  if (provenance.artworkPlacementMode !== "CONTAIN_UNIFORM_ASPECT_LOCKED") {
    ctx.addIssue({
      code: "custom",
      path: ["artworkPlacementMode"],
      message: "Current compositor requires strict uniform aspect-ratio placement.",
    });
  }
  for (const field of [
    "sourceAspectRatio",
    "effectiveUniformScale",
    "appliedArtworkRect",
  ] as const) {
    if (provenance[field] === undefined) {
      ctx.addIssue({
        code: "custom",
        path: [field],
        message: `Current compositor provenance requires ${field}.`,
      });
    }
  }
  if (
    provenance.compositorVersion === COMPOSITOR_VERSION_V3 &&
    !provenance.fabricIntegration
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["fabricIntegration"],
      message: "Fabric-aware compositor v3 requires bounded integration provenance.",
    });
  }
  if (
    provenance.fabricIntegration?.depthAware &&
    !provenance.fabricIntegration.depthAwareIntegration
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["fabricIntegration", "depthAwareIntegration"],
      message:
        "Frozen depth-aware settings require truthful applied integration provenance.",
    });
  }
  if (
    provenance.fabricIntegration?.surfaceRealismRefinement &&
    !provenance.fabricIntegration.surfaceRealismRefinementEvidence
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["fabricIntegration", "surfaceRealismRefinementEvidence"],
      message:
        "Frozen surface-realism settings require truthful refinement provenance.",
    });
  }
  if (
    provenance.fabricIntegration?.surfaceRealismRefinement &&
    (!provenance.ownerPrintFootprint || !provenance.ownerVerticalPlacement)
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["fabricIntegration", "surfaceRealismRefinement"],
      message:
        "Surface-realism provenance requires frozen footprint and vertical-placement evidence.",
    });
  }
});

export const deterministicCompositeRequestSchema = z.object({
  compositorVersion: z.enum(COMPOSITOR_VERSIONS).default(COMPOSITOR_VERSION),
  artwork: z.object({
    id: z.string().uuid(),
    version: z.string().min(1),
    checksumSha256: z.string().regex(/^[a-f0-9]{64}$/i),
    bytes: z.instanceof(Buffer),
  }),
  baseImage: z.object({
    id: z.string().min(1),
    checksumSha256: z.string().regex(/^[a-f0-9]{64}$/i),
    bytes: z.instanceof(Buffer),
  }),
  printSurface: printSurfaceSchema,
  shadingFactor: z.number().min(0).max(1).default(1),
  fabricIntegration: fabricAwareIntegrationSettingsSchema.optional(),
  artworkContainPlacement: z
    .object({
      contractVersion: z.literal(STRICT_CONTAIN_FIT_VERSION),
      fitMode: z.literal("CONTAIN"),
      uniformScale: z.number().positive().max(1),
      offsetX: z.number().min(-1).max(1),
      offsetY: z.number().min(-1).max(1),
    })
    .strict()
    .optional(),
  ownerPrintFootprint: z
    .object({
      contract: ownerPrintFootprintSchema,
      garmentBodyBounds: z
        .object({
          x: z.number(),
          y: z.number(),
          width: z.number().positive(),
          height: z.number().positive(),
        })
        .strict(),
      requestedWidthRatio: z.number().positive().max(1),
      requestedHeightRatio: z.number().positive().max(1),
      registeredWidthRatio: z.number().positive().max(1),
      registeredHeightRatio: z.number().positive().max(1),
      registrationScaleDelta: z.number().min(-1).max(1),
      registrationClampReasons: z.array(z.string()),
    })
    .strict()
    .optional(),
  ownerVerticalPlacement: z
    .object({
      contract: ownerVerticalPlacementSchema,
      garmentBodyBounds: z
        .object({
          x: z.number(),
          y: z.number(),
          width: z.number().positive(),
          height: z.number().positive(),
        })
        .strict(),
      registeredY: z.number().min(0).max(1),
      clampDelta: z.number().min(-1).max(1),
      clampReason: z
        .enum([
          "COLLAR_CLEARANCE",
          "GARMENT_HEM",
          "TORSO_ENVELOPE",
          "SAM_MASK",
        ])
        .nullable(),
    })
    .strict()
    .optional(),
  orientedFrontPrintPlane: orientedFrontPrintPlaneEvidenceSchema.optional(),
  garmentMask: z
    .object({
      contractVersion: z.literal("garment-segmentation-v1"),
      bytes: z.instanceof(Buffer),
      checksumSha256: z.string().regex(/^[a-f0-9]{64}$/i),
      sourceBaseChecksumSha256: z.string().regex(/^[a-f0-9]{64}$/i),
      width: z.number().int().positive(),
      height: z.number().int().positive(),
    })
    .strict()
    .optional(),
  depthMap: z
    .object({
      contractVersion: z.literal("nexhq-depth-estimation-v1"),
      bytes: z.instanceof(Buffer),
      checksumSha256: z.string().regex(/^[a-f0-9]{64}$/i),
      sourceBaseChecksumSha256: z.string().regex(/^[a-f0-9]{64}$/i),
      width: z.number().int().positive(),
      height: z.number().int().positive(),
      provider: z.literal("fal"),
      model: z.string().min(1),
      adapterVersion: z.string().min(1),
      dynamicRange: z.number().min(0).max(1),
      discontinuityFraction: z.number().min(0).max(1).optional(),
      minimumDynamicRange: z.number().min(0).max(1).optional(),
      maximumDiscontinuityFraction: z.number().min(0).max(1).optional(),
    })
    .strict()
    .optional(),
}).superRefine((request, ctx) => {
  if (
    request.compositorVersion === COMPOSITOR_VERSION_V3 &&
    !request.fabricIntegration
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["fabricIntegration"],
      message: "Fabric-aware compositor v3 requires frozen integration settings.",
    });
  }
  if (
    request.fabricIntegration?.surfaceRealismRefinement &&
    (!request.ownerPrintFootprint || !request.ownerVerticalPlacement)
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["fabricIntegration", "surfaceRealismRefinement"],
      message:
        "Surface realism refinement requires the frozen FRONT_LARGE footprint and owner vertical authority.",
    });
  }
});

export type CompositingProvenance = z.infer<typeof compositingProvenanceSchema>;
export type DeterministicCompositeRequest = z.input<typeof deterministicCompositeRequestSchema>;

export interface DeterministicCompositeResult {
  pngBytes: Buffer;
  outputChecksumSha256: string;
  provenance: CompositingProvenance;
}
