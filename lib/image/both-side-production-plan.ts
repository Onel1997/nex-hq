import {
  resolveContentShotForSide,
  type ContentShotDefinition,
} from "@/lib/image/content-packs";
import {
  BOTH_SIDE_PLACEMENT_DEFINITIONS,
  type BothSidePlacementPreset,
  type SemanticPlacementPreset,
} from "@/lib/image/semantic-print-placement";

export type BothSidePlanStatus =
  | "NOT_CREATED"
  | "PREPARED"
  | "IN_PROGRESS"
  | "IN_REVIEW"
  | "APPROVED"
  | "REJECTED";

export type BothSidePlanJob = {
  id: string;
  status: string;
  inputSnapshot: {
    masterArtwork: {
      artworkId?: string;
      version: string;
      checksum?: string;
    };
    product: {
      productProfileId?: string;
      profileVersion?: number;
      variantId: string | null;
    };
    brandModel: { brandModelId?: string; identityLockVersion: number };
    semanticPlacement?: {
      printSide: "FRONT" | "BACK";
      placementPreset: SemanticPlacementPreset;
    };
    shot: { assetId?: string };
  };
  reviewStatus?: string | null;
};

export type BothSidePlanAuthority = {
  artworkId: string | null;
  artworkVersion: string | null;
  artworkChecksum: string | null;
  productProfileId: string | null;
  productProfileVersion: number | null;
  variantId: string | null;
  brandModelId: string | null;
  identityLockVersion: number | null;
};

export type BothSidePlanEntry = {
  side: "FRONT" | "BACK";
  placementPreset: SemanticPlacementPreset;
  shot: ContentShotDefinition | null;
  status: BothSidePlanStatus;
  matchingJobId: string | null;
};

function matchesAuthority(
  job: BothSidePlanJob,
  authority: BothSidePlanAuthority,
): boolean {
  const snapshot = job.inputSnapshot;
  return Boolean(
    authority.artworkId &&
    authority.artworkVersion &&
    authority.artworkChecksum &&
    authority.productProfileId &&
    authority.productProfileVersion &&
    authority.variantId &&
    authority.brandModelId &&
    authority.identityLockVersion &&
    snapshot.masterArtwork.artworkId === authority.artworkId &&
    snapshot.masterArtwork.version === authority.artworkVersion &&
    snapshot.masterArtwork.checksum === authority.artworkChecksum &&
    snapshot.product.productProfileId === authority.productProfileId &&
    snapshot.product.profileVersion === authority.productProfileVersion &&
    snapshot.product.variantId === authority.variantId &&
    snapshot.brandModel.brandModelId === authority.brandModelId &&
    snapshot.brandModel.identityLockVersion === authority.identityLockVersion,
  );
}

function jobStatus(job: BothSidePlanJob | undefined): BothSidePlanStatus {
  if (!job) return "NOT_CREATED";
  if (job.reviewStatus === "APPROVED") return "APPROVED";
  if (job.reviewStatus === "REJECTED") return "REJECTED";
  if (job.reviewStatus === "REVIEW_REQUIRED") return "IN_REVIEW";
  if (job.status === "succeeded") return "IN_REVIEW";
  if (job.status === "running") return "IN_PROGRESS";
  if (job.status === "awaiting_confirmation" || job.status === "confirmed")
    return "PREPARED";
  return "NOT_CREATED";
}

export function buildBothSideProductionPlan(input: {
  preset: BothSidePlacementPreset;
  selectedShotId: string;
  authority: BothSidePlanAuthority;
  jobs: readonly BothSidePlanJob[];
}): {
  entries: [BothSidePlanEntry, BothSidePlanEntry];
  createdCount: number;
} {
  const definition = BOTH_SIDE_PLACEMENT_DEFINITIONS[input.preset];
  const entry = (
    side: "FRONT" | "BACK",
    placementPreset: SemanticPlacementPreset,
  ): BothSidePlanEntry => {
    const shot = resolveContentShotForSide(input.selectedShotId, side);
    const matching = input.jobs.find(
      (job) =>
        matchesAuthority(job, input.authority) &&
        job.inputSnapshot.semanticPlacement?.printSide === side &&
        job.inputSnapshot.semanticPlacement.placementPreset ===
          placementPreset &&
        job.inputSnapshot.shot.assetId === shot?.id,
    );
    return {
      side,
      placementPreset,
      shot,
      status: jobStatus(matching),
      matchingJobId: matching?.id ?? null,
    };
  };
  const entries: [BothSidePlanEntry, BothSidePlanEntry] = [
    entry("FRONT", definition.front),
    entry("BACK", definition.back),
  ];
  return {
    entries,
    createdCount: entries.filter((item) =>
      ["IN_REVIEW", "APPROVED", "REJECTED"].includes(item.status),
    ).length,
  };
}

export const BOTH_SIDE_PLAN_STATUS_LABELS: Readonly<
  Record<BothSidePlanStatus, string>
> = {
  NOT_CREATED: "Nicht erstellt",
  PREPARED: "Vorbereitet",
  IN_PROGRESS: "Wird erstellt",
  IN_REVIEW: "In Prüfung",
  APPROVED: "Freigegeben",
  REJECTED: "Abgelehnt",
};
