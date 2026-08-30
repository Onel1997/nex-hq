/**
 * Phase 2.3D.3 — Camera direction lock + slot-only regeneration.
 * No live paid provider calls.
 */

import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  convertCandidateToPersona,
  createCreationProject,
  ensureManualCandidateSlots,
  updateCandidateReview,
  uploadManualCandidateAsset,
} from "@/lib/persona/creation/creation-service";
import {
  CANONICAL_CAMERA_DIRECTIONS,
  CAMERA_DIRECTION_POLICY_VERSION,
  buildReferencePackageAnglePrompt,
  validateAngleDirectionFromPrompt,
  isAngleDirectionUsable,
  isCurrentlyAcceptedUsable,
  resolveReferencePackageSlotCoverage,
  prepareReferencePackageAngleRegeneration,
  confirmAndRegenerateReferencePackageAngle,
  MemoryReferencePackageRepository,
  setReferencePackageRepositoryForTests,
  OPENAI_PROVIDER_CAPABILITY,
  FACE_SIMILARITY_EUCLIDEAN_DUPLICATE_THRESHOLD,
  MemoryCreationRepository,
  MemoryPersonaRepository,
  setCreationRepositoryForTests,
  setPersonaRepositoryForTests,
} from "@/lib/persona";
import { OPENAI_STAGE_B_IMAGE_EDIT_PATH } from "@/agents/image/providers/openai-images-edit-provider";
import { findMasterIdentityReference } from "@/lib/persona/creation/master-identity-reference";
import type { WorkspaceScope } from "@/lib/persona/domain/types";

const ROOT = process.cwd();
const WS = "ws-phase-23d3";
const scope: WorkspaceScope = { workspaceId: WS, actorId: "tester-23d3" };

function tinyPng(): Buffer {
  return Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  );
}

function emb(seed: number): number[] {
  return Array.from({ length: 128 }, (_, i) => Math.sin((i + 1) * seed) * 0.05);
}

const projectInput = {
  name: "OBF 2.3D.3",
  description: "direction lock",
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

describe("Phase 2.3D.3 camera direction lock + slot-only regen", () => {
  let creationRepo: MemoryCreationRepository;
  let personaRepo: MemoryPersonaRepository;
  let pkgRepo: MemoryReferencePackageRepository;
  let providerCallCount: number;

  beforeEach(() => {
    creationRepo = new MemoryCreationRepository();
    personaRepo = new MemoryPersonaRepository();
    pkgRepo = new MemoryReferencePackageRepository();
    setCreationRepositoryForTests(creationRepo);
    setPersonaRepositoryForTests(personaRepo);
    setReferencePackageRepositoryForTests(pkgRepo);
    providerCallCount = 0;
  });

  afterEach(() => {
    setCreationRepositoryForTests(null);
    setPersonaRepositoryForTests(null);
    setReferencePackageRepositoryForTests(null);
  });

  async function setupPersona() {
    const project = await createCreationProject(scope, projectInput);
    const [candidate] = await ensureManualCandidateSlots(scope, project.id);
    const asset = await uploadManualCandidateAsset(
      scope,
      candidate.id,
      { bytes: tinyPng(), mimeType: "image/png", filename: "front.png" },
      { asset_type: "portrait_front", is_primary: true },
    );
    await creationRepo.updateCandidate(scope, candidate.id, {
      status: "ready",
      provider: "openai",
      primary_preview_asset_id: asset.id,
    });
    await updateCandidateReview(scope, candidate.id, { status: "selected" });
    const { persona } = await convertCandidateToPersona(scope, candidate.id);
    return { persona, masterPath: asset.storage_path };
  }

  function depsMatch() {
    const masterVec = emb(1);
    return {
      repo: pkgRepo,
      skipProviderCalls: true as const,
      downloadMasterBytes: async () => tinyPng(),
      editFromMaster: async (req: {
        referenceImageBytes: Buffer;
        prompt: string;
      }) => {
        providerCallCount += 1;
        assert.ok(req.referenceImageBytes.length > 0);
        assert.match(req.prompt, /DIRECTION IS A HARD CONSTRAINT/);
        return {
          prompt: req.prompt,
          status: "completed" as const,
          providerId: "openai" as const,
          imageBytes: tinyPng(),
          providerRequestId: `req_${providerCallCount}`,
          path: OPENAI_STAGE_B_IMAGE_EDIT_PATH,
          inputFidelity: "high" as const,
        };
      },
      extractOrientation: async (
        _bytes: Buffer,
        ctx?: { slot: string },
      ) => {
        const { orientationFixtureForSlot } = await import(
          "@/lib/persona/creation/reference-package/test-orientation-fixtures"
        );
        return orientationFixtureForSlot(
          (ctx?.slot ?? "front") as
            | "front"
            | "three_quarter_left"
            | "three_quarter_right"
            | "left_profile"
            | "right_profile",
        );
      },
      extractEmbedding: async () => {
        return {
          status: "performed" as const,
          embedding: masterVec,
          detectionConfidence: 0.99,
          faceCount: 1,
          embeddingVersion: "test",
          embeddingModel: "faceRecognitionNet",
          embeddingDimension: 128,
          similarityThresholdVersion: "v1",
        };
      },
    };
  }

  it("1–6. canonical subject-perspective prompts", () => {
    assert.equal(
      CAMERA_DIRECTION_POLICY_VERSION,
      "camera-direction-subject-perspective-v1.0.0",
    );
    assert.equal(
      CANONICAL_CAMERA_DIRECTIONS.three_quarter_left.nosePointsImageSide,
      "left",
    );
    assert.equal(
      CANONICAL_CAMERA_DIRECTIONS.three_quarter_right.nosePointsImageSide,
      "right",
    );

    const tql = buildReferencePackageAnglePrompt("three_quarter_left");
    assert.match(tql, /LEFT side of the final image/);
    assert.match(tql, /LEFT shoulder/);
    assert.match(tql, /RIGHT side of the face/);

    const tqr = buildReferencePackageAnglePrompt("three_quarter_right");
    assert.match(tqr, /RIGHT side of the final image/);
    assert.match(tqr, /RIGHT shoulder/);
    assert.match(tqr, /LEFT side of the face/);

    const lp = buildReferencePackageAnglePrompt("left_profile");
    assert.match(lp, /LEFT side of the final image/);
    assert.match(lp, /90/);

    const rp = buildReferencePackageAnglePrompt("right_profile");
    assert.match(rp, /RIGHT side of the final image/);
    assert.match(rp, /90/);

    const front = buildReferencePackageAnglePrompt("front");
    assert.match(front, /Near-zero yaw/);
    assert.match(front, /CENTER of the final image/);
  });

  it("7–11. slot-only prepare/confirm — exactly one provider call", async () => {
    const { persona } = await setupPersona();
    const deps = depsMatch();
    const prep = await prepareReferencePackageAngleRegeneration(
      scope,
      persona.id,
      "front",
      deps,
    );
    assert.equal(prep.providerCalled, false);
    assert.equal(providerCallCount, 0);
    assert.equal(prep.slots.length, 1);
    assert.equal(prep.slots[0], "front");
    assert.equal(prep.estimate.imageCount, 1);

    await assert.rejects(
      () =>
        confirmAndRegenerateReferencePackageAngle(scope, persona.id, "front", {
          confirmationToken: prep.confirmationToken,
          costConfirmed: false,
          deps,
        }),
      /Kostenbestätigung/i,
    );
    assert.equal(providerCallCount, 0);

    const result = await confirmAndRegenerateReferencePackageAngle(
      scope,
      persona.id,
      "front",
      {
        confirmationToken: prep.confirmationToken,
        costConfirmed: true,
        deps,
      },
    );
    assert.equal(providerCallCount, 1);
    assert.equal(result.results.length, 1);
    assert.equal(result.results[0]?.slot, "front");
    assert.equal(result.results[0]?.attempt.status, "review");
  });

  it("12–15. accepted TQR + Master protected; history preserved; new asset", async () => {
    const { persona } = await setupPersona();
    const deps = depsMatch();

    // Seed an approved three_quarter_right (protected).
    const prepTqr = await prepareReferencePackageAngleRegeneration(
      scope,
      persona.id,
      "three_quarter_right",
      deps,
    );
    const tqr = await confirmAndRegenerateReferencePackageAngle(
      scope,
      persona.id,
      "three_quarter_right",
      {
        confirmationToken: prepTqr.confirmationToken,
        costConfirmed: true,
        deps,
      },
    );
    const tqrAssetId = tqr.results[0]?.attempt.generated_asset_id;
    assert.ok(tqrAssetId, "three_quarter_right must produce an asset");
    await personaRepo.updateReferenceAsset(scope, tqrAssetId, {
      status: "approved",
    });

    const beforeRefs = await personaRepo.listReferenceAssets(scope, persona.id);
    const master = findMasterIdentityReference(beforeRefs)!;
    const tqrBefore = beforeRefs.find((a) => a.id === tqrAssetId)!;

    // Regenerate front only
    const prepFront = await prepareReferencePackageAngleRegeneration(
      scope,
      persona.id,
      "front",
      deps,
    );
    assert.equal(prepFront.estimate.imageCount, 1);
    const callsBefore = providerCallCount;
    const front = await confirmAndRegenerateReferencePackageAngle(
      scope,
      persona.id,
      "front",
      {
        confirmationToken: prepFront.confirmationToken,
        costConfirmed: true,
        deps,
      },
    );
    assert.equal(providerCallCount, callsBefore + 1);

    // Second front regen — history grows
    const prepFront2 = await prepareReferencePackageAngleRegeneration(
      scope,
      persona.id,
      "front",
      deps,
    );
    const front2 = await confirmAndRegenerateReferencePackageAngle(
      scope,
      persona.id,
      "front",
      {
        confirmationToken: prepFront2.confirmationToken,
        costConfirmed: true,
        deps,
      },
    );

    const afterRefs = await personaRepo.listReferenceAssets(scope, persona.id);
    const masterAfter = findMasterIdentityReference(afterRefs)!;
    assert.equal(masterAfter.id, master.id);
    assert.equal(masterAfter.storage_path, master.storage_path);
    assert.equal(masterAfter.is_primary, true);

    const tqrAfter = afterRefs.find((a) => a.id === tqrAssetId)!;
    assert.equal(tqrAfter.status, "approved");
    assert.equal(tqrAfter.storage_path, tqrBefore.storage_path);

    const frontAttempts = (await pkgRepo.listAttemptsForPersona(scope, persona.id)).filter(
      (a) => a.reference_slot === "front",
    );
    assert.ok(frontAttempts.length >= 2);
    assert.notEqual(
      front.results[0]?.attempt.generated_asset_id,
      front2.results[0]?.attempt.generated_asset_id,
    );

    // Cannot regenerate approved TQR
    await assert.rejects(
      () =>
        prepareReferencePackageAngleRegeneration(
          scope,
          persona.id,
          "three_quarter_right",
          deps,
        ),
      /approved|must not be regenerated|accepted usable/i,
    );
  });

  it("16–19. coverage + angle_direction rules", () => {
    const attempt = {
      id: "a1",
      workspace_id: WS,
      persona_id: "p",
      session_id: "s",
      master_reference_id: "m",
      reference_slot: "front" as const,
      effective_slot: null,
      reassigned_from: null,
      reassigned_at: null,
      reassigned_by: null,
      angle_review_source: null,
      angle_review_decision: null,
      provider: "openai" as const,
      provider_request_id: null,
      generated_asset_id: "g1",
      status: "review" as const,
      identity_decision: "identity_match" as const,
      identity_distance: 0.1,
      identity_similarity: 0.9,
      angle_direction: "uncertain" as const,
      detected_orientation: null,
      detected_yaw_degrees: null,
      provider_direction_strategy: null,
      provider_requested_direction: null,
      profile_identity_mode: null,
      profile_prompt_version: null,
      human_identity_review: null,
      human_identity_reviewed_at: null,
      human_identity_reviewed_by: null,
      human_identity_override_reason: null,
      identity_override_version: null,
    derived_from_asset_id: null,
    derivation_type: null,
    derived_at: null,
    derived_by: null,
    replacement_for_asset_id: null,
    replacement_for_slot: null,
    replacement_candidate: false,
      cost_eur: 0.04,
      error_message: null,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    };
    const baseAsset = {
      id: "g1",
      workspace_id: WS,
      persona_id: "p",
      asset_type: "portrait" as const,
      storage_path: "x",
      mime_type: "image/png",
      width: 1,
      height: 1,
      file_size_bytes: 1,
      checksum: "c",
      is_primary: false,
      view_angle: "front" as const,
      framing: "head_shoulders" as const,
      expression: "neutral",
      body_visibility: "partial",
      notes: "",
      source_type: "generated_external" as const,
      rights_confirmed: false,
      created_by: null,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
      status: "rejected" as const,
    };

    assert.equal(
      resolveReferencePackageSlotCoverage({
        attempts: [attempt],
        assets: [{ ...baseAsset, status: "rejected" }],
      }).acceptedCount,
      0,
    );
    assert.equal(
      resolveReferencePackageSlotCoverage({
        attempts: [attempt],
        assets: [{ ...baseAsset, status: "review" }],
      }).acceptedCount,
      0,
    );
    assert.equal(
      resolveReferencePackageSlotCoverage({
        attempts: [attempt],
        assets: [{ ...baseAsset, status: "approved" }],
      }).acceptedCount,
      1,
    );

    assert.equal(
      isCurrentlyAcceptedUsable({
        attempt: { ...attempt, angle_direction: "incorrect" },
        asset: { ...baseAsset, status: "approved" },
      }),
      false,
    );

    const bad = validateAngleDirectionFromPrompt({
      slot: "front",
      prompt: "make a cool portrait",
    });
    assert.equal(bad.angle_direction, "incorrect");
    assert.equal(isAngleDirectionUsable("incorrect"), false);

    const good = validateAngleDirectionFromPrompt({
      slot: "front",
      prompt: buildReferencePackageAnglePrompt("front"),
    });
    assert.equal(good.angle_direction, "uncertain");
  });

  it("20. discovery/FLUX/novelty unchanged; UI shows history", () => {
    assert.equal(OPENAI_PROVIDER_CAPABILITY.stageBIdentityConsistentExpansion, false);
    assert.equal(FACE_SIMILARITY_EUCLIDEAN_DUPLICATE_THRESHOLD, 0.45);
    assert.equal(OPENAI_PROVIDER_CAPABILITY.stageBUsesFlux, false);
    const studio = readFileSync(
      join(ROOT, "components/persona/persona-studio.tsx"),
      "utf8",
    );
    assert.match(studio, /Versuch \{idx \+ 1\}/);
    assert.match(studio, /Bestätigen & neu generieren/);
    assert.match(studio, /feste Subjektperspektive/);
  });
});
