/**
 * Phase 2.3D.8 — Explicit human identity override.
 * No paid provider calls / no new images.
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
  IDENTITY_CONSISTENCY_MATCH_EUCLIDEAN,
  IDENTITY_OVERRIDE_VERSION,
  MemoryCreationRepository,
  MemoryPersonaRepository,
  MemoryReferencePackageRepository,
  OPENAI_PROVIDER_CAPABILITY,
  approveHumanIdentityOverride,
  canProposeHumanIdentityOverride,
  isCurrentlyAcceptedUsable,
  isMismatchOverrideUsable,
  parseReferencePackageAssetNotes,
  resolveIdentitySourceConfidence,
  resolveReferencePackageSlotCoverage,
  setCreationRepositoryForTests,
  setPersonaRepositoryForTests,
  setReferencePackageRepositoryForTests,
} from "@/lib/persona";
import { updateReferenceAsset } from "@/lib/persona/services/persona-service";
import { PersonaDomainError } from "@/lib/persona/domain/errors";
import type { WorkspaceScope } from "@/lib/persona/domain/types";
import type { ReferencePackageAttempt } from "@/lib/persona/creation/reference-package/types";
import { buildReferencePackageAssetNotes } from "@/lib/persona/creation/reference-package/types";

const ROOT = process.cwd();
const WS = "ws-phase-23d8-override";
const scope: WorkspaceScope = { workspaceId: WS, actorId: "tester-23d8" };

function tinyPng(): Buffer {
  return Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  );
}

const projectInput = {
  name: "OBF 2.3D.8 override",
  description: "human identity override",
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

describe("Phase 2.3D.8 explicit human identity override", () => {
  let creationRepo: MemoryCreationRepository;
  let personaRepo: MemoryPersonaRepository;
  let pkgRepo: MemoryReferencePackageRepository;

  beforeEach(() => {
    creationRepo = new MemoryCreationRepository();
    personaRepo = new MemoryPersonaRepository();
    pkgRepo = new MemoryReferencePackageRepository();
    setCreationRepositoryForTests(creationRepo);
    setPersonaRepositoryForTests(personaRepo);
    setReferencePackageRepositoryForTests(pkgRepo);
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

  async function seedMismatchAttempt(
    personaId: string,
    opts: {
      angle?: "correct" | "incorrect" | "uncertain";
      detected?: "profile_right" | "profile_left" | null;
      status?: "rejected" | "review";
      humanReview?: "rejected" | "none" | null;
    } = {},
  ) {
    const angle = opts.angle ?? "correct";
    const session = await pkgRepo.createSession(scope, {
      persona_id: personaId,
      master_reference_id: "master",
      confirmation_token: "tok-override",
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
      reference_slot: "right_profile",
      status: "mismatch",
    });
    const notes = buildReferencePackageAssetNotes({
      slot: "right_profile",
      attemptId: attempt.id,
      masterReferenceId: "master",
      identityDecision: "identity_mismatch",
      angleDirection: angle,
    });
    const asset = await personaRepo.createReferenceAsset(scope, {
      persona_id: personaId,
      asset_type: "profile",
      storage_path: `workspace/${WS}/${attempt.id}.png`,
      mime_type: "image/png",
      width: 1,
      height: 1,
      file_size_bytes: 10,
      checksum: attempt.id,
      view_angle: "right_profile",
      framing: "head_shoulders",
      expression: "neutral",
      body_visibility: "partial",
      notes,
      source_type: "generated_external",
      rights_confirmed: false,
      status: opts.status ?? "rejected",
      is_primary: false,
    });
    const updated = await pkgRepo.updateAttempt(scope, attempt.id, {
      generated_asset_id: asset.id,
      status: "mismatch",
      identity_decision: "identity_mismatch",
      identity_distance: 0.58,
      identity_similarity: 0.71,
      angle_direction: angle,
      detected_orientation:
        opts.detected === undefined ? "profile_right" : opts.detected,
      human_identity_review: opts.humanReview ?? null,
    });
    return { attempt: updated, asset };
  }

  // Patch audit logger via dynamic import intercept — verify via return + notes.
  // Also monkey-patch log by checking notes/attempt after approve.

  it("1. mismatch cannot normal-approve", async () => {
    const { persona } = await setupPersona();
    const { asset } = await seedMismatchAttempt(persona.id);
    await assert.rejects(
      () =>
        updateReferenceAsset(scope, asset.id, {
          status: "approved",
          rights_confirmed: true,
        }),
      (err: unknown) =>
        err instanceof PersonaDomainError &&
        /Identity mismatch references cannot become Accepted/i.test(err.message),
    );
  });

  it("2–6. explicit override with compare+confirm; machine evidence preserved", async () => {
    const { persona } = await setupPersona();
    const { attempt, asset } = await seedMismatchAttempt(persona.id);
    const beforeDecision = attempt.identity_decision;
    const beforeDist = attempt.identity_distance;
    const beforeSim = attempt.identity_similarity;

    await assert.rejects(
      () =>
        approveHumanIdentityOverride(scope, persona.id, {
          assetId: asset.id,
          masterCompared: false,
          overrideConfirmed: true,
        }),
      /Compare with Master/,
    );

    await assert.rejects(
      () =>
        approveHumanIdentityOverride(scope, persona.id, {
          assetId: asset.id,
          masterCompared: true,
          overrideConfirmed: false,
        }),
      /Explicit confirmation/,
    );

    const result = await approveHumanIdentityOverride(scope, persona.id, {
      assetId: asset.id,
      masterCompared: true,
      overrideConfirmed: true,
    });

    assert.equal(result.providerCalled, false);
    assert.equal(result.newImageGenerated, false);
    assert.equal(result.assetId, asset.id);
    assert.equal(result.machineIdentityDecision, "identity_mismatch");
    assert.equal(result.identityDecisionUnchanged, true);
    assert.equal(result.humanIdentityReview, "approved_override");
    assert.equal(result.identityOverrideVersion, IDENTITY_OVERRIDE_VERSION);
    assert.equal(result.identitySourceConfidence, "human_mismatch_override");

    const refreshedAttempt = (await pkgRepo.listAttemptsForPersona(scope, persona.id)).find(
      (a) => a.id === attempt.id,
    )!;
    assert.equal(refreshedAttempt.identity_decision, beforeDecision);
    assert.equal(refreshedAttempt.identity_distance, beforeDist);
    assert.equal(refreshedAttempt.identity_similarity, beforeSim);
    assert.equal(refreshedAttempt.human_identity_review, "approved_override");

    const refreshedAsset = await personaRepo.getReferenceAsset(scope, asset.id);
    assert.equal(refreshedAsset?.id, asset.id);
    assert.equal(refreshedAsset?.status, "approved");
    const notes = parseReferencePackageAssetNotes(refreshedAsset?.notes);
    assert.equal(notes?.identity_decision, "identity_mismatch");
    assert.equal(notes?.human_identity_review, "approved_override");
    assert.equal(notes?.identity_source_confidence, "human_mismatch_override");
  });

  it("7–9. correct angle required; incorrect/uncertain cannot override", async () => {
    const { persona } = await setupPersona();
    const bad = await seedMismatchAttempt(persona.id, { angle: "incorrect" });
    await assert.rejects(
      () =>
        approveHumanIdentityOverride(scope, persona.id, {
          assetId: bad.asset.id,
          masterCompared: true,
          overrideConfirmed: true,
        }),
      /Wrong camera direction|cannot be overridden/i,
    );

    const unc = await seedMismatchAttempt(persona.id, {
      angle: "uncertain",
      detected: null,
    });
    await assert.rejects(
      () =>
        approveHumanIdentityOverride(scope, persona.id, {
          assetId: unc.asset.id,
          masterCompared: true,
          overrideConfirmed: true,
        }),
      /Uncertain|cannot be overridden/i,
    );

    assert.equal(
      canProposeHumanIdentityOverride({
        isMaster: false,
        isStageBGenerated: true,
        identityLocked: false,
        assetStatus: "rejected",
        identityDecision: "identity_mismatch",
        angleDirection: "correct",
        masterComparedInSession: true,
      }).ok,
      true,
    );
  });

  it("10. Master cannot use override", async () => {
    assert.equal(
      canProposeHumanIdentityOverride({
        isMaster: true,
        isStageBGenerated: false,
        identityLocked: false,
        assetStatus: "approved",
        identityDecision: "identity_mismatch",
        angleDirection: "correct",
        masterComparedInSession: true,
      }).ok,
      false,
    );
  });

  it("11–13. override counts toward coverage with human override label", async () => {
    const { persona } = await setupPersona();
    const { attempt, asset } = await seedMismatchAttempt(persona.id);
    await approveHumanIdentityOverride(scope, persona.id, {
      assetId: asset.id,
      masterCompared: true,
      overrideConfirmed: true,
    });
    const attempts = await pkgRepo.listAttemptsForPersona(scope, persona.id);
    const assets = await personaRepo.listReferenceAssets(scope, persona.id);
    const coverage = resolveReferencePackageSlotCoverage({ attempts, assets });
    const row = coverage.slots.find((s) => s.slot === "right_profile");
    assert.equal(row?.countsTowardCoverage, true);
    assert.equal(row?.acceptedViaHumanIdentityOverride, true);
    assert.equal(row?.coverageLabel, "Accepted — Human Identity Override");
    assert.equal(row?.identityDecision, "identity_mismatch");
    assert.equal(row?.identitySourceConfidence, "human_mismatch_override");
    assert.equal(row?.activeAssetId, asset.id);
    assert.equal(
      isCurrentlyAcceptedUsable({
        attempt: attempts.find((a) => a.id === attempt.id)!,
        asset: assets.find((a) => a.id === asset.id)!,
      }),
      true,
    );
  });

  it("14–16. assetId unchanged; no provider; no new image", async () => {
    const { persona } = await setupPersona();
    const { asset } = await seedMismatchAttempt(persona.id);
    const beforeCount = (await personaRepo.listReferenceAssets(scope, persona.id))
      .length;
    const result = await approveHumanIdentityOverride(scope, persona.id, {
      assetId: asset.id,
      masterCompared: true,
      overrideConfirmed: true,
    });
    const after = await personaRepo.listReferenceAssets(scope, persona.id);
    assert.equal(after.length, beforeCount);
    assert.equal(result.assetId, asset.id);
    assert.equal(result.providerCalled, false);
    assert.equal(result.newImageGenerated, false);
  });

  it("17. identity threshold unchanged", () => {
    assert.equal(IDENTITY_CONSISTENCY_MATCH_EUCLIDEAN, 0.45);
    assert.equal(FACE_SIMILARITY_EUCLIDEAN_DUPLICATE_THRESHOLD, 0.45);
  });

  it("18. Identity Lock receives override provenance", async () => {
    const { persona } = await setupPersona();
    const { attempt, asset } = await seedMismatchAttempt(persona.id);
    await approveHumanIdentityOverride(scope, persona.id, {
      assetId: asset.id,
      masterCompared: true,
      overrideConfirmed: true,
    });
    const refreshed = (await pkgRepo.listAttemptsForPersona(scope, persona.id)).find(
      (a) => a.id === attempt.id,
    )!;
    assert.equal(
      resolveIdentitySourceConfidence({
        identityDecision: refreshed.identity_decision,
        humanIdentityReview: refreshed.human_identity_review,
        assetApproved: true,
      }),
      "human_mismatch_override",
    );
  });

  it("19. normal match behavior unchanged", () => {
    assert.equal(
      isMismatchOverrideUsable({
        identityDecision: "identity_match",
        humanIdentityReview: null,
        angleDirection: "correct",
        assetStatus: "approved",
      }),
      false,
    );
    const attempt = {
      identity_decision: "identity_match",
      human_identity_review: null,
      angle_direction: "correct",
      status: "accepted",
      detected_orientation: "profile_right",
    } as Pick<
      ReferencePackageAttempt,
      | "identity_decision"
      | "human_identity_review"
      | "angle_direction"
      | "status"
      | "detected_orientation"
    >;
    assert.equal(
      isCurrentlyAcceptedUsable({
        attempt: {
          id: "x",
          workspace_id: WS,
          persona_id: "p",
          session_id: "s",
          master_reference_id: "m",
          reference_slot: "right_profile",
          effective_slot: null,
          reassigned_from: null,
          reassigned_at: null,
          reassigned_by: null,
          angle_review_source: null,
          angle_review_decision: null,
          provider: "openai",
          provider_request_id: null,
          generated_asset_id: "g",
          identity_distance: 0.1,
          identity_similarity: 0.9,
          provider_direction_strategy: null,
          provider_requested_direction: null,
          profile_identity_mode: null,
          profile_prompt_version: null,
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
          cost_eur: null,
          error_message: null,
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-01-01T00:00:00.000Z",
          ...attempt,
        } as ReferencePackageAttempt,
        asset: { id: "g", status: "approved", notes: "" },
      }),
      true,
    );
  });

  it("20. warning approval behavior unchanged", () => {
    assert.equal(
      resolveIdentitySourceConfidence({
        identityDecision: "identity_warning",
        humanIdentityReview: null,
        assetApproved: true,
      }),
      "human_warning_approved",
    );
  });

  it("UI discloses override flow; no FLUX/novelty changes", () => {
    assert.equal(OPENAI_PROVIDER_CAPABILITY.stageBUsesFlux, false);
    const studio = readFileSync(
      join(ROOT, "components/persona/persona-studio.tsx"),
      "utf8",
    );
    assert.match(studio, /Mit Identitätsfreigabe bestätigen/);
    assert.match(studio, /Menschliche Identitätsfreigabe bestätigen/);
    assert.match(studio, /Mit Master vergleichen/);
    assert.match(studio, /identity-override-confirm/);
    assert.match(studio, /MENSCHLICHE IDENTITÄTSFREIGABE/);
  });

  it("explicit human rejection blocks override until reopened", () => {
    const blocked = canProposeHumanIdentityOverride({
      isMaster: false,
      isStageBGenerated: true,
      identityLocked: false,
      assetStatus: "rejected",
      identityDecision: "identity_mismatch",
      angleDirection: "correct",
      masterComparedInSession: true,
      humanIdentityReview: "rejected",
    });
    assert.equal(blocked.ok, false);
  });
});
