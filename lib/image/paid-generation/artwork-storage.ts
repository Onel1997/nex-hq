import { createAdminClient } from "@/lib/supabase/admin";
import { checksumImageArtwork } from "./fingerprint";

export const IMAGE_GENERATION_INPUTS_BUCKET = "image-generation-inputs";
export const MAX_MASTER_ARTWORK_BYTES = 20 * 1024 * 1024;

export function decodeAndValidateMasterArtwork(contentBase64: string, expectedMimeType: string): Buffer {
  if (/^(data:|https?:|blob:|\/|\.\.\/)/i.test(contentBase64.trim())) {
    throw new Error("Master Artwork must be uploaded as base64 bytes; URLs and storage paths are forbidden.");
  }
  const bytes = Buffer.from(contentBase64, "base64");
  if (!bytes.length || bytes.length > MAX_MASTER_ARTWORK_BYTES) throw new Error("Master Artwork byte length is invalid.");
  if (!expectedMimeType.startsWith("image/")) throw new Error("Master Artwork must be an image.");
  return bytes;
}

export function buildFrozenArtworkPath(input: { workspaceId: string; checksum: string; extension: string }): string {
  const ext = input.extension.replace(/[^a-z0-9]/gi, "").toLowerCase() || "bin";
  return `${input.workspaceId}/master-artwork/${input.checksum}.${ext}`;
}

export async function uploadFrozenMasterArtwork(input: { workspaceId: string; bytes: Buffer; mimeType: string; checksum: string }): Promise<string> {
  if (checksumImageArtwork(input.bytes) !== input.checksum) throw new Error("Master Artwork checksum mismatch before upload.");
  const ext = input.mimeType === "image/svg+xml" ? "svg" : input.mimeType.split("/")[1]?.replace("jpeg", "jpg") ?? "bin";
  const path = buildFrozenArtworkPath({ workspaceId: input.workspaceId, checksum: input.checksum, extension: ext });
  const { error } = await createAdminClient().storage.from(IMAGE_GENERATION_INPUTS_BUCKET).upload(path, input.bytes, {
    contentType: input.mimeType, upsert: false,
  });
  if (error && !/already exists|duplicate/i.test(error.message)) throw new Error(`Master Artwork freeze failed: ${error.message}`);
  return path;
}

export async function downloadFrozenMasterArtwork(input: { workspaceId: string; storagePath: string; expectedChecksum: string; mimeType: string }) {
  if (!input.storagePath.startsWith(`${input.workspaceId}/master-artwork/`)) throw new Error("Frozen Master Artwork path is outside the authorized workspace.");
  const { data, error } = await createAdminClient().storage.from(IMAGE_GENERATION_INPUTS_BUCKET).download(input.storagePath);
  if (error || !data) throw new Error(`Frozen Master Artwork cannot be resolved: ${error?.message ?? "missing"}`);
  const bytes = Buffer.from(await data.arrayBuffer());
  if (checksumImageArtwork(bytes) !== input.expectedChecksum) throw new Error("Frozen Master Artwork checksum changed after confirmation.");
  return { bytes, mimeType: input.mimeType, checksum: input.expectedChecksum };
}
