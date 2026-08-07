/**
 * Phase 2.1E.8 — Discovery retry novelty upsert fix.
 *
 * Discovery retries reuse candidate_id. Registering novelty must update the
 * existing (workspace_id, candidate_id) row — never insert a second row
 * (Postgres 23505 on persona_face_novelty_records_workspace_candidate_unique).
 *
 * No paid provider / OpenAI calls.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { randomUUID } from "crypto";
import { MemoryNoveltyRepository } from "./novelty-repository";
import { registerGeneratedCandidate } from "./novelty-service";
import { buildIdentityFingerprint } from "./identity-fingerprint";

const WS = "ws-retry-novelty-001";
const ARCHETYPE = "milaene_primary_male";
const PROJECT = "proj-retry-novelty-001";
const CANDIDATE = "cand-retry-reuse-001";
const PROVIDER = "fake";
const MODEL = "fake-v1";

function fp(token: string) {
  return buildIdentityFingerprint({
    archetypeId: ARCHETYPE,
    blueprintId: "bp-1",
    runVariationToken: token,
    faceGeometry: `geo-${token}`,
    jawShape: `jaw-${token}`,
    noseShape: `nose-${token}`,
    eyeShape: `eye-${token}`,
  });
}

function registerInput(overrides: {
  candidateId?: string;
  assetId: string;
  identityFingerprint: string;
  imageChecksum?: string;
}) {
  return {
    workspaceId: WS,
    archetypeId: ARCHETYPE,
    creationProjectId: PROJECT,
    candidateId: overrides.candidateId ?? CANDIDATE,
    assetId: overrides.assetId,
    identityFingerprint: overrides.identityFingerprint,
    imageChecksum: overrides.imageChecksum,
    sourceProvider: PROVIDER,
    sourceModel: MODEL,
  };
}

describe("2.1E.8 discovery retry novelty upsert", () => {
  it("first discovery inserts a novelty row", async () => {
    const repo = new MemoryNoveltyRepository();
    const first = await registerGeneratedCandidate(
      repo,
      registerInput({
        assetId: "asset-first",
        identityFingerprint: fp("first"),
        imageChecksum: "checksum-first",
      }),
    );

    assert.ok(first.id, "must allocate a novelty record id");
    const found = await repo.findByCandidateId(CANDIDATE, WS);
    assert.equal(found?.id, first.id);
    assert.equal(found?.assetId, "asset-first");
    assert.equal(found?.state, "generated");

    const all = await repo.findMany({ workspaceId: WS });
    assert.equal(all.length, 1, "exactly one novelty row after first insert");
  });

  it("retry updates the existing row and reuses the same novelty id", async () => {
    const repo = new MemoryNoveltyRepository();
    const first = await registerGeneratedCandidate(
      repo,
      registerInput({
        assetId: "asset-first",
        identityFingerprint: fp("first"),
        imageChecksum: "checksum-first",
      }),
    );
    const createdAt = first.createdAt;

    const retry = await registerGeneratedCandidate(
      repo,
      registerInput({
        assetId: "asset-retry",
        identityFingerprint: fp("retry"),
        imageChecksum: "checksum-retry",
      }),
    );

    assert.equal(
      retry.id,
      first.id,
      "retry must reuse the existing novelty record id",
    );
    assert.equal(retry.createdAt, createdAt, "createdAt must be preserved");
    assert.equal(retry.assetId, "asset-retry");
    assert.equal(retry.imageChecksum, "checksum-retry");

    const all = await repo.findMany({ workspaceId: WS });
    assert.equal(all.length, 1, "retry must not create a second row");
    assert.equal(all[0].id, first.id);
    assert.equal(all[0].candidateId, CANDIDATE);
  });

  it("retry never violates workspace+candidate uniqueness", async () => {
    const repo = new MemoryNoveltyRepository();
    await registerGeneratedCandidate(
      repo,
      registerInput({
        assetId: "asset-a",
        identityFingerprint: fp("a"),
      }),
    );

    // Direct upsert with a brand-new id for the same candidate must fold
    // into the existing row (DB equivalent of avoiding 23505).
    const existing = await repo.findByCandidateId(CANDIDATE, WS);
    assert.ok(existing);

    await repo.upsert({
      ...existing,
      id: randomUUID(),
      assetId: "asset-conflict-attempt",
      identityFingerprint: fp("conflict"),
      createdAt: new Date().toISOString(),
    });

    const all = await repo.findMany({ workspaceId: WS });
    assert.equal(
      all.length,
      1,
      "must never produce a second row for the same (workspace, candidate)",
    );
    assert.equal(all[0].id, existing.id);
    assert.equal(all[0].candidateId, CANDIDATE);
    assert.equal(all[0].assetId, "asset-conflict-attempt");
  });

  it("multiple retries remain idempotent on the same novelty row", async () => {
    const repo = new MemoryNoveltyRepository();
    const first = await registerGeneratedCandidate(
      repo,
      registerInput({
        assetId: "asset-0",
        identityFingerprint: fp("0"),
        imageChecksum: "cs-0",
      }),
    );

    let lastId = first.id;
    for (let i = 1; i <= 5; i++) {
      const again = await registerGeneratedCandidate(
        repo,
        registerInput({
          assetId: `asset-${i}`,
          identityFingerprint: fp(String(i)),
          imageChecksum: `cs-${i}`,
        }),
      );
      assert.equal(again.id, first.id, `retry ${i} must keep the same id`);
      lastId = again.id;
    }

    const all = await repo.findMany({ workspaceId: WS });
    assert.equal(all.length, 1);
    assert.equal(all[0].id, lastId);
    assert.equal(all[0].assetId, "asset-5");
    assert.equal(all[0].imageChecksum, "cs-5");
    assert.equal(all[0].createdAt, first.createdAt);
  });

  it("preserves history timestamps across retries", async () => {
    const repo = new MemoryNoveltyRepository();
    const first = await registerGeneratedCandidate(
      repo,
      registerInput({
        assetId: "asset-hist",
        identityFingerprint: fp("hist"),
      }),
    );

    const shownAt = "2026-01-15T12:00:00.000Z";
    await repo.updateState(first.id, WS, "shown", { firstShownAt: shownAt });

    const retry = await registerGeneratedCandidate(
      repo,
      registerInput({
        assetId: "asset-hist-retry",
        identityFingerprint: fp("hist-retry"),
      }),
    );

    assert.equal(retry.id, first.id);
    assert.equal(retry.firstShownAt, shownAt);
    assert.equal(retry.createdAt, first.createdAt);
  });
});
