import { createHash } from "node:crypto";
import { loadImage } from "canvas";

import { createAdminClient } from "@/lib/supabase/admin";
import { PersonaDomainError } from "@/lib/persona/domain/errors";

export const PRODUCT_REFERENCE_BUCKET = "product-profile-references";
export const MANUAL_PRODUCT_REFERENCE_MAX_BYTES = 15 * 1024 * 1024;
const MANUAL_PRODUCT_REFERENCE_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

function extensionForMime(mimeType: string): string {
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  throw new PersonaDomainError("Unsupported Product reference MIME type.", "WORKFLOW");
}

function hasExpectedSignature(bytes: Buffer, mimeType: string): boolean {
  if (mimeType === "image/png") return bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (mimeType === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes.at(-2) === 0xff && bytes.at(-1) === 0xd9;
  if (mimeType === "image/webp") return bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP";
  return false;
}

export async function validateManualProductReference(input: { bytes: Buffer; mimeType: string }) {
  const mimeType = input.mimeType.toLowerCase();
  if (!MANUAL_PRODUCT_REFERENCE_MIME_TYPES.has(mimeType)) {
    throw new PersonaDomainError("Product reference must be PNG, JPEG, or WebP.", "WORKFLOW");
  }
  if (!input.bytes.length || input.bytes.length > MANUAL_PRODUCT_REFERENCE_MAX_BYTES) {
    throw new PersonaDomainError("Product reference exceeds the 15 MB limit or is empty.", "WORKFLOW");
  }
  if (!hasExpectedSignature(input.bytes, mimeType)) {
    throw new PersonaDomainError("Product reference bytes do not match the declared MIME type.", "WORKFLOW");
  }
  try {
    const image = await loadImage(input.bytes);
    if (!image.width || !image.height) throw new Error("Missing dimensions");
    return { mimeType, width: image.width, height: image.height, byteLength: input.bytes.length };
  } catch {
    throw new PersonaDomainError("Product reference is not a decodable image.", "WORKFLOW");
  }
}

export async function persistManualProductReference(input: {
  workspaceId: string;
  productProfileId: string;
  bytes: Buffer;
  mimeType: string;
}) {
  const validated = await validateManualProductReference(input);
  const checksum = createHash("sha256").update(input.bytes).digest("hex");
  const safeProfileId = input.productProfileId.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${input.workspaceId}/product-references/manual/${safeProfileId}/${checksum}.${extensionForMime(validated.mimeType)}`;
  await persistFrozenProductReference({ workspaceId: input.workspaceId, path, bytes: input.bytes, mimeType: validated.mimeType });
  return { ...validated, checksum, path };
}

export async function createProductReferencePreview(input: {
  workspaceId: string;
  path: string;
  expiresInSeconds?: number;
}) {
  if (!input.path.startsWith(`${input.workspaceId}/product-references/`)) {
    throw new PersonaDomainError("Product reference path is outside the workspace.", "UNAUTHORIZED_WORKSPACE");
  }
  const expiresIn = Math.min(Math.max(input.expiresInSeconds ?? 900, 60), 3600);
  const { data, error } = await createAdminClient().storage.from(PRODUCT_REFERENCE_BUCKET).createSignedUrl(input.path, expiresIn);
  if (error || !data?.signedUrl) throw new PersonaDomainError("Product reference preview is unavailable.", "STORAGE_UPLOAD_FAILED");
  return { accessUrl: data.signedUrl, expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString() };
}

export async function persistFrozenProductReference(input: {
  workspaceId: string;
  path: string;
  bytes: Buffer;
  mimeType: string;
}): Promise<void> {
  if (!input.path.startsWith(`${input.workspaceId}/product-references/`)) {
    throw new PersonaDomainError("Product reference path is outside the workspace.", "UNAUTHORIZED_WORKSPACE");
  }
  const bucket = createAdminClient().storage.from(PRODUCT_REFERENCE_BUCKET);
  const uploaded = await bucket.upload(input.path, input.bytes, { contentType: input.mimeType, upsert: false });
  if (!uploaded.error) return;
  const existing = await bucket.download(input.path);
  if (existing.error || !existing.data) {
    throw new PersonaDomainError(`Product reference storage failed: ${uploaded.error.message}`, "STORAGE_UPLOAD_FAILED");
  }
  const existingBytes = Buffer.from(await existing.data.arrayBuffer());
  const expected = createHash("sha256").update(input.bytes).digest("hex");
  const actual = createHash("sha256").update(existingBytes).digest("hex");
  if (actual !== expected) {
    throw new PersonaDomainError("Existing Product reference object checksum does not match.", "STORAGE_UPLOAD_FAILED");
  }
}

export async function loadFrozenProductReference(input: {
  workspaceId: string;
  path: string;
  expectedChecksum: string;
}): Promise<Buffer> {
  if (!input.path.startsWith(`${input.workspaceId}/product-references/`)) {
    throw new PersonaDomainError("Product reference path is outside the workspace.", "UNAUTHORIZED_WORKSPACE");
  }
  const { data, error } = await createAdminClient().storage.from(PRODUCT_REFERENCE_BUCKET).download(input.path);
  if (error || !data) throw new PersonaDomainError("Frozen Product reference object is missing.", "STORAGE_UPLOAD_FAILED");
  const bytes = Buffer.from(await data.arrayBuffer());
  if (createHash("sha256").update(bytes).digest("hex") !== input.expectedChecksum) {
    throw new PersonaDomainError("Frozen Product reference checksum mismatch.", "WORKFLOW");
  }
  return bytes;
}
