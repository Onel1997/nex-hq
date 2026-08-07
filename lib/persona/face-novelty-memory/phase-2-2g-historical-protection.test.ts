/**
 * Phase 2.2G — Protect approved Brand Identities, not every discovery face.
 * No paid provider calls.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  FACE_SIMILARITY_EUCLIDEAN_DUPLICATE_THRESHOLD,
  FACE_SIMILARITY_THRESHOLD_VERSION,
  FACE_SIMILARITY_EVALUATOR_VERSION,
  MemoryEmbeddingRepository,
  MemoryNoveltyRepository,
  registerGeneratedCandidate,
  markCandidateShown,
  markCandidateRejected,
  promoteToHistoricallyProtectedIdentity,
  isEmbeddingEligibleForComparison,
  resolveStrongerProtectionStatus,
  HISTORICAL_BLOCKING_PROTECTION_STATUSES,
  FACE_SIMILARITY_COSINE_DUPLICATE_THRESHOLD,
} from "./index";

const WS = "ws-2-2g";
const ARCH = "arch-mediterranean-premium-hero";
const PROJECT_OLD = "project-old-discovery";
const PROJECT_NEW = "project-new-discovery";
const PROVIDER = "fake";
const MODEL = "fake-model";

function makeEmbedding(seed: number): number[] {
  const v = new Array(128).fill(0);
  v[0] = seed;
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => x / norm);
}

describe("Phase 2.2G historical protection eligibility", () => {
  it("1. old unselected allowed discovery candidate does NOT enter historical blocking pool", async () => {
    const embRepo = new MemoryEmbeddingRepository();
    embRepo.saveWithContext({
      noveltyRecordId: "rec-old-allowed",
      workspaceId: WS,
      assetId: "asset-old",
      candidateId: "cand-old-allowed",
      creationProjectId: PROJECT_OLD,
      liveEvaluationEvidence: { finalDecision: "allowed" },
      historicalProtectionStatus: "unprotected",
      embedding: makeEmbedding(0.2),
      embeddingDimension: 128,
      embeddingModel: "faceRecognitionNet",
      embeddingVersion: FACE_SIMILARITY_EVALUATOR_VERSION,
      detectionConfidence: 0.9,
      faceCount: 1,
      detectionStatus: "performed",
      similarityThresholdVersion: FACE_SIMILARITY_THRESHOLD_VERSION,
    });

    const historical = await embRepo.loadEmbeddingsForWorkspace(WS, ARCH, {
      currentCreationProjectId: PROJECT_NEW,
    });
    assert.equal(
      historical.length,
      0,
      "unselected allowed discovery face must not block a new casting session",
    );

    assert.equal(
      isEmbeddingEligibleForComparison({
        liveEvaluationEvidence: { finalDecision: "allowed" },
        historicalProtectionStatus: "unprotected",
        creationProjectId: PROJECT_OLD,
        currentCreationProjectId: PROJECT_NEW,
      }),
      false,
    );
  });

  it("2. selected Brand Face DOES enter historical blocking pool", async () => {
    const embRepo = new MemoryEmbeddingRepository();
    embRepo.saveWithContext({
      noveltyRecordId: "rec-selected",
      workspaceId: WS,
      assetId: "asset-selected",
      candidateId: "cand-selected",
      creationProjectId: PROJECT_OLD,
      liveEvaluationEvidence: { finalDecision: "allowed" },
      historicalProtectionStatus: "selected_brand_face",
      embedding: makeEmbedding(0.3),
      embeddingDimension: 128,
      embeddingModel: "faceRecognitionNet",
      embeddingVersion: FACE_SIMILARITY_EVALUATOR_VERSION,
      detectionConfidence: 0.9,
      faceCount: 1,
      detectionStatus: "performed",
      similarityThresholdVersion: FACE_SIMILARITY_THRESHOLD_VERSION,
    });

    const pool = await embRepo.loadEmbeddingsForWorkspace(WS, ARCH, {
      currentCreationProjectId: PROJECT_NEW,
    });
    assert.equal(pool.length, 1);
    assert.equal(pool[0]?.candidateId, "cand-selected");
  });

  it("3. approved / Identity Locked persona DOES enter historical pool", async () => {
    const embRepo = new MemoryEmbeddingRepository();
    for (const status of ["approved_persona", "identity_locked", "brand_cast_approved"] as const) {
      embRepo.saveWithContext({
        noveltyRecordId: `rec-${status}`,
        workspaceId: WS,
        assetId: `asset-${status}`,
        candidateId: `cand-${status}`,
        creationProjectId: `project-${status}`,
        historicalProtectionStatus: status,
        liveEvaluationEvidence: { finalDecision: "allowed" },
        embedding: makeEmbedding(0.4),
        embeddingDimension: 128,
        embeddingModel: "faceRecognitionNet",
        embeddingVersion: FACE_SIMILARITY_EVALUATOR_VERSION,
        detectionConfidence: 0.9,
        faceCount: 1,
        detectionStatus: "performed",
        similarityThresholdVersion: FACE_SIMILARITY_THRESHOLD_VERSION,
      });
    }

    const pool = await embRepo.loadEmbeddingsForWorkspace(WS, ARCH, {
      currentCreationProjectId: PROJECT_NEW,
    });
    assert.equal(pool.length, 3);
    for (const status of HISTORICAL_BLOCKING_PROTECTION_STATUSES) {
      if (status === "selected_brand_face") continue;
      assert.ok(pool.some((p) => p.candidateId === `cand-${status}`));
    }
  });

  it("4. rejected / superseded candidates do not enter historical pool", async () => {
    const repo = new MemoryNoveltyRepository();
    const embRepo = new MemoryEmbeddingRepository();
    const rec = await registerGeneratedCandidate(repo, {
      workspaceId: WS,
      archetypeId: ARCH,
      creationProjectId: PROJECT_OLD,
      candidateId: "cand-rejected",
      assetId: "asset-rejected",
      identityFingerprint: "fp-rejected-2-2g",
      sourceProvider: PROVIDER,
      sourceModel: MODEL,
    });
    await markCandidateRejected(repo, rec.id, WS);
    embRepo.saveWithContext({
      noveltyRecordId: rec.id,
      workspaceId: WS,
      assetId: "asset-rejected",
      candidateId: "cand-rejected",
      creationProjectId: PROJECT_OLD,
      liveEvaluationEvidence: { finalDecision: "blocked" },
      historicalProtectionStatus: "unprotected",
      embedding: makeEmbedding(0.5),
      embeddingDimension: 128,
      embeddingModel: "faceRecognitionNet",
      embeddingVersion: FACE_SIMILARITY_EVALUATOR_VERSION,
      detectionConfidence: 0.9,
      faceCount: 1,
      detectionStatus: "performed",
      similarityThresholdVersion: FACE_SIMILARITY_THRESHOLD_VERSION,
    });

    const pool = await embRepo.loadEmbeddingsForWorkspace(WS, ARCH, {
      currentCreationProjectId: PROJECT_NEW,
    });
    assert.equal(pool.length, 0);

    assert.equal(
      isEmbeddingEligibleForComparison({
        liveEvaluationEvidence: { finalDecision: "blocked" },
        historicalProtectionStatus: "unprotected",
        creationProjectId: PROJECT_OLD,
        currentCreationProjectId: PROJECT_NEW,
      }),
      false,
    );
  });

  it("5. same-run protection remains active", async () => {
    const embRepo = new MemoryEmbeddingRepository();
    embRepo.saveWithContext({
      noveltyRecordId: "rec-same-run-a",
      workspaceId: WS,
      assetId: "asset-a",
      candidateId: "cand-a",
      creationProjectId: PROJECT_NEW,
      liveEvaluationEvidence: { finalDecision: "allowed" },
      historicalProtectionStatus: "unprotected",
      embedding: makeEmbedding(0.6),
      embeddingDimension: 128,
      embeddingModel: "faceRecognitionNet",
      embeddingVersion: FACE_SIMILARITY_EVALUATOR_VERSION,
      detectionConfidence: 0.9,
      faceCount: 1,
      detectionStatus: "performed",
      similarityThresholdVersion: FACE_SIMILARITY_THRESHOLD_VERSION,
    });

    const sameRun = await embRepo.loadEmbeddingsForWorkspace(WS, ARCH, {
      currentCreationProjectId: PROJECT_NEW,
    });
    assert.equal(sameRun.length, 1, "allowed same-run face must remain in pool");

    assert.equal(
      isEmbeddingEligibleForComparison({
        liveEvaluationEvidence: { finalDecision: "allowed" },
        historicalProtectionStatus: "unprotected",
        creationProjectId: PROJECT_NEW,
        currentCreationProjectId: PROJECT_NEW,
      }),
      true,
    );

    // Blocked same-run faces stay out
    assert.equal(
      isEmbeddingEligibleForComparison({
        liveEvaluationEvidence: { finalDecision: "blocked" },
        historicalProtectionStatus: "unprotected",
        creationProjectId: PROJECT_NEW,
        currentCreationProjectId: PROJECT_NEW,
      }),
      false,
    );
  });

  it("6. threshold remains 0.45", () => {
    assert.equal(FACE_SIMILARITY_EUCLIDEAN_DUPLICATE_THRESHOLD, 0.45);
    assert.equal(FACE_SIMILARITY_THRESHOLD_VERSION, "v1.0.0");
    assert.equal(FACE_SIMILARITY_COSINE_DUPLICATE_THRESHOLD, 1 - 0.45 / 2);
  });

  it("7. embeddings/evaluator version unchanged", () => {
    assert.equal(FACE_SIMILARITY_EVALUATOR_VERSION, "local-vladmandic-1.7.x-v1");
    const thresholdSrc = readFileSync(
      join(process.cwd(), "lib/persona/face-novelty-memory/similarity-threshold.ts"),
      "utf8",
    );
    assert.match(thresholdSrc, /FACE_SIMILARITY_EUCLIDEAN_DUPLICATE_THRESHOLD = 0\.45/);
  });

  it("8. old records remain stored (eligibility filter only)", async () => {
    const embRepo = new MemoryEmbeddingRepository();
    embRepo.saveWithContext({
      noveltyRecordId: "rec-audit-keep",
      workspaceId: WS,
      assetId: "asset-audit",
      candidateId: "cand-audit",
      creationProjectId: PROJECT_OLD,
      liveEvaluationEvidence: { finalDecision: "allowed" },
      historicalProtectionStatus: "unprotected",
      embedding: makeEmbedding(0.7),
      embeddingDimension: 128,
      embeddingModel: "faceRecognitionNet",
      embeddingVersion: FACE_SIMILARITY_EVALUATOR_VERSION,
      detectionConfidence: 0.9,
      faceCount: 1,
      detectionStatus: "performed",
      similarityThresholdVersion: FACE_SIMILARITY_THRESHOLD_VERSION,
    });
    assert.equal(await embRepo.hasEmbedding("rec-audit-keep", WS), true);
    const pool = await embRepo.loadEmbeddingsForWorkspace(WS, ARCH, {
      currentCreationProjectId: PROJECT_NEW,
    });
    assert.equal(pool.length, 0);
  });

  it("9. promotion to protected identity is explicit and auditable", async () => {
    const repo = new MemoryNoveltyRepository();
    const rec = await registerGeneratedCandidate(repo, {
      workspaceId: WS,
      archetypeId: ARCH,
      creationProjectId: PROJECT_OLD,
      candidateId: "cand-promote",
      assetId: "asset-promote",
      identityFingerprint: "fp-promote-2-2g",
      sourceProvider: PROVIDER,
      sourceModel: MODEL,
    });
    await markCandidateShown(repo, rec.id, WS);

    const before = await repo.findByCandidateId("cand-promote", WS);
    assert.equal(before?.historicalProtectionStatus ?? "unprotected", "unprotected");

    const first = await promoteToHistoricallyProtectedIdentity(repo, {
      workspaceId: WS,
      candidateId: "cand-promote",
      status: "selected_brand_face",
      reason: "candidate_selected",
      source: "test.select",
    });
    assert.equal(first.promoted, true);
    assert.equal(first.nextStatus, "selected_brand_face");
    assert.ok(first.record?.historicalProtectionPromotedAt);
    assert.equal(first.record?.historicalProtectionSource, "test.select");

    const strengthened = await promoteToHistoricallyProtectedIdentity(repo, {
      workspaceId: WS,
      candidateId: "cand-promote",
      status: "identity_locked",
      reason: "identity_locked",
      source: "test.lock",
    });
    assert.equal(strengthened.promoted, true);
    assert.equal(strengthened.previousStatus, "selected_brand_face");
    assert.equal(strengthened.nextStatus, "identity_locked");

    // No downgrade
    const noDowngrade = await promoteToHistoricallyProtectedIdentity(repo, {
      workspaceId: WS,
      candidateId: "cand-promote",
      status: "selected_brand_face",
      reason: "candidate_selected",
      source: "test.reselect",
    });
    assert.equal(noDowngrade.promoted, false);
    assert.equal(noDowngrade.nextStatus, "identity_locked");

    assert.equal(
      resolveStrongerProtectionStatus("selected_brand_face", "brand_cast_approved"),
      "brand_cast_approved",
    );
  });

  it("10. no paid provider calls in tests + migration present", () => {
    const mig = join(
      process.cwd(),
      "supabase/migrations/20260807220000_persona_face_novelty_historical_protection_2_2g.sql",
    );
    assert.ok(existsSync(mig), "Phase 2.2G migration must exist");
    const src = readFileSync(mig, "utf8");
    assert.match(src, /historical_protection_status/);
    assert.match(src, /selected_brand_face/);
    assert.doesNotMatch(src, /DELETE FROM persona_face_novelty/);
  });
});
