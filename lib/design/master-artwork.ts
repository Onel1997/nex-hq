import type { DesignStudioBrief } from "@/agents/design/studio-brief";
import type { DesignMissionAssets } from "@/lib/design/design-mission-store";
import type { ImageGenerationMode } from "@/lib/image/image-generation-config";

export type MasterArtworkStatus = "empty" | "draft" | "in_review" | "approved";

export type MasterArtworkSourceType = "ai-designer-artwork" | "svg-draft" | "uploaded";

/** Canonical master artwork record — Design Studio owns creative truth. */
export interface MasterArtworkState {
  status: MasterArtworkStatus;
  version: string;
  sourceType?: MasterArtworkSourceType;
  commercialScore?: number;
  commercialApproved?: boolean;
  printReadiness?: string;
  resolutionLabel?: string;
  transparency?: boolean;
  placement?: string;
  printMethod?: string;
  generatedAt?: string;
  approvedAt?: string;
  /** AI Designer artwork — primary creative source. */
  artworkImageUrl?: string;
  transparentPngUrl?: string;
  productionPngUrl?: string;
  previewUrl?: string;
  selectedConceptId?: string;
  designDirection?: string;
  generationMode?: ImageGenerationMode;
  dpi?: number;
  resolution?: string;
  transparentBackground?: boolean;
  printReady?: boolean;
  /** Locked at approval — production source of truth for Image Studio. */
  approvedArtworkUrl?: string;
  approvedProductionFileUrl?: string;
  /** Optional vector draft — secondary export support only. */
  approvedSvgMarkup?: string;
}

export interface MasterArtworkCommercialPayload {
  approved?: boolean;
  iterations?: number;
  score?: { overall?: number };
  imageStudioBlueprint?: string;
}

export interface MasterArtworkViewModel {
  state: MasterArtworkState;
  previewImageUrl?: string;
  previewSvgMarkup?: string;
  previewSvgUrl?: string;
  hasArtwork: boolean;
  hasSvgDraft: boolean;
  isApproved: boolean;
  canApprove: boolean;
  canSendToImageStudio: boolean;
  sourceLabel: string;
}

function parseSvgDimensions(svgMarkup?: string): string {
  if (!svgMarkup) return "—";
  const viewBox = svgMarkup.match(/viewBox=["']([^"']+)["']/i)?.[1];
  if (viewBox) {
    const parts = viewBox.trim().split(/\s+/).map(Number);
    if (parts.length === 4 && parts.every((n) => Number.isFinite(n))) {
      return `${Math.round(parts[2])} × ${Math.round(parts[3])} px`;
    }
  }
  const width = svgMarkup.match(/\bwidth=["']([^"']+)["']/i)?.[1];
  const height = svgMarkup.match(/\bheight=["']([^"']+)["']/i)?.[1];
  if (width && height) return `${width} × ${height}`;
  return "Vector (scalable)";
}

function detectTransparency(svgMarkup?: string): boolean {
  if (!svgMarkup) return false;
  return !/background|fill=["']#(?:fff|ffffff|white)/i.test(svgMarkup);
}

function resolvePrintReadiness(
  brief: DesignStudioBrief,
  score?: number,
  printReady?: boolean,
): string {
  if (printReady) return "Print ready";
  if (score != null && score >= 90) return "Print ready";
  if (brief.printReadinessScore >= 75) return "Print ready";
  if (score != null && score >= 75) return "Near ready";
  return "Needs refinement";
}

export function createEmptyMasterArtwork(version = "V1"): MasterArtworkState {
  return {
    status: "empty",
    version,
    sourceType: undefined,
    printMethod: undefined,
    placement: undefined,
    transparency: false,
  };
}

export function buildSvgDraftMasterArtwork(input: {
  brief: DesignStudioBrief;
  svgMarkup: string;
  version: string;
  commercialReview?: MasterArtworkCommercialPayload;
}): MasterArtworkState {
  const score = input.commercialReview?.score?.overall;
  const commercialApproved = Boolean(input.commercialReview?.approved);
  return {
    status: commercialApproved ? "in_review" : "draft",
    version: input.version,
    sourceType: "svg-draft",
    commercialScore: score,
    commercialApproved,
    printReadiness: resolvePrintReadiness(input.brief, score),
    resolutionLabel: parseSvgDimensions(input.svgMarkup),
    transparency: detectTransparency(input.svgMarkup),
    placement: input.brief.placement,
    printMethod: input.brief.productionMethod,
    generatedAt: new Date().toISOString(),
  };
}

/** @deprecated Use buildSvgDraftMasterArtwork for SVG drafts or buildAiDesignerMasterArtworkDraft for AI artwork. */
export const buildMasterArtworkDraft = buildSvgDraftMasterArtwork;

export function buildAiDesignerMasterArtworkDraft(input: {
  brief: DesignStudioBrief;
  version: string;
  artworkImageUrl: string;
  transparentPngUrl: string;
  productionPngUrl: string;
  previewUrl: string;
  selectedConceptId: string;
  designDirection: string;
  generationMode: ImageGenerationMode;
  dpi: number;
  resolution: string;
  transparentBackground: boolean;
  printReady: boolean;
  commercialReview?: MasterArtworkCommercialPayload;
}): MasterArtworkState {
  const score = input.commercialReview?.score?.overall;
  const commercialApproved = Boolean(input.commercialReview?.approved);

  return {
    status: commercialApproved ? "in_review" : "draft",
    version: input.version,
    sourceType: "ai-designer-artwork",
    commercialScore: score,
    commercialApproved,
    printReadiness: resolvePrintReadiness(input.brief, score, input.printReady),
    resolutionLabel: input.resolution,
    resolution: input.resolution,
    transparency: input.transparentBackground,
    transparentBackground: input.transparentBackground,
    placement: input.brief.placement,
    printMethod: input.brief.productionMethod,
    generatedAt: new Date().toISOString(),
    artworkImageUrl: input.artworkImageUrl,
    transparentPngUrl: input.transparentPngUrl,
    productionPngUrl: input.productionPngUrl,
    previewUrl: input.previewUrl,
    selectedConceptId: input.selectedConceptId,
    designDirection: input.designDirection,
    generationMode: input.generationMode,
    dpi: input.dpi,
    printReady: input.printReady,
  };
}

function resolveActiveArtworkUrl(state: MasterArtworkState): string | undefined {
  if (state.status === "approved") {
    return (
      state.approvedArtworkUrl ??
      state.approvedProductionFileUrl ??
      state.productionPngUrl ??
      state.artworkImageUrl ??
      state.previewUrl
    );
  }
  return (
    state.previewUrl ??
    state.artworkImageUrl ??
    state.transparentPngUrl ??
    state.productionPngUrl
  );
}

export function approveMasterArtworkState(
  assets: DesignMissionAssets,
  brief: DesignStudioBrief,
): Partial<DesignMissionAssets> {
  const state = assets.masterArtwork ?? createEmptyMasterArtwork();
  const artworkUrl = resolveActiveArtworkUrl(state);

  if (!artworkUrl?.trim() && !assets.svgMarkup?.trim()) return {};

  const productionUrl =
    state.productionPngUrl ?? state.transparentPngUrl ?? artworkUrl;

  const approvedState: MasterArtworkState = {
    ...state,
    status: "approved",
    approvedAt: new Date().toISOString(),
    approvedArtworkUrl: artworkUrl ?? state.approvedArtworkUrl,
    approvedProductionFileUrl: productionUrl ?? state.approvedProductionFileUrl,
    approvedSvgMarkup:
      state.sourceType === "svg-draft" ? assets.svgMarkup : state.approvedSvgMarkup,
    printReadiness: resolvePrintReadiness(
      brief,
      state.commercialScore ?? assets.commercialScore,
      state.printReady,
    ),
    commercialApproved: true,
  };

  if (state.sourceType === "svg-draft" && assets.svgMarkup) {
    approvedState.resolutionLabel = parseSvgDimensions(assets.svgMarkup);
    approvedState.transparency = detectTransparency(assets.svgMarkup);
  }

  approvedState.placement = brief.placement;
  approvedState.printMethod = brief.productionMethod;

  return {
    masterArtwork: approvedState,
    commercialApproved: true,
    commercialScore: approvedState.commercialScore ?? assets.commercialScore,
  };
}

export function resolveMasterArtworkSourceLabel(sourceType?: MasterArtworkSourceType): string {
  switch (sourceType) {
    case "ai-designer-artwork":
      return "AI Designer Artwork";
    case "svg-draft":
      return "SVG Draft";
    case "uploaded":
      return "Uploaded";
    default:
      return "Not generated";
  }
}

export function resolveMasterArtworkView(
  assets: DesignMissionAssets,
  versionLabel = "V1",
): MasterArtworkViewModel {
  const state = assets.masterArtwork ?? createEmptyMasterArtwork(versionLabel);
  const draftMarkup = assets.svgMarkup;
  const approvedMarkup = state.approvedSvgMarkup;

  const previewImageUrl = resolveActiveArtworkUrl(state);
  const previewSvgMarkup =
    state.sourceType === "svg-draft" && state.status !== "approved" && draftMarkup
      ? draftMarkup
      : state.status === "approved" && approvedMarkup
        ? approvedMarkup
        : undefined;
  const previewSvgUrl =
    state.sourceType === "svg-draft" && !previewSvgMarkup ? assets.svgUrl : undefined;

  const hasAiArtwork = Boolean(
    previewImageUrl?.trim() && state.sourceType === "ai-designer-artwork",
  );
  const hasSvgDraft = Boolean(
    (draftMarkup?.trim() || assets.svgUrl) &&
      (state.sourceType === "svg-draft" || !state.sourceType),
  );
  const hasArtwork = Boolean(hasAiArtwork || previewImageUrl?.trim());
  const isApproved =
    state.status === "approved" &&
    Boolean(state.approvedArtworkUrl?.trim() || state.approvedSvgMarkup?.trim());
  const canApprove = Boolean(previewImageUrl?.trim() || draftMarkup?.trim()) && !isApproved;
  const canSendToImageStudio = isApproved;

  return {
    state,
    previewImageUrl,
    previewSvgMarkup,
    previewSvgUrl,
    hasArtwork,
    hasSvgDraft,
    isApproved,
    canApprove,
    canSendToImageStudio,
    sourceLabel: resolveMasterArtworkSourceLabel(state.sourceType),
  };
}

export function resolveMasterArtworkStatusLabel(status: MasterArtworkStatus): string {
  switch (status) {
    case "empty":
      return "Not generated";
    case "draft":
      return "Draft artwork";
    case "in_review":
      return "Commercial review";
    case "approved":
      return "Approved";
    default:
      return "—";
  }
}

export async function downloadSvgAsset(svgMarkup: string, filename: string): Promise<void> {
  const blob = new Blob([svgMarkup], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename.endsWith(".svg") ? filename : `${filename}.svg`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function downloadPngFromUrl(imageUrl: string, filename: string): Promise<void> {
  const anchor = document.createElement("a");
  anchor.href = imageUrl;
  anchor.download = filename.endsWith(".png") ? filename : `${filename}.png`;
  anchor.click();
}

export async function downloadPngFromSvg(svgMarkup: string, filename: string): Promise<void> {
  const svgBlob = new Blob([svgMarkup], { type: "image/svg+xml;charset=utf-8" });
  const svgUrl = URL.createObjectURL(svgBlob);

  try {
    const image = await loadImage(svgUrl);
    const width = image.naturalWidth || 1200;
    const height = image.naturalHeight || 1200;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable");
    ctx.drawImage(image, 0, 0, width, height);
    const pngUrl = canvas.toDataURL("image/png");
    const anchor = document.createElement("a");
    anchor.href = pngUrl;
    anchor.download = filename.endsWith(".png") ? filename : `${filename}.png`;
    anchor.click();
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to render artwork for PNG export"));
    img.src = url;
  });
}

/** Handoff-safe master artwork payload for Image Studio production. */
export function buildMasterArtworkHandoffPayload(assets: DesignMissionAssets): {
  masterArtworkApproved: boolean;
  masterArtworkSourceType?: MasterArtworkSourceType;
  masterArtworkVersion?: string;
  masterArtworkArtworkUrl?: string;
  masterArtworkTransparentPngUrl?: string;
  masterArtworkProductionPngUrl?: string;
  masterArtworkApprovedArtworkUrl?: string;
  masterArtworkApprovedProductionFileUrl?: string;
  masterArtworkSvgUrl?: string;
  masterArtworkSvgMarkup?: string;
  masterArtworkPlacement?: string;
  masterArtworkPrintMethod?: string;
  masterArtworkResolution?: string;
  masterArtworkDpi?: number;
  masterArtworkGenerationMode?: ImageGenerationMode;
  masterArtworkTransparentBackground?: boolean;
  masterArtworkPrintReady?: boolean;
  masterArtworkDesignDirection?: string;
  masterArtworkCommercialScore?: number;
} {
  const view = resolveMasterArtworkView(assets);
  const state = view.state;
  const approvedArtworkUrl =
    state.approvedArtworkUrl ??
    (view.isApproved ? view.previewImageUrl : undefined);
  const approvedProductionUrl =
    state.approvedProductionFileUrl ??
    state.productionPngUrl ??
    approvedArtworkUrl;

  const markup =
    state.approvedSvgMarkup ??
    (state.sourceType === "svg-draft" ? view.previewSvgMarkup : undefined);

  return {
    masterArtworkApproved: view.isApproved,
    masterArtworkSourceType: state.sourceType,
    masterArtworkVersion: state.version,
    masterArtworkArtworkUrl: state.artworkImageUrl ?? view.previewImageUrl,
    masterArtworkTransparentPngUrl: state.transparentPngUrl,
    masterArtworkProductionPngUrl: state.productionPngUrl,
    masterArtworkApprovedArtworkUrl: approvedArtworkUrl,
    masterArtworkApprovedProductionFileUrl: approvedProductionUrl,
    masterArtworkSvgUrl: view.previewSvgUrl,
    masterArtworkSvgMarkup: view.isApproved && state.sourceType === "svg-draft" ? markup : undefined,
    masterArtworkPlacement: state.placement,
    masterArtworkPrintMethod: state.printMethod,
    masterArtworkResolution: state.resolution ?? state.resolutionLabel,
    masterArtworkDpi: state.dpi,
    masterArtworkGenerationMode: state.generationMode,
    masterArtworkTransparentBackground: state.transparentBackground,
    masterArtworkPrintReady: state.printReady,
    masterArtworkDesignDirection: state.designDirection,
    masterArtworkCommercialScore: state.commercialScore ?? assets.commercialScore,
  };
}
