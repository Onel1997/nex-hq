import { z } from "zod";

import { effectivePrintSurfaceForSnapshot } from "@/lib/image/paid-generation/types-v2";
import type { DeterministicRecovery } from "@/lib/image/deterministic-runtime/types";
import {
  garmentRegistrationV2Schema,
  printSurfaceForGarmentRegistration,
} from "@/lib/image/deterministic-runtime/garment-registration-v2";
import {
  garmentRegistrationV3Schema,
  printSurfaceForGarmentRegistrationV3,
} from "@/lib/image/deterministic-runtime/garment-registration-v3";
import { garmentSegmentationProvenanceSchema } from "@/lib/image/garment-segmentation/types";
import { garmentSegmentationMaskStoragePath } from "@/lib/image/garment-segmentation/storage";
import { brandModelIdentityConsistencySchema } from "@/lib/image/deterministic-runtime/identity-consistency";
import {
  depthAwareSurfaceEvidenceSchema,
  ownerPrintFootprintEvidenceSchema,
  surfaceRealismRefinementEvidenceSchema,
  surfaceIntegrationEvidenceSchema,
} from "@/lib/image/artwork-compositing/types";
import { depthEstimationProvenanceSchema } from "@/lib/image/depth-estimation/types";
import {
  printReadyStageAAssessmentSchema,
  printReadyStageAContractSchema,
} from "@/lib/image/deterministic-runtime/print-ready-stage-a";
import { ownerVerticalPlacementEvidenceSchema } from "@/lib/image/owner-vertical-placement";
import { orientedFrontPrintPlaneEvidenceSchema } from "@/lib/image/deterministic-runtime/oriented-front-print-plane-v2";
import { normalEstimationProvenanceSchema } from "@/lib/image/normal-estimation/types";

const pixelRegionSchema = z
  .object({
    x: z.number().int().nonnegative(),
    y: z.number().int().nonnegative(),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
  })
  .strict();

const purityPreviewSchema = z
  .object({
    contractVersion: z.enum(["base-print-purity-v1", "base-print-purity-v2"]),
    status: z.enum(["PASS", "SUSPECTED_CONTAMINATION"]),
    reason: z.enum([
      "CLEAR",
      "GRAPHIC_PATTERN",
      "UNREADABLE_BASE",
      "INVALID_REGION",
    ]),
    assessedRegion: pixelRegionSchema,
    analysisRegion: pixelRegionSchema.optional(),
    outlierFraction: z.number().min(0).max(1),
    sharpOutlierFraction: z.number().min(0).max(1),
    largestSharpComponentFraction: z.number().min(0).max(1),
    thresholds: z.record(z.string(), z.number()),
  })
  .passthrough();

export type PipelineStageStatus =
  | "COMPLETED"
  | "FAILED"
  | "REFUSED"
  | "NOT_REACHED"
  | "NOT_CONFIGURED"
  | "HISTORICAL_NOT_AVAILABLE";

export type PipelineStageDiagnostic = {
  status: PipelineStageStatus;
  configured: boolean;
  contractVersion: string | null;
  reason: string | null;
  blockedBy: string | null;
};

export type PipelineDiagnostics = {
  stoppedAfter: string | null;
  nextStageNotExecuted: string | null;
  blockingReason: string | null;
  stages: {
    identityValidation: PipelineStageDiagnostic;
    sam: PipelineStageDiagnostic;
    garmentRegistration: PipelineStageDiagnostic;
    midasNormal: PipelineStageDiagnostic;
    orientedTorso: PipelineStageDiagnostic;
    depthAnything: PipelineStageDiagnostic;
    surfaceConforming: PipelineStageDiagnostic;
    depthAware: PipelineStageDiagnostic;
    surfaceRealism: PipelineStageDiagnostic;
    fabricComposite: PipelineStageDiagnostic;
  };
};

export type StageABasePreviewSource = {
  storagePath: string;
  checksumSha256: string;
  segmentationMask: null | {
    storagePath: string;
    checksumSha256: string;
  };
  view: {
    jobId: string;
    stageOutputId: string;
    generatedAt: string;
    contaminationStatus: "PASS" | "SUSPECTED_CONTAMINATION" | "UNKNOWN";
    purity: z.infer<typeof purityPreviewSchema> | null;
    printRegionNormalized: Array<{ x: number; y: number }>;
    placementAuthority: null | {
      productFamilyId: string;
      side: "FRONT" | "BACK";
      placementTemplateId: string;
      placementTemplateVersion: number;
      placementPreset: string | null;
    };
    garmentRegistration:
      | z.infer<typeof garmentRegistrationV2Schema>
      | z.infer<typeof garmentRegistrationV3Schema>
      | null;
    garmentSegmentation:
      | (z.infer<typeof garmentSegmentationProvenanceSchema> & {
          maskAccessUrl: string | null;
        })
      | null;
    identityConsistency:
      | z.infer<typeof brandModelIdentityConsistencySchema>
      | null;
    surfaceIntegration:
      | z.infer<typeof surfaceIntegrationEvidenceSchema>
      | null;
    depthAwareIntegration:
      | z.infer<typeof depthAwareSurfaceEvidenceSchema>
      | null;
    ownerPrintFootprint:
      | z.infer<typeof ownerPrintFootprintEvidenceSchema>
      | null;
    ownerVerticalPlacement:
      | z.infer<typeof ownerVerticalPlacementEvidenceSchema>
      | null;
    surfaceRealismRefinement:
      | z.infer<typeof surfaceRealismRefinementEvidenceSchema>
      | null;
    surfaceRealismRefinementConfigured: null | {
      contractVersion: string;
    };
    printReadiness: null | {
      contract: z.infer<typeof printReadyStageAContractSchema>;
      preflight: z.infer<typeof printReadyStageAAssessmentSchema> | null;
      postflight: z.infer<typeof printReadyStageAAssessmentSchema> | null;
    };
    depthEstimation:
      | z.infer<typeof depthEstimationProvenanceSchema>
      | null;
    normalEstimation:
      | z.infer<typeof normalEstimationProvenanceSchema>
      | null;
    pipelineDiagnostics: PipelineDiagnostics;
  };
};

export type StageABasePreviewView = StageABasePreviewSource["view"] & {
  accessUrl: string;
};

function configuredStage(
  configured: boolean,
  contractVersion: string | null,
  modernSnapshot: boolean,
): PipelineStageDiagnostic {
  return {
    status: configured
      ? "NOT_REACHED"
      : modernSnapshot
        ? "NOT_CONFIGURED"
        : "HISTORICAL_NOT_AVAILABLE",
    configured,
    contractVersion,
    reason: null,
    blockedBy: null,
  };
}

function reachedStage(
  configured: boolean,
  contractVersion: string | null,
  status: PipelineStageStatus,
  reason: string | null,
): PipelineStageDiagnostic {
  return {
    status,
    configured,
    contractVersion,
    reason,
    blockedBy: null,
  };
}

function blockMissingStages(
  stages: PipelineDiagnostics["stages"],
  blockedBy: string,
): void {
  for (const stage of Object.values(stages)) {
    if (stage.configured && stage.status === "NOT_REACHED") {
      stage.blockedBy = blockedBy;
      stage.reason = `BLOCKED_BY_${blockedBy}`;
    }
  }
}

function derivePipelineDiagnostics(input: {
  recovery: DeterministicRecovery;
  identityConsistency: z.infer<typeof brandModelIdentityConsistencySchema> | null;
  garmentSegmentation: z.infer<typeof garmentSegmentationProvenanceSchema> | null;
  normalEstimation: z.infer<typeof normalEstimationProvenanceSchema> | null;
  garmentRegistration:
    | z.infer<typeof garmentRegistrationV2Schema>
    | z.infer<typeof garmentRegistrationV3Schema>
    | null;
  depthEstimation: z.infer<typeof depthEstimationProvenanceSchema> | null;
  surfaceIntegration: z.infer<typeof surfaceIntegrationEvidenceSchema> | null;
  depthAwareIntegration: z.infer<typeof depthAwareSurfaceEvidenceSchema> | null;
  surfaceRealismRefinement: z.infer<typeof surfaceRealismRefinementEvidenceSchema> | null;
}): PipelineDiagnostics {
  const snapshot = input.recovery.job.inputSnapshot;
  const identityContract = snapshot.identityConditioning?.outputConsistencyGate;
  const segmentationPolicy = snapshot.garmentSegmentationPolicy;
  const registrationPlacement = snapshot.productFamilyPlacement;
  const normalPolicy = snapshot.normalEstimationPolicy;
  const orientedPolicy = registrationPlacement?.orientedFrontPrintPlane;
  const depthPolicy = snapshot.depthEstimationPolicy;
  const fabric = snapshot.compositing?.fabricIntegration;
  const depthAwarePolicy = fabric?.depthAware;
  const surfaceRealismPolicy = fabric?.surfaceRealismRefinement;
  const modernSnapshot = Boolean(
    normalPolicy ||
      depthPolicy ||
      orientedPolicy ||
      surfaceRealismPolicy,
  );
  const compositeStage = [...input.recovery.stages]
    .reverse()
    .find((stage) => stage.stage === "DETERMINISTIC_COMPOSITE");

  const stages: PipelineDiagnostics["stages"] = {
    identityValidation: configuredStage(
      Boolean(identityContract?.required),
      identityContract?.contractVersion ?? null,
      modernSnapshot,
    ),
    sam: configuredStage(
      Boolean(segmentationPolicy),
      segmentationPolicy?.contractVersion ?? null,
      modernSnapshot,
    ),
    garmentRegistration: configuredStage(
      Boolean(registrationPlacement),
      registrationPlacement?.outputMapping ?? null,
      modernSnapshot,
    ),
    midasNormal: configuredStage(
      Boolean(normalPolicy),
      normalPolicy?.contractVersion ?? null,
      modernSnapshot,
    ),
    orientedTorso: configuredStage(
      Boolean(orientedPolicy),
      orientedPolicy?.contractVersion ?? null,
      modernSnapshot,
    ),
    depthAnything: configuredStage(
      Boolean(depthPolicy),
      depthPolicy?.contractVersion ?? null,
      modernSnapshot,
    ),
    surfaceConforming: configuredStage(
      Boolean(fabric?.surfaceConforming),
      fabric?.surfaceConforming?.contractVersion ?? null,
      modernSnapshot,
    ),
    depthAware: configuredStage(
      Boolean(depthAwarePolicy),
      depthAwarePolicy?.contractVersion ?? null,
      modernSnapshot,
    ),
    surfaceRealism: configuredStage(
      Boolean(surfaceRealismPolicy),
      surfaceRealismPolicy?.contractVersion ?? null,
      modernSnapshot,
    ),
    fabricComposite: configuredStage(
      Boolean(fabric),
      fabric?.mode ?? null,
      modernSnapshot,
    ),
  };

  if (input.identityConsistency) {
    stages.identityValidation = reachedStage(
      true,
      input.identityConsistency.contractVersion,
      input.identityConsistency.status === "PASS" ? "COMPLETED" : "REFUSED",
      input.identityConsistency.reason,
    );
  }
  if (input.garmentSegmentation) {
    stages.sam = reachedStage(
      true,
      input.garmentSegmentation.contractVersion,
      input.garmentSegmentation.status === "VALIDATED" ? "COMPLETED" : "REFUSED",
      input.garmentSegmentation.validationReason,
    );
  }
  if (input.normalEstimation) {
    stages.midasNormal = reachedStage(
      true,
      input.normalEstimation.contractVersion,
      input.normalEstimation.status === "VALIDATED"
        ? "COMPLETED"
        : input.normalEstimation.status === "UNKNOWN_OUTCOME"
          ? "FAILED"
          : "REFUSED",
      input.normalEstimation.validationReason,
    );
  }
  if (input.garmentRegistration) {
    stages.garmentRegistration = reachedStage(
      true,
      input.garmentRegistration.contractVersion,
      input.garmentRegistration.status === "REGISTERED" ? "COMPLETED" : "REFUSED",
      input.garmentRegistration.reason,
    );
    const oriented =
      input.garmentRegistration.contractVersion === "garment-registration-v3"
        ? input.garmentRegistration.orientedFrontPrintPlane
        : undefined;
    if (oriented) {
      stages.orientedTorso = reachedStage(
        true,
        oriented.contractVersion,
        oriented.status === "READY" ? "COMPLETED" : "REFUSED",
        oriented.reason,
      );
    }
  }
  if (input.depthEstimation) {
    stages.depthAnything = reachedStage(
      true,
      input.depthEstimation.contractVersion,
      input.depthEstimation.status === "VALIDATED" ? "COMPLETED" : "REFUSED",
      input.depthEstimation.validationReason,
    );
  }
  if (input.surfaceIntegration) {
    stages.surfaceConforming = reachedStage(
      true,
      input.surfaceIntegration.contractVersion,
      input.surfaceIntegration.status === "READY" ? "COMPLETED" : "REFUSED",
      input.surfaceIntegration.reason,
    );
  }
  if (input.depthAwareIntegration) {
    stages.depthAware = reachedStage(
      true,
      input.depthAwareIntegration.contractVersion,
      input.depthAwareIntegration.status === "READY" ? "COMPLETED" : "REFUSED",
      input.depthAwareIntegration.reason,
    );
  }
  if (input.surfaceRealismRefinement) {
    stages.surfaceRealism = reachedStage(
      true,
      input.surfaceRealismRefinement.contractVersion,
      input.surfaceRealismRefinement.status === "READY" ? "COMPLETED" : "REFUSED",
      input.surfaceRealismRefinement.reason,
    );
  }
  if (compositeStage) {
    stages.fabricComposite = reachedStage(
      true,
      fabric?.mode ?? null,
      compositeStage.status === "SUCCEEDED" ? "COMPLETED" : "FAILED",
      compositeStage.failureCode ?? compositeStage.failureMessage ?? null,
    );
  }

  const ordered: Array<[string, PipelineStageDiagnostic]> = [
    ["IDENTITY_VALIDATION", stages.identityValidation],
    ["SAM", stages.sam],
    ["MIDAS_NORMAL", stages.midasNormal],
    ["GARMENT_REGISTRATION", stages.garmentRegistration],
    ["ORIENTED_TORSO", stages.orientedTorso],
    ["DEPTH_ANYTHING", stages.depthAnything],
    ["SURFACE_CONFORMING", stages.surfaceConforming],
    ["DEPTH_AWARE", stages.depthAware],
    ["SURFACE_REALISM", stages.surfaceRealism],
    ["FABRIC_COMPOSITE", stages.fabricComposite],
  ];
  const stopIndex = ordered.findIndex(([, stage]) =>
    stage.status === "REFUSED" || stage.status === "FAILED",
  );
  const stoppedAfter = stopIndex >= 0 ? ordered[stopIndex]![0] : null;
  if (stoppedAfter) blockMissingStages(stages, stoppedAfter);
  const nextStage =
    stopIndex >= 0
      ? ordered.slice(stopIndex + 1).find(([, stage]) => stage.status === "NOT_REACHED")
      : undefined;

  return {
    stoppedAfter,
    nextStageNotExecuted: nextStage?.[0] ?? null,
    blockingReason: stopIndex >= 0 ? ordered[stopIndex]![1].reason : null,
    stages,
  };
}

/**
 * Resolves the one persisted successful Base belonging to this exact V2 job.
 * The storage path remains server-only; the public view contains only the
 * short-lived access contract and frozen diagnostic geometry.
 */
export function resolveStageABasePreviewSource(
  recovery: DeterministicRecovery,
): StageABasePreviewSource | null {
  const base = recovery.stages.find(
    (stage) =>
      stage.stage === "BASE_GENERATION" && stage.status === "SUCCEEDED",
  );
  if (!base?.storagePath || !base.checksumSha256) return null;
  const purityResult = purityPreviewSchema.safeParse(
    base.provenance.basePrintPurity,
  );
  const purity = purityResult.success ? purityResult.data : null;
  const registrationV3Result = garmentRegistrationV3Schema.safeParse(
    base.provenance.garmentRegistration,
  );
  const registrationV2Result = garmentRegistrationV2Schema.safeParse(
    base.provenance.garmentRegistration,
  );
  let garmentRegistration = registrationV3Result.success
    ? registrationV3Result.data
    : registrationV2Result.success
      ? registrationV2Result.data
      : null;
  const segmentationResult = garmentSegmentationProvenanceSchema.safeParse(
    base.provenance.garmentSegmentation,
  );
  const garmentSegmentation = segmentationResult.success
    ? segmentationResult.data
    : null;
  const normalEstimationResult = normalEstimationProvenanceSchema.safeParse(
    base.provenance.normalEstimation,
  );
  const normalEstimation = normalEstimationResult.success
    ? normalEstimationResult.data
    : null;
  const identityConsistencyResult =
    brandModelIdentityConsistencySchema.safeParse(
      base.provenance.identityConsistency,
    );
  const identityConsistency = identityConsistencyResult.success
    ? identityConsistencyResult.data
    : null;
  const compositeStage = [...recovery.stages]
    .reverse()
    .find((stage) => stage.stage === "DETERMINISTIC_COMPOSITE");
  const compositeOrientedPlane =
    orientedFrontPrintPlaneEvidenceSchema.safeParse(
      compositeStage?.provenance.orientedFrontPrintPlane,
    );
  if (
    compositeOrientedPlane.success &&
    garmentRegistration?.contractVersion === "garment-registration-v3"
  ) {
    garmentRegistration = {
      ...garmentRegistration,
      orientedFrontPrintPlane: compositeOrientedPlane.data,
    };
  }
  const fabricIntegration =
    compositeStage?.provenance.fabricIntegration &&
    typeof compositeStage.provenance.fabricIntegration === "object"
      ? (compositeStage.provenance.fabricIntegration as Record<string, unknown>)
      : null;
  const surfaceIntegrationResult = surfaceIntegrationEvidenceSchema.safeParse(
    compositeStage?.provenance.surfaceIntegration ??
      fabricIntegration?.surfaceIntegration,
  );
  const surfaceIntegration = surfaceIntegrationResult.success
    ? surfaceIntegrationResult.data
    : null;
  const depthAwareIntegrationResult =
    depthAwareSurfaceEvidenceSchema.safeParse(
      compositeStage?.provenance.depthAwareIntegration ??
        fabricIntegration?.depthAwareIntegration,
    );
  const depthAwareIntegration = depthAwareIntegrationResult.success
    ? depthAwareIntegrationResult.data
    : null;
  const ownerPrintFootprintResult =
    ownerPrintFootprintEvidenceSchema.safeParse(
      compositeStage?.provenance.ownerPrintFootprint,
    );
  const ownerPrintFootprint = ownerPrintFootprintResult.success
    ? ownerPrintFootprintResult.data
    : null;
  const ownerVerticalPlacementResult =
    ownerVerticalPlacementEvidenceSchema.safeParse(
      compositeStage?.provenance.ownerVerticalPlacement,
    );
  const ownerVerticalPlacement = ownerVerticalPlacementResult.success
    ? ownerVerticalPlacementResult.data
    : null;
  const surfaceRealismRefinementResult =
    surfaceRealismRefinementEvidenceSchema.safeParse(
      compositeStage?.provenance.surfaceRealismRefinement ??
        fabricIntegration?.surfaceRealismRefinementEvidence,
    );
  const surfaceRealismRefinement =
    surfaceRealismRefinementResult.success
      ? surfaceRealismRefinementResult.data
      : null;
  const frozenSurfaceRealismRefinement =
    recovery.job.inputSnapshot.compositing?.fabricIntegration
      ?.surfaceRealismRefinement ?? null;
  const depthEstimationResult = depthEstimationProvenanceSchema.safeParse(
    compositeStage?.provenance.depthEstimation,
  );
  const depthEstimation = depthEstimationResult.success
    ? depthEstimationResult.data
    : null;
  const rawPrintReadiness =
    base.provenance.printReadiness &&
    typeof base.provenance.printReadiness === "object"
      ? (base.provenance.printReadiness as Record<string, unknown>)
      : null;
  const printContract = printReadyStageAContractSchema.safeParse(
    rawPrintReadiness?.contract,
  );
  const preflight = printReadyStageAAssessmentSchema.safeParse(
    rawPrintReadiness?.preflight,
  );
  const postflight = printReadyStageAAssessmentSchema.safeParse(
    rawPrintReadiness?.postflight,
  );
  const printReadiness = printContract.success
    ? {
        contract: printContract.data,
        preflight: preflight.success ? preflight.data : null,
        postflight: postflight.success ? postflight.data : null,
      }
    : null;
  const segmentationMask =
    garmentSegmentation?.status === "VALIDATED" && garmentSegmentation.mask
      ? {
          storagePath: garmentSegmentationMaskStoragePath({
            workspaceId: recovery.job.workspaceId,
            jobId: recovery.job.id,
            sourceBaseChecksumSha256: base.checksumSha256,
            maskChecksumSha256: garmentSegmentation.mask.checksumSha256,
          }),
          checksumSha256: garmentSegmentation.mask.checksumSha256,
        }
      : null;
  const snapshotSurface = effectivePrintSurfaceForSnapshot(
    recovery.job.inputSnapshot,
  );
  const surface = garmentRegistration
    ? garmentRegistration.status === "REGISTERED"
      ? garmentRegistration.contractVersion === "garment-registration-v3"
        ? printSurfaceForGarmentRegistrationV3(
            snapshotSurface,
            garmentRegistration,
          )
        : printSurfaceForGarmentRegistration(
            snapshotSurface,
            garmentRegistration,
          )
      : null
    : snapshotSurface;
  const pipelineDiagnostics = derivePipelineDiagnostics({
    recovery,
    identityConsistency,
    garmentSegmentation,
    normalEstimation,
    garmentRegistration,
    depthEstimation,
    surfaceIntegration,
    depthAwareIntegration,
    surfaceRealismRefinement,
  });
  return {
    storagePath: base.storagePath,
    checksumSha256: base.checksumSha256,
    segmentationMask,
    view: {
      jobId: recovery.job.id,
      stageOutputId: base.stageOutputId,
      generatedAt: base.createdAt,
      contaminationStatus: purity?.status ?? "UNKNOWN",
      purity,
      identityConsistency,
      surfaceIntegration,
      depthAwareIntegration,
      ownerPrintFootprint,
      ownerVerticalPlacement,
      surfaceRealismRefinement,
      surfaceRealismRefinementConfigured: frozenSurfaceRealismRefinement
        ? {
            contractVersion:
              frozenSurfaceRealismRefinement.contractVersion,
          }
        : null,
      printReadiness,
      depthEstimation,
      normalEstimation,
      pipelineDiagnostics,
      garmentRegistration,
      garmentSegmentation: garmentSegmentation
        ? { ...garmentSegmentation, maskAccessUrl: null }
        : null,
      placementAuthority: recovery.job.inputSnapshot.productFamilyPlacement
        ? {
            productFamilyId:
              recovery.job.inputSnapshot.productFamilyPlacement
                .productFamilyId,
            side: recovery.job.inputSnapshot.productFamilyPlacement.side,
            placementTemplateId:
              recovery.job.inputSnapshot.productFamilyPlacement
                .placementTemplateId,
            placementTemplateVersion:
              recovery.job.inputSnapshot.productFamilyPlacement
                .placementTemplateVersion,
            placementPreset:
              recovery.job.inputSnapshot.semanticPlacement?.placementPreset ??
              null,
          }
        : null,
      printRegionNormalized: (surface?.quad ?? []).map((point) => ({
        x: point.x,
        y: point.y,
      })),
    },
  };
}

export function toStageABasePreviewView(
  source: StageABasePreviewSource,
  accessUrl: string,
  maskAccessUrl: string | null = null,
): StageABasePreviewView {
  return {
    ...source.view,
    accessUrl,
    garmentSegmentation: source.view.garmentSegmentation
      ? {
          ...source.view.garmentSegmentation,
          maskAccessUrl,
        }
      : null,
  };
}
