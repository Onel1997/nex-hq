import {
  initialPrepareFlowState,
  isPrepareInFlight,
  type PrepareFlowState,
  type V2PreparedJob,
} from "@/lib/image/deterministic-v2-panel/prepare-flow";
import {
  validateHumanDefinedQuad,
  type CornerFieldValues,
} from "@/lib/image/print-surface/validate-quad";
import { creativeDirectionPlanningKey } from "@/lib/image/social-creative-direction";
import type { OwnerArtworkPlacement } from "@/lib/product-library/product-family";

export const TERMINAL_RECOVERY_STATES = [
  "APPROVED",
  "REJECTED",
  "CANCELLED",
] as const;
export type TerminalRecoveryState = (typeof TERMINAL_RECOVERY_STATES)[number];

export const UNFINISHED_JOB_STATUSES = [
  "awaiting_confirmation",
  "confirmed",
  "running",
  "failed",
  "unknown_outcome",
] as const;

export const CHECKLIST_KEYS = [
  "identity",
  "productFidelity",
  "artworkFidelityExact",
  "placement",
  "perspective",
  "lightingIntegration",
] as const;

export type V2ChecklistKey = (typeof CHECKLIST_KEYS)[number];
export type V2ReviewChecklist = Record<V2ChecklistKey, boolean>;

export type V2Recovery = {
  state: string;
  job: V2PreparedJob;
  stages: Array<{
    stage?: string;
    stageAttempt?: number;
    status?: string;
    checksumSha256?: string | null;
    provenance?: Record<string, unknown> | null;
  }>;
  asset: null | {
    id: string;
    reviewStatus: string;
    accessUrl?: string | null;
    mockupReview: Record<string, unknown>;
  };
  retryEligibility?: null | {
    eligible: boolean;
    boundary: "DETERMINISTIC_STAGE_B_ONLY" | "DEPTH_THEN_STAGE_B";
    openAiRequired: false;
    samRequired: false;
    depthRequired?: boolean;
    reason: string;
  };
};

export type CurrentV2Inputs = {
  reportRecordId: string | null;
  reportId: string | null;
  assetId: string | null;
  brandModelId: string | null;
  identityLockVersion: number | null;
  artworkId: string | null;
  artworkVersion: string | null;
  artworkChecksum: string | null;
  shopifyProductId: string | null;
  shopifyVariantId: string | null;
  productProfileId?: string | null;
  productProfileVersion?: number | null;
  printSide?: string | null;
  placementPreset?: string | null;
  creativeDirectionSignature?: string | null;
  ownerArtworkPlacementSignature?: string | null;
  points: CornerFieldValues;
};

export type HistoricalV2Run = {
  jobId: string;
  state: string;
  jobStatus: string;
  inputFingerprint: string;
  shotTitle: string;
  printSurfaceLabel: string;
  reviewStatus: string | null;
  lineage: string | null;
};

export type ActiveV2UiState = {
  recovery: V2Recovery | null;
  checklist: V2ReviewChecklist;
  boundInputFingerprint: string | null;
  historical: HistoricalV2Run[];
};

const QUAD_EPSILON = 1e-6;

export function emptyV2Checklist(): V2ReviewChecklist {
  return {
    identity: false,
    productFidelity: false,
    artworkFidelityExact: false,
    placement: false,
    perspective: false,
    lightingIntegration: false,
  };
}

export function initialActiveV2UiState(): ActiveV2UiState {
  return {
    recovery: null,
    checklist: emptyV2Checklist(),
    boundInputFingerprint: null,
    historical: [],
  };
}

export function isTerminalRecoveryState(
  state: string | null | undefined,
): boolean {
  return state === "APPROVED" || state === "REJECTED" || state === "CANCELLED";
}

export function isUnfinishedJobStatus(
  status: string | null | undefined,
): boolean {
  return (UNFINISHED_JOB_STATUSES as readonly string[]).includes(status ?? "");
}

export function panelInputFingerprint(inputs: CurrentV2Inputs): string {
  return [
    inputs.points.tlx,
    inputs.points.tly,
    inputs.points.trx,
    inputs.points.try,
    inputs.points.brx,
    inputs.points.bry,
    inputs.points.blx,
    inputs.points.bly,
    inputs.reportRecordId,
    inputs.reportId,
    inputs.assetId,
    inputs.brandModelId,
    inputs.identityLockVersion,
    inputs.artworkId,
    inputs.artworkVersion,
    inputs.artworkChecksum,
    inputs.shopifyProductId,
    inputs.shopifyVariantId,
    inputs.productProfileId,
    inputs.productProfileVersion,
    inputs.printSide,
    inputs.placementPreset,
    inputs.creativeDirectionSignature,
    inputs.ownerArtworkPlacementSignature,
  ].join("|");
}

export function ownerArtworkPlacementFromRecovery(
  recovery: V2Recovery,
): OwnerArtworkPlacement | null {
  const placement = recovery.job.inputSnapshot.productFamilyPlacement?.ownerPlacement;
  return placement ? { ...placement } : null;
}

export function toHistoricalV2Run(recovery: V2Recovery): HistoricalV2Run {
  const snapshot = recovery.job.inputSnapshot;
  const lineage = recovery.stages.length
    ? recovery.stages
        .map((stage) =>
          `${stage.stage ?? "stage"} #${stage.stageAttempt ?? "?"} ${stage.status ?? ""}`.trim(),
        )
        .join(" → ")
    : null;
  return {
    jobId: recovery.job.id,
    state: recovery.state,
    jobStatus: recovery.job.status,
    inputFingerprint: recovery.job.inputFingerprint,
    shotTitle: snapshot.shot.title,
    printSurfaceLabel: `${snapshot.printSurface.region} v${snapshot.printSurface.version}`,
    reviewStatus: recovery.asset?.reviewStatus ?? null,
    lineage,
  };
}

export function toHistoricalV2RunFromJob(
  job: V2PreparedJob,
  state = job.status,
): HistoricalV2Run {
  return {
    jobId: job.id,
    state,
    jobStatus: job.status,
    inputFingerprint: job.inputFingerprint,
    shotTitle: job.inputSnapshot.shot.title,
    printSurfaceLabel: `${job.inputSnapshot.printSurface.region} v${job.inputSnapshot.printSurface.version}`,
    reviewStatus: null,
    lineage: null,
  };
}

function archiveRecovery(
  historical: HistoricalV2Run[],
  recovery: V2Recovery | null,
): HistoricalV2Run[] {
  if (!recovery) return historical;
  const entry = toHistoricalV2Run(recovery);
  return [entry, ...historical.filter((run) => run.jobId !== entry.jobId)];
}

export function resetActiveUiForNewPrepare(
  state: ActiveV2UiState,
): ActiveV2UiState {
  return {
    recovery: null,
    checklist: emptyV2Checklist(),
    boundInputFingerprint: null,
    historical: archiveRecovery(state.historical, state.recovery),
  };
}

export function resetActivePrepareFlow(
  flow: PrepareFlowState,
): PrepareFlowState {
  if (isPrepareInFlight(flow)) return flow;
  return initialPrepareFlowState();
}

function snapshotQuad(
  job: V2PreparedJob,
): ReadonlyArray<{ x: number; y: number }> | null {
  const quad =
    job.inputSnapshot.printSurfaceOverride?.quad ??
    job.inputSnapshot.printSurface.quad;
  return Array.isArray(quad) && quad.length === 4 ? quad : null;
}

function quadsEqual(
  left: ReadonlyArray<{ x: number; y: number }>,
  right: ReadonlyArray<{ x: number; y: number }>,
): boolean {
  if (left.length !== right.length) return false;
  return left.every((point, index) => {
    const other = right[index];
    return (
      Boolean(other) &&
      Math.abs(point.x - other!.x) < QUAD_EPSILON &&
      Math.abs(point.y - other!.y) < QUAD_EPSILON
    );
  });
}

export function jobMatchesCurrentInputs(
  job: V2PreparedJob,
  inputs: CurrentV2Inputs,
): boolean {
  const snapshot = job.inputSnapshot;
  if (
    snapshot.production?.reportRecordId &&
    snapshot.production.reportRecordId !== inputs.reportRecordId
  )
    return false;
  if (
    snapshot.production?.reportId &&
    snapshot.production.reportId !== inputs.reportId
  )
    return false;
  if (snapshot.shot.assetId && snapshot.shot.assetId !== inputs.assetId)
    return false;
  if (
    snapshot.brandModel.brandModelId &&
    inputs.brandModelId &&
    snapshot.brandModel.brandModelId !== inputs.brandModelId
  )
    return false;
  if (
    snapshot.brandModel.identityLockVersion != null &&
    inputs.identityLockVersion != null &&
    snapshot.brandModel.identityLockVersion !== inputs.identityLockVersion
  )
    return false;
  if (
    snapshot.masterArtwork.artworkId &&
    inputs.artworkId &&
    snapshot.masterArtwork.artworkId !== inputs.artworkId
  )
    return false;
  if (
    snapshot.masterArtwork.version &&
    inputs.artworkVersion &&
    snapshot.masterArtwork.version !== inputs.artworkVersion
  )
    return false;
  if (
    snapshot.masterArtwork.checksum &&
    inputs.artworkChecksum &&
    snapshot.masterArtwork.checksum !== inputs.artworkChecksum
  )
    return false;
  if (
    snapshot.product.shopifyProductId &&
    inputs.shopifyProductId &&
    snapshot.product.shopifyProductId !== inputs.shopifyProductId
  )
    return false;
  if (
    snapshot.product.variantId &&
    inputs.shopifyVariantId &&
    snapshot.product.variantId !== inputs.shopifyVariantId
  )
    return false;
  if (
    snapshot.product.productProfileId &&
    inputs.productProfileId &&
    snapshot.product.productProfileId !== inputs.productProfileId
  )
    return false;
  if (
    snapshot.product.profileVersion &&
    inputs.productProfileVersion &&
    snapshot.product.profileVersion !== inputs.productProfileVersion
  )
    return false;
  if (
    snapshot.semanticPlacement?.printSide &&
    inputs.printSide &&
    snapshot.semanticPlacement.printSide !== inputs.printSide
  )
    return false;
  if (
    snapshot.semanticPlacement?.placementPreset &&
    inputs.placementPreset &&
    snapshot.semanticPlacement.placementPreset !== inputs.placementPreset
  )
    return false;
  if (
    snapshot.creativeDirection &&
    inputs.creativeDirectionSignature &&
    creativeDirectionPlanningKey(snapshot.creativeDirection) !==
      inputs.creativeDirectionSignature
  )
    return false;

  const currentQuad = validateHumanDefinedQuad(inputs.points);
  if (!currentQuad.ok) return false;
  const jobQuad = snapshotQuad(job);
  if (jobQuad) return quadsEqual(jobQuad, currentQuad.quad);
  return true;
}

export function isActiveRunStaleForCurrentInputs(input: {
  boundInputFingerprint: string | null;
  currentInputFingerprint: string;
  job: V2PreparedJob | null;
  currentInputs: CurrentV2Inputs;
}): boolean {
  if (input.boundInputFingerprint !== null) {
    return input.boundInputFingerprint !== input.currentInputFingerprint;
  }
  if (!input.job) return false;
  return !jobMatchesCurrentInputs(input.job, input.currentInputs);
}

export function decideRecoveredRunRole(input: {
  recoveryState: string;
  job: V2PreparedJob;
  currentInputs: CurrentV2Inputs;
}): "active" | "historical" {
  if (
    isTerminalRecoveryState(input.recoveryState) ||
    input.job.status === "cancelled"
  ) {
    return jobMatchesCurrentInputs(input.job, input.currentInputs)
      ? "active"
      : "historical";
  }
  return "active";
}

export function applyRecoveredRunToUi(input: {
  state: ActiveV2UiState;
  recovery: V2Recovery;
  currentInputs: CurrentV2Inputs;
  source: "reload" | "prepare" | "action";
}): { role: "active" | "historical"; state: ActiveV2UiState } {
  const role =
    input.source === "prepare" || input.source === "action"
      ? ("active" as const)
      : decideRecoveredRunRole({
          recoveryState: input.recovery.state,
          job: input.recovery.job,
          currentInputs: input.currentInputs,
        });
  if (role === "historical") {
    return {
      role,
      state: {
        recovery: null,
        checklist: emptyV2Checklist(),
        boundInputFingerprint: null,
        historical: archiveRecovery(input.state.historical, input.recovery),
      },
    };
  }
  return {
    role,
    state: {
      recovery: input.recovery,
      checklist:
        input.source === "prepare" ? emptyV2Checklist() : input.state.checklist,
      boundInputFingerprint: panelInputFingerprint(input.currentInputs),
      historical: input.state.historical.filter(
        (run) => run.jobId !== input.recovery.job.id,
      ),
    },
  };
}

export function applyInputChangeToActiveRun(input: {
  state: ActiveV2UiState;
  job: V2PreparedJob | null;
  currentInputs: CurrentV2Inputs;
}): { stale: boolean; state: ActiveV2UiState } {
  const fingerprint = panelInputFingerprint(input.currentInputs);
  const stale = isActiveRunStaleForCurrentInputs({
    boundInputFingerprint: input.state.boundInputFingerprint,
    currentInputFingerprint: fingerprint,
    job: input.job ?? input.state.recovery?.job ?? null,
    currentInputs: input.currentInputs,
  });
  if (!stale) return { stale: false, state: input.state };
  return { stale: true, state: resetActiveUiForNewPrepare(input.state) };
}

export function statusLabelForRecovery(state: string): string | null {
  const labels: Record<string, string> = {
    AWAITING_CONFIRMATION: "Bereit zur Bestätigung",
    CONFIRMED: "Bestätigt",
    BASE_RUNNING: "Basisbild wird erstellt",
    BASE_READY: "Basisbild bereit",
    COMPOSITING: "Artwork wird angewendet",
    SAVING_RESULT: "Ergebnis wird gespeichert",
    REVIEW_REQUIRED: "Prüfung erforderlich",
    APPROVED: "Freigegeben",
    REJECTED: "Abgelehnt",
    COMPOSITE_FAILED: "Artwork-Anwendung fehlgeschlagen",
    BASE_FAILED: "Bilderstellung fehlgeschlagen",
    UNKNOWN_PROVIDER_OUTCOME: "Provider-Ausgang unklar",
    CANCELLED: "Abgebrochen",
  };
  return labels[state] ?? null;
}
