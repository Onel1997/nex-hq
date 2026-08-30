"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  CheckCircle2,
  ChevronRight,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { StudioStepper, TechnicalDetails } from "@/components/studio/studio-ui";
import {
  ownerShotLabel,
  ownerStatusLabel,
} from "@/lib/ux/owner-terminology";

import type { BrandModelTrace } from "@/lib/persona/domain/brand-model-contract";
import type { MasterArtworkReference } from "@/lib/design/master-artwork-authority/types";
import {
  applyInputChangeToActiveRun,
  applyRecoveredRunToUi,
  initialActiveV2UiState,
  ownerArtworkPlacementFromRecovery,
  panelInputFingerprint,
  resetActivePrepareFlow,
  resetActiveUiForNewPrepare,
  statusLabelForRecovery,
  type CurrentV2Inputs,
  type V2Recovery,
} from "@/lib/image/deterministic-v2-panel/active-run";
import {
  callBrowserFetch,
  clearPrepareError,
  handlePrepareClick,
  initialPrepareFlowState,
  isPrepareButtonEnabled,
  isPrepareInFlight,
  listPrepareBlockers,
  type PrepareAuthorityInputs,
  type PrepareFlowState,
  type V2PreparedJob,
} from "@/lib/image/deterministic-v2-panel/prepare-flow";
import { EMPTY_CORNER_FIELDS } from "@/lib/image/print-surface/validate-quad";
import type { PrintSurface } from "@/lib/image/print-surface/types";
import {
  BOTH_SIDE_PLACEMENT_DEFINITIONS,
  PRINT_SIDE_LABELS,
  SEMANTIC_PLACEMENT_DEFINITIONS,
  resolveBothSidePlan,
  semanticPlacementOptions,
  type BothSidePlacementPreset,
  type PrintSide,
  type SemanticPlacementPreset,
} from "@/lib/image/semantic-print-placement";
import {
  contentShotById,
  resolveContentShotForSide,
} from "@/lib/image/content-packs";
import {
  BOTH_SIDE_PLAN_STATUS_LABELS,
  buildBothSideProductionPlan,
} from "@/lib/image/both-side-production-plan";
import type { ImagePrintSurfaceSelection } from "@/lib/image/product-production-client";
import { resolveAspectLockedArtworkPlacement } from "@/lib/image/artwork-compositing/aspect-ratio-lock";
import type { StrictContainFitDiagnostics } from "@/lib/image/artwork-compositing/strict-contain-fit";
import { resolveAutomaticProductPlacement } from "@/lib/image/product-placement-templates";
import { resolveFrontLargeProductionTuning } from "@/lib/image/front-large-production-tuning";
import {
  CREATIVE_PRESETS,
  creativeDirectionPlanningKey,
  type SocialCreativeDirectionV1,
} from "@/lib/image/social-creative-direction";
import {
  ownerFacingProductionError,
  resolveOwnerProductionState,
  type OwnerProductionActionPhase,
} from "@/lib/image/deterministic-v2-panel/owner-production-state";
import {
  defaultOwnerArtworkPlacement,
  resolveOwnerArtworkQuad,
  type OwnerArtworkPlacement,
} from "@/lib/product-library/product-family";
import type { ProductFamilyConfig } from "@/lib/product-library/types";
import type {
  PipelineDiagnostics,
  PipelineStageDiagnostic,
} from "@/lib/image/deterministic-runtime/base-preview";
import { supportsOwnerVerticalPlacement } from "@/lib/image/owner-vertical-placement";
import {
  formatPreviousRunLocalDateTime,
  previousRunMatchesFilter,
  type PreviousRunOwnerView,
} from "@/lib/image/deterministic-v2-panel/previous-runs";

const REVIEW_FIELDS = [
  "identity",
  "productFidelity",
  "artworkFidelityExact",
  "placement",
  "perspective",
  "lightingIntegration",
] as const;
const SIMPLE_IMAGE_STEPS = [
  "Auswahl",
  "Stil & Platzierung",
  "Erstellen",
  "Ergebnis",
] as const;

function containFitFromProvenance(
  value: unknown,
): StrictContainFitDiagnostics | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<StrictContainFitDiagnostics>;
  if (
    candidate.contractVersion !== "nexhq-strict-artwork-contain-fit-v1" ||
    candidate.fitMode !== "CONTAIN" ||
    candidate.ratioPreserved !== true ||
    candidate.cropApplied !== false ||
    candidate.distortionApplied !== false ||
    !candidate.targetPrintableArea ||
    typeof candidate.originalArtworkWidth !== "number" ||
    typeof candidate.originalArtworkHeight !== "number" ||
    typeof candidate.originalArtworkAspectRatio !== "number" ||
    typeof candidate.effectiveUniformScale !== "number" ||
    typeof candidate.unusedHorizontalSpace !== "number" ||
    typeof candidate.unusedVerticalSpace !== "number" ||
    typeof candidate.ownerOffsetX !== "number" ||
    typeof candidate.ownerOffsetY !== "number" ||
    typeof candidate.ownerScale !== "number"
  ) return null;
  return candidate as StrictContainFitDiagnostics;
}

function creativePresetLabel(
  direction: SocialCreativeDirectionV1 | null | undefined,
): string {
  if (!direction) return "Nicht ausgewählt";
  return (
    CREATIVE_PRESETS.find((preset) => preset.id === direction.presetId)?.label ??
    "Eigener Stil"
  );
}

type StageABasePreviewPayload = {
  jobId: string;
  stageOutputId: string;
  generatedAt: string;
  contaminationStatus: "PASS" | "SUSPECTED_CONTAMINATION" | "UNKNOWN";
  accessUrl: string;
  printRegionNormalized: Array<{ x: number; y: number }>;
  placementAuthority: null | {
    productFamilyId: string;
    side: "FRONT" | "BACK";
    placementTemplateId: string;
    placementTemplateVersion: number;
    placementPreset: string | null;
  };
  garmentRegistration: null | {
    contractVersion: "garment-registration-v2" | "garment-registration-v3";
    mappingVersion:
      | "GENERATED_GARMENT_RELATIVE_V2"
      | "GENERATED_GARMENT_RELATIVE_V3";
    status: "REGISTERED" | "LOW_CONFIDENCE";
    reason: string;
    confidence: number;
    garmentBounds: null | { x: number; y: number; width: number; height: number };
    garmentOutline: Array<{ x: number; y: number }>;
    frontTorsoEnvelope?: {
      contractVersion: "nexhq-front-torso-print-envelope-v1";
      status: "READY" | "UNSAFE";
      reason: string;
      fullGarmentBounds: { x: number; y: number; width: number; height: number };
      torsoBounds: null | { x: number; y: number; width: number; height: number };
      printableTorsoBounds: null | { x: number; y: number; width: number; height: number };
      fullGarmentWidthRatio: number;
      torsoWidthRatio: number;
      torsoHeightRatio: number;
      torsoToFullWidthRatio: number;
      sleeveSuppressionRatio: number;
      shoulderSuppressionRatio: number;
      sleeveInfluenceRemoved: boolean;
      shoulderFlareRemoved: boolean;
      collarClearanceApplied: boolean;
      sampledRowCount: number;
      stableRowCount: number;
      rowWidthStability: number;
      confidence: number;
    };
    orientedFrontPrintPlane?: {
      contractVersion:
        | "nexhq-oriented-front-print-plane-v2"
        | "nexhq-oriented-front-print-plane-v2.1-torso-frame"
        | "nexhq-oriented-front-print-plane-v2.2-normal-assisted";
      status: "READY" | "REFUSED";
      reason: string;
      evidenceClass:
        | "ORIENTATION_STRONG"
        | "ORIENTATION_MODERATE"
        | "ORIENTATION_LOW_STABLE"
        | "ORIENTATION_UNSAFE";
      orientationConfidence: number;
      estimatedRotationDegrees: number;
      appliedRotationDegrees: number;
      topEdgeTiltDegrees: number;
      bottomEdgeTiltDegrees: number;
      leftSideTiltDegrees: number;
      rightSideTiltDegrees: number;
      perspectiveAmount: number;
      rawBoundaryTaper?: number;
      sampleCount: number;
      rejectedSampleCount: number;
      torsoEdgeStability: number;
      centerlineStability: number;
      shoulderCollarAgreement: number;
      backgroundEvidenceExcluded: true;
      realDepthSupportUsed: boolean;
      normalAssistance?: {
        contractVersion: "nexhq-normal-assisted-oriented-torso-v1";
        normalEvidence: {
          status: "READY" | "REFUSED";
          usableSamples: number;
          rejectedOutliers: number;
          medianNormal: { x: number; y: number; z: number };
          fieldConsistency: number;
          directionalAnisotropy: number;
        };
        silhouetteOrientationDegrees: number;
        silhouetteConfidence: number;
        normalOrientationDegrees: number;
        normalConfidence: number;
        relationship: string;
        silhouetteContributionWeight: number;
        normalContributionWeight: number;
        finalOrientationDegrees: number;
        finalConfidence: number;
        agreementDeltaDegrees: number;
      };
      depthNormalCrossCheck?: {
        depthPlaneSlopeX: number;
        normalFacingX: number;
        normalizedAgreementDelta: number;
        agreementClass: "DEPTH_AGREES" | "DEPTH_MILD_DIFFERENCE" | "DEPTH_CONTRADICTORY" | "NOT_EVALUATED";
        globalPlaneReoriented: false;
      };
      allCornersInsideTorso: boolean | null;
      samContainment: number | null;
      collarClearanceApplied: boolean | null;
      hemClearanceApplied: boolean | null;
      registrationTypographyRisk: number;
      finalCombinedTypographyRisk?: number;
      ownerScale: number;
      ownerOffsetX: number;
      ownerOffsetY: number;
      globalFootprintPreserved: true;
      secondContainApplied: false;
      secondGlobalScaleApplied: false;
      secondGlobalTranslationApplied: false;
      clampReasons: string[];
      failureReason: string | null;
      torsoFrame?: {
        contractVersion:
          | "nexhq-oriented-front-print-plane-v2.1-torso-frame"
          | "nexhq-oriented-front-print-plane-v2.2-normal-assisted";
        origin: { x: number; y: number };
        uAxis: { x: number; y: number; angleDegrees: number };
        vAxis: { x: number; y: number; angleDegrees: number };
        safeLocalWidth: number;
        safeLocalHeight: number;
        torsoSafePolygon: [
          { x: number; y: number },
          { x: number; y: number },
          { x: number; y: number },
          { x: number; y: number },
        ];
        confidence: number;
        sourceEvidence:
          | "SAM_TORSO_BOUNDARIES"
          | "SAM_TORSO_PLUS_MIDAS_NORMAL";
        backgroundEvidenceExcluded: true;
      };
      ownerLocalFootprint?: {
        requestedLocalWidth: number;
        requestedLocalHeight: number;
        localX: number;
        localY: number;
        ownerScale: number;
        ownerOffsetX: number;
        ownerOffsetY: number;
        projectedQuad: Array<{ x: number; y: number }> | null;
      };
      containment?: {
        torsoPolygon: { status: "PASS" | "FAIL" | "NOT_EVALUATED"; value: number | null };
        samMask: { status: "PASS" | "FAIL" | "NOT_EVALUATED"; value: number | null };
        collar: { status: "PASS" | "FAIL" | "NOT_EVALUATED"; clearance: number | null };
        hem: { status: "PASS" | "FAIL" | "NOT_EVALUATED"; clearance: number | null };
        left: { status: "PASS" | "FAIL" | "NOT_EVALUATED"; clearance: number | null };
        right: { status: "PASS" | "FAIL" | "NOT_EVALUATED"; clearance: number | null };
        overflow: { top: number; right: number; bottom: number; left: number } | null;
      };
    };
    maskCoverage: number;
    boundaryEvidence?: "LOCAL_COLOR_COMPONENT" | "SAM3_VALIDATED_MASK";
    placementEvidence?: null | {
      placementPreset: SemanticPlacementPreset | null;
      ownerUniformScale: number;
      ownerOffsetX: number;
      ownerOffsetY: number;
      clampDeltaX: number;
      clampDeltaY: number;
      sizeReductionRatio: number;
      clampReasons: string[];
      largeFrontPreserved: boolean;
      frontLargeTuning?: {
        version: "nexhq-front-large-garment-v3.1";
        scaleMultiplier: number;
        upwardShiftGarmentRatio: number;
        effectiveUniformScale: number;
        effectiveCenterY: number;
      };
      ownerVerticalPlacement?: {
        contractVersion: "nexhq-owner-vertical-placement-v1";
        ownerYRequested: number;
        previewY: number;
        requestedRegisteredY: number;
        registeredY: number;
        finalY: number;
        yPreserved: boolean;
        withinSafetyTolerance: boolean;
        clampApplied: boolean;
        clampDelta: number;
        clampReason: string | null;
      };
    };
  };
  garmentSegmentation: null | {
    contractVersion: "garment-segmentation-v1";
    status: "VALIDATED" | "REJECTED";
    validationReason: string;
    provider: string;
    model: string;
    providerVersion: string;
    garmentType: string;
    side: "FRONT" | "BACK";
    candidateCount: number;
    selectedCandidateId: string | null;
    maskAccessUrl: string | null;
    mask: null | {
      width: number;
      height: number;
      foregroundFraction: number;
      largestComponentFraction: number;
      skinLikeFraction: number;
      hintOverlap: number;
      selectionScore: number;
    };
  };
  ownerPrintFootprint: null | {
    contractVersion: "nexhq-owner-print-footprint-v1";
    placementPreset: "FRONT_LARGE";
    ownerScale: number;
    ownerOffsetX: number;
    ownerOffsetY: number;
    marketPrintPrintableArea: { x: number; y: number; width: number; height: number };
    initialContainedArtworkRectangle: { x: number; y: number; width: number; height: number };
    requestedGarmentWidthRatio: number;
    requestedGarmentHeightRatio: number;
    registeredGarmentWidthRatio: number;
    registeredGarmentHeightRatio: number;
    registrationScaleDelta: number;
    preSurfaceFootprint: { x: number; y: number; width: number; height: number };
    postSurfaceFootprint: { x: number; y: number; width: number; height: number };
    surfaceAverageAreaChange: number;
    surfaceWidthChange: number;
    surfaceHeightChange: number;
    finalGarmentWidthRatio: number;
    finalGarmentHeightRatio: number;
    totalFootprintShrink: number;
    footprintPreserved: boolean;
    containApplicationCount: 1;
    safetyClampReasons: string[];
    failureStage: "REGISTRATION" | "SURFACE" | "COMPOSITOR" | null;
  };
  ownerVerticalPlacement: null | {
    contractVersion: "nexhq-owner-vertical-placement-v1";
    placementPreset: SemanticPlacementPreset;
    ownerYRequested: number;
    previewY: number;
    requestedRegisteredY: number;
    registeredY: number;
    finalY: number;
    yPreserved: boolean;
    withinSafetyTolerance: boolean;
    clampApplied: boolean;
    clampDelta: number;
    clampReason: string | null;
    footprintPreserved: boolean;
    secondContainApplied: false;
    secondGlobalScaleApplied: false;
    secondGlobalTranslationApplied: false;
  };
  identityConsistency: null | {
    contractVersion: "nexhq-brand-model-identity-consistency-v1";
    status: "PASS" | "FAIL";
    reason: string;
    authoritySource: "PERSONA_MASTER_IDENTITY_LOCK";
    identityLockActive: true;
    identityFallbackPrevented: true;
    evaluatorVersion: string;
    thresholdVersion: string;
    gateMetric?: "EUCLIDEAN_DISTANCE";
    distanceMetric?: "EUCLIDEAN_DISTANCE_L2_NORMALIZED_128D";
    gateComparison?: "DISTANCE_LESS_THAN_OR_EQUAL_MAXIMUM";
    embeddingModel?: "faceRecognitionNet";
    embeddingDimension?: 128;
    similarityFormulaVersion?: string;
    similarityFormula?: string;
    minimumDerivedSimilarityEquivalent?: number;
    referenceComparisonMode?: "PERSONA_MASTER_IDENTITY_ONLY";
    identityLockVersion?: number;
    referencePackageVersion?: string;
    supportingReferenceCount?: number;
    maximumEuclideanDistance: number;
    euclideanDistance: number | null;
    similarity: number | null;
    masterDetection: { status: string; confidence: number; faceCount: number };
    generatedDetection: { status: string; confidence: number; faceCount: number };
  };
  pipelineDiagnostics: PipelineDiagnostics;
  surfaceIntegration: null | {
    contractVersion: "nexhq-surface-conforming-integration-v1";
    status: "READY" | "REFUSED";
    reason: string;
    warpEnabled: boolean;
    warpStrength: number;
    maximumAppliedWarpPx: number;
    clampReasons: string[];
    curvatureEvidence: number;
    foldResponseEvidence: number;
    shadingResponseEvidence: number;
    textureResponseEvidence: number;
    maskClippingCoverage: number;
    effectivePrintRealismConfidence: number;
    surfaceEvidenceConfidence?: {
      metricVersion: string;
      interpretation: "SURFACE_EVIDENCE_RELIABILITY";
      maskReliability: number;
      geometryStability: number;
      unclampedNodeFraction: number;
      typographyUsesSeparateHardGate: true;
    };
    flatOverlayRisk: number;
    typographyDistortionEstimate: number;
    typographyDeformation?: {
      metricVersion: string;
      contentBoundsNormalized: null | {
        x: number;
        y: number;
        width: number;
        height: number;
      };
      activeCellCount: number;
      ignoredTransparentCellCount: number;
      maximumLocalHorizontalScaleDeviation: number;
      maximumLocalVerticalScaleDeviation: number;
      maximumPrincipalScaleDeviation: number;
      maximumLocalShear: number;
      maximumLocalAngularDistortionDegrees: number;
      maximumLocalRotationDegrees: number;
      maximumLocalAreaScaleDeviation: number;
      maximumNeighborJacobianDiscontinuity: number;
      dominantCells: Array<{
        row: number;
        column: number;
        artworkContentCoverage: number;
        risk: number;
      }>;
    };
    meshRegularization?: {
      passes: number;
      rawMaximumAppliedWarpPx: number;
      appliedMaximumWarpPx: number;
      rawLegacyNeighborGradientEstimate: number;
      rawJacobianDistortionEstimate: number;
      appliedJacobianDistortionEstimate: number;
      dominantLegacyEdges: Array<{
        direction: "HORIZONTAL" | "VERTICAL";
        row: number;
        column: number;
        displacementDeltaPx: number;
        cellSpanPx: number;
        normalizedGradient: number;
      }>;
    };
    gridColumns: number;
    gridRows: number;
    deterministic: true;
    sourceAuthorityPreserved: true;
    failClosedReason: string | null;
  };
  depthAwareIntegration: null | {
    contractVersion:
      | "nexhq-depth-aware-surface-integration-v1"
      | "nexhq-depth-aware-surface-integration-v1.1-garment-plane"
      | "nexhq-depth-aware-surface-integration-v1.2-hybrid-low-depth";
    status: "READY" | "REFUSED";
    reason: string;
    estimator: "LOCAL_STAGE_A_RELATIVE_DEPTH_V1" | "REAL_DEPTH_ANYTHING_V2";
    realDepth?: {
      provider: "fal";
      model: string;
      adapterVersion: string;
      depthMapChecksumSha256: string;
      sourceBaseChecksumSha256: string;
      dynamicRange: number;
      discontinuityFraction?: number;
      minimumDynamicRange?: number;
      maximumDiscontinuityFraction?: number;
      localCrossCheckWeight: number;
    };
    depthEvidenceAvailable: boolean;
    localPlaneTiltDegrees: number;
    localPerspectiveEstimate: number;
    depthConfidence: number;
    surfaceConfidence: number;
    depthQualityClassification?:
      | "DEPTH_STRONG"
      | "DEPTH_MODERATE"
      | "DEPTH_LOW_STABLE"
      | "DEPTH_UNSAFE";
    surfaceGuidanceMode?:
      | "REAL_DEPTH_DOMINANT"
      | "HYBRID"
      | "NEAR_PLANAR_HYBRID"
      | "REFUSED";
    realDepthConfidence?: number;
    torsoStability?: number;
    localFabricEvidence?: number;
    depthDiscontinuityStability?: number;
    depthSampleCoverage?: number;
    blendedSurfaceConfidence?: number;
    appliedLocalWarpStrength: number;
    maximumLocalWarpPx: number;
    requestedMaximumLocalWarpPx?: number;
    safeBoundedMaximumLocalWarpPx?: number;
    rejectedWarpExcessPx?: number;
    nodesExceedingBounds?: number;
    analyzedNodeCount?: number;
    nodesExceedingBoundsFraction?: number;
    perspectiveNormalizationDenominator?: number;
    requestedPerspectiveWarpPx?: number;
    rawDepthPlaneSlopeX?: number;
    rawDepthPlaneSlopeY?: number;
    normalizedDepthPlaneSlopeX?: number;
    normalizedDepthPlaneSlopeY?: number;
    robustDepthRange?: number;
    depthPlaneSampleCount?: number;
    depthPlaneRejectedSampleCount?: number;
    depthPlaneFitMethod?:
      | "LEGACY_MASK_WIDTH_SLOPE_V1"
      | "GARMENT_MASKED_ROBUST_DEPTH_PLANE_V1";
    depthAnalysisScope?:
      | "LEGACY_FULL_GARMENT_SPAN"
      | "SAM_TORSO_PRINT_NEIGHBORHOOD";
    typographyRisk: number;
    globalFootprintPreserved: true;
    secondaryScaleApplied: false;
    secondaryTranslationApplied: false;
    maskCoverage: number;
    clampReasons: string[];
    deterministic: true;
    sourceBaseOnly: true;
    sourceAuthorityPreserved: true;
    failClosedReason: string | null;
  };
  surfaceRealismRefinement: null | {
    contractVersion: "nexhq-surface-realism-refinement-v1";
    status: "READY" | "REFUSED";
    reason: string;
    strongerPlaneGuidanceUsed: boolean;
    realDepthUsed: boolean;
    localFallbackUsed: boolean;
    surfaceDirectionEvidenceUsed: boolean;
    footprintPinned: true;
    registeredYPreserved: true;
    secondContainApplied: false;
    secondGlobalScaleApplied: false;
    secondGlobalTranslationApplied: false;
    horizontalSurfaceSlope: number;
    verticalSurfaceSlope: number;
    planeGuidanceStrength: number;
    perspectiveGuidanceStrength: number;
    curvatureEvidence: number;
    evidenceConfidence: number;
    localWarpStrength: number;
    maximumLocalWarpPx: number;
    shadingTransferStrength: number;
    textureTransferStrength: number;
    typographyRisk: number;
    maskCoverage: number;
    clampedNodeFraction: number;
    deterministic: true;
    sourceAuthorityPreserved: true;
    failClosedReason: string | null;
  };
  surfaceRealismRefinementConfigured: null | {
    contractVersion: string;
  };
  printReadiness: null | {
    contract: { contractVersion: "nexhq-print-ready-stage-a-v1" };
    preflight: null | {
      status: "PASS" | "FAIL";
      reason: string;
      torsoVisibility: number;
      collarVisibility: "LIKELY" | "CONFIRMED" | "UNSAFE";
      occlusionStatus: "CLEAR" | "UNSAFE" | "NOT_YET_ASSESSED";
    };
    postflight: null | {
      status: "PASS" | "FAIL";
      reason: string;
      visibleGarmentRatio: number | null;
      torsoVisibility: number;
      collarVisibility: "LIKELY" | "CONFIRMED" | "UNSAFE";
      occlusionStatus: "CLEAR" | "UNSAFE" | "NOT_YET_ASSESSED";
    };
  };
  depthEstimation: null | {
    contractVersion: "nexhq-depth-estimation-v1";
    status: "VALIDATED" | "REJECTED";
    validationReason: string;
    provider: string;
    model: string;
    adapterVersion: string;
    providerRequestId: string | null;
    sourceBaseChecksumSha256: string;
    providerOutputDimensions: { width: number; height: number } | null;
    normalizedDimensions: { width: number; height: number } | null;
    normalization: null | {
      dynamicRange: number;
      discontinuityFraction: number;
    };
    realDepth: true;
    artworkInputIncluded: false;
  };
  normalEstimation: null | {
    contractVersion: "nexhq-fal-midas-normal-v1";
    status: "VALIDATED" | "REJECTED" | "MISSING" | "UNKNOWN_OUTCOME";
    validationReason: string;
    provider: string;
    model: string;
    adapterVersion: string;
    providerRequestId: string | null;
    sourceBaseChecksumSha256: string;
    normalizedDimensions: { width: number; height: number } | null;
    normalMapChecksumSha256: string | null;
    validation: null | {
      usableGarmentSamples: number;
      rejectedOutliers: number;
      medianNormal: { x: number; y: number; z: number };
      fieldConsistency: number;
      directionalVariation: number;
    };
    artworkInputIncluded: false;
  };
  purity: null | {
    contractVersion: "base-print-purity-v1" | "base-print-purity-v2";
    status: "PASS" | "SUSPECTED_CONTAMINATION";
    reason: string;
    assessedRegion: { x: number; y: number; width: number; height: number };
    analysisRegion?: { x: number; y: number; width: number; height: number };
    outlierFraction: number;
    sharpOutlierFraction: number;
    largestSharpComponentFraction: number;
    thresholds: Record<string, number>;
  };
};

function technicalEvaluationLabel(
  status: "PASS" | "FAIL" | "NOT_EVALUATED",
) {
  return status === "PASS"
    ? "BESTANDEN"
    : status === "FAIL"
      ? "FEHLGESCHLAGEN"
      : "NICHT AUSGEWERTET";
}

function pipelineStageStatusText(stage: PipelineStageDiagnostic): string {
  const configuration = stage.configured ? "CONFIGURED · " : "";
  const reason = stage.reason ? ` · Grund ${stage.reason}` : "";
  const blocker = stage.blockedBy
    ? ` · blockiert durch ${stage.blockedBy}`
    : "";
  return `${configuration}${stage.status}${reason}${blocker}`;
}

function MissingPipelineStage(props: {
  label: string;
  stage: PipelineStageDiagnostic;
}) {
  return (
    <p>
      <strong>{props.label}:</strong> {pipelineStageStatusText(props.stage)}
      {props.stage.contractVersion
        ? ` · Vertrag ${props.stage.contractVersion}`
        : ""}
    </p>
  );
}

function StageABasePreview({ jobId }: { jobId: string }) {
  const [state, setState] = useState<
    | { status: "idle" | "loading"; preview: null; error: null }
    | { status: "ready"; preview: StageABasePreviewPayload; error: null }
    | { status: "error"; preview: null; error: string }
  >({ status: "idle", preview: null, error: null });

  const loadPreview = useCallback(async () => {
    if (state.status !== "idle") return;
    setState({ status: "loading", preview: null, error: null });
    try {
      const response = await callBrowserFetch(
        `/api/image/v2/jobs/${jobId}/base-preview`,
        { cache: "no-store" },
      );
      const payload = (await response.json()) as {
        preview?: StageABasePreviewPayload;
        error?: string;
      };
      if (!response.ok || !payload.preview) {
        throw new Error(
          payload.error ?? "Das Stage-A-Basisbild konnte nicht geladen werden.",
        );
      }
      setState({ status: "ready", preview: payload.preview, error: null });
    } catch (error) {
      setState({
        status: "error",
        preview: null,
        error:
          error instanceof Error
            ? error.message
            : "Das Stage-A-Basisbild konnte nicht geladen werden.",
      });
    }
  }, [jobId, state.status]);

  const points = state.preview?.printRegionNormalized
    .map((point) => `${point.x * 1000},${point.y * 1000}`)
    .join(" ");
  const purity = state.preview?.purity ?? null;
  const registration = state.preview?.garmentRegistration ?? null;
  const garmentOutline = registration?.garmentOutline
    .map((point) => `${point.x * 1000},${point.y * 1000}`)
    .join(" ");
  const torsoEnvelope = registration?.frontTorsoEnvelope?.torsoBounds ?? null;
  const torsoSafePolygon =
    registration?.orientedFrontPrintPlane?.torsoFrame?.torsoSafePolygon
      .map((point) => `${point.x * 1000},${point.y * 1000}`)
      .join(" ") ?? null;
  return (
    <details
      className="is-v2-base-preview"
      onToggle={(event) => {
        if (event.currentTarget.open) void loadPreview();
      }}
    >
      <summary>Stage-A Basisbild</summary>
      <div className="is-v2-base-preview__body">
        {state.status === "idle" || state.status === "loading" ? (
          <p className="is-v2-base-preview__loading" role="status">
            <Loader2 className="size-4 animate-spin" /> Privates Basisbild wird
            geladen …
          </p>
        ) : null}
        {state.status === "error" ? (
          <p className="nx-notice nx-notice--error">{state.error}</p>
        ) : null}
        {state.status === "ready" ? (
          <>
            <div className="is-v2-base-preview__image">
              {/* Authenticated, short-lived private diagnostic URL. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={state.preview.accessUrl}
                alt="Privates Stage-A-Basisbild vor der Artwork-Anwendung"
              />
              {state.preview.garmentSegmentation?.maskAccessUrl ? (
                <>
                  {/* Authenticated private binary mask; never a public bucket URL. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    className="is-v2-base-preview__segmentation-mask"
                    src={state.preview.garmentSegmentation.maskAccessUrl}
                    alt="SAM-3-Kleidungsmaske"
                  />
                </>
              ) : null}
              {points || garmentOutline ? (
                <svg
                  aria-label="Geprüfter Druckbereich"
                  viewBox="0 0 1000 1000"
                  preserveAspectRatio="none"
                >
                  {garmentOutline ? (
                    <polygon
                      className="is-v2-base-preview__garment"
                      points={garmentOutline}
                    />
                  ) : null}
                  {torsoSafePolygon ? (
                    <polygon
                      className="is-v2-base-preview__torso-envelope"
                      points={torsoSafePolygon}
                    />
                  ) : torsoEnvelope ? (
                    <rect
                      className="is-v2-base-preview__torso-envelope"
                      x={torsoEnvelope.x * 1000}
                      y={torsoEnvelope.y * 1000}
                      width={torsoEnvelope.width * 1000}
                      height={torsoEnvelope.height * 1000}
                    />
                  ) : null}
                  {points ? <polygon points={points} /> : null}
                </svg>
              ) : null}
            </div>
            <p>
              <strong>Kontaminationsprüfung:</strong>{" "}
              {state.preview.contaminationStatus ===
              "SUSPECTED_CONTAMINATION"
                ? "Verdacht erkannt"
                : state.preview.contaminationStatus === "PASS"
                  ? "Bestanden"
                  : "Keine auswertbaren Daten"}
            </p>
            {state.preview.identityConsistency ? (
              <div className="is-v2-base-preview__registration">
                <strong>Brand Model Identity Lock</strong>
                <span>
                  {state.preview.identityConsistency.status === "PASS"
                    ? "Lokale Identitätsprüfung bestanden"
                    : "Lokale Identitätsprüfung abgelehnt"} · Gate {state.preview.identityConsistency.status}
                </span>
                <span>
                  Quelle {state.preview.identityConsistency.authoritySource} · Lock aktiv · generischer Fallback verhindert
                </span>
                <span>
                  Rohdistanz {state.preview.identityConsistency.euclideanDistance !== null ? state.preview.identityConsistency.euclideanDistance.toFixed(6) : "nicht auswertbar"} · maximal erlaubte Distanz {state.preview.identityConsistency.maximumEuclideanDistance.toFixed(2)} · Vergleich {state.preview.identityConsistency.gateComparison ?? "DISTANCE_LESS_THAN_OR_EQUAL_MAXIMUM"}
                </span>
                <span>
                  Abgeleitete Ähnlichkeit {state.preview.identityConsistency.similarity !== null ? `${(state.preview.identityConsistency.similarity * 100).toFixed(1)} %` : "nicht auswertbar"} · äquivalente Melde-Schwelle {((state.preview.identityConsistency.minimumDerivedSimilarityEquivalent ?? (1 - state.preview.identityConsistency.maximumEuclideanDistance / 2)) * 100).toFixed(1)} %
                </span>
                <span>
                  Formel {state.preview.identityConsistency.similarityFormula ?? "1 - euclideanDistance / 2"} · Formelversion {state.preview.identityConsistency.similarityFormulaVersion ?? "historisch nicht gespeichert"}
                </span>
                <span>
                  {state.preview.identityConsistency.evaluatorVersion} · {state.preview.identityConsistency.embeddingModel ?? "faceRecognitionNet"} / {state.preview.identityConsistency.embeddingDimension ?? 128}D · Referenz {state.preview.identityConsistency.referenceComparisonMode ?? "PERSONA_MASTER_IDENTITY_ONLY"} · Lock v{state.preview.identityConsistency.identityLockVersion ?? "historisch"} · Support-Paket {state.preview.identityConsistency.supportingReferenceCount ?? "historisch"}/5
                </span>
                <span>
                  Exakter Ablehnungsgrund {state.preview.identityConsistency.reason}
                </span>
              </div>
            ) : (
              <MissingPipelineStage
                label="Brand Model Identity Lock"
                stage={state.preview.pipelineDiagnostics.stages.identityValidation}
              />
            )}
            {state.preview.pipelineDiagnostics.stoppedAfter ? (
              <div className="is-v2-base-preview__registration">
                <strong>Pipeline-Stop</strong>
                <span>
                  Pipeline stopped after: {state.preview.pipelineDiagnostics.stoppedAfter}
                </span>
                <span>
                  Next stage not executed: {state.preview.pipelineDiagnostics.nextStageNotExecuted ?? "Keine"}
                </span>
                <span>
                  Blocking reason: {state.preview.pipelineDiagnostics.blockingReason ?? "Unbekannt"}
                </span>
              </div>
            ) : null}
            {state.preview.printReadiness ? (
              <div className="is-v2-base-preview__registration">
                <strong>Print Readiness</strong>
                <span>{state.preview.printReadiness.contract.contractVersion}</span>
                <span>
                  Lokal {state.preview.printReadiness.preflight?.status ?? "nicht verfügbar"} · Torso-Sichtbarkeit {((state.preview.printReadiness.preflight?.torsoVisibility ?? 0) * 100).toFixed(1)} % · Kragen {state.preview.printReadiness.preflight?.collarVisibility ?? "unbekannt"}
                </span>
                <span>
                  SAM/Torso {state.preview.printReadiness.postflight?.status ?? "nicht ausgeführt"} · sichtbare Kleidungsfläche {((state.preview.printReadiness.postflight?.visibleGarmentRatio ?? 0) * 100).toFixed(1)} % · Okklusion {state.preview.printReadiness.postflight?.occlusionStatus ?? "unbekannt"}
                </span>
                {(state.preview.printReadiness.postflight?.reason ?? state.preview.printReadiness.preflight?.reason) !== "READY" ? (
                  <span>Grund {state.preview.printReadiness.postflight?.reason ?? state.preview.printReadiness.preflight?.reason}</span>
                ) : null}
              </div>
            ) : null}
            <p>
              Blau gestrichelt zeigt die volle SAM-Kleidungsfläche, Amber den
              Shirt-Torso und Cyan die exakt registrierte Druckregion.
            </p>
            {state.preview.garmentSegmentation ? (
              <div className="is-v2-base-preview__registration">
                <strong>Garment Segmentation</strong>
                <span>
                  {state.preview.garmentSegmentation.provider} · {state.preview.garmentSegmentation.model} · {state.preview.garmentSegmentation.providerVersion}
                </span>
                <span>
                  {state.preview.garmentSegmentation.garmentType} · {state.preview.garmentSegmentation.side === "FRONT" ? "Vorne" : "Hinten"}
                </span>
                <span>
                  Status {state.preview.garmentSegmentation.status} · Kandidaten {state.preview.garmentSegmentation.candidateCount} · Prüfung {state.preview.garmentSegmentation.validationReason}
                </span>
                {state.preview.garmentSegmentation.mask ? (
                  <span>
                    Maske {state.preview.garmentSegmentation.mask.width}×{state.preview.garmentSegmentation.mask.height} · Anteil {(state.preview.garmentSegmentation.mask.foregroundFraction * 100).toFixed(1)} % · Hint-Überlappung {(state.preview.garmentSegmentation.mask.hintOverlap * 100).toFixed(1)} %
                  </span>
                ) : (
                  <span>Sicherheitsablehnung: Es wurde keine Maske für Stage B freigegeben.</span>
                )}
              </div>
            ) : (
              <MissingPipelineStage
                label="Garment Segmentation / SAM"
                stage={state.preview.pipelineDiagnostics.stages.sam}
              />
            )}
            {state.preview.normalEstimation ? (
              <div className="is-v2-base-preview__registration">
                <strong>MiDaS Normal Evidence</strong>
                <span>
                  {state.preview.normalEstimation.provider} · {state.preview.normalEstimation.model} · {state.preview.normalEstimation.contractVersion}
                </span>
                <span>
                  Status {state.preview.normalEstimation.status} · Prüfung {state.preview.normalEstimation.validationReason} · Base gebunden {state.preview.normalEstimation.sourceBaseChecksumSha256 ? "JA" : "NEIN"} · Artwork an Provider NEIN
                </span>
                {state.preview.normalEstimation.validation ? (
                  <>
                    <span>
                      Samples {state.preview.normalEstimation.validation.usableGarmentSamples} · Ausreißer {state.preview.normalEstimation.validation.rejectedOutliers} · Feldkonsistenz {(state.preview.normalEstimation.validation.fieldConsistency * 100).toFixed(1)} % · Richtungsvariation {(state.preview.normalEstimation.validation.directionalVariation * 100).toFixed(1)} %
                    </span>
                    <span>
                      Median-Normale [{state.preview.normalEstimation.validation.medianNormal.x.toFixed(3)}, {state.preview.normalEstimation.validation.medianNormal.y.toFixed(3)}, {state.preview.normalEstimation.validation.medianNormal.z.toFixed(3)}]
                    </span>
                  </>
                ) : null}
              </div>
            ) : (
              <MissingPipelineStage
                label="MiDaS Normal Evidence"
                stage={state.preview.pipelineDiagnostics.stages.midasNormal}
              />
            )}
            {registration ? (
              <div className="is-v2-base-preview__registration">
                <strong>Garment Registration</strong>
                <span>
                  {registration.mappingVersion} · Konfidenz{" "}
                  {(registration.confidence * 100).toFixed(1)} % ·
                  Flächenabdeckung {(registration.maskCoverage * 100).toFixed(1)} %
                </span>
                {registration.boundaryEvidence ? (
                  <span>Grenznachweis: {registration.boundaryEvidence}</span>
                ) : null}
                <span>
                  Die gestrichelte Kontur zeigt die lokal erkannte
                  Produktfläche; Cyan zeigt die daraus registrierte
                  Druckregion.
                </span>
                {registration.frontTorsoEnvelope ? (
                  <>
                    <strong>Front Torso Envelope</strong>
                    <span>
                      {registration.frontTorsoEnvelope.contractVersion} · Status {registration.frontTorsoEnvelope.status} · Grund {registration.frontTorsoEnvelope.reason} · Konfidenz {(registration.frontTorsoEnvelope.confidence * 100).toFixed(1)} %
                    </span>
                    <span>
                      Volle Kleidungsbreite {(registration.frontTorsoEnvelope.fullGarmentWidthRatio * 100).toFixed(1)} % des Bildes · Torsobreite {(registration.frontTorsoEnvelope.torsoWidthRatio * 100).toFixed(1)} % des Bildes / {(registration.frontTorsoEnvelope.torsoToFullWidthRatio * 100).toFixed(1)} % der vollen Kleidungsbreite · Torsohöhe {(registration.frontTorsoEnvelope.torsoHeightRatio * 100).toFixed(1)} % des Bildes
                    </span>
                    <span>
                      Ärmeleinfluss entfernt {registration.frontTorsoEnvelope.sleeveInfluenceRemoved ? "JA" : "NEIN"} ({(registration.frontTorsoEnvelope.sleeveSuppressionRatio * 100).toFixed(1)} %) · Schulterflare entfernt {registration.frontTorsoEnvelope.shoulderFlareRemoved ? "JA" : "NEIN"} ({(registration.frontTorsoEnvelope.shoulderSuppressionRatio * 100).toFixed(1)} %)
                    </span>
                    <span>
                      Kragenabstand {registration.frontTorsoEnvelope.collarClearanceApplied ? "JA" : "NEIN"} · stabile Reihen {registration.frontTorsoEnvelope.stableRowCount}/{registration.frontTorsoEnvelope.sampledRowCount} · Breitenstabilität {(registration.frontTorsoEnvelope.rowWidthStability * 100).toFixed(1)} %
                    </span>
                    {registration.frontTorsoEnvelope.torsoBounds ? (
                      <span>
                        Torso L {(registration.frontTorsoEnvelope.torsoBounds.x * 100).toFixed(1)} % · R {((registration.frontTorsoEnvelope.torsoBounds.x + registration.frontTorsoEnvelope.torsoBounds.width) * 100).toFixed(1)} % · Oben {(registration.frontTorsoEnvelope.torsoBounds.y * 100).toFixed(1)} % · Unten {((registration.frontTorsoEnvelope.torsoBounds.y + registration.frontTorsoEnvelope.torsoBounds.height) * 100).toFixed(1)} %
                      </span>
                    ) : null}
                  </>
                ) : null}
                {registration.orientedFrontPrintPlane ? (
                  <>
                    <strong>Oriented Front Print Plane</strong>
                    <span>
                      {registration.orientedFrontPrintPlane.contractVersion} · Status {registration.orientedFrontPrintPlane.status} · {registration.orientedFrontPrintPlane.evidenceClass} · Konfidenz {(registration.orientedFrontPrintPlane.orientationConfidence * 100).toFixed(1)} %
                    </span>
                    <span>
                      Rotation geschätzt {registration.orientedFrontPrintPlane.estimatedRotationDegrees.toFixed(2)}° · angewendet {registration.orientedFrontPrintPlane.appliedRotationDegrees.toFixed(2)}° · Perspektive {(registration.orientedFrontPrintPlane.perspectiveAmount * 100).toFixed(2)} %
                    </span>
                    <span>
                      Kanten: oben {registration.orientedFrontPrintPlane.topEdgeTiltDegrees.toFixed(2)}° · unten {registration.orientedFrontPrintPlane.bottomEdgeTiltDegrees.toFixed(2)}° · links {registration.orientedFrontPrintPlane.leftSideTiltDegrees.toFixed(2)}° · rechts {registration.orientedFrontPrintPlane.rightSideTiltDegrees.toFixed(2)}°
                    </span>
                    <span>
                      Torso-Kanten {(registration.orientedFrontPrintPlane.torsoEdgeStability * 100).toFixed(1)} % · Mittellinie {(registration.orientedFrontPrintPlane.centerlineStability * 100).toFixed(1)} % · Schulter/Kragen {(registration.orientedFrontPrintPlane.shoulderCollarAgreement * 100).toFixed(1)} % · Samples {registration.orientedFrontPrintPlane.sampleCount - registration.orientedFrontPrintPlane.rejectedSampleCount}/{registration.orientedFrontPrintPlane.sampleCount}
                    </span>
                    <span>
                      Hintergrund ausgeschlossen {registration.orientedFrontPrintPlane.backgroundEvidenceExcluded ? "JA" : "NEIN"} · reale Tiefe als Stütze {registration.orientedFrontPrintPlane.realDepthSupportUsed ? "JA" : "NEIN – lokale Tiefenstufe folgt separat"}
                    </span>
                    {registration.orientedFrontPrintPlane.normalAssistance ? (
                      <>
                        <strong>Normal-Assisted Torso</strong>
                        <span>
                          Silhouette {registration.orientedFrontPrintPlane.normalAssistance.silhouetteOrientationDegrees.toFixed(2)}° ({(registration.orientedFrontPrintPlane.normalAssistance.silhouetteConfidence * 100).toFixed(1)} %) · Normal {registration.orientedFrontPrintPlane.normalAssistance.normalOrientationDegrees.toFixed(2)}° ({(registration.orientedFrontPrintPlane.normalAssistance.normalConfidence * 100).toFixed(1)} %)
                        </span>
                        <span>
                          Beziehung {registration.orientedFrontPrintPlane.normalAssistance.relationship} · Gewichte Silhouette {(registration.orientedFrontPrintPlane.normalAssistance.silhouetteContributionWeight * 100).toFixed(1)} % / Normal {(registration.orientedFrontPrintPlane.normalAssistance.normalContributionWeight * 100).toFixed(1)} % · final {registration.orientedFrontPrintPlane.normalAssistance.finalOrientationDegrees.toFixed(2)}° ({(registration.orientedFrontPrintPlane.normalAssistance.finalConfidence * 100).toFixed(1)} %)
                        </span>
                        <span>
                          Nur SAM ∩ Torso ∩ Print-Nachbarschaft · Ärmel/Kragenübergang ausgeschlossen · Delta {registration.orientedFrontPrintPlane.normalAssistance.agreementDeltaDegrees.toFixed(2)}°
                        </span>
                      </>
                    ) : null}
                    {registration.orientedFrontPrintPlane.depthNormalCrossCheck ? (
                      <span>
                        Depth/Normal Cross-check {registration.orientedFrontPrintPlane.depthNormalCrossCheck.agreementClass} · Depth-X {registration.orientedFrontPrintPlane.depthNormalCrossCheck.depthPlaneSlopeX.toFixed(3)} · Normal-X {registration.orientedFrontPrintPlane.depthNormalCrossCheck.normalFacingX.toFixed(3)} · globale Ebene durch Depth neu ausgerichtet NEIN
                      </span>
                    ) : null}
                    <span>
                      Quad im Torso {registration.orientedFrontPrintPlane.allCornersInsideTorso === null ? "NICHT AUSGEWERTET" : registration.orientedFrontPrintPlane.allCornersInsideTorso ? "JA" : "NEIN"} · SAM {registration.orientedFrontPrintPlane.samContainment === null ? "NICHT AUSGEWERTET" : `${(registration.orientedFrontPrintPlane.samContainment * 100).toFixed(2)} %`} · Kragenabstand {registration.orientedFrontPrintPlane.collarClearanceApplied === null ? "NICHT AUSGEWERTET" : registration.orientedFrontPrintPlane.collarClearanceApplied ? "JA" : "NEIN"} · Saumabstand {registration.orientedFrontPrintPlane.hemClearanceApplied === null ? "NICHT AUSGEWERTET" : registration.orientedFrontPrintPlane.hemClearanceApplied ? "JA" : "NEIN"}
                    </span>
                    {registration.orientedFrontPrintPlane.torsoFrame ? (
                      <>
                        <strong>Oriented Torso Frame</strong>
                        <span>
                          Torso-Rotation {registration.orientedFrontPrintPlane.appliedRotationDegrees.toFixed(2)}° · U-Achse {registration.orientedFrontPrintPlane.torsoFrame.uAxis.angleDegrees.toFixed(2)}° · V-Achse {registration.orientedFrontPrintPlane.torsoFrame.vAxis.angleDegrees.toFixed(2)}° · lokale sichere Breite {(registration.orientedFrontPrintPlane.torsoFrame.safeLocalWidth * 100).toFixed(1)} % · Höhe {(registration.orientedFrontPrintPlane.torsoFrame.safeLocalHeight * 100).toFixed(1)} %
                        </span>
                        <span>
                          Quelle {registration.orientedFrontPrintPlane.torsoFrame.sourceEvidence} · Hintergrund ausgeschlossen JA · Frame-Konfidenz {(registration.orientedFrontPrintPlane.torsoFrame.confidence * 100).toFixed(1)} %{registration.orientedFrontPrintPlane.rawBoundaryTaper !== undefined ? ` · rohe Randverjüngung ${(registration.orientedFrontPrintPlane.rawBoundaryTaper * 100).toFixed(1)} %` : ""}
                        </span>
                      </>
                    ) : null}
                    {registration.orientedFrontPrintPlane.ownerLocalFootprint ? (
                      <>
                        <strong>Owner Footprint im Torso-Koordinatensystem</strong>
                        <span>
                          angefordert U {(registration.orientedFrontPrintPlane.ownerLocalFootprint.requestedLocalWidth * 100).toFixed(1)} % · V {(registration.orientedFrontPrintPlane.ownerLocalFootprint.requestedLocalHeight * 100).toFixed(1)} % · Owner X {registration.orientedFrontPrintPlane.ownerLocalFootprint.ownerOffsetX.toFixed(2)} · Y {registration.orientedFrontPrintPlane.ownerLocalFootprint.ownerOffsetY.toFixed(2)} · Scale {(registration.orientedFrontPrintPlane.ownerLocalFootprint.ownerScale * 100).toFixed(0)} %
                        </span>
                      </>
                    ) : null}
                    {registration.orientedFrontPrintPlane.containment ? (
                      <>
                        <strong>Containment</strong>
                        <span>
                          Torso-Polygon {technicalEvaluationLabel(registration.orientedFrontPrintPlane.containment.torsoPolygon.status)}{registration.orientedFrontPrintPlane.containment.torsoPolygon.value === null ? "" : ` (${(registration.orientedFrontPrintPlane.containment.torsoPolygon.value * 100).toFixed(2)} %)`} · SAM {technicalEvaluationLabel(registration.orientedFrontPrintPlane.containment.samMask.status)}{registration.orientedFrontPrintPlane.containment.samMask.value === null ? "" : ` (${(registration.orientedFrontPrintPlane.containment.samMask.value * 100).toFixed(2)} %)`}
                        </span>
                        <span>
                          Kragen {technicalEvaluationLabel(registration.orientedFrontPrintPlane.containment.collar.status)} · Saum {technicalEvaluationLabel(registration.orientedFrontPrintPlane.containment.hem.status)} · Links {technicalEvaluationLabel(registration.orientedFrontPrintPlane.containment.left.status)} · Rechts {technicalEvaluationLabel(registration.orientedFrontPrintPlane.containment.right.status)}
                        </span>
                        {registration.orientedFrontPrintPlane.containment.overflow ? (
                          <span>
                            Überlauf: oben {(registration.orientedFrontPrintPlane.containment.overflow.top * 100).toFixed(2)} % · rechts {(registration.orientedFrontPrintPlane.containment.overflow.right * 100).toFixed(2)} % · unten {(registration.orientedFrontPrintPlane.containment.overflow.bottom * 100).toFixed(2)} % · links {(registration.orientedFrontPrintPlane.containment.overflow.left * 100).toFixed(2)} %
                          </span>
                        ) : null}
                      </>
                    ) : null}
                    <span>
                      Owner: Skalierung {(registration.orientedFrontPrintPlane.ownerScale * 100).toFixed(0)} % · X {registration.orientedFrontPrintPlane.ownerOffsetX.toFixed(2)} · Y {registration.orientedFrontPrintPlane.ownerOffsetY.toFixed(2)} · Footprint {registration.orientedFrontPrintPlane.globalFootprintPreserved ? "ERHALTEN" : "NICHT ERHALTEN"}
                    </span>
                    <span>
                      Zweites CONTAIN {registration.orientedFrontPrintPlane.secondContainApplied ? "JA" : "NEIN"} · zweite Skalierung {registration.orientedFrontPrintPlane.secondGlobalScaleApplied ? "JA" : "NEIN"} · zweite Verschiebung {registration.orientedFrontPrintPlane.secondGlobalTranslationApplied ? "JA" : "NEIN"} · Typografie global {(registration.orientedFrontPrintPlane.registrationTypographyRisk * 100).toFixed(2)} %{registration.orientedFrontPrintPlane.finalCombinedTypographyRisk !== undefined ? ` · kombiniert ${(registration.orientedFrontPrintPlane.finalCombinedTypographyRisk * 100).toFixed(2)} %` : ""}
                    </span>
                    {registration.orientedFrontPrintPlane.failureReason ? (
                      <span>Sicherheitsablehnung: {registration.orientedFrontPrintPlane.failureReason}</span>
                    ) : null}
                  </>
                ) : null}
                {registration.placementEvidence ? (
                  <dl className="is-v2-base-preview__metrics">
                    <div>
                      <dt>Platzierung</dt>
                      <dd>
                        {registration.placementEvidence.placementPreset
                          ? SEMANTIC_PLACEMENT_DEFINITIONS[
                              registration.placementEvidence.placementPreset
                            ].label
                          : "Historische Platzierung"}
                      </dd>
                    </div>
                    <div>
                      <dt>Owner-Intent</dt>
                      <dd>
                        Skalierung {(
                          registration.placementEvidence.ownerUniformScale *
                          100
                        ).toFixed(0)} % · X {registration.placementEvidence.ownerOffsetX.toFixed(2)} · Y {registration.placementEvidence.ownerOffsetY.toFixed(2)}
                      </dd>
                    </div>
                    <div>
                      <dt>Sicherheitsanpassung</dt>
                      <dd>
                        {registration.placementEvidence.clampReasons.length
                          ? registration.placementEvidence.clampReasons.join(", ")
                          : "Keine"}
                        {` · ΔX ${registration.placementEvidence.clampDeltaX.toFixed(4)} · ΔY ${registration.placementEvidence.clampDeltaY.toFixed(4)}`}
                      </dd>
                    </div>
                    <div>
                      <dt>Größenänderung</dt>
                      <dd>
                        {registration.placementEvidence.sizeReductionRatio ===
                        1
                          ? "Keine"
                          : `${(
                              registration.placementEvidence
                                .sizeReductionRatio * 100
                            ).toFixed(1)} %`}
                      </dd>
                    </div>
                    <div>
                      <dt>Großer Frontprint</dt>
                      <dd>
                        {registration.placementEvidence.largeFrontPreserved
                          ? "Unverändert erhalten"
                          : "Nicht sicher anwendbar"}
                      </dd>
                    </div>
                    {registration.placementEvidence.frontLargeTuning ? (
                      <>
                        <div>
                          <dt>Effektive Skalierung</dt>
                          <dd>
                            {(registration.placementEvidence.frontLargeTuning.effectiveUniformScale * 100).toFixed(1)} % · Multiplikator {registration.placementEvidence.frontLargeTuning.scaleMultiplier.toFixed(2)}
                          </dd>
                        </div>
                        <div>
                          <dt>Vertikale Abstimmung</dt>
                          <dd>
                            {(registration.placementEvidence.frontLargeTuning.upwardShiftGarmentRatio * 100).toFixed(1)} % nach oben · Zentrum {(registration.placementEvidence.frontLargeTuning.effectiveCenterY * 100).toFixed(1)} %
                          </dd>
                        </div>
                      </>
                    ) : null}
                  </dl>
                ) : null}
                {state.preview.placementAuthority ? (
                  <span>
                    Template {state.preview.placementAuthority.placementTemplateId} · Version {state.preview.placementAuthority.placementTemplateVersion} · {state.preview.placementAuthority.side}
                  </span>
                ) : null}
              </div>
            ) : (
              <>
                <MissingPipelineStage
                  label="Garment Registration"
                  stage={state.preview.pipelineDiagnostics.stages.garmentRegistration}
                />
                <MissingPipelineStage
                  label="Oriented Torso"
                  stage={state.preview.pipelineDiagnostics.stages.orientedTorso}
                />
              </>
            )}
            {state.preview.ownerPrintFootprint ? (
              <div className="is-v2-base-preview__registration">
                <strong>Owner Print Footprint</strong>
                <span>
                  {state.preview.ownerPrintFootprint.contractVersion} · {state.preview.ownerPrintFootprint.placementPreset} · Owner-Skalierung {(state.preview.ownerPrintFootprint.ownerScale * 100).toFixed(0)} % · X {state.preview.ownerPrintFootprint.ownerOffsetX.toFixed(2)} · Y {state.preview.ownerPrintFootprint.ownerOffsetY.toFixed(2)}
                </span>
                <span>
                  MarketPrint {(state.preview.ownerPrintFootprint.marketPrintPrintableArea.width * 100).toFixed(1)} × {(state.preview.ownerPrintFootprint.marketPrintPrintableArea.height * 100).toFixed(1)} % · initiales CONTAIN {(state.preview.ownerPrintFootprint.initialContainedArtworkRectangle.width * 100).toFixed(1)} × {(state.preview.ownerPrintFootprint.initialContainedArtworkRectangle.height * 100).toFixed(1)} %
                </span>
                <span>
                  Angefordert {(state.preview.ownerPrintFootprint.requestedGarmentWidthRatio * 100).toFixed(1)} × {(state.preview.ownerPrintFootprint.requestedGarmentHeightRatio * 100).toFixed(1)} % des Shirtkörpers · registriert {(state.preview.ownerPrintFootprint.registeredGarmentWidthRatio * 100).toFixed(1)} × {(state.preview.ownerPrintFootprint.registeredGarmentHeightRatio * 100).toFixed(1)} % · Δ {(state.preview.ownerPrintFootprint.registrationScaleDelta * 100).toFixed(2)} %
                </span>
                <span>
                  Surface Δ Fläche {(state.preview.ownerPrintFootprint.surfaceAverageAreaChange * 100).toFixed(2)} % · Breite {(state.preview.ownerPrintFootprint.surfaceWidthChange * 100).toFixed(2)} % · Höhe {(state.preview.ownerPrintFootprint.surfaceHeightChange * 100).toFixed(2)} %
                </span>
                <span>
                  Final {(state.preview.ownerPrintFootprint.finalGarmentWidthRatio * 100).toFixed(1)} × {(state.preview.ownerPrintFootprint.finalGarmentHeightRatio * 100).toFixed(1)} % · Schrumpfung {(state.preview.ownerPrintFootprint.totalFootprintShrink * 100).toFixed(2)} % · Footprint {state.preview.ownerPrintFootprint.footprintPreserved ? "ERHALTEN" : "NICHT ERHALTEN"}
                </span>
                <span>
                  CONTAIN-Anwendungen {state.preview.ownerPrintFootprint.containApplicationCount} · Begrenzungen {state.preview.ownerPrintFootprint.safetyClampReasons.length ? state.preview.ownerPrintFootprint.safetyClampReasons.join(", ") : "Keine"}{state.preview.ownerPrintFootprint.failureStage ? ` · Fehlerstufe ${state.preview.ownerPrintFootprint.failureStage}` : ""}
                </span>
              </div>
            ) : null}
            {state.preview.ownerVerticalPlacement ? (
              <div className="is-v2-base-preview__registration">
                <strong>Owner Vertical Placement</strong>
                <span>
                  {state.preview.ownerVerticalPlacement.contractVersion} · angefordert {state.preview.ownerVerticalPlacement.ownerYRequested.toFixed(2)} · Preview-Y {(state.preview.ownerVerticalPlacement.previewY * 100).toFixed(2)} %
                </span>
                <span>
                  Registrierungs-Y angefordert {(state.preview.ownerVerticalPlacement.requestedRegisteredY * 100).toFixed(2)} % · registriert {(state.preview.ownerVerticalPlacement.registeredY * 100).toFixed(2)} % · final {(state.preview.ownerVerticalPlacement.finalY * 100).toFixed(2)} %
                </span>
                <span>
                  Y erhalten {state.preview.ownerVerticalPlacement.yPreserved ? "JA" : "NEIN – Sicherheitsbegrenzung"} · Clamp {state.preview.ownerVerticalPlacement.clampApplied ? "JA" : "NEIN"} · Δ {(state.preview.ownerVerticalPlacement.clampDelta * 100).toFixed(2)} % · Grund {state.preview.ownerVerticalPlacement.clampReason ?? "Keiner"}
                </span>
                <strong>Global Footprint</strong>
                <span>
                  Footprint {state.preview.ownerVerticalPlacement.footprintPreserved ? "ERHALTEN" : "NICHT ERHALTEN"} · zweites CONTAIN {state.preview.ownerVerticalPlacement.secondContainApplied ? "JA" : "NEIN"} · zweite globale Skalierung {state.preview.ownerVerticalPlacement.secondGlobalScaleApplied ? "JA" : "NEIN"} · zweite globale Verschiebung {state.preview.ownerVerticalPlacement.secondGlobalTranslationApplied ? "JA" : "NEIN"}
                </span>
              </div>
            ) : null}
            {state.preview.depthEstimation ? (
              <div className="is-v2-base-preview__registration">
                <strong>Depth</strong>
                <span>
                  {state.preview.depthEstimation.provider} · {state.preview.depthEstimation.model} · {state.preview.depthEstimation.adapterVersion}
                </span>
                <span>
                  REAL_DEPTH_ANYTHING_V2 · Status {state.preview.depthEstimation.status} · Prüfung {state.preview.depthEstimation.validationReason}
                </span>
                <span>
                  Base-Bindung {state.preview.depthEstimation.sourceBaseChecksumSha256.slice(0, 12)}… · Dimensionen {state.preview.depthEstimation.normalizedDimensions ? `${state.preview.depthEstimation.normalizedDimensions.width}×${state.preview.depthEstimation.normalizedDimensions.height}` : "nicht verfügbar"}
                </span>
                {state.preview.depthEstimation.normalization ? (
                  <span>
                    Dynamik {(state.preview.depthEstimation.normalization.dynamicRange * 100).toFixed(1)} % · Tiefensprünge {(state.preview.depthEstimation.normalization.discontinuityFraction * 100).toFixed(2)} % · Artwork an Provider NEIN
                  </span>
                ) : null}
                {state.preview.depthEstimation.providerRequestId ? (
                  <span>Provider Request ID {state.preview.depthEstimation.providerRequestId}</span>
                ) : null}
              </div>
            ) : state.preview.depthAwareIntegration ? (
              <p>Lokale relative Tiefenevidenz; kein externer Depth-Anything-Nachweis.</p>
            ) : (
              <MissingPipelineStage
                label="Depth Anything"
                stage={state.preview.pipelineDiagnostics.stages.depthAnything}
              />
            )}
            {state.preview.surfaceIntegration ? (
              <div className="is-v2-base-preview__registration">
                <strong>Surface-Conforming Print Integration</strong>
                <span>
                  {state.preview.surfaceIntegration.contractVersion} · Status {state.preview.surfaceIntegration.status}
                </span>
                <span>
                  Mesh {state.preview.surfaceIntegration.gridColumns}×{state.preview.surfaceIntegration.gridRows} · Warp {state.preview.surfaceIntegration.warpEnabled ? "aktiv" : "nicht erforderlich"} · Stärke {(state.preview.surfaceIntegration.warpStrength * 100).toFixed(2)} % · maximal {state.preview.surfaceIntegration.maximumAppliedWarpPx.toFixed(2)} px
                </span>
                <span>
                  Krümmung {(state.preview.surfaceIntegration.curvatureEvidence * 100).toFixed(1)} % · Falten {(state.preview.surfaceIntegration.foldResponseEvidence * 100).toFixed(1)} % · Licht/Schatten {(state.preview.surfaceIntegration.shadingResponseEvidence * 100).toFixed(1)} % · Textur {(state.preview.surfaceIntegration.textureResponseEvidence * 100).toFixed(1)} %
                </span>
                <span>
                  Maskenabdeckung {(state.preview.surfaceIntegration.maskClippingCoverage * 100).toFixed(2)} % · {state.preview.surfaceIntegration.surfaceEvidenceConfidence ? "Oberflächen-Evidenz" : "Realismus-Konfidenz"} {(state.preview.surfaceIntegration.effectivePrintRealismConfidence * 100).toFixed(1)} % · Flat-Overlay-Risiko {(state.preview.surfaceIntegration.flatOverlayRisk * 100).toFixed(1)} %
                </span>
                {state.preview.surfaceIntegration.surfaceEvidenceConfidence ? (
                  <span>
                    Evidenz: Maske {(state.preview.surfaceIntegration.surfaceEvidenceConfidence.maskReliability * 100).toFixed(1)} % · Geometrie {(state.preview.surfaceIntegration.surfaceEvidenceConfidence.geometryStability * 100).toFixed(1)} % · unbegrenzte Mesh-Knoten {(state.preview.surfaceIntegration.surfaceEvidenceConfidence.unclampedNodeFraction * 100).toFixed(1)} % · Typografie separat geprüft
                  </span>
                ) : null}
                <span>
                  Typografie-Verzerrung {(state.preview.surfaceIntegration.typographyDistortionEstimate * 100).toFixed(2)} % · Begrenzungen {state.preview.surfaceIntegration.clampReasons.length ? state.preview.surfaceIntegration.clampReasons.join(", ") : "Keine"}
                </span>
                {state.preview.surfaceIntegration.typographyDeformation ? (
                  <>
                    <span>
                      Typografie-Metrik {state.preview.surfaceIntegration.typographyDeformation.metricVersion} · aktive Zellen {state.preview.surfaceIntegration.typographyDeformation.activeCellCount} · transparente Zellen ignoriert {state.preview.surfaceIntegration.typographyDeformation.ignoredTransparentCellCount}
                    </span>
                    <span>
                      Lokale Skalierung {(state.preview.surfaceIntegration.typographyDeformation.maximumPrincipalScaleDeviation * 100).toFixed(2)} % · Scherung {(state.preview.surfaceIntegration.typographyDeformation.maximumLocalShear * 100).toFixed(2)} % · Winkeländerung {state.preview.surfaceIntegration.typographyDeformation.maximumLocalAngularDistortionDegrees.toFixed(2)}° · Zellübergang {(state.preview.surfaceIntegration.typographyDeformation.maximumNeighborJacobianDiscontinuity * 100).toFixed(2)} %
                    </span>
                    <span>
                      Stärkste Zellen {state.preview.surfaceIntegration.typographyDeformation.dominantCells.map((cell) => `Z${cell.row + 1}/S${cell.column + 1} ${(cell.risk * 100).toFixed(2)} %`).join(" · ") || "Keine"}
                    </span>
                  </>
                ) : null}
                {state.preview.surfaceIntegration.meshRegularization ? (
                  <span>
                    Mesh-Glättung {state.preview.surfaceIntegration.meshRegularization.passes} Durchläufe · Rohwert alte Metrik {(state.preview.surfaceIntegration.meshRegularization.rawLegacyNeighborGradientEstimate * 100).toFixed(2)} % · reale lokale Deformation vor/nach Begrenzung {(state.preview.surfaceIntegration.meshRegularization.rawJacobianDistortionEstimate * 100).toFixed(2)} % / {(state.preview.surfaceIntegration.meshRegularization.appliedJacobianDistortionEstimate * 100).toFixed(2)} %
                  </span>
                ) : null}
                {state.preview.surfaceIntegration.failClosedReason ? (
                  <span>
                    Sicherheitsablehnung: {state.preview.surfaceIntegration.failClosedReason}
                  </span>
                ) : null}
              </div>
            ) : (
              <MissingPipelineStage
                label="Surface-Conforming Integration"
                stage={state.preview.pipelineDiagnostics.stages.surfaceConforming}
              />
            )}
            {state.preview.depthAwareIntegration ? (
              <div className="is-v2-base-preview__registration">
                <strong>Depth-Aware Surface Integration</strong>
                <span>
                  {state.preview.depthAwareIntegration.contractVersion} · Status {state.preview.depthAwareIntegration.status} · Evidenz {state.preview.depthAwareIntegration.depthEvidenceAvailable ? "vorhanden" : "nicht ausreichend"}
                </span>
                {state.preview.depthAwareIntegration.depthQualityClassification ? (
                  <span>
                    Tiefenklassifikation {state.preview.depthAwareIntegration.depthQualityClassification.replace("DEPTH_", "")} · Oberflächenmodus {state.preview.depthAwareIntegration.surfaceGuidanceMode ?? "REFUSED"}
                  </span>
                ) : null}
                <span>
                  Lokale Shirt-Ebene {state.preview.depthAwareIntegration.localPlaneTiltDegrees.toFixed(2)}° · Perspektive {(state.preview.depthAwareIntegration.localPerspectiveEstimate * 100).toFixed(1)} % · relative Tiefen-Konfidenz {(state.preview.depthAwareIntegration.depthConfidence * 100).toFixed(1)} %
                </span>
                {state.preview.depthAwareIntegration.blendedSurfaceConfidence !== undefined ? (
                  <span>
                    Reale Tiefen-Konfidenz {((state.preview.depthAwareIntegration.realDepthConfidence ?? 0) * 100).toFixed(1)} % · SAM-Abdeckung {(state.preview.depthAwareIntegration.maskCoverage * 100).toFixed(1)} % · Torso-Stabilität {((state.preview.depthAwareIntegration.torsoStability ?? 0) * 100).toFixed(1)} % · lokale Stoffevidenz {((state.preview.depthAwareIntegration.localFabricEvidence ?? 0) * 100).toFixed(1)} % · hybrid {(state.preview.depthAwareIntegration.blendedSurfaceConfidence * 100).toFixed(1)} %
                  </span>
                ) : null}
                {state.preview.depthAwareIntegration.realDepth?.discontinuityFraction !== undefined ? (
                  <span>
                    Reale Tiefendynamik {(state.preview.depthAwareIntegration.realDepth.dynamicRange * 100).toFixed(1)} % · Tiefensprung-Stabilität {((state.preview.depthAwareIntegration.depthDiscontinuityStability ?? 0) * 100).toFixed(1)} % · nutzbare Masken-Samples {((state.preview.depthAwareIntegration.depthSampleCoverage ?? 0) * 100).toFixed(1)} %
                  </span>
                ) : null}
                <span>
                  Oberflächen-Konfidenz {(state.preview.depthAwareIntegration.surfaceConfidence * 100).toFixed(1)} % · lokaler Warp {(state.preview.depthAwareIntegration.appliedLocalWarpStrength * 100).toFixed(2)} % · maximal {state.preview.depthAwareIntegration.maximumLocalWarpPx.toFixed(2)} px
                </span>
                {state.preview.depthAwareIntegration.requestedMaximumLocalWarpPx !== undefined ? (
                  <span>
                    Angeforderter Warp {state.preview.depthAwareIntegration.requestedMaximumLocalWarpPx.toFixed(2)} px · sicher begrenzter Kandidat {(state.preview.depthAwareIntegration.safeBoundedMaximumLocalWarpPx ?? 0).toFixed(2)} px · tatsächlich angewendet {state.preview.depthAwareIntegration.maximumLocalWarpPx.toFixed(2)} px · verworfener Überschuss {(state.preview.depthAwareIntegration.rejectedWarpExcessPx ?? 0).toFixed(2)} px
                  </span>
                ) : null}
                {state.preview.depthAwareIntegration.depthPlaneFitMethod ? (
                  <span>
                    Ebenenfit {state.preview.depthAwareIntegration.depthPlaneFitMethod} · Bereich {state.preview.depthAwareIntegration.depthAnalysisScope ?? "nicht dokumentiert"} · Rohsteigung X/Y {(state.preview.depthAwareIntegration.rawDepthPlaneSlopeX ?? 0).toFixed(3)} / {(state.preview.depthAwareIntegration.rawDepthPlaneSlopeY ?? 0).toFixed(3)} · normalisiert {(state.preview.depthAwareIntegration.normalizedDepthPlaneSlopeX ?? 0).toFixed(4)} / {(state.preview.depthAwareIntegration.normalizedDepthPlaneSlopeY ?? 0).toFixed(4)}
                  </span>
                ) : null}
                {state.preview.depthAwareIntegration.perspectiveNormalizationDenominator !== undefined ? (
                  <span>
                    Perspektivischer Warp {(state.preview.depthAwareIntegration.requestedPerspectiveWarpPx ?? 0).toFixed(2)} px / Sicherheits-Nenner {state.preview.depthAwareIntegration.perspectiveNormalizationDenominator.toFixed(2)} px · begrenzte Knoten {state.preview.depthAwareIntegration.nodesExceedingBounds ?? 0}/{state.preview.depthAwareIntegration.analyzedNodeCount ?? 0}
                  </span>
                ) : null}
                <span>
                  Typografie-Risiko {(state.preview.depthAwareIntegration.typographyRisk * 100).toFixed(2)} % · Maskenabdeckung {(state.preview.depthAwareIntegration.maskCoverage * 100).toFixed(2)} % · Begrenzungen {state.preview.depthAwareIntegration.clampReasons.length ? state.preview.depthAwareIntegration.clampReasons.join(", ") : "Keine"}
                </span>
                <span>
                  Globaler Footprint {state.preview.depthAwareIntegration.globalFootprintPreserved ? "ERHALTEN" : "NICHT ERHALTEN"} · zweite Skalierung {state.preview.depthAwareIntegration.secondaryScaleApplied ? "JA" : "NEIN"} · zweite Verschiebung {state.preview.depthAwareIntegration.secondaryTranslationApplied ? "JA" : "NEIN"}
                </span>
                {state.preview.depthAwareIntegration.failClosedReason ? (
                  <span>
                    Sicherheitsablehnung: {state.preview.depthAwareIntegration.failClosedReason}
                  </span>
                ) : null}
              </div>
            ) : (
              <MissingPipelineStage
                label="Depth-Aware Surface Integration"
                stage={state.preview.pipelineDiagnostics.stages.depthAware}
              />
            )}
            {state.preview.surfaceRealismRefinement ? (
              <div className="is-v2-base-preview__registration">
                <strong>Surface Realism Refinement</strong>
                <span>
                  {state.preview.surfaceRealismRefinement.contractVersion} · Status {state.preview.surfaceRealismRefinement.status} · stärkere Ebenenführung {state.preview.surfaceRealismRefinement.strongerPlaneGuidanceUsed ? "JA" : "NICHT ERFORDERLICH"}
                </span>
                <span>
                  Reale Tiefe {state.preview.surfaceRealismRefinement.realDepthUsed ? "JA" : "NEIN"} · lokale Gegenprüfung {state.preview.surfaceRealismRefinement.localFallbackUsed ? "FALLBACK" : "AKTIV"} · Oberflächenrichtung {state.preview.surfaceRealismRefinement.surfaceDirectionEvidenceUsed ? "VERWENDET" : "NICHT SICHER"}
                </span>
                <span>
                  Ebene {(state.preview.surfaceRealismRefinement.planeGuidanceStrength * 100).toFixed(1)} % · Perspektive {(state.preview.surfaceRealismRefinement.perspectiveGuidanceStrength * 100).toFixed(1)} % · Krümmung {(state.preview.surfaceRealismRefinement.curvatureEvidence * 100).toFixed(1)} % · Evidenz {(state.preview.surfaceRealismRefinement.evidenceConfidence * 100).toFixed(1)} %
                </span>
                <span>
                  Lokaler Warp {(state.preview.surfaceRealismRefinement.localWarpStrength * 100).toFixed(2)} % · maximal {state.preview.surfaceRealismRefinement.maximumLocalWarpPx.toFixed(2)} px · begrenzte Knoten {(state.preview.surfaceRealismRefinement.clampedNodeFraction * 100).toFixed(1)} %
                </span>
                <span>
                  Licht/Schatten {(state.preview.surfaceRealismRefinement.shadingTransferStrength * 100).toFixed(0)} % · Textur {(state.preview.surfaceRealismRefinement.textureTransferStrength * 100).toFixed(0)} % · Typografie-Risiko {(state.preview.surfaceRealismRefinement.typographyRisk * 100).toFixed(2)} % · Maske {(state.preview.surfaceRealismRefinement.maskCoverage * 100).toFixed(2)} %
                </span>
                <span>
                  Footprint gepinnt {state.preview.surfaceRealismRefinement.footprintPinned ? "JA" : "NEIN"} · registriertes Y erhalten {state.preview.surfaceRealismRefinement.registeredYPreserved ? "JA" : "NEIN"} · zweites CONTAIN {state.preview.surfaceRealismRefinement.secondContainApplied ? "JA" : "NEIN"} · zweite Skalierung {state.preview.surfaceRealismRefinement.secondGlobalScaleApplied ? "JA" : "NEIN"} · zweite Verschiebung {state.preview.surfaceRealismRefinement.secondGlobalTranslationApplied ? "JA" : "NEIN"}
                </span>
                {state.preview.surfaceRealismRefinement.failClosedReason ? (
                  <span>Sicherheitsablehnung: {state.preview.surfaceRealismRefinement.failClosedReason}</span>
                ) : null}
              </div>
            ) : (
              <MissingPipelineStage
                label="Surface Realism Refinement"
                stage={state.preview.pipelineDiagnostics.stages.surfaceRealism}
              />
            )}
            {!state.preview.surfaceRealismRefinement ? (
              <MissingPipelineStage
                label="Fabric Composite"
                stage={state.preview.pipelineDiagnostics.stages.fabricComposite}
              />
            ) : null}
            {purity ? (
              <dl className="is-v2-base-preview__metrics">
                <div>
                  <dt>Farbabweichung</dt>
                  <dd>{(purity.outlierFraction * 100).toFixed(2)} %</dd>
                </div>
                <div>
                  <dt>Scharfe Abweichung</dt>
                  <dd>{(purity.sharpOutlierFraction * 100).toFixed(2)} %</dd>
                </div>
                <div>
                  <dt>Größte zusammenhängende Struktur</dt>
                  <dd>
                    {(purity.largestSharpComponentFraction * 100).toFixed(3)} %
                  </dd>
                </div>
                <div>
                  <dt>Prüfvertrag</dt>
                  <dd>{purity.contractVersion}</dd>
                </div>
              </dl>
            ) : null}
          </>
        ) : null}
      </div>
    </details>
  );
}

function pointsFromSurface(surface: PrintSurface) {
  const selectedQuad = surface.quad;
  if (!selectedQuad) return EMPTY_CORNER_FIELDS;
  return {
    tlx: String(selectedQuad[0].x),
    tly: String(selectedQuad[0].y),
    trx: String(selectedQuad[1].x),
    try: String(selectedQuad[1].y),
    brx: String(selectedQuad[2].x),
    bry: String(selectedQuad[2].y),
    blx: String(selectedQuad[3].x),
    bly: String(selectedQuad[3].y),
  };
}
const BLOCKER_LABELS: Record<string, string> = {
  MISSING_ARTWORK: "Wähle ein freigegebenes Artwork aus.",
  MISSING_PRODUCT:
    "Wähle ein Shopify-verifiziertes Produkt mit Farbe und Größe aus.",
  MISSING_BRAND_MODEL: "Wähle ein für Bilder freigegebenes Markenmodel aus.",
  MISSING_SHOT: "Wähle genau eine Aufnahme aus.",
  MISSING_CREATIVE_DIRECTION:
    "Wähle eine kreative Richtung für diese Aufnahme.",
  MISSING_SEMANTIC_PLACEMENT: "Wähle Druckseite und Platzierung aus.",
  BOTH_REQUIRES_TWO_JOBS:
    "Beidseitig plant zwei Aufnahmen, die einzeln erstellt werden.",
  MISSING_RESOLVED_PRINT_SURFACE:
    "Für dieses Produkt ist diese Platzierung noch nicht verfügbar. Öffne die Produktdetails, um sie einzurichten.",
  MISSING_PRINT_SURFACE:
    "Für diesen Produkttyp ist keine sichere automatische Platzierung verfügbar.",
  INVALID_PRINT_SURFACE:
    "Die gespeicherte Produktplatzierung ist ungültig.",
};

function authorityFrom(input: {
  reportRecordId: string | null;
  reportId: string | null;
  assetId: string | null;
  brandModelTrace: BrandModelTrace | null;
  masterArtwork: MasterArtworkReference | null;
  shopifyProductId: string | null;
  shopifyVariantId: string | null;
  productProfile: PrepareAuthorityInputs["productProfile"];
  semanticPlacement: PrepareAuthorityInputs["semanticPlacement"];
  productionOverride: PrepareAuthorityInputs["productionOverride"];
  ownerArtworkPlacement: PrepareAuthorityInputs["ownerArtworkPlacement"];
  creativeDirection: SocialCreativeDirectionV1 | null;
  points: PrepareAuthorityInputs["points"];
}): PrepareAuthorityInputs {
  return {
    reportRecordId: input.reportRecordId,
    reportId: input.reportId,
    assetId: input.assetId,
    hasBrandModel: Boolean(input.brandModelTrace),
    hasMasterArtwork: Boolean(input.masterArtwork),
    shopifyProductId: input.shopifyProductId,
    shopifyVariantId: input.shopifyVariantId,
    productProfile: input.productProfile,
    semanticPlacement: input.semanticPlacement,
    productionOverride: input.productionOverride,
    ownerArtworkPlacement: input.ownerArtworkPlacement,
    creativeDirection: input.creativeDirection,
    points: input.points,
  };
}

function currentInputsFrom(input: {
  reportRecordId: string | null;
  reportId: string | null;
  assetId: string | null;
  brandModelTrace: BrandModelTrace | null;
  masterArtwork: MasterArtworkReference | null;
  shopifyProductId: string | null;
  shopifyVariantId: string | null;
  productProfile: PrepareAuthorityInputs["productProfile"];
  semanticPlacement: PrepareAuthorityInputs["semanticPlacement"];
  creativeDirection: SocialCreativeDirectionV1 | null;
  ownerArtworkPlacement?: OwnerArtworkPlacement | null;
  points: PrepareAuthorityInputs["points"];
}): CurrentV2Inputs {
  return {
    reportRecordId: input.reportRecordId,
    reportId: input.reportId,
    assetId: input.assetId,
    brandModelId: input.brandModelTrace?.brandModelId ?? null,
    identityLockVersion: input.brandModelTrace?.identityLockVersion ?? null,
    artworkId: input.masterArtwork?.id ?? null,
    artworkVersion: input.masterArtwork?.version ?? null,
    artworkChecksum: input.masterArtwork?.checksum ?? null,
    shopifyProductId: input.shopifyProductId,
    shopifyVariantId: input.shopifyVariantId,
    productProfileId: input.productProfile?.profileKey ?? null,
    productProfileVersion: input.productProfile?.version ?? null,
    printSide: input.semanticPlacement?.printSide ?? null,
    placementPreset: input.semanticPlacement?.placementPreset ?? null,
    creativeDirectionSignature: creativeDirectionPlanningKey(
      input.creativeDirection,
    ),
    ownerArtworkPlacementSignature: input.ownerArtworkPlacement
      ? JSON.stringify(input.ownerArtworkPlacement)
      : null,
    points: input.points,
  };
}

export function DeterministicV2Panel(props: {
  reportRecordId: string | null;
  reportId: string | null;
  assetId: string | null;
  brandModelTrace: BrandModelTrace | null;
  masterArtwork: MasterArtworkReference | null;
  artworkLabel?: string | null;
  artworkOriginalFileName?: string | null;
  shopifyProductId: string | null;
  shopifyVariantId: string | null;
  productProfile:
    | (NonNullable<PrepareAuthorityInputs["productProfile"]> & {
        productFamily?: ProductFamilyConfig | null;
        blankReferences?: Array<{
          referenceId: string;
          previewUrl: string | null;
          width: number | null;
          height: number | null;
          side: "FRONT" | "BACK";
          colorKey: string;
        }>;
      })
    | null;
  reusablePrintSurfaces?: ImagePrintSurfaceSelection[];
  productType?: string | null;
  productName?: string | null;
  productColor?: string | null;
  productSize?: string | null;
  brandModelLabel?: string | null;
  shotLabel?: string | null;
  shotDimensions?: string | null;
  creativeDirection: SocialCreativeDirectionV1 | null;
  onShotSelectionChange?: (assetId: string) => void;
}) {
  const [printSide, setPrintSide] = useState<PrintSide>("FRONT");
  const [placementPreset, setPlacementPreset] =
    useState<SemanticPlacementPreset | null>(null);
  const [bothPreset, setBothPreset] = useState<BothSidePlacementPreset>(
    "FRONT_LEFT_BACK_LARGE",
  );
  const [flow, setFlow] = useState<PrepareFlowState>(initialPrepareFlowState);
  const [activeUi, setActiveUi] = useState(initialActiveV2UiState);
  const [knownJobs, setKnownJobs] = useState<V2PreparedJob[]>([]);
  const [previousRuns, setPreviousRuns] = useState<PreviousRunOwnerView[]>([]);
  const [previousRunsState, setPreviousRunsState] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [previousRunsFilter, setPreviousRunsFilter] = useState<
    "ALL" | "SUCCESS" | "FAILED" | "REVIEW"
  >("ALL");
  const [openingRunId, setOpeningRunId] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionPhase, setActionPhase] =
    useState<OwnerProductionActionPhase | null>(null);
  const [technicalError, setTechnicalError] = useState<string | null>(null);
  const [recoveredContinuation, setRecoveredContinuation] = useState(false);
  const [artworkPreview, setArtworkPreview] = useState<null | {
    url: string;
    width: number;
    height: number;
  }>(null);
  const [ownerArtworkPlacement, setOwnerArtworkPlacement] =
    useState<OwnerArtworkPlacement | null>(null);
  const prepareLock = useRef(false);
  const flowRef = useRef(flow);
  const activeUiRef = useRef(activeUi);
  const recoverGeneration = useRef(0);
  const executionPollGeneration = useRef(0);
  const ownerChoseSide = useRef(false);
  const ownerChosePlacement = useRef(false);
  const lastProductIdentity = useRef<string | null>(null);
  const familyPreviewRef = useRef<HTMLDivElement>(null);
  const familyArtworkDrag = useRef<{
    x: number;
    y: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  flowRef.current = flow;
  activeUiRef.current = activeUi;

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    setArtworkPreview(null);
    if (!props.masterArtwork?.id) return;

    void fetch(`/api/design/master-artworks/${props.masterArtwork.id}`, {
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Artwork-Vorschau nicht verfügbar");
        return response.blob();
      })
      .then(
        (blob) =>
          new Promise<{ url: string; width: number; height: number }>(
            (resolve, reject) => {
              objectUrl = URL.createObjectURL(blob);
              const image = new Image();
              image.onload = () =>
                resolve({
                  url: objectUrl!,
                  width: image.naturalWidth,
                  height: image.naturalHeight,
                });
              image.onerror = () => reject(new Error("Artwork decode failed"));
              image.src = objectUrl;
            },
          ),
      )
      .then((preview) => {
        if (!cancelled) setArtworkPreview(preview);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [props.masterArtwork?.checksum, props.masterArtwork?.id]);

  const surfaceCandidates = useMemo<ImagePrintSurfaceSelection[]>(() => {
    const candidates = [
      ...(props.reusablePrintSurfaces ?? []),
      ...(props.productProfile?.printSurfaces ?? []).map((surface) => ({
        surface,
        ownerProfileKey:
          surface.reuse?.sourceProductProfileId ??
          props.productProfile!.profileKey,
        ownerProfileVersion:
          surface.reuse?.sourceProductProfileVersion ??
          props.productProfile!.version,
        inherited:
          surface.productProfileId !== props.productProfile!.profileKey,
      })),
    ];
    const unique = new Map<string, ImagePrintSurfaceSelection>();
    for (const candidate of candidates) {
      unique.set(
        `${candidate.ownerProfileKey}|${candidate.surface.printSurfaceId}|${candidate.surface.version}`,
        candidate,
      );
    }
    return [...unique.values()];
  }, [props.productProfile, props.reusablePrintSurfaces]);
  const availablePrintSurfaces = useMemo(
    () => surfaceCandidates.map((candidate) => candidate.surface),
    [surfaceCandidates],
  );
  const exactVariantId =
    props.shopifyVariantId ?? props.productProfile?.variantId ?? null;
  const productFamilyTemplate =
    printSide === "BOTH"
      ? null
      : (props.productProfile?.productFamily?.placementTemplates.find(
          (template) =>
            template.side === printSide && template.status === "READY",
        ) ?? null);
  const selectedFamilyColor = props.productProfile?.productFamily?.colors.find(
    (entry) =>
      entry.colorName.toLocaleLowerCase("de-DE") ===
      props.productColor?.toLocaleLowerCase("de-DE"),
  );
  const selectedBlankReference = props.productProfile?.blankReferences?.find(
    (reference) =>
      reference.side === printSide &&
      reference.colorKey === selectedFamilyColor?.colorKey,
  );
  const selectedProfileKey = props.productProfile?.profileKey ?? null;
  const productIdentity = `${props.shopifyProductId ?? props.productProfile?.profileKey ?? "none"}|${exactVariantId ?? "none"}`;
  const shotSideIntent =
    contentShotById(props.assetId ?? "")?.sideIntent ?? "OWNER_SELECTABLE";
  const previewOutputSize = useMemo(() => {
    const match = /^(\d+)x(\d+)$/.exec(props.shotDimensions?.trim() ?? "");
    const width = match ? Number(match[1]) : 2048;
    const height = match ? Number(match[2]) : 2048;
    return {
      width:
        Number.isInteger(width) && width > 0 ? width : 2048,
      height:
        Number.isInteger(height) && height > 0 ? height : 2048,
    };
  }, [props.shotDimensions]);

  useEffect(() => {
    if (lastProductIdentity.current === productIdentity) return;
    lastProductIdentity.current = productIdentity;
    ownerChoseSide.current = false;
    ownerChosePlacement.current = false;
    setPrintSide(shotSideIntent === "BACK" ? "BACK" : "FRONT");
    setPlacementPreset(null);
  }, [productIdentity, shotSideIntent]);

  useEffect(() => {
    if (!productFamilyTemplate) {
      setOwnerArtworkPlacement(null);
      return;
    }
    setOwnerArtworkPlacement((current) =>
      current?.templateId === productFamilyTemplate.templateId &&
      current.templateVersion === productFamilyTemplate.version
        ? current
        : defaultOwnerArtworkPlacement(productFamilyTemplate),
    );
  }, [productFamilyTemplate]);

  useEffect(() => {
    if (ownerChoseSide.current || shotSideIntent === "OWNER_SELECTABLE") return;
    setPrintSide(shotSideIntent);
    ownerChosePlacement.current = false;
    setPlacementPreset(null);
  }, [props.assetId, shotSideIntent]);

  const placementOptions = useMemo(
    () =>
      printSide === "BOTH"
        ? []
        : semanticPlacementOptions({
            productType: props.productType,
            side: printSide,
          }),
    [printSide, props.productType],
  );

  const resolvePlacement = useCallback(
    (
      side: Exclude<PrintSide, "BOTH">,
      preset: SemanticPlacementPreset,
    ) =>
      selectedProfileKey
        ? resolveAutomaticProductPlacement({
            productProfileId: selectedProfileKey,
            productType: props.productType,
            variantId: exactVariantId,
            printSide: side,
            placementPreset: preset,
            printSurfaces: availablePrintSurfaces,
          })
        : null,
    [
      availablePrintSurfaces,
      exactVariantId,
      props.productType,
      selectedProfileKey,
    ],
  );

  useEffect(() => {
    if (printSide === "BOTH" || placementPreset || ownerChosePlacement.current)
      return;
    const preferred = printSide === "FRONT" ? "FRONT_LARGE" : "BACK_LARGE";
    const candidates = [
      placementOptions.find((option) => option.preset === preferred),
      ...placementOptions,
    ].filter((option): option is (typeof placementOptions)[number] =>
      Boolean(option),
    );
    const readyDefault = candidates.find(
      (option) =>
        resolvePlacement(printSide, option.preset)?.ok,
    );
    if (readyDefault) setPlacementPreset(readyDefault.preset);
  }, [
    placementOptions,
    placementPreset,
    printSide,
    resolvePlacement,
  ]);

  const placementResolution = useMemo(
    () =>
      printSide !== "BOTH" && placementPreset
        ? resolvePlacement(printSide, placementPreset)
        : null,
    [placementPreset, printSide, resolvePlacement],
  );
  const resolvedSurface = placementResolution?.ok
    ? placementResolution.surface
    : null;
  const resolvedSurfaceCandidate = resolvedSurface
    ? (surfaceCandidates.find(
        (candidate) =>
          candidate.surface.printSurfaceId === resolvedSurface.printSurfaceId &&
          candidate.surface.version === resolvedSurface.version,
      ) ?? null)
    : null;

  const points = useMemo(
    () =>
      resolvedSurface
        ? pointsFromSurface(resolvedSurface)
        : EMPTY_CORNER_FIELDS,
    [resolvedSurface],
  );
  const previewTuning = useMemo(
    () =>
      resolvedSurface
        ? resolveFrontLargeProductionTuning({
            productType: props.productType,
            placementPreset,
            surface: resolvedSurface,
          })
        : null,
    [placementPreset, props.productType, resolvedSurface],
  );
  const quad = previewTuning?.quad ?? resolvedSurface?.quad ?? null;
  const rectangularPreviewRegion = useMemo(() => {
    if (!quad) return null;
    const xs = quad.map((point) => point.x * previewOutputSize.width);
    const ys = quad.map((point) => point.y * previewOutputSize.height);
    const x = Math.min(...xs);
    const y = Math.min(...ys);
    return {
      x,
      y,
      width: Math.max(...xs) - x,
      height: Math.max(...ys) - y,
    };
  }, [previewOutputSize.height, previewOutputSize.width, quad]);
  const lockedArtworkPreviewPlacement = useMemo(() => {
    if (!quad || !artworkPreview) return null;
    try {
      return resolveAspectLockedArtworkPlacement({
        sourceWidth: artworkPreview.width,
        sourceHeight: artworkPreview.height,
        surfaceQuad: quad,
        outputWidth: previewOutputSize.width,
        outputHeight: previewOutputSize.height,
      });
    } catch {
      return null;
    }
  }, [artworkPreview, previewOutputSize, quad]);
  const familyArtworkPreviewQuad = useMemo(() => {
    if (
      !productFamilyTemplate ||
      !ownerArtworkPlacement ||
      !artworkPreview ||
      !selectedBlankReference?.width ||
      !selectedBlankReference.height
    ) return null;
    try {
      return resolveOwnerArtworkQuad({
        printableArea: productFamilyTemplate.normalizedRegion,
        artworkWidth: artworkPreview.width,
        artworkHeight: artworkPreview.height,
        referenceWidth: selectedBlankReference.width,
        referenceHeight: selectedBlankReference.height,
        placement: ownerArtworkPlacement,
      });
    } catch {
      return null;
    }
  }, [
    artworkPreview,
    ownerArtworkPlacement,
    productFamilyTemplate,
    selectedBlankReference,
  ]);
  const familyArtworkPreviewBox = useMemo(() => {
    if (!familyArtworkPreviewQuad) return null;
    const xs = familyArtworkPreviewQuad.map((point) => point.x);
    const ys = familyArtworkPreviewQuad.map((point) => point.y);
    return {
      x: Math.min(...xs),
      y: Math.min(...ys),
      width: Math.max(...xs) - Math.min(...xs),
      height: Math.max(...ys) - Math.min(...ys),
    };
  }, [familyArtworkPreviewQuad]);
  const exactProductProfile = useMemo<
    PrepareAuthorityInputs["productProfile"]
  >(() => {
    const base = props.productProfile;
    if (!base) return null;
    if (!resolvedSurface)
      return {
        ...base,
        printSurface: null,
        calibrationTarget: placementPreset
          ? {
              printSurfaceId: `pending:${placementPreset}`,
              region:
                SEMANTIC_PLACEMENT_DEFINITIONS[placementPreset].regions[0]!,
            }
          : null,
      };
    return {
      ...base,
      printSurface: {
        printSurfaceId: resolvedSurface.printSurfaceId,
        version: resolvedSurface.version,
        quad: resolvedSurface.quad ?? undefined,
        authority:
          placementResolution?.authority === "NEXHQ_PRODUCT_TEMPLATE"
            ? "NEXHQ_PRODUCT_TEMPLATE"
            : "PRODUCT_PROFILE",
        ...(placementResolution?.template
          ? {
              templateId: placementResolution.template.templateId,
              templateVersion: placementResolution.template.version,
            }
          : {}),
        ownerProfileKey:
          resolvedSurfaceCandidate?.ownerProfileKey ?? base.profileKey,
        ownerProfileVersion:
          resolvedSurfaceCandidate?.ownerProfileVersion ?? base.version,
        inherited: resolvedSurfaceCandidate?.inherited ?? false,
      },
    };
  }, [
    placementPreset,
    placementResolution,
    props.productProfile,
    resolvedSurface,
    resolvedSurfaceCandidate,
  ]);
  const semanticPlacement = useMemo<
    PrepareAuthorityInputs["semanticPlacement"]
  >(() => ({ printSide, placementPreset }), [placementPreset, printSide]);

  const authority = useMemo(
    () =>
      authorityFrom({
        reportRecordId: props.reportRecordId,
        reportId: props.reportId,
        assetId: props.assetId,
        brandModelTrace: props.brandModelTrace,
        masterArtwork: props.masterArtwork,
        shopifyProductId: props.shopifyProductId,
        shopifyVariantId: props.shopifyVariantId,
        productProfile: exactProductProfile,
        semanticPlacement,
        productionOverride: null,
        ownerArtworkPlacement,
        creativeDirection: props.creativeDirection,
        points,
      }),
    [
      points,
      props.reportRecordId,
      props.reportId,
      props.assetId,
      props.brandModelTrace,
      props.masterArtwork,
      props.shopifyProductId,
      props.shopifyVariantId,
      exactProductProfile,
      semanticPlacement,
      ownerArtworkPlacement,
      props.creativeDirection,
    ],
  );
  const currentInputs = useMemo(
    () =>
      currentInputsFrom({
        reportRecordId: props.reportRecordId,
        reportId: props.reportId,
        assetId: props.assetId,
        brandModelTrace: props.brandModelTrace,
        masterArtwork: props.masterArtwork,
        shopifyProductId: props.shopifyProductId,
        shopifyVariantId: props.shopifyVariantId,
        productProfile: exactProductProfile,
        semanticPlacement,
        creativeDirection: props.creativeDirection,
        ownerArtworkPlacement,
        points,
      }),
    [
      points,
      props.reportRecordId,
      props.reportId,
      props.assetId,
      props.brandModelTrace,
      props.masterArtwork,
      props.shopifyProductId,
      props.shopifyVariantId,
      exactProductProfile,
      semanticPlacement,
      ownerArtworkPlacement,
      props.creativeDirection,
    ],
  );
  const blockers = useMemo(() => listPrepareBlockers(authority), [authority]);
  const busy = isPrepareInFlight(flow) || actionBusy;
  const recovery = activeUi.recovery;
  const containFitDiagnostics = useMemo(() => {
    const stage = recovery?.stages.find(
      (candidate) =>
        candidate.stage === "DETERMINISTIC_COMPOSITE" &&
        candidate.status === "SUCCEEDED",
    );
    return containFitFromProvenance(stage?.provenance?.containFit);
  }, [recovery?.stages]);
  const checklist = activeUi.checklist;
  const reviewAcknowledged = Object.values(checklist).every(Boolean);
  const isSyntheticRun = Boolean(
    recovery?.stages.some(
      (stage) => stage.provenance?.providerMode === "FAKE_SYNTHETIC",
    ),
  );
  const job = flow.job;
  const openedRunView = job
    ? previousRuns.find((run) => run.jobId === job.id) ?? null
    : null;
  const productionState = resolveOwnerProductionState({
    busy,
    actionPhase,
    prepareStatus: flow.status,
    recoveryState: recovery?.state ?? null,
    jobStatus: recovery?.job.status ?? job?.status ?? null,
    reviewStatus: recovery?.asset?.reviewStatus ?? null,
    recoveredContinuation,
    duplicateClickIgnored: flow.duplicateClickIgnored,
    hasError: Boolean(flow.error),
    depthAnalysisPending: Boolean(
      recovery?.state === "COMPOSITING" &&
        recovery.job.inputSnapshot.depthEstimationPolicy &&
        !recovery.stages.some((stage) => {
          const depth = stage.provenance?.depthEstimation as
            | { status?: unknown }
            | undefined;
          return depth?.status === "VALIDATED";
        }),
    ),
  });
  const controlsBusy = busy || productionState.busy;
  useEffect(() => {
    if (!job) return;
    setKnownJobs((current) => [
      job,
      ...current.filter((candidate) => candidate.id !== job.id),
    ]);
  }, [job]);
  const canPrepare = isPrepareButtonEnabled(authority, flow, recovery?.state);
  const showPrepare =
    (!job || job.status === "cancelled") &&
    !recovery?.asset &&
    !isPrepareInFlight(flow);
  const inputSignature = panelInputFingerprint(currentInputs);
  const currentInputsRef = useRef(currentInputs);
  const inputSignatureRef = useRef(inputSignature);
  currentInputsRef.current = currentInputs;
  inputSignatureRef.current = inputSignature;

  const currentStep = recovery?.asset
    ? 3
    : job || recovery
      ? 2
      : placementPreset || printSide === "BOTH"
        ? 1
        : 0;

  const applyRecovery = useCallback(
    (next: V2Recovery, source: "reload" | "prepare" | "action") => {
      const recoveredPlacement = ownerArtworkPlacementFromRecovery(next);
      const recoveredInputs = recoveredPlacement
        ? {
            ...currentInputsRef.current,
            ownerArtworkPlacementSignature: JSON.stringify(recoveredPlacement),
          }
        : currentInputsRef.current;
      const applied = applyRecoveredRunToUi({
        state: activeUiRef.current,
        recovery: next,
        currentInputs: recoveredInputs,
        source,
      });
      if (recoveredPlacement) setOwnerArtworkPlacement(recoveredPlacement);
      setActiveUi(applied.state);
      if (applied.role === "historical") {
        setFlow((current) =>
          isPrepareInFlight(current) ? current : initialPrepareFlowState(),
        );
        return "historical" as const;
      }
      setRecoveredContinuation(
        source === "reload" && next.state === "CONFIRMED",
      );
      setFlow((current) => ({
        ...current,
        job: next.job,
        status:
          current.status === "preparing" ||
          current.status === "ready" ||
          current.status === "idle"
            ? "ready"
            : current.status,
        statusLabel:
          statusLabelForRecovery(next.state) ??
          (current.status === "preparing"
            ? "Bereit zur Bestätigung"
            : current.statusLabel),
        error: null,
      }));
      return "active" as const;
    },
    [],
  );

  const recover = useCallback(
    async (jobId: string, source: "reload" | "prepare" | "action") => {
      const generation = ++recoverGeneration.current;
      const fingerprintAtStart = inputSignatureRef.current;
      const response = await callBrowserFetch(`/api/image/v2/jobs/${jobId}`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as {
        recovery?: V2Recovery;
        error?: string;
      };
      if (!response.ok || !payload.recovery)
        throw new Error(
          payload.error ?? "Der Produktionsstand konnte nicht geladen werden.",
        );
      if (generation !== recoverGeneration.current) return;
      if (
        source !== "reload" &&
        fingerprintAtStart !== inputSignatureRef.current
      )
        return;
      applyRecovery(payload.recovery, source);
    },
    [applyRecovery],
  );

  useEffect(() => {
    let cancelled = false;
    const generation = recoverGeneration.current;
    void callBrowserFetch("/api/image/v2/jobs?view=resume", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then(async (payload: { jobs?: V2PreparedJob[] } | null) => {
        setKnownJobs(payload?.jobs ?? []);
        const latest = payload?.jobs?.[0];
        const remainder = (payload?.jobs ?? []).slice(1).map((candidate) => ({
          jobId: candidate.id,
          state: candidate.status,
          jobStatus: candidate.status,
          inputFingerprint: candidate.inputFingerprint,
          shotTitle: candidate.inputSnapshot.shot.title,
          printSurfaceLabel: `${candidate.inputSnapshot.printSurface.region} v${candidate.inputSnapshot.printSurface.version}`,
          reviewStatus: null,
          lineage: null,
        }));
        if (cancelled || generation !== recoverGeneration.current) return;
        if (!latest) {
          if (remainder.length)
            setActiveUi((current) => ({ ...current, historical: remainder }));
          return;
        }
        const response = await callBrowserFetch(
          `/api/image/v2/jobs/${latest.id}`,
          { cache: "no-store" },
        );
        const body = (await response.json()) as {
          recovery?: V2Recovery;
          error?: string;
        };
        if (
          cancelled ||
          generation !== recoverGeneration.current ||
          !response.ok ||
          !body.recovery
        )
          return;
        const applied = applyRecoveredRunToUi({
          state: { ...initialActiveV2UiState(), historical: remainder },
          recovery: body.recovery,
          currentInputs: currentInputsRef.current,
          source: "reload",
        });
        setActiveUi(applied.state);
        if (applied.role === "active") {
          setRecoveredContinuation(body.recovery.state === "CONFIRMED");
          setFlow({
            ...initialPrepareFlowState(),
            job: body.recovery.job,
            status: "ready",
            statusLabel: statusLabelForRecovery(body.recovery.state),
          });
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      recoverGeneration.current += 1;
    };
  }, []);

  useEffect(() => {
    setFlow((current) => clearPrepareError(current));
    if (isPrepareInFlight(flowRef.current)) return;
    const jobToCheck =
      flowRef.current.job ?? activeUiRef.current.recovery?.job ?? null;
    if (!jobToCheck && !activeUiRef.current.recovery) return;
    const next = applyInputChangeToActiveRun({
      state: activeUiRef.current,
      job: jobToCheck,
      currentInputs: currentInputsRef.current,
    });
    if (!next.stale) return;
    recoverGeneration.current += 1;
    setActiveUi(next.state);
    setRecoveredContinuation(false);
    setFlow(resetActivePrepareFlow(flowRef.current));
  }, [inputSignature]);

  async function prepare() {
    if (prepareLock.current || isPrepareInFlight(flowRef.current)) {
      setFlow((current) => ({ ...current, duplicateClickIgnored: true }));
      return;
    }
    prepareLock.current = true;
    recoverGeneration.current += 1;
    setRecoveredContinuation(false);
    setTechnicalError(null);
    setActiveUi((current) => resetActiveUiForNewPrepare(current));
    setFlow((current) => resetActivePrepareFlow(current));
    try {
      const result = await handlePrepareClick({
        authority,
        payload: {
          brandModelTrace: props.brandModelTrace,
          masterArtwork: props.masterArtwork,
        },
        flow: initialPrepareFlowState(),
        onState: setFlow,
        onDiagnostics: (details) => {
          console.error("V2 prepare diagnostics", details);
        },
      });
      setFlow(result);
      if (result.job) await recover(result.job.id, "prepare");
    } catch (error) {
      setFlow((current) => ({
        ...current,
        status: "error",
        statusLabel: null,
        error:
          error instanceof Error
            ? error.message
            : "Die Vorbereitung ist fehlgeschlagen.",
      }));
    } finally {
      prepareLock.current = false;
    }
  }

  async function postJobAction(
    targetJob: V2PreparedJob,
    action: "confirm" | "execute_real" | "execute_fake" | "retry_composite",
  ) {
    const response = await callBrowserFetch(
      `/api/image/v2/jobs/${targetJob.id}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          inputFingerprint: targetJob.inputFingerprint,
        }),
      },
    );
    const payload = (await response.json()) as {
      job?: V2PreparedJob;
      recovery?: V2Recovery;
      error?: string;
    };
    if (!response.ok)
      throw new Error(
        payload.error ?? "Der Produktionsschritt ist fehlgeschlagen.",
      );
    return payload;
  }

  async function postJobActionWithProgressPolling(
    targetJob: V2PreparedJob,
    action: "execute_real" | "retry_composite",
  ) {
    const generation = ++executionPollGeneration.current;
    let pollInFlight = false;
    const poll = async () => {
      if (
        document.visibilityState === "hidden" ||
        pollInFlight ||
        generation !== executionPollGeneration.current
      )
        return;
      pollInFlight = true;
      try {
        const response = await callBrowserFetch(
          `/api/image/v2/jobs/${targetJob.id}`,
          { cache: "no-store" },
        );
        const payload = (await response.json()) as {
          recovery?: V2Recovery;
        };
        if (
          response.ok &&
          payload.recovery &&
          generation === executionPollGeneration.current
        ) {
          applyRecovery(payload.recovery, "action");
        }
      } catch {
        // Execution remains authoritative. A transient status refresh must not
        // interrupt or duplicate the one paid provider attempt.
      } finally {
        pollInFlight = false;
      }
    };
    const interval = window.setInterval(() => void poll(), 1_500);
    try {
      return await postJobAction(targetJob, action);
    } finally {
      executionPollGeneration.current += 1;
      window.clearInterval(interval);
    }
  }

  async function act(
    action: "execute_real" | "execute_fake" | "retry_composite",
  ) {
    if (!job) return;
    setActionBusy(true);
    setRecoveredContinuation(false);
    setTechnicalError(null);
    setActionPhase(action === "retry_composite" ? "composite" : "base");
    try {
      const payload =
        action === "execute_fake"
          ? await postJobAction(job, action)
          : await postJobActionWithProgressPolling(job, action);
      if (payload.recovery) applyRecovery(payload.recovery, "action");
      else if (payload.job) {
        setFlow((current) => ({ ...current, job: payload.job!, error: null }));
        await recover(payload.job.id, "action");
      }
    } catch (error) {
      const details =
        error instanceof Error
          ? error.message
          : "Der Produktionsschritt ist fehlgeschlagen.";
      setTechnicalError(details);
      if (job.status === "confirmed") setRecoveredContinuation(true);
      setFlow((current) => ({
        ...current,
        status: "error",
        statusLabel: null,
        error: ownerFacingProductionError(details),
      }));
    } finally {
      setActionBusy(false);
      setActionPhase(null);
    }
  }

  async function createImage() {
    if (!job) return;
    let confirmationCompleted = false;
    setActionBusy(true);
    setRecoveredContinuation(false);
    setTechnicalError(null);
    setActionPhase("confirming");
    try {
      const confirmedPayload = await postJobAction(job, "confirm");
      const confirmedJob = confirmedPayload.job;
      if (!confirmedJob) {
        throw new Error("Die Bild-Erstellung konnte nicht bestätigt werden.");
      }
      confirmationCompleted = true;
      setFlow((current) => ({
        ...current,
        job: confirmedJob,
        error: null,
      }));
      setActionPhase("base");
      const executionPayload = await postJobActionWithProgressPolling(
        confirmedJob,
        "execute_real",
      );
      if (executionPayload.recovery) {
        applyRecovery(executionPayload.recovery, "action");
      } else if (executionPayload.job) {
        setFlow((current) => ({
          ...current,
          job: executionPayload.job!,
          error: null,
        }));
        await recover(executionPayload.job.id, "action");
      }
    } catch (error) {
      const details =
        error instanceof Error
          ? error.message
          : "Die Bild-Erstellung ist fehlgeschlagen.";
      setTechnicalError(details);
      if (confirmationCompleted) setRecoveredContinuation(true);
      setFlow((current) => ({
        ...current,
        status: "error",
        statusLabel: null,
        error: ownerFacingProductionError(details),
      }));
    } finally {
      setActionBusy(false);
      setActionPhase(null);
    }
  }

  async function review(decision: "APPROVED" | "REJECTED") {
    if (!recovery?.asset) return;
    setActionBusy(true);
    setActionPhase("review");
    setTechnicalError(null);
    try {
      const values = Object.fromEntries(
        REVIEW_FIELDS.map((key) => [
          key,
          decision === "APPROVED" ? "PASS" : "NEEDS_REVIEW",
        ]),
      );
      const response = await callBrowserFetch(
        `/api/image/v2/assets/${recovery.asset.id}/review`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ decision, checklist: values, note: null }),
        },
      );
      const payload = (await response.json()) as { error?: string };
      if (!response.ok)
        throw new Error(
          payload.error ?? "Die Ergebnisprüfung ist fehlgeschlagen.",
        );
      await recover(job!.id, "action");
    } catch (error) {
      const details =
        error instanceof Error
          ? error.message
          : "Die Ergebnisprüfung ist fehlgeschlagen.";
      setTechnicalError(details);
      setFlow((current) => ({
        ...current,
        status: "error",
        statusLabel: null,
        error: "Die Ergebnisprüfung konnte nicht gespeichert werden.",
      }));
    } finally {
      setActionBusy(false);
      setActionPhase(null);
    }
  }

  async function loadPreviousRuns() {
    if (previousRunsState === "loading" || previousRunsState === "ready")
      return;
    setPreviousRunsState("loading");
    try {
      const response = await callBrowserFetch(
        "/api/image/v2/jobs?view=history",
        { cache: "no-store" },
      );
      const payload = (await response.json()) as {
        runs?: PreviousRunOwnerView[];
        error?: string;
      };
      if (!response.ok || !payload.runs)
        throw new Error(
          payload.error ?? "Vorherige Durchläufe konnten nicht geladen werden.",
        );
      setPreviousRuns(payload.runs);
      setPreviousRunsState("ready");
    } catch {
      setPreviousRunsState("error");
    }
  }

  async function openPreviousRun(run: PreviousRunOwnerView) {
    if (openingRunId || controlsBusy) return;
    setOpeningRunId(run.jobId);
    setTechnicalError(null);
    try {
      await recover(run.jobId, "action");
    } catch (error) {
      const details =
        error instanceof Error
          ? error.message
          : "Der Durchlauf konnte nicht geöffnet werden.";
      setTechnicalError(details);
      setFlow((current) => ({
        ...current,
        status: "error",
        statusLabel: null,
        error: "Der gespeicherte Durchlauf konnte nicht geöffnet werden.",
      }));
    } finally {
      setOpeningRunId(null);
    }
  }

  async function retryPreviousRun(run: PreviousRunOwnerView) {
    if (!run.retryEligibility.eligible || openingRunId || controlsBusy) return;
    setOpeningRunId(run.jobId);
    setActionBusy(true);
    setActionPhase("composite");
    setTechnicalError(null);
    try {
      const response = await callBrowserFetch(
        `/api/image/v2/jobs/${run.jobId}`,
        { cache: "no-store" },
      );
      const body = (await response.json()) as {
        recovery?: V2Recovery;
        error?: string;
      };
      if (!response.ok || !body.recovery)
        throw new Error(body.error ?? "Der Durchlauf konnte nicht geladen werden.");
      if (!body.recovery.retryEligibility?.eligible)
        throw new Error(
          body.recovery.retryEligibility?.reason ??
            "Die lokale Artwork-Wiederholung ist nicht mehr sicher verfügbar.",
        );
      applyRecovery(body.recovery, "action");
      const result = await postJobActionWithProgressPolling(
        body.recovery.job,
        "retry_composite",
      );
      if (result.recovery) applyRecovery(result.recovery, "action");
      setPreviousRunsState("idle");
    } catch (error) {
      const details =
        error instanceof Error
          ? error.message
          : "Die Artwork-Anwendung konnte nicht wiederholt werden.";
      setTechnicalError(details);
      setFlow((current) => ({
        ...current,
        status: "error",
        statusLabel: null,
        error: ownerFacingProductionError(details),
      }));
    } finally {
      setActionBusy(false);
      setActionPhase(null);
      setOpeningRunId(null);
    }
  }

  const printSideAvailability: Record<PrintSide, boolean> = {
    FRONT:
      semanticPlacementOptions({
        productType: props.productType,
        side: "FRONT",
      }).length > 0 &&
      (!props.assetId ||
        Boolean(resolveContentShotForSide(props.assetId, "FRONT"))),
    BACK:
      semanticPlacementOptions({
        productType: props.productType,
        side: "BACK",
      }).length > 0 &&
      (!props.assetId ||
        Boolean(resolveContentShotForSide(props.assetId, "BACK"))),
    BOTH:
      Object.keys(BOTH_SIDE_PLACEMENT_DEFINITIONS).some(
        (preset) =>
          resolveBothSidePlan({
            productType: props.productType,
            variantId: exactVariantId,
            preset: preset as BothSidePlacementPreset,
            printSurfaces: availablePrintSurfaces,
          }).compatible,
      ) &&
      (!props.assetId ||
        Boolean(resolveContentShotForSide(props.assetId, "FRONT"))) &&
      (!props.assetId ||
        Boolean(resolveContentShotForSide(props.assetId, "BACK"))),
  };
  const bothSurfacePlan =
    printSide === "BOTH"
      ? {
          front: resolvePlacement(
            "FRONT",
            BOTH_SIDE_PLACEMENT_DEFINITIONS[bothPreset].front,
          ),
          back: resolvePlacement(
            "BACK",
            BOTH_SIDE_PLACEMENT_DEFINITIONS[bothPreset].back,
          ),
        }
      : null;
  const bothProductionPlan = buildBothSideProductionPlan({
    preset: bothPreset,
    selectedShotId: props.assetId ?? "",
    authority: {
      artworkId: props.masterArtwork?.id ?? null,
      artworkVersion: props.masterArtwork?.version ?? null,
      artworkChecksum: props.masterArtwork?.checksum ?? null,
      productProfileId: exactProductProfile?.profileKey ?? null,
      productProfileVersion: exactProductProfile?.version ?? null,
      variantId: exactVariantId,
      brandModelId: props.brandModelTrace?.brandModelId ?? null,
      identityLockVersion: props.brandModelTrace?.identityLockVersion ?? null,
    },
    jobs: knownJobs.map((candidate) => ({
      ...candidate,
      reviewStatus:
        recovery?.job.id === candidate.id
          ? (recovery.asset?.reviewStatus ?? null)
          : null,
    })),
  });

  return (
    <section
      className="is-inspector-card is-inspector-card--open is-v2-owner-panel"
      aria-label="Bildproduktion"
    >
      <div className="is-inspector-card-body">
        <div className="is-v2-mode-head">
          <div>
            <p className="nx-page-header__eyebrow">Dein Bild</p>
            <h3 className="is-panel-heading">Stil und Platzierung</h3>
            <p>
              Wähle Druckseite und Platzierung. NexHQ schützt dein freigegebenes
              Artwork automatisch.
            </p>
          </div>
          <span className="nx-status nx-status--success">
            <ShieldCheck className="size-3.5" /> Artwork-Proportionen geschützt
          </span>
        </div>

        <StudioStepper steps={SIMPLE_IMAGE_STEPS} current={currentStep} />

        <section
          className="is-v2-owner-section"
          aria-labelledby="v2-placement-heading"
        >
          <div className="is-v2-section-head">
            <div>
              <p className="nx-page-header__eyebrow">Druck</p>
              <h4 id="v2-placement-heading">Druckseite und Platzierung</h4>
              <p>
                Wähle, wo dein Artwork auf dem Produkt erscheinen soll.
              </p>
            </div>
            {shotSideIntent !== "OWNER_SELECTABLE" ? (
              <span className="nx-status">
                Empfohlen: {PRINT_SIDE_LABELS[shotSideIntent]}
              </span>
            ) : null}
          </div>

          <fieldset className="is-semantic-placement-group">
            <legend>Druckseite</legend>
            <div
              className="is-semantic-side-grid"
              role="radiogroup"
              aria-label="Druckseite"
            >
              {(["FRONT", "BACK", "BOTH"] as const).map((side) => {
                const selected = printSide === side;
                const available = printSideAvailability[side];
                return (
                  <button
                    key={side}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-describedby={
                      !available ? `print-side-${side}-reason` : undefined
                    }
                    className={`is-semantic-choice${selected ? " is-selected" : ""}`}
                    disabled={!available}
                    onClick={() => {
                      ownerChoseSide.current = true;
                      ownerChosePlacement.current = false;
                      setPrintSide(side);
                      setPlacementPreset(null);
                      if (side !== "BOTH" && props.assetId) {
                        const sideShot = resolveContentShotForSide(
                          props.assetId,
                          side,
                        );
                        if (sideShot && sideShot.id !== props.assetId)
                          props.onShotSelectionChange?.(sideShot.id);
                      }
                    }}
                  >
                    <span>{PRINT_SIDE_LABELS[side]}</span>
                    {selected ? (
                      <strong>
                        <Check className="size-4" /> Ausgewählt
                      </strong>
                    ) : null}
                    {!available ? (
                      <small id={`print-side-${side}-reason`}>
                        Für diesen Produkttyp nicht verfügbar
                      </small>
                    ) : side === "BOTH" ? (
                      <small>Zwei einzelne Ansichten planen</small>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </fieldset>

          {printSide === "BOTH" ? (
            <fieldset className="is-semantic-placement-group">
              <legend>Beidseitiger Plan</legend>
              <div className="is-semantic-placement-grid">
                {(
                  Object.entries(BOTH_SIDE_PLACEMENT_DEFINITIONS) as Array<
                    [
                      BothSidePlacementPreset,
                      (typeof BOTH_SIDE_PLACEMENT_DEFINITIONS)[BothSidePlacementPreset],
                    ]
                  >
                ).map(([preset, definition]) => {
                  const plan = resolveBothSidePlan({
                    productType: props.productType,
                    variantId: exactVariantId,
                    preset,
                    printSurfaces: availablePrintSurfaces,
                  });
                  const selected = bothPreset === preset;
                  return (
                    <button
                      key={preset}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      className={`is-semantic-choice${selected ? " is-selected" : ""}`}
                      disabled={!plan.compatible}
                      onClick={() => setBothPreset(preset)}
                    >
                      <span>{definition.label}</span>
                      {selected ? (
                        <strong>
                          <Check className="size-4" /> Ausgewählt
                        </strong>
                      ) : null}
                      {!plan.compatible ? <small>Nicht verfügbar</small> : null}
                    </button>
                  );
                })}
              </div>
              <div
                className="nx-notice nx-notice--info is-both-side-plan"
                role="status"
              >
                <strong>Beidseitig ist ein Plan, kein Mehrfachauftrag.</strong>
                <p>
                  Fortschritt: {bothProductionPlan.createdCount} von 2 erstellt
                </p>
                <div className="is-both-side-plan__entries">
                  {bothProductionPlan.entries.map((entry, index) => {
                    const surfaceResolution =
                      entry.side === "FRONT"
                        ? bothSurfacePlan?.front
                        : bothSurfacePlan?.back;
                    const ready = Boolean(entry.shot);
                    return (
                      <div
                        key={entry.side}
                        className="is-both-side-plan__entry"
                      >
                        <div>
                          <strong>
                            {index + 1}. {PRINT_SIDE_LABELS[entry.side]}
                          </strong>
                          <span>
                            {
                              SEMANTIC_PLACEMENT_DEFINITIONS[
                                entry.placementPreset
                              ].label
                            }
                            {entry.shot ? ` · ${entry.shot.label}` : ""}
                          </span>
                          <small>
                            {entry.shot
                              ? `${BOTH_SIDE_PLAN_STATUS_LABELS[entry.status]}${
                                  surfaceResolution?.ok
                                    ? " · Platzierung bereit"
                                    : " · Platzierung nicht verfügbar"
                                }`
                              : "Keine passende Aufnahme verfügbar"}
                          </small>
                        </div>
                        <button
                          type="button"
                          className="nx-button"
                          disabled={!ready}
                          onClick={() => {
                            ownerChoseSide.current = true;
                            ownerChosePlacement.current = true;
                            setPrintSide(entry.side);
                            setPlacementPreset(entry.placementPreset);
                            if (entry.shot && entry.shot.id !== props.assetId)
                              props.onShotSelectionChange?.(entry.shot.id);
                          }}
                        >
                          {entry.side === "FRONT"
                            ? "Vorderseite vorbereiten"
                            : "Rückseite vorbereiten"}
                        </button>
                      </div>
                    );
                  })}
                </div>
                <p>
                  Beide Bilder werden einzeln vorbereitet, bestätigt und
                  erstellt.
                </p>
              </div>
            </fieldset>
          ) : (
            <fieldset className="is-semantic-placement-group">
              <legend>Platzierung</legend>
              {placementOptions.length ? (
                <div
                  className="is-semantic-placement-grid"
                  role="radiogroup"
                  aria-label="Platzierung"
                >
                  {placementOptions.map((definition) => {
                    const resolution = resolvePlacement(
                      printSide,
                      definition.preset,
                    );
                    const selected = placementPreset === definition.preset;
                    return (
                      <button
                        key={definition.preset}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        className={`is-semantic-choice${selected ? " is-selected" : ""}`}
                        onClick={() => {
                          ownerChosePlacement.current = true;
                          setPlacementPreset(definition.preset);
                        }}
                      >
                        <span>{definition.label}</span>
                        {selected ? (
                          <strong>
                            <Check className="size-4" /> Ausgewählt
                          </strong>
                        ) : null}
                        <small>
                          {resolution?.ok
                            ? "Automatisch bereit"
                            : "Nicht verfügbar"}
                        </small>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="nx-notice nx-notice--info">
                  Für diesen Produkttyp sind auf dieser Seite keine sicheren
                  Platzierungen definiert.
                </p>
              )}
            </fieldset>
          )}

          {printSide !== "BOTH" && placementPreset ? (
            <div
              className="is-semantic-resolution"
              role="status"
              aria-live="polite"
            >
              <strong>
                {PRINT_SIDE_LABELS[printSide]} ·{" "}
                {SEMANTIC_PLACEMENT_DEFINITIONS[placementPreset].label}
              </strong>
              {placementResolution?.ok ? (
                <span>
                  ✓ Platzierung automatisch bereit
                </span>
              ) : (
                <div className="is-semantic-resolution__blocker">
                  <span>
                    Für dieses Produkt ist diese Platzierung noch nicht
                    verfügbar.
                  </span>
                  <a className="nx-button" href="/agents/products">
                    Produktdetails öffnen
                  </a>
                </div>
              )}
              {productFamilyTemplate &&
              selectedBlankReference?.previewUrl &&
              ownerArtworkPlacement &&
              artworkPreview &&
              familyArtworkPreviewBox ? (
                <div className="is-marketprint-placement">
                  <div
                    ref={familyPreviewRef}
                    className="is-marketprint-placement__canvas"
                    onPointerMove={(event) => {
                      const active = familyArtworkDrag.current;
                      const frame = familyPreviewRef.current?.getBoundingClientRect();
                      if (!active || !frame) return;
                      setOwnerArtworkPlacement((current) =>
                        current
                          ? {
                              ...current,
                              offsetX: Math.max(-1, Math.min(1, active.offsetX + ((event.clientX - active.x) / frame.width) * 3)),
                              offsetY: Math.max(-1, Math.min(1, active.offsetY + ((event.clientY - active.y) / frame.height) * 3)),
                            }
                          : current,
                      );
                    }}
                    onPointerUp={() => (familyArtworkDrag.current = null)}
                    onPointerCancel={() => (familyArtworkDrag.current = null)}
                  >
                    {/* Private signed Product previews intentionally bypass the Next image optimizer. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={selectedBlankReference.previewUrl} alt={`${props.productName ?? "Produkt"} ${PRINT_SIDE_LABELS[printSide]}`} />
                    <div
                      className="is-marketprint-placement__area"
                      style={{
                        left: `${productFamilyTemplate.normalizedRegion.x * 100}%`,
                        top: `${productFamilyTemplate.normalizedRegion.y * 100}%`,
                        width: `${productFamilyTemplate.normalizedRegion.width * 100}%`,
                        height: `${productFamilyTemplate.normalizedRegion.height * 100}%`,
                      }}
                    />
                    {/* Approved Artwork preview uses contain geometry and never changes its ratio. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      className="is-marketprint-placement__artwork"
                      src={artworkPreview.url}
                      alt="Artwork innerhalb des erlaubten Druckbereichs"
                      draggable={false}
                      style={{
                        left: `${familyArtworkPreviewBox.x * 100}%`,
                        top: `${familyArtworkPreviewBox.y * 100}%`,
                        width: `${familyArtworkPreviewBox.width * 100}%`,
                        height: `${familyArtworkPreviewBox.height * 100}%`,
                      }}
                      onPointerDown={(event) => {
                        event.currentTarget.setPointerCapture(event.pointerId);
                        familyArtworkDrag.current = {
                          x: event.clientX,
                          y: event.clientY,
                          offsetX: ownerArtworkPlacement.offsetX,
                          offsetY: ownerArtworkPlacement.offsetY,
                        };
                      }}
                    />
                  </div>
                  <div className="is-marketprint-placement__controls" aria-label="Artwork-Platzierung anpassen">
                    <label>
                      Größe
                      <input
                        type="range"
                        min="0.1"
                        max="1"
                        step="0.02"
                        value={ownerArtworkPlacement.uniformScale}
                        onChange={(event) => setOwnerArtworkPlacement({ ...ownerArtworkPlacement, uniformScale: Number(event.target.value) })}
                      />
                    </label>
                    {supportsOwnerVerticalPlacement(placementPreset) ? (
                      <div className="is-marketprint-placement__height-control">
                        <label>
                          Höhe
                          <input
                            type="range"
                            min="-1"
                            max="1"
                            step="0.05"
                            value={ownerArtworkPlacement.offsetY}
                            aria-label="Vertikale Artwork-Position"
                            onChange={(event) =>
                              setOwnerArtworkPlacement({
                                ...ownerArtworkPlacement,
                                offsetY: Number(event.target.value),
                              })
                            }
                          />
                        </label>
                        <div className="is-marketprint-placement__height-actions">
                          <button
                            type="button"
                            className="nx-button"
                            onClick={() =>
                              setOwnerArtworkPlacement({
                                ...ownerArtworkPlacement,
                                offsetY: Math.max(
                                  -1,
                                  ownerArtworkPlacement.offsetY - 0.1,
                                ),
                              })
                            }
                          >
                            Höher
                          </button>
                          <button
                            type="button"
                            className="nx-button"
                            onClick={() =>
                              setOwnerArtworkPlacement({
                                ...ownerArtworkPlacement,
                                offsetY: Math.min(
                                  1,
                                  ownerArtworkPlacement.offsetY + 0.1,
                                ),
                              })
                            }
                          >
                            Tiefer
                          </button>
                          <button
                            type="button"
                            className="nx-button"
                            onClick={() =>
                              setOwnerArtworkPlacement({
                                ...ownerArtworkPlacement,
                                offsetY: 0,
                              })
                            }
                          >
                            Höhe zurücksetzen
                          </button>
                        </div>
                      </div>
                    ) : null}
                    <button type="button" className="nx-button" onClick={() => setOwnerArtworkPlacement(defaultOwnerArtworkPlacement(productFamilyTemplate))}>
                      Auto-Fit & zentrieren
                    </button>
                    <span>Artwork ziehen oder gleichmäßig skalieren · Proportionen gesperrt</span>
                  </div>
                </div>
              ) : quad &&
              rectangularPreviewRegion &&
              artworkPreview &&
              lockedArtworkPreviewPlacement ? (
                <svg
                  viewBox={`0 0 ${previewOutputSize.width} ${previewOutputSize.height}`}
                  className="is-v2-locked-artwork-preview"
                  role="img"
                  aria-label="Artwork-Vorschau mit gesperrten Proportionen"
                >
                  <rect
                    x="0"
                    y="0"
                    width={previewOutputSize.width}
                    height={previewOutputSize.height}
                    rx={
                      Math.min(
                        previewOutputSize.width,
                        previewOutputSize.height,
                      ) * 0.06
                    }
                  />
                  <rect
                    className="is-v2-locked-artwork-region"
                    x={rectangularPreviewRegion.x}
                    y={rectangularPreviewRegion.y}
                    width={rectangularPreviewRegion.width}
                    height={rectangularPreviewRegion.height}
                  />
                  <image
                    href={artworkPreview.url}
                    x={lockedArtworkPreviewPlacement.rect.x}
                    y={lockedArtworkPreviewPlacement.rect.y}
                    width={lockedArtworkPreviewPlacement.rect.width}
                    height={lockedArtworkPreviewPlacement.rect.height}
                    preserveAspectRatio="xMidYMid meet"
                  />
                </svg>
              ) : null}
            </div>
          ) : null}

        </section>

        {showPrepare ? (
          <section
            className="nx-card is-v2-review-card"
            aria-label="Aktuelle Bildauswahl"
          >
          <div className="is-v2-section-head">
            <div>
              <p className="nx-page-header__eyebrow">Zusammenfassung</p>
              <h4>Dein Bild</h4>
            </div>
            <span className="nx-status">Ein Bild</span>
          </div>
          <dl className="is-v2-owner-summary">
            <div>
              <dt>Artwork</dt>
              <dd>{props.artworkLabel ?? "Kein Artwork ausgewählt"}</dd>
            </div>
            <div>
              <dt>Produkt</dt>
              <dd>{props.productName ?? "Kein Produkt ausgewählt"}</dd>
            </div>
            <div>
              <dt>Farbe / Größe</dt>
              <dd>
                {props.productColor ?? "Nicht ausgewählt"} ·{" "}
                {props.productSize ?? "Nicht ausgewählt"}
              </dd>
            </div>
            <div>
              <dt>Markenmodel</dt>
              <dd>{props.brandModelLabel ?? "Kein Markenmodel ausgewählt"}</dd>
            </div>
            <div>
              <dt>Output-Ziel</dt>
              <dd>
                {props.creativeDirection?.contentMode === "SHOPIFY_MOCKUP"
                  ? "Shopify Mockup"
                  : props.creativeDirection
                    ? "Social Content"
                    : "Nicht ausgewählt"}
              </dd>
            </div>
            <div>
              <dt>Aufnahme</dt>
              <dd>
                {props.assetId
                  ? ownerShotLabel(
                      props.shotLabel ??
                        contentShotById(props.assetId)?.label ??
                        props.assetId,
                    )
                  : "Keine Aufnahme ausgewählt"}
              </dd>
            </div>
            <div>
              <dt>Stil</dt>
              <dd>{creativePresetLabel(props.creativeDirection)}</dd>
            </div>
            <div>
              <dt>Druckseite</dt>
              <dd>{PRINT_SIDE_LABELS[printSide]}</dd>
            </div>
            <div>
              <dt>Platzierung</dt>
              <dd>
                {printSide === "BOTH"
                  ? BOTH_SIDE_PLACEMENT_DEFINITIONS[bothPreset].label
                  : placementPreset
                    ? SEMANTIC_PLACEMENT_DEFINITIONS[placementPreset].label
                    : "Nicht ausgewählt"}
              </dd>
            </div>
            <div>
              <dt>Artwork</dt>
              <dd>✓ Proportionen geschützt</dd>
            </div>
          </dl>
          {printSide === "BOTH" ? (
            <p className="nx-notice nx-notice--info">
              Plan: 1. Vorderseite · 2. Rückseite. Jede Aufnahme wird einzeln
              erstellt.
            </p>
          ) : null}
          </section>
        ) : null}

        {productionState.phase !== "IDLE" &&
        !recovery?.asset &&
        !flow.error ? (
          <div
            className={`is-v2-production-status is-v2-production-status--${productionState.tone}`}
            id="v2-prepare-status"
            role="status"
            aria-live="polite"
            aria-busy={productionState.busy}
          >
            {productionState.busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <CheckCircle2 className="size-4" />
            )}
            <div>
              <strong>{productionState.title}</strong>
              {productionState.detail ? <p>{productionState.detail}</p> : null}
            </div>
          </div>
        ) : null}

        {showPrepare && blockers.length > 0 ? (
          <div
            id="v2-prepare-blockers"
            className="nx-notice nx-notice--info"
            role="status"
          >
            <strong>Als Nächstes</strong>
            {blockers.map((blocker) => (
              <p key={blocker.code}>
                {BLOCKER_LABELS[blocker.code] ?? blocker.message}
              </p>
            ))}
          </div>
        ) : null}

        {showPrepare ? (
          <button
            type="button"
            className="nx-button nx-button--primary is-v2-primary-cta"
            disabled={controlsBusy || !canPrepare}
            aria-describedby={
              !canPrepare && blockers.length ? "v2-prepare-blockers" : undefined
            }
            onClick={() => void prepare()}
          >
            {controlsBusy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ChevronRight className="size-4" />
            )}
            Vorbereiten & Kosten prüfen
          </button>
        ) : null}

        {job && !recovery?.asset ? (
          <section className="nx-card is-v2-review-card">
            <div className="is-v2-section-head">
              <div>
                <p className="nx-page-header__eyebrow">Kosten geprüft</p>
                <h4>Dein Bild</h4>
              </div>
              <span className="nx-status">
                {ownerStatusLabel(recovery?.state ?? job.status)}
              </span>
            </div>
            <dl className="is-v2-owner-summary">
              <div>
                <dt>Artwork</dt>
                <dd>
                  {openedRunView?.artworkDisplayName ??
                    props.artworkLabel ??
                    job.inputSnapshot.masterArtwork.designId}
                </dd>
              </div>
              <div>
                <dt>Produkt</dt>
                <dd>{job.inputSnapshot.product.productName}</dd>
              </div>
              <div>
                <dt>Farbe / Größe</dt>
                <dd>
                  {job.inputSnapshot.product.color ?? "Nicht angegeben"} ·{" "}
                  {job.inputSnapshot.product.size ?? "Nicht angegeben"}
                </dd>
              </div>
              <div>
                <dt>Markenmodel</dt>
                <dd>{job.inputSnapshot.brandModel.displayName}</dd>
              </div>
              <div>
                <dt>Output-Ziel</dt>
                <dd>
                  {job.inputSnapshot.creativeDirection?.contentMode ===
                  "SHOPIFY_MOCKUP"
                    ? "Shopify Mockup"
                    : "Social Content"}
                </dd>
              </div>
              <div>
                <dt>Aufnahme</dt>
                <dd>{ownerShotLabel(job.inputSnapshot.shot.title)}</dd>
              </div>
              <div>
                <dt>Stil</dt>
                <dd>
                  {creativePresetLabel(job.inputSnapshot.creativeDirection)}
                </dd>
              </div>
              <div>
                <dt>Druckseite</dt>
                <dd>
                  {job.inputSnapshot.semanticPlacement
                    ? PRINT_SIDE_LABELS[
                        job.inputSnapshot.semanticPlacement.printSide
                      ]
                    : "Historische Platzierung"}
                </dd>
              </div>
              <div>
                <dt>Platzierung</dt>
                <dd>
                  {job.inputSnapshot.semanticPlacement?.displayLabel ??
                    "Historische Platzierung"}
                </dd>
              </div>
              <div>
                <dt>Artwork</dt>
                <dd>✓ Proportionen geschützt</dd>
              </div>
              <div className="is-v2-cost-summary">
                <dt>Geschätzte maximale Kosten</dt>
                <dd>
                  {job.estimate.maximum.toFixed(4)} {job.estimate.currency}
                </dd>
              </div>
            </dl>
            {job.failureCode === "BASE_PRINT_ZONE_CONTAMINATED" ? (
              <div className="nx-notice nx-notice--error" role="alert">
                <strong>Fremder Aufdruck im Basisbild erkannt.</strong>
                <p>
                  Das Kleidungsstück war nicht vollständig blank. Dein
                  freigegebenes Artwork wurde deshalb nicht angewendet. Wähle
                  einen anderen Stil oder eine andere Aufnahme und bereite das
                  Bild erneut vor.
                </p>
              </div>
            ) : null}
            {job.failureCode === "GARMENT_REGISTRATION_LOW_CONFIDENCE" ? (
              <div className="nx-notice nx-notice--error" role="alert">
                <strong>Druckfläche nicht sicher erkannt.</strong>
                <p>
                  NexHQ konnte die Druckfläche nicht zuverlässig auf dem
                  sichtbaren Kleidungsstück halten. Das Artwork wurde deshalb
                  nicht angewendet. Wähle eine klarere Aufnahme und bereite das
                  Bild neu vor.
                </p>
              </div>
            ) : null}
            {job.failureCode === "STAGE_A_NOT_PRINT_READY" ? (
              <div className="nx-notice nx-notice--error" role="alert">
                <strong>Basisbild nicht druckbereit.</strong>
                <p>
                  Das Shirt war für den großen Frontprint zu eng beschnitten
                  oder nicht frei genug sichtbar. Es wurde kein Artwork
                  angewendet.
                </p>
              </div>
            ) : null}
            {job.failureCode === "DEPTH_ESTIMATION_FAILED" ? (
              <div className="nx-notice nx-notice--error" role="alert">
                <strong>Stofftiefe nicht sicher bestimmt.</strong>
                <p>
                  Basisbild, Identität, Kleidungsmaske und Torso bleiben
                  gespeichert. Eine ausdrücklich bestätigte Fortsetzung
                  wiederholt weder Stage A noch SAM.
                </p>
              </div>
            ) : null}
            {job.failureCode === "SURFACE_INTEGRATION_UNSAFE" ? (
              <div className="nx-notice nx-notice--error" role="alert">
                <strong>Stoffanpassung nicht sicher möglich.</strong>
                <p>
                  Das Artwork konnte nicht zuverlässig an Falten, Licht und
                  Shirt-Oberfläche angepasst werden. Es wurde kein Ergebnis zur
                  Freigabe erstellt. Wenn das gespeicherte Basisbild weiterhin
                  alle Prüfungen besteht, kann nur die lokale Artwork-Anwendung
                  erneut ausgeführt werden.
                </p>
              </div>
            ) : null}
            <div className="is-staging-actions">
              {job.status === "awaiting_confirmation" ? (
                <button
                  className="nx-button nx-button--primary"
                  disabled={controlsBusy}
                  onClick={() => void createImage()}
                >
                  {actionPhase === "confirming" ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : null}
                  Bild erstellen
                </button>
              ) : null}
              {productionState.showContinuation ? (
                <button
                  className="nx-button nx-button--primary"
                  disabled={controlsBusy}
                  onClick={() => void act("execute_real")}
                >
                  Produktion fortsetzen
                </button>
              ) : null}
              {recovery?.state === "COMPOSITE_FAILED" &&
              recovery.retryEligibility?.eligible ? (
                <button
                  className="nx-button nx-button--primary"
                  disabled={controlsBusy}
                  onClick={() => void act("retry_composite")}
                >
                  {recovery.retryEligibility.depthRequired
                    ? "Stofftiefe erneut analysieren"
                    : "Artwork erneut anwenden"}
                </button>
              ) : null}
            </div>
            <TechnicalDetails>
              <p>Auftrag: {job.id}</p>
              <p>Modus: {job.inputSnapshot.productionMode}</p>
              <p>Fingerprint: {job.inputFingerprint}</p>
              <p>
                Platzierung: {job.inputSnapshot.printSurface.printSurfaceId} ·
                Version {job.inputSnapshot.printSurface.version}
              </p>
              <p>
                Compositor: {job.inputSnapshot.compositing.compositorVersion}
              </p>
              {job.inputSnapshot.depthEstimationPolicy ? (
                <p>
                  Depth: {job.inputSnapshot.depthEstimationPolicy.provider} · {job.inputSnapshot.depthEstimationPolicy.model} · maximal {job.inputSnapshot.depthEstimationPolicy.maximumCostUsd.toFixed(4)} USD
                </p>
              ) : null}
              <p>
                Identity Lock: v
                {job.inputSnapshot.brandModel.identityLockVersion}
              </p>
              {job.inputSnapshot.identityConditioning ? (
                <p>
                  Identity Authority: {job.inputSnapshot.identityConditioning.authoritySource} · Lock aktiv · generischer Fallback verhindert · {job.inputSnapshot.identityConditioning.supportingReferenceCount}/5 Referenzen
                </p>
              ) : null}
              {job.inputSnapshot.compositing.fabricIntegration ? (
                <>
                  <p>
                    Fabric-Aware: Licht {job.inputSnapshot.compositing.fabricIntegration.lightingStrength.toFixed(2)} · Textur {job.inputSnapshot.compositing.fabricIntegration.textureStrength.toFixed(2)} · Verdrängung {job.inputSnapshot.compositing.fabricIntegration.maxDisplacementRatio.toFixed(3)} · Tinte {job.inputSnapshot.compositing.fabricIntegration.inkOpacity.toFixed(2)}
                  </p>
                  {job.inputSnapshot.compositing.fabricIntegration.surfaceConforming ? (
                    <p>
                      Surface-Conforming: {job.inputSnapshot.compositing.fabricIntegration.surfaceConforming.contractVersion} · Mesh {job.inputSnapshot.compositing.fabricIntegration.surfaceConforming.gridColumns}×{job.inputSnapshot.compositing.fabricIntegration.surfaceConforming.gridRows} · max. Warp {(job.inputSnapshot.compositing.fabricIntegration.surfaceConforming.maximumWarpRatio * 100).toFixed(2)} % · Fail-closed aktiv
                    </p>
                  ) : null}
                  {job.inputSnapshot.compositing.fabricIntegration.depthAware ? (
                    <p>
                      Depth-Aware: {job.inputSnapshot.compositing.fabricIntegration.depthAware.contractVersion} · lokale Tiefen-/Ebenenführung · max. Warp {(job.inputSnapshot.compositing.fabricIntegration.depthAware.maximumLocalWarpRatio * 100).toFixed(2)} % · globaler Footprint unverändert · Fail-closed aktiv
                    </p>
                  ) : null}
                  {job.inputSnapshot.compositing.fabricIntegration.surfaceRealismRefinement ? (
                    <p>
                      Surface Realism: {job.inputSnapshot.compositing.fabricIntegration.surfaceRealismRefinement.contractVersion} · gepinnter Footprint · Ebenen-/Normalenführung · Licht/Schatten {(job.inputSnapshot.compositing.fabricIntegration.surfaceRealismRefinement.shadingTransferStrength * 100).toFixed(0)} % · Textur {(job.inputSnapshot.compositing.fabricIntegration.surfaceRealismRefinement.textureTransferStrength * 100).toFixed(0)} % · Fail-closed aktiv
                    </p>
                  ) : null}
                </>
              ) : null}
              {containFitDiagnostics ? (
                <div data-testid="strict-contain-fit-diagnostics">
                  <p>
                    Artwork: {containFitDiagnostics.originalArtworkWidth} ×{" "}
                    {containFitDiagnostics.originalArtworkHeight} px · Verhältnis{" "}
                    {containFitDiagnostics.originalArtworkAspectRatio.toFixed(4)}
                  </p>
                  <p>
                    Druckfläche: {containFitDiagnostics.targetPrintableArea.width.toFixed(1)} ×{" "}
                    {containFitDiagnostics.targetPrintableArea.height.toFixed(1)} px · Fit: CONTAIN
                  </p>
                  <p>
                    Einheitliche Skalierung: {containFitDiagnostics.effectiveUniformScale.toFixed(6)} · Owner-Skalierung {containFitDiagnostics.ownerScale.toFixed(2)} · Verschiebung X {containFitDiagnostics.ownerOffsetX.toFixed(2)} / Y {containFitDiagnostics.ownerOffsetY.toFixed(2)}
                  </p>
                  <p>
                    Freiraum horizontal {containFitDiagnostics.unusedHorizontalSpace.toFixed(1)} px · vertikal {containFitDiagnostics.unusedVerticalSpace.toFixed(1)} px
                  </p>
                  <p>
                    Verhältnis geschützt: Ja · Beschnitt: Nein · Verzerrung: Nein
                  </p>
                </div>
              ) : null}
              {props.artworkOriginalFileName ? (
                <p>Originaldatei: {props.artworkOriginalFileName}</p>
              ) : null}
              {recovery?.stages.length ? (
                <p>
                  Interner Verlauf:{" "}
                  {recovery.stages
                    .map(
                      (stage) =>
                        `${stage.stage} #${stage.stageAttempt} ${stage.status}`,
                    )
                    .join(" → ")}
                </p>
              ) : null}
              {recovery?.stages.some(
                (stage) =>
                  stage.stage === "BASE_GENERATION" &&
                  stage.status === "SUCCEEDED",
              ) ? (
                <StageABasePreview jobId={job.id} />
              ) : null}
              {job.status === "confirmed" &&
              process.env.NODE_ENV !== "production" ? (
                <div>
                  <p>
                    Entwicklungstest ohne Bildanbieter. Dieses Werkzeug gehört
                    nicht zum normalen Owner-Flow.
                  </p>
                  <button
                    className="nx-button"
                    disabled={controlsBusy}
                    onClick={() => void act("execute_fake")}
                  >
                    Internen Testlauf starten
                  </button>
                </div>
              ) : null}
            </TechnicalDetails>
          </section>
        ) : null}

        {recovery?.asset &&
        isSyntheticRun &&
        process.env.NODE_ENV !== "production" ? (
          <div className="is-v2-synthetic-result">
            <TechnicalDetails>
              <h4>Interner synthetischer Testlauf</h4>
              <p>
                Dieses Ergebnis prüft nur die technische Laufzeit ohne
                Bildanbieter. Es ist kein Produktions-Mockup.
              </p>
              {recovery.asset.accessUrl ? (
                <a
                  className="nx-button"
                  href={recovery.asset.accessUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Technische Testdatei öffnen
                </a>
              ) : null}
              {recovery.asset.reviewStatus === "REVIEW_REQUIRED" ? (
                <div className="is-v2-synthetic-review">
                  <label className="product-attestation">
                    <input
                      type="checkbox"
                      checked={reviewAcknowledged}
                      onChange={(event) =>
                        setActiveUi((current) => ({
                          ...current,
                          checklist: Object.fromEntries(
                            REVIEW_FIELDS.map((key) => [
                              key,
                              event.target.checked,
                            ]),
                          ) as typeof current.checklist,
                        }))
                      }
                    />
                    Technischen Testlauf geprüft
                  </label>
                  <div className="is-staging-actions">
                    <button
                      className="nx-button"
                      disabled={controlsBusy || !reviewAcknowledged}
                      onClick={() => void review("APPROVED")}
                    >
                      Test freigeben
                    </button>
                    <button
                      className="nx-button"
                      disabled={controlsBusy}
                      onClick={() => void review("REJECTED")}
                    >
                      Test ablehnen
                    </button>
                  </div>
                </div>
              ) : (
                <p>Status: {ownerStatusLabel(recovery.asset.reviewStatus)}</p>
              )}
            </TechnicalDetails>
          </div>
        ) : null}

        {recovery?.asset && !isSyntheticRun ? (
          <section className="nx-card is-v2-result-review">
            <div className="is-v2-section-head">
              <div>
                <p className="nx-page-header__eyebrow">Ergebnis</p>
                <h4>Passt das Ergebnis?</h4>
              </div>
              <span
                className={`nx-status ${recovery.asset.reviewStatus === "APPROVED" ? "nx-status--success" : recovery.asset.reviewStatus === "REJECTED" ? "nx-status--danger" : "nx-status--warning"}`}
              >
                {ownerStatusLabel(recovery.asset.reviewStatus)}
              </span>
            </div>
            {recovery.asset.accessUrl ? (
              <a
                className="is-v2-result-preview"
                href={recovery.asset.accessUrl}
                target="_blank"
                rel="noreferrer"
              >
                {/* Private signed runtime URLs are intentionally not sent through the Next image optimizer. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={recovery.asset.accessUrl}
                  alt="Privates Mockup-Ergebnis"
                />
                <span>Große Vorschau öffnen</span>
              </a>
            ) : (
              <div className="nx-notice nx-notice--error">
                <strong>Vorschau nicht verfügbar.</strong>
                <p>
                  Der private Zugriff ist abgelaufen oder fehlt. Lade die Seite
                  neu, um einen frischen Zugriff anzufordern.
                </p>
              </div>
            )}
            <p className="is-v2-review-question">
              Prüfe kurz: Ist das Markenmodel klar wiederzuerkennen, bleibt das
              Produkt frei von Fremdprints, wirkt das Artwork natürlich
              platziert und ist die Umgebung hochwertig?
            </p>
            {recovery.asset.reviewStatus === "REVIEW_REQUIRED" ? (
              <div className="is-staging-actions">
                <button
                  className="nx-button nx-button--primary"
                  disabled={controlsBusy}
                  onClick={() => void review("APPROVED")}
                >
                  <CheckCircle2 className="size-4" />
                  Freigeben
                </button>
                <button
                  className="nx-button"
                  disabled={controlsBusy}
                  onClick={() => void review("REJECTED")}
                >
                  Ablehnen
                </button>
              </div>
            ) : null}
          </section>
        ) : null}

        <details
          className="nx-technical is-v2-history"
          onToggle={(event) => {
            if (event.currentTarget.open) void loadPreviousRuns();
          }}
        >
            <summary>
              Vorherige Durchläufe
              {previousRunsState === "ready" ? ` (${previousRuns.length})` : ""}
            </summary>
            <div className="nx-technical__body is-v2-history__body">
              {previousRunsState === "loading" ? (
                <div className="is-v2-history__loading" role="status">
                  <Loader2 className="size-4 animate-spin" />
                  Frühere Durchläufe werden geladen …
                </div>
              ) : null}
              {previousRunsState === "error" ? (
                <div className="nx-notice nx-notice--error" role="alert">
                  <p>Vorherige Durchläufe konnten nicht geladen werden.</p>
                  <button
                    type="button"
                    className="nx-button"
                    onClick={() => {
                      setPreviousRunsState("idle");
                      void loadPreviousRuns();
                    }}
                  >
                    Erneut versuchen
                  </button>
                </div>
              ) : null}
              {previousRunsState === "ready" ? (
                <>
                  <div className="is-v2-history__filters" aria-label="Durchläufe filtern">
                    {([
                      ["ALL", "Alle"],
                      ["SUCCESS", "Erfolgreich"],
                      ["FAILED", "Fehlgeschlagen"],
                      ["REVIEW", "Zur Prüfung"],
                    ] as const).map(([value, label]) => (
                      <button
                        type="button"
                        className={previousRunsFilter === value ? "is-selected" : ""}
                        aria-pressed={previousRunsFilter === value}
                        onClick={() => setPreviousRunsFilter(value)}
                        key={value}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="is-v2-history__grid">
                    {previousRuns
                      .filter((run) =>
                        previousRunMatchesFilter(run, previousRunsFilter),
                      )
                      .map((run) => (
                <article className="is-v2-history__entry" key={run.jobId}>
                  <div className="is-v2-history__thumb">
                    {run.thumbnailUrl ? (
                      // The URL is a short-lived authenticated private-asset grant.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={run.thumbnailUrl} alt="Vorschau des gespeicherten Durchlaufs" />
                    ) : (
                      <span>Keine Vorschau</span>
                    )}
                  </div>
                  <div className="is-v2-history__content">
                    <div className="is-v2-history__head">
                      <time dateTime={run.createdAt}>
                        {formatPreviousRunLocalDateTime(run.createdAt)}
                      </time>
                      <span className="nx-status">{run.ownerStatus}</span>
                    </div>
                    <strong>{run.artworkDisplayName}</strong>
                    <dl>
                      <div><dt>Produkt</dt><dd>{run.productName}</dd></div>
                      <div><dt>Farbe</dt><dd>{run.color ?? "Nicht angegeben"}</dd></div>
                      <div><dt>Markenmodel</dt><dd>{run.brandModelName}</dd></div>
                      <div><dt>Output-Ziel</dt><dd>{run.outputGoal}</dd></div>
                      <div><dt>Aufnahme</dt><dd>{ownerShotLabel(run.shotTitle)}</dd></div>
                      <div><dt>Platzierung</dt><dd>{run.placementLabel}</dd></div>
                      <div><dt>Höhe</dt><dd>{run.placementHeightLabel}</dd></div>
                    </dl>
                    <div className="is-v2-history__actions">
                      <button
                        type="button"
                        className="nx-button"
                        disabled={Boolean(openingRunId) || controlsBusy}
                        onClick={() => void openPreviousRun(run)}
                      >
                        {openingRunId === run.jobId ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : null}
                        Öffnen
                      </button>
                      {run.retryEligibility.eligible ? (
                        <button
                          type="button"
                          className="nx-button nx-button--primary"
                          disabled={Boolean(openingRunId) || controlsBusy}
                          onClick={() => void retryPreviousRun(run)}
                        >
                          {run.retryEligibility.depthRequired
                            ? "Stofftiefe erneut analysieren"
                            : "Artwork erneut anwenden"}
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <TechnicalDetails>
                    <p>Auftrag: {run.jobId}</p>
                    <p>Fingerprint: {run.technical.inputFingerprint}</p>
                    {run.technical.ownerPlacement ? (
                      <p>
                        Owner-Platzierung: Größe {run.technical.ownerPlacement.scale.toFixed(2)} · X {run.technical.ownerPlacement.x.toFixed(2)} · Y {run.technical.ownerPlacement.y.toFixed(2)}
                      </p>
                    ) : null}
                    {run.technical.lineage ? <p>Interner Verlauf: {run.technical.lineage}</p> : null}
                    <p>Stage-B-Wiederholung: {run.retryEligibility.eligible ? "serverseitig bestätigt" : run.retryEligibility.reason}</p>
                    {run.technical.lineage?.includes("BASE_GENERATION") ? (
                      <StageABasePreview jobId={run.jobId} />
                    ) : null}
                  </TechnicalDetails>
                </article>
                      ))}
                  </div>
                  {previousRuns.length === 0 ? (
                    <p>Noch keine Durchläufe vorhanden.</p>
                  ) : null}
                </>
              ) : null}
            </div>
          </details>

        {flow.error ? (
          <div className="nx-notice nx-notice--error is-v2-error" role="alert">
            <strong>Bild konnte nicht fertiggestellt werden</strong>
            <p>{flow.error}</p>
            <button
              type="button"
              className="nx-button"
              onClick={() => {
                setFlow((current) => clearPrepareError(current));
                setTechnicalError(null);
              }}
            >
              Hinweis schließen
            </button>
            <TechnicalDetails>
              <p>{technicalError ?? flow.error}</p>
            </TechnicalDetails>
          </div>
        ) : null}
      </div>
    </section>
  );
}
