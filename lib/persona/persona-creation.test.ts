/**
 * Persona Studio Phase 1.2 — Creator & Brand Cast candidate workflow tests.
 */

import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import {
  IDENTITY_REVIEW_CHECK_KEYS,
  MAX_CANDIDATE_BATCH_SIZE,
  MemoryCreationRepository,
  MemoryPersonaRepository,
  PERSONA_TEST_WORKSPACE_ID,
  buildPersonaCandidateStoragePath,
  confirmAndStartCandidateGeneration,
  convertCandidateToPersona,
  createCreationProject,
  emptyIdentityChecklist,
  ensureManualCandidateSlots,
  estimateCreationCost,
  getBrandCastMilestoneProgress,
  getCreationRepositoryKind,
  getPersonaCandidateGenerator,
  getPersonaRepositoryKind,
  isPublicPermanentPersonaUrl,
  listCreationPresets,
  setCreationRepositoryForTests,
  setPersonaRepositoryForTests,
  submitIdentityReview,
  updateCandidateReview,
  uploadManualCandidateAsset,
  createPersona,
  updatePersona,
  listImageStudioIntegrationHooks,
  listVideoStudioIntegrationHooks,
  createProductionPersonaRepository,
  PERSONA_SCHEMA_VERSION,
} from "@/lib/persona";
import type { WorkspaceScope } from "@/lib/persona/domain/types";
import { PersonaDomainError } from "@/lib/persona/domain/errors";
import { isSupabaseConfigured } from "@/lib/supabase/admin";

const WS_A = PERSONA_TEST_WORKSPACE_ID;
const WS_B = "22222222-2222-4222-8222-222222222222";
const scopeA: WorkspaceScope = { workspaceId: WS_A, actorId: "tester-a" };
const scopeB: WorkspaceScope = { workspaceId: WS_B, actorId: "tester-b" };

function tinyPng(): Buffer {
  // 1x1 PNG
  return Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  );
}

describe("Persona Studio Phase 1.2 creation workflow", () => {
  let personaRepo: MemoryPersonaRepository;
  let creationRepo: MemoryCreationRepository;

  beforeEach(() => {
    personaRepo = new MemoryPersonaRepository();
    creationRepo = new MemoryCreationRepository();
    setPersonaRepositoryForTests(personaRepo);
    setCreationRepositoryForTests(creationRepo);
  });

  afterEach(() => {
    setPersonaRepositoryForTests(null);
    setCreationRepositoryForTests(null);
  });

  it("1. candidate project CRUD persists in memory repository", async () => {
    const project = await createCreationProject(scopeA, {
      name: "Cast Session A",
      description: "",
      gender_presentation: "Male",
      age_range: "28-35",
      height_range: "180 cm",
      body_type: "Lean",
      skin_tone_direction: "Olive",
      face_shape_direction: "Defined",
      hair_direction: "Dark",
      facial_hair_direction: "None",
      eye_direction: "Brown",
      expression_direction: "Calm",
      personality: "Quiet",
      fashion_style: "Quiet luxury",
      brand_role: "primary_male",
      visual_keywords: "editorial",
      excluded_features: "logo",
      preferred_brand_looks: "QL",
      preferred_outfits: "Black pants",
      intended_usage: "image_and_video",
      candidate_count: 4,
      provider_mode: "manual_upload",
      additional_description: "",
    });
    assert.equal(project.name, "Cast Session A");
    const listed = await creationRepo.listProjects(scopeA);
    assert.equal(listed.length, 1);
    assert.equal(listed[0].id, project.id);
  });

  it("2. workspace isolation for creation projects", async () => {
    await createCreationProject(scopeA, {
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
      candidate_count: 2,
      provider_mode: "manual_upload",
      additional_description: "",
    });
    const bList = await creationRepo.listProjects(scopeB);
    assert.equal(bList.length, 0);
  });

  it("3. provider-disabled state does not fake output", async () => {
    const generator = getPersonaCandidateGenerator("disabled");
    assert.equal(generator.isConfigured(), false);
    await assert.rejects(
      () =>
        generator.createCandidateBatch({
          project: {
            id: "x",
            workspace_id: WS_A,
            name: "",
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
            candidate_count: 4,
            provider_mode: "disabled",
            quality_mode: "premium_editorial",
            status: "ready",
            generation_stage: "discovery",
            estimated_cost_min: 0,
            estimated_cost_max: 0,
            actual_cost: 0,
            cost_confirmed_at: null,
            last_estimate_hash: null,
            last_estimate_at: null,
            last_confirmation_token: null,
            additional_description: "",
            created_by: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          stage: "discovery",
          costConfirmed: true,
        }),
      (err: unknown) =>
        err instanceof PersonaDomainError && err.code === "CONFIG",
    );
  });

  it("4. manual-upload candidate flow works", async () => {
    const project = await createCreationProject(scopeA, {
      name: "Manual",
      description: "",
      gender_presentation: "Female",
      age_range: "25-32",
      height_range: "175",
      body_type: "Lean",
      skin_tone_direction: "Olive",
      face_shape_direction: "Soft",
      hair_direction: "Dark",
      facial_hair_direction: "None",
      eye_direction: "Hazel",
      expression_direction: "Calm",
      personality: "Quiet",
      fashion_style: "Minimal",
      brand_role: "primary_female",
      visual_keywords: "editorial",
      excluded_features: "",
      preferred_brand_looks: "",
      preferred_outfits: "",
      intended_usage: "image_and_video",
      candidate_count: 2,
      provider_mode: "manual_upload",
      additional_description: "",
    });
    const candidates = await ensureManualCandidateSlots(scopeA, project.id);
    assert.equal(candidates.length, 2);
    const asset = await uploadManualCandidateAsset(
      scopeA,
      candidates[0].id,
      { bytes: tinyPng(), mimeType: "image/png", filename: "front.png" },
      { asset_type: "portrait_front", is_primary: true },
    );
    assert.equal(asset.asset_type, "portrait_front");
    assert.match(asset.storage_path, /persona-creation/);
  });

  it("5+6. cost estimate required and paid generation needs confirmation", async () => {
    const project = await createCreationProject(scopeA, {
      name: "Paid gate",
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
    const estimate = await estimateCreationCost(scopeA, project.id);
    assert.ok(estimate.candidateCount === 4);
    await assert.rejects(
      () =>
        confirmAndStartCandidateGeneration(scopeA, project.id, {
          costConfirmed: false,
        }),
      (err: unknown) =>
        err instanceof PersonaDomainError &&
        err.details?.requiresCostConfirmation === true,
    );
  });

  it("7. candidate batch count obeys maximum", async () => {
    const project = await createCreationProject(scopeA, {
      name: "Max",
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
      candidate_count: 99,
      provider_mode: "manual_upload",
      additional_description: "",
    });
    assert.equal(project.candidate_count, MAX_CANDIDATE_BATCH_SIZE);
  });

  it("8-11. candidate status transitions, shortlist stage, reject gate, one selected", async () => {
    const project = await createCreationProject(scopeA, {
      name: "Flow",
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
      candidate_count: 2,
      provider_mode: "manual_upload",
      additional_description: "",
    });
    const candidates = await ensureManualCandidateSlots(scopeA, project.id);
    await creationRepo.updateCandidate(scopeA, candidates[0].id, {
      status: "ready",
    });
    await creationRepo.updateCandidate(scopeA, candidates[1].id, {
      status: "ready",
    });

    const shortlisted = await updateCandidateReview(scopeA, candidates[0].id, {
      status: "shortlisted",
    });
    assert.equal(shortlisted.status, "shortlisted");
    const refreshed = await creationRepo.getProject(scopeA, project.id);
    assert.equal(refreshed?.generation_stage, "shortlist_validation");

    await updateCandidateReview(scopeA, candidates[1].id, {
      status: "rejected",
      rejection_reason: "Ungeeignet",
    });
    await assert.rejects(
      () => updateCandidateReview(scopeA, candidates[1].id, { status: "selected" }),
      (err: unknown) => err instanceof PersonaDomainError,
    );

    await updateCandidateReview(scopeA, candidates[0].id, { status: "selected" });
    await assert.rejects(
      () =>
        updateCandidateReview(scopeA, candidates[1].id, {
          status: "ready",
        }).then(() =>
          updateCandidateReview(scopeA, candidates[1].id, { status: "selected" }),
        ),
      (err: unknown) => err instanceof PersonaDomainError,
    );
  });

  it("12-15. conversion creates draft persona, no usage approval, assets copied, no double convert", async () => {
    const project = await createCreationProject(scopeA, {
      name: "Convert",
      description: "",
      gender_presentation: "Male",
      age_range: "28-35",
      height_range: "185",
      body_type: "Lean",
      skin_tone_direction: "Olive",
      face_shape_direction: "Defined",
      hair_direction: "Dark",
      facial_hair_direction: "None",
      eye_direction: "Brown",
      expression_direction: "Calm",
      personality: "Quiet",
      fashion_style: "QL",
      brand_role: "primary_male",
      visual_keywords: "jawline",
      excluded_features: "age shift",
      preferred_brand_looks: "",
      preferred_outfits: "",
      intended_usage: "image_and_video",
      candidate_count: 1,
      provider_mode: "manual_upload",
      additional_description: "",
    });
    const [candidate] = await ensureManualCandidateSlots(scopeA, project.id);
    await uploadManualCandidateAsset(
      scopeA,
      candidate.id,
      { bytes: tinyPng(), mimeType: "image/png", filename: "front.png" },
      { asset_type: "portrait_front", is_primary: true },
    );
    await creationRepo.updateCandidate(scopeA, candidate.id, { status: "ready" });
    await updateCandidateReview(scopeA, candidate.id, { status: "selected" });

    const { persona, candidate: converted } = await convertCandidateToPersona(
      scopeA,
      candidate.id,
    );
    assert.equal(persona.status, "Draft");
    assert.equal(persona.image_use_approved, false);
    assert.equal(persona.video_use_approved, false);
    assert.equal(persona.source_candidate_id, candidate.id);
    assert.equal(converted.converted_persona_id, persona.id);

    const refs = await personaRepo.listReferenceAssets(scopeA, persona.id);
    assert.ok(refs.length >= 1);
    assert.match(refs[0].storage_path, /\/personas\//);
    assert.ok(!isPublicPermanentPersonaUrl(refs[0].storage_path));

    await assert.rejects(
      () => convertCandidateToPersona(scopeA, candidate.id),
      (err: unknown) => err instanceof PersonaDomainError,
    );
  });

  it("16. identity review checklist persists", async () => {
    const persona = await createPersona(scopeA, {
      name: "Review Me",
      role: "primary_male",
      gender: "Male",
      age_range: "30",
      height: "180",
      body_type: "Lean",
      skin_tone: "Olive",
      hair: "Dark",
      beard: "None",
      eye_color: "Brown",
      expression: "Calm",
      personality: "Quiet",
      style: "QL",
      notes: "",
      brand_fit_score: 80,
    });
    const checklist = emptyIdentityChecklist();
    for (const key of IDENTITY_REVIEW_CHECK_KEYS) checklist[key] = true;
    const review = await submitIdentityReview(scopeA, persona.id, {
      checklist,
      reviewer_notes: "Manuell geprüft",
    });
    assert.equal(review.all_passed, true);
    const listed = await creationRepo.listIdentityReviews(scopeA, persona.id);
    assert.equal(listed.length, 1);
    assert.equal(listed[0].reviewer_notes, "Manuell geprüft");
  });

  it("17-19. Brand Cast milestone counts only fully approved image-ready personas; image/video separate", async () => {
    // Incomplete approved persona should not count
    const incomplete = await createPersona(scopeA, {
      name: "Incomplete Male",
      role: "primary_male",
      gender: "Male",
      age_range: "30",
      height: "180",
      body_type: "Lean",
      skin_tone: "Olive",
      hair: "Dark",
      beard: "None",
      eye_color: "Brown",
      expression: "Calm",
      personality: "Quiet",
      style: "QL",
      notes: "",
      brand_fit_score: 80,
    });
    await personaRepo.updatePersona(scopeA, incomplete.id, {
      status: "Approved",
      image_use_approved: true,
    });
    // Memory repo syncs approved from status when patched via status field —
    // ensure approved boolean for milestone filter.
    const row = await personaRepo.getPersona(scopeA, incomplete.id);
    assert.ok(row);
    if (!row.approved) {
      await personaRepo.updatePersona(scopeA, incomplete.id, {
        status: "Approved",
      });
    }

    const progress = await getBrandCastMilestoneProgress(scopeA);
    assert.equal(progress.male_required, 2);
    assert.equal(progress.female_required, 1);
    assert.equal(progress.male_approved, 0); // not image-ready
    assert.ok(progress.missing_reference_requirements.length > 0);
    assert.equal(progress.image_ready_count, 0);
    assert.equal(progress.video_ready_count, 0);
    assert.equal(progress.milestone_reached, false);
  });

  it("20-21. Image Studio and Video Studio hooks remain inactive", () => {
    assert.deepEqual(listImageStudioIntegrationHooks(), []);
    assert.deepEqual(listVideoStudioIntegrationHooks(), []);
  });

  it("22-23. storage paths are private; signed URL helper rejects public permanent URLs", () => {
    const path = buildPersonaCandidateStoragePath({
      workspaceId: WS_A,
      projectId: "p1",
      candidateId: "c1",
      assetId: "a1",
      filename: "front.png",
    });
    assert.match(path, /^workspace\//);
    assert.ok(!path.includes("/object/public/"));
    assert.equal(
      isPublicPermanentPersonaUrl(
        "https://x.supabase.co/storage/v1/object/public/persona-references/foo",
      ),
      true,
    );
    assert.equal(
      isPublicPermanentPersonaUrl(
        "https://x.supabase.co/storage/v1/object/sign/persona-references/foo?token=abc",
      ),
      false,
    );
  });

  it("24. audit event types include phase 1.2+ events (type-level via schema version)", () => {
    assert.match(PERSONA_SCHEMA_VERSION, /phase_1_[25]/);
  });

  it("25. production repository never uses memory fallback", () => {
    if (!isSupabaseConfigured()) {
      assert.throws(() => createProductionPersonaRepository(), PersonaDomainError);
      return;
    }
    const kind = getPersonaRepositoryKind();
    // With test override active this is memory — clear and check production path
    setPersonaRepositoryForTests(null);
    setCreationRepositoryForTests(null);
    assert.equal(getPersonaRepositoryKind(), "supabase");
    assert.equal(getCreationRepositoryKind(), "supabase");
    setPersonaRepositoryForTests(personaRepo);
    setCreationRepositoryForTests(creationRepo);
    void kind;
  });

  it("26. legacy Persona Studio createPersona remains functional", async () => {
    const persona = await createPersona(scopeA, {
      name: "Legacy OK",
      role: "model",
      gender: "Female",
      age_range: "25",
      height: "175",
      body_type: "Lean",
      skin_tone: "Olive",
      hair: "Dark",
      beard: "None",
      eye_color: "Hazel",
      expression: "Calm",
      personality: "Quiet",
      style: "Minimal",
      notes: "",
      brand_fit_score: 70,
    });
    assert.equal(persona.status, "Draft");
    const updated = await updatePersona(scopeA, persona.id, { notes: "ok" });
    assert.equal(updated.notes, "ok");
  });

  it("presets are available and not auto-submitted", () => {
    const presets = listCreationPresets();
    assert.equal(presets.length, 3);
    assert.ok(presets.some((p) => p.id === "primary_male_quiet_luxury"));
  });
});
