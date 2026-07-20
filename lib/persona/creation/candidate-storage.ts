/**
 * Private candidate asset paths inside persona-references bucket.
 * workspace/{workspaceId}/persona-creation/{projectId}/candidates/{candidateId}/...
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { PersonaDomainError } from "../domain/errors";
import {
  PERSONA_REFERENCES_BUCKET,
  assertAllowedPersonaReferenceUpload,
  checksumBytes,
  createPersonaReferenceSignedUrl,
  ensurePersonaReferencesBucket,
  extractImageDimensions,
} from "../storage/reference-storage";

export function buildPersonaCandidateStoragePath(params: {
  workspaceId: string;
  projectId: string;
  candidateId: string;
  assetId: string;
  filename: string;
}): string {
  const safeName = params.filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
  return `workspace/${params.workspaceId}/persona-creation/${params.projectId}/candidates/${params.candidateId}/${params.assetId}-${safeName}`;
}

/** Memory-repo / automated tests — private path metadata without Supabase I/O. */
export function buildPersonaCandidateAssetMetadata(params: {
  workspaceId: string;
  projectId: string;
  candidateId: string;
  assetId: string;
  filename: string;
  bytes: Buffer;
  mimeType: string;
}): {
  storagePath: string;
  checksum: string;
  width: number | null;
  height: number | null;
} {
  assertAllowedPersonaReferenceUpload({
    mimeType: params.mimeType,
    byteLength: params.bytes.length,
  });

  if (!params.workspaceId || !params.projectId || !params.candidateId) {
    throw new PersonaDomainError(
      "Unbefugter Speicherzugriff.",
      "UNAUTHORIZED_WORKSPACE",
    );
  }

  const storagePath = buildPersonaCandidateStoragePath(params);
  if (!storagePath.startsWith(`workspace/${params.workspaceId}/persona-creation/`)) {
    throw new PersonaDomainError(
      "Unbefugter Speicherzugriff.",
      "UNAUTHORIZED_WORKSPACE",
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

export async function uploadPersonaCandidateBytes(params: {
  workspaceId: string;
  projectId: string;
  candidateId: string;
  assetId: string;
  filename: string;
  bytes: Buffer;
  mimeType: string;
}): Promise<{
  storagePath: string;
  checksum: string;
  width: number | null;
  height: number | null;
}> {
  assertAllowedPersonaReferenceUpload({
    mimeType: params.mimeType,
    byteLength: params.bytes.length,
  });

  if (!params.workspaceId || !params.projectId || !params.candidateId) {
    throw new PersonaDomainError(
      "Unbefugter Speicherzugriff.",
      "UNAUTHORIZED_WORKSPACE",
    );
  }

  await ensurePersonaReferencesBucket();
  const storagePath = buildPersonaCandidateStoragePath(params);
  if (!storagePath.startsWith(`workspace/${params.workspaceId}/persona-creation/`)) {
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

export async function createPersonaCandidateSignedUrl(
  storagePath: string,
  expiresIn?: number,
) {
  return createPersonaReferenceSignedUrl(storagePath, expiresIn);
}

/** Copy/link candidate object into persona reference path (same private bucket). */
export async function copyCandidateAssetToPersonaReference(params: {
  sourceStoragePath: string;
  workspaceId: string;
  personaId: string;
  assetId: string;
  filename: string;
}): Promise<string> {
  await ensurePersonaReferencesBucket();
  const dest = `workspace/${params.workspaceId}/personas/${params.personaId}/references/${params.assetId}-${params.filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120)}`;
  if (!params.sourceStoragePath.startsWith(`workspace/${params.workspaceId}/`)) {
    throw new PersonaDomainError(
      "Unbefugter Speicherzugriff.",
      "UNAUTHORIZED_WORKSPACE",
    );
  }

  const supabase = createAdminClient();
  const { error } = await supabase.storage
    .from(PERSONA_REFERENCES_BUCKET)
    .copy(params.sourceStoragePath, dest);

  if (error) {
    throw new PersonaDomainError(
      `Kopieren fehlgeschlagen: ${error.message}`,
      "STORAGE_UPLOAD_FAILED",
      { source: params.sourceStoragePath, dest },
    );
  }
  return dest;
}

/** Default retention for rejected/archived candidate assets: 30 days. */
export function defaultCandidateRetentionUntil(from = new Date()): string {
  const d = new Date(from);
  d.setDate(d.getDate() + 30);
  return d.toISOString();
}
