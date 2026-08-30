/**
 * Phase 2.5B.4 — Simplify OpenAI face discovery / stop over-blocking.
 * Config + policy only — zero paid provider calls.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  FACE_SIMILARITY_EUCLIDEAN_DUPLICATE_THRESHOLD,
  FACE_SIMILARITY_EUCLIDEAN_WARNING_THRESHOLD,
  FACE_SIMILARITY_THRESHOLD_VERSION,
  DISCOVERY_HARD_DUPLICATE_THRESHOLD,
  DISCOVERY_WARNING_THRESHOLD,
  DISCOVERY_SIMILARITY_THRESHOLD_VERSION,
  classifyDiscoveryFaceDistance,
  compareEmbeddings,
  resolveNoveltyCandidateStatus,
  evaluateDiscoveryNovelty,
  NullFaceSimilarityEvaluator,
} from "@/lib/persona/face-novelty-memory";
import { LocalFaceEmbeddingEvaluator } from "@/lib/persona/face-novelty-memory/local-face-embedding-evaluator";
import {
  IDENTITY_CONSISTENCY_MATCH_EUCLIDEAN,
  IDENTITY_CONSISTENCY_WARNING_EUCLIDEAN,
} from "@/lib/persona/creation/reference-package/identity-consistency";
import {
  URBAN_CASTING_DIVERSITY_FACE_GEOMETRY,
  URBAN_CASTING_DIVERSITY_HAIR_SILHOUETTES,
  urbanSiblingSeparationEscalationSuffix,
  urbanSlotFaceDiversityBlock,
} from "@/lib/persona/creation/candidate-intelligence";
import { DEFAULT_DISCOVERY_PROVIDER } from "@/lib/persona/creation/provider/discovery-provider-config";
import { canSelectCandidateOnBoard } from "@/lib/persona/face-novelty-memory/board-visibility";

const ROOT = process.cwd();

describe("Phase 2.5B.4 — discovery novelty PASS / WARNING / HARD_DUPLICATE", () => {
  it("1. identity-lock thresholds remain untouched at 0.45 / 0.55", () => {
    assert.equal(FACE_SIMILARITY_EUCLIDEAN_DUPLICATE_THRESHOLD, 0.45);
    assert.equal(FACE_SIMILARITY_EUCLIDEAN_WARNING_THRESHOLD, 0.55);
    assert.equal(FACE_SIMILARITY_THRESHOLD_VERSION, "v1.0.0");
    assert.equal(
      IDENTITY_CONSISTENCY_MATCH_EUCLIDEAN,
      FACE_SIMILARITY_EUCLIDEAN_DUPLICATE_THRESHOLD,
    );
    assert.equal(
      IDENTITY_CONSISTENCY_WARNING_EUCLIDEAN,
      FACE_SIMILARITY_EUCLIDEAN_WARNING_THRESHOLD,
    );
  });

  it("2. discovery hard-duplicate threshold is stricter than identity-lock", () => {
    assert.equal(DISCOVERY_HARD_DUPLICATE_THRESHOLD, 0.3);
    assert.equal(DISCOVERY_WARNING_THRESHOLD, 0.45);
    assert.ok(
      DISCOVERY_HARD_DUPLICATE_THRESHOLD <
        FACE_SIMILARITY_EUCLIDEAN_DUPLICATE_THRESHOLD,
    );
    assert.equal(
      DISCOVERY_SIMILARITY_THRESHOLD_VERSION,
      "discovery-v2.5b4",
    );
  });

  it("3. classifyDiscoveryFaceDistance maps PASS / WARNING / HARD_DUPLICATE", () => {
    assert.equal(classifyDiscoveryFaceDistance(0.5), "PASS");
    assert.equal(classifyDiscoveryFaceDistance(0.4), "WARNING");
    assert.equal(classifyDiscoveryFaceDistance(0.45), "WARNING");
    assert.equal(classifyDiscoveryFaceDistance(0.3), "HARD_DUPLICATE");
    assert.equal(classifyDiscoveryFaceDistance(0.12), "HARD_DUPLICATE");
    assert.equal(classifyDiscoveryFaceDistance(null), "PASS");
  });

  it("4. compareEmbeddings with discovery thresholds: normal similarity warns, near-identical hard-duplicates", () => {
    const base = new Array(128).fill(0);
    base[0] = 1;
    const near = new Array(128).fill(0);
    near[0] = 0.999;
    near[1] = Math.sqrt(1 - 0.999 ** 2);

    const hard = compareEmbeddings({
      candidateEmbedding: base,
      priorEmbeddings: [
        { assetId: "a1", candidateId: "c1", embedding: near },
      ],
      euclideanDuplicateThreshold: DISCOVERY_HARD_DUPLICATE_THRESHOLD,
      euclideanWarningThreshold: DISCOVERY_WARNING_THRESHOLD,
    });
    // Near-identical unit vectors → very small distance → HARD
    assert.equal(hard.isDuplicate, true);
    assert.ok((hard.closestDistance ?? 1) <= DISCOVERY_HARD_DUPLICATE_THRESHOLD);

    // Distinct enough pair for PASS under discovery hard threshold.
    const far = new Array(128).fill(0);
    far[2] = 1;
    const pass = compareEmbeddings({
      candidateEmbedding: base,
      priorEmbeddings: [
        { assetId: "a2", candidateId: "c2", embedding: far },
      ],
      euclideanDuplicateThreshold: DISCOVERY_HARD_DUPLICATE_THRESHOLD,
      euclideanWarningThreshold: DISCOVERY_WARNING_THRESHOLD,
    });
    assert.equal(pass.isDuplicate, false);
    assert.equal(classifyDiscoveryFaceDistance(pass.closestDistance), "PASS");
  });

  it("4b. mid-band distance is WARNING (not hard duplicate) under discovery thresholds", () => {
    // Construct nearly-orthogonal-ish pair then nudge into ~0.40 band via known pair.
    // Unit vectors e0 and slightly rotated: dist = sqrt(2-2cosθ).
    const a = new Array(128).fill(0);
    a[0] = 1;
    const targetDist = 0.4;
    const cos = 1 - (targetDist * targetDist) / 2;
    const b = new Array(128).fill(0);
    b[0] = cos;
    b[1] = Math.sqrt(Math.max(0, 1 - cos * cos));
    const mid = compareEmbeddings({
      candidateEmbedding: a,
      priorEmbeddings: [
        { assetId: "a3", candidateId: "c3", embedding: b },
      ],
      euclideanDuplicateThreshold: DISCOVERY_HARD_DUPLICATE_THRESHOLD,
      euclideanWarningThreshold: DISCOVERY_WARNING_THRESHOLD,
    });
    assert.equal(mid.isDuplicate, false);
    assert.equal(mid.isWarning, true);
    assert.equal(
      classifyDiscoveryFaceDistance(mid.closestDistance),
      "WARNING",
    );
  });

  it("5. WARNING soft reason stays ready/selectable — not novelty_blocked", () => {
    const status = resolveNoveltyCandidateStatus({
      hardReject: false,
      softWarning: true,
      softWarningReason: "face_similarity_warning",
      evaluationStatus: "performed",
      detectionStatus: "performed",
      evaluatorActive: true,
      failureMode: "fail_closed",
    });
    assert.equal(status.status, "ready");
    assert.equal(status.finalDecision, "allowed");
    assert.equal(status.requiresReplacementConfirmation, false);
    assert.equal(canSelectCandidateOnBoard({ status: "ready" }), true);
  });

  it("6. HARD face_similarity_duplicate still blocks and requires Generate New Face", () => {
    const status = resolveNoveltyCandidateStatus({
      hardReject: true,
      hardRejectReason: "face_similarity_duplicate",
      evaluationStatus: "performed",
      detectionStatus: "performed",
      evaluatorActive: true,
      failureMode: "fail_closed",
    });
    assert.equal(status.status, "novelty_blocked");
    assert.equal(status.finalDecision, "blocked");
    assert.equal(status.requiresReplacementConfirmation, true);
  });

  it("7. LocalFaceEmbeddingEvaluator defaults to discovery thresholds", () => {
    const evaluator = new LocalFaceEmbeddingEvaluator([]);
    assert.ok(evaluator);
    const src = readFileSync(
      join(ROOT, "lib/persona/face-novelty-memory/local-face-embedding-evaluator.ts"),
      "utf8",
    );
    assert.match(src, /DISCOVERY_HARD_DUPLICATE_THRESHOLD/);
    assert.match(src, /mode \?\? "discovery"/);
  });

  it("8. Urban prompts are simplified; retries ask for a clearly different person", () => {
    const block = urbanSlotFaceDiversityBlock("D", { escalationLevel: 2 });
    assert.match(block, /clearly different person/i);
    assert.doesNotMatch(block, /MANDATORY/);
    assert.doesNotMatch(block, /SIBLING-SEPARATION ESCALATION LEVEL/);
    const retry = urbanSiblingSeparationEscalationSuffix("D", 2);
    assert.match(retry, /clearly different person/i);
    assert.notEqual(
      URBAN_CASTING_DIVERSITY_FACE_GEOMETRY.A,
      URBAN_CASTING_DIVERSITY_FACE_GEOMETRY.D,
    );
    assert.notEqual(
      URBAN_CASTING_DIVERSITY_HAIR_SILHOUETTES.A,
      URBAN_CASTING_DIVERSITY_HAIR_SILHOUETTES.B,
    );
  });

  it("9. OpenAI remains default; no FLUX silent fallback", () => {
    assert.equal(DEFAULT_DISCOVERY_PROVIDER, "openai");
    const configSrc = readFileSync(
      join(ROOT, "lib/persona/creation/provider/discovery-provider-config.ts"),
      "utf8",
    );
    assert.match(
      configSrc,
      /export const DEFAULT_DISCOVERY_PROVIDER: DiscoveryProviderId = "openai"/,
    );
    assert.doesNotMatch(
      configSrc,
      /export const DEFAULT_DISCOVERY_PROVIDER: DiscoveryProviderId = "fal_flux"/,
    );
  });

  it("10. first Brand Model / identity-lock protection constants remain in place", () => {
    const identity = readFileSync(
      join(
        ROOT,
        "lib/persona/creation/reference-package/identity-consistency.ts",
      ),
      "utf8",
    );
    assert.match(identity, /FACE_SIMILARITY_EUCLIDEAN_DUPLICATE_THRESHOLD/);
    assert.match(identity, /do NOT change FACE_SIMILARITY_EUCLIDEAN_DUPLICATE_THRESHOLD/);
    assert.equal(FACE_SIMILARITY_EUCLIDEAN_DUPLICATE_THRESHOLD, 0.45);
  });

  it("11. UI shows the German similarity-warning affordance for WARNING candidates", () => {
    const board = readFileSync(
      join(ROOT, "components/persona/candidate-board.tsx"),
      "utf8",
    );
    assert.match(board, /Ähnlichkeit prüfen/);
    assert.match(board, /discoveryNovelty/);
  });

  it("12. zero provider calls — Null evaluator path still evaluates without OpenAI", async () => {
    const evaluation = await evaluateDiscoveryNovelty({
      candidateId: "c-new",
      assetId: "a-new",
      creationProjectId: "proj",
      identityFingerprint: "fp-unique",
      assetRef: {
        assetId: "a-new",
        candidateId: "c-new",
        imageChecksum: "chk-new",
        storageObjectKey: "path/new",
      },
      history: {
        workspaceId: "ws",
        archetypeId: "arch",
        totalShown: 0,
        totalExhausted: 0,
        totalSaved: 0,
        totalApproved: 0,
        totalRejected: 0,
        priorAssetReferences: [],
        forbiddenIdentityFingerprints: new Set(),
        forbiddenImageChecksums: new Set(),
        forbiddenPerceptualHashes: new Set(),
        forbiddenStorageKeys: new Set(),
      },
      faceSimilarityEvaluator: new NullFaceSimilarityEvaluator(),
    });
    assert.equal(evaluation.hardReject, false);
  });
});
