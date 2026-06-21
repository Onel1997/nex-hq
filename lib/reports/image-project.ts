import type { BrainImageSections } from "@/brain/domains/reports";
import {
  countProductionAssets,
  type ImageLookbookShot,
  type ImageStudioAsset,
} from "@/agents/image/studio-schema";
import { normalizeStudioSections } from "@/agents/image/enrich-studio";

export interface ImageProjectView {
  schemaVersion: string;
  projectName: string;
  collectionName: string;
  visualDirection: string;
  moodboard: BrainImageSections["moodboard"];
  palette?: BrainImageSections["palette"];
  productionAssets: ImageStudioAsset[];
  lookbookShots: ImageLookbookShot[];
  sourceReportTitles?: string[];
  assetCount: number;
  pendingCount: number;
  completedCount: number;
  /** @deprecated V2 — derived from productionAssets for legacy UI. */
  corePackage: ImageStudioAsset[];
  /** @deprecated V2 — empty in V3. */
  advancedPackage: ImageStudioAsset[];
  /** @deprecated — alias for lookbookShots. */
  campaignShots: ImageLookbookShot[];
}

export function toImageProjectView(
  sections: BrainImageSections | undefined,
): ImageProjectView | undefined {
  if (!sections) return undefined;

  const normalized = normalizeStudioSections(
    sections as unknown as Record<string, unknown>,
    sections.collectionName ?? sections.projectName,
  );
  if (!normalized) return undefined;

  const productionAssets = (normalized.productionAssets ??
    []) as ImageStudioAsset[];
  const lookbookShots = (normalized.lookbookShots ?? []) as ImageLookbookShot[];

  if (productionAssets.length === 0) return undefined;

  const pendingCount = productionAssets.filter(
    (a) => a.status === "pending" || a.status === "ready",
  ).length;
  const completedCount = productionAssets.filter(
    (a) => a.status === "completed",
  ).length;

  return {
    schemaVersion: String(normalized.schemaVersion ?? "3.0"),
    projectName: String(normalized.projectName ?? sections.projectName),
    collectionName: String(
      normalized.collectionName ?? sections.collectionName ?? sections.projectName,
    ),
    visualDirection: String(
      normalized.visualDirection ??
        sections.visualDirection ??
        sections.moodboard?.visualDirection ??
        "",
    ),
    moodboard: (normalized.moodboard ??
      sections.moodboard) as BrainImageSections["moodboard"],
    palette: (normalized.palette ?? sections.palette) as BrainImageSections["palette"],
    productionAssets,
    lookbookShots,
    sourceReportTitles:
      (normalized.sourceReportTitles as string[]) ?? sections.sourceReportTitles,
    assetCount: countProductionAssets(productionAssets),
    pendingCount,
    completedCount,
    corePackage: productionAssets,
    advancedPackage: [],
    campaignShots: lookbookShots,
  };
}
