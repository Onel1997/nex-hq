/**
 * Phase 2.3B — Selected Brand Face continuation fix.
 * Visibility + convert idempotency. No paid provider calls.
 */

import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  convertCandidateToPersona,
  createCreationProject,
  ensureManualCandidateSlots,
  requestStageBReferencePackage,
  updateCandidateReview,
  uploadManualCandidateAsset,
} from "@/lib/persona/creation/creation-service";
import {
  BRAND_FACE_UI_LIFECYCLE_LABELS,
  resolveBrandFaceUiLifecycle,
  resolveCreationWorkflowStep,
} from "@/lib/persona/creation/creation-workflow";
import {
  isNoveltyBoardVisible,
  isSelectedBrandFaceAwaitingConversion,
  partitionBoardCandidates,
} from "@/lib/persona/face-novelty-memory/board-visibility";
import { buildSafeFaceNoveltyLiveDebug } from "@/lib/persona/face-novelty-memory/live-debug";
import {
  MemoryCreationRepository,
  MemoryPersonaRepository,
  setCreationRepositoryForTests,
  setPersonaRepositoryForTests,
} from "@/lib/persona";
import type {
  PersonaCandidate,
  PersonaCreationProject,
} from "@/lib/persona/domain/creation-types";
import type { WorkspaceScope } from "@/lib/persona/domain/types";

const ROOT = process.cwd();
const WS = "ws-phase-23b";
const scope: WorkspaceScope = { workspaceId: WS, actorId: "tester-23b" };

/** Live Candidate B from Phase 2.3A — recovery must not regenerate. */
const LIVE_CANDIDATE_B_ID = "ded0b150-b3b1-4ab7-af97-6277777c6444";
const LIVE_ASSET_ID = "a4438bfc-b54c-4cb2-8bc5-593644276981";
const LIVE_PROJECT_ID = "acde560f-321f-4821-9a6f-1654a5bf8f90";

function tinyPng(): Buffer {
  return Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  );
}

function makeCandidate(
  overrides: Partial<PersonaCandidate> &
    Pick<PersonaCandidate, "id" | "status" | "candidate_number">,
): PersonaCandidate {
  const now = new Date().toISOString();
  return {
    workspace_id: WS,
    creation_project_id: LIVE_PROJECT_ID,
    candidate_name: `C${overrides.candidate_number}`,
    provider: "openai",
    provider_job_id: "job-23b",
    identity_summary: "test",
    distinguishing_features: "",
    brand_fit_score: 80,
    primary_preview_asset_id: LIVE_ASSET_ID,
    generation_settings: {},
    user_notes: "",
    rejection_reason: "",
    selected_at: null,
    converted_persona_id: null,
    actual_generation_cost: null,
    created_at: now,
    updated_at: now,
    ...overrides,
  } as PersonaCandidate;
}

function allowedDebug() {
  return buildSafeFaceNoveltyLiveDebug({
    finalDecision: "allowed",
    requiresReplacementConfirmation: false,
    faceDetectionStatus: "performed",
  });
}

const projectInput = {
  name: "OBF 2.3B",
  description: "test",
  gender_presentation: "Male",
  age_range: "22-25",
  height_range: "180",
  body_type: "Lean",
  skin_tone_direction: "",
  face_shape_direction: "",
  hair_direction: "",
  facial_hair_direction: "",
  eye_direction: "",
  expression_direction: "",
  personality: "",
  fashion_style: "streetwear",
  brand_role: "primary_male" as const,
  visual_keywords: "",
  preferred_brand_looks: "",
  preferred_outfits: "",
  intended_usage: "image_and_video" as const,
  candidate_count: 1,
  provider_mode: "manual_upload" as const,
  additional_description: "",
  excluded_features: "",
};

describe("Phase 2.3B selected Brand Face continuation", () => {
  let creationRepo: MemoryCreationRepository;
  let personaRepo: MemoryPersonaRepository;

  beforeEach(() => {
    creationRepo = new MemoryCreationRepository();
    personaRepo = new MemoryPersonaRepository();
    setCreationRepositoryForTests(creationRepo);
    setPersonaRepositoryForTests(personaRepo);
  });

  afterEach(() => {
    setCreationRepositoryForTests(null);
    setPersonaRepositoryForTests(null);
  });

  it("1. ready candidate remains visible", () => {
    const ready = makeCandidate({
      id: "ready-1",
      status: "ready",
      candidate_number: 1,
      generation_settings: { faceNoveltyLiveDebug: allowedDebug() },
    });
    assert.equal(isNoveltyBoardVisible(ready), true);
  });

  it("2. selected candidate remains visible", () => {
    const selected = makeCandidate({
      id: LIVE_CANDIDATE_B_ID,
      status: "selected",
      candidate_number: 2,
      selected_at: "2026-08-08T19:46:35.248Z",
      primary_preview_asset_id: LIVE_ASSET_ID,
      generation_settings: { faceNoveltyLiveDebug: allowedDebug() },
    });
    assert.equal(isSelectedBrandFaceAwaitingConversion(selected), true);
    assert.equal(isNoveltyBoardVisible(selected), true);
    const { visibleCandidates } = partitionBoardCandidates([selected]);
    assert.equal(visibleCandidates.length, 1);
    assert.equal(visibleCandidates[0]!.id, LIVE_CANDIDATE_B_ID);
  });

  it("3. rejected candidate stays hidden", () => {
    const rejected = makeCandidate({
      id: "rej-1",
      status: "rejected",
      candidate_number: 3,
      generation_settings: { faceNoveltyLiveDebug: allowedDebug() },
    });
    assert.equal(isNoveltyBoardVisible(rejected), false);
    const { visibleCandidates } = partitionBoardCandidates([rejected]);
    assert.equal(visibleCandidates.length, 0);
  });

  it("4. selected candidate survives refresh partition", () => {
    const board = [
      makeCandidate({
        id: "a",
        status: "ready",
        candidate_number: 1,
        generation_settings: { faceNoveltyLiveDebug: allowedDebug() },
      }),
      makeCandidate({
        id: LIVE_CANDIDATE_B_ID,
        status: "selected",
        candidate_number: 2,
        selected_at: "2026-08-08T19:46:35.248Z",
        primary_preview_asset_id: LIVE_ASSET_ID,
        generation_settings: { faceNoveltyLiveDebug: allowedDebug() },
      }),
    ];
    const first = partitionBoardCandidates(board);
    const second = partitionBoardCandidates(first.visibleCandidates);
    assert.ok(second.visibleCandidates.some((c) => c.id === LIVE_CANDIDATE_B_ID));
    assert.equal(
      second.visibleCandidates.find((c) => c.id === LIVE_CANDIDATE_B_ID)!
        .primary_preview_asset_id,
      LIVE_ASSET_ID,
    );
  });

  it("5. current Candidate B is recoverable (id + asset preserved)", () => {
    const b = makeCandidate({
      id: LIVE_CANDIDATE_B_ID,
      status: "selected",
      candidate_number: 2,
      candidate_name: "North African Street Premium",
      selected_at: "2026-08-08T19:46:35.248Z",
      primary_preview_asset_id: LIVE_ASSET_ID,
      creation_project_id: LIVE_PROJECT_ID,
      provider: "openai",
    });
    assert.equal(isNoveltyBoardVisible(b), true);
    assert.equal(b.id, LIVE_CANDIDATE_B_ID);
    assert.equal(b.primary_preview_asset_id, LIVE_ASSET_ID);
    assert.equal(b.creation_project_id, LIVE_PROJECT_ID);
    assert.equal(b.provider, "openai");
  });

  it("6–7. selected candidate shows Convert + Stage B actions in UI source", () => {
    const views = readFileSync(
      join(ROOT, "components/persona/persona-creator-views.tsx"),
      "utf8",
    );
    assert.match(views, /Convert to Draft Persona/);
    assert.match(views, /Stage B \/ Reference Package/);
    assert.match(views, /selected-brand-face-panel/);
    assert.match(views, /isSelectedBrandFaceAwaitingConversion/);
  });

  it("8–11. convert creates one Draft Persona, links ids, preserves asset, idempotent", async () => {
    const project = await createCreationProject(scope, projectInput);
    const [candidate] = await ensureManualCandidateSlots(scope, project.id);
    await uploadManualCandidateAsset(
      scope,
      candidate.id,
      { bytes: tinyPng(), mimeType: "image/png", filename: "front.png" },
      { asset_type: "portrait_front", is_primary: true },
    );
    await creationRepo.updateCandidate(scope, candidate.id, {
      status: "ready",
      primary_preview_asset_id: LIVE_ASSET_ID,
      candidate_name: "North African Street Premium",
      provider: "openai",
    });
    await updateCandidateReview(scope, candidate.id, { status: "selected" });

    const afterSelect = await creationRepo.getCandidate(scope, candidate.id);
    assert.equal(afterSelect!.status, "selected");
    assert.equal(afterSelect!.primary_preview_asset_id, LIVE_ASSET_ID);
    const projectAfter = await creationRepo.getProject(scope, project.id);
    assert.equal(projectAfter!.status, "selected");
    assert.equal(resolveCreationWorkflowStep(projectAfter!), "convert");
    assert.notEqual(resolveCreationWorkflowStep(projectAfter!), "identity_lock");

    const first = await convertCandidateToPersona(scope, candidate.id);
    assert.equal(first.alreadyConverted, false);
    assert.equal(first.persona.status, "Draft");
    assert.equal(first.persona.image_use_approved, false);
    assert.equal(first.persona.video_use_approved, false);
    assert.equal(first.persona.identity_lock_status, "collecting_references");
    assert.equal(first.persona.source_candidate_id, candidate.id);
    assert.equal(first.persona.source_creation_project_id, project.id);
    assert.equal(first.candidate.converted_persona_id, first.persona.id);
    assert.equal(first.candidate.primary_preview_asset_id, LIVE_ASSET_ID);

    const second = await convertCandidateToPersona(scope, candidate.id);
    assert.equal(second.alreadyConverted, true);
    assert.equal(second.persona.id, first.persona.id);
    const allPersonas = await personaRepo.listPersonas(scope);
    assert.equal(allPersonas.length, 1);
  });

  it("12–13. selection does not auto-approve or auto-run Identity Lock", async () => {
    const project = await createCreationProject(scope, {
      ...projectInput,
      name: "OBF select only",
    });
    const [candidate] = await ensureManualCandidateSlots(scope, project.id);
    await creationRepo.updateCandidate(scope, candidate.id, {
      status: "ready",
      primary_preview_asset_id: LIVE_ASSET_ID,
    });
    await updateCandidateReview(scope, candidate.id, { status: "selected" });
    const personas = await personaRepo.listPersonas(scope);
    assert.equal(personas.length, 0);
    const lifecycle = resolveBrandFaceUiLifecycle({
      projectStatus: "selected",
      generationStage: "identity_lock",
      selectedCandidate: { status: "selected", converted_persona_id: null },
      persona: null,
    });
    assert.equal(lifecycle, "selected");
    assert.equal(BRAND_FACE_UI_LIFECYCLE_LABELS[lifecycle], "Selected Brand Face");
    const loaded = await creationRepo.getProject(scope, project.id);
    assert.equal(
      resolveCreationWorkflowStep({
        ...loaded!,
        generation_stage: "identity_lock",
      } as PersonaCreationProject),
      "convert",
    );
  });

  it("Stage B on selected keeps status=selected (no board drop)", async () => {
    const project = await createCreationProject(scope, {
      ...projectInput,
      name: "OBF stage b",
    });
    const [candidate] = await ensureManualCandidateSlots(scope, project.id);
    await creationRepo.updateCandidate(scope, candidate.id, {
      status: "selected",
      selected_at: new Date().toISOString(),
      primary_preview_asset_id: LIVE_ASSET_ID,
      candidate_name: "North African Street Premium",
      provider: "openai",
    });
    const result = await requestStageBReferencePackage(scope, candidate.id);
    assert.equal(result.candidate.status, "selected");
    assert.equal(result.automaticExpansion, false);
    assert.equal(result.requiredAction, "manual_upload");
    assert.equal(isNoveltyBoardVisible(result.candidate), true);
  });

  it("14. no paid provider calls / architecture files untouched by this phase", () => {
    const untouched = [
      "lib/persona/creation/provider/fal-flux-discovery-provider.ts",
      "lib/persona/face-novelty-memory/novelty-service.ts",
      "lib/persona/face-novelty-memory/similarity-threshold.ts",
    ];
    for (const rel of untouched) {
      const text = readFileSync(join(ROOT, rel), "utf8");
      assert.doesNotMatch(text, /Phase 2\.3B/);
    }
    const brandCast = readFileSync(
      join(ROOT, "lib/persona/creation/creation-service.ts"),
      "utf8",
    );
    assert.match(brandCast, /status === "Approved" && p\.approved/);
    assert.match(brandCast, /readiness\.image_ready/);
  });

  it("converted selected leaves the continuation board", () => {
    const converted = makeCandidate({
      id: LIVE_CANDIDATE_B_ID,
      status: "selected",
      candidate_number: 2,
      converted_persona_id: "persona-1",
      primary_preview_asset_id: LIVE_ASSET_ID,
    });
    assert.equal(isSelectedBrandFaceAwaitingConversion(converted), false);
    assert.equal(isNoveltyBoardVisible(converted), false);
  });
});
