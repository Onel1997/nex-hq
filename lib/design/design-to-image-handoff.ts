import type { DesignMissionState } from "@/lib/design/design-mission-store";
import { getActiveIteration, getActiveWorkspace } from "@/lib/design/design-mission-store";
import type { ArtworkValidationResult } from "@/lib/design/artwork-validation";
import type { ArtworkFileKind } from "@/lib/design/artwork-validation";
import type {
  ApproveMasterArtworkRequest,
  ApprovedMasterArtworkView,
} from "@/lib/design/master-artwork-authority/types";
import type { DesignStudioHandoffInput } from "@/lib/image/image-handoff-store";

export const DESIGN_TO_IMAGE_HANDOFF_ROUTE = "/agents/image" as const;

export const DESIGN_TO_IMAGE_HANDOFF_PROVENANCE =
  "Design Studio v2 approved upload and Continue to Image Studio action";

export class DesignToImageHandoffError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DesignToImageHandoffError";
  }
}

export interface ContinueToImageStudioContext {
  isApproved: boolean;
  hasLocalUpload: boolean;
  validation: ArtworkValidationResult;
  mission?: DesignMissionState;
}

export function assertCanContinueToImageStudio(
  input: ContinueToImageStudioContext,
): void {
  if (!input.isApproved) {
    throw new DesignToImageHandoffError(
      "Approve Master Artwork before continuing to Image Studio.",
    );
  }
  if (!input.hasLocalUpload) {
    throw new DesignToImageHandoffError(
      "Upload and approve artwork before continuing to Image Studio.",
    );
  }
  if (!input.mission?.brief.designId) {
    throw new DesignToImageHandoffError(
      "Open a Design mission before continuing to Image Studio.",
    );
  }
  if (input.validation.status === "invalid") {
    throw new DesignToImageHandoffError(
      "Fix artwork validation errors before continuing to Image Studio.",
    );
  }
  if (input.validation.status === "checking") {
    throw new DesignToImageHandoffError(
      "Wait for artwork validation to finish before continuing to Image Studio.",
    );
  }
  if (!input.validation.metadata) {
    throw new DesignToImageHandoffError(
      "Artwork metadata is missing. Re-upload the file and try again.",
    );
  }
}

export function resolveDurableHandoffMimeType(
  fileKind: ArtworkFileKind,
  mimeType: string,
): "image/png" | "image/jpeg" | "image/webp" | null {
  if (fileKind === "png" || mimeType === "image/png") return "image/png";
  if (mimeType === "image/jpeg") return "image/jpeg";
  if (mimeType === "image/webp") return "image/webp";
  if (fileKind === "svg") return "image/png";
  return null;
}

export function buildApproveMasterArtworkRequest(input: {
  designId: string;
  version: string;
  reportId?: string;
  mimeType: "image/png" | "image/jpeg" | "image/webp";
  contentBase64: string;
  placement?: string | null;
  printMethod?: string | null;
}): ApproveMasterArtworkRequest {
  return {
    designId: input.designId,
    version: input.version,
    sourceType: "uploaded",
    sourceReportId: input.reportId ?? null,
    sourceHandoffAt: new Date().toISOString(),
    placement: input.placement ?? null,
    printMethod: input.printMethod ?? null,
    mimeType: input.mimeType,
    contentBase64: input.contentBase64,
    approvalAttestation: true,
    provenance: DESIGN_TO_IMAGE_HANDOFF_PROVENANCE,
  };
}

export function buildDesignStudioHandoffInput(input: {
  mission: DesignMissionState;
  durableArtwork: ApprovedMasterArtworkView;
  imagePrompt?: string;
  mockupPrompt?: string;
}): DesignStudioHandoffInput {
  const { mission, durableArtwork } = input;
  const { brief } = mission;
  return {
    title: brief.title,
    collection: mission.collectionName ?? "",
    garment: brief.product,
    colorway: brief.color,
    version: durableArtwork.version,
    designId: durableArtwork.designId,
    reportId: mission.reportId,
    assets: mission.assets,
    aiDesignerConcept: mission.assets.aiDesignerConcept,
    renderPlan: mission.assets.aiDesignerRenderPlan,
    review: mission.assets.aiDesignerReview,
    imagePrompt: input.imagePrompt ?? brief.imagePrompt,
    mockupPrompt: input.mockupPrompt,
    durableMasterArtwork: durableArtwork,
  };
}

export function parseDurableMasterArtworkResponse(payload: unknown): ApprovedMasterArtworkView {
  if (!payload || typeof payload !== "object") {
    throw new DesignToImageHandoffError(
      "Durable Master Artwork approval returned an invalid response.",
    );
  }
  const record = payload as { artwork?: ApprovedMasterArtworkView; error?: string; success?: boolean };
  if (!record.artwork) {
    throw new DesignToImageHandoffError(
      record.error ?? "Durable Master Artwork approval failed.",
    );
  }
  return record.artwork;
}

export function assertExactDurableArtworkIdentity(
  artwork: ApprovedMasterArtworkView,
  expected: Pick<ApprovedMasterArtworkView, "id" | "designId" | "version" | "checksum">,
): void {
  if (
    artwork.id !== expected.id ||
    artwork.designId !== expected.designId ||
    artwork.version !== expected.version ||
    artwork.checksum !== expected.checksum
  ) {
    throw new DesignToImageHandoffError(
      "Durable Master Artwork identity changed during handoff.",
    );
  }
}

export function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}

export function resolveHandoffVersion(mission: DesignMissionState): string {
  const iteration = getActiveIteration(getActiveWorkspace(mission));
  return iteration ? `V${iteration.version}` : "V1";
}
