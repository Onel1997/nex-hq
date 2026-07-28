/**
 * Phase 1.8C — Casting data integrity regression tests.
 * Never invokes OpenAI.
 */

import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import {
  MemoryCreationRepository,
  MemoryGenerationJobRepository,
  MemoryPersonaRepository,
  PERSONA_TEST_WORKSPACE_ID,
  resetMemoryGenerationJobStoreForTests,
  setCreationRepositoryForTests,
  setGenerationJobRepositoryForTests,
  setPersonaRepositoryForTests,
  UI_CHECKBOX_ATTESTATION,
} from "@/lib/persona";
import type { WorkspaceScope } from "@/lib/persona/domain/types";
import { PersonaDomainError } from "@/lib/persona/domain/errors";
import {
  assertAssetsBelongToCandidateProject,
  assertCandidatesBelongToProject,
  assertLiveCastingProviderNotFake,
  assertUniqueDiscoveryRunIds,
  filterCandidatesForProject,
  projectScopedCandidatesCacheKey,
  resolveGenerationSource,
  validateA1DiscoveryCompletion,
} from "@/lib/persona/creation/casting-data-integrity";
import { verifyDiscoveryProjectIsolation } from "@/lib/persona/creation/casting-dry-run-verification";
import {
  confirmAndStartCandidateGeneration,
  createCreationProject,
  listCandidates,
  preparePaidGenerationConfirmation,
} from "@/lib/persona/creation/creation-service";
import {
  filterLoadedCandidatesForProject,
} from "@/components/persona/persona-studio-project-sync";

const scope: WorkspaceScope = {
  workspaceId: PERSONA_TEST_WORKSPACE_ID,
  actorId: "integrity-tester",
};

function candidateRow(projectId: string, n: number, id = `cand-${projectId}-${n}`) {
  const now = new Date().toISOString();
  return {
    id,
    workspace_id: scope.workspaceId,
    creation_project_id: projectId,
    candidate_number: n,
    candidate_name: `Candidate ${n}`,
    status: "ready" as const,
    provider: "fake",
    provider_job_id: "job-1",
    generation_seed: `seed-${n}`,
    generation_prompt: "",
    negative_prompt: "",
    generation_settings: {},
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
  };
}

describe("Phase 1.8C Casting Data Integrity", () => {
  let creationRepo: MemoryCreationRepository;
  let jobRepo: MemoryGenerationJobRepository;

  beforeEach(() => {
    process.env.PERSONA_USE_FAKE_PROVIDER = "true";
    process.env.PERSONA_PAID_GENERATION_ENABLED = "true";
    process.env.OPENAI_API_KEY = "test-key";
    delete process.env.PERSONA_SIMULATE_PRODUCTION_ENV;
    delete process.env.PERSONA_FORCE_LIVE_PROVIDER_GUARD;
    creationRepo = new MemoryCreationRepository();
    jobRepo = new MemoryGenerationJobRepository();
    resetMemoryGenerationJobStoreForTests();
    setPersonaRepositoryForTests(new MemoryPersonaRepository());
    setCreationRepositoryForTests(creationRepo);
    setGenerationJobRepositoryForTests(jobRepo);
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

  it("1. new discovery never loads candidates from an old project", async () => {
    const projectA = await createCreationProject(scope, {
      name: "Old Run",
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
    await creationRepo.createCandidate(scope, {
      creation_project_id: projectA.id,
      candidate_number: 1,
      candidate_name: "Old",
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
      name: "New Run",
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

    const oldCandidates = await listCandidates(scope, projectA.id);
    const newCandidates = await listCandidates(scope, projectB.id);
    assert.equal(oldCandidates.length, 1);
    assert.equal(newCandidates.length, 0);

    const filtered = filterLoadedCandidatesForProject(
      [...oldCandidates, candidateRow(projectB.id, 1)],
      projectB.id,
    );
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0].creation_project_id, projectB.id);
  });

  it("2. candidate retrieval requires project ID scoping", async () => {
    const project = await createCreationProject(scope, {
      name: "Scoped",
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
    const rows = await listCandidates(scope, project.id);
    assertCandidatesBelongToProject(rows, project.id);
  });

  it("3. cache keys are project-scoped", () => {
    const keyA = projectScopedCandidatesCacheKey(scope.workspaceId, "proj-a");
    const keyB = projectScopedCandidatesCacheKey(scope.workspaceId, "proj-b");
    assert.notEqual(keyA, keyB);
    assert.match(keyA, /persona-candidates:/);
    assert.doesNotMatch(keyA, /^persona-candidates$/);
  });

  it("4. fake provider throws in simulated live workflow", () => {
    const priorSim = process.env.PERSONA_SIMULATE_PRODUCTION_ENV;
    process.env.PERSONA_SIMULATE_PRODUCTION_ENV = "1";
    try {
      assert.throws(
        () =>
          assertLiveCastingProviderNotFake("fake", { liveUiAttestation: true }),
        (err: unknown) =>
          err instanceof PersonaDomainError &&
          /Test candidate provider/i.test(err.message),
      );
    } finally {
      if (priorSim === undefined) delete process.env.PERSONA_SIMULATE_PRODUCTION_ENV;
      else process.env.PERSONA_SIMULATE_PRODUCTION_ENV = priorSim;
    }
  });

  it("5. candidate-project mismatch is rejected", () => {
    assert.throws(
      () =>
        assertCandidatesBelongToProject(
          [candidateRow("proj-other", 1)],
          "proj-active",
        ),
      /Creation-Projekt/i,
    );
  });

  it("6. asset-candidate-project mismatch is rejected", () => {
    const candidate = candidateRow("proj-active", 1);
    assert.throws(
      () =>
        assertAssetsBelongToCandidateProject(
          [
            {
              id: "asset-1",
              workspace_id: scope.workspaceId,
              candidate_id: "other-candidate",
              asset_type: "portrait_front",
              storage_path: "path",
              mime_type: "image/png",
              width: 1,
              height: 1,
              file_size_bytes: 1,
              checksum: "x",
              provider_output_id: null,
              generation_metadata: {},
              status: "ready",
              is_primary: true,
              retention_until: null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ],
          candidate,
          "proj-active",
        ),
      /Assets gehören nicht/i,
    );
  });

  it("7. no project completion without provider execution evidence", () => {
    const verdict = validateA1DiscoveryCompletion({
      projectId: "proj-1",
      candidates: [candidateRow("proj-1", 1)],
      jobs: [],
      expectedCount: 4,
      generationSource: "openai_live",
      requireProviderExecution: true,
    });
    assert.equal(verdict.complete, false);
    assert.ok(verdict.reasons.some((r) => /provider execution/i.test(r)));
  });

  it("8. paid confirmation still required before generation", async () => {
    const project = await createCreationProject(scope, {
      name: "Gate",
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
    await assert.rejects(
      () =>
        confirmAndStartCandidateGeneration(scope, project.id, {
          costConfirmed: false,
          confirmationToken: "missing",
          userConfirmedAt: new Date().toISOString(),
          attestation: "ui_checkbox",
        }),
      /Kostenbestätigung/i,
    );
  });

  it("9. dry-run verification isolates two discovery projects", async () => {
    const result = await verifyDiscoveryProjectIsolation(scope);
    assert.equal(result.isolated, true);
    assert.notEqual(result.runA.creationProjectId, result.runB.creationProjectId);
    assertUniqueDiscoveryRunIds({
      runA: {
        selectionProjectId: "sel-a",
        creationProjectId: result.runA.creationProjectId,
        candidateIds: result.runA.candidateIds,
      },
      runB: {
        selectionProjectId: "sel-b",
        creationProjectId: result.runB.creationProjectId,
        candidateIds: result.runB.candidateIds,
      },
    });
  });

  it("10. resolveGenerationSource classifies providers", () => {
    assert.equal(resolveGenerationSource("fake", { fake: true }), "fake_test");
    assert.equal(resolveGenerationSource("openai"), "openai_live");
    assert.equal(resolveGenerationSource("manual_upload"), "manual_upload");
  });

  it("11. filterCandidatesForProject drops cross-project rows", () => {
    const rows = [
      candidateRow("proj-a", 1),
      candidateRow("proj-b", 2),
    ];
    assert.equal(filterCandidatesForProject(rows, "proj-a").length, 1);
  });
});
