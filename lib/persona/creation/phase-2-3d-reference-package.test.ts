/**
 * Phase 2.3D — Controlled Reference Package generation.
 * No live paid provider calls in these tests (injected editFromMaster).
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
} from "@/lib/persona/face-novelty-memory/similarity-threshold";
import { OPENAI_PROVIDER_CAPABILITY } from "@/lib/persona/creation/quality-modes";
import {
  STAGE_B_REFERENCE_PACKAGE_CAPABILITY,
  REFERENCE_PACKAGE_SLOTS,
  MemoryReferencePackageRepository,
  setReferencePackageRepositoryForTests,
  estimateReferencePackageCost,
  prepareReferencePackageConfirmation,
  confirmAndGenerateReferencePackage,
  getReferencePackageStatus,
  prepareReferencePackageAngleRegeneration,
  confirmAndRegenerateReferencePackageAngle,
  evaluateIdentityConsistency,
  IDENTITY_CONSISTENCY_POLICY_VERSION,
  IDENTITY_CONSISTENCY_MATCH_EUCLIDEAN,
  MemoryCreationRepository,
  MemoryPersonaRepository,
  setCreationRepositoryForTests,
  setPersonaRepositoryForTests,
} from "@/lib/persona";
import {
  findMasterIdentityReference,
  isMasterIdentityReference,
} from "@/lib/persona/creation/master-identity-reference";
import {
  OPENAI_STAGE_B_IMAGE_EDIT_PATH,
  assertStageBUsesImageReferencePath,
} from "@/agents/image/providers/openai-images-edit-provider";
import type { WorkspaceScope } from "@/lib/persona/domain/types";

const ROOT = process.cwd();
const WS = "ws-phase-23d";
const scope: WorkspaceScope = { workspaceId: WS, actorId: "tester-23d" };

function tinyPng(): Buffer {
  return Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  );
}

/** Deterministic 128-d unit-ish vector for identity match tests. */
function emb(seed: number): number[] {
  const out = Array.from({ length: 128 }, (_, i) =>
    Math.sin((i + 1) * seed) * 0.05,
  );
  return out;
}

const projectInput = {
  name: "OBF 2.3D",
  description: "reference package",
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

describe("Phase 2.3D Controlled Reference Package", () => {
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

  async function setupConvertedPersona() {
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
    return { persona, master, candidateAssetPath: asset.storage_path };
  }

  function depsWithIdentity(mode: "match" | "mismatch") {
    const masterVec = emb(1);
    const genVec = mode === "match" ? emb(1) : emb(50);
    let call = 0;
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
        call += 1;
        const embedding = call % 2 === 1 ? masterVec : genVec;
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

  it("1. Stage B uses Master Identity Reference", async () => {
    const { persona, master } = await setupConvertedPersona();
    const prepared = await prepareReferencePackageConfirmation(
      scope,
      persona.id,
      { deps: depsWithIdentity("match") },
    );
    assert.equal(prepared.masterReferenceId, master.id);
    assert.equal(prepared.providerCalled, false);
  });

  it("2. OpenAI is selected for Stage B", () => {
    assert.equal(STAGE_B_REFERENCE_PACKAGE_CAPABILITY.provider, "openai");
    assert.equal(STAGE_B_REFERENCE_PACKAGE_CAPABILITY.usesFlux, false);
    assert.equal(
      OPENAI_PROVIDER_CAPABILITY.stageBPersonaReferencePackageImageEdit,
      true,
    );
    assert.equal(OPENAI_PROVIDER_CAPABILITY.stageBUsesFlux, false);
  });

  it("3. text-only fallback is forbidden", () => {
    assert.equal(
      STAGE_B_REFERENCE_PACKAGE_CAPABILITY.textOnlyFallbackForbidden,
      true,
    );
    assert.equal(OPENAI_PROVIDER_CAPABILITY.stageBAllowsTextOnlyFallback, false);
    assert.throws(() =>
      assertStageBUsesImageReferencePath({
        hasMasterImageBytes: true,
        allowTextOnlyFallback: true,
      }),
    );
    assert.throws(() =>
      assertStageBUsesImageReferencePath({
        hasMasterImageBytes: false,
        allowTextOnlyFallback: false,
      }),
    );
  });

  it("4–5. no provider call on status/prepare", async () => {
    const { persona } = await setupConvertedPersona();
    await getReferencePackageStatus(scope, persona.id, depsWithIdentity("match"));
    assert.equal(providerCallCount, 0);
    await prepareReferencePackageConfirmation(scope, persona.id, {
      deps: depsWithIdentity("match"),
    });
    assert.equal(providerCallCount, 0);
  });

  it("6–7. explicit cost confirmation required + single-use", async () => {
    const { persona } = await setupConvertedPersona();
    const prepared = await prepareReferencePackageConfirmation(scope, persona.id, {
      deps: depsWithIdentity("match"),
    });
    await assert.rejects(
      () =>
        confirmAndGenerateReferencePackage(scope, persona.id, {
          confirmationToken: prepared.confirmationToken,
          costConfirmed: false,
          deps: depsWithIdentity("match"),
        }),
      /Kostenbestätigung/i,
    );
    const first = await confirmAndGenerateReferencePackage(scope, persona.id, {
      confirmationToken: prepared.confirmationToken,
      costConfirmed: true,
      deps: depsWithIdentity("match"),
    });
    assert.equal(first.results.length, 5);
    await assert.rejects(
      () =>
        confirmAndGenerateReferencePackage(scope, persona.id, {
          confirmationToken: prepared.confirmationToken,
          costConfirmed: true,
          deps: depsWithIdentity("match"),
        }),
      /single-use|verbraucht/i,
    );
  });

  it("8. five angle slots are supported", () => {
    assert.deepEqual(REFERENCE_PACKAGE_SLOTS, [
      "front",
      "three_quarter_left",
      "three_quarter_right",
      "left_profile",
      "right_profile",
    ]);
    const estimate = estimateReferencePackageCost();
    assert.equal(estimate.imageCount, 5);
    assert.equal(estimate.provider, "openai");
    assert.ok(estimate.estimatedMin > 0);
    assert.ok(estimate.estimatedMax >= estimate.estimatedMin);
    assert.equal(estimate.maxAuthorizedSpend, estimate.estimatedMax);
  });

  it("9–10. each angle persists independently; success survives failure", async () => {
    const { persona } = await setupConvertedPersona();
    let slotIndex = 0;
    const masterVec = emb(1);
    const matchVec = emb(1);
    const mismatchVec = emb(77);
    let embCall = 0;
    const failOnSlot = "three_quarter_left";

    const customDeps = {
      repo: pkgRepo,
      skipProviderCalls: true as const,
      downloadMasterBytes: async () => tinyPng(),
      editFromMaster: async (req: {
        referenceImageBytes: Buffer;
        prompt: string;
      }) => {
        const slot = REFERENCE_PACKAGE_SLOTS[slotIndex++];
        providerCallCount += 1;
        if (slot === failOnSlot) {
          throw new Error("simulated provider failure");
        }
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
        embCall += 1;
        return {
          status: "performed" as const,
          embedding: embCall % 2 === 1 ? masterVec : matchVec,
          detectionConfidence: 0.99,
          faceCount: 1,
          embeddingVersion: "test",
          embeddingModel: "faceRecognitionNet",
          embeddingDimension: 128,
          similarityThresholdVersion: "v1",
        };
      },
    };

    const prepared = await prepareReferencePackageConfirmation(scope, persona.id, {
      deps: customDeps,
    });
    const result = await confirmAndGenerateReferencePackage(scope, persona.id, {
      confirmationToken: prepared.confirmationToken,
      costConfirmed: true,
      deps: customDeps,
    });

    const failed = result.results.find((r) => r.slot === failOnSlot);
    assert.equal(failed?.attempt.status, "failed");
    const accepted = result.results.filter((r) => r.attempt.status === "review");
    assert.ok(accepted.length >= 4);

    const attempts = await pkgRepo.listAttemptsForPersona(scope, persona.id);
    assert.ok(attempts.some((a) => a.status === "review"));
    assert.ok(attempts.some((a) => a.status === "failed"));
    void mismatchVec;
  });

  it("11–13. fresh embedding vs Master; mismatch not accepted", async () => {
    const matchEval = evaluateIdentityConsistency({
      masterEmbedding: emb(1),
      generatedEmbedding: emb(1),
    });
    assert.equal(matchEval.decision, "identity_match");
    assert.equal(matchEval.policyVersion, IDENTITY_CONSISTENCY_POLICY_VERSION);

    const mismatchEval = evaluateIdentityConsistency({
      masterEmbedding: emb(1),
      generatedEmbedding: emb(99),
    });
    assert.equal(mismatchEval.decision, "identity_mismatch");

    assert.equal(
      IDENTITY_CONSISTENCY_MATCH_EUCLIDEAN,
      FACE_SIMILARITY_EUCLIDEAN_DUPLICATE_THRESHOLD,
    );
    assert.equal(FACE_SIMILARITY_EUCLIDEAN_DUPLICATE_THRESHOLD, 0.45);

    const { persona } = await setupConvertedPersona();
    const prepared = await prepareReferencePackageConfirmation(scope, persona.id, {
      deps: depsWithIdentity("mismatch"),
      slots: ["front"],
    });
    // Session image_count must match — prepare with single slot
    const result = await confirmAndGenerateReferencePackage(scope, persona.id, {
      confirmationToken: prepared.confirmationToken,
      costConfirmed: true,
      slots: ["front"],
      deps: depsWithIdentity("mismatch"),
    });
    assert.equal(result.results[0]?.attempt.status, "mismatch");
    assert.notEqual(result.results[0]?.attempt.identity_decision, "identity_match");

    const refs = await personaRepo.listReferenceAssets(scope, persona.id);
    const generated = refs.filter((r) => !isMasterIdentityReference(r));
    for (const g of generated) {
      assert.equal(g.is_primary, false);
      assert.notEqual(g.status, "approved");
    }
  });

  it("14. mismatch can be regenerated independently", async () => {
    const { persona } = await setupConvertedPersona();
    const prep1 = await prepareReferencePackageConfirmation(scope, persona.id, {
      deps: depsWithIdentity("mismatch"),
      slots: ["left_profile"],
    });
    await confirmAndGenerateReferencePackage(scope, persona.id, {
      confirmationToken: prep1.confirmationToken,
      costConfirmed: true,
      slots: ["left_profile"],
      deps: depsWithIdentity("mismatch"),
    });

    const prep2 = await prepareReferencePackageAngleRegeneration(
      scope,
      persona.id,
      "left_profile",
      depsWithIdentity("match"),
    );
    assert.equal(prep2.slots.length, 1);
    assert.equal(prep2.slots[0], "left_profile");
    const regen = await confirmAndRegenerateReferencePackageAngle(
      scope,
      persona.id,
      "left_profile",
      {
        confirmationToken: prep2.confirmationToken,
        costConfirmed: true,
        deps: depsWithIdentity("match"),
      },
    );
    assert.equal(regen.results[0]?.attempt.status, "review");
  });

  it("15–16. Master remains immutable; generated cannot replace Master", async () => {
    const { persona, master, candidateAssetPath } = await setupConvertedPersona();
    const prep = await prepareReferencePackageConfirmation(scope, persona.id, {
      deps: depsWithIdentity("match"),
      slots: ["front"],
    });
    await confirmAndGenerateReferencePackage(scope, persona.id, {
      confirmationToken: prep.confirmationToken,
      costConfirmed: true,
      slots: ["front"],
      deps: depsWithIdentity("match"),
    });

    const refs = await personaRepo.listReferenceAssets(scope, persona.id);
    const masterAfter = findMasterIdentityReference(refs);
    assert.ok(masterAfter);
    assert.equal(masterAfter.id, master.id);
    assert.equal(masterAfter.storage_path, candidateAssetPath);
    assert.equal(masterAfter.is_primary, true);

    const personaRow = await personaRepo.getPersona(scope, persona.id);
    assert.equal(personaRow?.primary_reference_asset_id, master.id);

    for (const ref of refs) {
      if (ref.id === master.id) continue;
      assert.equal(ref.is_primary, false);
      assert.equal(isMasterIdentityReference(ref), false);
    }
  });

  it("17–19. Reference Package Ready gate; no auto Identity Lock / approve", async () => {
    const { persona } = await setupConvertedPersona();
    const prep = await prepareReferencePackageConfirmation(scope, persona.id, {
      deps: depsWithIdentity("match"),
    });
    const result = await confirmAndGenerateReferencePackage(scope, persona.id, {
      confirmationToken: prep.confirmationToken,
      costConfirmed: true,
      deps: depsWithIdentity("match"),
    });
    assert.equal(result.referencePackageReady, false);
    assert.equal(result.identityLocked, false);
    assert.equal(result.autoApproved, false);

    const status = await getReferencePackageStatus(
      scope,
      persona.id,
      depsWithIdentity("match"),
    );
    assert.equal(status.referencePackageReady, false);
    assert.equal(status.acceptedCount, 0);
    assert.equal(status.identityLocked, false);
    assert.equal(status.personaStatus, "Draft");

    const personaRow = await personaRepo.getPersona(scope, persona.id);
    assert.equal(personaRow?.status, "Draft");
    assert.notEqual(personaRow?.identity_lock_status, "approved");
    assert.equal(personaRow?.image_use_approved, false);
  });

  it("20. discovery/FLUX/novelty architecture unchanged", () => {
    assert.equal(OPENAI_PROVIDER_CAPABILITY.stageBIdentityConsistentExpansion, false);
    assert.equal(FACE_SIMILARITY_EUCLIDEAN_DUPLICATE_THRESHOLD, 0.45);
    assert.equal(STAGE_B_REFERENCE_PACKAGE_CAPABILITY.autoIdentityLock, false);
    assert.match(
      OPENAI_STAGE_B_IMAGE_EDIT_PATH,
      /openai\.images\.edit/,
    );
    const noveltyFile = readFileSync(
      join(ROOT, "lib/persona/face-novelty-memory/similarity-threshold.ts"),
      "utf8",
    );
    assert.match(noveltyFile, /FACE_SIMILARITY_EUCLIDEAN_DUPLICATE_THRESHOLD = 0\.45/);
  });

  it("UI surfaces Reference Package + regenerate", () => {
    const studio = readFileSync(
      join(ROOT, "components/persona/persona-studio.tsx"),
      "utf8",
    );
    assert.match(studio, /REFERENCE PACKAGE/);
    assert.match(studio, /Regenerate this angle/);
    assert.match(studio, /Maximum authorized spend/);
    assert.match(studio, /reference-package-panel/);
  });
});
