import { createHash } from "node:crypto";

import { createAdminClient } from "@/lib/supabase/admin";
import { PersonaDomainError } from "@/lib/persona/domain/errors";

export const PRODUCT_REFERENCE_BUCKET = "product-profile-references";

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
