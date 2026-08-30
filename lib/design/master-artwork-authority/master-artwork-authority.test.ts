import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import { MemoryMasterArtworkAuthorityRepository } from "./memory-repository";
import {
  approveDurableMasterArtwork,
  approveDurableMasterArtworkFromRequest,
  resolveApprovedMasterArtwork,
  resolveApprovedMasterArtworkForHandoff,
} from "./service";
import {
  integrityMeta,
  VALID_TEST_PNG,
  validLargeTestPng,
} from "./test-image-fixtures";

const WS = randomUUID();
const ACTOR = randomUUID();

function request(bytes = VALID_TEST_PNG) {
  return {
    designId: "design-owner-upload",
    version: "V1",
    sourceType: "uploaded" as const,
    sourceReportId: "design-report-1",
    sourceHandoffAt: "2026-08-17T01:00:00.000Z",
    placement: "center chest",
    printMethod: "screen print",
    mimeType: "image/png" as const,
    contentBase64: bytes.toString("base64"),
    approvalAttestation: true as const,
    provenance: "Owner uploaded and explicitly approved final artwork",
    ...integrityMeta(bytes),
  };
}

describe("durable Design Master Artwork authority", () => {
  it("creates one immutable approved identity/version/checksum and replays idempotently", async () => {
    const repository = new MemoryMasterArtworkAuthorityRepository();
    const uploads: string[] = [];
    const deps = {
      repository,
      upload: async (input: { checksum: string }) => {
        uploads.push(input.checksum);
        return `workspace/${WS}/designs/design-owner-upload/${input.checksum}.png`;
      },
      now: () => "2026-08-17T01:01:00.000Z",
      id: randomUUID,
    };
    const first = await approveDurableMasterArtworkFromRequest(
      { workspaceId: WS, actorId: ACTOR },
      request(),
      deps as never,
    );
    const replay = await approveDurableMasterArtworkFromRequest(
      { workspaceId: WS, actorId: ACTOR },
      request(),
      deps as never,
    );
    assert.equal(first.id, replay.id);
    assert.equal(first.status, "APPROVED");
    assert.equal(first.sourceType, "uploaded");
    assert.equal(first.provenance.humanApproved, true);
    assert.match(first.checksum, /^[a-f0-9]{64}$/);
    assert.equal(uploads.length, 2, "deterministic storage upload may replay safely");
  });

  it("resolves only exact workspace-scoped authority and detects stale/missing objects", async () => {
    const repository = new MemoryMasterArtworkAuthorityRepository();
    const bytes = VALID_TEST_PNG;
    const approved = await approveDurableMasterArtworkFromRequest(
      { workspaceId: WS, actorId: ACTOR },
      request(),
      {
        repository,
        upload: async ({ checksum }: { checksum: string }) =>
          `workspace/${WS}/designs/design-owner-upload/${checksum}.png`,
      } as never,
    );
    const reference = {
      id: approved.id,
      designId: approved.designId,
      version: approved.version,
      checksum: approved.checksum,
    };
    const resolved = await resolveApprovedMasterArtwork(
      { workspaceId: WS, actorId: ACTOR },
      reference,
      { repository, download: async () => bytes } as never,
    );
    assert.deepEqual(resolved.bytes, bytes);
    await assert.rejects(
      () =>
        resolveApprovedMasterArtwork(
          { workspaceId: WS, actorId: ACTOR },
          { ...reference, checksum: "a".repeat(64) },
          { repository, download: async () => bytes } as never,
        ),
      /stale|does not match/i,
    );
    await assert.rejects(
      () =>
        resolveApprovedMasterArtwork(
          { workspaceId: randomUUID(), actorId: ACTOR },
          reference,
          { repository, download: async () => bytes } as never,
        ),
      /not found/i,
    );
    await assert.rejects(
      () =>
        resolveApprovedMasterArtwork(
          { workspaceId: WS, actorId: ACTOR },
          reference,
          {
            repository,
            download: async () => {
              throw new Error("private object missing");
            },
          } as never,
        ),
      /missing/i,
    );
  });

  it("resolves an approved handoff by ID without creating a row or uploading again", async () => {
    const repository = new MemoryMasterArtworkAuthorityRepository();
    const bytes = VALID_TEST_PNG;
    let uploads = 0;
    const approved = await approveDurableMasterArtworkFromRequest(
      { workspaceId: WS, actorId: ACTOR },
      request(),
      {
        repository,
        upload: async ({ checksum }: { checksum: string }) => {
          uploads += 1;
          return `workspace/${WS}/designs/design-owner-upload/${checksum}.png`;
        },
      } as never,
    );
    const resolved = await resolveApprovedMasterArtworkForHandoff(
      { workspaceId: WS, actorId: ACTOR },
      approved.id,
      {
        repository,
        download: async () => bytes,
      } as never,
    );
    assert.equal(resolved.id, approved.id);
    assert.equal(resolved.checksum, approved.checksum);
    assert.equal(uploads, 1);
    assert.equal((await repository.list({ workspaceId: WS })).length, 1);

    await assert.rejects(
      () =>
        resolveApprovedMasterArtworkForHandoff(
          { workspaceId: randomUUID(), actorId: ACTOR },
          approved.id,
          { repository, download: async () => bytes } as never,
        ),
      (error: unknown) =>
        error instanceof Error &&
        "code" in error &&
        error.code === "NOT_FOUND",
    );

    await assert.rejects(
      () =>
        resolveApprovedMasterArtworkForHandoff(
          { workspaceId: WS, actorId: ACTOR },
          approved.id,
          {
            repository,
            download: async () => {
              throw new Error("private Artwork object unavailable");
            },
          } as never,
        ),
      /private Artwork object unavailable/i,
    );
  });

  it("requires an authenticated human actor", async () => {
    await assert.rejects(
      () =>
        approveDurableMasterArtworkFromRequest(
          { workspaceId: WS },
          request(),
          { repository: new MemoryMasterArtworkAuthorityRepository() } as never,
        ),
      /authenticated owner/i,
    );
  });

  it("accepts a complete PNG larger than 10 MiB and preserves exact bytes/checksum", async () => {
    const largeBytes = validLargeTestPng();
    const repository = new MemoryMasterArtworkAuthorityRepository();
    const approved = await approveDurableMasterArtwork(
      { workspaceId: WS, actorId: ACTOR },
      {
        designId: "design-owner-upload",
        version: "V2",
        sourceType: "uploaded",
        sourceReportId: "design-report-1",
        sourceHandoffAt: "2026-08-17T01:00:00.000Z",
        placement: "center chest",
        printMethod: "screen print",
        mimeType: "image/png",
        approvalAttestation: true,
        provenance: "Large PNG approval test",
        ...integrityMeta(largeBytes),
      },
      largeBytes,
      {
        repository,
        upload: async ({ checksum }: { checksum: string }) =>
          `workspace/${WS}/designs/design-owner-upload/${checksum}.png`,
      } as never,
    );
    assert.equal(approved.byteLength, largeBytes.length);
    assert.equal(approved.checksum, integrityMeta(largeBytes).expectedChecksumSha256);
  });

  it("never approves a truncated or structurally corrupt PNG", async () => {
    const repository = new MemoryMasterArtworkAuthorityRepository();
    const complete = validLargeTestPng();
    const truncated = complete.subarray(0, 10_485_760);
    await assert.rejects(
      () =>
        approveDurableMasterArtwork(
          { workspaceId: WS, actorId: ACTOR },
          {
            designId: "design-owner-upload",
            version: "V3",
            sourceType: "uploaded",
            sourceReportId: null,
            sourceHandoffAt: "2026-08-17T01:00:00.000Z",
            placement: null,
            printMethod: null,
            mimeType: "image/png",
            approvalAttestation: true,
            provenance: "Truncation test",
            ...integrityMeta(complete),
          },
          truncated,
          { repository, upload: async () => "must-not-upload" } as never,
        ),
      /nicht vollständig hochgeladen/i,
    );
    assert.equal((await repository.list({ workspaceId: WS })).length, 0);

    const corrupt = Buffer.from(VALID_TEST_PNG);
    corrupt[corrupt.length - 1] ^= 0xff;
    await assert.rejects(
      () =>
        approveDurableMasterArtwork(
          { workspaceId: WS, actorId: ACTOR },
          {
            designId: "design-owner-upload",
            version: "V4",
            sourceType: "uploaded",
            sourceReportId: null,
            sourceHandoffAt: "2026-08-17T01:00:00.000Z",
            placement: null,
            printMethod: null,
            mimeType: "image/png",
            approvalAttestation: true,
            provenance: "Corruption test",
            ...integrityMeta(corrupt),
          },
          corrupt,
          { repository, upload: async () => "must-not-upload" } as never,
        ),
      /nicht vollständig hochgeladen/i,
    );
  });
});
