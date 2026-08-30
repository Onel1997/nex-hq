import type { DesignMissionState } from "@/lib/design/design-mission-store";
import { getActiveIteration, getActiveWorkspace } from "@/lib/design/design-mission-store";
import type { ArtworkValidationResult } from "@/lib/design/artwork-validation";
import type { ArtworkFileKind } from "@/lib/design/artwork-validation";
import type {
  ApproveMasterArtworkRequest,
  ApprovedMasterArtworkView,
} from "@/lib/design/master-artwork-authority/types";
import { DESIGN_MASTER_ARTWORK_BINARY_META_HEADER } from "@/lib/design/master-artwork-authority/types";
export { DESIGN_ARTWORK_INCOMPLETE_OWNER_ERROR } from "@/lib/design/master-artwork-authority/types";
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

export const DESIGN_TO_IMAGE_HANDOFF_OWNER_ERROR =
  "Artwork konnte nicht an das Image Studio übergeben werden.";
export const DESIGN_ARTWORK_APPROVAL_OWNER_ERROR =
  "Artwork-Freigabe konnte nicht gespeichert werden.";

export type DesignArtworkTransferOperation =
  | "approval_persist"
  | "authority_resolve"
  | "handoff_store"
  | "navigation";

export interface DesignArtworkTransferDiagnostic {
  operation: DesignArtworkTransferOperation;
  status?: number;
  code?: string;
  requestId?: string;
  artworkId?: string;
  designId?: string;
  version?: string;
  expectedByteLength?: number;
  receivedByteLength?: number;
  message: string;
}

export class DesignToImageHandoffError extends Error {
  readonly diagnostic?: DesignArtworkTransferDiagnostic;

  constructor(message: string, diagnostic?: DesignArtworkTransferDiagnostic) {
    super(message);
    this.name = "DesignToImageHandoffError";
    this.diagnostic = diagnostic;
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
  displayName?: string | null;
  originalFileName?: string | null;
  expectedByteLength: number;
  expectedChecksumSha256: string;
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
    displayName: input.displayName?.trim() || null,
    originalFileName: input.originalFileName?.trim() || null,
    expectedByteLength: input.expectedByteLength,
    expectedChecksumSha256: input.expectedChecksumSha256,
  };
}

export async function buildApproveMasterArtworkBinaryFetch(input: {
  bytes: Uint8Array;
  designId: string;
  version: string;
  reportId?: string;
  mimeType: "image/png" | "image/jpeg" | "image/webp";
  placement?: string | null;
  printMethod?: string | null;
  displayName?: string | null;
  originalFileName?: string | null;
}): Promise<{ url: string; init: RequestInit }> {
  const expectedChecksumSha256 = await checksumArtworkBytesForHandoff(input.bytes);
  const request = buildApproveMasterArtworkRequest({
    ...input,
    contentBase64: "AA==",
    expectedByteLength: input.bytes.byteLength,
    expectedChecksumSha256,
  });
  const { contentBase64: _content, ...meta } = request;
  void _content;
  return {
    url: "/api/design/master-artworks",
    init: {
      method: "POST",
      headers: {
        "Content-Type": input.mimeType,
        [DESIGN_MASTER_ARTWORK_BINARY_META_HEADER]: encodeURIComponent(
          JSON.stringify(meta),
        ),
      },
      body: new Blob([Uint8Array.from(input.bytes)], { type: input.mimeType }),
    },
  };
}

export function buildDesignToImageHandoffRoute(artworkId: string): string {
  return `${DESIGN_TO_IMAGE_HANDOFF_ROUTE}?artworkId=${encodeURIComponent(artworkId)}`;
}

export async function checksumArtworkBytesForHandoff(
  bytes: Uint8Array,
): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", Uint8Array.from(bytes));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function isExactDurableArtworkForUpload(input: {
  artwork: ApprovedMasterArtworkView | null | undefined;
  designId: string;
  version: string;
  checksum: string;
  mimeType: "image/png" | "image/jpeg" | "image/webp";
  byteLength: number;
}): input is typeof input & { artwork: ApprovedMasterArtworkView } {
  const artwork = input.artwork;
  return Boolean(
    artwork &&
      artwork.status === "APPROVED" &&
      artwork.designId === input.designId &&
      artwork.version === input.version &&
      artwork.checksum === input.checksum &&
      artwork.mimeType === input.mimeType &&
      artwork.byteLength === input.byteLength,
  );
}

export async function resolveCanonicalArtworkForImageHandoff(
  artworkId: string,
  fetcher: typeof fetch = fetch,
): Promise<ApprovedMasterArtworkView> {
  const response = await fetcher("/api/design/master-artworks/handoff", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ artworkId }),
  });
  const payload = (await response.json()) as {
    artwork?: ApprovedMasterArtworkView;
    error?: string;
    code?: string;
    requestId?: string;
  };
  if (!response.ok || !payload.artwork) {
    throw new DesignToImageHandoffError(DESIGN_TO_IMAGE_HANDOFF_OWNER_ERROR, {
      operation: "authority_resolve",
      status: response.status,
      code: payload.code,
      requestId: payload.requestId,
      artworkId,
      message: payload.error ?? "Canonical Artwork authority could not be resolved.",
    });
  }
  return payload.artwork;
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
  expectedChecksumSha256: string;
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
  form.append("expectedByteLength", String(input.file.size));
  form.append("expectedChecksumSha256", input.expectedChecksumSha256);
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
