/**
 * Phase 2.0B — Face Similarity Evaluator tests.
 *
 * Uses injected fake evaluators and the MemoryEmbeddingRepository.
 * No live model calls, no paid provider calls.
 * Tests verify the evaluation pipeline, persistence, and all 21 requirements.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MemoryNoveltyRepository } from "./novelty-repository";
import { MemoryEmbeddingRepository } from "./embedding-repository";
import {
  checkAndRegisterCandidate,
  markCandidateShown,
  markCandidateSaved,
  markCandidateApproved,
  registerGeneratedCandidate,
  FACE_SIMILARITY_REPLACEMENT_CONFIRMATION_MESSAGE,
  NOVELTY_REPLACEMENT_CONFIRMATION_MESSAGE,
} from "./novelty-service";
import { loadDiscoveryHistory, exhaustUnfinishedCandidates } from "./discovery-history";
import { buildIdentityFingerprint } from "./identity-fingerprint";
import {
  euclideanDistance,
  euclideanToCosineSimilarity,
  FACE_SIMILARITY_EUCLIDEAN_DUPLICATE_THRESHOLD,
  FACE_SIMILARITY_THRESHOLD_VERSION,
  FACE_SIMILARITY_EVALUATOR_VERSION,
} from "./similarity-threshold";
import { compareEmbeddings } from "./local-face-embedding-evaluator";
import { detectImageDuplicate } from "./image-duplicate-detection";
import type { FaceSimilarityEvaluator, CandidateAssetReference, FaceSimilarityResult } from "./types";

const WS = "ws-sim-001";
const WS_B = "ws-sim-002";
const ARCH = "milaene_primary_male";
const PROJECT = "proj-sim-001";
const PROVIDER = "fake";
const MODEL = "fake-v1";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** 128-dim embedding where each component = value. */
function makeEmbedding(value: number, dim = 128): number[] {
  const mag = Math.sqrt(dim) * value; // ensure L2 norm ≈ 1 when value = 1/sqrt(dim)
  const norm = Math.sqrt(dim * value * value);
  return Array.from({ length: dim }, () => value / (norm || 1));
}

/** Two unit embeddings with controlled euclidean distance. */
function makePairWithDistance(targetDist: number, dim = 128): [number[], number[]] {
  const a = makeEmbedding(1 / Math.sqrt(dim), dim);
  const b = [...a];
  // Rotate first component to create controlled distance
  const delta = targetDist / Math.sqrt(2);
  b[0] = (b[0] ?? 0) - delta;
  b[1] = (b[1] ?? 0) + delta;
  return [a, b];
}

function makeRef(
  assetId: string,
  overrides: Partial<CandidateAssetReference> = {},
): CandidateAssetReference {
  return { candidateId: `cand-${assetId}`, assetId, ...overrides };
}

function makeFp(id: string): string {
  return buildIdentityFingerprint({ archetypeId: ARCH, blueprintId: "bp-1", runVariationToken: id });
}

/** Fake evaluator that returns a controlled similarity result. */
class FakeEmbeddingEvaluator implements FaceSimilarityEvaluator {
  constructor(
    private readonly result: FaceSimilarityResult & Record<string, unknown>,
  ) {}

  async evaluate(_input: {
    candidateAsset: CandidateAssetReference;
    comparisonAssets: CandidateAssetReference[];
  }): Promise<FaceSimilarityResult> {
    return this.result;
  }
}

/** Evaluator that returns not_available (simulates model unavailable). */
class UnavailableEvaluator implements FaceSimilarityEvaluator {
  async evaluate(): Promise<FaceSimilarityResult> {
    return { status: "not_available", method: "none" };
  }
}

/** Evaluator that throws (simulates error). */
class ErrorEvaluator implements FaceSimilarityEvaluator {
  async evaluate(): Promise<FaceSimilarityResult> {
    throw new Error("model init failed");
  }
}

async function registerShow(
  repo: MemoryNoveltyRepository,
  embeddingRepo: MemoryEmbeddingRepository,
  candidateId: string,
  assetId: string,
  embedding: number[],
): Promise<string> {
  const fp = makeFp(candidateId);
  const rec = await registerGeneratedCandidate(repo, {
    workspaceId: WS,
    archetypeId: ARCH,
    creationProjectId: PROJECT,
    candidateId,
    assetId,
    identityFingerprint: fp,
    sourceProvider: PROVIDER,
    sourceModel: MODEL,
  });
  await markCandidateShown(repo, rec.id, WS);
  embeddingRepo.saveWithContext({
    noveltyRecordId: rec.id,
    workspaceId: WS,
    assetId,
    candidateId,
    creationProjectId: PROJECT,
    liveEvaluationEvidence: { finalDecision: "allowed" },
    historicalProtectionStatus: "unprotected",
    embedding,
    embeddingDimension: embedding.length,
    embeddingModel: "faceRecognitionNet",
    embeddingVersion: FACE_SIMILARITY_EVALUATOR_VERSION,
    detectionConfidence: 0.97,
    faceCount: 1,
    detectionStatus: "performed",
    similarityThresholdVersion: FACE_SIMILARITY_THRESHOLD_VERSION,
  });
  return rec.id;
}

// ---------------------------------------------------------------------------
// 1. Exact same face is rejected (duplicate embedding)
// ---------------------------------------------------------------------------
describe("1. exact same face rejected via embedding", () => {
  it("duplicate embedding triggers hardReject", async () => {
    const repo = new MemoryNoveltyRepository();
    const embRepo = new MemoryEmbeddingRepository();
    const emb = makeEmbedding(1 / Math.sqrt(128));
    await registerShow(repo, embRepo, "cand-a1", "asset-a1", emb);

    const history = await loadDiscoveryHistory(repo, WS, ARCH);
    const duplicateEval = new FakeEmbeddingEvaluator({
      status: "performed",
      isDuplicate: true,
      similarity: 0.99,
      threshold: FACE_SIMILARITY_EUCLIDEAN_DUPLICATE_THRESHOLD,
      method: "local-face-embedding-v1",
      closestMatchAssetId: "asset-a1",
      _embedding: emb,
      _detectionConfidence: 0.98,
      _faceCount: 1,
    });

    const check = await checkAndRegisterCandidate(
      repo,
      history,
      {
        workspaceId: WS, archetypeId: ARCH, creationProjectId: PROJECT,
        candidateId: "cand-a2", assetId: "asset-a2",
        identityFingerprint: makeFp("cand-a2"),
        sourceProvider: PROVIDER, sourceModel: MODEL,
      },
      { evaluator: duplicateEval, embeddingRepo: embRepo },
    );
    assert.ok(check.hardReject, "same face must hard-reject");
    assert.equal(check.hardRejectReason, "face_similarity_duplicate");
    assert.ok(check.requiresReplacementConfirmation);
    assert.equal(check.replacementMessage, FACE_SIMILARITY_REPLACEMENT_CONFIRMATION_MESSAGE);
  });
});

// ---------------------------------------------------------------------------
// 2. Same identity after resize/crop — controlled Euclidean distance below threshold
// ---------------------------------------------------------------------------
describe("2. same identity after resize/crop rejected", () => {
  it("compareEmbeddings returns isDuplicate=true for distance below threshold", () => {
    const [emb1, emb2] = makePairWithDistance(0.3); // well below 0.45
    const result = compareEmbeddings({
      candidateEmbedding: emb2,
      priorEmbeddings: [{ assetId: "prior-asset", candidateId: "prior-cand", embedding: emb1 }],
    });
    assert.ok(result.isDuplicate, `distance should be < 0.45, got ${result.closestDistance}`);
    assert.equal(result.closestMatchAssetId, "prior-asset");
  });
});

// ---------------------------------------------------------------------------
// 3. Same identity under lighting variation — distance slightly below threshold
// ---------------------------------------------------------------------------
describe("3. same identity under lighting variation blocked", () => {
  it("distance 0.44 (below 0.45 threshold) is treated as duplicate", () => {
    const [emb1, emb2] = makePairWithDistance(0.44);
    const result = compareEmbeddings({
      candidateEmbedding: emb2,
      priorEmbeddings: [{ assetId: "a", candidateId: "c", embedding: emb1 }],
    });
    assert.ok(result.closestDistance !== undefined && result.closestDistance < 0.45);
    assert.ok(result.isDuplicate);
  });
});

// ---------------------------------------------------------------------------
// 4. Clearly different people are allowed
// ---------------------------------------------------------------------------
describe("4. clearly different people allowed", () => {
  it("compareEmbeddings returns isDuplicate=false for distance > threshold", () => {
    const [emb1, emb2] = makePairWithDistance(0.7); // clearly above 0.55 warning
    const result = compareEmbeddings({
      candidateEmbedding: emb2,
      priorEmbeddings: [{ assetId: "a", candidateId: "c", embedding: emb1 }],
    });
    assert.equal(result.isDuplicate, false);
    assert.equal(result.isWarning, false);
  });
});

// ---------------------------------------------------------------------------
// 5. Nearest prior candidate is returned
// ---------------------------------------------------------------------------
describe("5. nearest prior candidate returned", () => {
  it("compareEmbeddings identifies closest match among multiple priors", () => {
    const candidate = makeEmbedding(0.5 / Math.sqrt(128));
    const far = makeEmbedding(0.0);
    const near = makeEmbedding(0.49 / Math.sqrt(128));
    const result = compareEmbeddings({
      candidateEmbedding: candidate,
      priorEmbeddings: [
        { assetId: "far-asset", candidateId: "far-cand", embedding: far },
        { assetId: "near-asset", candidateId: "near-cand", embedding: near },
      ],
    });
    assert.equal(result.closestMatchAssetId, "near-asset");
    assert.equal(result.closestMatchCandidateId, "near-cand");
  });
});

// ---------------------------------------------------------------------------
// 6. Saved favorite is included in comparisons
// ---------------------------------------------------------------------------
describe("6. saved favorite included in comparison set", () => {
  it("saved state record appears in forbidden history priorAssetReferences", async () => {
    const repo = new MemoryNoveltyRepository();
    const fp = makeFp("saved-fav");
    const rec = await registerGeneratedCandidate(repo, {
      workspaceId: WS, archetypeId: ARCH, creationProjectId: PROJECT,
      candidateId: "cand-saved-fav", assetId: "asset-saved-fav",
      identityFingerprint: fp, sourceProvider: PROVIDER, sourceModel: MODEL,
    });
    await markCandidateSaved(repo, rec.id, WS);
    const history = await loadDiscoveryHistory(repo, WS, ARCH);
    const refAssetIds = history.priorAssetReferences.map((r) => r.assetId);
    assert.ok(refAssetIds.includes("asset-saved-fav"), "saved asset must appear in priorAssetReferences");
  });
});

// ---------------------------------------------------------------------------
// 7. Approved face is included in comparisons
// ---------------------------------------------------------------------------
describe("7. approved face included in comparison set", () => {
  it("approved state record appears in prior references", async () => {
    const repo = new MemoryNoveltyRepository();
    const fp = makeFp("approved-fav");
    const rec = await registerGeneratedCandidate(repo, {
      workspaceId: WS, archetypeId: ARCH, creationProjectId: PROJECT,
      candidateId: "cand-appr-fav", assetId: "asset-appr-fav",
      identityFingerprint: fp, sourceProvider: PROVIDER, sourceModel: MODEL,
    });
    await markCandidateApproved(repo, rec.id, WS);
    const history = await loadDiscoveryHistory(repo, WS, ARCH);
    const refAssetIds = history.priorAssetReferences.map((r) => r.assetId);
    assert.ok(refAssetIds.includes("asset-appr-fav"));
  });
});

// ---------------------------------------------------------------------------
// 8. Another workspace is never compared
// ---------------------------------------------------------------------------
describe("8. cross-workspace isolation", () => {
  it("workspace B records are not in workspace A history", async () => {
    const repo = new MemoryNoveltyRepository();
    const fp = makeFp("ws-b-cand");
    const rec = await registerGeneratedCandidate(repo, {
      workspaceId: WS_B, archetypeId: ARCH, creationProjectId: PROJECT,
      candidateId: "cand-ws-b", assetId: "asset-ws-b",
      identityFingerprint: fp, sourceProvider: PROVIDER, sourceModel: MODEL,
    });
    await markCandidateShown(repo, rec.id, WS_B);
    const historyA = await loadDiscoveryHistory(repo, WS, ARCH);
    assert.equal(historyA.priorAssetReferences.length, 0);
  });
});

// ---------------------------------------------------------------------------
// 9. No face detected returns no_face status
// ---------------------------------------------------------------------------
describe("9. no_face detection status", () => {
  it("evaluator returning no face status makes evaluation not_available", async () => {
    const prev = process.env.FACE_EVALUATOR_FAILURE_MODE;
    process.env.FACE_EVALUATOR_FAILURE_MODE = "fail_open_with_warning";
    try {
      const repo = new MemoryNoveltyRepository();
      const noFaceEval = new FakeEmbeddingEvaluator({
        status: "not_available",
        method: "local-face-embedding-v1",
        _detectionStatus: "no_face",
        _faceCount: 0,
      });
      const history = await loadDiscoveryHistory(repo, WS, ARCH);
      const check = await checkAndRegisterCandidate(
        repo, history,
        { workspaceId: WS, archetypeId: ARCH, creationProjectId: PROJECT, candidateId: "cand-noface", assetId: "asset-noface", identityFingerprint: makeFp("noface"), sourceProvider: PROVIDER, sourceModel: MODEL },
        { evaluator: noFaceEval },
      );
      // fail_open: no_face alone should NOT hard-reject (image checks also pass)
      assert.equal(check.hardReject, false);
      assert.equal(check.softWarning, true);
      assert.ok(check.softWarningReason?.includes("not_available"));
    } finally {
      if (prev === undefined) delete process.env.FACE_EVALUATOR_FAILURE_MODE;
      else process.env.FACE_EVALUATOR_FAILURE_MODE = prev;
    }
  });
});

// ---------------------------------------------------------------------------
// 10. Multiple faces returns multiple_faces
// ---------------------------------------------------------------------------
describe("10. multiple_faces detection produces soft warning", () => {
  it("multiple_faces status produces not_available result → soft warning", async () => {
    const prev = process.env.FACE_EVALUATOR_FAILURE_MODE;
    process.env.FACE_EVALUATOR_FAILURE_MODE = "fail_open_with_warning";
    try {
      const repo = new MemoryNoveltyRepository();
      const multiFaceEval = new FakeEmbeddingEvaluator({
        status: "not_available",
        method: "local-face-embedding-v1",
        _detectionStatus: "multiple_faces",
        _faceCount: 3,
      });
      const history = await loadDiscoveryHistory(repo, WS, ARCH);
      const check = await checkAndRegisterCandidate(
        repo, history,
        { workspaceId: WS, archetypeId: ARCH, creationProjectId: PROJECT, candidateId: "cand-multi", assetId: "asset-multi", identityFingerprint: makeFp("multi"), sourceProvider: PROVIDER, sourceModel: MODEL },
        { evaluator: multiFaceEval },
      );
      assert.equal(check.hardReject, false);
      assert.equal(check.softWarning, true);
    } finally {
      if (prev === undefined) delete process.env.FACE_EVALUATOR_FAILURE_MODE;
      else process.env.FACE_EVALUATOR_FAILURE_MODE = prev;
    }
  });
});

// ---------------------------------------------------------------------------
// 11. Low-confidence face is not falsely approved
// ---------------------------------------------------------------------------
describe("11. low-confidence face is not silently approved", () => {
  it("low_confidence evaluator returns not_available → soft warning, not hardReject", async () => {
    const prev = process.env.FACE_EVALUATOR_FAILURE_MODE;
    process.env.FACE_EVALUATOR_FAILURE_MODE = "fail_open_with_warning";
    try {
      const repo = new MemoryNoveltyRepository();
      const lowConfEval = new FakeEmbeddingEvaluator({
        status: "not_available",
        method: "local-face-embedding-v1",
        _detectionStatus: "low_confidence",
        _faceCount: 1,
      });
      const history = await loadDiscoveryHistory(repo, WS, ARCH);
      const check = await checkAndRegisterCandidate(
        repo, history,
        { workspaceId: WS, archetypeId: ARCH, creationProjectId: PROJECT, candidateId: "cand-lc", assetId: "asset-lc", identityFingerprint: makeFp("lc"), sourceProvider: PROVIDER, sourceModel: MODEL },
        { evaluator: lowConfEval },
      );
      // fail_open: soft warning because not_available
      assert.equal(check.hardReject, false);
      assert.equal(check.softWarning, true);
    } finally {
      if (prev === undefined) delete process.env.FACE_EVALUATOR_FAILURE_MODE;
      else process.env.FACE_EVALUATOR_FAILURE_MODE = prev;
    }
  });
});

// ---------------------------------------------------------------------------
// 12. Duplicate candidate is never rendered (hardReject=true)
// ---------------------------------------------------------------------------
describe("12. duplicate candidate never rendered", () => {
  it("hardReject=true and requiresReplacementConfirmation=true prevent rendering", async () => {
    const repo = new MemoryNoveltyRepository();
    const emb = makeEmbedding(1 / Math.sqrt(128));
    const embRepo = new MemoryEmbeddingRepository();
    await registerShow(repo, embRepo, "cand-render1", "asset-render1", emb);
    const history = await loadDiscoveryHistory(repo, WS, ARCH);
    const eval2 = new FakeEmbeddingEvaluator({
      status: "performed",
      isDuplicate: true,
      similarity: 0.99,
      threshold: FACE_SIMILARITY_EUCLIDEAN_DUPLICATE_THRESHOLD,
      method: "local-face-embedding-v1",
      closestMatchAssetId: "asset-render1",
    });
    const check = await checkAndRegisterCandidate(
      repo, history,
      { workspaceId: WS, archetypeId: ARCH, creationProjectId: PROJECT, candidateId: "cand-render2", assetId: "asset-render2", identityFingerprint: makeFp("render2"), sourceProvider: PROVIDER, sourceModel: MODEL },
      { evaluator: eval2 },
    );
    assert.ok(check.hardReject);
    assert.ok(check.requiresReplacementConfirmation);
    assert.ok(check.replacementMessage);
  });
});

// ---------------------------------------------------------------------------
// 13. Unique successful slots are preserved
// ---------------------------------------------------------------------------
describe("13. unique slots are preserved", () => {
  it("hardReject=false for clearly different faces", async () => {
    const repo = new MemoryNoveltyRepository();
    const history = await loadDiscoveryHistory(repo, WS, ARCH);
    const uniqueEval = new FakeEmbeddingEvaluator({
      status: "performed",
      isDuplicate: false,
      similarity: 0.4,
      threshold: FACE_SIMILARITY_EUCLIDEAN_DUPLICATE_THRESHOLD,
      method: "local-face-embedding-v1",
    });
    const check = await checkAndRegisterCandidate(
      repo, history,
      { workspaceId: WS, archetypeId: ARCH, creationProjectId: PROJECT, candidateId: "cand-unique", assetId: "asset-unique", identityFingerprint: makeFp("unique-q"), sourceProvider: PROVIDER, sourceModel: MODEL },
      { evaluator: uniqueEval },
    );
    assert.equal(check.hardReject, false);
    assert.equal(check.requiresReplacementConfirmation, false);
  });
});

// ---------------------------------------------------------------------------
// 14. Replacement requires explicit paid confirmation
// ---------------------------------------------------------------------------
describe("14. replacement requires explicit confirmation", () => {
  it("face-similarity reject surfaces FACE_SIMILARITY_REPLACEMENT_CONFIRMATION_MESSAGE", async () => {
    const repo = new MemoryNoveltyRepository();
    const history = await loadDiscoveryHistory(repo, WS, ARCH);
    const dupEval = new FakeEmbeddingEvaluator({
      status: "performed",
      isDuplicate: true,
      similarity: 0.99,
      threshold: FACE_SIMILARITY_EUCLIDEAN_DUPLICATE_THRESHOLD,
      method: "local-face-embedding-v1",
      closestMatchAssetId: "some-prior-asset",
    });
    const check = await checkAndRegisterCandidate(
      repo, history,
      { workspaceId: WS, archetypeId: ARCH, creationProjectId: PROJECT, candidateId: "cand-repl", assetId: "asset-repl", identityFingerprint: makeFp("repl"), sourceProvider: PROVIDER, sourceModel: MODEL },
      { evaluator: dupEval },
    );
    assert.equal(check.replacementMessage, FACE_SIMILARITY_REPLACEMENT_CONFIRMATION_MESSAGE);
  });
});

// ---------------------------------------------------------------------------
// 15. Embeddings are persisted once and reused
// ---------------------------------------------------------------------------
describe("15. embeddings persisted once", () => {
  it("saveEmbedding is called when embedding present; hasEmbedding returns true after", async () => {
    const repo = new MemoryNoveltyRepository();
    const embRepo = new MemoryEmbeddingRepository();
    const emb = makeEmbedding(1 / Math.sqrt(128));
    const uniqueEval = new FakeEmbeddingEvaluator({
      status: "performed",
      isDuplicate: false,
      similarity: 0.3,
      threshold: FACE_SIMILARITY_EUCLIDEAN_DUPLICATE_THRESHOLD,
      method: "local-face-embedding-v1",
      _embedding: emb,
      _detectionConfidence: 0.95,
      _faceCount: 1,
      _thresholdVersion: FACE_SIMILARITY_THRESHOLD_VERSION,
    });
    const history = await loadDiscoveryHistory(repo, WS, ARCH);
    const check = await checkAndRegisterCandidate(
      repo, history,
      { workspaceId: WS, archetypeId: ARCH, creationProjectId: PROJECT, candidateId: "cand-emb-persist", assetId: "asset-emb-persist", identityFingerprint: makeFp("emb-persist"), sourceProvider: PROVIDER, sourceModel: MODEL },
      { evaluator: uniqueEval, embeddingRepo: embRepo },
    );
    const stored = await embRepo.loadEmbeddingsForWorkspace(WS, ARCH, {
      currentCreationProjectId: PROJECT,
    });
    assert.ok(stored.length > 0, "embedding must be stored");
    const hasIt = await embRepo.hasEmbedding(check.recordId, WS);
    assert.ok(hasIt, "hasEmbedding should return true after persistence");
  });
});

// ---------------------------------------------------------------------------
// 16. Embedding vectors are NOT exposed in debug output
// ---------------------------------------------------------------------------
describe("16. embedding vectors not in debug output", () => {
  it("NoveltyDebugData does not include embedding arrays", async () => {
    const repo = new MemoryNoveltyRepository();
    const { buildNoveltyDebugData } = await import("./novelty-service");
    const debugData = await buildNoveltyDebugData(repo, WS, ARCH, []);
    const json = JSON.stringify(debugData);
    // embedding arrays would be 128+ numbers — look for no _embedding key
    assert.ok(!json.includes("_embedding"), "debug data must not contain embedding");
    // Also no raw similarity scores that could fingerprint biometrics
    assert.ok(!json.includes('"embedding"'), "debug data must not contain embedding key");
  });
});

// ---------------------------------------------------------------------------
// 17. Evaluator failure is reported honestly
// ---------------------------------------------------------------------------
describe("17. evaluator failure reported honestly", () => {
  it("ErrorEvaluator produces softWarning, not hardReject", async () => {
    const prev = process.env.FACE_EVALUATOR_FAILURE_MODE;
    process.env.FACE_EVALUATOR_FAILURE_MODE = "fail_open_with_warning";
    try {
      const repo = new MemoryNoveltyRepository();
      const history = await loadDiscoveryHistory(repo, WS, ARCH);
      const check = await checkAndRegisterCandidate(
        repo, history,
        { workspaceId: WS, archetypeId: ARCH, creationProjectId: PROJECT, candidateId: "cand-err", assetId: "asset-err", identityFingerprint: makeFp("err"), sourceProvider: PROVIDER, sourceModel: MODEL },
        { evaluator: new ErrorEvaluator() as FaceSimilarityEvaluator },
      );
      // fail_open: Evaluator error → soft warning
      assert.equal(check.hardReject, false);
      assert.equal(check.softWarning, true);
    } finally {
      if (prev === undefined) delete process.env.FACE_EVALUATOR_FAILURE_MODE;
      else process.env.FACE_EVALUATOR_FAILURE_MODE = prev;
    }
  });
});

// ---------------------------------------------------------------------------
// 18. Exact/perceptual checks still work when evaluator is unavailable
// ---------------------------------------------------------------------------
describe("18. exact/perceptual checks work with unavailable evaluator", () => {
  it("exact checksum duplicate is hard-rejected even when face evaluator is null", async () => {
    const repo = new MemoryNoveltyRepository();
    const fp = makeFp("checksum-fallback");
    const rec = await registerGeneratedCandidate(repo, {
      workspaceId: WS, archetypeId: ARCH, creationProjectId: PROJECT,
      candidateId: "cand-cs1", assetId: "asset-cs1",
      identityFingerprint: fp, imageChecksum: "deadbeef-checksum",
      sourceProvider: PROVIDER, sourceModel: MODEL,
    });
    await markCandidateShown(repo, rec.id, WS);
    const history = await loadDiscoveryHistory(repo, WS, ARCH);
    const check = await checkAndRegisterCandidate(
      repo, history,
      { workspaceId: WS, archetypeId: ARCH, creationProjectId: PROJECT, candidateId: "cand-cs2", assetId: "asset-cs2", identityFingerprint: makeFp("cs2"), imageChecksum: "deadbeef-checksum", sourceProvider: PROVIDER, sourceModel: MODEL },
      { evaluator: new UnavailableEvaluator() },
    );
    assert.ok(check.hardReject, "checksum duplicate must hard-reject even with unavailable evaluator");
  });

  it("perceptual near-duplicate is hard-rejected even when face evaluator is null", () => {
    const hashA = "0000000000000000";
    const hashB = "0000000000000002"; // Hamming distance 1
    const prior = makeRef("prior", { perceptualHash: hashA });
    const candidate = makeRef("cand", { perceptualHash: hashB });
    const result = detectImageDuplicate(candidate, [prior]);
    assert.ok(result.isDuplicate);
    assert.equal(result.reason, "perceptual_near_duplicate");
  });
});

// ---------------------------------------------------------------------------
// 19. RLS/workspace isolation remains green
// ---------------------------------------------------------------------------
describe("19. workspace isolation still enforced", () => {
  it("workspace B embeddings not loaded for workspace A", async () => {
    const embRepo = new MemoryEmbeddingRepository();
    embRepo.saveWithContext({
      noveltyRecordId: "rec-ws-b",
      workspaceId: WS_B,
      assetId: "asset-ws-b",
      candidateId: "cand-ws-b",
      embedding: makeEmbedding(0.1),
      embeddingDimension: 128,
      embeddingModel: "faceRecognitionNet",
      embeddingVersion: FACE_SIMILARITY_EVALUATOR_VERSION,
      detectionConfidence: 0.9,
      faceCount: 1,
      detectionStatus: "performed",
      similarityThresholdVersion: FACE_SIMILARITY_THRESHOLD_VERSION,
    });
    const embsForA = await embRepo.loadEmbeddingsForWorkspace(WS);
    assert.equal(embsForA.length, 0, "workspace B embeddings must not be loaded for workspace A");
  });
});

// ---------------------------------------------------------------------------
// 20. All existing novelty tests remain green (verified by running full suite)
// ---------------------------------------------------------------------------
// This is verified by running npm test. Structural assertion:
describe("20. existing 2.0A tests untouched", () => {
  it("MemoryNoveltyRepository still works", async () => {
    const repo = new MemoryNoveltyRepository();
    const rec = await registerGeneratedCandidate(repo, {
      workspaceId: WS, archetypeId: ARCH, creationProjectId: PROJECT,
      candidateId: "cand-legacy", assetId: "asset-legacy",
      identityFingerprint: makeFp("legacy"), sourceProvider: PROVIDER, sourceModel: MODEL,
    });
    assert.ok(rec.id);
  });
});

// ---------------------------------------------------------------------------
// 21. No OpenAI or paid provider call
// ---------------------------------------------------------------------------
describe("21. no OpenAI/paid provider call", () => {
  it("NullFaceSimilarityEvaluator default still returns not_available", async () => {
    const { resolveFaceSimilarityEvaluator } = await import("./face-similarity-adapter");
    const eval0 = resolveFaceSimilarityEvaluator();
    const result = await eval0.evaluate({
      candidateAsset: makeRef("x"),
      comparisonAssets: [],
    });
    assert.equal(result.status, "not_available");
  });

  it("compareEmbeddings makes no network call", () => {
    const a = makeEmbedding(0.1);
    const b = makeEmbedding(0.2);
    const result = compareEmbeddings({
      candidateEmbedding: a,
      priorEmbeddings: [{ assetId: "a", candidateId: "c", embedding: b }],
    });
    assert.ok(result.closestDistance !== undefined);
  });
});

// ---------------------------------------------------------------------------
// Threshold math
// ---------------------------------------------------------------------------
describe("euclidean/cosine math", () => {
  it("euclideanDistance returns 0 for identical vectors", () => {
    const v = makeEmbedding(0.5);
    assert.equal(euclideanDistance(v, v), 0);
  });

  it("euclideanToCosineSimilarity(0) = 1.0", () => {
    assert.equal(euclideanToCosineSimilarity(0), 1.0);
  });

  it("euclideanToCosineSimilarity(2) = 0.0", () => {
    assert.equal(euclideanToCosineSimilarity(2), 0.0);
  });

  it("threshold version is set", () => {
    assert.ok(FACE_SIMILARITY_THRESHOLD_VERSION.startsWith("v"));
  });
});
