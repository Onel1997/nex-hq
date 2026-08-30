import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  resolveStageABasePreviewSource,
  toStageABasePreviewView,
} from "@/lib/image/deterministic-runtime/base-preview";
import type { DeterministicRecovery } from "@/lib/image/deterministic-runtime/types";
import { DEFAULT_SURFACE_REALISM_REFINEMENT_INTEGRATION } from "@/lib/image/artwork-compositing/types";

const jobId = "11111111-1111-4111-8111-111111111111";
const baseStageId = "22222222-2222-4222-8222-222222222222";

function recoveryFixture(): DeterministicRecovery {
  return {
    state: "BASE_FAILED",
    job: {
      id: jobId,
      workspaceId: "33333333-3333-4333-8333-333333333333",
      inputSnapshot: {
        printSurface: {
          contractVersion: "print-surface-v1",
          printSurfaceId: "surface-1",
          productProfileId: "profile-1",
          variantId: null,
          region: "front_center",
          displayName: "Großer Frontprint",
          geometryStatus: "CALIBRATED",
          version: 1,
          quad: [
            { x: 0.3, y: 0.25 },
            { x: 0.7, y: 0.25 },
            { x: 0.7, y: 0.7 },
            { x: 0.3, y: 0.7 },
          ],
          boundingBox: { x: 0.3, y: 0.25, width: 0.4, height: 0.45 },
          orientationDegrees: 0,
          perspectiveAnchors: [],
          clippingMaskReference: null,
          safeMargin: { top: 0, right: 0, bottom: 0, left: 0 },
          artworkScale: 1,
          rotationDegrees: 0,
          warpMode: "PERSPECTIVE",
          provenance: {
            source: "OWNER_CALIBRATION",
            calibratedBy: "owner",
            calibratedAt: "2026-08-20T20:00:00.000Z",
          },
        },
        printSurfaceOverride: {
          contractVersion: "print-surface-production-override-v1",
          basePrintSurfaceId: "surface-1",
          basePrintSurfaceVersion: 1,
          quad: [
            { x: 0.35, y: 0.2 },
            { x: 0.65, y: 0.2 },
            { x: 0.65, y: 0.6 },
            { x: 0.35, y: 0.6 },
          ],
          provenance: "NEXHQ_FRONT_LARGE_TUNING_V2",
        },
      },
    },
    stages: [
      {
        stageOutputId: baseStageId,
        jobId,
        stage: "BASE_GENERATION",
        stageAttempt: 1,
        status: "SUCCEEDED",
        assetId: baseStageId,
        storagePath:
          "workspace/33333333-3333-4333-8333-333333333333/deterministic-v2/job/base/base.png",
        checksumSha256: "a".repeat(64),
        providerRequestId: "request-1",
        provenance: {
          normalEstimation: {
            contractVersion: "nexhq-fal-midas-normal-v1",
            policy: {
              contractVersion: "nexhq-normal-estimation-policy-v1",
              provider: "fal",
              model: "fal-ai/image-preprocessors/midas",
              adapterVersion: "nexhq-fal-midas-v1",
              required: true,
              maximumCostUsd: 0.01,
              minimumUsableSamples: 120,
              minimumFieldConsistency: 0.55,
            },
            status: "VALIDATED",
            validationReason: "ACCEPTED",
            provider: "fal",
            model: "fal-ai/image-preprocessors/midas",
            adapterVersion: "nexhq-fal-midas-v1",
            providerRequestId: "midas-request-1",
            jobId,
            sourceBaseChecksumSha256: "a".repeat(64),
            idempotencyKeyHash: "b".repeat(64),
            sourceDimensions: { width: 1024, height: 1024 },
            providerOutputDimensions: { width: 1024, height: 1024 },
            normalizedDimensions: { width: 1024, height: 1024 },
            normalMapChecksumSha256: "c".repeat(64),
            validation: {
              decoding: "RGB_SIGNED_UNIT_VECTOR_X_RIGHT_Y_UP_Z_CAMERA",
              usableGarmentSamples: 1640,
              rejectedOutliers: 37,
              medianNormal: { x: 0.08, y: -0.03, z: 0.996 },
              fieldConsistency: 0.88,
              directionalVariation: 0.42,
            },
            artworkInputIncluded: false,
            depthOutputPersisted: false,
          },
          basePrintPurity: {
            contractVersion: "base-print-purity-v1",
            status: "SUSPECTED_CONTAMINATION",
            reason: "GRAPHIC_PATTERN",
            assessedRegion: { x: 350, y: 200, width: 300, height: 400 },
            medianColor: { red: 180, green: 160, blue: 140 },
            outlierFraction: 0.4,
            sharpOutlierFraction: 0.03,
            largestSharpComponentFraction: 0.004,
            thresholds: {
              colorDistance: 70,
              localEdgeDelta: 35,
              outlierFraction: 0.08,
              sharpOutlierFraction: 0.02,
              largestSharpComponentFraction: 0.003,
            },
          },
        },
        failureCode: null,
        failureMessage: null,
        createdAt: "2026-08-20T20:15:28.538Z",
      },
    ],
    asset: null,
  } as unknown as DeterministicRecovery;
}

test("preview resolves the exact persisted Base and frozen effective region", () => {
  const source = resolveStageABasePreviewSource(recoveryFixture());
  assert.ok(source);
  assert.equal(source.view.jobId, jobId);
  assert.equal(source.view.stageOutputId, baseStageId);
  assert.equal(source.view.contaminationStatus, "SUSPECTED_CONTAMINATION");
  assert.deepEqual(source.view.printRegionNormalized, [
    { x: 0.35, y: 0.2 },
    { x: 0.65, y: 0.2 },
    { x: 0.65, y: 0.6 },
    { x: 0.35, y: 0.6 },
  ]);
  assert.deepEqual(source.view.purity?.assessedRegion, {
    x: 350,
    y: 200,
    width: 300,
    height: 400,
  });
  assert.equal(source.view.normalEstimation?.status, "VALIDATED");
  assert.equal(
    source.view.normalEstimation?.model,
    "fal-ai/image-preprocessors/midas",
  );
  assert.equal(
    source.view.normalEstimation?.sourceBaseChecksumSha256,
    source.checksumSha256,
  );
  assert.equal(source.view.normalEstimation?.artworkInputIncluded, false);
  assert.equal(
    source.view.pipelineDiagnostics.stages.identityValidation.status,
    "HISTORICAL_NOT_AVAILABLE",
  );
});

test("fresh identity refusal reports configured later stages as NOT_REACHED", () => {
  const recovery = recoveryFixture();
  const snapshot = recovery.job.inputSnapshot as unknown as Record<string, unknown>;
  snapshot.identityConditioning = {
    outputConsistencyGate: {
      required: true,
      contractVersion: "nexhq-brand-model-identity-consistency-v1",
    },
  };
  snapshot.garmentSegmentationPolicy = {
    contractVersion: "garment-segmentation-policy-v1",
  };
  snapshot.normalEstimationPolicy = {
    contractVersion: "nexhq-normal-estimation-policy-v1",
  };
  snapshot.productFamilyPlacement = {
    outputMapping: "GENERATED_GARMENT_RELATIVE_V3",
    orientedFrontPrintPlane: {
      contractVersion:
        "nexhq-oriented-front-print-plane-v2.2-normal-assisted",
    },
  };
  snapshot.depthEstimationPolicy = {
    contractVersion: "nexhq-depth-estimation-policy-v1",
  };
  snapshot.compositing = {
    fabricIntegration: {
      mode: "FABRIC_AWARE_PRINT_V1",
      surfaceConforming: {
        contractVersion: "nexhq-surface-conforming-integration-v1",
      },
      depthAware: {
        contractVersion:
          "nexhq-depth-aware-surface-integration-v1.2-hybrid-low-depth",
      },
      surfaceRealismRefinement: {
        contractVersion: "nexhq-surface-realism-refinement-v1",
      },
    },
  };
  delete (recovery.stages[0]!.provenance as Record<string, unknown>)
    .normalEstimation;
  recovery.stages[0]!.provenance.identityConsistency = {
    contractVersion: "nexhq-brand-model-identity-consistency-v1",
    status: "FAIL",
    reason: "IDENTITY_DISTANCE_TOO_HIGH",
    authoritySource: "PERSONA_MASTER_IDENTITY_LOCK",
    identityLockActive: true,
    identityFallbackPrevented: true,
    identityLockSnapshotId: "lock-v3",
    masterIdentityAssetId: "master-v3",
    evaluatorVersion: "local-vladmandic-1.7.x-v1",
    thresholdVersion: "v1.0.0",
    maximumEuclideanDistance: 0.55,
    euclideanDistance: 0.5561596219414926,
    similarity: 0.7219201890292537,
    masterDetection: { status: "performed", confidence: 0.9998, faceCount: 1 },
    generatedDetection: { status: "performed", confidence: 0.7192, faceCount: 1 },
  };

  const source = resolveStageABasePreviewSource(recovery);
  assert.ok(source);
  const pipeline = source.view.pipelineDiagnostics;
  assert.equal(pipeline.stoppedAfter, "IDENTITY_VALIDATION");
  assert.equal(pipeline.nextStageNotExecuted, "SAM");
  assert.equal(pipeline.blockingReason, "IDENTITY_DISTANCE_TOO_HIGH");
  assert.equal(pipeline.stages.identityValidation.status, "REFUSED");
  assert.equal(pipeline.stages.sam.status, "NOT_REACHED");
  assert.equal(pipeline.stages.sam.blockedBy, "IDENTITY_VALIDATION");
  assert.equal(pipeline.stages.midasNormal.status, "NOT_REACHED");
  assert.equal(pipeline.stages.midasNormal.configured, true);
  assert.equal(
    pipeline.stages.orientedTorso.contractVersion,
    "nexhq-oriented-front-print-plane-v2.2-normal-assisted",
  );
  assert.equal(pipeline.stages.orientedTorso.status, "NOT_REACHED");
  assert.equal(pipeline.stages.depthAnything.status, "NOT_REACHED");
  assert.equal(pipeline.stages.surfaceRealism.status, "NOT_REACHED");
  assert.equal(pipeline.stages.fabricComposite.status, "NOT_REACHED");
});

test("Stage-A technical preview exposes truthful surface-integration evidence from the exact composite attempt", () => {
  const recovery = recoveryFixture();
  recovery.stages.push({
    stageOutputId: "55555555-5555-4555-8555-555555555555",
    jobId,
    stage: "DETERMINISTIC_COMPOSITE",
    stageAttempt: 1,
    status: "FAILED",
    assetId: null,
    storagePath: null,
    checksumSha256: null,
    providerRequestId: null,
    provenance: {
      surfaceIntegration: {
        contractVersion: "nexhq-surface-conforming-integration-v1",
        status: "REFUSED",
        reason: "TYPOGRAPHY_DISTORTION_RISK",
        warpEnabled: false,
        warpStrength: 0.012,
        maximumAppliedWarpPx: 3.2,
        clampReasons: ["TYPOGRAPHY_SAFETY_BOUND"],
        curvatureEvidence: 0.54,
        foldResponseEvidence: 0.72,
        shadingResponseEvidence: 0.48,
        textureResponseEvidence: 0.31,
        maskClippingCoverage: 0.997,
        effectivePrintRealismConfidence: 0.59,
        flatOverlayRisk: 0.18,
        typographyDistortionEstimate: 0.081,
        gridColumns: 7,
        gridRows: 9,
        deterministic: true,
        sourceAuthorityPreserved: true,
        failClosedReason: "TYPOGRAPHY_DISTORTION_RISK",
      },
      depthAwareIntegration: {
        contractVersion: "nexhq-depth-aware-surface-integration-v1",
        status: "REFUSED",
        reason: "TYPOGRAPHY_DISTORTION_RISK",
        estimator: "LOCAL_STAGE_A_RELATIVE_DEPTH_V1",
        depthEvidenceAvailable: true,
        localPlaneTiltDegrees: 3.4,
        localPerspectiveEstimate: 0.22,
        depthConfidence: 0.78,
        surfaceConfidence: 0.8,
        appliedLocalWarpStrength: 0.011,
        maximumLocalWarpPx: 3.8,
        typographyRisk: 0.081,
        globalFootprintPreserved: true,
        secondaryScaleApplied: false,
        secondaryTranslationApplied: false,
        maskCoverage: 0.997,
        clampReasons: [
          "FOOTPRINT_BOUNDARY_PINNED",
          "TYPOGRAPHY_SAFETY_BOUND",
        ],
        deterministic: true,
        sourceBaseOnly: true,
        sourceAuthorityPreserved: true,
        failClosedReason: "TYPOGRAPHY_DISTORTION_RISK",
      },
      ownerVerticalPlacement: {
        contractVersion: "nexhq-owner-vertical-placement-v1",
        placementPreset: "FRONT_LARGE",
        ownerYRequested: -0.25,
        previewY: 0.43,
        requestedRegisteredY: 0.43,
        registeredY: 0.43,
        finalY: 0.43,
        yPreserved: true,
        withinSafetyTolerance: true,
        clampApplied: false,
        clampDelta: 0,
        clampReason: null,
        footprintPreserved: true,
        secondContainApplied: false,
        secondGlobalScaleApplied: false,
        secondGlobalTranslationApplied: false,
      },
      surfaceRealismRefinement: {
        contractVersion: "nexhq-surface-realism-refinement-v1",
        status: "READY",
        reason: "READY",
        strongerPlaneGuidanceUsed: true,
        realDepthUsed: true,
        localFallbackUsed: false,
        surfaceDirectionEvidenceUsed: true,
        footprintPinned: true,
        registeredYPreserved: true,
        secondContainApplied: false,
        secondGlobalScaleApplied: false,
        secondGlobalTranslationApplied: false,
        horizontalSurfaceSlope: 0.18,
        verticalSurfaceSlope: 0.12,
        planeGuidanceStrength: 0.55,
        perspectiveGuidanceStrength: 0.42,
        curvatureEvidence: 0.38,
        evidenceConfidence: 0.81,
        localWarpStrength: 0.012,
        maximumLocalWarpPx: 4.2,
        shadingTransferStrength: 0.28,
        textureTransferStrength: 0.12,
        typographyRisk: 0.035,
        maskCoverage: 0.997,
        clampedNodeFraction: 0,
        deterministic: true,
        sourceAuthorityPreserved: true,
        failClosedReason: null,
      },
    },
    failureCode: "SURFACE_INTEGRATION_UNSAFE",
    failureMessage: "surface unsafe",
    createdAt: "2026-08-23T09:00:00.000Z",
  });
  const source = resolveStageABasePreviewSource(recovery);
  assert.equal(source?.view.surfaceIntegration?.status, "REFUSED");
  assert.equal(
    source?.view.surfaceIntegration?.reason,
    "TYPOGRAPHY_DISTORTION_RISK",
  );
  assert.equal(
    source?.view.surfaceIntegration?.sourceAuthorityPreserved,
    true,
  );
  assert.equal(source?.view.depthAwareIntegration?.status, "REFUSED");
  assert.equal(
    source?.view.depthAwareIntegration?.globalFootprintPreserved,
    true,
  );
  assert.equal(
    source?.view.depthAwareIntegration?.secondaryScaleApplied,
    false,
  );
  assert.equal(source?.view.ownerVerticalPlacement?.ownerYRequested, -0.25);
  assert.equal(source?.view.ownerVerticalPlacement?.registeredY, 0.43);
  assert.equal(source?.view.ownerVerticalPlacement?.finalY, 0.43);
  assert.equal(
    source?.view.ownerVerticalPlacement?.secondGlobalTranslationApplied,
    false,
  );
  assert.equal(source?.view.surfaceRealismRefinement?.realDepthUsed, true);
  assert.equal(source?.view.surfaceRealismRefinement?.footprintPinned, true);
  assert.equal(
    source?.view.surfaceRealismRefinement?.secondGlobalTranslationApplied,
    false,
  );
});

test("preview distinguishes frozen-but-not-reached Surface Realism from a historical job", () => {
  const recovery = recoveryFixture();
  (recovery.job.inputSnapshot as unknown as {
    compositing: { fabricIntegration: unknown };
  }).compositing = {
    fabricIntegration: structuredClone(
      DEFAULT_SURFACE_REALISM_REFINEMENT_INTEGRATION,
    ),
  };
  recovery.stages.push({
    stageOutputId: "77777777-7777-4777-8777-777777777777",
    jobId,
    stage: "DETERMINISTIC_COMPOSITE",
    stageAttempt: 1,
    status: "FAILED",
    assetId: null,
    storagePath: null,
    checksumSha256: null,
    providerRequestId: null,
    provenance: {
      depthAwareIntegration: {
        contractVersion:
          "nexhq-depth-aware-surface-integration-v1.1-garment-plane",
        status: "REFUSED",
        reason: "UNSAFE_LOCAL_WARP_REQUIRED",
        estimator: "REAL_DEPTH_ANYTHING_V2",
        depthEvidenceAvailable: true,
        localPlaneTiltDegrees: -3.34,
        localPerspectiveEstimate: 0.33,
        depthConfidence: 0.68,
        surfaceConfidence: 0.71,
        appliedLocalWarpStrength: 0,
        maximumLocalWarpPx: 0,
        requestedMaximumLocalWarpPx: 2.5,
        safeBoundedMaximumLocalWarpPx: 2.5,
        rejectedWarpExcessPx: 0,
        nodesExceedingBounds: 0,
        analyzedNodeCount: 63,
        nodesExceedingBoundsFraction: 0,
        typographyRisk: 0,
        globalFootprintPreserved: true,
        secondaryScaleApplied: false,
        secondaryTranslationApplied: false,
        maskCoverage: 0.9905,
        clampReasons: ["FOOTPRINT_BOUNDARY_PINNED"],
        deterministic: true,
        sourceBaseOnly: true,
        sourceAuthorityPreserved: true,
        failClosedReason: "UNSAFE_LOCAL_WARP_REQUIRED",
      },
    },
    failureCode: "DEPTH_AWARE_SURFACE_UNSAFE",
    failureMessage: "depth unsafe",
    createdAt: "2026-08-26T18:02:36.469Z",
  });
  const source = resolveStageABasePreviewSource(recovery);
  assert.equal(source?.view.surfaceRealismRefinement, null);
  assert.equal(
    source?.view.surfaceRealismRefinementConfigured?.contractVersion,
    "nexhq-surface-realism-refinement-v1",
  );
});

test("public Base preview contains authenticated access but never the private path", () => {
  const source = resolveStageABasePreviewSource(recoveryFixture());
  assert.ok(source);
  const view = toStageABasePreviewView(
    source,
    `/api/image/v2/jobs/${jobId}/base-preview?content=image`,
  );
  assert.equal(
    view.accessUrl,
    `/api/image/v2/jobs/${jobId}/base-preview?content=image`,
  );
  assert.equal("storagePath" in view, false);
  assert.doesNotMatch(JSON.stringify(view), /deterministic-v2\/job\/base/);
});

test("SAM mask preview is authenticated, Base-bound, and never exposes its private path", () => {
  const recovery = recoveryFixture();
  recovery.stages[0]!.provenance.garmentSegmentation = {
    contractVersion: "garment-segmentation-v1",
    policy: {
      contractVersion: "garment-segmentation-policy-v1",
      required: true,
      provider: "SAM3",
      adapterVersion: "nexhq-sam3-http-v1",
      model: "facebook/sam3",
      maximumCostUsd: 0,
    },
    status: "VALIDATED",
    validationReason: "ACCEPTED",
    sourceBaseChecksumSha256: "a".repeat(64),
    jobId,
    garmentType: "Vacancy T-Shirt",
    side: "FRONT",
    provider: "SAM3",
    model: "facebook/sam3",
    providerVersion: "sam3-test-v1",
    providerRequestId: "sam-request-1",
    candidateCount: 2,
    selectedCandidateId: "shirt",
    mask: {
      checksumSha256: "b".repeat(64),
      width: 1024,
      height: 1024,
      bounds: { x: 0.2, y: 0.25, width: 0.6, height: 0.68 },
      foregroundFraction: 0.25,
      largestComponentFraction: 0.96,
      skinLikeFraction: 0.04,
      hintOverlap: 0.82,
      selectionScore: 0.91,
    },
    prompt: "t-shirt worn by the person",
    idempotencyKeyHash: "c".repeat(64),
  };
  const source = resolveStageABasePreviewSource(recovery);
  assert.ok(source?.segmentationMask);
  const view = toStageABasePreviewView(
    source!,
    `/api/image/v2/jobs/${jobId}/base-preview?content=image`,
    `/api/image/v2/jobs/${jobId}/base-preview?content=mask`,
  );
  assert.equal(
    view.garmentSegmentation?.maskAccessUrl,
    `/api/image/v2/jobs/${jobId}/base-preview?content=mask`,
  );
  assert.equal("storagePath" in (view.garmentSegmentation ?? {}), false);
  assert.doesNotMatch(JSON.stringify(view), /\/segmentation\//);
});

test("V3 preview exposes exact large-front registration and clamp evidence", () => {
  const recovery = recoveryFixture();
  recovery.stages[0]!.provenance.garmentRegistration = {
    contractVersion: "garment-registration-v3",
    mappingVersion: "GENERATED_GARMENT_RELATIVE_V3",
    status: "REGISTERED",
    reason: "REGISTERED",
    confidence: 0.91,
    garmentBounds: { x: 0.2, y: 0.25, width: 0.6, height: 0.68 },
    garmentBodyBounds: { x: 0.28, y: 0.25, width: 0.44, height: 0.68 },
    faceBounds: { x: 0.43, y: 0.06, width: 0.14, height: 0.16 },
    neckExclusionBottom: 0.276,
    registeredPrintQuad: [
      { x: 0.33, y: 0.39 },
      { x: 0.69, y: 0.41 },
      { x: 0.67, y: 0.81 },
      { x: 0.31, y: 0.79 },
    ],
    garmentOutline: [
      { x: 0.2, y: 0.25 },
      { x: 0.8, y: 0.25 },
      { x: 0.72, y: 0.93 },
      { x: 0.28, y: 0.93 },
    ],
    frontTorsoEnvelope: {
      contractVersion: "nexhq-front-torso-print-envelope-v1",
      status: "READY",
      reason: "READY",
      fullGarmentBounds: { x: 0.2, y: 0.25, width: 0.6, height: 0.68 },
      torsoBounds: { x: 0.28, y: 0.32, width: 0.44, height: 0.56 },
      printableTorsoBounds: { x: 0.2866, y: 0.32, width: 0.4268, height: 0.56 },
      fullGarmentWidthRatio: 0.6,
      torsoWidthRatio: 0.44,
      torsoHeightRatio: 0.56,
      torsoToFullWidthRatio: 0.7333333333,
      sleeveSuppressionRatio: 0.2666666667,
      shoulderSuppressionRatio: 0.2,
      sleeveInfluenceRemoved: true,
      shoulderFlareRemoved: true,
      collarClearanceApplied: true,
      sampledRowCount: 42,
      stableRowCount: 36,
      rowWidthStability: 0.94,
      confidence: 0.93,
    },
    orientedFrontPrintPlane: {
      contractVersion: "nexhq-oriented-front-print-plane-v2",
      status: "READY",
      reason: "READY",
      evidenceClass: "ORIENTATION_STRONG",
      orientationConfidence: 0.91,
      estimatedRotationDegrees: 3.18,
      appliedRotationDegrees: 3.18,
      topEdgeTiltDegrees: 3.18,
      bottomEdgeTiltDegrees: 3.18,
      leftSideTiltDegrees: -2.86,
      rightSideTiltDegrees: 2.86,
      perspectiveAmount: 0.02,
      sampleCount: 140,
      rejectedSampleCount: 5,
      torsoEdgeStability: 0.9,
      centerlineStability: 0.94,
      shoulderCollarAgreement: 0.87,
      backgroundEvidenceExcluded: true,
      realDepthSupportUsed: false,
      requestedAxisAlignedBounds: { x: 0.32, y: 0.4, width: 0.36, height: 0.4 },
      orientedQuad: [
        { x: 0.33, y: 0.39 },
        { x: 0.69, y: 0.41 },
        { x: 0.67, y: 0.81 },
        { x: 0.31, y: 0.79 },
      ],
      allCornersInsideTorso: true,
      samContainment: 0.99,
      collarClearanceApplied: true,
      hemClearanceApplied: true,
      registrationTypographyRisk: 0.01,
      ownerScale: 0.9,
      ownerOffsetX: 0,
      ownerOffsetY: 0,
      globalFootprintPreserved: true,
      secondContainApplied: false,
      secondGlobalScaleApplied: false,
      secondGlobalTranslationApplied: false,
      clampReasons: [],
      failureReason: null,
    },
    maskCoverage: 0.96,
    placementEvidence: {
      placementPreset: "FRONT_LARGE",
      ownerUniformScale: 0.9,
      ownerOffsetX: 0,
      ownerOffsetY: 0,
      garmentRelativeIntent: { x: 0.125, y: 0.2, width: 0.75, height: 0.6 },
      requestedPrintBounds: { x: 0.32, y: 0.39, width: 0.36, height: 0.4 },
      finalPrintBounds: { x: 0.32, y: 0.4, width: 0.36, height: 0.4 },
      clampDeltaX: 0,
      clampDeltaY: 0.01,
      sizeReductionRatio: 1,
      clampReasons: ["COLLAR_CLEARANCE"],
      largeFrontPreserved: true,
    },
    expectedColor: "Schwarz",
    imageWidth: 1024,
    imageHeight: 1024,
  };
  const source = resolveStageABasePreviewSource(recovery);
  assert.ok(source);
  assert.equal(
    source.view.garmentRegistration?.contractVersion,
    "garment-registration-v3",
  );
  assert.equal(
    source.view.garmentRegistration?.placementEvidence?.largeFrontPreserved,
    true,
  );
  assert.equal(
    source.view.garmentRegistration?.frontTorsoEnvelope?.contractVersion,
    "nexhq-front-torso-print-envelope-v1",
  );
  assert.equal(
    source.view.garmentRegistration?.frontTorsoEnvelope?.sleeveInfluenceRemoved,
    true,
  );
  assert.equal(
    source.view.garmentRegistration?.orientedFrontPrintPlane?.contractVersion,
    "nexhq-oriented-front-print-plane-v2",
  );
  assert.deepEqual(source.view.printRegionNormalized, [
    { x: 0.33, y: 0.39 },
    { x: 0.69, y: 0.41 },
    { x: 0.67, y: 0.81 },
    { x: 0.31, y: 0.79 },
  ]);
});

test("failed V3 registration exposes its garment evidence without a misleading fallback region", () => {
  const recovery = recoveryFixture();
  recovery.stages[0]!.provenance.garmentRegistration = {
    contractVersion: "garment-registration-v3",
    mappingVersion: "GENERATED_GARMENT_RELATIVE_V3",
    status: "LOW_CONFIDENCE",
    reason: "LARGE_FRONT_UNSAFE",
    confidence: 0.61,
    garmentBounds: { x: 0.2, y: 0.25, width: 0.6, height: 0.68 },
    garmentBodyBounds: { x: 0.28, y: 0.25, width: 0.44, height: 0.68 },
    faceBounds: { x: 0.43, y: 0.06, width: 0.14, height: 0.16 },
    neckExclusionBottom: 0.276,
    registeredPrintQuad: null,
    garmentOutline: [
      { x: 0.2, y: 0.25 },
      { x: 0.8, y: 0.25 },
      { x: 0.72, y: 0.93 },
      { x: 0.28, y: 0.93 },
    ],
    maskCoverage: 0.72,
    placementEvidence: {
      placementPreset: "FRONT_LARGE",
      ownerUniformScale: 0.9,
      ownerOffsetX: 0,
      ownerOffsetY: 0,
      garmentRelativeIntent: { x: 0.125, y: 0.2, width: 0.75, height: 0.6 },
      requestedPrintBounds: { x: 0.32, y: 0.39, width: 0.36, height: 0.4 },
      finalPrintBounds: { x: 0.32, y: 0.39, width: 0.36, height: 0.4 },
      clampDeltaX: 0,
      clampDeltaY: 0,
      sizeReductionRatio: 1,
      clampReasons: ["GARMENT_HEM"],
      largeFrontPreserved: false,
    },
    expectedColor: "Schwarz",
    imageWidth: 1024,
    imageHeight: 1024,
  };

  const source = resolveStageABasePreviewSource(recovery);
  assert.ok(source);
  assert.equal(source.view.garmentRegistration?.status, "LOW_CONFIDENCE");
  assert.equal(source.view.printRegionNormalized.length, 0);
  assert.equal(source.view.garmentRegistration?.garmentOutline.length, 4);
});

test("Base preview route is authenticated and workspace-bound before delivery", () => {
  const source = readFileSync(
    "app/api/image/v2/jobs/[jobId]/base-preview/route.ts",
    "utf8",
  );
  assert.match(source, /requirePersonaScope\(\)/);
  assert.match(source, /getDeterministicRecovery\(gated\.scope, jobId\)/);
  assert.match(source, /loadDeterministicImageObject/);
  assert.match(source, /selected\.storagePath/);
  assert.match(source, /Cache-Control[\s\S]*private, no-store/);
  assert.doesNotMatch(source, /provider|generateBase|executeReal/);
});
