import type { DeterministicRecovery } from "@/lib/image/deterministic-runtime/types";
import type { DeterministicCompositeRetryEligibility } from "@/lib/image/deterministic-runtime/service";
import { SEMANTIC_PLACEMENT_DEFINITIONS } from "@/lib/image/semantic-print-placement";

export type PreviousRunOwnerView = {
  jobId: string;
  createdAt: string;
  thumbnailUrl: string | null;
  thumbnailKind: "RESULT" | "STAGE_A_BASE" | null;
  artworkDisplayName: string;
  productName: string;
  color: string | null;
  brandModelName: string;
  outputGoal: "Social Content" | "Shopify Mockup";
  shotTitle: string;
  placementLabel: string;
  placementHeightLabel: "Höher" | "Zentriert" | "Tiefer" | "Historisch";
  ownerStatus: string;
  recoveryState: string;
  reviewStatus: string | null;
  retryEligibility: DeterministicCompositeRetryEligibility;
  technical: {
    inputFingerprint: string;
    lineage: string | null;
    ownerPlacement: null | { scale: number; x: number; y: number };
  };
};

export function previousRunPlacementHeightLabel(
  offsetY: number | null | undefined,
): PreviousRunOwnerView["placementHeightLabel"] {
  if (offsetY == null) return "Historisch";
  if (offsetY < -0.05) return "Höher";
  if (offsetY > 0.05) return "Tiefer";
  return "Zentriert";
}

function ownerStatus(recovery: DeterministicRecovery): string {
  if (recovery.asset?.reviewStatus === "APPROVED") return "Freigegeben";
  if (recovery.asset?.reviewStatus === "REJECTED") return "Abgelehnt";
  if (recovery.asset) return "Zur Prüfung bereit";
  if (recovery.state === "UNKNOWN_PROVIDER_OUTCOME")
    return "Unbekannter Ausgang";
  if (recovery.state === "COMPOSITE_FAILED")
    return recovery.job.failureCode === "DEPTH_ESTIMATION_FAILED"
      ? "Stofftiefe fehlgeschlagen"
      : recovery.job.failureCode === "SURFACE_REALISM_REFINEMENT_UNSAFE"
        ? "Shirt-Realismus fehlgeschlagen"
      : "Artwork-Anwendung fehlgeschlagen";
  if (recovery.job.failureCode === "STAGE_A_NOT_PRINT_READY")
    return "Basisbild nicht druckbereit";
  if (recovery.job.failureCode === "BRAND_MODEL_IDENTITY_MISMATCH")
    return "Markenmodell-Prüfung fehlgeschlagen";
  if (recovery.job.failureCode === "GARMENT_SEGMENTATION_UNSAFE")
    return "Kleidungs-Erkennung fehlgeschlagen";
  if (/^MIDAS_NORMAL_|^NORMAL_/.test(recovery.job.failureCode ?? ""))
    return "Shirt-Oberflächenrichtung fehlgeschlagen";
  if (recovery.job.failureCode === "OWNER_VERTICAL_PLACEMENT_UNSAFE")
    return "Höhenplatzierung fehlgeschlagen";
  if (/^GARMENT_REGISTRATION_/.test(recovery.job.failureCode ?? ""))
    return "Torso-Druckfläche fehlgeschlagen";
  if (recovery.job.failureCode === "DEPTH_AWARE_SURFACE_UNSAFE")
    return "Oberflächenanpassung fehlgeschlagen";
  if (recovery.job.failureCode === "SURFACE_REALISM_REFINEMENT_UNSAFE")
    return "Shirt-Realismus fehlgeschlagen";
  if (recovery.state === "BASE_FAILED") return "Produktion fehlgeschlagen";
  if (
    recovery.stages.some(
      (stage) => stage.stage === "BASE_GENERATION" && stage.status === "SUCCEEDED",
    )
  )
    return "Basisbild erstellt";
  if (recovery.state === "BASE_RUNNING") return "Basisbild wird erstellt";
  if (recovery.state === "CONFIRMED") return "Bestätigt";
  if (recovery.state === "AWAITING_CONFIRMATION")
    return "Bestätigung erforderlich";
  if (recovery.state === "CANCELLED") return "Abgebrochen";
  return "Produktion wird verarbeitet";
}

function placementLabel(recovery: DeterministicRecovery): string {
  const placement = recovery.job.inputSnapshot.semanticPlacement;
  if (placement?.displayLabel) return placement.displayLabel;
  if (placement?.placementPreset)
    return SEMANTIC_PLACEMENT_DEFINITIONS[placement.placementPreset].label;
  return "Historische Platzierung";
}

export function toPreviousRunOwnerView(input: {
  recovery: DeterministicRecovery;
  artworkDisplayName?: string | null;
  thumbnailUrl?: string | null;
  thumbnailKind?: "RESULT" | "STAGE_A_BASE" | null;
  retryEligibility: DeterministicCompositeRetryEligibility;
}): PreviousRunOwnerView {
  const { recovery } = input;
  const snapshot = recovery.job.inputSnapshot;
  const lineage = recovery.stages.length
    ? recovery.stages
        .map(
          (stage) =>
            `${stage.stage} #${stage.stageAttempt} ${stage.status}`,
        )
        .join(" → ")
    : null;
  const ownerPlacement = snapshot.productFamilyPlacement?.ownerPlacement ?? null;
  return {
    jobId: recovery.job.id,
    createdAt: recovery.job.createdAt,
    thumbnailUrl: input.thumbnailUrl ?? null,
    thumbnailKind: input.thumbnailKind ?? null,
    artworkDisplayName:
      input.artworkDisplayName?.trim() || snapshot.masterArtwork.designId,
    productName: snapshot.product.productName,
    color: snapshot.product.color,
    brandModelName: snapshot.brandModel.displayName,
    outputGoal:
      snapshot.creativeDirection?.contentMode === "SHOPIFY_MOCKUP"
        ? "Shopify Mockup"
        : "Social Content",
    shotTitle: snapshot.shot.title,
    placementLabel: placementLabel(recovery),
    placementHeightLabel: previousRunPlacementHeightLabel(
      ownerPlacement?.offsetY,
    ),
    ownerStatus: ownerStatus(recovery),
    recoveryState: recovery.state,
    reviewStatus: recovery.asset?.reviewStatus ?? null,
    retryEligibility: input.retryEligibility,
    technical: {
      inputFingerprint: recovery.job.inputFingerprint,
      lineage,
      ownerPlacement: ownerPlacement
        ? {
            scale: ownerPlacement.uniformScale,
            x: ownerPlacement.offsetX,
            y: ownerPlacement.offsetY,
          }
        : null,
    },
  };
}

export function sortPreviousRunsNewestFirst(
  runs: PreviousRunOwnerView[],
): PreviousRunOwnerView[] {
  return [...runs].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt),
  );
}

export function formatPreviousRunLocalDateTime(
  value: string,
  timeZone?: string,
): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Zeitpunkt unbekannt";
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    ...(timeZone ? { timeZone } : {}),
  })
    .format(date)
    .replace(",", " ·");
}

export function previousRunMatchesFilter(
  run: PreviousRunOwnerView,
  filter: "ALL" | "SUCCESS" | "FAILED" | "REVIEW",
): boolean {
  if (filter === "ALL") return true;
  if (filter === "REVIEW") return run.ownerStatus === "Zur Prüfung bereit";
  if (filter === "SUCCESS")
    return run.ownerStatus === "Freigegeben" || run.ownerStatus === "Zur Prüfung bereit";
  return [
    "Artwork-Anwendung fehlgeschlagen",
    "Produktion fehlgeschlagen",
    "Abgelehnt",
    "Unbekannter Ausgang",
    "Stofftiefe fehlgeschlagen",
    "Basisbild nicht druckbereit",
    "Markenmodell-Prüfung fehlgeschlagen",
    "Kleidungs-Erkennung fehlgeschlagen",
    "Höhenplatzierung fehlgeschlagen",
    "Torso-Druckfläche fehlgeschlagen",
    "Oberflächenanpassung fehlgeschlagen",
  ].includes(run.ownerStatus);
}
