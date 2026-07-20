/**
 * Incident orphan cleanup — preserves completed jobs, cancels pending_confirmation only.
 */

import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import {
  MemoryCreationRepository,
  MemoryPersonaRepository,
  PERSONA_TEST_WORKSPACE_ID,
  setCreationRepositoryForTests,
  setGenerationJobRepositoryForTests,
  setPersonaRepositoryForTests,
  resetMemoryGenerationJobStoreForTests,
  MemoryGenerationJobRepository,
  cleanupIncidentOrphanRecords,
  updateCandidateReview,
  createCreationProject,
} from "@/lib/persona";
import { PersonaDomainError } from "@/lib/persona/domain/errors";
import {
  buildExpiredConfirmationPatch,
  isOrphanPendingJob,
  planIncidentCleanup,
} from "@/lib/persona/creation/incident-cleanup";
import { isConfirmationCancelledOrExpired } from "@/lib/persona/creation/paid-generation-guard";
import type { WorkspaceScope } from "@/lib/persona/domain/types";

const scope: WorkspaceScope = {
  workspaceId: PERSONA_TEST_WORKSPACE_ID,
  actorId: "cleanup-tester",
};

describe("Persona incident cleanup", () => {
  let creationRepo: MemoryCreationRepository;
  let jobRepo: MemoryGenerationJobRepository;

  beforeEach(() => {
    creationRepo = new MemoryCreationRepository();
    jobRepo = new MemoryGenerationJobRepository();
    resetMemoryGenerationJobStoreForTests();
    setPersonaRepositoryForTests(new MemoryPersonaRepository());
    setCreationRepositoryForTests(creationRepo);
    setGenerationJobRepositoryForTests(jobRepo);
  });

  it("plans orphan pending jobs and unused confirmations", async () => {
    const project = await createCreationProject(scope, {
      name: "Cleanup",
      description: "",
      gender_presentation: "",
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
      candidate_count: 1,
      provider_mode: "image_provider",
      additional_description: "",
      status: "draft",
    } as never);

    const orphan = await jobRepo.createJob(scope, {
      creation_project_id: project.id,
      stage: "discovery",
      provider: "openai",
      status: "pending_confirmation",
      requested_asset_types: ["portrait_front"],
      quality_mode: "premium_editorial",
      estimated_cost_min: 0.1,
      estimated_cost_max: 0.3,
      confirmation_token: "pct_orphan_test",
    });
    const confirmation = await jobRepo.createConfirmation(scope, {
      creation_project_id: project.id,
      generation_job_id: orphan.id,
      confirmation_token: "pct_orphan_test",
      estimate_hash: "hash-orphan",
      stage: "discovery",
      quality_mode: "premium_editorial",
      candidate_count: 1,
      asset_count: 1,
      estimated_cost_min: 0.1,
      estimated_cost_max: 0.3,
    });

    const plan = planIncidentCleanup({
      jobs: [orphan],
      confirmations: [confirmation],
    });
    assert.equal(plan.jobsToCancel.length, 1);
    assert.equal(plan.confirmationsToExpire.length, 1);
    assert.ok(isOrphanPendingJob(orphan));
  });

  it("executes cleanup without touching consumed confirmations", async () => {
    const project = await createCreationProject(scope, {
      name: "Cleanup Exec",
      description: "",
      gender_presentation: "",
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
      candidate_count: 1,
      provider_mode: "image_provider",
      additional_description: "",
      status: "draft",
    } as never);

    const orphan = await jobRepo.createJob(scope, {
      creation_project_id: project.id,
      stage: "discovery",
      provider: "openai",
      status: "pending_confirmation",
      requested_asset_types: ["portrait_front"],
      quality_mode: "premium_editorial",
      estimated_cost_min: 0.1,
      estimated_cost_max: 0.3,
      confirmation_token: "pct_exec_orphan",
    });
    await jobRepo.createConfirmation(scope, {
      creation_project_id: project.id,
      generation_job_id: orphan.id,
      confirmation_token: "pct_exec_orphan",
      estimate_hash: "hash-exec",
      stage: "discovery",
      quality_mode: "premium_editorial",
      candidate_count: 1,
      asset_count: 1,
      estimated_cost_min: 0.1,
      estimated_cost_max: 0.3,
    });

    const consumed = await jobRepo.createConfirmation(scope, {
      creation_project_id: project.id,
      generation_job_id: null,
      confirmation_token: "pct_consumed_keep",
      estimate_hash: "hash-used",
      stage: "discovery",
      quality_mode: "premium_editorial",
      candidate_count: 1,
      asset_count: 1,
      estimated_cost_min: 0.1,
      estimated_cost_max: 0.3,
    });
    await jobRepo.updateConfirmationByToken(scope, consumed.confirmation_token, {
      consumed_at: new Date().toISOString(),
    });

    const result = await cleanupIncidentOrphanRecords(scope, project.id);
    assert.equal(result.orphanJobsCancelled, 1);
    assert.equal(result.unusedConfirmationsExpired, 1);

    const cancelled = await jobRepo.getJob(scope, orphan.id);
    assert.equal(cancelled?.status, "cancelled");
    assert.equal(cancelled?.error_code, "incident_cleanup_unused_confirmation");

    const kept = await jobRepo.getConfirmationByToken(scope, "pct_consumed_keep");
    assert.ok(kept?.consumed_at);
    assert.equal(isConfirmationCancelledOrExpired(kept!), false);

    const expired = await jobRepo.getConfirmationByToken(scope, "pct_exec_orphan");
    assert.ok(isConfirmationCancelledOrExpired(expired!));
  });

  it("incident debug candidate stays blocked from shortlist", async () => {
    const project = await createCreationProject(scope, {
      name: "Block",
      description: "",
      gender_presentation: "",
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
      candidate_count: 1,
      provider_mode: "image_provider",
      additional_description: "",
      status: "draft",
    } as never);

    const job = await jobRepo.createJob(scope, {
      creation_project_id: project.id,
      stage: "discovery",
      provider: "openai",
      status: "completed",
      requested_asset_types: ["portrait_front"],
      quality_mode: "premium_editorial",
      estimated_cost_min: 0.1,
      estimated_cost_max: 0.3,
      confirmation_payload: { incident_classification: { preserved: true } },
    });
    const candidate = await creationRepo.createCandidate(scope, {
      creation_project_id: project.id,
      candidate_number: 1,
      candidate_name: "Debug",
      status: "ready",
      provider: "openai",
      provider_job_id: job.id,
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

    await assert.rejects(
      () => updateCandidateReview(scope, candidate.id, { status: "shortlisted" }),
      (e: unknown) => e instanceof PersonaDomainError && e.code === "WORKFLOW",
    );
  });

  it("buildExpiredConfirmationPatch marks token unusable", () => {
    const patch = buildExpiredConfirmationPatch("2026-01-01T00:00:00.000Z", {});
    assert.equal(patch.consumed_at, "2026-01-01T00:00:00.000Z");
    assert.equal((patch.payload.incident_cleanup as { status: string }).status, "cancelled");
  });
});
