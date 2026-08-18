import type { DesignMissionState } from "@/lib/design/design-mission-store";
import { getActiveIteration, getActiveWorkspace } from "@/lib/design/design-mission-store";
import type { ArtworkValidationResult } from "@/lib/design/artwork-validation";
import type { ArtworkFileKind } from "@/lib/design/artwork-validation";
import type {
  ApproveMasterArtworkRequest,
  ApprovedMasterArtworkView,
} from "@/lib/design/master-artwork-authority/types";
import type { DesignStudioHandoffInput } from "@/lib/image/image-handoff-store";

export {
  assertHandoffSafeForBrowserPersistence,
  DESIGN_IMAGE_HANDOFF_MAX_SERIALIZED_BYTES,
  measureHandoffSerializedBytes,
  stripHandoffTransportPayload,
} from "@/lib/image/handoff-payload-slim";

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
      "Gib das Master Artwork frei, bevor du ins Image Studio wechselst.",
    );
  }
  if (!input.hasLocalUpload) {
    throw new DesignToImageHandoffError(
      "Lade das Artwork hoch und gib es frei, bevor du ins Image Studio wechselst.",
    );
  }
  if (!input.mission?.brief.designId) {
    throw new DesignToImageHandoffError(
      "Öffne eine Design-Mission, bevor du ins Image Studio wechselst.",
    );
  }
  if (input.validation.status === "invalid") {
    throw new DesignToImageHandoffError(
      "Behebe die Artwork-Prüffehlern, bevor du ins Image Studio wechselst.",
    );
  }
  if (input.validation.status === "checking") {
    throw new DesignToImageHandoffError(
      "Warte, bis die Artwork-Prüfung abgeschlossen ist.",
    );
  }
  if (!input.validation.metadata) {
    throw new DesignToImageHandoffError(
      "Die Artwork-Metadaten fehlen. Lade die Datei erneut hoch.",
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

export function buildApproveMasterArtworkFormData(input: {
  file: Blob;
  fileName?: string;
  designId: string;
  version: string;
  reportId?: string;
  mimeType: "image/png" | "image/jpeg" | "image/webp";
  placement?: string | null;
  printMethod?: string | null;
  sourceType?: ApproveMasterArtworkRequest["sourceType"];
  displayName?: string | null;
  originalFileName?: string | null;
}): FormData {
  const form = new FormData();
  form.append(
    "file",
    input.file,
    input.fileName ?? "master-artwork.png",
  );
  form.append("designId", input.designId);
  form.append("version", input.version);
  form.append("sourceType", input.sourceType ?? "uploaded");
  if (input.reportId) form.append("sourceReportId", input.reportId);
  form.append("sourceHandoffAt", new Date().toISOString());
  if (input.placement) form.append("placement", input.placement);
  if (input.printMethod) form.append("printMethod", input.printMethod);
  form.append("mimeType", input.mimeType);
  form.append("approvalAttestation", "true");
  form.append("provenance", DESIGN_TO_IMAGE_HANDOFF_PROVENANCE);
  if (input.displayName?.trim()) form.append("displayName", input.displayName.trim());
  const originalFileName = input.originalFileName ?? input.fileName;
  if (originalFileName?.trim()) form.append("originalFileName", originalFileName.trim());
  return form;
}

export function buildDesignStudioHandoffInput(input: {
  mission: DesignMissionState;
  durableArtwork: ApprovedMasterArtworkView;
  imagePrompt?: string;
  mockupPrompt?: string;
  artworkFileName?: string;
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
    artworkFileName:
      input.artworkFileName ?? durableArtwork.originalFileName ?? undefined,
  };
}

export function parseDurableMasterArtworkResponse(payload: unknown): ApprovedMasterArtworkView {
  if (!payload || typeof payload !== "object") {
    throw new DesignToImageHandoffError(
      "Durable Master Artwork approval returned an invalid response.",
    );
  }
  const record = payload as {
    artwork?: ApprovedMasterArtworkView;
    error?: string;
    success?: boolean;
    code?: string;
    stage?: string;
  };
  if (!record.artwork) {
    const detail = [record.error, record.stage ? `stage=${record.stage}` : null, record.code]
      .filter(Boolean)
      .join(" · ");
    throw new DesignToImageHandoffError(
      detail || "Durable Master Artwork approval failed.",
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
