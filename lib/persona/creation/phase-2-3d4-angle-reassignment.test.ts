/**
 * Phase 2.3D.4 — Wrong-angle reassignment (no provider calls).
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
  getAttemptEffectiveSlot,
  getReferencePackageStatus,
  parseReferencePackageAssetNotes,
  prepareReferencePackageAngleRegeneration,
  reassignReferencePackageAngle,
  resolveReferencePackageSlotCoverage,
  setCreationRepositoryForTests,
  setPersonaRepositoryForTests,
  setReferencePackageRepositoryForTests,
  TARGET_SLOT_ACCEPTED_MESSAGE,
} from "@/lib/persona";
import { updateReferenceAsset } from "@/lib/persona/services/persona-service";
import { OPENAI_STAGE_B_IMAGE_EDIT_PATH } from "@/agents/image/providers/openai-images-edit-provider";
import { findMasterIdentityReference } from "@/lib/persona/creation/master-identity-reference";
import type { WorkspaceScope } from "@/lib/persona/domain/types";
import { PersonaDomainError } from "@/lib/persona/domain/errors";

const ROOT = process.cwd();
const WS = "ws-phase-23d4";
const scope: WorkspaceScope = { workspaceId: WS, actorId: "tester-23d4" };

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
  name: "OBF 2.3D.4",
  description: "angle reassignment",
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

describe("Phase 2.3D.4 wrong-angle reassignment", () => {
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
    return { persona };
  }

  function depsMatch(identity: "match" | "warning" | "mismatch" = "match") {
    const masterVec = emb(1);
    const genVec =
      identity === "match"
        ? emb(1)
        : identity === "warning"
          ? emb(1).map((v, i) => (i < 8 ? v + 0.08 : v))
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
        assert.ok(req.referenceImageBytes.length > 0);
        return {
          prompt: req.prompt,
          status: "completed" as const,
          providerId: "openai" as const,
          imageBytes: tinyPng(),
          providerRequestId: `req_23d4_${providerCallCount}`,
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
        extractCall += 1;
        // First extract = master, second = generated
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

  async function generateSlot(
    personaId: string,
    slot: "right_profile" | "left_profile" | "front" | "three_quarter_right",
    identity: "match" | "warning" | "mismatch" = "match",
  ) {
    const deps = depsMatch(identity);
    const prep = await prepareReferencePackageAngleRegeneration(
      scope,
      personaId,
      slot,
      deps,
    );
    const result = await confirmAndRegenerateReferencePackageAngle(
      scope,
      personaId,
      slot,
      {
        confirmationToken: prep.confirmationToken,
        costConfirmed: true,
        deps,
      },
    );
    const attempt = result.results[0]?.attempt;
    assert.ok(attempt?.generated_asset_id);
    return { attempt, assetId: attempt.generated_asset_id!, deps };
  }

  it("1–9. reassign preserves asset + requested slot; changes effective", async () => {
    const { persona } = await setupPersona();
    const beforeCalls = providerCallCount;
    const { attempt, assetId } = await generateSlot(persona.id, "right_profile");
    const assetBefore = await personaRepo.getReferenceAsset(scope, assetId);
    assert.ok(assetBefore);
    const storageBefore = assetBefore.storage_path;
    const providerReq = attempt.provider_request_id;

    const reassigned = await reassignReferencePackageAngle(
      scope,
      persona.id,
      { assetId, targetSlot: "left_profile" },
      { repo: pkgRepo },
    );

    assert.equal(reassigned.providerCalled, false);
    assert.equal(providerCallCount, beforeCalls + 1); // only the original generation
    assert.equal(reassigned.assetId, assetId);
    assert.equal(reassigned.storagePath, storageBefore);
    assert.equal(reassigned.providerRequestId, providerReq);
    assert.equal(reassigned.requestedSlot, "right_profile");
    assert.equal(reassigned.effectiveSlot, "left_profile");
    assert.equal(reassigned.reassignedFrom, "right_profile");
    assert.equal(reassigned.autoApproved, false);
    assert.equal(reassigned.attempt.reference_slot, "right_profile");
    assert.equal(reassigned.attempt.effective_slot, "left_profile");
    assert.equal(reassigned.attempt.reassigned_from, "right_profile");
    assert.equal(reassigned.attempt.angle_review_source, "user");
    assert.equal(reassigned.attempt.angle_review_decision, "confirmed");
    assert.ok(reassigned.attempt.reassigned_at);
    assert.equal(reassigned.attempt.reassigned_by, "tester-23d4");

    const assetAfter = await personaRepo.getReferenceAsset(scope, assetId);
    assert.ok(assetAfter);
    assert.equal(assetAfter.id, assetId);
    assert.equal(assetAfter.storage_path, storageBefore);
    assert.equal(assetAfter.status, "review");
    assert.equal(assetAfter.view_angle, "left_profile");
    const notes = parseReferencePackageAssetNotes(assetAfter.notes);
    assert.ok(notes);
    assert.equal(notes.requested_slot, "right_profile");
    assert.equal(notes.effective_slot, "left_profile");
    assert.equal(notes.reassigned_from, "right_profile");
  });

  it("2. Master cannot be reassigned", async () => {
    const { persona } = await setupPersona();
    const refs = await personaRepo.listReferenceAssets(scope, persona.id);
    const master = findMasterIdentityReference(refs);
    assert.ok(master);
    await assert.rejects(
      () =>
        reassignReferencePackageAngle(
          scope,
          persona.id,
          { assetId: master.id, targetSlot: "left_profile" },
          { repo: pkgRepo },
        ),
      /Master Identity Reference cannot be reassigned/,
    );
  });

  it("10–11. accepted target blocks; rejected/mismatch target allows", async () => {
    const { persona } = await setupPersona();
    const tqr = await generateSlot(persona.id, "three_quarter_right");
    await updateReferenceAsset(scope, tqr.assetId, {
      status: "approved",
      rights_confirmed: true,
    });

    const right = await generateSlot(persona.id, "right_profile");
    await assert.rejects(
      () =>
        reassignReferencePackageAngle(
          scope,
          persona.id,
          { assetId: right.assetId, targetSlot: "three_quarter_right" },
          { repo: pkgRepo },
        ),
      (err: unknown) => {
        assert.ok(err instanceof PersonaDomainError);
        assert.equal(err.message, TARGET_SLOT_ACCEPTED_MESSAGE);
        return true;
      },
    );

    // Seed a rejected left_profile attempt, then reassign into that slot.
    const leftBad = await generateSlot(persona.id, "left_profile");
    await updateReferenceAsset(scope, leftBad.assetId, { status: "rejected" });

    const ok = await reassignReferencePackageAngle(
      scope,
      persona.id,
      { assetId: right.assetId, targetSlot: "left_profile" },
      { repo: pkgRepo },
    );
    assert.equal(ok.effectiveSlot, "left_profile");
    assert.equal(ok.autoApproved, false);

    const status = await getReferencePackageStatus(scope, persona.id, {
      repo: pkgRepo,
    });
    const left = status.slots.find((s) => s.slot === "left_profile");
    assert.equal(left?.latestAttempt?.generated_asset_id, right.assetId);
    // Prefer reassigned asset as active for the target slot
    assert.ok(
      left?.latestAttempt?.id === right.attempt.id ||
        left?.latestAttempt?.generated_asset_id === right.assetId,
    );

    const history = (await pkgRepo.listAttemptsForPersona(scope, persona.id)).filter(
      (a) =>
        a.reference_slot === "left_profile" || a.effective_slot === "left_profile",
    );
    assert.ok(history.length >= 2);
  });

  it("12–15. no auto-approve; identity unchanged; mismatch not usable", async () => {
    const { persona } = await setupPersona();
    const match = await generateSlot(persona.id, "right_profile", "match");
    const beforeIdentity = match.attempt.identity_decision;
    const result = await reassignReferencePackageAngle(
      scope,
      persona.id,
      { assetId: match.assetId, targetSlot: "left_profile" },
      { repo: pkgRepo },
    );
    assert.equal(result.identityDecision, beforeIdentity);
    assert.equal(result.attempt.identity_decision, beforeIdentity);
    assert.notEqual(result.attempt.status, "accepted");
    const asset = await personaRepo.getReferenceAsset(scope, match.assetId);
    assert.equal(asset?.status, "review");

    const mismatch = await generateSlot(persona.id, "front", "mismatch");
    const mid = mismatch.attempt.identity_decision;
    const reM = await reassignReferencePackageAngle(
      scope,
      persona.id,
      { assetId: mismatch.assetId, targetSlot: "three_quarter_left" },
      { repo: pkgRepo },
    );
    assert.equal(reM.identityDecision, mid);
    await assert.rejects(
      () =>
        updateReferenceAsset(scope, mismatch.assetId, {
          status: "approved",
          rights_confirmed: true,
        }),
      /Identity mismatch references cannot become Accepted/,
    );
  });

  it("15b. identity_warning requires explicit approval after reassign", async () => {
    const { persona } = await setupPersona();
    // Force warning by patching after a match generate (embedding distance is hard to tune).
    const gen = await generateSlot(persona.id, "right_profile", "match");
    await pkgRepo.updateAttempt(scope, gen.attempt.id, {
      identity_decision: "identity_warning",
      status: "review",
    });
    const asset = await personaRepo.getReferenceAsset(scope, gen.assetId);
    assert.ok(asset);
    const notes = parseReferencePackageAssetNotes(asset.notes);
    assert.ok(notes);
    await personaRepo.updateReferenceAsset(scope, gen.assetId, {
      notes: asset.notes.replace("identity_match", "identity_warning"),
      status: "review",
    });

    const re = await reassignReferencePackageAngle(
      scope,
      persona.id,
      { assetId: gen.assetId, targetSlot: "left_profile" },
      { repo: pkgRepo },
    );
    assert.equal(re.identityDecision, "identity_warning");
    assert.equal(re.autoApproved, false);
    const after = await personaRepo.getReferenceAsset(scope, gen.assetId);
    assert.equal(after?.status, "review");

    // Explicit approval allowed for warning
    await updateReferenceAsset(scope, gen.assetId, {
      status: "approved",
      rights_confirmed: true,
    });
    const approved = await personaRepo.getReferenceAsset(scope, gen.assetId);
    assert.equal(approved?.status, "approved");
  });

  it("16–18. coverage uses effective slot; source free; history preserved", async () => {
    const { persona } = await setupPersona();
    const { assetId, attempt } = await generateSlot(persona.id, "right_profile");
    await reassignReferencePackageAngle(
      scope,
      persona.id,
      { assetId, targetSlot: "left_profile" },
      { repo: pkgRepo },
    );

    let status = await getReferencePackageStatus(scope, persona.id, {
      repo: pkgRepo,
    });
    const leftRow = status.slots.find((s) => s.slot === "left_profile");
    const rightRow = status.slots.find((s) => s.slot === "right_profile");
    assert.equal(leftRow?.status, "review");
    assert.equal(status.acceptedCount, 0);
    assert.ok(rightRow?.status !== "accepted");

    // Approve → left counts; right available for regen
    await updateReferenceAsset(scope, assetId, {
      status: "approved",
      rights_confirmed: true,
    });
    status = await getReferencePackageStatus(scope, persona.id, { repo: pkgRepo });
    const leftAfter = status.slots.find((s) => s.slot === "left_profile");
    const rightAfter = status.slots.find((s) => s.slot === "right_profile");
    assert.equal(leftAfter?.status, "accepted");
    assert.equal(status.acceptedCount, 1);
    assert.ok(rightAfter?.status !== "accepted");
    assert.ok(
      (rightAfter?.attemptHistory ?? []).some((a) => a.id === attempt.id),
    );
    assert.ok(
      (leftAfter?.attemptHistory ?? []).some((a) => a.id === attempt.id),
    );
    assert.equal(getAttemptEffectiveSlot(attempt), "right_profile"); // pre-reassign snapshot
    const live = (await pkgRepo.listAttemptsForPersona(scope, persona.id)).find(
      (a) => a.id === attempt.id,
    );
    assert.equal(live?.effective_slot, "left_profile");
    assert.equal(live?.reference_slot, "right_profile");

    // Source slot regenerable
    const prep = await prepareReferencePackageAngleRegeneration(
      scope,
      persona.id,
      "right_profile",
      depsMatch(),
    );
    assert.equal(prep.slots.length, 1);
    assert.equal(prep.slots[0], "right_profile");
    assert.equal(prep.providerCalled, false);
  });

  it("19–20. Master immutable; discovery/FLUX/novelty unchanged; UI strings", async () => {
    const { persona } = await setupPersona();
    const refsBefore = await personaRepo.listReferenceAssets(scope, persona.id);
    const master = findMasterIdentityReference(refsBefore)!;
    const { assetId } = await generateSlot(persona.id, "right_profile");
    await reassignReferencePackageAngle(
      scope,
      persona.id,
      { assetId, targetSlot: "left_profile" },
      { repo: pkgRepo },
    );
    const refsAfter = await personaRepo.listReferenceAssets(scope, persona.id);
    const masterAfter = findMasterIdentityReference(refsAfter)!;
    assert.equal(masterAfter.id, master.id);
    assert.equal(masterAfter.storage_path, master.storage_path);
    assert.equal(masterAfter.is_primary, true);

    assert.equal(OPENAI_PROVIDER_CAPABILITY.stageBUsesFlux, false);
    assert.equal(OPENAI_PROVIDER_CAPABILITY.stageBIdentityConsistentExpansion, false);
    assert.equal(FACE_SIMILARITY_EUCLIDEAN_DUPLICATE_THRESHOLD, 0.45);

    const studio = readFileSync(
      join(ROOT, "components/persona/persona-studio.tsx"),
      "utf8",
    );
    assert.match(studio, /Reassign angle/);
    assert.match(studio, /REASSIGNED/);
    assert.match(studio, /Requested angle/);
    assert.match(studio, /Effective angle/);
    assert.match(studio, /Reassigned →/);
    assert.doesNotMatch(studio, /from \"@\/lib\/persona\/creation\/reference-package\"/);
  });

  it("coverage helper: effective slot drives acceptance", () => {
    const coverage = resolveReferencePackageSlotCoverage({
      attempts: [
        {
          id: "a",
          workspace_id: WS,
          persona_id: "p",
          session_id: "s",
          master_reference_id: "m",
          reference_slot: "right_profile",
          effective_slot: "left_profile",
          reassigned_from: "right_profile",
          reassigned_at: "2026-01-02T00:00:00.000Z",
          reassigned_by: "user",
          angle_review_source: "user",
          angle_review_decision: "confirmed",
          provider: "openai",
          provider_request_id: "req",
          generated_asset_id: "g",
          status: "review",
          identity_decision: "identity_match",
          identity_distance: 0.1,
          identity_similarity: 0.9,
          angle_direction: "uncertain",
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
          cost_eur: 0.04,
          error_message: null,
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-01-02T00:00:00.000Z",
        },
      ],
      assets: [
        {
          id: "g",
          workspace_id: WS,
          persona_id: "p",
          asset_type: "profile",
          storage_path: "x",
          mime_type: "image/png",
          width: 1,
          height: 1,
          file_size_bytes: 1,
          checksum: "c",
          is_primary: false,
          view_angle: "left_profile",
          framing: "head_shoulders",
          expression: "neutral",
          body_visibility: "partial",
          notes: "",
          source_type: "generated_external",
          rights_confirmed: true,
          created_by: null,
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-01-02T00:00:00.000Z",
          status: "approved",
        },
      ],
    });
    const left = coverage.slots.find((s) => s.slot === "left_profile");
    const right = coverage.slots.find((s) => s.slot === "right_profile");
    assert.equal(left?.countsTowardCoverage, true);
    assert.equal(right?.countsTowardCoverage, false);
  });
});
