/**
 * Private Persona Studio reference storage.
 * Signed URLs only — never permanent public URLs.
 */

import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { PersonaDomainError } from "../domain/errors";

export const PERSONA_REFERENCES_BUCKET = "persona-references";

export const PERSONA_REFERENCE_ALLOWED_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
] as const;

export type PersonaReferenceMime =
  (typeof PERSONA_REFERENCE_ALLOWED_MIME)[number];

/** 20 MB images / short clips */
export const PERSONA_REFERENCE_MAX_BYTES = 20_971_520;
/** Signed URL TTL — 1 hour */
export const PERSONA_REFERENCE_SIGNED_URL_SECONDS = 3600;

let bucketEnsured = false;

export function buildPersonaReferenceStoragePath(params: {
  workspaceId: string;
  personaId: string;
  assetId: string;
  filename: string;
}): string {
  const safeName = params.filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
  return `workspace/${params.workspaceId}/personas/${params.personaId}/references/${params.assetId}-${safeName}`;
}

export function assertAllowedPersonaReferenceUpload(params: {
  mimeType: string;
  byteLength: number;
}): asserts params is { mimeType: PersonaReferenceMime; byteLength: number } {
  if (
    !PERSONA_REFERENCE_ALLOWED_MIME.includes(
      params.mimeType as PersonaReferenceMime,
    )
  ) {
    throw new PersonaDomainError(
      "Ungültiger Dateityp. Erlaubt: JPEG, PNG, WebP, MP4.",
      "INVALID_REFERENCE_ASSET",
      { mimeType: params.mimeType },
    );
  }
  if (params.byteLength <= 0 || params.byteLength > PERSONA_REFERENCE_MAX_BYTES) {
    throw new PersonaDomainError(
      "Datei zu groß oder leer. Maximal 20 MB erlaubt.",
      "INVALID_REFERENCE_ASSET",
      { byteLength: params.byteLength, max: PERSONA_REFERENCE_MAX_BYTES },
    );
  }
}

export function checksumBytes(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/** Minimal PNG / JPEG / WebP dimension extraction (no sharp dependency). */
export function extractImageDimensions(
  bytes: Buffer,
  mimeType: string,
): { width: number | null; height: number | null } {
  try {
    if (mimeType === "image/png" && bytes.length >= 24) {
      if (bytes.toString("ascii", 1, 4) === "PNG") {
        return {
          width: bytes.readUInt32BE(16),
          height: bytes.readUInt32BE(20),
        };
      }
    }
    if (mimeType === "image/jpeg") {
      let offset = 2;
      while (offset < bytes.length) {
        if (bytes[offset] !== 0xff) break;
        const marker = bytes[offset + 1];
        const length = bytes.readUInt16BE(offset + 2);
        if (
          marker === 0xc0 ||
          marker === 0xc1 ||
          marker === 0xc2 ||
          marker === 0xc3
        ) {
          return {
            height: bytes.readUInt16BE(offset + 5),
            width: bytes.readUInt16BE(offset + 7),
          };
        }
        offset += 2 + length;
      }
    }
    if (mimeType === "image/webp" && bytes.length >= 30) {
      if (bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") {
        const chunk = bytes.toString("ascii", 12, 16);
        if (chunk === "VP8 " && bytes.length >= 30) {
          return {
            width: bytes.readUInt16LE(26) & 0x3fff,
            height: bytes.readUInt16LE(28) & 0x3fff,
          };
        }
        if (chunk === "VP8L" && bytes.length >= 25) {
          const b0 = bytes[21];
          const b1 = bytes[22];
          const b2 = bytes[23];
          const b3 = bytes[24];
          return {
            width: 1 + (((b1 & 0x3f) << 8) | b0),
            height: 1 + (((b3 & 0xf) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6)),
          };
        }
      }
    }
  } catch {
    // fall through
  }
  return { width: null, height: null };
}

export async function ensurePersonaReferencesBucket(): Promise<void> {
  if (bucketEnsured) return;
  const supabase = createAdminClient();
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) {
    throw new PersonaDomainError(
      `Speicher-Setup fehlgeschlagen: ${listError.message}`,
      "STORAGE_UPLOAD_FAILED",
    );
  }
  const exists = buckets?.some((b) => b.id === PERSONA_REFERENCES_BUCKET);
  if (!exists) {
    const { error: createError } = await supabase.storage.createBucket(
      PERSONA_REFERENCES_BUCKET,
      {
        public: false,
        fileSizeLimit: PERSONA_REFERENCE_MAX_BYTES,
        allowedMimeTypes: [...PERSONA_REFERENCE_ALLOWED_MIME],
      },
    );
    if (createError) {
      throw new PersonaDomainError(
        `Speicher-Setup fehlgeschlagen: ${createError.message}`,
        "STORAGE_UPLOAD_FAILED",
      );
    }
  }
  bucketEnsured = true;
}

export async function uploadPersonaReferenceBytes(params: {
  workspaceId: string;
  personaId: string;
  assetId: string;
  filename: string;
  bytes: Buffer;
  mimeType: string;
}): Promise<{ storagePath: string; checksum: string; width: number | null; height: number | null }> {
  assertAllowedPersonaReferenceUpload({
    mimeType: params.mimeType,
    byteLength: params.bytes.length,
  });

  // Path must stay within the caller's workspace — never accept client-supplied paths.
  if (!params.workspaceId || !params.personaId) {
    throw new PersonaDomainError(
      "Unbefugter Speicherzugriff.",
      "UNAUTHORIZED_WORKSPACE",
    );
  }

  await ensurePersonaReferencesBucket();
  const storagePath = buildPersonaReferenceStoragePath(params);
  if (!storagePath.startsWith(`workspace/${params.workspaceId}/`)) {
    throw new PersonaDomainError(
      "Unbefugter Speicherzugriff.",
      "UNAUTHORIZED_WORKSPACE",
    );
  }

  const supabase = createAdminClient();
  const { error } = await supabase.storage
    .from(PERSONA_REFERENCES_BUCKET)
    .upload(storagePath, params.bytes, {
      contentType: params.mimeType,
      upsert: false,
    });

  if (error) {
    throw new PersonaDomainError(
      `Upload fehlgeschlagen: ${error.message}`,
      "STORAGE_UPLOAD_FAILED",
      { storagePath },
    );
  }

  const dims = extractImageDimensions(params.bytes, params.mimeType);
  return {
    storagePath,
    checksum: checksumBytes(params.bytes),
    width: dims.width,
    height: dims.height,
  };
}

export async function createPersonaReferenceSignedUrl(
  storagePath: string,
  expiresIn = PERSONA_REFERENCE_SIGNED_URL_SECONDS,
): Promise<{ signedUrl: string; expiresAt: string }> {
  await ensurePersonaReferencesBucket();
  const supabase = createAdminClient();
  const { data, error } = await supabase.storage
    .from(PERSONA_REFERENCES_BUCKET)
    .createSignedUrl(storagePath, expiresIn);

  if (error || !data?.signedUrl) {
    throw new PersonaDomainError(
      `Signierte URL fehlgeschlagen: ${error?.message ?? "unknown"}`,
      "STORAGE_UPLOAD_FAILED",
    );
  }

  return {
    signedUrl: data.signedUrl,
    expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
  };
}

export async function deletePersonaReferenceObject(
  storagePath: string,
): Promise<void> {
  await ensurePersonaReferencesBucket();
  const supabase = createAdminClient();
  const { error } = await supabase.storage
    .from(PERSONA_REFERENCES_BUCKET)
    .remove([storagePath]);
  if (error) {
    throw new PersonaDomainError(
      `Löschen fehlgeschlagen: ${error.message}`,
      "STORAGE_UPLOAD_FAILED",
    );
  }
}

/** Test helper — never expose public permanent URLs from this module. */
export function isPublicPermanentPersonaUrl(url: string): boolean {
  return /\/storage\/v1\/object\/public\/persona-references\//.test(url);
}
