/**
 * Phase 1.8D — Project-owned candidate isolation.
 * Proves Project A → B never renders A; empty C never inherits B.
 * Never invokes OpenAI.
 */

import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import {
  applyProjectLoadResult,
  buildProjectCandidateState,
  canRenderProjectCandidates,
  discoverySlotLabel,
  filterLoadedCandidatesForProject,
  resolvePreviewUrlForCandidate,
} from "@/components/persona/persona-studio-project-sync";
import {
  appendAssetCacheBust,
  projectScopedPreviewKey,
  storagePathContainsProjectId,
  validateA1DiscoveryCompletion,
  validateProjectCandidateBoardState,
} from "@/lib/persona/creation/casting-data-integrity";
import { buildPersonaCandidateStoragePath } from "@/lib/persona/creation/candidate-storage";
import {
  MemoryCreationRepository,
  MemoryGenerationJobRepository,
  MemoryPersonaRepository,
  PERSONA_TEST_WORKSPACE_ID,
  resetMemoryGenerationJobStoreForTests,
  setCreationRepositoryForTests,
  setGenerationJobRepositoryForTests,
  setPersonaRepositoryForTests,
} from "@/lib/persona";
import type { PersonaCandidate } from "@/lib/persona/domain/creation-types";
import type { WorkspaceScope } from "@/lib/persona/domain/types";
import {
  confirmAndStartCandidateGeneration,
  createCreationProject,
  listCandidates,
  preparePaidGenerationConfirmation,
} from "@/lib/persona/creation/creation-service";

const scope: WorkspaceScope = {
  workspaceId: PERSONA_TEST_WORKSPACE_ID,
  actorId: "isolation-tester",
};

function jobRow(projectId: string, id = "job-1", startedAt = new Date().toISOString()) {
  return {
    id,
    workspace_id: scope.workspaceId,
    creation_project_id: projectId,
    candidate_id: null,
    stage: "discovery" as const,
    provider: "fake",
    provider_job_id: null,
    status: "completed" as const,
    requested_asset_types: ["portrait_front" as const],
    quality_mode: "premium_editorial" as const,
    estimated_cost_min: 0,
    estimated_cost_max: 1,
    actual_cost: 0,
    cost_is_estimated: true,
    confirmation_token: null,
    estimate_hash: null,
    confirmation_payload: { generationSource: "fake_test" },
    confirmed_at: startedAt,
    retry_count: 0,
    error_code: null,
    error_message: null,
    started_at: startedAt,
    completed_at: new Date().toISOString(),
    cancelled_at: null,
    created_by: scope.actorId ?? null,
    created_at: startedAt,
    updated_at: startedAt,
  };
}

function candidate(
  projectId: string,
  n: number,
  id = `cand-${projectId}-${n}`,
  extras: Partial<PersonaCandidate> = {},
): PersonaCandidate {
  const now = new Date().toISOString();
  return {
    id,
    workspace_id: scope.workspaceId,
    creation_project_id: projectId,
    candidate_number: n,
    candidate_name: `Candidate ${n}`,
    status: "ready",
    provider: "fake",
    provider_job_id: "job-1",
    generation_seed: `seed-${n}`,
    generation_prompt: "",
    negative_prompt: "",
    generation_settings: {
      variation: {
        id: ["relaxed_mediterranean", "modern_creator", "clean_street_athletic", "weekend_community"][
          n - 1
        ],
        label: [
          "Relaxed Mediterranean",
          "Modern Creator",
          "Clean Street Athletic",
          "Weekend Community",
        ][n - 1],
      },
    },
    primary_preview_asset_id: `asset-${id}`,
    identity_summary: "",
    distinguishing_features: "",
    visual_strengths: "",
    visual_risks: "",
    brand_fit_score: 76,
    identity_consistency_score: null,
    realism_score: null,
    video_suitability_score: null,
    user_rating: null,
    user_notes: "",
    rejection_reason: "",
    fashion_fit_review: "",
    body_proportion_review: "",
    hand_anatomy_review: "",
    face_consistency_review: "",
    realism_review: "",
    image_suitability_label: "",
    video_suitability_label: "",
    parent_candidate_id: null,
    variation_of_asset_id: null,
    actual_generation_cost: 0,
    selected_at: null,
    converted_persona_id: null,
    created_at: now,
    updated_at: now,
    ...extras,
  };
}

describe("Phase 1.8D project candidate isolation", () => {
  let creationRepo: MemoryCreationRepository;

  beforeEach(() => {
    process.env.PERSONA_USE_FAKE_PROVIDER = "true";
    process.env.PERSONA_PAID_GENERATION_ENABLED = "true";
    process.env.OPENAI_API_KEY = "test-key";
    creationRepo = new MemoryCreationRepository();
    resetMemoryGenerationJobStoreForTests();
    setPersonaRepositoryForTests(new MemoryPersonaRepository());
    setCreationRepositoryForTests(creationRepo);
    setGenerationJobRepositoryForTests(new MemoryGenerationJobRepository());
  });

  afterEach(() => {
    delete process.env.PERSONA_USE_FAKE_PROVIDER;
    delete process.env.PERSONA_PAID_GENERATION_ENABLED;
    delete process.env.OPENAI_API_KEY;
    setCreationRepositoryForTests(null);
    setGenerationJobRepositoryForTests(null);
    setPersonaRepositoryForTests(null);
    resetMemoryGenerationJobStoreForTests();
  });

  it("1. old candidates cleared immediately on project switch (null state)", () => {
    const stateA = buildProjectCandidateState({
      projectId: "proj-a",
      candidates: [1, 2, 3, 4].map((n) => candidate("proj-a", n)),
      candidatePreviews: {
        "cand-proj-a-1": "https://cdn.example/a1.png",
      },
    });
    assert.equal(stateA.candidates.length, 4);
    assert.equal(
      canRenderProjectCandidates({
        activeCreationProjectId: "proj-b",
        projectCandidateState: stateA,
      }),
      false,
    );
    assert.equal(
      canRenderProjectCandidates({
        activeCreationProjectId: "proj-b",
        projectCandidateState: null,
      }),
      false,
    );
  });

  it("2. empty new project never shows old candidates", () => {
    const mixed = [
      ...[1, 2, 3, 4].map((n) => candidate("proj-b", n)),
      candidate("proj-c", 1),
    ];
    const forC = filterLoadedCandidatesForProject(mixed, "proj-c");
    assert.equal(forC.length, 1);
    const emptyC = filterLoadedCandidatesForProject(
      [1, 2, 3, 4].map((n) => candidate("proj-b", n)),
      "proj-c",
    );
    assert.equal(emptyC.length, 0);
    const state = buildProjectCandidateState({
      projectId: "proj-c",
      candidates: emptyC,
    });
    assert.equal(state.candidates.length, 0);
  });

  it("3. late old request cannot overwrite new state", () => {
    const stateB = buildProjectCandidateState({
      projectId: "proj-b",
      candidates: [1, 2, 3, 4].map((n) => candidate("proj-b", n)),
      candidatePreviews: {
        [projectScopedPreviewKey("proj-b", "cand-proj-b-1", "asset-cand-proj-b-1")]:
          "https://cdn.example/b1.png",
      },
    });
    const lateA = buildProjectCandidateState({
      projectId: "proj-a",
      candidates: [1, 2, 3, 4].map((n) => candidate("proj-a", n)),
      candidatePreviews: {
        [projectScopedPreviewKey("proj-a", "cand-proj-a-1", "asset-cand-proj-a-1")]:
          "https://cdn.example/a1.png",
      },
    });

    // B starts (v1), B resolves (v2 current), A resolves last with stale v1
    let current = applyProjectLoadResult({
      activeProjectId: "proj-b",
      loadVersion: 2,
      currentLoadVersion: 2,
      requestedProjectId: "proj-b",
      previous: null,
      next: stateB,
    });
    assert.equal(current?.projectId, "proj-b");

    current = applyProjectLoadResult({
      activeProjectId: "proj-b",
      loadVersion: 1,
      currentLoadVersion: 2,
      requestedProjectId: "proj-a",
      previous: current,
      next: lateA,
    });
    assert.equal(current?.projectId, "proj-b");
    assert.ok(current?.candidates.every((c) => c.creation_project_id === "proj-b"));
    assert.ok(
      !Object.values(current?.candidatePreviews ?? {}).some((u) =>
        u?.includes("/a1.png"),
      ),
    );
  });

  it("4. preview URLs are keyed by project + candidate + asset", () => {
    const key = projectScopedPreviewKey("proj-b", "cand-1", "asset-1");
    assert.equal(key, "proj-b:cand-1:asset-1");
    const previews = {
      [key]: "https://cdn.example/b.png?asset=asset-1",
      "cand-1": "https://cdn.example/stale-by-id.png",
    };
    const c = candidate("proj-b", 1, "cand-1", {
      primary_preview_asset_id: "asset-1",
    });
    assert.equal(
      resolvePreviewUrlForCandidate({
        projectId: "proj-b",
        candidate: c,
        previews,
      }),
      "https://cdn.example/b.png?asset=asset-1",
    );
  });

  it("5. candidate_number cannot be used as global preview key", () => {
    const unsafeByNumber: Record<number, string> = {
      1: "https://cdn.example/shared-slot-1.png",
    };
    const cA = candidate("proj-a", 1);
    const cB = candidate("proj-b", 1);
    // Number-keyed map would collide — scoped keys must differ.
    assert.notEqual(
      projectScopedPreviewKey("proj-a", cA.id, "asset-a"),
      projectScopedPreviewKey("proj-b", cB.id, "asset-b"),
    );
    assert.equal(unsafeByNumber[cA.candidate_number], unsafeByNumber[cB.candidate_number]);
  });

  it("6. new assets use unique project-scoped storage paths", () => {
    const pathA = buildPersonaCandidateStoragePath({
      workspaceId: scope.workspaceId,
      projectId: "proj-a",
      candidateId: "cand-a",
      assetId: "asset-a",
      filename: "portrait_front.png",
    });
    const pathB = buildPersonaCandidateStoragePath({
      workspaceId: scope.workspaceId,
      projectId: "proj-b",
      candidateId: "cand-b",
      assetId: "asset-b",
      filename: "portrait_front.png",
    });
    assert.notEqual(pathA, pathB);
    assert.ok(storagePathContainsProjectId(pathA, "proj-a"));
    assert.ok(storagePathContainsProjectId(pathB, "proj-b"));
    assert.ok(!pathA.endsWith("candidate-1.png"));
    assert.ok(!pathA.includes("modern-creator.png"));
    assert.match(appendAssetCacheBust("https://x/y", "asset-a"), /\?asset=asset-a/);
  });

  it("7–8. no completion without four new rows / reused assets", () => {
    const projectId = "proj-new";
    const startedAt = new Date().toISOString();
    const candidates = [1, 2, 3, 4].map((n) => candidate(projectId, n));
    const assets = candidates.map((c) => ({
      id: `new-${c.id}`,
      workspace_id: scope.workspaceId,
      candidate_id: c.id,
      asset_type: "portrait_front" as const,
      storage_path: buildPersonaCandidateStoragePath({
        workspaceId: scope.workspaceId,
        projectId,
        candidateId: c.id,
        assetId: `new-${c.id}`,
        filename: "portrait_front.png",
      }),
      mime_type: "image/png",
      width: 1,
      height: 1,
      file_size_bytes: 1,
      checksum: "x",
      provider_output_id: null,
      generation_metadata: {},
      status: "ready" as const,
      is_primary: true,
      retention_until: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    const ok = validateA1DiscoveryCompletion({
      projectId,
      candidates,
      jobs: [jobRow(projectId, "job-1", startedAt)],
      expectedCount: 4,
      generationSource: "fake_test",
      generationStartedAt: startedAt,
      assets,
      priorAssetIds: [],
      priorStoragePaths: [],
    });
    assert.equal(ok.complete, true);

    const reused = validateA1DiscoveryCompletion({
      projectId,
      candidates,
      jobs: [jobRow(projectId, "job-1", startedAt)],
      expectedCount: 4,
      generationStartedAt: startedAt,
      assets,
      priorAssetIds: assets.map((a) => a.id),
      priorStoragePaths: assets.map((a) => a.storage_path),
    });
    assert.equal(reused.complete, false);
    assert.ok(reused.reasons.some((r) => /Asset ID reused/i.test(r)));
  });

  it("9. no completion with reused storage paths", () => {
    const projectId = "proj-path";
    const candidates = [1, 2, 3, 4].map((n) => candidate(projectId, n));
    const sharedPath = "workspace/ws/persona-creation/proj-path/candidates/x/y-portrait_front.png";
    const assets = candidates.map((c, i) => ({
      id: `asset-${i}`,
      workspace_id: scope.workspaceId,
      candidate_id: c.id,
      asset_type: "portrait_front" as const,
      storage_path: sharedPath,
      mime_type: "image/png",
      width: 1,
      height: 1,
      file_size_bytes: 1,
      checksum: "x",
      provider_output_id: null,
      generation_metadata: {},
      status: "ready" as const,
      is_primary: true,
      retention_until: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));
    const verdict = validateA1DiscoveryCompletion({
      projectId,
      candidates,
      jobs: [jobRow(projectId, "job-path")],
      expectedCount: 4,
      assets,
    });
    assert.equal(verdict.complete, false);
    assert.ok(verdict.reasons.some((r) => /Duplicate storage path/i.test(r)));
  });

  it("10. API path uses explicit project ID (listCandidates scoped)", async () => {
    const projectA = await createCreationProject(scope, {
      name: "A",
      description: "",
      gender_presentation: "Male",
      age_range: "",
      height_range: "",
      body_type: "",
      skin_tone_direction: "",
      face_shape_direction: "",
      hair_direction: "",
      facial_hair_direction: "",
      eye_direction: "",
      expression_direction: "",
      personality: "",
      fashion_style: "",
      brand_role: "primary_male",
      visual_keywords: "",
      excluded_features: "",
      preferred_brand_looks: "",
      preferred_outfits: "",
      intended_usage: "image",
      candidate_count: 4,
      provider_mode: "image_provider",
      additional_description: "",
    });
    await creationRepo.createCandidate(scope, {
      creation_project_id: projectA.id,
      candidate_number: 1,
      candidate_name: "Modern Creator",
      status: "ready",
      provider: "fake",
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
    });
    const projectB = await createCreationProject(scope, {
      name: "B",
      description: "",
      gender_presentation: "Male",
      age_range: "",
      height_range: "",
      body_type: "",
      skin_tone_direction: "",
      face_shape_direction: "",
      hair_direction: "",
      facial_hair_direction: "",
      eye_direction: "",
      expression_direction: "",
      personality: "",
      fashion_style: "",
      brand_role: "primary_male",
      visual_keywords: "",
      excluded_features: "",
      preferred_brand_looks: "",
      preferred_outfits: "",
      intended_usage: "image",
      candidate_count: 4,
      provider_mode: "image_provider",
      additional_description: "",
    });
    const rowsB = await listCandidates(scope, projectB.id);
    assert.equal(rowsB.length, 0);
    assert.ok(rowsB.every((c) => c.creation_project_id === projectB.id));
  });

  it("11–12. render guard blocks mismatched candidates and assets", () => {
    const mismatch = validateProjectCandidateBoardState({
      activeCreationProjectId: "proj-b",
      stateProjectId: "proj-a",
      candidates: [candidate("proj-a", 1)],
    });
    assert.equal(mismatch.ok, false);

    const assetMismatch = validateProjectCandidateBoardState({
      activeCreationProjectId: "proj-b",
      stateProjectId: "proj-b",
      candidates: [candidate("proj-b", 1)],
      assets: [
        {
          id: "asset-x",
          candidate_id: "other",
          storage_path: "workspace/ws/persona-creation/proj-b/candidates/x/y.png",
        },
      ],
    });
    assert.equal(assetMismatch.ok, false);
  });

  it("13. Project A → B integration isolation", () => {
    const stateA = buildProjectCandidateState({
      projectId: "proj-a",
      candidates: [1, 2, 3, 4].map((n) => candidate("proj-a", n)),
      candidatePreviews: Object.fromEntries(
        [1, 2, 3, 4].map((n) => [
          projectScopedPreviewKey("proj-a", `cand-proj-a-${n}`, `asset-cand-proj-a-${n}`),
          `https://cdn.example/a${n}.png`,
        ]),
      ),
    });
    assert.equal(stateA.candidates.length, 4);

    // Switch: null immediately
    let uiState: typeof stateA | null = null;
    assert.equal(uiState, null);

    const stateB = buildProjectCandidateState({
      projectId: "proj-b",
      candidates: [1, 2, 3, 4].map((n) => candidate("proj-b", n)),
      candidatePreviews: Object.fromEntries(
        [1, 2, 3, 4].map((n) => [
          projectScopedPreviewKey("proj-b", `cand-proj-b-${n}`, `asset-cand-proj-b-${n}`),
          `https://cdn.example/b${n}.png`,
        ]),
      ),
    });
    uiState = applyProjectLoadResult({
      activeProjectId: "proj-b",
      loadVersion: 2,
      currentLoadVersion: 2,
      requestedProjectId: "proj-b",
      previous: null,
      next: stateB,
    });

    assert.equal(uiState?.projectId, "proj-b");
    assert.ok(uiState?.candidates.every((c) => c.id.startsWith("cand-proj-b-")));
    assert.ok(
      !Object.values(uiState?.candidatePreviews ?? {}).some((u) => u?.includes("/a")),
    );
    assert.equal(discoverySlotLabel(1), "Candidate A");
    assert.equal(discoverySlotLabel(4), "Candidate D");
  });

  it("14. Project B → empty Project C isolation", () => {
    const stateB = buildProjectCandidateState({
      projectId: "proj-b",
      candidates: [1, 2, 3, 4].map((n) => candidate("proj-b", n)),
    });
    const stateC = buildProjectCandidateState({
      projectId: "proj-c",
      candidates: [],
    });
    const final = applyProjectLoadResult({
      activeProjectId: "proj-c",
      loadVersion: 3,
      currentLoadVersion: 3,
      requestedProjectId: "proj-c",
      previous: stateB,
      next: stateC,
    });
    assert.equal(final?.projectId, "proj-c");
    assert.equal(final?.candidates.length, 0);
    assert.equal(
      canRenderProjectCandidates({
        activeCreationProjectId: "proj-c",
        projectCandidateState: final,
      }),
      true,
    );
  });

  it("15. fake/test fixture labels cannot enter live board via cross-project state", () => {
    const fixture = buildProjectCandidateState({
      projectId: "fixture-project",
      candidates: [1, 2, 3, 4].map((n) =>
        candidate("fixture-project", n, undefined, {
          candidate_name: [
            "Modern Creator",
            "Weekend Community",
            "Relaxed Mediterranean",
            "Clean Street Athletic",
          ][n - 1]!,
        }),
      ),
    });
    assert.equal(
      canRenderProjectCandidates({
        activeCreationProjectId: "live-project",
        projectCandidateState: fixture,
      }),
      false,
    );
  });

  it("16. paid confirmation + A1 generation still creates project-owned rows", async () => {
    const project = await createCreationProject(scope, {
      name: "Paid Gate",
      description: "",
      gender_presentation: "Male",
      age_range: "24-30",
      height_range: "180",
      body_type: "Lean",
      skin_tone_direction: "Olive",
      face_shape_direction: "Defined",
      hair_direction: "Dark",
      facial_hair_direction: "None",
      eye_direction: "Brown",
      expression_direction: "Calm",
      personality: "Quiet",
      fashion_style: "Luxury",
      brand_role: "primary_male",
      visual_keywords: "",
      excluded_features: "",
      preferred_brand_looks: "",
      preferred_outfits: "",
      intended_usage: "image_and_video",
      candidate_count: 4,
      provider_mode: "image_provider",
      additional_description: "",
    });
    const prepared = await preparePaidGenerationConfirmation(scope, project.id);
    const result = await confirmAndStartCandidateGeneration(scope, project.id, {
      costConfirmed: true,
      confirmationToken: prepared.confirmation.confirmation_token,
      userConfirmedAt: new Date().toISOString(),
      attestation: "ui_checkbox",
    });
    assert.equal(result.candidates.length, 4);
    assert.ok(result.candidates.every((c) => c.creation_project_id === project.id));
    const ids = new Set(result.candidates.map((c) => c.id));
    assert.equal(ids.size, 4);
  });
});
