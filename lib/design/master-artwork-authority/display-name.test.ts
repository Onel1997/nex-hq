import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { randomUUID } from "node:crypto";
import { MemoryMasterArtworkAuthorityRepository } from "./memory-repository";
import {
  approveDurableMasterArtworkFromRequest,
  renameApprovedMasterArtworkDisplayName,
} from "./service";

const WS = randomUUID();
const ACTOR = randomUUID();

function request(overrides: Record<string, unknown> = {}) {
  return {
    designId: "design-owner-upload",
    version: "V1",
    sourceType: "uploaded" as const,
    sourceReportId: "design-report-1",
    sourceHandoffAt: "2026-08-17T01:00:00.000Z",
    placement: "center chest",
    printMethod: "screen print",
    mimeType: "image/png" as const,
    contentBase64: Buffer.from("owner-final-artwork").toString("base64"),
    approvalAttestation: true as const,
    provenance: "Owner uploaded and explicitly approved final artwork",
    originalFileName: "Monkey.png",
    ...overrides,
  };
}

describe("Artwork owner display name", () => {
  it("stores original filename separately from owner-facing name and keeps identity immutable on rename", async () => {
    const repository = new MemoryMasterArtworkAuthorityRepository();
    const deps = {
      repository,
      upload: async ({ checksum }: { checksum: string }) =>
        `workspace/${WS}/designs/design-owner-upload/${checksum}.png`,
      now: () => "2026-08-18T21:00:00.000Z",
      id: randomUUID,
    } as never;

    const approved = await approveDurableMasterArtworkFromRequest(
      { workspaceId: WS, actorId: ACTOR },
      request({ displayName: "  Cruising Through Time  " }),
      deps,
    );

    assert.equal(approved.displayName, "Cruising Through Time");
    assert.equal(approved.originalFileName, "Monkey.png");
    const identity = {
      id: approved.id,
      designId: approved.designId,
      version: approved.version,
      checksum: approved.checksum,
      status: approved.status,
      storagePath: approved.storagePath,
    };

    const renamed = await renameApprovedMasterArtworkDisplayName(
      { workspaceId: WS, actorId: ACTOR },
      approved.id,
      "Silent Perimeter Mark",
      { repository },
    );

    assert.equal(renamed.displayName, "Silent Perimeter Mark");
    assert.equal(renamed.originalFileName, "Monkey.png");
    assert.equal(renamed.id, identity.id);
    assert.equal(renamed.designId, identity.designId);
    assert.equal(renamed.version, identity.version);
    assert.equal(renamed.checksum, identity.checksum);
    assert.equal(renamed.status, identity.status);
    assert.equal(renamed.storagePath, identity.storagePath);

    const reloaded = await repository.get({ workspaceId: WS, actorId: ACTOR }, approved.id);
    assert.equal(reloaded?.displayName, "Silent Perimeter Mark");
    assert.equal(reloaded?.originalFileName, "Monkey.png");
    assert.equal(reloaded?.checksum, identity.checksum);
    assert.equal(reloaded?.version, identity.version);
  });

  it("rejects empty and whitespace-only Artwork names", async () => {
    const repository = new MemoryMasterArtworkAuthorityRepository();
    const approved = await approveDurableMasterArtworkFromRequest(
      { workspaceId: WS, actorId: ACTOR },
      request(),
      {
        repository,
        upload: async ({ checksum }: { checksum: string }) =>
          `workspace/${WS}/designs/design-owner-upload/${checksum}.png`,
      } as never,
    );

    await assert.rejects(
      () =>
        renameApprovedMasterArtworkDisplayName(
          { workspaceId: WS, actorId: ACTOR },
          approved.id,
          "   ",
          { repository },
        ),
      /leer/i,
    );
    await assert.rejects(
      () =>
        renameApprovedMasterArtworkDisplayName(
          { workspaceId: WS, actorId: ACTOR },
          approved.id,
          "",
          { repository },
        ),
      /leer/i,
    );
    const unchanged = await repository.get({ workspaceId: WS, actorId: ACTOR }, approved.id);
    assert.equal(unchanged?.displayName ?? null, approved.displayName ?? null);
    assert.equal(unchanged?.checksum, approved.checksum);
  });

  it("does not rename Artwork from another workspace", async () => {
    const repository = new MemoryMasterArtworkAuthorityRepository();
    const approved = await approveDurableMasterArtworkFromRequest(
      { workspaceId: WS, actorId: ACTOR },
      request({ displayName: "Cruising Through Time" }),
      {
        repository,
        upload: async ({ checksum }: { checksum: string }) =>
          `workspace/${WS}/designs/design-owner-upload/${checksum}.png`,
      } as never,
    );

    await assert.rejects(
      () =>
        renameApprovedMasterArtworkDisplayName(
          { workspaceId: randomUUID(), actorId: ACTOR },
          approved.id,
          "Stolen Name",
          { repository },
        ),
      /not found/i,
    );
  });
});
