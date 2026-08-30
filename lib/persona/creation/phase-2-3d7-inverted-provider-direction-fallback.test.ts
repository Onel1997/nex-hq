/**
 * Phase 2.3D.7 — Inverted provider-direction fallback.
 * No paid provider calls (injected editFromMaster only).
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
  FACE_SIMILARITY_EUCLIDEAN_DUPLICATE_THRESHOLD,
  MemoryCreationRepository,
  MemoryPersonaRepository,
  MemoryReferencePackageRepository,
  OPENAI_PROVIDER_CAPABILITY,
  confirmAndRegenerateReferencePackageAngle,
  DIRECTION_GENERATION_UNRELIABLE_MESSAGE,
  getReferencePackageStatus,
  invertProviderDirection,
  INVERTED_FALLBACK_REASON,
  isCurrentlyAcceptedUsable,
  parseReferencePackageAssetNotes,
  prepareReferencePackageAngleRegeneration,
  resolveProviderDirectionPlan,
  setCreationRepositoryForTests,
  setPersonaRepositoryForTests,
  setReferencePackageRepositoryForTests,
  buildReferencePackageAnglePrompt,
  validateAngleDirectionFromOrientation,
  validateAngleDirectionFromPrompt,
} from "@/lib/persona";
import { OPENAI_STAGE_B_IMAGE_EDIT_PATH } from "@/agents/image/providers/openai-images-edit-provider";
import type { WorkspaceScope } from "@/lib/persona/domain/types";
import { PersonaDomainError } from "@/lib/persona/domain/errors";
import type { ReferencePackageAttempt } from "@/lib/persona/creation/reference-package/types";
import type { ReferencePackageSlot } from "@/lib/persona/creation/reference-package/slots";
import { orientationFixtureForSlot } from "@/lib/persona/creation/reference-package/test-orientation-fixtures";

const ROOT = process.cwd();
const WS = "ws-phase-23d7";
const scope: WorkspaceScope = { workspaceId: WS, actorId: "tester-23d7" };

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
  name: "OBF 2.3D.7",
  description: "inverted provider direction fallback",
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

function oppositeDetected(slot: ReferencePackageSlot): {
  detected_orientation:
    | "image_left"
    | "image_right"
    | "profile_left"
    | "profile_right";
  detected_yaw_degrees: number;
  bothEyesVisible: boolean;
} {
  switch (slot) {
    case "three_quarter_left":
      return {
        detected_orientation: "image_right",
        detected_yaw_degrees: 38,
        bothEyesVisible: true,
      };
    case "three_quarter_right":
      return {
        detected_orientation: "image_left",
        detected_yaw_degrees: -38,
        bothEyesVisible: true,
      };
    case "left_profile":
      return {
        detected_orientation: "profile_right",
        detected_yaw_degrees: 78,
        bothEyesVisible: false,
      };
    case "right_profile":
      return {
        detected_orientation: "profile_left",
        detected_yaw_degrees: -78,
        bothEyesVisible: false,
      };
    default:
      return {
        detected_orientation: "image_right",
        detected_yaw_degrees: 20,
        bothEyesVisible: true,
      };
  }
}

function historyAttempt(
  overrides: Partial<ReferencePackageAttempt> &
    Pick<ReferencePackageAttempt, "id" | "reference_slot">,
): ReferencePackageAttempt {
  const slot = overrides.reference_slot;
  const now = overrides.created_at ?? "2026-08-09T10:00:00.000Z";
  return {
    workspace_id: WS,
    persona_id: "p",
    session_id: "s",
    master_reference_id: "m",
    effective_slot: null,
    reassigned_from: null,
    reassigned_at: null,
    reassigned_by: null,
    angle_review_source: null,
    angle_review_decision: null,
    provider: "openai",
    provider_request_id: "req",
    generated_asset_id: null,
    status: "failed",
    identity_decision: "identity_match",
    identity_distance: 0.1,
    identity_similarity: 0.9,
    angle_direction: "incorrect",
    detected_orientation: oppositeDetected(slot).detected_orientation,
    detected_yaw_degrees: oppositeDetected(slot).detected_yaw_degrees,
    provider_direction_strategy: "canonical",
    provider_requested_direction: slot,
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
    error_message: "Wrong camera direction",
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

describe("Phase 2.3D.7 inverted provider direction fallback", () => {
  let creationRepo: MemoryCreationRepository;
  let personaRepo: MemoryPersonaRepository;
  let pkgRepo: MemoryReferencePackageRepository;
  let providerCallCount: number;
  let lastPrompt: string;
  let orientationMode:
    | "correct_for_canonical"
    | "opposite_of_canonical"
    | "force_slot";
  let forceOrientationSlot: ReferencePackageSlot | null;
  let identityMode: "match" | "warning" | "mismatch";

  beforeEach(() => {
    creationRepo = new MemoryCreationRepository();
    personaRepo = new MemoryPersonaRepository();
    pkgRepo = new MemoryReferencePackageRepository();
    setCreationRepositoryForTests(creationRepo);
    setPersonaRepositoryForTests(personaRepo);
    setReferencePackageRepositoryForTests(pkgRepo);
    providerCallCount = 0;
    lastPrompt = "";
    orientationMode = "correct_for_canonical";
    forceOrientationSlot = null;
    identityMode = "match";
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
    return { persona };
  }

  function deps() {
    const masterVec = emb(1);
    const genVec =
      identityMode === "match"
        ? emb(1)
        : identityMode === "warning"
          ? // Euclidean ≈ 0.50 → identity_warning band (0.45, 0.55]
            emb(1).map((v, i) => (i < 25 ? v + 0.1 : v))
          : emb(99);
    let extractCall = 0;
    return {
      repo: pkgRepo,
      skipProviderCalls: true as const,
      downloadMasterBytes: async () => tinyPng(),
      editFromMaster: async (req: {
        referenceImageBytes: Buffer;
        prompt: string;
      }) => {
        providerCallCount += 1;
        lastPrompt = req.prompt;
        assert.ok(req.referenceImageBytes.length > 0);
        return {
          prompt: req.prompt,
          status: "completed" as const,
          providerId: "openai" as const,
          imageBytes: tinyPng(),
          providerRequestId: `req_23d7_${providerCallCount}`,
          path: OPENAI_STAGE_B_IMAGE_EDIT_PATH,
          inputFidelity: "high" as const,
        };
      },
      extractOrientation: async (
        _bytes: Buffer,
        ctx?: { slot: string },
      ) => {
        const canonical = (ctx?.slot ?? "front") as ReferencePackageSlot;
        if (orientationMode === "force_slot" && forceOrientationSlot) {
          return orientationFixtureForSlot(forceOrientationSlot);
        }
        if (orientationMode === "opposite_of_canonical") {
          const opp = oppositeDetected(canonical);
          return {
            ...opp,
            noseSide:
              opp.detected_orientation.includes("left") ? ("left" as const) : ("right" as const),
            noseOffsetNorm: 0.2,
            reason: "test opposite",
          };
        }
        return orientationFixtureForSlot(canonical);
      },
      extractEmbedding: async () => {
        extractCall += 1;
        const embedding = extractCall % 2 === 1 ? masterVec : genVec;
        return {
          status: "performed" as const,
          embedding,
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

  async function seedOppositeFailures(
    personaId: string,
    slot: ReferencePackageSlot,
    count: number,
  ) {
    const session = await pkgRepo.createSession(scope, {
      persona_id: personaId,
      master_reference_id: "master-seed",
      confirmation_token: `tok-seed-${slot}`,
      estimate_hash: "hash",
      estimated_cost_min: 0.04,
      estimated_cost_max: 0.04,
      max_authorized_spend: 0.04,
      image_count: 1,
    });
    for (let i = 0; i < count; i++) {
      const created = await pkgRepo.createAttempt(scope, {
        session_id: session.id,
        persona_id: personaId,
        master_reference_id: "master-seed",
        reference_slot: slot,
        status: "failed",
        provider_direction_strategy: "canonical",
        provider_requested_direction: slot,
      });
      const opp = oppositeDetected(slot);
      await pkgRepo.updateAttempt(scope, created.id, {
        status: "failed",
        angle_direction: "incorrect",
        detected_orientation: opp.detected_orientation,
        detected_yaw_degrees: opp.detected_yaw_degrees,
        identity_decision: "identity_match",
        error_message: "Wrong camera direction",
      });
    }
  }

  // 1 — first failure does not activate fallback
  it("1. first opposite failure does not activate inverted_fallback", () => {
    const attempts = [
      historyAttempt({
        id: "a1",
        reference_slot: "right_profile",
        created_at: "2026-08-09T12:00:00.000Z",
      }),
    ];
    const plan = resolveProviderDirectionPlan(attempts, "right_profile");
    assert.equal(plan.provider_direction_strategy, "canonical");
    assert.equal(plan.provider_requested_direction, "right_profile");
    assert.equal(plan.invertedFallbackEligible, false);
  });

  // 2 — two consistent opposite failures activate fallback
  it("2. two consistent opposite-direction failures activate fallback", () => {
    const attempts = [
      historyAttempt({
        id: "a1",
        reference_slot: "right_profile",
        created_at: "2026-08-09T12:00:00.000Z",
      }),
      historyAttempt({
        id: "a2",
        reference_slot: "right_profile",
        created_at: "2026-08-09T12:01:00.000Z",
      }),
    ];
    const plan = resolveProviderDirectionPlan(attempts, "right_profile");
    assert.equal(plan.invertedFallbackEligible, true);
    assert.equal(plan.provider_direction_strategy, "inverted_fallback");
    assert.equal(plan.provider_requested_direction, "left_profile");
    assert.equal(plan.requested_slot, "right_profile");
    assert.match(plan.reason ?? "", /opposite validated orientation/);
  });

  // 3–6 — mapping
  it("3–6. inversion mapping for TQ and profiles", () => {
    assert.equal(invertProviderDirection("three_quarter_left"), "three_quarter_right");
    assert.equal(invertProviderDirection("three_quarter_right"), "three_quarter_left");
    assert.equal(invertProviderDirection("left_profile"), "right_profile");
    assert.equal(invertProviderDirection("right_profile"), "left_profile");
  });

  // 7 — front never inverts
  it("7. front never inverts", () => {
    assert.equal(invertProviderDirection("front"), null);
    const attempts = [
      historyAttempt({
        id: "f1",
        reference_slot: "front",
        angle_direction: "incorrect",
        detected_orientation: "image_left",
        created_at: "2026-08-09T12:00:00.000Z",
      }),
      historyAttempt({
        id: "f2",
        reference_slot: "front",
        angle_direction: "incorrect",
        detected_orientation: "image_right",
        created_at: "2026-08-09T12:01:00.000Z",
      }),
    ];
    const plan = resolveProviderDirectionPlan(attempts, "front");
    assert.equal(plan.provider_direction_strategy, "canonical");
    assert.equal(plan.provider_requested_direction, "front");
    assert.equal(plan.invertedFallbackEligible, false);
  });

  // 8–10 — canonical slot / strategy / provider direction persist
  it("8–10. canonical slot unchanged; strategy and provider direction persist", async () => {
    const { persona } = await setupPersona();
    await seedOppositeFailures(persona.id, "three_quarter_left", 2);
    const before = providerCallCount;
    orientationMode = "correct_for_canonical";
    const prep = await prepareReferencePackageAngleRegeneration(
      scope,
      persona.id,
      "three_quarter_left",
      deps(),
    );
    assert.equal(providerCallCount, before);
    assert.equal(prep.providerCalled, false);
    assert.equal(prep.directionPlan.requested_slot, "three_quarter_left");
    assert.equal(
      prep.directionPlan.provider_direction_strategy,
      "inverted_fallback",
    );
    assert.equal(
      prep.directionPlan.provider_requested_direction,
      "three_quarter_right",
    );

    const result = await confirmAndRegenerateReferencePackageAngle(
      scope,
      persona.id,
      "three_quarter_left",
      {
        confirmationToken: prep.confirmationToken,
        costConfirmed: true,
        invertedFallbackConfirmed: true,
        deps: deps(),
      },
    );
    const attempt = result.results[0]!.attempt;
    assert.equal(attempt.reference_slot, "three_quarter_left");
    assert.equal(attempt.provider_direction_strategy, "inverted_fallback");
    assert.equal(attempt.provider_requested_direction, "three_quarter_right");
    assert.match(lastPrompt, /three_quarter_right/);
    assert.match(lastPrompt, /Target slot: Three-quarter left/);
    assert.match(lastPrompt, /SAME PERSON/);
    assert.match(lastPrompt, /Preserve eyes, nose, lips/);
  });

  // 11–13 — prepare zero calls; confirm once; explicit confirmation
  it("11–13. prepare zero provider calls; confirm once; confirmation required", async () => {
    const { persona } = await setupPersona();
    await seedOppositeFailures(persona.id, "right_profile", 2);
    const before = providerCallCount;
    const prep = await prepareReferencePackageAngleRegeneration(
      scope,
      persona.id,
      "right_profile",
      deps(),
    );
    assert.equal(providerCallCount, before);
    assert.equal(prep.providerCalled, false);
    assert.equal(
      prep.directionPlan.disclosure.directionStrategyLabel,
      "Inverted provider fallback",
    );
    assert.equal(prep.directionPlan.disclosure.reason, INVERTED_FALLBACK_REASON);

    await assert.rejects(
      () =>
        confirmAndRegenerateReferencePackageAngle(
          scope,
          persona.id,
          "right_profile",
          {
            confirmationToken: prep.confirmationToken,
            costConfirmed: false,
            deps: deps(),
          },
        ),
      (err: unknown) =>
        err instanceof PersonaDomainError &&
        /Kostenbestätigung|confirmation/i.test(err.message),
    );
    assert.equal(providerCallCount, before);

    await confirmAndRegenerateReferencePackageAngle(
      scope,
      persona.id,
      "right_profile",
      {
        confirmationToken: prep.confirmationToken,
        costConfirmed: true,
        invertedFallbackConfirmed: true,
        deps: deps(),
      },
    );
    assert.equal(providerCallCount, before + 1);
  });

  // 14–16 — actual orientation judges canonical; correct may proceed; incorrect not usable
  it("14–16. actual validator judges canonical; incorrect cannot become usable", async () => {
    const { persona } = await setupPersona();
    await seedOppositeFailures(persona.id, "right_profile", 2);

    // Provider asked left_profile (inverted), but actual image is right_profile → correct for canonical
    orientationMode = "correct_for_canonical";
    const prepOk = await prepareReferencePackageAngleRegeneration(
      scope,
      persona.id,
      "right_profile",
      deps(),
    );
    const ok = await confirmAndRegenerateReferencePackageAngle(
      scope,
      persona.id,
      "right_profile",
      {
        confirmationToken: prepOk.confirmationToken,
        costConfirmed: true,
        invertedFallbackConfirmed: true,
        deps: deps(),
      },
    );
    assert.equal(ok.results[0]!.attempt.angle_direction, "correct");
    assert.equal(ok.results[0]!.attempt.reference_slot, "right_profile");
    assert.equal(
      ok.results[0]!.attempt.provider_requested_direction,
      "left_profile",
    );

    // Fresh persona path for incorrect actual under inverted strategy
    const { persona: p2 } = await setupPersona();
    await seedOppositeFailures(p2.id, "three_quarter_left", 2);
    orientationMode = "opposite_of_canonical";
    identityMode = "match";
    const prepBad = await prepareReferencePackageAngleRegeneration(
      scope,
      p2.id,
      "three_quarter_left",
      deps(),
    );
    const bad = await confirmAndRegenerateReferencePackageAngle(
      scope,
      p2.id,
      "three_quarter_left",
      {
        confirmationToken: prepBad.confirmationToken,
        costConfirmed: true,
        invertedFallbackConfirmed: true,
        deps: deps(),
      },
    );
    const badAttempt = bad.results[0]!.attempt;
    assert.equal(badAttempt.angle_direction, "incorrect");
    assert.equal(badAttempt.status, "failed");
    const assets = await personaRepo.listReferenceAssets(scope, p2.id);
    const asset = assets.find((a) => a.id === badAttempt.generated_asset_id);
    assert.ok(asset);
    assert.equal(
      isCurrentlyAcceptedUsable({ attempt: badAttempt, asset }),
      false,
    );
  });

  // 17–18 identity safety
  it("17–18. identity_mismatch blocked; identity_warning needs human approval", async () => {
    const { persona } = await setupPersona();
    await seedOppositeFailures(persona.id, "right_profile", 2);
    orientationMode = "correct_for_canonical";
    identityMode = "mismatch";
    const prep = await prepareReferencePackageAngleRegeneration(
      scope,
      persona.id,
      "right_profile",
      deps(),
    );
    const result = await confirmAndRegenerateReferencePackageAngle(
      scope,
      persona.id,
      "right_profile",
      {
        confirmationToken: prep.confirmationToken,
        costConfirmed: true,
        invertedFallbackConfirmed: true,
        deps: deps(),
      },
    );
    assert.equal(result.results[0]!.attempt.identity_decision, "identity_mismatch");
    assert.equal(result.results[0]!.attempt.status, "mismatch");
    const assets = await personaRepo.listReferenceAssets(scope, persona.id);
    const asset = assets.find(
      (a) => a.id === result.results[0]!.attempt.generated_asset_id,
    );
    assert.equal(
      isCurrentlyAcceptedUsable({
        attempt: result.results[0]!.attempt,
        asset: asset!,
      }),
      false,
    );

    const { persona: pWarn } = await setupPersona();
    await seedOppositeFailures(pWarn.id, "left_profile", 2);
    identityMode = "warning";
    orientationMode = "correct_for_canonical";
    const prepW = await prepareReferencePackageAngleRegeneration(
      scope,
      pWarn.id,
      "left_profile",
      deps(),
    );
    const warn = await confirmAndRegenerateReferencePackageAngle(
      scope,
      pWarn.id,
      "left_profile",
      {
        confirmationToken: prepW.confirmationToken,
        costConfirmed: true,
        invertedFallbackConfirmed: true,
        deps: deps(),
      },
    );
    assert.equal(warn.results[0]!.attempt.identity_decision, "identity_warning");
    assert.equal(warn.results[0]!.attempt.status, "review");
    const warnAssets = await personaRepo.listReferenceAssets(scope, pWarn.id);
    const warnAsset = warnAssets.find(
      (a) => a.id === warn.results[0]!.attempt.generated_asset_id,
    );
    // Without explicit human approve → not usable
    assert.equal(
      isCurrentlyAcceptedUsable({
        attempt: warn.results[0]!.attempt,
        asset: warnAsset!,
      }),
      false,
    );
  });

  // 19–21 accepted protected; history preserved; no asset reuse
  it("19–21. accepted slots protected; history preserved; no incorrect asset reuse", async () => {
    const { persona } = await setupPersona();
    // Accept front via a successful generation
    orientationMode = "correct_for_canonical";
    identityMode = "match";
    const prepFront = await prepareReferencePackageAngleRegeneration(
      scope,
      persona.id,
      "front",
      deps(),
    );
    const frontResult = await confirmAndRegenerateReferencePackageAngle(
      scope,
      persona.id,
      "front",
      {
        confirmationToken: prepFront.confirmationToken,
        costConfirmed: true,
        deps: deps(),
      },
    );
    const frontAttempt = frontResult.results[0]!.attempt;
    assert.ok(frontAttempt.generated_asset_id);
    await personaRepo.updateReferenceAsset(scope, frontAttempt.generated_asset_id!, {
      status: "approved",
    });
    await pkgRepo.updateAttempt(scope, frontAttempt.id, { status: "accepted" });

    const frontAssetId = frontAttempt.generated_asset_id!;
    await seedOppositeFailures(persona.id, "right_profile", 2);
    const statusBefore = await getReferencePackageStatus(scope, persona.id, deps());
    const frontRow = statusBefore.slots.find((s) => s.slot === "front");
    assert.equal(frontRow?.status, "accepted");
    assert.equal(frontRow?.acceptedAssetId, frontAssetId);

    orientationMode = "correct_for_canonical";
    const prep = await prepareReferencePackageAngleRegeneration(
      scope,
      persona.id,
      "right_profile",
      deps(),
    );
    assert.deepEqual(prep.slots, ["right_profile"]);
    const regen = await confirmAndRegenerateReferencePackageAngle(
      scope,
      persona.id,
      "right_profile",
      {
        confirmationToken: prep.confirmationToken,
        costConfirmed: true,
        invertedFallbackConfirmed: true,
        deps: deps(),
      },
    );
    assert.notEqual(regen.results[0]!.attempt.generated_asset_id, frontAssetId);

    const statusAfter = await getReferencePackageStatus(scope, persona.id, deps());
    const frontAfter = statusAfter.slots.find((s) => s.slot === "front");
    assert.equal(frontAfter?.acceptedAssetId, frontAssetId);
    const rpHistory = statusAfter.slots.find((s) => s.slot === "right_profile")
      ?.attemptHistory;
    assert.ok(rpHistory && rpHistory.length >= 3);
    assert.ok(
      rpHistory.some((a) => a.provider_direction_strategy === "inverted_fallback"),
    );
    // Seeded history untouched (still incorrect opposite)
    const seeded = rpHistory.filter(
      (a) => a.provider_direction_strategy === "canonical",
    );
    assert.ok(seeded.length >= 2);
    assert.ok(seeded.every((a) => a.angle_direction === "incorrect"));
  });

  // 22–23 max fallback + unreliable
  it("22–23. max inverted retries enforced; direction_generation_unreliable stops retries", async () => {
    const attempts: ReferencePackageAttempt[] = [
      historyAttempt({
        id: "c1",
        reference_slot: "three_quarter_left",
        created_at: "2026-08-09T12:00:00.000Z",
      }),
      historyAttempt({
        id: "c2",
        reference_slot: "three_quarter_left",
        created_at: "2026-08-09T12:01:00.000Z",
      }),
      historyAttempt({
        id: "i1",
        reference_slot: "three_quarter_left",
        provider_direction_strategy: "inverted_fallback",
        provider_requested_direction: "three_quarter_right",
        created_at: "2026-08-09T12:02:00.000Z",
      }),
      historyAttempt({
        id: "i2",
        reference_slot: "three_quarter_left",
        provider_direction_strategy: "inverted_fallback",
        provider_requested_direction: "three_quarter_right",
        created_at: "2026-08-09T12:03:00.000Z",
      }),
    ];
    const plan = resolveProviderDirectionPlan(attempts, "three_quarter_left");
    assert.equal(plan.direction_generation_unreliable, true);
    assert.equal(plan.allowPaidRegeneration, false);
    assert.equal(plan.reason, DIRECTION_GENERATION_UNRELIABLE_MESSAGE);

    const { persona } = await setupPersona();
    const session = await pkgRepo.createSession(scope, {
      persona_id: persona.id,
      master_reference_id: "m",
      confirmation_token: "tok-unrel",
      estimate_hash: "h",
      estimated_cost_min: 0.04,
      estimated_cost_max: 0.04,
      max_authorized_spend: 0.04,
      image_count: 1,
    });
    for (const a of attempts) {
      const created = await pkgRepo.createAttempt(scope, {
        session_id: session.id,
        persona_id: persona.id,
        master_reference_id: "m",
        reference_slot: "three_quarter_left",
        status: "failed",
        provider_direction_strategy: a.provider_direction_strategy ?? "canonical",
        provider_requested_direction:
          a.provider_requested_direction ?? "three_quarter_left",
      });
      await pkgRepo.updateAttempt(scope, created.id, {
        angle_direction: "incorrect",
        detected_orientation: a.detected_orientation,
        detected_yaw_degrees: a.detected_yaw_degrees,
        provider_direction_strategy: a.provider_direction_strategy,
        provider_requested_direction: a.provider_requested_direction,
        status: "failed",
      });
    }

    const before = providerCallCount;
    await assert.rejects(
      () =>
        prepareReferencePackageAngleRegeneration(
          scope,
          persona.id,
          "three_quarter_left",
          deps(),
        ),
      (err: unknown) =>
        err instanceof PersonaDomainError &&
        err.message === DIRECTION_GENERATION_UNRELIABLE_MESSAGE,
    );
    assert.equal(providerCallCount, before);

    const status = await getReferencePackageStatus(scope, persona.id, deps());
    const row = status.slots.find((s) => s.slot === "three_quarter_left");
    assert.equal(row?.directionGenerationUnreliable, true);
  });

  // 14 unit: prompt + orientation under inverted still judges canonical
  it("14b. orientation validation always uses canonical slot", () => {
    const prompt = buildReferencePackageAnglePrompt("right_profile", {
      providerDirectionStrategy: "inverted_fallback",
      providerRequestedDirection: "left_profile",
    });
    const promptValidation = validateAngleDirectionFromPrompt({
      slot: "left_profile",
      prompt,
    });
    assert.equal(promptValidation.angle_direction, "uncertain");

    const correct = validateAngleDirectionFromOrientation({
      slot: "right_profile",
      orientation: orientationFixtureForSlot("right_profile"),
      promptValidation: { ...promptValidation, slot: "right_profile" },
    });
    assert.equal(correct.angle_direction, "correct");

    const incorrect = validateAngleDirectionFromOrientation({
      slot: "right_profile",
      orientation: orientationFixtureForSlot("left_profile"),
      promptValidation: { ...promptValidation, slot: "right_profile" },
    });
    assert.equal(incorrect.angle_direction, "incorrect");
  });

  // 20 notes preserve provider strategy
  it("20b. asset notes preserve provider strategy without rewriting slot", async () => {
    const { persona } = await setupPersona();
    await seedOppositeFailures(persona.id, "right_profile", 2);
    orientationMode = "correct_for_canonical";
    const prep = await prepareReferencePackageAngleRegeneration(
      scope,
      persona.id,
      "right_profile",
      deps(),
    );
    const result = await confirmAndRegenerateReferencePackageAngle(
      scope,
      persona.id,
      "right_profile",
      {
        confirmationToken: prep.confirmationToken,
        costConfirmed: true,
        invertedFallbackConfirmed: true,
        deps: deps(),
      },
    );
    const assets = await personaRepo.listReferenceAssets(scope, persona.id);
    const asset = assets.find(
      (a) => a.id === result.results[0]!.attempt.generated_asset_id,
    );
    const notes = parseReferencePackageAssetNotes(asset?.notes);
    assert.equal(notes?.requested_slot, "right_profile");
    assert.equal(notes?.provider_direction_strategy, "inverted_fallback");
    assert.equal(notes?.provider_requested_direction, "left_profile");
  });

  // 24 — no FLUX / discovery / novelty changes
  it("24. no FLUX/discovery/novelty changes; UI discloses inverted fallback", () => {
    assert.equal(OPENAI_PROVIDER_CAPABILITY.stageBUsesFlux, false);
    assert.equal(FACE_SIMILARITY_EUCLIDEAN_DUPLICATE_THRESHOLD, 0.45);
    const studio = readFileSync(
      join(ROOT, "components/persona/persona-studio.tsx"),
      "utf8",
    );
    assert.match(studio, /Zielplatz:/);
    assert.match(studio, /Richtungsstrategie:/);
    assert.match(studio, /Provider-Anweisung:/);
    assert.match(studio, /Abschließende Freigabe:/);
    assert.match(
      studio,
      /Kamerarichtung konnte nicht zuverlässig erstellt werden/,
    );
    assert.match(studio, /reference-package-direction-plan/);
    assert.match(studio, /invertedFallbackConfirmed/);
  });

  it("current THREE_QUARTER_LEFT history eligibility (>=2 opposite → propose inverted)", () => {
    const attempts = [
      historyAttempt({
        id: "tq1",
        reference_slot: "three_quarter_left",
        detected_orientation: "image_right",
        created_at: "2026-08-09T12:00:00.000Z",
      }),
      historyAttempt({
        id: "tq2",
        reference_slot: "three_quarter_left",
        detected_orientation: "image_right",
        created_at: "2026-08-09T12:01:00.000Z",
      }),
    ];
    const plan = resolveProviderDirectionPlan(attempts, "three_quarter_left");
    assert.equal(plan.provider_direction_strategy, "inverted_fallback");
    assert.equal(plan.provider_requested_direction, "three_quarter_right");
    assert.equal(plan.allowPaidRegeneration, true);
  });

  it("current RIGHT_PROFILE history eligibility (>=2 opposite → propose inverted)", () => {
    const attempts = [
      historyAttempt({
        id: "rp1",
        reference_slot: "right_profile",
        detected_orientation: "profile_left",
        created_at: "2026-08-09T12:00:00.000Z",
      }),
      historyAttempt({
        id: "rp2",
        reference_slot: "right_profile",
        detected_orientation: "image_left",
        created_at: "2026-08-09T12:01:00.000Z",
      }),
    ];
    const plan = resolveProviderDirectionPlan(attempts, "right_profile");
    assert.equal(plan.provider_direction_strategy, "inverted_fallback");
    assert.equal(plan.provider_requested_direction, "left_profile");
    assert.equal(plan.allowPaidRegeneration, true);
  });
});
