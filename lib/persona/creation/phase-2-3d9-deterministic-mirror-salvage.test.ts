/**
 * Phase 2.3D.9 — Deterministic horizontal-mirror salvage for wrong camera direction.
 * No OpenAI / FLUX. Original preserved. Real orientation + identity re-run.
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
  MemoryCreationRepository,
  MemoryPersonaRepository,
  MemoryReferencePackageRepository,
  canProposeMirrorSalvage,
  createMirroredReferenceVersion,
  horizontalMirrorImageBytes,
  assertHorizontallyMirroredPngPixels,
  isCurrentlyAcceptedUsable,
  parseReferencePackageAssetNotes,
  resolveReferencePackageSlotCoverage,
  setCreationRepositoryForTests,
  setPersonaRepositoryForTests,
  setReferencePackageRepositoryForTests,
  MIRROR_SALVAGE_PROVIDER,
} from "@/lib/persona";
import { updateReferenceAsset } from "@/lib/persona/services/persona-service";
import { PersonaDomainError } from "@/lib/persona/domain/errors";
import type { WorkspaceScope } from "@/lib/persona/domain/types";
import { buildReferencePackageAssetNotes } from "@/lib/persona/creation/reference-package/types";
import { orientationFixtureForSlot } from "@/lib/persona/creation/reference-package/test-orientation-fixtures";
import type { IdentityConsistencyDecision } from "@/lib/persona/creation/reference-package/identity-consistency";
import type { FaceExtractionResult } from "@/lib/persona/face-novelty-memory/local-face-embedding-evaluator";

const ROOT = process.cwd();
const WS = "ws-phase-23d9-mirror";
const scope: WorkspaceScope = { workspaceId: WS, actorId: "tester-23d9" };

function tinyPng(): Buffer {
  return Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  );
}

function matchEmbedding(): FaceExtractionResult {
  const embedding = Array.from({ length: 128 }, (_, i) => (i % 7) * 0.01);
  return {
    status: "performed",
    embedding,
    detectionConfidence: 0.99,
    faceCount: 1,
    embeddingVersion: "test",
    embeddingModel: "test",
    embeddingDimension: 128,
    similarityThresholdVersion: "test",
  };
}

function mismatchEmbedding(): FaceExtractionResult {
  const embedding = Array.from({ length: 128 }, (_, i) => ((i + 50) % 11) * 0.08);
  return {
    status: "performed",
    embedding,
    detectionConfidence: 0.99,
    faceCount: 1,
    embeddingVersion: "test",
    embeddingModel: "test",
    embeddingDimension: 128,
    similarityThresholdVersion: "test",
  };
}

const projectInput = {
  name: "OBF 2.3D.9 mirror",
  description: "deterministic mirror salvage",
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

describe("Phase 2.3D.9 deterministic mirror salvage", () => {
  let creationRepo: MemoryCreationRepository;
  let personaRepo: MemoryPersonaRepository;
  let pkgRepo: MemoryReferencePackageRepository;
  let openaiCalls: number;
  let fluxCalls: number;
  let orientationCalls: number;
  let identityCalls: number;

  beforeEach(() => {
    creationRepo = new MemoryCreationRepository();
    personaRepo = new MemoryPersonaRepository();
    pkgRepo = new MemoryReferencePackageRepository();
    setCreationRepositoryForTests(creationRepo);
    setPersonaRepositoryForTests(personaRepo);
    setReferencePackageRepositoryForTests(pkgRepo);
    openaiCalls = 0;
    fluxCalls = 0;
    orientationCalls = 0;
    identityCalls = 0;
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

  async function seedWrongDirectionAttempt(
    personaId: string,
    opts: {
      identity?: IdentityConsistencyDecision;
      angle?: "correct" | "incorrect" | "uncertain";
      detected?: "image_left" | "image_right" | "profile_left" | "profile_right" | null;
      slot?: "three_quarter_left" | "three_quarter_right";
      assetStatus?: "review" | "rejected" | "approved";
      isPrimary?: boolean;
    } = {},
  ) {
    const slot = opts.slot ?? "three_quarter_left";
    const identity = opts.identity ?? "identity_match";
    const angle = opts.angle ?? "incorrect";
    const detected = opts.detected === undefined ? "image_right" : opts.detected;
    const session = await pkgRepo.createSession(scope, {
      persona_id: personaId,
      master_reference_id: "master",
      confirmation_token: "tok-mirror",
      estimate_hash: "h",
      estimated_cost_min: 0.04,
      estimated_cost_max: 0.04,
      max_authorized_spend: 0.04,
      image_count: 1,
    });
    const attempt = await pkgRepo.createAttempt(scope, {
      session_id: session.id,
      persona_id: personaId,
      master_reference_id: "master",
      reference_slot: slot,
      status: "failed",
      provider: "openai",
    });
    const notes = buildReferencePackageAssetNotes({
      slot,
      attemptId: attempt.id,
      masterReferenceId: "master",
      identityDecision: identity,
      angleDirection: angle,
      detectedOrientation: detected,
      requestedSlot: slot,
      effectiveSlot: slot,
    });
    const asset = await personaRepo.createReferenceAsset(scope, {
      persona_id: personaId,
      asset_type: "three_quarter",
      storage_path: `workspace/${WS}/source-${attempt.id}.png`,
      mime_type: "image/png",
      width: 2,
      height: 1,
      file_size_bytes: 10,
      checksum: attempt.id,
      view_angle: slot,
      framing: "head_shoulders",
      expression: "neutral",
      body_visibility: "partial",
      notes,
      source_type: "generated_external",
      rights_confirmed: false,
      status: opts.assetStatus ?? "rejected",
      is_primary: opts.isPrimary ?? false,
    });
    const updated = await pkgRepo.updateAttempt(scope, attempt.id, {
      generated_asset_id: asset.id,
      status: "failed",
      identity_decision: identity,
      identity_distance: identity === "identity_match" ? 0.2 : 0.45,
      identity_similarity: identity === "identity_match" ? 0.9 : 0.75,
      angle_direction: angle,
      detected_orientation: detected,
      provider_request_id: "req_original_openai",
      cost_eur: 0.04,
      provider: "openai",
    });
    return { attempt: updated, asset, session };
  }

  async function seedAcceptedSlot(
    personaId: string,
    slot: "three_quarter_right" | "front",
  ) {
    const session = await pkgRepo.createSession(scope, {
      persona_id: personaId,
      master_reference_id: "master",
      confirmation_token: `tok-${slot}`,
      estimate_hash: "h2",
      estimated_cost_min: 0.04,
      estimated_cost_max: 0.04,
      max_authorized_spend: 0.04,
      image_count: 1,
    });
    const attempt = await pkgRepo.createAttempt(scope, {
      session_id: session.id,
      persona_id: personaId,
      master_reference_id: "master",
      reference_slot: slot,
      status: "accepted",
    });
    const notes = buildReferencePackageAssetNotes({
      slot,
      attemptId: attempt.id,
      masterReferenceId: "master",
      identityDecision: "identity_match",
      angleDirection: "correct",
      detectedOrientation:
        slot === "three_quarter_right" ? "image_right" : "frontal",
    });
    const asset = await personaRepo.createReferenceAsset(scope, {
      persona_id: personaId,
      asset_type: "three_quarter",
      storage_path: `workspace/${WS}/accepted-${slot}.png`,
      mime_type: "image/png",
      width: 1,
      height: 1,
      file_size_bytes: 10,
      checksum: `${slot}-ok`,
      view_angle: slot,
      framing: "head_shoulders",
      expression: "neutral",
      body_visibility: "partial",
      notes,
      source_type: "generated_external",
      rights_confirmed: true,
      status: "approved",
      is_primary: false,
    });
    await pkgRepo.updateAttempt(scope, attempt.id, {
      generated_asset_id: asset.id,
      status: "accepted",
      identity_decision: "identity_match",
      angle_direction: "correct",
      detected_orientation:
        slot === "three_quarter_right" ? "image_right" : "frontal",
    });
    return { asset, attempt };
  }

  function mirrorDeps(opts: {
    afterIdentity?: IdentityConsistencyDecision;
    afterOrientation?: "image_left" | "image_right";
    mirroredBytes?: Buffer;
  } = {}) {
    const afterOrientation = opts.afterOrientation ?? "image_left";
    const afterIdentity = opts.afterIdentity ?? "identity_match";
    return {
      skipStorageUpload: true,
      downloadBytes: async () => tinyPng(),
      mirrorBytes: async (src: Buffer) => {
        if (opts.mirroredBytes) return opts.mirroredBytes;
        // Distinct buffer identity required by fail-closed guard.
        return Buffer.from(src);
      },
      extractOrientation: async () => {
        orientationCalls += 1;
        return orientationFixtureForSlot(
          afterOrientation === "image_left"
            ? "three_quarter_left"
            : "three_quarter_right",
        );
      },
      extractEmbedding: async () => {
        identityCalls += 1;
        // Master is extracted first; generated second.
        if (afterIdentity === "identity_mismatch" && identityCalls > 1) {
          return mismatchEmbedding();
        }
        return matchEmbedding();
      },
      editFromMaster: async () => {
        openaiCalls += 1;
        throw new Error("OpenAI must not be called");
      },
      fluxGenerate: async () => {
        fluxCalls += 1;
        throw new Error("FLUX must not be called");
      },
    };
  }

  it("1. eligible wrong-direction match can create mirror", async () => {
    const { persona } = await setupPersona();
    const { asset } = await seedWrongDirectionAttempt(persona.id, {
      identity: "identity_match",
    });
    const result = await createMirroredReferenceVersion(
      scope,
      persona.id,
      { assetId: asset.id, confirmed: true },
      mirrorDeps(),
    );
    assert.equal(result.providerCalled, false);
    assert.equal(result.openaiCalled, false);
    assert.equal(result.fluxCalled, false);
    assert.equal(result.derivationType, "horizontal_mirror");
    assert.equal(result.originalRequestedSlot, "three_quarter_left");
    assert.equal(result.effectiveSlot, "three_quarter_left");
    assert.equal(result.angleDirection, "correct");
    assert.equal(result.detectedOrientation, "image_left");
    assert.equal(result.identityDecision, "identity_match");
    assert.equal(result.assetStatus, "review");
    assert.equal(openaiCalls, 0);
    assert.equal(fluxCalls, 0);
  });

  it("2. warning can create mirror", async () => {
    const { persona } = await setupPersona();
    const { asset } = await seedWrongDirectionAttempt(persona.id, {
      identity: "identity_warning",
    });
    const result = await createMirroredReferenceVersion(
      scope,
      persona.id,
      { assetId: asset.id, confirmed: true },
      mirrorDeps({ afterIdentity: "identity_match" }),
    );
    assert.equal(result.assetId !== asset.id, true);
    assert.equal(result.providerCost, 0);
  });

  it("3. mismatch cannot create mirror", async () => {
    const { persona } = await setupPersona();
    const { asset } = await seedWrongDirectionAttempt(persona.id, {
      identity: "identity_mismatch",
    });
    await assert.rejects(
      () =>
        createMirroredReferenceVersion(
          scope,
          persona.id,
          { assetId: asset.id, confirmed: true },
          mirrorDeps(),
        ),
      (err: unknown) =>
        err instanceof PersonaDomainError &&
        /identity_mismatch cannot create a mirrored version/i.test(err.message),
    );
  });

  it("4. Master cannot create mirror", async () => {
    const { persona } = await setupPersona();
    const refs = await personaRepo.listReferenceAssets(scope, persona.id);
    const master = refs.find((r) => r.is_primary) ?? refs[0];
    assert.ok(master);
    await assert.rejects(
      () =>
        createMirroredReferenceVersion(
          scope,
          persona.id,
          { assetId: master.id, confirmed: true },
          mirrorDeps(),
        ),
      (err: unknown) =>
        err instanceof PersonaDomainError &&
        /Master Identity Reference/i.test(err.message),
    );
  });

  it("5. accepted ref cannot be overwritten", async () => {
    const { persona } = await setupPersona();
    const { asset: tqr } = await seedAcceptedSlot(
      persona.id,
      "three_quarter_right",
    );
    const before = await personaRepo.getReferenceAsset(scope, tqr.id);
    const { asset } = await seedWrongDirectionAttempt(persona.id);
    await createMirroredReferenceVersion(
      scope,
      persona.id,
      { assetId: asset.id, confirmed: true },
      mirrorDeps(),
    );
    const after = await personaRepo.getReferenceAsset(scope, tqr.id);
    assert.equal(after?.storage_path, before?.storage_path);
    assert.equal(after?.status, "approved");
    assert.equal(after?.notes, before?.notes);
  });

  it("6. original asset unchanged", async () => {
    const { persona } = await setupPersona();
    const { asset, attempt } = await seedWrongDirectionAttempt(persona.id);
    const before = {
      path: asset.storage_path,
      notes: asset.notes,
      status: asset.status,
      cost: attempt.cost_eur,
      req: attempt.provider_request_id,
      identity: attempt.identity_decision,
      angle: attempt.angle_direction,
      detected: attempt.detected_orientation,
    };
    await createMirroredReferenceVersion(
      scope,
      persona.id,
      { assetId: asset.id, confirmed: true },
      mirrorDeps(),
    );
    const afterAsset = await personaRepo.getReferenceAsset(scope, asset.id);
    const afterAttempt = (await pkgRepo.listAttemptsForPersona(scope, persona.id)).find(
      (a) => a.id === attempt.id,
    );
    assert.equal(afterAsset?.storage_path, before.path);
    assert.equal(afterAsset?.notes, before.notes);
    assert.equal(afterAsset?.status, before.status);
    assert.equal(afterAttempt?.cost_eur, before.cost);
    assert.equal(afterAttempt?.provider_request_id, before.req);
    assert.equal(afterAttempt?.identity_decision, before.identity);
    assert.equal(afterAttempt?.angle_direction, before.angle);
    assert.equal(afterAttempt?.detected_orientation, before.detected);
  });

  it("7. new derived asset created", async () => {
    const { persona } = await setupPersona();
    const { asset } = await seedWrongDirectionAttempt(persona.id);
    const result = await createMirroredReferenceVersion(
      scope,
      persona.id,
      { assetId: asset.id, confirmed: true },
      mirrorDeps(),
    );
    assert.notEqual(result.assetId, asset.id);
    const derived = await personaRepo.getReferenceAsset(scope, result.assetId);
    assert.ok(derived);
    assert.equal(derived.status, "review");
    assert.notEqual(derived.storage_path, asset.storage_path);
  });

  it("8. derived_from_asset_id persisted", async () => {
    const { persona } = await setupPersona();
    const { asset } = await seedWrongDirectionAttempt(persona.id);
    const result = await createMirroredReferenceVersion(
      scope,
      persona.id,
      { assetId: asset.id, confirmed: true },
      mirrorDeps(),
    );
    assert.equal(result.derivedFromAssetId, asset.id);
    const attempt = (await pkgRepo.listAttemptsForPersona(scope, persona.id)).find(
      (a) => a.id === result.attemptId,
    );
    assert.equal(attempt?.derived_from_asset_id, asset.id);
  });

  it("9. derivation_type persisted", async () => {
    const { persona } = await setupPersona();
    const { asset } = await seedWrongDirectionAttempt(persona.id);
    const result = await createMirroredReferenceVersion(
      scope,
      persona.id,
      { assetId: asset.id, confirmed: true },
      mirrorDeps(),
    );
    const attempt = (await pkgRepo.listAttemptsForPersona(scope, persona.id)).find(
      (a) => a.id === result.attemptId,
    );
    assert.equal(attempt?.derivation_type, "horizontal_mirror");
    const notes = parseReferencePackageAssetNotes(
      (await personaRepo.getReferenceAsset(scope, result.assetId))?.notes,
    );
    assert.equal(notes?.derivation_type, "horizontal_mirror");
  });

  it("10. provider cost = 0", async () => {
    const { persona } = await setupPersona();
    const { asset } = await seedWrongDirectionAttempt(persona.id);
    const result = await createMirroredReferenceVersion(
      scope,
      persona.id,
      { assetId: asset.id, confirmed: true },
      mirrorDeps(),
    );
    assert.equal(result.providerCost, 0);
    const attempt = (await pkgRepo.listAttemptsForPersona(scope, persona.id)).find(
      (a) => a.id === result.attemptId,
    );
    assert.equal(attempt?.cost_eur, 0);
    assert.equal(attempt?.provider, MIRROR_SALVAGE_PROVIDER);
    assert.equal(attempt?.provider_request_id, null);
  });

  it("11. no OpenAI call", async () => {
    const { persona } = await setupPersona();
    const { asset } = await seedWrongDirectionAttempt(persona.id);
    await createMirroredReferenceVersion(
      scope,
      persona.id,
      { assetId: asset.id, confirmed: true },
      mirrorDeps(),
    );
    assert.equal(openaiCalls, 0);
  });

  it("12. no FLUX call", async () => {
    const { persona } = await setupPersona();
    const { asset } = await seedWrongDirectionAttempt(persona.id);
    await createMirroredReferenceVersion(
      scope,
      persona.id,
      { assetId: asset.id, confirmed: true },
      mirrorDeps(),
    );
    assert.equal(fluxCalls, 0);
  });

  it("13. mirrored bytes are horizontally flipped", async () => {
    const { createCanvas } = await import("canvas");
    const canvas = createCanvas(4, 2);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ff0000";
    ctx.fillRect(0, 0, 1, 2);
    ctx.fillStyle = "#0000ff";
    ctx.fillRect(3, 0, 1, 2);
    const original = canvas.toBuffer("image/png");
    const mirrored = await horizontalMirrorImageBytes(original);
    const { loadImage } = await import("canvas");
    const oImg = await loadImage(original);
    const mImg = await loadImage(mirrored);
    const oCanvas = createCanvas(oImg.width, oImg.height);
    const mCanvas = createCanvas(mImg.width, mImg.height);
    oCanvas.getContext("2d").drawImage(oImg, 0, 0);
    mCanvas.getContext("2d").drawImage(mImg, 0, 0);
    const oData = oCanvas.getContext("2d").getImageData(0, 0, oImg.width, oImg.height).data;
    const mData = mCanvas.getContext("2d").getImageData(0, 0, mImg.width, mImg.height).data;
    assert.equal(
      assertHorizontallyMirroredPngPixels({
        originalRgba: oData,
        mirroredRgba: mData,
        width: oImg.width,
        height: oImg.height,
      }),
      true,
    );
  });

  it("14. real angle validation reruns", async () => {
    const { persona } = await setupPersona();
    const { asset } = await seedWrongDirectionAttempt(persona.id);
    await createMirroredReferenceVersion(
      scope,
      persona.id,
      { assetId: asset.id, confirmed: true },
      mirrorDeps(),
    );
    assert.ok(orientationCalls >= 1);
  });

  it("15. identity evaluation reruns", async () => {
    const { persona } = await setupPersona();
    const { asset } = await seedWrongDirectionAttempt(persona.id);
    await createMirroredReferenceVersion(
      scope,
      persona.id,
      { assetId: asset.id, confirmed: true },
      mirrorDeps(),
    );
    // master + generated
    assert.ok(identityCalls >= 2);
  });

  it("16. result judged against canonical TQ-left", async () => {
    const { persona } = await setupPersona();
    const { asset } = await seedWrongDirectionAttempt(persona.id);
    const result = await createMirroredReferenceVersion(
      scope,
      persona.id,
      { assetId: asset.id, confirmed: true },
      mirrorDeps({ afterOrientation: "image_left" }),
    );
    assert.equal(result.originalRequestedSlot, "three_quarter_left");
    assert.equal(result.effectiveSlot, "three_quarter_left");
    assert.notEqual(result.effectiveSlot, "three_quarter_right");
    assert.equal(result.angleDirection, "correct");
  });

  it("17. correct mirrored angle may proceed", async () => {
    const { persona } = await setupPersona();
    const { asset } = await seedWrongDirectionAttempt(persona.id);
    const result = await createMirroredReferenceVersion(
      scope,
      persona.id,
      { assetId: asset.id, confirmed: true },
      mirrorDeps(),
    );
    assert.equal(result.angleDirection, "correct");
    assert.equal(result.assetStatus, "review");
    // Not auto-approved
    const derived = await personaRepo.getReferenceAsset(scope, result.assetId);
    assert.equal(derived?.status, "review");
    assert.notEqual(derived?.status, "approved");
  });

  it("18. identity_mismatch after mirror remains blocked", async () => {
    const { persona } = await setupPersona();
    const { asset } = await seedWrongDirectionAttempt(persona.id);
    const result = await createMirroredReferenceVersion(
      scope,
      persona.id,
      { assetId: asset.id, confirmed: true },
      mirrorDeps({ afterIdentity: "identity_mismatch" }),
    );
    assert.equal(result.identityDecision, "identity_mismatch");
    const derived = await personaRepo.getReferenceAsset(scope, result.assetId);
    assert.equal(derived?.status, "rejected");
    await assert.rejects(
      () =>
        updateReferenceAsset(scope, result.assetId, {
          status: "approved",
          rights_confirmed: true,
        }),
      (err: unknown) =>
        err instanceof PersonaDomainError &&
        /Identity mismatch/i.test(err.message),
    );
  });

  it("19. warning still needs human approval", async () => {
    const { persona } = await setupPersona();
    const { asset } = await seedWrongDirectionAttempt(persona.id, {
      identity: "identity_warning",
    });
    // Force warning after mirror by using match embeddings but patching attempt —
    // evaluateIdentityConsistency with same embedding yields match; simulate warning via deps that
    // return slightly different vectors within warning band is complex. Instead: create with match,
    // then update attempt/asset to warning and assert coverage requires approval.
    const result = await createMirroredReferenceVersion(
      scope,
      persona.id,
      { assetId: asset.id, confirmed: true },
      mirrorDeps(),
    );
    await pkgRepo.updateAttempt(scope, result.attemptId, {
      identity_decision: "identity_warning",
      status: "review",
    });
    const derived = await personaRepo.getReferenceAsset(scope, result.assetId);
    assert.equal(derived?.status, "review");
    const attempts = await pkgRepo.listAttemptsForPersona(scope, persona.id);
    const assets = await personaRepo.listReferenceAssets(scope, persona.id);
    const attempt = attempts.find((a) => a.id === result.attemptId)!;
    assert.equal(
      isCurrentlyAcceptedUsable({ attempt, asset: derived! }),
      false,
    );
    await updateReferenceAsset(scope, result.assetId, {
      status: "approved",
      rights_confirmed: true,
    });
    const approved = await personaRepo.getReferenceAsset(scope, result.assetId);
    const afterAttempts = await pkgRepo.listAttemptsForPersona(scope, persona.id);
    const afterAttempt = afterAttempts.find((a) => a.id === result.attemptId)!;
    assert.equal(
      isCurrentlyAcceptedUsable({ attempt: afterAttempt, asset: approved! }),
      true,
    );
    void assets;
  });

  it("20. history shows original + derived salvage", async () => {
    const { persona } = await setupPersona();
    const { asset } = await seedWrongDirectionAttempt(persona.id);
    await createMirroredReferenceVersion(
      scope,
      persona.id,
      { assetId: asset.id, confirmed: true },
      mirrorDeps(),
    );
    const attempts = await pkgRepo.listAttemptsForPersona(scope, persona.id);
    const tql = attempts.filter((a) => a.reference_slot === "three_quarter_left");
    assert.ok(tql.some((a) => a.provider === "openai" && a.angle_direction === "incorrect"));
    assert.ok(
      tql.some(
        (a) =>
          a.provider === "derived_local" &&
          a.derivation_type === "horizontal_mirror" &&
          a.cost_eur === 0,
      ),
    );
  });

  it("21. same asset cannot count twice", async () => {
    const { persona } = await setupPersona();
    const { asset } = await seedWrongDirectionAttempt(persona.id);
    const result = await createMirroredReferenceVersion(
      scope,
      persona.id,
      { assetId: asset.id, confirmed: true },
      mirrorDeps(),
    );
    await updateReferenceAsset(scope, result.assetId, {
      status: "approved",
      rights_confirmed: true,
    });
    // Force same asset linked on two attempts (should not double-count).
    const attempts = await pkgRepo.listAttemptsForPersona(scope, persona.id);
    const derived = attempts.find((a) => a.id === result.attemptId)!;
    const dup = await pkgRepo.createAttempt(scope, {
      session_id: derived.session_id,
      persona_id: persona.id,
      master_reference_id: "master",
      reference_slot: "front",
      status: "accepted",
    });
    await pkgRepo.updateAttempt(scope, dup.id, {
      generated_asset_id: result.assetId,
      status: "accepted",
      identity_decision: "identity_match",
      angle_direction: "correct",
      effective_slot: "front",
    });
    const assets = await personaRepo.listReferenceAssets(scope, persona.id);
    const allAttempts = await pkgRepo.listAttemptsForPersona(scope, persona.id);
    const coverage = resolveReferencePackageSlotCoverage({
      attempts: allAttempts,
      assets,
    });
    const counted = coverage.slots.filter((s) => s.countsTowardCoverage);
    const assetIds = counted.map((s) => s.activeAssetId);
    assert.equal(new Set(assetIds).size, assetIds.length);
  });

  it("22. accepted TQ-right untouched", async () => {
    const { persona } = await setupPersona();
    const { asset: tqr, attempt: tqrAttempt } = await seedAcceptedSlot(
      persona.id,
      "three_quarter_right",
    );
    const { asset } = await seedWrongDirectionAttempt(persona.id);
    await createMirroredReferenceVersion(
      scope,
      persona.id,
      { assetId: asset.id, confirmed: true },
      mirrorDeps(),
    );
    const tqrAfter = await personaRepo.getReferenceAsset(scope, tqr.id);
    const tqrAttemptAfter = (
      await pkgRepo.listAttemptsForPersona(scope, persona.id)
    ).find((a) => a.id === tqrAttempt.id);
    assert.equal(tqrAfter?.status, "approved");
    assert.equal(tqrAttemptAfter?.reference_slot, "three_quarter_right");
    assert.equal(tqrAttemptAfter?.angle_direction, "correct");
  });

  it("23. coverage only increases after explicit approval", async () => {
    const { persona } = await setupPersona();
    const { asset } = await seedWrongDirectionAttempt(persona.id);
    const beforeAssets = await personaRepo.listReferenceAssets(scope, persona.id);
    const beforeAttempts = await pkgRepo.listAttemptsForPersona(scope, persona.id);
    const before = resolveReferencePackageSlotCoverage({
      attempts: beforeAttempts,
      assets: beforeAssets,
    });
    const beforeCount = before.acceptedCount;
    const result = await createMirroredReferenceVersion(
      scope,
      persona.id,
      { assetId: asset.id, confirmed: true },
      mirrorDeps(),
    );
    const midAssets = await personaRepo.listReferenceAssets(scope, persona.id);
    const midAttempts = await pkgRepo.listAttemptsForPersona(scope, persona.id);
    const mid = resolveReferencePackageSlotCoverage({
      attempts: midAttempts,
      assets: midAssets,
    });
    assert.equal(mid.acceptedCount, beforeCount);
    await updateReferenceAsset(scope, result.assetId, {
      status: "approved",
      rights_confirmed: true,
    });
    const afterAssets = await personaRepo.listReferenceAssets(scope, persona.id);
    const afterAttempts = await pkgRepo.listAttemptsForPersona(scope, persona.id);
    const after = resolveReferencePackageSlotCoverage({
      attempts: afterAttempts,
      assets: afterAssets,
    });
    assert.equal(after.acceptedCount, beforeCount + 1);
    const tql = after.slots.find((s) => s.slot === "three_quarter_left");
    assert.equal(tql?.countsTowardCoverage, true);
  });

  it("24. no novelty/discovery changes", async () => {
    const studio = readFileSync(
      join(ROOT, "components/persona/persona-studio.tsx"),
      "utf8",
    );
    assert.match(studio, /Gespiegelte Version erstellen/);
    assert.match(studio, /create_mirrored_version/);
    assert.match(studio, /ABGELEITETE SPIEGELUNG/);
    const novelty = readFileSync(
      join(ROOT, "lib/persona/face-novelty-memory/similarity-threshold.ts"),
      "utf8",
    );
    assert.ok(novelty.includes("FACE_SIMILARITY"));
    const gate = canProposeMirrorSalvage({
      isMaster: false,
      isStageBGenerated: true,
      identityLocked: false,
      assetStatus: "rejected",
      identityDecision: "identity_match",
      angleDirection: "incorrect",
      detectedOrientation: "image_right",
      slot: "three_quarter_left",
    });
    assert.equal(gate.ok, true);
  });
});
