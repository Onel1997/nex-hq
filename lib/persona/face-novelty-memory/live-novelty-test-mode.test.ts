/**
 * Phase 2.0B.2 — Controlled live novelty test mode tests.
 *
 * No OpenAI / paid provider calls.
 */

import assert from "node:assert/strict";
import { describe, it, before, after } from "node:test";
import { MemoryNoveltyRepository } from "./novelty-repository";
import { MemoryEmbeddingRepository } from "./embedding-repository";
import { MemoryLiveDiagnosticStore } from "./diagnostic-store";
import {
  checkAndRegisterCandidate,
} from "./novelty-service";
import { loadDiscoveryHistory } from "./discovery-history";
import { buildIdentityFingerprint } from "./identity-fingerprint";
import {
  isPersonaFaceNoveltyDebugEnabled,
  buildSafeFaceNoveltyLiveDebug,
  calculateHistoricalEmbeddingCoverage,
  buildCopyDebugPayload,
  buildRunLiveDebug,
  stripNoveltyDebugFromCandidateSettings,
  maybeAttachNoveltyDebugToSettings,
  assertSafeFaceNoveltyDebugDto,
  PERSONA_FACE_NOVELTY_DEBUG_ENV,
} from "./live-debug";
import {
  resolveNoveltyCandidateStatus,
  assertCandidateMayBecomeReady,
  isCandidateVisibleOnBoard,
} from "./visibility-assertion";
import {
  runFaceNoveltyPreflight,
  failingPreflightChecks,
} from "./preflight";
import {
  FACE_SIMILARITY_EUCLIDEAN_DUPLICATE_THRESHOLD,
  FACE_SIMILARITY_THRESHOLD_VERSION,
} from "./similarity-threshold";
import type { FaceSimilarityEvaluator, FaceSimilarityResult } from "./types";

const WS = "ws-live-debug-001";
const WS_B = "ws-live-debug-002";
const ARCH = "milaene_mediterranean_premium_hero";
const PROJECT = "proj-live-debug-001";
const PROVIDER = "openai";
const MODEL = "dall-e-3";

function makeFp(id: string): string {
  return buildIdentityFingerprint({
    archetypeId: ARCH,
    blueprintId: "bp-1",
    runVariationToken: id,
  });
}

function makeEmbedding(seed: number, dim = 128): number[] {
  const v = Array.from({ length: dim }, (_, i) => Math.sin(seed + i * 0.1));
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  return v.map((x) => x / (norm || 1));
}

class LocalMethodEvaluator implements FaceSimilarityEvaluator {
  readonly method = "local-face-embedding-v1";
  constructor(private readonly result: FaceSimilarityResult & Record<string, unknown>) {}
  async evaluate(): Promise<FaceSimilarityResult> {
    return { ...this.result, method: this.method };
  }
}

class ThrowingLocalEvaluator implements FaceSimilarityEvaluator {
  readonly method = "local-face-embedding-v1";
  async evaluate(): Promise<FaceSimilarityResult> {
    throw new Error("tf init failed");
  }
}

let prevDebug: string | undefined;
let prevFailureMode: string | undefined;

before(() => {
  prevDebug = process.env[PERSONA_FACE_NOVELTY_DEBUG_ENV];
  prevFailureMode = process.env.FACE_EVALUATOR_FAILURE_MODE;
});

after(() => {
  if (prevDebug === undefined) delete process.env[PERSONA_FACE_NOVELTY_DEBUG_ENV];
  else process.env[PERSONA_FACE_NOVELTY_DEBUG_ENV] = prevDebug;
  if (prevFailureMode === undefined) delete process.env.FACE_EVALUATOR_FAILURE_MODE;
  else process.env.FACE_EVALUATOR_FAILURE_MODE = prevFailureMode;
});

describe("1. debug data unavailable when feature flag off", () => {
  it("isPersonaFaceNoveltyDebugEnabled is false when env unset", () => {
    assert.equal(
      isPersonaFaceNoveltyDebugEnabled({
        NODE_ENV: "development",
      }),
      false,
    );
  });

  it("liveDebug omitted from check when flag off", async () => {
    delete process.env[PERSONA_FACE_NOVELTY_DEBUG_ENV];
    process.env.FACE_EVALUATOR_FAILURE_MODE = "fail_closed";
    const repo = new MemoryNoveltyRepository();
    const history = await loadDiscoveryHistory(repo, WS, ARCH);
    const check = await checkAndRegisterCandidate(
      repo,
      history,
      {
        workspaceId: WS,
        archetypeId: ARCH,
        creationProjectId: PROJECT,
        candidateId: "cand-flag-off",
        assetId: "asset-flag-off",
        identityFingerprint: makeFp("flag-off"),
        sourceProvider: PROVIDER,
        sourceModel: MODEL,
      },
      {
        evaluator: new LocalMethodEvaluator({
          status: "performed",
          isDuplicate: false,
          similarity: 0.2,
          threshold: FACE_SIMILARITY_EUCLIDEAN_DUPLICATE_THRESHOLD,
          _detectionStatus: "performed",
          _faceCount: 1,
          _detectionConfidence: 0.95,
          _embedding: makeEmbedding(1),
        }),
        evaluatorActive: true,
      },
    );
    assert.equal(check.liveDebug, undefined);
  });
});

describe("2. debug data unavailable in production", () => {
  it("flag ignored in production even when set true", () => {
    assert.equal(
      isPersonaFaceNoveltyDebugEnabled({
        NODE_ENV: "production",
        [PERSONA_FACE_NOVELTY_DEBUG_ENV]: "true",
      }),
      false,
    );
  });

  it("maybeAttach strips debug in production", () => {
    const settings = maybeAttachNoveltyDebugToSettings(
      { faceNoveltyLiveDebug: { finalDecision: "allowed" } },
      buildSafeFaceNoveltyLiveDebug({
        finalDecision: "allowed",
        requiresReplacementConfirmation: false,
      }),
      {
        NODE_ENV: "production",
        [PERSONA_FACE_NOVELTY_DEBUG_ENV]: "true",
      },
    );
    assert.equal(settings.faceNoveltyLiveDebug, undefined);
  });
});

describe("3–5. safe DTO contains no secrets", () => {
  it("safe DTO contains no embedding vector, signed URL, or storage credentials", () => {
    const dto = buildSafeFaceNoveltyLiveDebug({
      finalDecision: "allowed",
      requiresReplacementConfirmation: false,
      similarity: 0.3,
      closestPriorCandidateId: "c1",
      closestPriorAssetId: "a1",
    });
    const json = JSON.stringify(dto);
    assert.ok(!json.includes("_embedding"));
    assert.ok(!json.includes("signedUrl"));
    assert.ok(!json.includes("signed_url"));
    assert.ok(!json.includes("serviceRole"));
    assert.ok(!json.includes("SUPABASE_SERVICE_ROLE"));
    assert.ok(!json.includes("OPENAI_API_KEY"));
    assert.ok(!Array.isArray((dto as { embedding?: unknown }).embedding));
    assertSafeFaceNoveltyDebugDto(dto);
  });
});

describe("6. candidate cannot become ready before performed evaluation", () => {
  it("assertCandidateMayBecomeReady throws without performed", () => {
    assert.throws(() =>
      assertCandidateMayBecomeReady({
        proposedStatus: "ready",
        evaluationStatus: "not_available",
        finalDecision: "allowed",
        failureMode: "fail_closed",
      }),
    );
  });

  it("resolveNoveltyCandidateStatus blocks when evaluation not performed under fail_closed", () => {
    process.env.FACE_EVALUATOR_FAILURE_MODE = "fail_closed";
    const result = resolveNoveltyCandidateStatus({
      hardReject: false,
      evaluationStatus: "not_available",
      evaluatorActive: true,
      softWarning: true,
      softWarningReason: "face_similarity_evaluator_not_available",
    });
    assert.notEqual(result.status, "ready");
    assert.notEqual(result.finalDecision, "allowed");
  });
});

describe("7. duplicate candidate becomes novelty_blocked", () => {
  it("face_similarity_duplicate → novelty_blocked", async () => {
    process.env.FACE_EVALUATOR_FAILURE_MODE = "fail_closed";
    const repo = new MemoryNoveltyRepository();
    const history = await loadDiscoveryHistory(repo, WS, ARCH);
    const check = await checkAndRegisterCandidate(
      repo,
      history,
      {
        workspaceId: WS,
        archetypeId: ARCH,
        creationProjectId: PROJECT,
        candidateId: "cand-dup",
        assetId: "asset-dup",
        identityFingerprint: makeFp("dup"),
        sourceProvider: PROVIDER,
        sourceModel: MODEL,
      },
      {
        evaluator: new LocalMethodEvaluator({
          status: "performed",
          isDuplicate: true,
          similarity: 0.99,
          threshold: FACE_SIMILARITY_EUCLIDEAN_DUPLICATE_THRESHOLD,
          closestMatchAssetId: "prior-asset",
          _detectionStatus: "performed",
          _closestMatchCandidateId: "prior-cand",
        }),
        evaluatorActive: true,
      },
    );
    assert.equal(check.candidateStatus, "novelty_blocked");
    assert.equal(check.finalDecision, "blocked");
    assert.equal(check.hardRejectReason, "face_similarity_duplicate");
  });
});

describe("8. evaluator failure becomes novelty_failed", () => {
  it("throwing local evaluator → novelty_failed", async () => {
    process.env.FACE_EVALUATOR_FAILURE_MODE = "fail_closed";
    const repo = new MemoryNoveltyRepository();
    const history = await loadDiscoveryHistory(repo, WS, ARCH);
    const check = await checkAndRegisterCandidate(
      repo,
      history,
      {
        workspaceId: WS,
        archetypeId: ARCH,
        creationProjectId: PROJECT,
        candidateId: "cand-fail",
        assetId: "asset-fail",
        identityFingerprint: makeFp("fail"),
        sourceProvider: PROVIDER,
        sourceModel: MODEL,
      },
      { evaluator: new ThrowingLocalEvaluator(), evaluatorActive: true },
    );
    assert.equal(check.candidateStatus, "novelty_failed");
    assert.equal(check.finalDecision, "failed");
  });
});

describe("9–11. detection failures cannot become visible", () => {
  for (const status of ["no_face", "multiple_faces", "low_confidence"] as const) {
    it(`${status} cannot become ready/visible`, async () => {
      process.env.FACE_EVALUATOR_FAILURE_MODE = "fail_closed";
      const repo = new MemoryNoveltyRepository();
      const history = await loadDiscoveryHistory(repo, WS, ARCH);
      const check = await checkAndRegisterCandidate(
        repo,
        history,
        {
          workspaceId: WS,
          archetypeId: ARCH,
          creationProjectId: PROJECT,
          candidateId: `cand-${status}`,
          assetId: `asset-${status}`,
          identityFingerprint: makeFp(status),
          sourceProvider: PROVIDER,
          sourceModel: MODEL,
        },
        {
          evaluator: new LocalMethodEvaluator({
            status: "not_available",
            _detectionStatus: status,
            _faceCount: status === "multiple_faces" ? 3 : status === "no_face" ? 0 : 1,
          }),
          evaluatorActive: true,
        },
      );
      assert.notEqual(check.candidateStatus, "ready");
      assert.ok(
        check.candidateStatus === "novelty_blocked" ||
          check.candidateStatus === "novelty_failed",
      );
      assert.equal(isCandidateVisibleOnBoard(check.candidateStatus), false);
    });
  }
});

describe("12. allowed candidate can become ready", () => {
  it("performed unique evaluation → ready", async () => {
    process.env.FACE_EVALUATOR_FAILURE_MODE = "fail_closed";
    const repo = new MemoryNoveltyRepository();
    const history = await loadDiscoveryHistory(repo, WS, ARCH);
    const check = await checkAndRegisterCandidate(
      repo,
      history,
      {
        workspaceId: WS,
        archetypeId: ARCH,
        creationProjectId: PROJECT,
        candidateId: "cand-ok",
        assetId: "asset-ok",
        identityFingerprint: makeFp("ok"),
        sourceProvider: PROVIDER,
        sourceModel: MODEL,
      },
      {
        evaluator: new LocalMethodEvaluator({
          status: "performed",
          isDuplicate: false,
          similarity: 0.2,
          threshold: FACE_SIMILARITY_EUCLIDEAN_DUPLICATE_THRESHOLD,
          _detectionStatus: "performed",
          _faceCount: 1,
          _detectionConfidence: 0.97,
          _embedding: makeEmbedding(7),
        }),
        evaluatorActive: true,
        embeddingRepo: new MemoryEmbeddingRepository(),
      },
    );
    assert.equal(check.candidateStatus, "ready");
    assert.equal(check.finalDecision, "allowed");
    assert.doesNotThrow(() =>
      assertCandidateMayBecomeReady({
        proposedStatus: "ready",
        evaluationStatus: "performed",
        finalDecision: "allowed",
        detectionStatus: "performed",
        failureMode: "fail_closed",
      }),
    );
  });
});

describe("13–16. preflight", () => {
  it("preflight makes no OpenAI/provider call", async () => {
    process.env[PERSONA_FACE_NOVELTY_DEBUG_ENV] = "true";
    process.env.FACE_EVALUATOR_FAILURE_MODE = "fail_closed";
    const report = await runFaceNoveltyPreflight({
      historyCounts: { priorNoveltyHistoryCount: 3, priorEmbeddingCount: 1 },
    });
    assert.equal(report.openaiOrProviderCalled, false);
  });

  it("preflight reports missing TensorFlow", async () => {
    process.env[PERSONA_FACE_NOVELTY_DEBUG_ENV] = "true";
    process.env.FACE_EVALUATOR_FAILURE_MODE = "fail_closed";
    const report = await runFaceNoveltyPreflight({
      simulate: { tensorflowMissing: true },
    });
    assert.equal(report.ready, false);
    assert.equal(report.verdict, "NOT READY");
    assert.ok(failingPreflightChecks(report).some((c) => c.id === "tensorflow"));
  });

  it("preflight reports missing model weights", async () => {
    process.env[PERSONA_FACE_NOVELTY_DEBUG_ENV] = "true";
    process.env.FACE_EVALUATOR_FAILURE_MODE = "fail_closed";
    const report = await runFaceNoveltyPreflight({
      simulate: { modelWeightsMissing: true },
    });
    assert.ok(failingPreflightChecks(report).some((c) => c.id === "model_weights"));
  });

  it("preflight reports migration state", async () => {
    process.env[PERSONA_FACE_NOVELTY_DEBUG_ENV] = "true";
    process.env.FACE_EVALUATOR_FAILURE_MODE = "fail_closed";
    const report = await runFaceNoveltyPreflight({
      simulate: { migrationMissing: true },
    });
    assert.ok(failingPreflightChecks(report).some((c) => c.id === "migrations"));
  });
});

describe("17. historical embedding coverage", () => {
  it("calculates coverage correctly without claiming unprotected faces are protected", () => {
    const coverage = calculateHistoricalEmbeddingCoverage([
      { hasEmbedding: true, hasChecksumOrPHash: true, detectionFailed: false, missingAssetAccess: false },
      { hasEmbedding: false, hasChecksumOrPHash: true, detectionFailed: false, missingAssetAccess: false },
      { hasEmbedding: false, hasChecksumOrPHash: false, detectionFailed: true, missingAssetAccess: false },
      { hasEmbedding: false, hasChecksumOrPHash: false, detectionFailed: false, missingAssetAccess: true },
    ]);
    assert.equal(coverage.forbiddenFacesTotal, 4);
    assert.equal(coverage.protectedByEmbedding, 1);
    assert.equal(coverage.protectedOnlyByChecksumOrPHash, 1);
    assert.equal(coverage.unprotectedForBiologicalSimilarity, 3);
    assert.equal(coverage.coveragePercentage, 25);
  });
});

describe("18. debug evidence survives page refresh", () => {
  it("diagnostic store retains evidence after reload", async () => {
    process.env[PERSONA_FACE_NOVELTY_DEBUG_ENV] = "true";
    process.env.FACE_EVALUATOR_FAILURE_MODE = "fail_closed";
    const repo = new MemoryNoveltyRepository();
    const store = new MemoryLiveDiagnosticStore();
    const history = await loadDiscoveryHistory(repo, WS, ARCH);
    const check = await checkAndRegisterCandidate(
      repo,
      history,
      {
        workspaceId: WS,
        archetypeId: ARCH,
        creationProjectId: PROJECT,
        candidateId: "cand-persist",
        assetId: "asset-persist",
        identityFingerprint: makeFp("persist"),
        sourceProvider: PROVIDER,
        sourceModel: MODEL,
      },
      {
        evaluator: new LocalMethodEvaluator({
          status: "performed",
          isDuplicate: false,
          similarity: 0.25,
          threshold: FACE_SIMILARITY_EUCLIDEAN_DUPLICATE_THRESHOLD,
          _detectionStatus: "performed",
          _embedding: makeEmbedding(3),
        }),
        evaluatorActive: true,
        diagnosticStore: store,
        embeddingRepo: new MemoryEmbeddingRepository(),
      },
    );
    const loaded = await store.loadEvidence(check.recordId, WS);
    assert.ok(loaded);
    assert.equal(loaded.finalDecision, "allowed");
    assert.equal(loaded.candidateId, "cand-persist");
    const json = JSON.stringify(loaded);
    assert.ok(!json.includes("_embedding"));
  });
});

describe("19. copied debug JSON is safe", () => {
  it("copy payload excludes secrets and vectors", () => {
    process.env[PERSONA_FACE_NOVELTY_DEBUG_ENV] = "true";
    const run = buildRunLiveDebug({
      projectId: PROJECT,
      archetypeId: ARCH,
      evaluatorStatus: "active",
      priorEmbeddingsLoaded: 2,
      pipelineStatus: "passed",
    });
    const coverage = calculateHistoricalEmbeddingCoverage([]);
    const candidates = [
      buildSafeFaceNoveltyLiveDebug({
        finalDecision: "allowed",
        requiresReplacementConfirmation: false,
        candidateId: "c1",
        slot: 1,
      }),
    ];
    const payload = buildCopyDebugPayload({
      projectId: PROJECT,
      archetypeId: ARCH,
      run,
      coverage,
      candidates,
    });
    const json = JSON.stringify(payload);
    assert.ok(!json.includes("OPENAI"));
    assert.ok(!json.includes("signedUrl"));
    assert.ok(!json.includes("_embedding"));
    assert.equal(payload.finalDecisions[0]?.finalDecision, "allowed");
  });
});

describe("20. workspace isolation remains intact", () => {
  it("diagnostic evidence does not cross workspaces", async () => {
    const store = new MemoryLiveDiagnosticStore();
    await store.saveEvidence("rec-1", WS, buildSafeFaceNoveltyLiveDebug({
      finalDecision: "allowed",
      requiresReplacementConfirmation: false,
      candidateProjectId: PROJECT,
      candidateId: "c-a",
    }));
    const other = await store.loadEvidence("rec-1", WS_B);
    assert.equal(other, null);
  });
});

describe("21. A1/A2 paid workflow unchanged markers", () => {
  it("replacement confirmation still required on hard reject", async () => {
    process.env.FACE_EVALUATOR_FAILURE_MODE = "fail_closed";
    const repo = new MemoryNoveltyRepository();
    const history = await loadDiscoveryHistory(repo, WS, ARCH);
    const check = await checkAndRegisterCandidate(
      repo,
      history,
      {
        workspaceId: WS,
        archetypeId: ARCH,
        creationProjectId: PROJECT,
        candidateId: "cand-repl",
        assetId: "asset-repl",
        identityFingerprint: makeFp("repl"),
        sourceProvider: PROVIDER,
        sourceModel: MODEL,
      },
      {
        evaluator: new LocalMethodEvaluator({
          status: "performed",
          isDuplicate: true,
          similarity: 0.98,
          threshold: FACE_SIMILARITY_EUCLIDEAN_DUPLICATE_THRESHOLD,
          _detectionStatus: "performed",
        }),
        evaluatorActive: true,
      },
    );
    assert.equal(check.requiresReplacementConfirmation, true);
    assert.ok(check.replacementMessage);
  });
});

describe("23. no OpenAI or paid provider call during these tests", () => {
  it("strip helper removes debug keys", () => {
    const stripped = stripNoveltyDebugFromCandidateSettings({
      faceNoveltyLiveDebug: { finalDecision: "allowed" },
      qualityAssessment: { score: 1 },
    });
    assert.equal(stripped.faceNoveltyLiveDebug, undefined);
    assert.deepEqual(stripped.qualityAssessment, { score: 1 });
  });

  it("threshold version constant unchanged", () => {
    assert.equal(FACE_SIMILARITY_THRESHOLD_VERSION, "v1.0.0");
  });
});
