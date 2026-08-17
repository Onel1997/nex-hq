import { randomUUID } from "node:crypto";
import { PersonaDomainError } from "@/lib/persona/domain/errors";
import type { WorkspaceScope } from "@/lib/persona/domain/types";
import type { MasterArtworkAuthorityRepository } from "./repository";
import { SupabaseMasterArtworkAuthorityRepository } from "./supabase-repository";
import {
  checksumMasterArtwork,
  decodeMasterArtworkUpload,
  downloadApprovedMasterArtwork,
  uploadApprovedMasterArtwork,
} from "./storage";
import type {
  ApprovedMasterArtwork,
  ApproveMasterArtworkRequest,
  MasterArtworkReference,
} from "./types";

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
  request: ApproveMasterArtworkRequest,
  overrides: Partial<Dependencies> = {},
): Promise<ApprovedMasterArtwork> {
  requireActor(scope);
  const deps = dependencies(overrides);
  const bytes = decodeMasterArtworkUpload(request.contentBase64);
  const checksum = checksumMasterArtwork(bytes);
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
    provenance: {
      authority: "DESIGN_STUDIO",
      humanApproved: true,
      source: request.provenance,
    },
    approvedBy: scope.actorId,
    approvedAt: now,
  });
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
  return { artwork, bytes };
}
