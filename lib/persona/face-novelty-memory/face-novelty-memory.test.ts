/**
 * Face Novelty Memory — comprehensive test suite.
 *
 * Tests all 22 requirements from Phase 2.0A.
 * No paid provider calls: all tests use MemoryNoveltyRepository and
 * NullFaceSimilarityEvaluator.
 */

import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import { MemoryNoveltyRepository } from "./novelty-repository";
import {
  buildIdentityFingerprint,
  buildVisualFingerprint,
} from "./identity-fingerprint";
import { detectImageDuplicate, PERCEPTUAL_HASH_NEAR_DUPLICATE_THRESHOLD } from "./image-duplicate-detection";
import { NullFaceSimilarityEvaluator, resolveFaceSimilarityEvaluator } from "./face-similarity-adapter";
import {
  loadDiscoveryHistory,
  exhaustUnfinishedCandidates,
} from "./discovery-history";
import { evaluateDiscoveryNovelty } from "./novelty-policy";
import {
  registerGeneratedCandidate,
  markCandidateShown,
  markCandidateSaved,
  markCandidateShortlisted,
  markCandidateRejected,
  markCandidateApproved,
  checkAndRegisterCandidate,
  prepareDiscoveryRun,
  NOVELTY_REPLACEMENT_CONFIRMATION_MESSAGE,
} from "./novelty-service";
import type { CandidateAssetReference, FaceNoveltyRecord } from "./types";

const WS = "ws-test-001";
const WS_B = "ws-test-002";
const ARCHETYPE = "milaene_primary_male";
const PROJECT = "proj-test-001";
const PROJECT_B = "proj-test-002";
const PROVIDER = "fake";
const MODEL = "fake-v1";

function makeFingerprint(id: string) {
  return buildIdentityFingerprint({
    archetypeId: ARCHETYPE,
    blueprintId: "bp-1",
    runVariationToken: id,
    faceGeometry: `geo-${id}`,
    jawShape: `jaw-${id}`,
    noseShape: `nose-${id}`,
    eyeShape: `eye-${id}`,
  });
}

function makeRef(overrides: Partial<CandidateAssetReference> = {}): CandidateAssetReference {
  return {
    candidateId: "cand-default",
    assetId: "asset-default",
    imageChecksum: "abc123",
    storageObjectKey: "workspace/ws-test-001/persona-creation/asset-default.png",
    perceptualHash: "0000000000000000",
    ...overrides,
  };
}

async function registerAndShow(
  repo: MemoryNoveltyRepository,
  candidateId: string,
  assetId: string,
  fingerprint: string,
  imageChecksum?: string,
): Promise<FaceNoveltyRecord> {
  const record = await registerGeneratedCandidate(repo, {
    workspaceId: WS,
    archetypeId: ARCHETYPE,
    creationProjectId: PROJECT,
    candidateId,
    assetId,
    identityFingerprint: fingerprint,
    imageChecksum,
    sourceProvider: PROVIDER,
    sourceModel: MODEL,
  });
  await markCandidateShown(repo, record.id, WS);
  return record;
}

// ---------------------------------------------------------------------------
// 1. Shown candidate becomes excluded from later discovery
// ---------------------------------------------------------------------------
describe("1. shown → excluded from later discovery", () => {
  it("forbidden identity fingerprint appears in history after mark-shown", async () => {
    const repo = new MemoryNoveltyRepository();
    const fp = makeFingerprint("shown-test");
    await registerAndShow(repo, "cand-1", "asset-1", fp);
    const history = await loadDiscoveryHistory(repo, WS, ARCHETYPE);
    assert.ok(history.forbiddenIdentityFingerprints.has(fp), "shown fingerprint must be forbidden");
  });
});

// ---------------------------------------------------------------------------
// 2. Rejected candidate becomes exhausted immediately
// ---------------------------------------------------------------------------
describe("2. rejected → exhausted immediately", () => {
  it("mark-rejected transitions to exhausted and sets exhaustedAt", async () => {
    const repo = new MemoryNoveltyRepository();
    const fp = makeFingerprint("rejected-test");
    const record = await registerGeneratedCandidate(repo, {
      workspaceId: WS, archetypeId: ARCHETYPE, creationProjectId: PROJECT,
      candidateId: "cand-rej", assetId: "asset-rej",
      identityFingerprint: fp, sourceProvider: PROVIDER, sourceModel: MODEL,
    });
    await markCandidateRejected(repo, record.id, WS);
    const updated = await repo.findByCandidateId("cand-rej", WS);
    assert.equal(updated?.state, "exhausted");
    assert.ok(updated?.exhaustedAt, "exhaustedAt must be set");
  });
});

// ---------------------------------------------------------------------------
// 3. Saved candidate remains accessible but excluded from fresh discovery
// ---------------------------------------------------------------------------
describe("3. saved → excluded from fresh discovery", () => {
  it("saved fingerprint is in forbidden set", async () => {
    const repo = new MemoryNoveltyRepository();
    const fp = makeFingerprint("saved-test");
    const record = await registerGeneratedCandidate(repo, {
      workspaceId: WS, archetypeId: ARCHETYPE, creationProjectId: PROJECT,
      candidateId: "cand-saved", assetId: "asset-saved",
      identityFingerprint: fp, sourceProvider: PROVIDER, sourceModel: MODEL,
    });
    await markCandidateSaved(repo, record.id, WS);
    const history = await loadDiscoveryHistory(repo, WS, ARCHETYPE);
    assert.ok(history.forbiddenIdentityFingerprints.has(fp));
    assert.equal(history.totalSaved, 1);
  });
});

// ---------------------------------------------------------------------------
// 4. Approved face is excluded from fresh discovery
// ---------------------------------------------------------------------------
describe("4. approved → excluded from fresh discovery", () => {
  it("approved fingerprint is in forbidden set", async () => {
    const repo = new MemoryNoveltyRepository();
    const fp = makeFingerprint("approved-test");
    const record = await registerGeneratedCandidate(repo, {
      workspaceId: WS, archetypeId: ARCHETYPE, creationProjectId: PROJECT,
      candidateId: "cand-appr", assetId: "asset-appr",
      identityFingerprint: fp, sourceProvider: PROVIDER, sourceModel: MODEL,
    });
    await markCandidateApproved(repo, record.id, WS);
    const history = await loadDiscoveryHistory(repo, WS, ARCHETYPE);
    assert.ok(history.forbiddenIdentityFingerprints.has(fp));
    assert.equal(history.totalApproved, 1);
  });
});

// ---------------------------------------------------------------------------
// 5. Exact checksum duplicate is blocked
// ---------------------------------------------------------------------------
describe("5. exact checksum duplicate blocked", () => {
  it("detectImageDuplicate returns isDuplicate=true for matching checksum", () => {
    const prior = makeRef({ candidateId: "c0", assetId: "a0", imageChecksum: "deadbeef" });
    const candidate = makeRef({ candidateId: "c1", assetId: "a1", imageChecksum: "deadbeef" });
    const result = detectImageDuplicate(candidate, [prior]);
    assert.ok(result.isDuplicate);
    assert.equal(result.reason, "exact_checksum");
    assert.equal(result.matchedAssetId, "a0");
  });
});

// ---------------------------------------------------------------------------
// 6. Same storage object with different signed URL is blocked
// ---------------------------------------------------------------------------
describe("6. same storage object reuse blocked", () => {
  it("detectImageDuplicate returns isDuplicate=true for matching storageObjectKey", () => {
    const key = "workspace/ws-1/asset-foo.png";
    const prior = makeRef({ candidateId: "c0", assetId: "a0", storageObjectKey: key, imageChecksum: undefined });
    const candidate = makeRef({ candidateId: "c1", assetId: "a1", storageObjectKey: key, imageChecksum: undefined });
    const result = detectImageDuplicate(candidate, [prior]);
    assert.ok(result.isDuplicate);
    assert.equal(result.reason, "same_storage_object");
  });
});

// ---------------------------------------------------------------------------
// 7. Perceptual near-duplicate is blocked
// ---------------------------------------------------------------------------
describe("7. perceptual near-duplicate blocked", () => {
  it("detectImageDuplicate returns isDuplicate=true for near-identical hash", () => {
    // Two 64-bit hashes differing by 2 bits (well within threshold of 10)
    const hashA = "0000000000000000";
    const hashB = "0000000000000003"; // bits differ by 2
    const prior = makeRef({ candidateId: "c0", assetId: "a0", imageChecksum: undefined, storageObjectKey: undefined, perceptualHash: hashA });
    const candidate = makeRef({ candidateId: "c1", assetId: "a1", imageChecksum: undefined, storageObjectKey: undefined, perceptualHash: hashB });
    const result = detectImageDuplicate(candidate, [prior]);
    assert.ok(result.isDuplicate);
    assert.equal(result.reason, "perceptual_near_duplicate");
    assert.ok((result.perceptualDistance ?? 999) <= PERCEPTUAL_HASH_NEAR_DUPLICATE_THRESHOLD);
  });
});

// ---------------------------------------------------------------------------
// 8. Different image is allowed
// ---------------------------------------------------------------------------
describe("8. different image allowed", () => {
  it("detectImageDuplicate returns isDuplicate=false for different image", () => {
    const prior = makeRef({ candidateId: "c0", assetId: "a0", imageChecksum: "aaa", storageObjectKey: "key-aaa", perceptualHash: "0000000000000000" });
    const candidate = makeRef({ candidateId: "c1", assetId: "a1", imageChecksum: "fff", storageObjectKey: "key-fff", perceptualHash: "ffffffffffffffff" });
    const result = detectImageDuplicate(candidate, [prior]);
    assert.equal(result.isDuplicate, false);
  });
});

// ---------------------------------------------------------------------------
// 9. Old project asset cannot enter new project
// ---------------------------------------------------------------------------
describe("9. old project asset blocked via forbidden history", () => {
  it("checksum from prior project is in forbidden set", async () => {
    const repo = new MemoryNoveltyRepository();
    const fp = makeFingerprint("old-proj");
    // Register in project A (old)
    await registerAndShow(repo, "cand-old", "asset-old", fp, "old-checksum");
    const history = await loadDiscoveryHistory(repo, WS, ARCHETYPE);
    assert.ok(history.forbiddenImageChecksums.has("old-checksum"), "old project checksum must be forbidden");
  });
});

// ---------------------------------------------------------------------------
// 10. Identity fingerprint reuse is blocked
// ---------------------------------------------------------------------------
describe("10. identity fingerprint reuse blocked", () => {
  it("evaluateDiscoveryNovelty hard-rejects on matching fingerprint", async () => {
    const repo = new MemoryNoveltyRepository();
    const fp = makeFingerprint("fp-reuse");
    await registerAndShow(repo, "cand-fp1", "asset-fp1", fp);
    const history = await loadDiscoveryHistory(repo, WS, ARCHETYPE);
    const result = await evaluateDiscoveryNovelty({
      candidateId: "cand-fp2",
      assetId: "asset-fp2",
      creationProjectId: PROJECT_B,
      identityFingerprint: fp,
      assetRef: makeRef({ candidateId: "cand-fp2", assetId: "asset-fp2", imageChecksum: "new" }),
      history,
    });
    assert.ok(result.hardReject);
    assert.equal(result.hardRejectReason, "identity_fingerprint_already_consumed");
  });
});

// ---------------------------------------------------------------------------
// 11 & 12. Page reload / new browser session does not clear novelty memory
// ---------------------------------------------------------------------------
describe("11-12. persistence survives reload (in-memory simulated by re-query)", () => {
  it("records survive re-query after registration", async () => {
    const repo = new MemoryNoveltyRepository();
    const fp = makeFingerprint("persist-test");
    await registerAndShow(repo, "cand-persist", "asset-persist", fp);
    // Simulate "reload" by re-loading history from the same repo
    const history = await loadDiscoveryHistory(repo, WS, ARCHETYPE);
    assert.ok(history.forbiddenIdentityFingerprints.has(fp));
  });
});

// ---------------------------------------------------------------------------
// 13. Workspace A cannot read workspace B records
// ---------------------------------------------------------------------------
describe("13. workspace isolation", () => {
  it("workspace B history does not contain workspace A records", async () => {
    const repo = new MemoryNoveltyRepository();
    const fp = makeFingerprint("ws-isolation");
    await registerAndShow(repo, "cand-ws-a", "asset-ws-a", fp);
    const historyB = await loadDiscoveryHistory(repo, WS_B, ARCHETYPE);
    assert.equal(historyB.forbiddenIdentityFingerprints.size, 0);
    assert.equal(historyB.totalShown, 0);
  });
});

// ---------------------------------------------------------------------------
// 14. New discovery loads forbidden history first
// ---------------------------------------------------------------------------
describe("14. prepareDiscoveryRun loads history and exhausts stale candidates", () => {
  it("shown candidates are exhausted on new run start", async () => {
    const repo = new MemoryNoveltyRepository();
    const fp = makeFingerprint("prepare-run");
    const record = await registerGeneratedCandidate(repo, {
      workspaceId: WS, archetypeId: ARCHETYPE, creationProjectId: PROJECT,
      candidateId: "cand-prep", assetId: "asset-prep",
      identityFingerprint: fp, sourceProvider: PROVIDER, sourceModel: MODEL,
    });
    await markCandidateShown(repo, record.id, WS);
    // Start new discovery
    const history = await prepareDiscoveryRun(repo, WS, ARCHETYPE);
    // Fingerprint still forbidden (exhausted records remain in forbidden set)
    assert.ok(history.forbiddenIdentityFingerprints.has(fp));
    assert.equal(history.totalExhausted, 1);
    assert.equal(history.totalShown, 0);
  });
});

// ---------------------------------------------------------------------------
// 15. Duplicate slot is not displayed (hardReject=true)
// ---------------------------------------------------------------------------
describe("15. hard-rejected candidate must not be displayed", () => {
  it("checkAndRegisterCandidate returns hardReject=true for duplicate", async () => {
    const repo = new MemoryNoveltyRepository();
    const fp = makeFingerprint("dup-display");
    await registerAndShow(repo, "cand-d1", "asset-d1", fp, "checksum-dup");
    const history = await loadDiscoveryHistory(repo, WS, ARCHETYPE);
    const check = await checkAndRegisterCandidate(repo, history, {
      workspaceId: WS, archetypeId: ARCHETYPE, creationProjectId: PROJECT,
      candidateId: "cand-d2", assetId: "asset-d2",
      identityFingerprint: fp,
      imageChecksum: "checksum-dup",
      sourceProvider: PROVIDER, sourceModel: MODEL,
    });
    assert.ok(check.hardReject);
    assert.ok(check.requiresReplacementConfirmation);
  });
});

// ---------------------------------------------------------------------------
// 16. Successful unique slots are not regenerated
// ---------------------------------------------------------------------------
describe("16. unique candidate is allowed through", () => {
  it("checkAndRegisterCandidate returns hardReject=false for fresh candidate", async () => {
    const repo = new MemoryNoveltyRepository();
    const history = await loadDiscoveryHistory(repo, WS, ARCHETYPE);
    const check = await checkAndRegisterCandidate(repo, history, {
      workspaceId: WS, archetypeId: ARCHETYPE, creationProjectId: PROJECT,
      candidateId: "cand-unique", assetId: "asset-unique",
      identityFingerprint: makeFingerprint("unique-fresh"),
      imageChecksum: "fresh-checksum-xyz",
      sourceProvider: PROVIDER, sourceModel: MODEL,
    });
    assert.equal(check.hardReject, false);
    assert.equal(check.requiresReplacementConfirmation, false);
  });
});

// ---------------------------------------------------------------------------
// 17 & 18. No hidden paid replacement; replacement requires explicit confirmation
// ---------------------------------------------------------------------------
describe("17-18. replacement cost policy", () => {
  it("hardReject surfaces NOVELTY_REPLACEMENT_CONFIRMATION_MESSAGE", async () => {
    const repo = new MemoryNoveltyRepository();
    const fp = makeFingerprint("cost-policy");
    await registerAndShow(repo, "cand-cp1", "asset-cp1", fp);
    const history = await loadDiscoveryHistory(repo, WS, ARCHETYPE);
    const check = await checkAndRegisterCandidate(repo, history, {
      workspaceId: WS, archetypeId: ARCHETYPE, creationProjectId: PROJECT,
      candidateId: "cand-cp2", assetId: "asset-cp2",
      identityFingerprint: fp,
      sourceProvider: PROVIDER, sourceModel: MODEL,
    });
    assert.ok(check.hardReject);
    assert.equal(check.replacementMessage, NOVELTY_REPLACEMENT_CONFIRMATION_MESSAGE);
  });
});

// ---------------------------------------------------------------------------
// 19. Saved identity can be reopened explicitly
// ---------------------------------------------------------------------------
describe("19. saved identity remains accessible", () => {
  it("saved record is findable by candidateId", async () => {
    const repo = new MemoryNoveltyRepository();
    const fp = makeFingerprint("save-reopen");
    const record = await registerGeneratedCandidate(repo, {
      workspaceId: WS, archetypeId: ARCHETYPE, creationProjectId: PROJECT,
      candidateId: "cand-save-re", assetId: "asset-save-re",
      identityFingerprint: fp, sourceProvider: PROVIDER, sourceModel: MODEL,
    });
    await markCandidateSaved(repo, record.id, WS);
    const found = await repo.findByCandidateId("cand-save-re", WS);
    assert.ok(found);
    assert.equal(found?.state, "saved");
  });
});

// ---------------------------------------------------------------------------
// 20. A1 still starts with four confirmed image calls (pool config untouched)
// ---------------------------------------------------------------------------
describe("20. A1 casting pool config is untouched", () => {
  it("ACTIVE_CASTING_POOL still has generateCount=4 displayCount=4", async () => {
    // Dynamic import to avoid touching production path
    const { ACTIVE_CASTING_POOL } = await import("../creation/candidate-intelligence/casting-pool");
    assert.equal(ACTIVE_CASTING_POOL.generateCount, 4);
    assert.equal(ACTIVE_CASTING_POOL.displayCount, 4);
    assert.equal(ACTIVE_CASTING_POOL.mode, "generate_all_visible");
  });
});

// ---------------------------------------------------------------------------
// 21. No OpenAI/provider call occurs during this implementation
// ---------------------------------------------------------------------------
describe("21. no paid provider call in this module", () => {
  it("NullFaceSimilarityEvaluator returns not_available without any network call", async () => {
    const evaluator = new NullFaceSimilarityEvaluator();
    const result = await evaluator.evaluate({
      candidateAsset: makeRef(),
      comparisonAssets: [makeRef({ candidateId: "c0", assetId: "a0" })],
    });
    assert.equal(result.status, "not_available");
    assert.equal(result.method, "none");
  });

  it("resolveFaceSimilarityEvaluator returns NullFaceSimilarityEvaluator by default", async () => {
    const evaluator = resolveFaceSimilarityEvaluator();
    assert.ok(evaluator instanceof NullFaceSimilarityEvaluator);
  });
});

// ---------------------------------------------------------------------------
// 22. Shortlisted candidate is excluded from discovery, accessible for A2
// ---------------------------------------------------------------------------
describe("22. shortlisted → excluded from discovery, preserved for A2", () => {
  it("shortlisted fingerprint appears in forbidden set", async () => {
    const repo = new MemoryNoveltyRepository();
    const fp = makeFingerprint("shortlist-test");
    const record = await registerGeneratedCandidate(repo, {
      workspaceId: WS, archetypeId: ARCHETYPE, creationProjectId: PROJECT,
      candidateId: "cand-sl", assetId: "asset-sl",
      identityFingerprint: fp, sourceProvider: PROVIDER, sourceModel: MODEL,
    });
    await markCandidateShortlisted(repo, record.id, WS);
    const history = await loadDiscoveryHistory(repo, WS, ARCHETYPE);
    assert.ok(history.forbiddenIdentityFingerprints.has(fp));
    const found = await repo.findByCandidateId("cand-sl", WS);
    assert.equal(found?.state, "shortlisted");
  });
});

// ---------------------------------------------------------------------------
// Identity fingerprint builder
// ---------------------------------------------------------------------------
describe("buildIdentityFingerprint", () => {
  it("produces a deterministic string for the same input", () => {
    const input = { archetypeId: "arch-1", blueprintId: "bp-1", faceGeometry: "oval" };
    assert.equal(buildIdentityFingerprint(input), buildIdentityFingerprint(input));
  });

  it("produces different fingerprints for different inputs", () => {
    const a = buildIdentityFingerprint({ archetypeId: "arch-1", faceGeometry: "oval" });
    const b = buildIdentityFingerprint({ archetypeId: "arch-1", faceGeometry: "square" });
    assert.notEqual(a, b);
  });
});

// ---------------------------------------------------------------------------
// buildVisualFingerprint
// ---------------------------------------------------------------------------
describe("buildVisualFingerprint", () => {
  it("includes storage key and checksum", () => {
    const vf = buildVisualFingerprint({ storageObjectKey: "key/foo.png", imageChecksum: "abc" });
    assert.ok(vf.includes("key/foo.png"));
    assert.ok(vf.includes("abc"));
  });
});

// ---------------------------------------------------------------------------
// exhaustUnfinishedCandidates — "generated" state also exhausted
// ---------------------------------------------------------------------------
describe("exhaustUnfinishedCandidates", () => {
  it("transitions generated + shown to exhausted, leaves saved untouched", async () => {
    const repo = new MemoryNoveltyRepository();
    const fpGen = makeFingerprint("gen-exhaust");
    const fpShown = makeFingerprint("shown-exhaust");
    const fpSaved = makeFingerprint("saved-keep");

    const genRecord = await registerGeneratedCandidate(repo, {
      workspaceId: WS, archetypeId: ARCHETYPE, creationProjectId: PROJECT,
      candidateId: "cand-gen-ex", assetId: "asset-gen-ex",
      identityFingerprint: fpGen, sourceProvider: PROVIDER, sourceModel: MODEL,
    });
    const shownRecord = await registerGeneratedCandidate(repo, {
      workspaceId: WS, archetypeId: ARCHETYPE, creationProjectId: PROJECT,
      candidateId: "cand-shown-ex", assetId: "asset-shown-ex",
      identityFingerprint: fpShown, sourceProvider: PROVIDER, sourceModel: MODEL,
    });
    await markCandidateShown(repo, shownRecord.id, WS);

    const savedRecord = await registerGeneratedCandidate(repo, {
      workspaceId: WS, archetypeId: ARCHETYPE, creationProjectId: PROJECT,
      candidateId: "cand-saved-k", assetId: "asset-saved-k",
      identityFingerprint: fpSaved, sourceProvider: PROVIDER, sourceModel: MODEL,
    });
    await markCandidateSaved(repo, savedRecord.id, WS);

    const count = await exhaustUnfinishedCandidates(repo, WS, ARCHETYPE);
    assert.equal(count, 2);

    const savedFinal = await repo.findByCandidateId("cand-saved-k", WS);
    assert.equal(savedFinal?.state, "saved");
  });
});
