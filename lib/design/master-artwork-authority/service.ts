import { randomUUID } from "node:crypto";
import { PersonaDomainError } from "@/lib/persona/domain/errors";
import type { WorkspaceScope } from "@/lib/persona/domain/types";
import {
  normalizeOriginalFileName,
  normalizeOwnerArtworkDisplayName,
} from "@/lib/design/artwork-display-name";
import type { MasterArtworkAuthorityRepository } from "./repository";
import { SupabaseMasterArtworkAuthorityRepository } from "./supabase-repository";
import {
  checksumMasterArtwork,
  decodeMasterArtworkUpload,
  DESIGN_MASTER_ARTWORK_MAX_BYTES,
  downloadApprovedMasterArtwork,
  uploadApprovedMasterArtwork,
} from "./storage";
import type {
  ApprovedMasterArtwork,
  ApproveMasterArtworkMeta,
  ApproveMasterArtworkRequest,
  MasterArtworkReference,
} from "./types";
import { DESIGN_ARTWORK_INCOMPLETE_OWNER_ERROR } from "./types";
import { assertMasterArtworkImageIntegrity } from "./image-integrity";

type Dependencies = {
  repository: MasterArtworkAuthorityRepository;
  upload: typeof uploadApprovedMasterArtwork;
  download: typeof downloadApprovedMasterArtwork;
  now: () => string;
  id: () => string;
};

function dependencies(overrides: Partial<Dependencies>): Dependencies {
  return {
    repository: new SupabaseMasterArtworkAuthorityRepository(),
    upload: uploadApprovedMasterArtwork,
    download: downloadApprovedMasterArtwork,
    now: () => new Date().toISOString(),
    id: randomUUID,
    ...overrides,
  };
}

function requireActor(
  scope: WorkspaceScope,
): asserts scope is WorkspaceScope & { actorId: string } {
  if (!scope.actorId) {
    throw new PersonaDomainError(
      "Authenticated owner approval is required for Master Artwork.",
      "AUTHENTICATION_REQUIRED",
    );
  }
}

export async function approveDurableMasterArtwork(
  scope: WorkspaceScope,
  request: ApproveMasterArtworkMeta,
  bytes: Buffer,
  overrides: Partial<Dependencies> = {},
): Promise<ApprovedMasterArtwork> {
  requireActor(scope);
  const deps = dependencies(overrides);
  if (!bytes.length || bytes.length > DESIGN_MASTER_ARTWORK_MAX_BYTES) {
    throw new PersonaDomainError(
      "Master Artwork is empty or exceeds the 20 MB limit.",
      "WORKFLOW",
    );
  }
  const checksum = checksumMasterArtwork(bytes);
  if (
    bytes.length !== request.expectedByteLength ||
    checksum !== request.expectedChecksumSha256
  ) {
    throw new PersonaDomainError(
      DESIGN_ARTWORK_INCOMPLETE_OWNER_ERROR,
      "WORKFLOW",
      {
        expectedByteLength: request.expectedByteLength,
        receivedByteLength: bytes.length,
        expectedChecksumSha256: request.expectedChecksumSha256,
        receivedChecksumSha256: checksum,
        integrityFailure: true,
      },
    );
  }
  assertMasterArtworkImageIntegrity(bytes, request.mimeType);
  const named = request.displayName
    ? normalizeOwnerArtworkDisplayName(request.displayName)
    : null;
  if (named && !named.ok) {
    throw new PersonaDomainError(named.error, "WORKFLOW");
  }
  const storagePath = await deps.upload({
    workspaceId: scope.workspaceId,
    designId: request.designId,
    bytes,
    checksum,
    mimeType: request.mimeType,
  });
  const now = deps.now();
  return deps.repository.createOrGet(scope, {
    contractVersion: "design-master-artwork-v1",
    id: deps.id(),
    workspaceId: scope.workspaceId,
    designId: request.designId,
    version: request.version,
    checksum,
    mimeType: request.mimeType,
    byteLength: bytes.length,
    sourceType: request.sourceType,
    storagePath,
    status: "APPROVED",
    placement: request.placement,
    printMethod: request.printMethod,
    sourceReportId: request.sourceReportId,
    sourceHandoffAt: request.sourceHandoffAt,
    displayName: named?.ok ? named.value : null,
    originalFileName: normalizeOriginalFileName(request.originalFileName),
    provenance: {
      authority: "DESIGN_STUDIO",
      humanApproved: true,
      source: request.provenance,
    },
    approvedBy: scope.actorId,
    approvedAt: now,
  });
}

/** JSON transport helper for small payloads and tests. */
export async function approveDurableMasterArtworkFromRequest(
  scope: WorkspaceScope,
  request: ApproveMasterArtworkRequest,
  overrides: Partial<Dependencies> = {},
): Promise<ApprovedMasterArtwork> {
  const bytes = decodeMasterArtworkUpload(request.contentBase64);
  const { contentBase64: _content, ...meta } = request;
  void _content;
  return approveDurableMasterArtwork(scope, meta, bytes, overrides);
}

export async function resolveApprovedMasterArtwork(
  scope: WorkspaceScope,
  reference: MasterArtworkReference,
  overrides: Partial<Dependencies> = {},
): Promise<{ artwork: ApprovedMasterArtwork; bytes: Buffer }> {
  const deps = dependencies(overrides);
  const artwork = await deps.repository.get(scope, reference.id);
  if (!artwork) {
    throw new PersonaDomainError("Approved Master Artwork was not found.", "NOT_FOUND");
  }
  if (
    artwork.status !== "APPROVED" ||
    artwork.designId !== reference.designId ||
    artwork.version !== reference.version ||
    artwork.checksum !== reference.checksum
  ) {
    throw new PersonaDomainError(
      "Master Artwork reference is stale or does not match Design authority.",
      "WORKFLOW",
    );
  }
  const bytes = await deps.download({
    workspaceId: scope.workspaceId,
    storagePath: artwork.storagePath,
    expectedChecksum: artwork.checksum,
    expectedByteLength: artwork.byteLength,
  });
  assertMasterArtworkImageIntegrity(bytes, artwork.mimeType);
  return { artwork, bytes };
}

/**
 * Resolves a browser-supplied identifier back to canonical private authority.
 * No browser-supplied path, checksum, version, or approval claim is trusted.
 */
export async function resolveApprovedMasterArtworkForHandoff(
  scope: WorkspaceScope,
  artworkId: string,
  overrides: Partial<Dependencies> = {},
): Promise<ApprovedMasterArtwork> {
  const deps = dependencies(overrides);
  const artwork = await deps.repository.get(scope, artworkId);
  if (!artwork || artwork.status !== "APPROVED") {
    throw new PersonaDomainError("Approved Master Artwork was not found.", "NOT_FOUND");
  }

  const bytes = await deps.download({
    workspaceId: scope.workspaceId,
    storagePath: artwork.storagePath,
    expectedChecksum: artwork.checksum,
    expectedByteLength: artwork.byteLength,
  });
  assertMasterArtworkImageIntegrity(bytes, artwork.mimeType);
  return artwork;
}

export async function renameApprovedMasterArtworkDisplayName(
  scope: WorkspaceScope,
  artworkId: string,
  rawName: string,
  overrides: Partial<Dependencies> = {},
): Promise<ApprovedMasterArtwork> {
  requireActor(scope);
  const normalized = normalizeOwnerArtworkDisplayName(rawName);
  if (!normalized.ok) {
    throw new PersonaDomainError(normalized.error, "WORKFLOW");
  }
  const deps = dependencies(overrides);
  const updated = await deps.repository.updateDisplayName(
    scope,
    artworkId,
    normalized.value,
  );
  if (!updated) {
    throw new PersonaDomainError("Approved Master Artwork was not found.", "NOT_FOUND");
  }
  return updated;
}
