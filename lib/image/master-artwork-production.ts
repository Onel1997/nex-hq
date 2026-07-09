import type { ImageStudioHandoff } from "@/lib/image/image-handoff-store";
import type { ImageStudioAsset } from "@/agents/image/types";

const MASTER_ARTWORK_CONSTRAINT = [
  "Use the approved master artwork composition exactly as the print graphic.",
  "Do not redesign, reinterpret, or replace the artwork.",
  "Apply the existing graphic to the garment, scene, or campaign frame only.",
  "Preserve typography, symbols, layout, and hierarchy from the master artwork.",
].join(" ");

export function resolveApprovedMasterArtworkUrl(
  handoff: ImageStudioHandoff | null,
): string | undefined {
  if (!handoff?.masterArtworkApproved) return undefined;
  return (
    handoff.masterArtworkApprovedArtworkUrl ??
    handoff.masterArtworkApprovedProductionFileUrl ??
    handoff.masterArtworkProductionPngUrl ??
    handoff.masterArtworkArtworkUrl
  );
}

export function applyMasterArtworkToBrief(
  brief: string,
  handoff: ImageStudioHandoff | null,
): string {
  const artworkUrl = resolveApprovedMasterArtworkUrl(handoff);
  if (!artworkUrl) return brief;

  const mission = handoff?.mission;
  const direction = handoff?.masterArtworkDesignDirection;
  const constraints = [
    "MASTER ARTWORK LOCKED — Image Studio must not redesign the creative.",
    MASTER_ARTWORK_CONSTRAINT,
    mission
      ? `Mission: ${mission.title} · ${mission.collection} · ${mission.garment} in ${mission.colorway}`
      : "",
    direction ? `Design direction: ${direction}` : "",
    handoff?.masterArtworkResolution
      ? `Artwork resolution: ${handoff.masterArtworkResolution}`
      : "",
    handoff?.masterArtworkDpi ? `DPI target: ${handoff.masterArtworkDpi}` : "",
    handoff?.masterArtworkPrintReady ? "Print-ready production constraints apply." : "",
    handoff?.commercialBlueprint ? `Commercial review: ${handoff.commercialBlueprint.slice(0, 500)}` : "",
    brief,
  ]
    .filter(Boolean)
    .join("\n\n");

  return constraints.slice(0, 4000);
}

export function enrichAssetPromptWithMasterArtwork(
  prompt: string,
  handoff: ImageStudioHandoff | null,
): string {
  if (!handoff?.masterArtworkApproved) return prompt;

  const enriched = [
    MASTER_ARTWORK_CONSTRAINT,
    handoff.masterArtworkDesignDirection
      ? `Approved design direction: ${handoff.masterArtworkDesignDirection}`
      : "",
    prompt,
  ]
    .filter(Boolean)
    .join(". ");

  return enriched.slice(0, 4000);
}

export function enrichProductionAssetsWithMasterArtwork(
  assets: ImageStudioAsset[],
  handoff: ImageStudioHandoff | null,
): ImageStudioAsset[] {
  if (!handoff?.masterArtworkApproved) return assets;

  return assets.map((asset) => {
    const openai = enrichAssetPromptWithMasterArtwork(asset.prompt.openai, handoff);
    const midjourney = enrichAssetPromptWithMasterArtwork(asset.prompt.midjourney, handoff);
    const flux = enrichAssetPromptWithMasterArtwork(asset.prompt.flux, handoff);

    return {
      ...asset,
      prompt: {
        openai,
        midjourney,
        flux,
      },
    };
  });
}
