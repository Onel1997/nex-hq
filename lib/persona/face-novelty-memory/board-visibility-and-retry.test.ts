/**
 * Phase 2.0B.3 — Fail-closed board visibility, failure-slot DTOs,
 * signed-URL debug leak prevention, and retry evaluation (no paid calls).
 */

import assert from "node:assert/strict";
import { after, before, beforeEach, afterEach, describe, it } from "node:test";
import { randomUUID } from "node:crypto";
import {
  partitionBoardCandidates,
  isNoveltyBoardVisible,
  toNoveltyFailureSlot,
  canSelectCandidateOnBoard,
} from "./board-visibility";
import {
  assertNoSignedUrlLeakage,
  buildCopyDebugPayload,
  buildRunLiveDebug,
  buildSafeFaceNoveltyLiveDebug,
  calculateHistoricalEmbeddingCoverage,
  PERSONA_FACE_NOVELTY_DEBUG_ENV,
  redactAssetPathForDebug,
} from "./live-debug";
import {
  resolveNoveltyCandidateStatus,
  assertCandidateMayBecomeReady,
  isCandidateVisibleOnBoard,
} from "./visibility-assertion";
import { MemoryNoveltyRepository } from "./novelty-repository";
import { MemoryEmbeddingRepository } from "./embedding-repository";
import { MemoryLiveDiagnosticStore } from "./diagnostic-store";
import { checkAndRegisterCandidate } from "./novelty-service";
import { loadDiscoveryHistory } from "./discovery-history";
import { buildIdentityFingerprint } from "./identity-fingerprint";
import { retryFaceNoveltyEvaluation } from "./retry-evaluation";
import type { FaceSimilarityEvaluator, FaceSimilarityResult } from "./types";
import type { PersonaCandidate } from "../domain/creation-types";
import {
  MemoryCreationRepository,
  setCreationRepositoryForTests,
} from "@/lib/persona";
import type { WorkspaceScope } from "../domain/types";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const WS = "ws-board-vis-001";
const ARCH = "milaene_mediterranean_premium_hero";
const PROJECT = "proj-board-vis-001";
const scope: WorkspaceScope = { workspaceId: WS, actorId: "tester" };

function makeFp(id: string): string {
  return buildIdentityFingerprint({
    archetypeId: ARCH,
    blueprintId: "bp-1",
    runVariationToken: id,
  });
}

function makeCandidate(
  overrides: Partial<PersonaCandidate> &
    Pick<PersonaCandidate, "id" | "status" | "candidate_number">,
): PersonaCandidate {
  const {
    id,
    status,
    candidate_number,
    primary_preview_asset_id,
    generation_settings,
    user_notes,
    rejection_reason,
    ...rest
  } = overrides;
  return {
    id,
    workspace_id: WS,
    creation_project_id: PROJECT,
    candidate_number,
    candidate_name: `C${candidate_number}`,
    status,
    provider: "openai",
    provider_job_id: null,
    identity_summary: "",
    distinguishing_features: "",
    brand_fit_score: null,
    primary_preview_asset_id: primary_preview_asset_id ?? "asset-1",
    generation_settings: generation_settings ?? {},
    user_notes: user_notes ?? "",
    rejection_reason: rejection_reason ?? "",
    selected_at: null,
    actual_generation_cost: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...rest,
  } as PersonaCandidate;
}

class LocalMethodEvaluator implements FaceSimilarityEvaluator {
  readonly method = "local-face-embedding-v1";
  constructor(
    private readonly result: FaceSimilarityResult & Record<string, unknown>,
  ) {}
  async evaluate(): Promise<FaceSimilarityResult> {
    return { ...this.result, method: this.method };
  }
}

let prevDebug: string | undefined;
let prevFailureMode: string | undefined;

before(() => {
  prevDebug = process.env[PERSONA_FACE_NOVELTY_DEBUG_ENV];
  prevFailureMode = process.env.FACE_EVALUATOR_FAILURE_MODE;
  process.env[PERSONA_FACE_NOVELTY_DEBUG_ENV] = "true";
  process.env.FACE_EVALUATOR_FAILURE_MODE = "fail_closed";
});

after(() => {
  if (prevDebug === undefined) delete process.env[PERSONA_FACE_NOVELTY_DEBUG_ENV];
  else process.env[PERSONA_FACE_NOVELTY_DEBUG_ENV] = prevDebug;
  if (prevFailureMode === undefined) delete process.env.FACE_EVALUATOR_FAILURE_MODE;
  else process.env.FACE_EVALUATOR_FAILURE_MODE = prevFailureMode;
});

describe("1–2. novelty_failed / novelty_blocked images not returned", () => {
  it("failed and blocked partition into failure slots without image fields", () => {
    const failed = makeCandidate({
      id: "cand-fail",
      status: "novelty_failed",
      candidate_number: 1,
      primary_preview_asset_id: "secret-asset",
      user_notes: "[novelty] face_similarity_evaluator_error",
    });
    const blocked = makeCandidate({
      id: "cand-block",
      status: "novelty_blocked",
      candidate_number: 2,
      primary_preview_asset_id: "secret-asset-2",
      generation_settings: {
        faceNoveltyLiveDebug: buildSafeFaceNoveltyLiveDebug({
          finalDecision: "blocked",
          requiresReplacementConfirmation: true,
          faceDetectionStatus: "no_face",
          hardRejectReason: "no_face",
        }),
      },
    });
    const { visibleCandidates, failureSlots } = partitionBoardCandidates([
      failed,
      blocked,
    ]);
    assert.equal(visibleCandidates.length, 0);
    assert.equal(failureSlots.length, 2);
    assert.deepEqual(
      failureSlots.map((s) => s.status).sort(),
      ["novelty_blocked", "novelty_failed"],
    );
    for (const slot of failureSlots) {
      assert.ok(!("primary_preview_asset_id" in slot));
      assert.ok(!("signedUrl" in slot));
      assert.ok(!("previewUrl" in slot));
      assert.equal(typeof slot.reason, "string");
    }
    const blockedSlot = failureSlots.find((s) => s.status === "novelty_blocked");
    const failedSlot = failureSlots.find((s) => s.status === "novelty_failed");
    assert.equal(blockedSlot?.requiresReplacementConfirmation, true);
    assert.equal(failedSlot?.requiresReplacementConfirmation, false);
  });
});

describe("3. not_performed candidate is not visible", () => {
  it("ready + not_performed debug is hidden", () => {
    const c = makeCandidate({
      id: "cand-np",
      status: "ready",
      candidate_number: 1,
      generation_settings: {
        faceNoveltyLiveDebug: buildSafeFaceNoveltyLiveDebug({
          finalDecision: "allowed",
          requiresReplacementConfirmation: false,
          faceDetectionStatus: "unavailable",
        }),
      },
    });
    assert.equal(isNoveltyBoardVisible(c), false);
  });
});

describe("4. only performed + allowed becomes ready/visible", () => {
  it("ready + performed + allowed is visible", () => {
    const c = makeCandidate({
      id: "cand-ok",
      status: "ready",
      candidate_number: 1,
      generation_settings: {
        faceNoveltyLiveDebug: buildSafeFaceNoveltyLiveDebug({
          finalDecision: "allowed",
          requiresReplacementConfirmation: false,
          faceDetectionStatus: "performed",
        }),
      },
    });
    assert.equal(isNoveltyBoardVisible(c), true);
    const status = resolveNoveltyCandidateStatus({
      hardReject: false,
      evaluationStatus: "performed",
      detectionStatus: "performed",
      evaluatorActive: true,
    });
    assert.equal(status.status, "ready");
    assert.equal(status.finalDecision, "allowed");
    assert.doesNotThrow(() =>
      assertCandidateMayBecomeReady({
        proposedStatus: "ready",
        evaluationStatus: "performed",
        finalDecision: "allowed",
        detectionStatus: "performed",
      }),
    );
  });
});

describe("5. Candidate Board receives empty failure-slot DTO", () => {
  it("toNoveltyFailureSlot returns safe DTO only", () => {
    const slot = toNoveltyFailureSlot(
      makeCandidate({
        id: "cand-f",
        status: "novelty_failed",
        candidate_number: 3,
        primary_preview_asset_id: "should-not-leak",
      }),
    );
    assert.ok(slot);
    assert.equal(slot!.slot, 3);
    assert.equal(slot!.status, "novelty_failed");
    assert.equal(JSON.stringify(slot).includes("should-not-leak"), false);
  });
});

describe("6–7. failed/blocked cannot be selected", () => {
  it("canSelectCandidateOnBoard is false for novelty statuses", () => {
    assert.equal(canSelectCandidateOnBoard({ status: "novelty_failed" }), false);
    assert.equal(canSelectCandidateOnBoard({ status: "novelty_blocked" }), false);
    assert.equal(canSelectCandidateOnBoard({ status: "ready" }), true);
    assert.equal(isCandidateVisibleOnBoard("novelty_failed"), false);
    assert.equal(isCandidateVisibleOnBoard("novelty_blocked"), false);
  });
});

describe("8–12. retry evaluation reuses image, no paid calls", () => {
  let creationRepo: MemoryCreationRepository;
  let noveltyRepo: MemoryNoveltyRepository;
  let embeddingRepo: MemoryEmbeddingRepository;
  let diagnosticStore: MemoryLiveDiagnosticStore;

  beforeEach(() => {
    creationRepo = new MemoryCreationRepository();
    noveltyRepo = new MemoryNoveltyRepository();
    embeddingRepo = new MemoryEmbeddingRepository();
    diagnosticStore = new MemoryLiveDiagnosticStore();
    setCreationRepositoryForTests(creationRepo);
    process.env[PERSONA_FACE_NOVELTY_DEBUG_ENV] = "true";
  });

  afterEach(() => {
    setCreationRepositoryForTests(null);
  });

  it("retry reuses stored image, makes zero OpenAI/paid calls, may become ready", async () => {
    const project = await creationRepo.createProject(scope, {
      name: "Retry Project",
      brand_role: "primary_male",
      candidate_count: 1,
    } as never);
    const candidate = await creationRepo.createCandidate(scope, {
      creation_project_id: project.id,
      candidate_number: 1,
      candidate_name: "Retry Cand",
      status: "novelty_failed",
      provider: "openai",
      provider_job_id: null,
      generation_seed: null,
      generation_prompt: "",
      negative_prompt: "",
      generation_settings: {},
      identity_summary: "",
      distinguishing_features: "",
      visual_strengths: "",
      visual_risks: "",
      brand_fit_score: null,
      identity_consistency_score: null,
      realism_score: null,
      video_suitability_score: null,
      user_rating: null,
      user_notes: "",
      rejection_reason: "",
    } as never);
    const assetId = randomUUID();
    const asset = await creationRepo.createCandidateAsset(scope, {
      candidate_id: candidate.id,
      asset_type: "portrait_front",
      storage_path: `workspace/${WS}/persona-creation/${project.id}/candidates/${candidate.id}/${assetId}-front.png`,
      mime_type: "image/png",
      width: 1,
      height: 1,
      file_size_bytes: 68,
      checksum: "abc",
      provider_output_id: null,
      generation_metadata: {},
      status: "ready",
      is_primary: true,
    });
    await creationRepo.updateCandidate(scope, candidate.id, {
      primary_preview_asset_id: asset.id,
      status: "novelty_failed",
      user_notes: "[novelty] face_similarity_evaluator_error",
    });

    const emb = Array.from({ length: 128 }, (_, i) => Math.sin(i));
    const recordId = randomUUID();
    await noveltyRepo.upsert({
      id: recordId,
      workspaceId: WS,
      archetypeId: ARCH,
      creationProjectId: project.id,
      candidateId: candidate.id,
      assetId: asset.id,
      state: "exhausted",
      identityFingerprint: makeFp("retry-1"),
      sourceProvider: "openai",
      sourceModel: "dall-e-3",
      createdAt: new Date().toISOString(),
    });

    const openaiCalls = 0;
    const paidCalls = 0;
    let imageLoads = 0;

    const result = await retryFaceNoveltyEvaluation(scope, candidate.id, {
      noveltyRepo,
      embeddingRepo,
      diagnosticStore,
      loadImageBytes: async () => {
        imageLoads += 1;
        return Buffer.from("fake-png");
      },
      buildEvaluator: async () => {
        // Simulate successful local evaluation — no OpenAI.
        return new LocalMethodEvaluator({
          status: "performed",
          method: "local-face-embedding-v1",
          isDuplicate: false,
          similarity: 0.1,
          threshold: 0.6,
          _detectionStatus: "performed",
          _faceCount: 1,
          _detectionConfidence: 0.99,
          _embedding: emb,
        });
      },
    });

    assert.equal(result.reusedExistingImage, true);
    assert.equal(result.openaiCalls, 0);
    assert.equal(result.paidProviderCalls, 0);
    assert.equal(openaiCalls, 0);
    assert.equal(paidCalls, 0);
    assert.equal(imageLoads, 1);
    assert.equal(result.candidateStatus, "ready");
    assert.equal(result.finalDecision, "allowed");
    assert.equal(result.visibleOnBoard, true);

    const updated = await creationRepo.getCandidate(scope, candidate.id);
    assert.equal(updated?.status, "ready");

    const evidence = await diagnosticStore.loadEvidence(recordId, WS);
    assert.ok(evidence);
    assert.equal(evidence!.finalDecision, "allowed");
  });

  it("failed retry remains hidden", async () => {
    const project = await creationRepo.createProject(scope, {
      name: "Retry Fail Project",
      brand_role: "primary_male",
      candidate_count: 1,
    } as never);
    const candidate = await creationRepo.createCandidate(scope, {
      creation_project_id: project.id,
      candidate_number: 1,
      candidate_name: "Fail Cand",
      status: "novelty_failed",
      provider: "openai",
      provider_job_id: null,
      generation_seed: null,
      generation_prompt: "",
      negative_prompt: "",
      generation_settings: {},
      identity_summary: "",
      distinguishing_features: "",
      visual_strengths: "",
      visual_risks: "",
      brand_fit_score: null,
      identity_consistency_score: null,
      realism_score: null,
      video_suitability_score: null,
      user_rating: null,
      user_notes: "",
      rejection_reason: "",
    } as never);
    const asset = await creationRepo.createCandidateAsset(scope, {
      candidate_id: candidate.id,
      asset_type: "portrait_front",
      storage_path: `workspace/${WS}/p/${project.id}/c/${candidate.id}/a.png`,
      mime_type: "image/png",
      width: 1,
      height: 1,
      file_size_bytes: 10,
      checksum: "x",
      provider_output_id: null,
      generation_metadata: {},
      status: "ready",
      is_primary: true,
    });
    await creationRepo.updateCandidate(scope, candidate.id, {
      primary_preview_asset_id: asset.id,
      status: "novelty_failed",
    });
    await noveltyRepo.upsert({
      id: randomUUID(),
      workspaceId: WS,
      archetypeId: ARCH,
      creationProjectId: project.id,
      candidateId: candidate.id,
      assetId: asset.id,
      state: "exhausted",
      identityFingerprint: makeFp("retry-fail"),
      sourceProvider: "openai",
      sourceModel: "dall-e-3",
      createdAt: new Date().toISOString(),
    });

    const result = await retryFaceNoveltyEvaluation(scope, candidate.id, {
      noveltyRepo,
      embeddingRepo,
      diagnosticStore,
      loadImageBytes: async () => Buffer.from("x"),
      buildEvaluator: async () =>
        new LocalMethodEvaluator({
          status: "not_available",
          method: "local-face-embedding-v1",
          _detectionStatus: "error",
          _safeErrorCode: "faceapi_canvas_not_patched_or_invalid_media",
          _safeErrorMessage: "toNetInput - expected media…",
        }),
    });

    assert.equal(result.candidateStatus, "novelty_failed");
    assert.equal(result.visibleOnBoard, false);
    assert.equal(result.openaiCalls, 0);
    assert.equal(result.paidProviderCalls, 0);
    assert.ok(result.safeErrorCode);
  });
  it("retry executes in development even when PERSONA_FACE_NOVELTY_DEBUG is unset", async () => {
    delete process.env[PERSONA_FACE_NOVELTY_DEBUG_ENV];
    const project = await creationRepo.createProject(scope, {
      name: "Retry No Flag",
      brand_role: "primary_male",
      candidate_count: 1,
    } as never);
    const candidate = await creationRepo.createCandidate(scope, {
      creation_project_id: project.id,
      candidate_number: 1,
      candidate_name: "No Flag Cand",
      status: "novelty_failed",
      provider: "openai",
      provider_job_id: null,
      generation_seed: null,
      generation_prompt: "",
      negative_prompt: "",
      generation_settings: {},
      identity_summary: "",
      distinguishing_features: "",
      visual_strengths: "",
      visual_risks: "",
      brand_fit_score: null,
      identity_consistency_score: null,
      realism_score: null,
      video_suitability_score: null,
      user_rating: null,
      user_notes: "",
      rejection_reason: "",
    } as never);
    const asset = await creationRepo.createCandidateAsset(scope, {
      candidate_id: candidate.id,
      asset_type: "portrait_front",
      storage_path: `workspace/${WS}/p/${project.id}/c/${candidate.id}/a.png`,
      mime_type: "image/png",
      width: 1,
      height: 1,
      file_size_bytes: 10,
      checksum: "x",
      provider_output_id: null,
      generation_metadata: {},
      status: "ready",
      is_primary: true,
    });
    await creationRepo.updateCandidate(scope, candidate.id, {
      primary_preview_asset_id: asset.id,
      status: "novelty_failed",
    });
    await noveltyRepo.upsert({
      id: randomUUID(),
      workspaceId: WS,
      archetypeId: ARCH,
      creationProjectId: project.id,
      candidateId: candidate.id,
      assetId: asset.id,
      state: "exhausted",
      identityFingerprint: makeFp("no-flag"),
      sourceProvider: "openai",
      sourceModel: "dall-e-3",
      createdAt: new Date().toISOString(),
    });

    const emb = Array.from({ length: 128 }, (_, i) => Math.cos(i));
    const result = await retryFaceNoveltyEvaluation(scope, candidate.id, {
      noveltyRepo,
      embeddingRepo,
      diagnosticStore,
      loadImageBytes: async () => Buffer.from("png"),
      buildEvaluator: async () =>
        new LocalMethodEvaluator({
          status: "performed",
          method: "local-face-embedding-v1",
          isDuplicate: false,
          similarity: 0.05,
          threshold: 0.6,
          _detectionStatus: "performed",
          _faceCount: 1,
          _detectionConfidence: 0.99,
          _embedding: emb,
        }),
    });

    assert.equal(result.lastCheckpoint, "retry_completed");
    assert.equal(result.candidateStatus, "ready");
    const updated = await creationRepo.getCandidate(scope, candidate.id);
    assert.equal(updated?.status, "ready");
  });
});

describe("13. live route runs in Node.js runtime", () => {
  it("creation project + novelty-debug + candidates routes export runtime=nodejs", () => {
    const roots = [
      "app/api/persona/creation-projects/[id]/route.ts",
      "app/api/persona/creation-projects/[id]/novelty-debug/route.ts",
      "app/api/persona/creation-projects/[id]/candidates/route.ts",
      "app/api/persona/candidates/[id]/route.ts",
    ];
    for (const rel of roots) {
      const src = readFileSync(join(process.cwd(), rel), "utf8");
      assert.match(src, /export const runtime = ["']nodejs["']/);
    }
  });
});

describe("14. evaluator error is persisted safely", () => {
  it("checkAndRegisterCandidate persists safeErrorCode without signed URLs", async () => {
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
        candidateId: "cand-safe-err",
        assetId: "asset-safe-err",
        identityFingerprint: makeFp("safe-err"),
        signedUrl:
          "https://xxx.supabase.co/storage/v1/object/sign/persona-references/foo?token=SECRET",
        sourceProvider: "openai",
        sourceModel: "dall-e-3",
      },
      {
        evaluatorActive: true,
        diagnosticStore: store,
        evaluator: new LocalMethodEvaluator({
          status: "not_available",
          method: "local-face-embedding-v1",
          _detectionStatus: "error",
          _safeErrorCode: "faceapi_canvas_not_patched_or_invalid_media",
          _safeErrorMessage:
            "toNetInput - expected media to be of type HTMLImageElement",
        }),
      },
    );
    assert.equal(check.candidateStatus, "novelty_failed");
    const evidence = await store.loadEvidence(check.recordId, WS);
    assert.ok(evidence);
    assert.equal(
      evidence!.safeErrorCode,
      "faceapi_canvas_not_patched_or_invalid_media",
    );
    const json = JSON.stringify(evidence);
    assert.equal(json.includes("?token="), false);
    assert.equal(json.includes("/object/sign/"), false);
    assert.equal(json.includes("SECRET"), false);
  });
});

describe("15–16. copied debug contains no signed URLs / tokens", () => {
  it("assertNoSignedUrlLeakage rejects token and sign URLs", () => {
    assert.throws(() =>
      assertNoSignedUrlLeakage(
        JSON.stringify({
          url: "https://x.supabase.co/storage/v1/object/sign/bucket/key?token=abc",
        }),
      ),
    );
    assert.throws(() =>
      assertNoSignedUrlLeakage(JSON.stringify({ q: "?token=abc" })),
    );
    assert.doesNotThrow(() =>
      assertNoSignedUrlLeakage(
        JSON.stringify({ assetId: "a1", candidateId: "c1", projectId: "p1" }),
      ),
    );
  });

  it("buildCopyDebugPayload and redactAssetPathForDebug never leak signed URLs", () => {
    const run = buildRunLiveDebug({
      projectId: PROJECT,
      archetypeId: ARCH,
      evaluatorStatus: "active",
      priorEmbeddingsLoaded: 0,
      pipelineStatus: "failed",
    });
    const coverage = calculateHistoricalEmbeddingCoverage([]);
    const payload = buildCopyDebugPayload({
      projectId: PROJECT,
      archetypeId: ARCH,
      run,
      coverage,
      candidates: [
        buildSafeFaceNoveltyLiveDebug({
          finalDecision: "failed",
          requiresReplacementConfirmation: true,
          faceDetectionStatus: "error",
          candidateId: "c1",
          assetId: "a1",
          candidateProjectId: PROJECT,
          safeErrorCode: "faceapi_canvas_not_patched_or_invalid_media",
          safeErrorMessage: "toNetInput - expected media",
        }),
      ],
    });
    const json = JSON.stringify(payload);
    assert.equal(json.includes("?token="), false);
    assert.equal(json.includes("/object/sign/"), false);
    assert.equal(
      redactAssetPathForDebug(
        "https://x.supabase.co/storage/v1/object/sign/persona-references/foo?token=abc",
      ),
      "[redacted-signed-url]",
    );
  });
});

describe("17. existing novelty visibility rules remain green", () => {
  it("evaluator error → novelty_failed; duplicate → novelty_blocked", () => {
    assert.equal(
      resolveNoveltyCandidateStatus({
        hardReject: true,
        hardRejectReason: "face_similarity_evaluator_error",
        detectionStatus: "error",
        evaluatorActive: true,
      }).status,
      "novelty_failed",
    );
    assert.equal(
      resolveNoveltyCandidateStatus({
        hardReject: true,
        hardRejectReason: "face_similarity_duplicate",
        evaluationStatus: "performed",
        detectionStatus: "performed",
        evaluatorActive: true,
      }).status,
      "novelty_blocked",
    );
  });
});
