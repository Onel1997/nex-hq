import { REFERENCE_INTELLIGENCE_VERSION } from "./types";
import {
  buildReferenceDirection,
  createReferenceDescriptorFingerprint,
} from "./rules";
import type {
  ReferenceIntelligenceSnapshot,
  ReferenceUsage,
  ReferenceWorkspaceCatalog,
} from "./types";

/** Deterministic catalog fingerprint for audit / cache. */
export function buildReferenceCatalogFingerprint(
  catalog: ReferenceWorkspaceCatalog,
): string {
  const boards = catalog.boards
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((b) => `${b.id}:${b.version}:${b.primaryUsage}`)
    .join("|");
  const assets = catalog.assets
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(
      (a) =>
        `${a.id}:${a.version}:${a.approvalStatus}:${a.usage.slice().sort().join(",")}`,
    )
    .join("|");
  const descriptors = catalog.descriptors
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(createReferenceDescriptorFingerprint)
    .join("|");

  return [catalog.version, boards, assets, descriptors].join("::");
}

/**
 * Persistable Reference Intelligence snapshot for generation jobs.
 * JSON-safe and deterministic for the same catalog + usage filter.
 */
export function createReferenceIntelligenceSnapshot(
  catalog: ReferenceWorkspaceCatalog,
  options?: {
    usageFilter?: ReferenceUsage | null;
    capturedAt?: string;
    selectedBoardIds?: string[];
    selectedAssetIds?: string[];
  },
): ReferenceIntelligenceSnapshot {
  const usageFilter = options?.usageFilter ?? null;
  const direction = usageFilter
    ? buildReferenceDirection(catalog, usageFilter)
    : null;

  const boardIds =
    options?.selectedBoardIds ??
    direction?.boardIds ??
    catalog.boards.map((b) => b.id).sort();
  const assetIds =
    options?.selectedAssetIds ??
    direction?.assetIds ??
    catalog.assets
      .filter((a) => a.approvalStatus === "approved")
      .map((a) => a.id)
      .sort();

  const descriptors = catalog.descriptors
    .filter((d) => assetIds.includes(d.assetId) || direction?.descriptorIds.includes(d.id))
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id));

  const extractionMethods = [
    ...new Set(
      [
        ...catalog.assets
          .filter((a) => assetIds.includes(a.id))
          .map((a) => a.extractionMethod),
        ...descriptors.map((d) => d.extractionMethod),
      ].sort(),
    ),
  ];

  const approvalStates = [
    ...new Set(
      catalog.assets
        .filter((a) => assetIds.includes(a.id) || boardIds.includes(a.boardId))
        .map((a) => a.approvalStatus)
        .sort(),
    ),
  ];

  const fingerprint = [
    buildReferenceCatalogFingerprint(catalog),
    usageFilter ?? "all",
    boardIds.join(","),
    assetIds.join(","),
    descriptors.map(createReferenceDescriptorFingerprint).join("|"),
  ].join("##");

  return {
    referenceIntelligenceVersion: REFERENCE_INTELLIGENCE_VERSION,
    brandSlug: catalog.brandSlug,
    workspaceId: catalog.workspaceId,
    catalogVersion: catalog.version,
    capturedAt: options?.capturedAt ?? catalog.updatedAt,
    referenceBoardIds: boardIds,
    referenceAssetIds: assetIds,
    referenceDescriptorSnapshot: descriptors,
    referenceFingerprint: fingerprint,
    extractionMethods,
    approvalStates,
    usageFilter,
  };
}
