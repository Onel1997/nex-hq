import type { DesignStudioBrief } from "@/agents/design/studio-brief";
import type { DesignMissionAssets } from "@/lib/design/design-mission-store";
import type { ImageGenerationMode } from "@/lib/image/image-generation-config";
import {
  sanitizePrintArtworkSvg,
  validatePrintArtworkSvg,
} from "@/lib/design/sanitize-print-artwork";

export type MasterArtworkStatus = "empty" | "draft" | "in_review" | "approved";

export type MasterArtworkSourceType =
  | "vector-artwork"
  | "ai-designer-artwork"
  | "svg-draft"
  | "uploaded";

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
  /** Vector artwork SVG — primary source for text-safe master artwork. */
  vectorSvgMarkup?: string;
  /** Text-safe vector artwork label for UI. */
  vectorArtworkLabel?: string;
  /** Kittl benchmark score from design quality layer. */
  kittlBenchmarkScore?: number;
  /** Whether typography passed text-safety validation. */
  textSafe?: boolean;
  /** Print-ready draft status from quality layer. */
  printReadyDraft?: boolean;
  /** Premium composition template applied. */
  qualityTemplateLabel?: string;
  /** Optional vector draft — secondary export support only. */
  approvedSvgMarkup?: string;
  /** Set when artwork file still contains a baked-in background. */
  transparencyWarning?: string;
  /** Set when export thresholds were not met but best candidate is shown. */
  qualityGateWarning?: string;
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
    transparency: true,
    transparentBackground: true,
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
  const { svg: sanitizedSvg } = sanitizePrintArtworkSvg(input.svgMarkup);
  const validation = validatePrintArtworkSvg(sanitizedSvg);

  return {
    status: commercialApproved ? "in_review" : "draft",
    version: input.version,
    sourceType: "svg-draft",
    commercialScore: score,
    commercialApproved,
    printReadiness: resolvePrintReadiness(input.brief, score),
    resolutionLabel: parseSvgDimensions(sanitizedSvg),
    transparency: validation.valid && detectTransparency(sanitizedSvg),
    transparentBackground: validation.valid,
    transparencyWarning: validation.valid ? undefined : validation.reason,
    placement: input.brief.placement,
    printMethod: input.brief.productionMethod,
    generatedAt: new Date().toISOString(),
  };
}

/** @deprecated Use buildSvgDraftMasterArtwork for SVG drafts or buildAiDesignerMasterArtworkDraft for AI artwork. */
export const buildMasterArtworkDraft = buildSvgDraftMasterArtwork;

export function buildVectorMasterArtworkDraft(input: {
  brief: DesignStudioBrief;
  version: string;
  svgMarkup: string;
  vectorArtworkLabel?: string;
  kittlBenchmarkScore?: number;
  textSafe?: boolean;
  printReadyDraft?: boolean;
  qualityTemplateLabel?: string;
  previewUrl?: string;
  qualityGateWarning?: string;
  selectedConceptId: string;
  designDirection: string;
  generationMode: ImageGenerationMode;
  dpi: number;
  resolution: string;
  printReady: boolean;
  commercialReview?: MasterArtworkCommercialPayload;
}): MasterArtworkState {
  const score = input.commercialReview?.score?.overall;
  const commercialApproved = Boolean(input.commercialReview?.approved);
  const { svg: sanitizedSvg } = sanitizePrintArtworkSvg(input.svgMarkup);
  const validation = validatePrintArtworkSvg(sanitizedSvg);

  return {
    status: commercialApproved ? "in_review" : "draft",
    version: input.version,
    sourceType: "vector-artwork",
    commercialScore: score,
    commercialApproved,
    printReadiness: input.printReadyDraft
      ? "Print ready"
      : resolvePrintReadiness(input.brief, score, input.printReady),
    resolutionLabel: parseSvgDimensions(sanitizedSvg),
    resolution: input.resolution,
    transparency: validation.valid,
    transparentBackground: validation.valid,
    transparencyWarning: validation.valid ? undefined : validation.reason,
    placement: input.brief.placement,
    printMethod: input.brief.productionMethod,
    generatedAt: new Date().toISOString(),
    vectorSvgMarkup: sanitizedSvg,
    vectorArtworkLabel: input.vectorArtworkLabel ?? "Premium Vector Artwork",
    kittlBenchmarkScore: input.kittlBenchmarkScore,
    textSafe: input.textSafe ?? true,
    printReadyDraft: input.printReadyDraft,
    qualityTemplateLabel: input.qualityTemplateLabel,
    previewUrl: input.previewUrl,
    qualityGateWarning: input.qualityGateWarning,
    selectedConceptId: input.selectedConceptId,
    designDirection: input.designDirection,
    generationMode: input.generationMode,
    dpi: input.dpi,
    printReady: input.printReady,
  };
}

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
  transparencyWarning?: string;
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
    transparencyWarning: input.transparencyWarning,
  };
}

function resolveActiveArtworkUrl(state: MasterArtworkState): string | undefined {
  if (state.status === "approved") {
    return (
      state.transparentPngUrl ??
      state.approvedProductionFileUrl ??
      state.approvedArtworkUrl ??
      state.productionPngUrl ??
      state.artworkImageUrl ??
      state.previewUrl
    );
  }
  return (
    state.transparentPngUrl ??
    state.productionPngUrl ??
    state.previewUrl ??
    state.artworkImageUrl
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
    state.transparentPngUrl ??
    state.productionPngUrl ??
    artworkUrl;

  const approvedState: MasterArtworkState = {
    ...state,
    status: "approved",
    approvedAt: new Date().toISOString(),
    approvedArtworkUrl: state.transparentPngUrl ?? artworkUrl ?? state.approvedArtworkUrl,
    approvedProductionFileUrl: productionUrl ?? state.approvedProductionFileUrl,
    approvedSvgMarkup:
      state.sourceType === "vector-artwork"
        ? (state.vectorSvgMarkup ?? assets.svgMarkup)
        : state.sourceType === "svg-draft"
          ? assets.svgMarkup
          : state.approvedSvgMarkup,
    printReadiness: resolvePrintReadiness(
      brief,
      state.commercialScore ?? assets.commercialScore,
      state.printReady,
    ),
    commercialApproved: true,
  };

  if (state.sourceType === "vector-artwork" && (state.vectorSvgMarkup ?? assets.svgMarkup)) {
    const markup = state.vectorSvgMarkup ?? assets.svgMarkup!;
    approvedState.resolutionLabel = parseSvgDimensions(markup);
    approvedState.transparency = detectTransparency(markup);
  } else if (state.sourceType === "svg-draft" && assets.svgMarkup) {
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
    case "vector-artwork":
      return "Vector Artwork — Text Safe";
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

/** Prefer transparent PNG URLs for export — never bake preview backgrounds into files. */
export function resolveTransparentExportUrl(state: MasterArtworkState): string | undefined {
  return (
    state.transparentPngUrl ??
    state.productionPngUrl ??
    state.approvedProductionFileUrl ??
    state.approvedArtworkUrl ??
    state.artworkImageUrl ??
    state.previewUrl
  );
}

export function resolveMasterArtworkView(
  assets: DesignMissionAssets,
  versionLabel = "V1",
): MasterArtworkViewModel {
  const state = assets.masterArtwork ?? createEmptyMasterArtwork(versionLabel);
  const draftMarkup = assets.svgMarkup;
  const approvedMarkup = state.approvedSvgMarkup;

  const previewImageUrl = resolveActiveArtworkUrl(state);
  const vectorMarkup = state.vectorSvgMarkup ?? draftMarkup;
  const previewSvgMarkup =
    (state.sourceType === "vector-artwork" || vectorMarkup) && vectorMarkup
      ? vectorMarkup
      : state.sourceType === "svg-draft" && state.status !== "approved" && draftMarkup
        ? draftMarkup
        : state.status === "approved" && approvedMarkup
          ? approvedMarkup
          : draftMarkup?.trim()
            ? draftMarkup
            : undefined;
  const previewSvgUrl =
    !previewSvgMarkup && (state.sourceType === "svg-draft" || !state.sourceType)
      ? assets.svgUrl
      : undefined;

  const hasVectorArtwork = Boolean(
    previewSvgMarkup?.trim() &&
      (state.sourceType === "vector-artwork" || state.sourceType === "svg-draft" || !state.sourceType),
  );
  const hasAiArtwork = Boolean(
    previewImageUrl?.trim() && state.sourceType === "ai-designer-artwork",
  );
  const hasSvgDraft = Boolean(
    (draftMarkup?.trim() || assets.svgUrl) &&
      (state.sourceType === "svg-draft" || !state.sourceType),
  );
  const hasArtwork = Boolean(
    hasVectorArtwork ||
      hasAiArtwork ||
      previewImageUrl?.trim() ||
      previewSvgMarkup?.trim() ||
      previewSvgUrl?.trim(),
  );
  const isApproved =
    state.status === "approved" &&
    Boolean(state.approvedArtworkUrl?.trim() || state.approvedSvgMarkup?.trim());
  const canApprove =
    Boolean(previewImageUrl?.trim() || previewSvgMarkup?.trim() || draftMarkup?.trim()) &&
    !isApproved;
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

export function resolveMasterArtworkStatusLabel(
  status: MasterArtworkStatus,
  transparencyWarning?: string,
  qualityGateWarning?: string,
): string {
  if (qualityGateWarning?.trim()) return qualityGateWarning;
  if (transparencyWarning?.trim()) return transparencyWarning;
  switch (status) {
    case "empty":
      return "Not generated";
    case "draft":
      return "Draft artwork";
    case "in_review":
      return "Commercial review";
    case "approved":
      return "Approved Master Artwork";
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
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) throw new Error("Canvas unavailable");
    ctx.clearRect(0, 0, width, height);
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
    state.transparentPngUrl ??
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
