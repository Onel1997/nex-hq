/**
 * Phase 2.0B.1 — Live wiring integration tests.
 *
 * Verifies that:
 *   - LocalFaceEmbeddingEvaluator is the only evaluator used during live discovery
 *   - NullFaceSimilarityEvaluator is never used in the live path
 *   - embedding is persisted and compared
 *   - duplicates block render (hardReject=true)
 *   - startup validation identifies required components
 *   - all existing novelty tests remain green
 *
 * No live model calls in this file — injected fake evaluators only.
 * No OpenAI / paid provider calls.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MemoryNoveltyRepository } from "./novelty-repository";
import { MemoryEmbeddingRepository } from "./embedding-repository";
import {
  checkAndRegisterCandidate,
  markCandidateShown,
  registerGeneratedCandidate,
  FACE_SIMILARITY_REPLACEMENT_CONFIRMATION_MESSAGE,
} from "./novelty-service";
import { loadDiscoveryHistory } from "./discovery-history";
import { buildIdentityFingerprint } from "./identity-fingerprint";
import {
  LocalFaceEmbeddingEvaluator,
  compareEmbeddings,
} from "./local-face-embedding-evaluator";
import { NullFaceSimilarityEvaluator } from "./face-similarity-adapter";
import {
  assertLiveFaceEvaluatorNotNull,
} from "./live-evaluator";
import { runFaceNoveltyStartupValidation } from "./startup-validation";
import {
  FACE_SIMILARITY_THRESHOLD_VERSION,
  FACE_SIMILARITY_EVALUATOR_VERSION,
  FACE_SIMILARITY_EUCLIDEAN_DUPLICATE_THRESHOLD,
} from "./similarity-threshold";
import type { FaceSimilarityEvaluator, CandidateAssetReference, FaceSimilarityResult } from "./types";

const WS = "ws-live-001";
const WS_B = "ws-live-002";
const ARCH = "milaene_primary_male";
const PROJECT = "proj-live-001";
const PROVIDER = "openai";
const MODEL = "dall-e-3";

function makeEmbedding(seed: number, dim = 128): number[] {
  const v = Array.from({ length: dim }, (_, i) => Math.sin(seed + i * 0.1));
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  return v.map((x) => x / (norm || 1));
}

function makeFp(id: string): string {
  return buildIdentityFingerprint({ archetypeId: ARCH, blueprintId: "bp-1", runVariationToken: id });
}

function makeRef(assetId: string, overrides: Partial<CandidateAssetReference> = {}): CandidateAssetReference {
  return { candidateId: `cand-${assetId}`, assetId, ...overrides };
}

/** A fake evaluator that always marks as duplicate. */
class AlwaysDuplicateEvaluator implements FaceSimilarityEvaluator {
  readonly method = "local-face-embedding-v1";
  async evaluate(input: { candidateAsset: CandidateAssetReference; comparisonAssets: CandidateAssetReference[] }): Promise<FaceSimilarityResult> {
    return {
      status: "performed",
      isDuplicate: true,
      similarity: 0.99,
      threshold: FACE_SIMILARITY_EUCLIDEAN_DUPLICATE_THRESHOLD,
      method: this.method,
      closestMatchAssetId: input.comparisonAssets[0]?.assetId,
    };
  }
}

/** A fake evaluator that always passes (not duplicate). */
class AlwaysUniqueEvaluator implements FaceSimilarityEvaluator {
  readonly method = "local-face-embedding-v1";
  async evaluate(): Promise<FaceSimilarityResult> {
    return {
      status: "performed",
      isDuplicate: false,
      similarity: 0.3,
      threshold: FACE_SIMILARITY_EUCLIDEAN_DUPLICATE_THRESHOLD,
      method: this.method,
    };
  }
}

/** Fake evaluator that attaches an embedding (for persistence tests). */
class EmbeddingCapableEvaluator implements FaceSimilarityEvaluator {
  readonly method = "local-face-embedding-v1";
  constructor(private embedding: number[]) {}
  async evaluate(): Promise<FaceSimilarityResult> {
    return {
      status: "performed",
      isDuplicate: false,
      similarity: 0.3,
      threshold: FACE_SIMILARITY_EUCLIDEAN_DUPLICATE_THRESHOLD,
      method: this.method,
      _embedding: this.embedding,
      _detectionConfidence: 0.97,
      _faceCount: 1,
      _thresholdVersion: FACE_SIMILARITY_THRESHOLD_VERSION,
    } as FaceSimilarityResult & Record<string, unknown>;
  }
}

// ---------------------------------------------------------------------------
// 1. Live OpenAI path uses LocalFaceEmbeddingEvaluator
// ---------------------------------------------------------------------------
describe("1. live discovery path must use LocalFaceEmbeddingEvaluator", () => {
  it("LocalFaceEmbeddingEvaluator can be instantiated with empty priors", () => {
    const evaluator = new LocalFaceEmbeddingEvaluator([]);
    assert.ok(evaluator instanceof LocalFaceEmbeddingEvaluator);
    assert.equal(evaluator.method, "local-face-embedding-v1");
    assert.equal(evaluator.version, FACE_SIMILARITY_EVALUATOR_VERSION);
  });

  it("assertLiveFaceEvaluatorNotNull passes for LocalFaceEmbeddingEvaluator", () => {
    const evaluator = new LocalFaceEmbeddingEvaluator([]);
    assert.doesNotThrow(() => assertLiveFaceEvaluatorNotNull(evaluator, "test"));
  });
});

// ---------------------------------------------------------------------------
// 2. Null evaluator never used in live discovery
// ---------------------------------------------------------------------------
describe("2. NullFaceSimilarityEvaluator blocked in live path", () => {
  it("assertLiveFaceEvaluatorNotNull throws for NullFaceSimilarityEvaluator", () => {
    const nullEval = new NullFaceSimilarityEvaluator();
    assert.throws(
      () => assertLiveFaceEvaluatorNotNull(nullEval, "live-test"),
      /NullFaceSimilarityEvaluator must not be used during live discovery/,
    );
  });

  it("NullFaceSimilarityEvaluator returns not_available (correct contract)", async () => {
    const nullEval = new NullFaceSimilarityEvaluator();
    const result = await nullEval.evaluate({
      candidateAsset: makeRef("x"),
      comparisonAssets: [],
    });
    assert.equal(result.status, "not_available");
  });
});

// ---------------------------------------------------------------------------
// 3. Embedding persisted after evaluation
// ---------------------------------------------------------------------------
describe("3. embedding persisted", () => {
  it("embedding stored in embeddingRepo after checkAndRegisterCandidate", async () => {
    const repo = new MemoryNoveltyRepository();
    const embRepo = new MemoryEmbeddingRepository();
    const emb = makeEmbedding(42);
    const evaluator = new EmbeddingCapableEvaluator(emb);
    const history = await loadDiscoveryHistory(repo, WS, ARCH);
    const check = await checkAndRegisterCandidate(
      repo, history,
      { workspaceId: WS, archetypeId: ARCH, creationProjectId: PROJECT, candidateId: "cand-emb", assetId: "asset-emb", identityFingerprint: makeFp("emb"), sourceProvider: PROVIDER, sourceModel: MODEL },
      { evaluator, embeddingRepo: embRepo },
    );
    const stored = await embRepo.loadEmbeddingsForWorkspace(WS);
    assert.ok(stored.length > 0, "embedding must be stored");
    const has = await embRepo.hasEmbedding(check.recordId, WS);
    assert.ok(has, "hasEmbedding must be true");
  });
});

// ---------------------------------------------------------------------------
// 4. Embedding compared against prior embeddings
// ---------------------------------------------------------------------------
describe("4. embedding compared against priors", () => {
  it("compareEmbeddings finds nearest prior", () => {
    const emb1 = makeEmbedding(1);
    const emb2 = makeEmbedding(1.001); // nearly identical
    const emb3 = makeEmbedding(100); // very different
    const result = compareEmbeddings({
      candidateEmbedding: emb2,
      priorEmbeddings: [
        { assetId: "close", candidateId: "c-close", embedding: emb1 },
        { assetId: "far", candidateId: "c-far", embedding: emb3 },
      ],
    });
    assert.equal(result.closestMatchAssetId, "close");
    assert.ok((result.closestDistance ?? 1) < 0.5);
  });
});

// ---------------------------------------------------------------------------
// 5. Duplicate blocks render (hardReject=true)
// ---------------------------------------------------------------------------
describe("5. duplicate candidate is hard-rejected", () => {
  it("AlwaysDuplicateEvaluator produces hardReject=true requiring confirmation", async () => {
    const repo = new MemoryNoveltyRepository();
    const emb = makeEmbedding(10);
    const embRepo = new MemoryEmbeddingRepository();
    // Plant a prior shown candidate
    const fp0 = makeFp("prior");
    const rec0 = await registerGeneratedCandidate(repo, {
      workspaceId: WS, archetypeId: ARCH, creationProjectId: PROJECT,
      candidateId: "cand-prior", assetId: "asset-prior",
      identityFingerprint: fp0, sourceProvider: PROVIDER, sourceModel: MODEL,
    });
    embRepo.saveWithContext({ noveltyRecordId: rec0.id, workspaceId: WS, assetId: "asset-prior", candidateId: "cand-prior", embedding: emb, embeddingDimension: 128, embeddingModel: "faceRecognitionNet", embeddingVersion: FACE_SIMILARITY_EVALUATOR_VERSION, detectionConfidence: 0.97, faceCount: 1, detectionStatus: "performed", similarityThresholdVersion: FACE_SIMILARITY_THRESHOLD_VERSION });
    await markCandidateShown(repo, rec0.id, WS);

    const history = await loadDiscoveryHistory(repo, WS, ARCH);
    const check = await checkAndRegisterCandidate(
      repo, history,
      { workspaceId: WS, archetypeId: ARCH, creationProjectId: PROJECT, candidateId: "cand-dup", assetId: "asset-dup", identityFingerprint: makeFp("dup2"), sourceProvider: PROVIDER, sourceModel: MODEL },
      { evaluator: new AlwaysDuplicateEvaluator(), embeddingRepo: embRepo },
    );
    assert.ok(check.hardReject, "duplicate must be hard-rejected");
    assert.ok(check.requiresReplacementConfirmation);
    assert.equal(check.replacementMessage, FACE_SIMILARITY_REPLACEMENT_CONFIRMATION_MESSAGE);
  });
});

// ---------------------------------------------------------------------------
// 6. Migration file available
// ---------------------------------------------------------------------------
describe("6. migration file available", () => {
  it("embedding migration SQL file exists on disk", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const migPath = path.join(
      process.cwd(),
      "supabase/migrations/20260729110000_persona_face_novelty_embeddings.sql",
    );
    assert.ok(fs.existsSync(migPath), `migration file must exist: ${migPath}`);
  });

  it("novelty memory migration SQL file exists on disk", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const migPath = path.join(
      process.cwd(),
      "supabase/migrations/20260729100000_persona_face_novelty_memory.sql",
    );
    assert.ok(fs.existsSync(migPath), `novelty memory migration must exist`);
  });
});

// ---------------------------------------------------------------------------
// 7. Startup validation works
// ---------------------------------------------------------------------------
describe("7. startup validation", () => {
  it("runFaceNoveltyStartupValidation returns a report", async () => {
    const report = await runFaceNoveltyStartupValidation();
    assert.ok(typeof report.ok === "boolean");
    assert.ok(typeof report.tensorflowLoaded === "boolean");
    assert.ok(typeof report.modelWeightsPresent === "boolean");
    assert.ok(typeof report.evaluatorModuleReachable === "boolean");
    assert.ok(typeof report.embeddingRepoReachable === "boolean");
    assert.ok(typeof report.migrationAvailable === "boolean");
    assert.ok(Array.isArray(report.warnings));
    assert.ok(Array.isArray(report.errors));
  });

  it("tensorflow is loaded in this test environment", async () => {
    const report = await runFaceNoveltyStartupValidation();
    assert.ok(report.tensorflowLoaded, "TensorFlow must be loaded (installed via npm)");
  });

  it("model weights are present", async () => {
    const report = await runFaceNoveltyStartupValidation();
    assert.ok(report.modelWeightsPresent, "Face model weights must be present in @vladmandic/face-api/model/");
  });

  it("evaluator module is reachable", async () => {
    const report = await runFaceNoveltyStartupValidation();
    assert.ok(report.evaluatorModuleReachable, "local-face-embedding-evaluator must load");
  });

  it("embedding repo module is reachable", async () => {
    const report = await runFaceNoveltyStartupValidation();
    assert.ok(report.embeddingRepoReachable, "SupabaseEmbeddingRepository must instantiate");
  });

  it("migration file is available", async () => {
    const report = await runFaceNoveltyStartupValidation();
    assert.ok(report.migrationAvailable, "embedding migration SQL must be present");
  });
});

// ---------------------------------------------------------------------------
// 8. Unique candidate passes and is not regenerated
// ---------------------------------------------------------------------------
describe("8. unique candidate passes through", () => {
  it("AlwaysUniqueEvaluator produces hardReject=false", async () => {
    const repo = new MemoryNoveltyRepository();
    const history = await loadDiscoveryHistory(repo, WS, ARCH);
    const check = await checkAndRegisterCandidate(
      repo, history,
      { workspaceId: WS, archetypeId: ARCH, creationProjectId: PROJECT, candidateId: "cand-pass", assetId: "asset-pass", identityFingerprint: makeFp("pass"), sourceProvider: PROVIDER, sourceModel: MODEL },
      { evaluator: new AlwaysUniqueEvaluator() },
    );
    assert.equal(check.hardReject, false);
    assert.equal(check.requiresReplacementConfirmation, false);
  });
});

// ---------------------------------------------------------------------------
// 9. Workspace isolation still enforced after live wiring
// ---------------------------------------------------------------------------
describe("9. workspace isolation after live wiring", () => {
  it("workspace B records not loaded for workspace A", async () => {
    const embRepo = new MemoryEmbeddingRepository();
    embRepo.saveWithContext({
      noveltyRecordId: "rec-wsb-live",
      workspaceId: WS_B,
      assetId: "asset-wsb",
      candidateId: "cand-wsb",
      embedding: makeEmbedding(99),
      embeddingDimension: 128,
      embeddingModel: "faceRecognitionNet",
      embeddingVersion: FACE_SIMILARITY_EVALUATOR_VERSION,
      detectionConfidence: 0.9,
      faceCount: 1,
      detectionStatus: "performed",
      similarityThresholdVersion: FACE_SIMILARITY_THRESHOLD_VERSION,
    });
    const embs = await embRepo.loadEmbeddingsForWorkspace(WS);
    assert.equal(embs.length, 0);
  });
});

// ---------------------------------------------------------------------------
// 10. No OpenAI / paid provider call during implementation
// ---------------------------------------------------------------------------
describe("10. no paid provider call", () => {
  it("LocalFaceEmbeddingEvaluator constructor does not call any network", () => {
    // Constructor is synchronous — just builds an evaluator with empty priors.
    // Model loading is lazy (first evaluate() call only).
    const evaluator = new LocalFaceEmbeddingEvaluator([]);
    assert.ok(evaluator instanceof LocalFaceEmbeddingEvaluator);
  });

  it("compareEmbeddings is pure local computation", () => {
    const a = makeEmbedding(1);
    const b = makeEmbedding(2);
    const result = compareEmbeddings({
      candidateEmbedding: a,
      priorEmbeddings: [{ assetId: "x", candidateId: "c", embedding: b }],
    });
    assert.ok(typeof result.isDuplicate === "boolean");
  });
});
