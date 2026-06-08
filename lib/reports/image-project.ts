import type { BrainImageSections } from "@/brain/domains/reports";
import {
  countImageAssets,
  type ImageCampaignShot,
  type NormalizedImageAsset,
} from "@/agents/image/normalized";
import { normalizeImageSections } from "@/agents/image/migrate-legacy";

export interface ImageProjectView {
  schemaVersion: string;
  projectName: string;
  moodboard: BrainImageSections["moodboard"];
  palette?: BrainImageSections["palette"];
  corePackage: NormalizedImageAsset[];
  advancedPackage: NormalizedImageAsset[];
  campaignShots: NonNullable<BrainImageSections["campaignShots"]>;
  sourceReportTitles?: string[];
  assetCount: number;
}

export function toImageProjectView(
  sections: BrainImageSections | undefined,
): ImageProjectView | undefined {
  if (!sections) return undefined;
  const normalized = normalizeImageSections(sections);
  if (!normalized) return undefined;

  const core = normalized.corePackage ?? [];
  const advanced = normalized.advancedPackage ?? [];

  return {
    schemaVersion: normalized.schemaVersion ?? "2.0",
    projectName: normalized.projectName,
    moodboard: normalized.moodboard,
    palette: normalized.palette,
    corePackage: core as NormalizedImageAsset[],
    advancedPackage: advanced as NormalizedImageAsset[],
    campaignShots: (normalized.campaignShots ?? []) as ImageCampaignShot[],
    sourceReportTitles: normalized.sourceReportTitles,
    assetCount: countImageAssets(
      core as NormalizedImageAsset[],
      advanced as NormalizedImageAsset[],
    ),
  };
}
