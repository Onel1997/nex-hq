import type { DesignStudioBrief } from "@/agents/design/studio-brief";
import type { DesignMissionAssets } from "@/lib/design/design-mission-store";

export type MasterArtworkStatus = "empty" | "draft" | "in_review" | "approved";

/** Canonical master artwork record — Design Studio owns creative truth. */
export interface MasterArtworkState {
  status: MasterArtworkStatus;
  version: string;
  commercialScore?: number;
  commercialApproved?: boolean;
  printReadiness?: string;
  resolutionLabel?: string;
  transparency?: boolean;
  placement?: string;
  printMethod?: string;
  generatedAt?: string;
  approvedAt?: string;
  /** Locked at approval — production source of truth for Image Studio. */
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
  previewSvgMarkup?: string;
  previewSvgUrl?: string;
  hasArtwork: boolean;
  isApproved: boolean;
  canApprove: boolean;
  canSendToImageStudio: boolean;
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

function resolvePrintReadiness(brief: DesignStudioBrief, score?: number): string {
  if (score != null && score >= 90) return "Print ready";
  if (brief.printReadinessScore >= 75) return "Print ready";
  if (score != null && score >= 75) return "Near ready";
  return "Needs refinement";
}

export function createEmptyMasterArtwork(version = "V1"): MasterArtworkState {
  return {
    status: "empty",
    version,
    printMethod: undefined,
    placement: undefined,
    transparency: false,
  };
}

export function buildMasterArtworkDraft(input: {
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

export function approveMasterArtworkState(
  assets: DesignMissionAssets,
  brief: DesignStudioBrief,
): Partial<DesignMissionAssets> {
  const svgMarkup = assets.svgMarkup;
  if (!svgMarkup?.trim()) return {};

  const current = assets.masterArtwork ?? createEmptyMasterArtwork();
  const approvedState: MasterArtworkState = {
    ...current,
    status: "approved",
    approvedAt: new Date().toISOString(),
    approvedSvgMarkup: svgMarkup,
    printReadiness: resolvePrintReadiness(brief, current.commercialScore ?? assets.commercialScore),
    resolutionLabel: parseSvgDimensions(svgMarkup),
    transparency: detectTransparency(svgMarkup),
    placement: brief.placement,
    printMethod: brief.productionMethod,
    commercialApproved: true,
  };

  return {
    masterArtwork: approvedState,
    commercialApproved: true,
    commercialScore: approvedState.commercialScore ?? assets.commercialScore,
  };
}

export function resolveMasterArtworkView(
  assets: DesignMissionAssets,
  versionLabel = "V1",
): MasterArtworkViewModel {
  const state = assets.masterArtwork ?? createEmptyMasterArtwork(versionLabel);
  const draftMarkup = assets.svgMarkup;
  const approvedMarkup = state.approvedSvgMarkup;
  const previewSvgMarkup =
    state.status === "approved" && approvedMarkup
      ? approvedMarkup
      : draftMarkup;
  const previewSvgUrl =
    state.status === "approved" && approvedMarkup
      ? undefined
      : assets.svgUrl;

  const hasArtwork = Boolean(previewSvgMarkup?.trim() || previewSvgUrl);
  const isApproved = state.status === "approved" && Boolean(state.approvedSvgMarkup?.trim());
  const canApprove = Boolean(draftMarkup?.trim()) && !isApproved;
  const canSendToImageStudio = hasArtwork && (isApproved || Boolean(assets.aiDesignerConcept));

  return {
    state,
    previewSvgMarkup,
    previewSvgUrl,
    hasArtwork,
    isApproved,
    canApprove,
    canSendToImageStudio,
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
  masterArtworkVersion?: string;
  masterArtworkSvgUrl?: string;
  masterArtworkSvgMarkup?: string;
  masterArtworkPlacement?: string;
  masterArtworkPrintMethod?: string;
  masterArtworkResolution?: string;
  masterArtworkCommercialScore?: number;
} {
  const view = resolveMasterArtworkView(assets);
  const markup =
    view.state.approvedSvgMarkup ??
    view.previewSvgMarkup;

  return {
    masterArtworkApproved: view.isApproved,
    masterArtworkVersion: view.state.version,
    masterArtworkSvgUrl: view.previewSvgUrl,
    masterArtworkSvgMarkup: view.isApproved ? markup : undefined,
    masterArtworkPlacement: view.state.placement,
    masterArtworkPrintMethod: view.state.printMethod,
    masterArtworkResolution: view.state.resolutionLabel,
    masterArtworkCommercialScore: view.state.commercialScore ?? assets.commercialScore,
  };
}
