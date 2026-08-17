import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { PersonaDomainError } from "@/lib/persona/domain/errors";

export const DESIGN_MASTER_ARTWORK_BUCKET = "design-master-artworks";
export const DESIGN_MASTER_ARTWORK_MAX_BYTES = 20_971_520;

export function decodeMasterArtworkUpload(contentBase64: string): Buffer {
  if (/^(?:https?:|data:|\/|\.\.)/i.test(contentBase64.trim())) {
    throw new PersonaDomainError(
      "Master Artwork must be uploaded as raw base64 bytes, not a URL or storage path.",
      "WORKFLOW",
    );
  }
  const bytes = Buffer.from(contentBase64, "base64");
  if (!bytes.length || bytes.length > DESIGN_MASTER_ARTWORK_MAX_BYTES) {
    throw new PersonaDomainError(
      "Master Artwork is empty or exceeds the 20 MB limit.",
      "WORKFLOW",
    );
  }
  return bytes;
}

export function checksumMasterArtwork(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function extension(mimeType: string): string {
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/webp") return "webp";
  return "png";
}

export function buildMasterArtworkStoragePath(input: {
  workspaceId: string;
  designId: string;
  checksum: string;
  mimeType: string;
}): string {
  const safeDesign = input.designId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 100);
  return `workspace/${input.workspaceId}/designs/${safeDesign}/${input.checksum}.${extension(input.mimeType)}`;
}

export function assertMasterArtworkPathScope(
  workspaceId: string,
  storagePath: string,
): void {
  if (!storagePath.startsWith(`workspace/${workspaceId}/designs/`)) {
    throw new PersonaDomainError(
      "Master Artwork path is outside the authorized workspace.",
      "UNAUTHORIZED_WORKSPACE",
    );
  }
}

export async function uploadApprovedMasterArtwork(input: {
  workspaceId: string;
  designId: string;
  bytes: Buffer;
  checksum: string;
  mimeType: string;
}): Promise<string> {
  const storagePath = buildMasterArtworkStoragePath(input);
  assertMasterArtworkPathScope(input.workspaceId, storagePath);
  const { error } = await createAdminClient().storage
    .from(DESIGN_MASTER_ARTWORK_BUCKET)
    .upload(storagePath, input.bytes, {
      contentType: input.mimeType,
      upsert: false,
    });
  if (
    error &&
    !/already exists|duplicate|resource already exists/i.test(error.message)
  ) {
    throw new PersonaDomainError(
      `Approved Master Artwork upload failed: ${error.message}`,
      "STORAGE_UPLOAD_FAILED",
    );
  }
  return storagePath;
}

export async function downloadApprovedMasterArtwork(input: {
  workspaceId: string;
  storagePath: string;
  expectedChecksum: string;
  expectedByteLength: number;
}): Promise<Buffer> {
  assertMasterArtworkPathScope(input.workspaceId, input.storagePath);
  const { data, error } = await createAdminClient().storage
    .from(DESIGN_MASTER_ARTWORK_BUCKET)
    .download(input.storagePath);
  if (error || !data) {
    throw new PersonaDomainError(
      `Approved Master Artwork is missing from private storage: ${error?.message ?? "unknown"}`,
      "STORAGE_UPLOAD_FAILED",
    );
  }
  const bytes = Buffer.from(await data.arrayBuffer());
  if (
    bytes.length !== input.expectedByteLength ||
    checksumMasterArtwork(bytes) !== input.expectedChecksum
  ) {
    throw new PersonaDomainError(
      "Approved Master Artwork bytes do not match the durable Design authority.",
      "WORKFLOW",
    );
  }
  return bytes;
}
