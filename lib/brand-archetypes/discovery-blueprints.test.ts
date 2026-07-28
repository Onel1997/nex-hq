/**
 * Phase 1.8E — Archetype-scoped discovery blueprints.
 * Never invokes OpenAI.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  FEMALE_DISCOVERY_BLUEPRINTS,
  MEDITERRANEAN_DISCOVERY_BLUEPRINTS,
  URBAN_DISCOVERY_BLUEPRINTS,
  assertBlueprintGenderMatchesArchetype,
  assertDiscoveryCastBlueprintsUnique,
  blueprintFaceTrio,
  blueprintHairDescriptor,
  blueprintIdentityDescriptor,
  discoveryRunVariationToken,
  listDiscoveryBlueprintsForArchetype,
  promptFingerprint,
  requiredGenderForArchetype,
  resolveDiscoveryBlueprint,
  variationProfileFromBlueprint,
} from "@/lib/brand-archetypes/discovery-blueprints";
import {
  loadBrandArchetypeCatalog,
  MILAENE_BRAND_ARCHETYPES,
} from "@/lib/brand-archetypes";
import { ARCHETYPE_PROJECT_MARKER } from "@/lib/brand-face-selection/creation-project-mapper";
import {
  buildCandidatePrompt,
  resolveCandidateVariation,
  resolveOfficialDiscoveryVariations,
  CANDIDATE_VARIATION_PROFILES,
} from "@/lib/persona/creation/candidate-intelligence";
import { discoverySlotLabel } from "@/components/persona/persona-studio-project-sync";
import type { PersonaCreationProject } from "@/lib/persona/domain/creation-types";
import {
  MemoryCreationRepository,
  MemoryGenerationJobRepository,
  MemoryPersonaRepository,
  PERSONA_TEST_WORKSPACE_ID,
  resetMemoryGenerationJobStoreForTests,
  setCreationRepositoryForTests,
  setGenerationJobRepositoryForTests,
  setPersonaRepositoryForTests,
} from "@/lib/persona";
import {
  confirmAndStartCandidateGeneration,
  createCreationProject,
  preparePaidGenerationConfirmation,
} from "@/lib/persona/creation/creation-service";
import type { WorkspaceScope } from "@/lib/persona/domain/types";
import { afterEach, beforeEach } from "node:test";

const ARCH_MED = "arch-mediterranean-premium-hero";
const ARCH_URBAN = "arch-urban-community-hero";
const ARCH_FEMALE = "arch-female-lifestyle-hero";

function projectForArchetype(
  archetypeId: string,
  projectId = "proj-obf-1",
): PersonaCreationProject {
  const now = new Date().toISOString();
  return {
    id: projectId,
    workspace_id: "ws-milaene",
    name: "OBF Discovery",
    description: `Official Brand Face. ${ARCHETYPE_PROJECT_MARKER}${archetypeId}`,
    gender_presentation: archetypeId.includes("female") ? "Female" : "Male",
    age_range: "24-30",
    height_range: "180",
    body_type: "Lean",
    skin_tone_direction: "",
    face_shape_direction: "",
    hair_direction: "",
    facial_hair_direction: "",
    eye_direction: "",
    expression_direction: "",
    personality: "",
    fashion_style: "premium streetwear",
    brand_role: archetypeId.includes("female")
      ? "primary_female"
      : "primary_male",
    visual_keywords: "",
    excluded_features: "",
    preferred_brand_looks: "",
    preferred_outfits: "",
    intended_usage: "image_and_video",
    candidate_count: 4,
    provider_mode: "image_provider",
    quality_mode: "premium_editorial",
    status: "draft",
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
    created_at: now,
    updated_at: now,
  };
}

describe("Phase 1.8E archetype-scoped discovery blueprints", () => {
  it("1. Mediterranean discovery returns four male blueprints", () => {
    const list = listDiscoveryBlueprintsForArchetype(ARCH_MED);
    assert.equal(list.length, 4);
    assert.ok(list.every((b) => b.gender === "male"));
    assert.deepEqual(
      list.map((b) => b.name),
      [
        "Mediterranean Soft Luxury",
        "North African Street Premium",
        "Southern European Creative",
        "Levantine Modern Hero",
      ],
    );
  });

  it("2. Urban discovery returns four male blueprints", () => {
    const list = URBAN_DISCOVERY_BLUEPRINTS;
    assert.equal(list.length, 4);
    assert.ok(list.every((b) => b.gender === "male"));
    assert.ok(list.every((b) => b.archetypeId === ARCH_URBAN));
  });

  it("3. Female discovery returns four female blueprints", () => {
    const list = FEMALE_DISCOVERY_BLUEPRINTS;
    assert.equal(list.length, 4);
    assert.ok(list.every((b) => b.gender === "female"));
    assert.ok(list.every((b) => b.archetypeId === ARCH_FEMALE));
  });

  it("4. no cross-archetype blueprint leakage", () => {
    const med = resolveDiscoveryBlueprint({
      archetypeId: ARCH_MED,
      candidateNumber: 3,
    });
    assert.equal(med.archetypeId, ARCH_MED);
    assert.equal(med.gender, "male");
    assert.notEqual(med.id, FEMALE_DISCOVERY_BLUEPRINTS[2]!.id);

    const urban = resolveDiscoveryBlueprint({
      archetypeId: ARCH_URBAN,
      candidateNumber: 1,
    });
    assert.equal(urban.archetypeId, ARCH_URBAN);
    assert.notEqual(urban.id, MEDITERRANEAN_DISCOVERY_BLUEPRINTS[0]!.id);
  });

  it("5. Mediterranean cannot use female blueprint", () => {
    const catalog = loadBrandArchetypeCatalog();
    const med = catalog.archetypes.find((a) => a.id === ARCH_MED)!;
    const femaleBlueprint = FEMALE_DISCOVERY_BLUEPRINTS[0]!;
    assert.throws(
      () => assertBlueprintGenderMatchesArchetype(femaleBlueprint, med),
      /gender mismatch/i,
    );
  });

  it("6–8. four identity / face / hair descriptors unique per archetype", () => {
    for (const list of [
      MEDITERRANEAN_DISCOVERY_BLUEPRINTS,
      URBAN_DISCOVERY_BLUEPRINTS,
      FEMALE_DISCOVERY_BLUEPRINTS,
    ]) {
      assertDiscoveryCastBlueprintsUnique(list);
      assert.equal(new Set(list.map((b) => blueprintIdentityDescriptor(b))).size, 4);
      assert.equal(new Set(list.map((b) => b.faceGeometry)).size, 4);
      assert.equal(new Set(list.map((b) => blueprintHairDescriptor(b))).size, 4);
      assert.equal(new Set(list.map((b) => blueprintFaceTrio(b))).size, 4);
    }
  });

  it("9. prompt fingerprints A–D are unique for Mediterranean OBF", () => {
    const project = projectForArchetype(ARCH_MED, "proj-fp-a");
    const fingerprints = [1, 2, 3, 4].map((n) => {
      const built = buildCandidatePrompt({
        project,
        assetType: "portrait_front",
        candidateNumber: n,
      });
      assert.equal(built.officialBrandFace, true);
      assert.equal(built.brandArchetype.id, ARCH_MED);
      assert.equal(built.discoveryBlueprint?.gender, "male");
      assert.ok(built.prompt.toLowerCase().includes("male"));
      assert.ok(!/Weekend Community|Modern Creator|Relaxed Mediterranean|Clean Street Athletic/i.test(
        built.variation.label,
      ));
      return built.promptFingerprint;
    });
    assert.equal(new Set(fingerprints).size, 4);
  });

  it("10. two different project IDs produce different full prompt fingerprints", () => {
    const a = buildCandidatePrompt({
      project: projectForArchetype(ARCH_MED, "proj-run-aaa"),
      assetType: "portrait_front",
      candidateNumber: 1,
    });
    const b = buildCandidatePrompt({
      project: projectForArchetype(ARCH_MED, "proj-run-bbb"),
      assetType: "portrait_front",
      candidateNumber: 1,
    });
    assert.notEqual(a.runVariationToken, b.runVariationToken);
    assert.notEqual(a.promptFingerprint, b.promptFingerprint);
    assert.equal(a.discoveryBlueprint?.id, b.discoveryBlueprint?.id);
    assert.notEqual(
      discoveryRunVariationToken("proj-run-aaa"),
      discoveryRunVariationToken("proj-run-bbb"),
    );
  });

  it("11. global variation profiles no longer control gender or biology for OBF", () => {
    const project = projectForArchetype(ARCH_MED, "proj-no-global");
    // Candidate 3 used to resolve Female via resolveArchetypeForCandidate.
    const built = buildCandidatePrompt({
      project,
      assetType: "portrait_front",
      candidateNumber: 3,
      // Attempt to inject global variation — must be overridden.
      variation: resolveCandidateVariation(3),
    });
    assert.equal(built.brandArchetype.id, ARCH_MED);
    assert.equal(built.discoveryBlueprint?.gender, "male");
    assert.equal(built.variation.id, "med-c-southern-creative");
    assert.match(built.variation.label, /Southern European Creative/i);
    assert.ok(
      !CANDIDATE_VARIATION_PROFILES.some((p) => p.id === built.variation.id),
    );
  });

  it("12. old global labels are not primary Official Brand Face labels", () => {
    assert.equal(discoverySlotLabel(1), "Candidate A");
    assert.equal(discoverySlotLabel(2), "Candidate B");
    assert.equal(discoverySlotLabel(3), "Candidate C");
    assert.equal(discoverySlotLabel(4), "Candidate D");
    const resolved = resolveOfficialDiscoveryVariations({
      project: projectForArchetype(ARCH_MED),
      candidateNumbers: [1, 2, 3, 4],
    });
    const labels = resolved.variations.map((v) => v.label);
    for (const banned of [
      "Modern Creator",
      "Weekend Community",
      "Relaxed Mediterranean",
      "Clean Street Athletic",
    ]) {
      assert.ok(!labels.includes(banned));
    }
  });

  it("13. Product Intelligence constraints remain active", () => {
    const built = buildCandidatePrompt({
      project: projectForArchetype(ARCH_MED, "proj-pi"),
      assetType: "portrait_front",
      candidateNumber: 1,
    });
    assert.ok(built.productIntelligence);
    assert.ok(built.blocks.wardrobe.length > 0);
    assert.match(built.prompt, /wardrobe|fit|hoodie|tee|streetwear/i);
  });

  it("15. promptFingerprint helper is stable", () => {
    assert.equal(promptFingerprint("abc"), promptFingerprint("abc"));
    assert.notEqual(promptFingerprint("abc"), promptFingerprint("abd"));
  });

  it("requiredGender matches each official archetype", () => {
    for (const a of MILAENE_BRAND_ARCHETYPES) {
      const g = requiredGenderForArchetype(a);
      if (a.slug === "female-lifestyle-hero") assert.equal(g, "female");
      else assert.equal(g, "male");
    }
  });

  it("Urban OBF never assigns female identity to any slot", () => {
    const project = projectForArchetype(ARCH_URBAN, "proj-urban");
    for (const n of [1, 2, 3, 4]) {
      const built = buildCandidatePrompt({
        project,
        assetType: "portrait_front",
        candidateNumber: n,
      });
      assert.equal(built.discoveryBlueprint?.gender, "male");
      assert.equal(built.brandArchetype.id, ARCH_URBAN);
    }
  });

  it("Female OBF never assigns male identity to any slot", () => {
    const project = projectForArchetype(ARCH_FEMALE, "proj-female");
    for (const n of [1, 2, 3, 4]) {
      const built = buildCandidatePrompt({
        project,
        assetType: "portrait_front",
        candidateNumber: n,
      });
      assert.equal(built.discoveryBlueprint?.gender, "female");
      assert.equal(built.brandArchetype.id, ARCH_FEMALE);
    }
  });
});

describe("Phase 1.8E paid confirmation still required", () => {
  const scope: WorkspaceScope = {
    workspaceId: PERSONA_TEST_WORKSPACE_ID,
    actorId: "blueprint-tester",
  };

  beforeEach(() => {
    process.env.PERSONA_USE_FAKE_PROVIDER = "true";
    process.env.PERSONA_PAID_GENERATION_ENABLED = "true";
    process.env.OPENAI_API_KEY = "test-key";
    resetMemoryGenerationJobStoreForTests();
    setPersonaRepositoryForTests(new MemoryPersonaRepository());
    setCreationRepositoryForTests(new MemoryCreationRepository());
    setGenerationJobRepositoryForTests(new MemoryGenerationJobRepository());
  });

  afterEach(() => {
    delete process.env.PERSONA_USE_FAKE_PROVIDER;
    delete process.env.PERSONA_PAID_GENERATION_ENABLED;
    delete process.env.OPENAI_API_KEY;
    setCreationRepositoryForTests(null);
    setGenerationJobRepositoryForTests(null);
    setPersonaRepositoryForTests(null);
    resetMemoryGenerationJobStoreForTests();
  });

  it("14. paid confirmation remains required before generation", async () => {
    const project = await createCreationProject(scope, {
      name: "OBF Gate",
      description: `Official. ${ARCHETYPE_PROJECT_MARKER}${ARCH_MED}`,
      gender_presentation: "Male",
      age_range: "24-30",
      height_range: "180",
      body_type: "Lean",
      skin_tone_direction: "Olive",
      face_shape_direction: "Defined",
      hair_direction: "Dark",
      facial_hair_direction: "Stubble",
      eye_direction: "Brown",
      expression_direction: "Calm",
      personality: "Quiet",
      fashion_style: "Luxury",
      brand_role: "primary_male",
      visual_keywords: "",
      excluded_features: "",
      preferred_brand_looks: "",
      preferred_outfits: "",
      intended_usage: "image_and_video",
      candidate_count: 4,
      provider_mode: "image_provider",
      additional_description: "",
    });
    await assert.rejects(
      () =>
        confirmAndStartCandidateGeneration(scope, project.id, {
          costConfirmed: false,
          confirmationToken: "missing",
          userConfirmedAt: new Date().toISOString(),
          attestation: "ui_checkbox",
        }),
      /Kostenbestätigung|Bestätigung/i,
    );
    const prepared = await preparePaidGenerationConfirmation(scope, project.id);
    const result = await confirmAndStartCandidateGeneration(scope, project.id, {
      costConfirmed: true,
      confirmationToken: prepared.confirmation.confirmation_token,
      userConfirmedAt: new Date().toISOString(),
      attestation: "ui_checkbox",
    });
    assert.equal(result.candidates.length, 4);
    // Fake provider path still persists blueprint labels via creation-service resolve.
    const names = result.candidates.map((c) => c.candidate_name);
    assert.ok(names.every((n) => !/Modern Creator|Weekend Community/i.test(n)));
  });
});

describe("Phase 1.8E variationProfileFromBlueprint", () => {
  it("maps blueprint biology into variation profile", () => {
    const archetype = MILAENE_BRAND_ARCHETYPES.find((a) => a.id === ARCH_MED)!;
    const blueprint = MEDITERRANEAN_DISCOVERY_BLUEPRINTS[1]!;
    const profile = variationProfileFromBlueprint(blueprint, archetype);
    assert.equal(profile.id, blueprint.id);
    assert.equal(profile.label, blueprint.name);
    assert.equal(profile.skinTone, blueprint.skinTone);
    assert.equal(profile.faceGeometry, blueprint.faceGeometry);
    assert.match(profile.identityDescriptor, /male/i);
  });
});
