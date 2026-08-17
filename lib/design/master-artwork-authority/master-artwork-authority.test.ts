import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import { MemoryMasterArtworkAuthorityRepository } from "./memory-repository";
import {
  approveDurableMasterArtwork,
  resolveApprovedMasterArtwork,
} from "./service";

const WS = randomUUID();
const ACTOR = randomUUID();

function request(content = "owner-final-artwork") {
  return {
    designId: "design-owner-upload",
    version: "V1",
    sourceType: "uploaded" as const,
    sourceReportId: "design-report-1",
    sourceHandoffAt: "2026-08-17T01:00:00.000Z",
    placement: "center chest",
    printMethod: "screen print",
    mimeType: "image/png" as const,
    contentBase64: Buffer.from(content).toString("base64"),
    approvalAttestation: true as const,
    provenance: "Owner uploaded and explicitly approved final artwork",
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
    const first = await approveDurableMasterArtwork(
      { workspaceId: WS, actorId: ACTOR },
      request(),
      deps as never,
    );
    const replay = await approveDurableMasterArtwork(
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
    const bytes = Buffer.from("owner-final-artwork");
    const approved = await approveDurableMasterArtwork(
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
    assert.equal(resolved.bytes.toString(), "owner-final-artwork");
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

  it("requires an authenticated human actor", async () => {
    await assert.rejects(
      () =>
        approveDurableMasterArtwork(
          { workspaceId: WS },
          request(),
          { repository: new MemoryMasterArtworkAuthorityRepository() } as never,
        ),
      /authenticated owner/i,
    );
  });
});
