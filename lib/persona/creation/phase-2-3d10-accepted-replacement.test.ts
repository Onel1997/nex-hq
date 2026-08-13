/**
 * Phase 2.3D.10 — Regenerate accepted angle with safe replacement.
 * No live paid provider calls (injected editFromMaster only).
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
  REFERENCE_PACKAGE_SLOTS,
  canProposeAcceptedReplacement,
  prepareAcceptedAngleReplacement,
  confirmAcceptedAngleReplacement,
  approveAndReplaceAcceptedReference,
  rejectAcceptedReplacement,
  resolveReferencePackageSlotCoverage,
  resolveIncumbentAcceptedForSlot,
  resolvePendingReplacementForSlot,
  parseReferencePackageAssetNotes,
  setCreationRepositoryForTests,
  setPersonaRepositoryForTests,
  setReferencePackageRepositoryForTests,
} from "@/lib/persona";
import {
  findMasterIdentityReference,
  isMasterIdentityReference,
} from "@/lib/persona/creation/master-identity-reference";
import { PersonaDomainError } from "@/lib/persona/domain/errors";
import type { PersonaReferenceAsset, WorkspaceScope } from "@/lib/persona/domain/types";
import {
  buildReferencePackageAssetNotes,
  type ReferencePackageAttempt,
} from "@/lib/persona/creation/reference-package/types";
import { orientationFixtureForSlot } from "@/lib/persona/creation/reference-package/test-orientation-fixtures";
import {
  OPENAI_STAGE_B_IMAGE_EDIT_PATH,
} from "@/agents/image/providers/openai-images-edit-provider";
import type { ReferencePackageSlot } from "@/lib/persona/creation/reference-package/slots";
import { slotToReferenceMeta } from "@/lib/persona/creation/reference-package/slots";
import type { IdentityConsistencyDecision } from "@/lib/persona/creation/reference-package/identity-consistency";

const ROOT = process.cwd();
const WS = "ws-phase-23d10-replacement";
const scope: WorkspaceScope = { workspaceId: WS, actorId: "tester-23d10" };

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
  name: "OBF 2.3D.10 replacement",
  description: "accepted angle safe replacement",
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

describe("Phase 2.3D.10 accepted angle safe replacement", () => {
  let creationRepo: MemoryCreationRepository;
  let personaRepo: MemoryPersonaRepository;
  let pkgRepo: MemoryReferencePackageRepository;
  let openaiCalls: number;
  let fluxCalls: number;
  let identityMode: "match" | "mismatch" | "warning";
  let orientationMode: "correct" | "incorrect";

  beforeEach(() => {
    creationRepo = new MemoryCreationRepository();
    personaRepo = new MemoryPersonaRepository();
    pkgRepo = new MemoryReferencePackageRepository();
    setCreationRepositoryForTests(creationRepo);
    setPersonaRepositoryForTests(personaRepo);
    setReferencePackageRepositoryForTests(pkgRepo);
    openaiCalls = 0;
    fluxCalls = 0;
    identityMode = "match";
    orientationMode = "correct";
  });

  afterEach(() => {
    setCreationRepositoryForTests(null);
    setPersonaRepositoryForTests(null);
    setReferencePackageRepositoryForTests(null);
  });

  function requireReplacementAssetId(confirmed: {
    replacementAssetId: string | null;
  }): string {
    assert.ok(confirmed.replacementAssetId);
    return confirmed.replacementAssetId;
  }

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
    const refs = await personaRepo.listReferenceAssets(scope, persona.id);
    const master = findMasterIdentityReference(refs);
    assert.ok(master);
    return { persona, master };
  }

  async function seedAcceptedSlot(
    personaId: string,
    masterId: string,
    slot: ReferencePackageSlot,
    opts: {
      identity?: IdentityConsistencyDecision;
      angle?: "correct" | "incorrect";
    } = {},
  ) {
    const identity = opts.identity ?? "identity_match";
    const angle = opts.angle ?? "correct";
    const session = await pkgRepo.createSession(scope, {
      persona_id: personaId,
      master_reference_id: masterId,
      confirmation_token: `tok-${slot}-${Math.random()}`,
      estimate_hash: "h",
      estimated_cost_min: 0.04,
      estimated_cost_max: 0.04,
      max_authorized_spend: 0.04,
      image_count: 1,
    });
    const attempt = await pkgRepo.createAttempt(scope, {
      session_id: session.id,
      persona_id: personaId,
      master_reference_id: masterId,
      reference_slot: slot,
      status: "accepted",
    });
    const notes = buildReferencePackageAssetNotes({
      slot,
      attemptId: attempt.id,
      masterReferenceId: masterId,
      identityDecision: identity,
      angleDirection: angle,
      detectedOrientation:
        slot === "front"
          ? "frontal"
          : slot.includes("left")
            ? "image_left"
            : slot.includes("right")
              ? "image_right"
              : "profile_left",
    });
    const metaForAsset = slotToReferenceMeta(slot);
    const asset = await personaRepo.createReferenceAsset(scope, {
      persona_id: personaId,
      asset_type: metaForAsset.asset_type,
      storage_path: `workspace/${WS}/accepted-${slot}.png`,
      mime_type: "image/png",
      width: 1,
      height: 1,
      file_size_bytes: 10,
      checksum: `${slot}-accepted`,
      view_angle: metaForAsset.view_angle,
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
      identity_decision: identity,
      angle_direction: angle,
    });
    return { asset, attempt };
  }

  async function seedFullCoverage(personaId: string, masterId: string) {
    const seeded: Partial<
      Record<
        ReferencePackageSlot,
        { asset: PersonaReferenceAsset; attempt: ReferencePackageAttempt }
      >
    > = {};
    for (const slot of REFERENCE_PACKAGE_SLOTS) {
      seeded[slot] = await seedAcceptedSlot(personaId, masterId, slot);
    }
    return seeded as Record<
      ReferencePackageSlot,
      { asset: PersonaReferenceAsset; attempt: ReferencePackageAttempt }
    >;
  }

  function deps() {
    const masterVec = emb(1);
    const genVec =
      identityMode === "match"
        ? emb(1)
        : identityMode === "warning"
          ? emb(1).map((v, i) => (i < 25 ? v + 0.1 : v))
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
        openaiCalls += 1;
        assert.ok(req.referenceImageBytes.length > 0);
        return {
          prompt: req.prompt,
          status: "completed" as const,
          providerId: "openai" as const,
          imageBytes: tinyPng(),
          providerRequestId: `req_23d10_${openaiCalls}`,
          path: OPENAI_STAGE_B_IMAGE_EDIT_PATH,
          inputFidelity: "high" as const,
        };
      },
      fluxGenerate: async () => {
        fluxCalls += 1;
        throw new Error("FLUX must not be called");
      },
      extractOrientation: async (_bytes: Buffer, ctx?: { slot: string }) => {
        const slot = (ctx?.slot ?? "front") as ReferencePackageSlot;
        if (orientationMode === "incorrect") {
          if (slot === "front") {
            return orientationFixtureForSlot("three_quarter_right");
          }
          const opposite =
            slot === "three_quarter_left"
              ? "three_quarter_right"
              : slot === "three_quarter_right"
                ? "three_quarter_left"
                : slot;
          return orientationFixtureForSlot(opposite as ReferencePackageSlot);
        }
        return orientationFixtureForSlot(slot);
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

  it("1. accepted Front can start replacement flow", async () => {
    const { persona, master } = await setupPersona();
    const { asset: front } = await seedAcceptedSlot(
      persona.id,
      master.id,
      "front",
    );
    const prepared = await prepareAcceptedAngleReplacement(
      scope,
      persona.id,
      { assetId: front.id },
      deps(),
    );
    assert.equal(prepared.providerCalled, false);
    assert.equal(prepared.slot, "front");
    assert.equal(prepared.incumbentAssetId, front.id);
    assert.ok(prepared.confirmationToken);
  });

  it("2. current accepted Front remains active during generation", async () => {
    const { persona, master } = await setupPersona();
    await seedFullCoverage(persona.id, master.id);
    const front = (await personaRepo.listReferenceAssets(scope, persona.id)).find(
      (a) => parseReferencePackageAssetNotes(a.notes)?.slot === "front",
    )!;
    const before = structuredClone(front);
    const prepared = await prepareAcceptedAngleReplacement(
      scope,
      persona.id,
      { assetId: front.id },
      deps(),
    );
    const confirmed = await confirmAcceptedAngleReplacement(
      scope,
      persona.id,
      {
        assetId: front.id,
        confirmationToken: prepared.confirmationToken,
        costConfirmed: true,
      },
      deps(),
    );
    const after = await personaRepo.getReferenceAsset(scope, front.id);
    assert.equal(after?.status, before.status);
    assert.equal(after?.storage_path, before.storage_path);
    assert.equal(confirmed.incumbentAssetId, front.id);
    assert.notEqual(confirmed.replacementAssetId, front.id);
  });

  it("3. coverage stays 5/5 during review", async () => {
    const { persona, master } = await setupPersona();
    await seedFullCoverage(persona.id, master.id);
    const front = resolveIncumbentAcceptedForSlot(
      "front",
      await pkgRepo.listAttemptsForPersona(scope, persona.id),
      await personaRepo.listReferenceAssets(scope, persona.id),
    ).asset!;
    const prepared = await prepareAcceptedAngleReplacement(
      scope,
      persona.id,
      { assetId: front.id },
      deps(),
    );
    await confirmAcceptedAngleReplacement(
      scope,
      persona.id,
      {
        assetId: front.id,
        confirmationToken: prepared.confirmationToken,
        costConfirmed: true,
      },
      deps(),
    );
    const coverage = resolveReferencePackageSlotCoverage({
      attempts: await pkgRepo.listAttemptsForPersona(scope, persona.id),
      assets: await personaRepo.listReferenceAssets(scope, persona.id),
    });
    assert.equal(coverage.acceptedCount, 5);
    assert.equal(coverage.referencePackageReady, true);
    const frontRow = coverage.slots.find((s) => s.slot === "front");
    assert.equal(frontRow?.countsTowardCoverage, true);
    assert.equal(frontRow?.incumbentAcceptedAssetId, front.id);
    assert.ok(frontRow?.pendingReplacementAssetId);
  });

  it("4. prepare makes zero provider calls", async () => {
    const { persona, master } = await setupPersona();
    const { asset: front } = await seedAcceptedSlot(
      persona.id,
      master.id,
      "front",
    );
    const d = deps();
    const prepared = await prepareAcceptedAngleReplacement(
      scope,
      persona.id,
      { assetId: front.id },
      d,
    );
    assert.equal(prepared.providerCalled, false);
    assert.equal(openaiCalls, 0);
    assert.equal(fluxCalls, 0);
  });

  it("5. confirm generates exactly one image", async () => {
    const { persona, master } = await setupPersona();
    const { asset: front } = await seedAcceptedSlot(
      persona.id,
      master.id,
      "front",
    );
    const prepared = await prepareAcceptedAngleReplacement(
      scope,
      persona.id,
      { assetId: front.id },
      deps(),
    );
    openaiCalls = 0;
    await confirmAcceptedAngleReplacement(
      scope,
      persona.id,
      {
        assetId: front.id,
        confirmationToken: prepared.confirmationToken,
        costConfirmed: true,
      },
      deps(),
    );
    assert.equal(openaiCalls, 1);
  });

  it("6. new image gets replacement_for_asset_id", async () => {
    const { persona, master } = await setupPersona();
    const { asset: front } = await seedAcceptedSlot(
      persona.id,
      master.id,
      "front",
    );
    const prepared = await prepareAcceptedAngleReplacement(
      scope,
      persona.id,
      { assetId: front.id },
      deps(),
    );
    const confirmed = await confirmAcceptedAngleReplacement(
      scope,
      persona.id,
      {
        assetId: front.id,
        confirmationToken: prepared.confirmationToken,
        costConfirmed: true,
      },
      deps(),
    );
    const attempts = await pkgRepo.listAttemptsForPersona(scope, persona.id);
    const replacementAttempt = attempts.find(
      (a) => a.id === confirmed.replacementAttemptId,
    );
    assert.equal(replacementAttempt?.replacement_for_asset_id, front.id);
    assert.equal(replacementAttempt?.replacement_for_slot, "front");
    assert.equal(replacementAttempt?.replacement_candidate, true);
    const replacementId = requireReplacementAssetId(confirmed);
    const replacementAsset = await personaRepo.getReferenceAsset(
      scope,
      replacementId,
    );
    const meta = parseReferencePackageAssetNotes(replacementAsset?.notes);
    assert.equal(meta?.replacement_candidate, true);
    assert.equal(meta?.replacement_for_asset_id, front.id);
  });

  it("7. old asset unchanged before approval", async () => {
    const { persona, master } = await setupPersona();
    const { asset: front } = await seedAcceptedSlot(
      persona.id,
      master.id,
      "front",
    );
    const snapshot = structuredClone(front);
    const prepared = await prepareAcceptedAngleReplacement(
      scope,
      persona.id,
      { assetId: front.id },
      deps(),
    );
    await confirmAcceptedAngleReplacement(
      scope,
      persona.id,
      {
        assetId: front.id,
        confirmationToken: prepared.confirmationToken,
        costConfirmed: true,
      },
      deps(),
    );
    const after = await personaRepo.getReferenceAsset(scope, front.id);
    assert.equal(after?.status, snapshot.status);
    assert.equal(after?.notes, snapshot.notes);
    assert.equal(after?.storage_path, snapshot.storage_path);
  });

  it("8. reject replacement keeps old Front", async () => {
    const { persona, master } = await setupPersona();
    await seedFullCoverage(persona.id, master.id);
    const front = resolveIncumbentAcceptedForSlot(
      "front",
      await pkgRepo.listAttemptsForPersona(scope, persona.id),
      await personaRepo.listReferenceAssets(scope, persona.id),
    ).asset!;
    const prepared = await prepareAcceptedAngleReplacement(
      scope,
      persona.id,
      { assetId: front.id },
      deps(),
    );
    const confirmed = await confirmAcceptedAngleReplacement(
      scope,
      persona.id,
      {
        assetId: front.id,
        confirmationToken: prepared.confirmationToken,
        costConfirmed: true,
      },
      deps(),
    );
    const rejected = await rejectAcceptedReplacement(scope, persona.id, {
      assetId: requireReplacementAssetId(confirmed),
    });
    assert.equal(rejected.providerCalled, false);
    assert.equal(rejected.incumbentAssetId, front.id);
    assert.equal(rejected.incumbentStatus, "approved");
    const incumbent = await personaRepo.getReferenceAsset(scope, front.id);
    assert.equal(incumbent?.status, "approved");
    const replacement = await personaRepo.getReferenceAsset(
      scope,
      requireReplacementAssetId(confirmed),
    );
    assert.equal(replacement?.status, "rejected");
    const coverage = resolveReferencePackageSlotCoverage({
      attempts: await pkgRepo.listAttemptsForPersona(scope, persona.id),
      assets: await personaRepo.listReferenceAssets(scope, persona.id),
    });
    assert.equal(coverage.acceptedCount, 5);
  });

  it("9. approve replacement atomically swaps active Front", async () => {
    const { persona, master } = await setupPersona();
    await seedFullCoverage(persona.id, master.id);
    const front = resolveIncumbentAcceptedForSlot(
      "front",
      await pkgRepo.listAttemptsForPersona(scope, persona.id),
      await personaRepo.listReferenceAssets(scope, persona.id),
    ).asset!;
    const prepared = await prepareAcceptedAngleReplacement(
      scope,
      persona.id,
      { assetId: front.id },
      deps(),
    );
    const confirmed = await confirmAcceptedAngleReplacement(
      scope,
      persona.id,
      {
        assetId: front.id,
        confirmationToken: prepared.confirmationToken,
        costConfirmed: true,
      },
      deps(),
    );
    const swapped = await approveAndReplaceAcceptedReference(scope, persona.id, {
      assetId: requireReplacementAssetId(confirmed),
      replaceConfirmed: true,
    });
    assert.equal(swapped.incumbentAssetId, front.id);
    assert.equal(swapped.replacementAssetId, confirmed.replacementAssetId);
    assert.equal(swapped.incumbentStatus, "superseded");
    assert.equal(swapped.replacementStatus, "approved");
    const active = resolveIncumbentAcceptedForSlot(
      "front",
      await pkgRepo.listAttemptsForPersona(scope, persona.id),
      await personaRepo.listReferenceAssets(scope, persona.id),
    );
    assert.equal(active.asset?.id, confirmed.replacementAssetId);
  });

  it("10. old Front becomes superseded, not deleted", async () => {
    const { persona, master } = await setupPersona();
    const { asset: front } = await seedAcceptedSlot(
      persona.id,
      master.id,
      "front",
    );
    const prepared = await prepareAcceptedAngleReplacement(
      scope,
      persona.id,
      { assetId: front.id },
      deps(),
    );
    const confirmed = await confirmAcceptedAngleReplacement(
      scope,
      persona.id,
      {
        assetId: front.id,
        confirmationToken: prepared.confirmationToken,
        costConfirmed: true,
      },
      deps(),
    );
    await approveAndReplaceAcceptedReference(scope, persona.id, {
      assetId: requireReplacementAssetId(confirmed),
      replaceConfirmed: true,
    });
    const oldFront = await personaRepo.getReferenceAsset(scope, front.id);
    assert.ok(oldFront);
    assert.equal(oldFront?.status, "superseded");
    assert.equal(
      oldFront?.superseded_by_asset_id,
      requireReplacementAssetId(confirmed),
    );
  });

  it("11. only one active accepted Front exists", async () => {
    const { persona, master } = await setupPersona();
    await seedFullCoverage(persona.id, master.id);
    const front = resolveIncumbentAcceptedForSlot(
      "front",
      await pkgRepo.listAttemptsForPersona(scope, persona.id),
      await personaRepo.listReferenceAssets(scope, persona.id),
    ).asset!;
    const prepared = await prepareAcceptedAngleReplacement(
      scope,
      persona.id,
      { assetId: front.id },
      deps(),
    );
    const confirmed = await confirmAcceptedAngleReplacement(
      scope,
      persona.id,
      {
        assetId: front.id,
        confirmationToken: prepared.confirmationToken,
        costConfirmed: true,
      },
      deps(),
    );
    await approveAndReplaceAcceptedReference(scope, persona.id, {
      assetId: requireReplacementAssetId(confirmed),
      replaceConfirmed: true,
    });
    const assets = await personaRepo.listReferenceAssets(scope, persona.id);
    const approvedFronts = assets.filter((a) => {
      const meta = parseReferencePackageAssetNotes(a.notes);
      return (
        a.status === "approved" &&
        (meta?.slot === "front" || meta?.effective_slot === "front")
      );
    });
    assert.equal(approvedFronts.length, 1);
    assert.equal(approvedFronts[0]?.id, requireReplacementAssetId(confirmed));
  });

  it("12. invalid angle cannot replace", async () => {
    const { persona, master } = await setupPersona();
    const { asset: front } = await seedAcceptedSlot(
      persona.id,
      master.id,
      "front",
    );
    orientationMode = "incorrect";
    const prepared = await prepareAcceptedAngleReplacement(
      scope,
      persona.id,
      { assetId: front.id },
      deps(),
    );
    const confirmed = await confirmAcceptedAngleReplacement(
      scope,
      persona.id,
      {
        assetId: front.id,
        confirmationToken: prepared.confirmationToken,
        costConfirmed: true,
      },
      deps(),
    );
    await assert.rejects(
      () =>
        approveAndReplaceAcceptedReference(scope, persona.id, {
          assetId: requireReplacementAssetId(confirmed),
          replaceConfirmed: true,
        }),
      (err: unknown) => {
        assert.ok(err instanceof PersonaDomainError);
        assert.match(
          String(err.message),
          /camera direction|not usable|replacement candidates/i,
        );
        return true;
      },
    );
    const incumbent = await personaRepo.getReferenceAsset(scope, front.id);
    assert.equal(incumbent?.status, "approved");
  });

  it("13. identity mismatch cannot replace unless override allows", async () => {
    const { persona, master } = await setupPersona();
    const { asset: front } = await seedAcceptedSlot(
      persona.id,
      master.id,
      "front",
    );
    identityMode = "mismatch";
    const prepared = await prepareAcceptedAngleReplacement(
      scope,
      persona.id,
      { assetId: front.id },
      deps(),
    );
    const confirmed = await confirmAcceptedAngleReplacement(
      scope,
      persona.id,
      {
        assetId: front.id,
        confirmationToken: prepared.confirmationToken,
        costConfirmed: true,
      },
      deps(),
    );
    await assert.rejects(
      () =>
        approveAndReplaceAcceptedReference(scope, persona.id, {
          assetId: requireReplacementAssetId(confirmed),
          replaceConfirmed: true,
        }),
      (err: unknown) => {
        assert.ok(err instanceof PersonaDomainError);
        assert.match(
          String(err.message),
          /identity mismatch|not usable|replacement candidates/i,
        );
        return true;
      },
    );

    // Override path: manually mark replacement attempt as human-approved override.
    const attempts = await pkgRepo.listAttemptsForPersona(scope, persona.id);
    const replacementAttempt = attempts.find(
      (a) => a.generated_asset_id === requireReplacementAssetId(confirmed),
    )!;
    await pkgRepo.updateAttempt(scope, replacementAttempt.id, {
      identity_decision: "identity_mismatch",
      human_identity_review: "approved_override",
      angle_direction: "correct",
      status: "review",
      replacement_candidate: true,
    });
    await personaRepo.updateReferenceAsset(scope, requireReplacementAssetId(confirmed), {
      status: "review",
    });
    const overrideSwap = await approveAndReplaceAcceptedReference(
      scope,
      persona.id,
      {
        assetId: requireReplacementAssetId(confirmed),
        replaceConfirmed: true,
      },
    );
    assert.equal(overrideSwap.replacementStatus, "approved");
  });

  it("14. Master cannot be regenerated via this action", async () => {
    const { persona, master } = await setupPersona();
    assert.ok(isMasterIdentityReference(master));
    await assert.rejects(
      () =>
        prepareAcceptedAngleReplacement(scope, persona.id, {
          assetId: master.id,
        }),
      (err: unknown) => {
        assert.ok(err instanceof PersonaDomainError);
        assert.match(String(err.message), /Master Identity Reference/i);
        return true;
      },
    );
    const gate = canProposeAcceptedReplacement({
      isMaster: true,
      isStageBGenerated: false,
      identityLocked: false,
      assetStatus: "approved",
      slot: "front",
      countsTowardCoverage: false,
      hasPendingReplacement: false,
    });
    assert.equal(gate.ok, false);
  });

  it("15. other accepted angles untouched", async () => {
    const { persona, master } = await setupPersona();
    const seeded = await seedFullCoverage(persona.id, master.id);
    const tqlBefore = structuredClone(seeded.three_quarter_left.asset);
    const front = seeded.front.asset;
    const prepared = await prepareAcceptedAngleReplacement(
      scope,
      persona.id,
      { assetId: front.id },
      deps(),
    );
    const confirmed = await confirmAcceptedAngleReplacement(
      scope,
      persona.id,
      {
        assetId: front.id,
        confirmationToken: prepared.confirmationToken,
        costConfirmed: true,
      },
      deps(),
    );
    await approveAndReplaceAcceptedReference(scope, persona.id, {
      assetId: requireReplacementAssetId(confirmed),
      replaceConfirmed: true,
    });
    const tqlAfter = await personaRepo.getReferenceAsset(
      scope,
      tqlBefore.id,
    );
    assert.equal(tqlAfter?.status, tqlBefore.status);
    assert.equal(tqlAfter?.storage_path, tqlBefore.storage_path);
    const coverage = resolveReferencePackageSlotCoverage({
      attempts: await pkgRepo.listAttemptsForPersona(scope, persona.id),
      assets: await personaRepo.listReferenceAssets(scope, persona.id),
    });
    assert.equal(coverage.acceptedCount, 5);
  });

  it("16. no discovery/FLUX/novelty changes", async () => {
    const serviceSource = readFileSync(
      join(ROOT, "lib/persona/creation/reference-package/accepted-replacement.ts"),
      "utf8",
    );
    assert.doesNotMatch(serviceSource, /flux|discovery|novelty/i);
    const { persona, master } = await setupPersona();
    const { asset: front } = await seedAcceptedSlot(
      persona.id,
      master.id,
      "front",
    );
    const prepared = await prepareAcceptedAngleReplacement(
      scope,
      persona.id,
      { assetId: front.id },
      deps(),
    );
    await confirmAcceptedAngleReplacement(
      scope,
      persona.id,
      {
        assetId: front.id,
        confirmationToken: prepared.confirmationToken,
        costConfirmed: true,
      },
      deps(),
    );
    assert.equal(fluxCalls, 0);
    const pending = resolvePendingReplacementForSlot(
      "front",
      await pkgRepo.listAttemptsForPersona(scope, persona.id),
      await personaRepo.listReferenceAssets(scope, persona.id),
    );
    assert.ok(pending);
  });
});
