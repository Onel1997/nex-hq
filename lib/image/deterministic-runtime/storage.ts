import { createHash } from "node:crypto";

import { createAdminClient } from "@/lib/supabase/admin";
import { PersonaDomainError } from "@/lib/persona/domain/errors";
import { IMAGE_PRODUCTION_ASSETS_BUCKET } from "@/lib/image/production-project/asset-access";

function assertPath(workspaceId: string, path: string) {
  if (!path.startsWith(`workspace/${workspaceId}/deterministic-v2/`)) {
    throw new PersonaDomainError("Deterministic asset path is outside the workspace.", "UNAUTHORIZED_WORKSPACE");
  }
}

export async function persistDeterministicImageObject(input: {
  workspaceId: string;
  path: string;
  bytes: Buffer;
  expectedChecksum: string;
}): Promise<void> {
  assertPath(input.workspaceId, input.path);
  const actual = createHash("sha256").update(input.bytes).digest("hex");
  if (actual !== input.expectedChecksum) throw new PersonaDomainError("Deterministic output checksum mismatch before storage.", "WORKFLOW");
  const bucket = createAdminClient().storage.from(IMAGE_PRODUCTION_ASSETS_BUCKET);
  const uploaded = await bucket.upload(input.path, input.bytes, { contentType: "image/png", upsert: false });
  if (!uploaded.error) return;
  const existing = await bucket.download(input.path);
  if (existing.error || !existing.data) throw new PersonaDomainError(`Deterministic storage failed: ${uploaded.error.message}`, "STORAGE_UPLOAD_FAILED");
  const bytes = Buffer.from(await existing.data.arrayBuffer());
  if (createHash("sha256").update(bytes).digest("hex") !== input.expectedChecksum) {
    throw new PersonaDomainError("Existing deterministic object has a different checksum.", "STORAGE_UPLOAD_FAILED");
  }
}

export async function loadDeterministicImageObject(input: {
  workspaceId: string;
  path: string;
  expectedChecksum: string;
}): Promise<Buffer> {
  assertPath(input.workspaceId, input.path);
  const { data, error } = await createAdminClient().storage.from(IMAGE_PRODUCTION_ASSETS_BUCKET).download(input.path);
  if (error || !data) throw new PersonaDomainError("Stored deterministic image object is missing.", "STORAGE_UPLOAD_FAILED");
  const bytes = Buffer.from(await data.arrayBuffer());
  if (createHash("sha256").update(bytes).digest("hex") !== input.expectedChecksum) throw new PersonaDomainError("Stored deterministic image checksum mismatch.", "WORKFLOW");
  return bytes;
}
