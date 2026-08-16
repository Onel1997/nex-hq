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
  assessCandidateQuality,
  buildCandidatePrompt,
  defaultA1VisualCastingEvaluation,
  emptyVisualEvaluation,
  passesDiscoveryQualityGate,
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
import { STAGE_A1_DISCOVERY_ASSET_TYPES } from "@/lib/persona/creation/casting-funnel";
import { imagesPerCandidateForStage } from "@/lib/persona/creation/provider/cost";

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
    for (const n of [1, 2, 3, 4]) {
      const bp = resolveDiscoveryBlueprint({
        archetypeId: ARCH_URBAN,
        candidateNumber: n,
      });
      assert.equal(bp.gender, "male");
      assert.equal(bp.archetypeId, ARCH_URBAN);
    }
    // Phase 2.5B: Urban L2 is live — OBF prompt must resolve male-only identity.
    for (const n of [1, 2, 3, 4]) {
      const built = buildCandidatePrompt({
        project: projectForArchetype(ARCH_URBAN, `proj-urban-${n}`),
        assetType: "portrait_front",
        candidateNumber: n,
        generationRunId: `run-urban-${n}`,
      });
      assert.equal(built.brandArchetype.genderPresentation, "Male");
      assert.equal(built.slotBlueprint?.gender, "male");
      assert.equal(built.discoveryBlueprint?.gender, "male");
      assert.match(built.prompt, /\bmale\b/i);
      assert.doesNotMatch(built.prompt, /\bfemale model\b/i);
    }
  });

  it("Female OBF never assigns male identity to any slot", () => {
    for (const n of [1, 2, 3, 4]) {
      const bp = resolveDiscoveryBlueprint({
        archetypeId: ARCH_FEMALE,
        candidateNumber: n,
      });
      assert.equal(bp.gender, "female");
      assert.equal(bp.archetypeId, ARCH_FEMALE);
    }
    assert.throws(
      () =>
        buildCandidatePrompt({
          project: projectForArchetype(ARCH_FEMALE, "proj-female"),
          assetType: "portrait_front",
          candidateNumber: 1,
          generationRunId: "run-female",
        }),
      /No L2 SlotBlueprints configured/i,
    );
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

describe("Phase 1.9 premium streetwear casting quality engine", () => {
  const GLOBAL_LABELS = [
    "Weekend Community",
    "Modern Creator",
    "Relaxed Mediterranean",
    "Clean Street Athletic",
  ];

  function mediterraneanPrompts() {
    const project = projectForArchetype(ARCH_MED, "proj-phase19-med");
    return [1, 2, 3, 4].map((n) => {
      const built = buildCandidatePrompt({
        project,
        assetType: "portrait_front",
        candidateNumber: n,
      });
      return { n, built, prompt: built.prompt, negative: built.negativePrompt };
    });
  }

  it("1. each Mediterranean candidate has a distinct FashionCastingProfile", () => {
    const profiles = MEDITERRANEAN_DISCOVERY_BLUEPRINTS.map((b) => b.fashionCasting);
    assert.equal(profiles.length, 4);
    for (const p of profiles) {
      assert.ok(p.modelBuild);
      assert.ok(p.modelHeightDirection);
      assert.ok(p.shoulderLine);
      assert.ok(p.fashionPresence);
      assert.ok(p.microExpression);
      assert.ok(p.castingRiskExclusions.length > 0);
    }
  });

  it("2. all four have distinct model presence directions", () => {
    const presence = MEDITERRANEAN_DISCOVERY_BLUEPRINTS.map(
      (b) => b.fashionCasting.fashionPresence,
    );
    assert.equal(new Set(presence).size, 4);
  });

  it("3–5. upper-torso fashion casting composition — no passport/ID framing", () => {
    for (const { prompt, negative } of mediterraneanPrompts()) {
      assert.match(prompt, /mid-torso|chest upward|upper torso/i);
      assert.match(prompt, /shoulders?\s+(fully\s+)?visible/i);
      assert.match(prompt, /10–20|10-20|body rotation/i);
      assert.ok(!/head-and-shoulders to upper chest/i.test(prompt));
      assert.match(negative, /passport photo/i);
      assert.match(negative, /ID-card portrait|employee headshot|LinkedIn/i);
      assert.match(prompt, /garment|heavyweight|hoodie|T-shirt|tee/i);
    }
  });

  it("6–8. correct Product Intelligence garments — no invented products or logos", () => {
    const expected = [
      /washed-black.*oversized.*T-shirt/i,
      /zip hoodie/i,
      /off-white|muted stone/i,
      /charcoal.*hoodie|washed-dark.*T-shirt/i,
    ];
    const rows = mediterraneanPrompts();
    rows.forEach(({ prompt, negative }, i) => {
      assert.match(prompt, expected[i]!);
      assert.match(prompt, /Product Intelligence/i);
      assert.match(prompt, /no logos|No visible third-party logos/i);
      assert.match(
        prompt,
        /Only Oversized Heavyweight T-Shirt, Heavyweight Hoodie, or Zip Hoodie/i,
      );
      assert.match(
        prompt,
        /No caps, jackets, jewelry, suits, cargo pants, footwear, or accessories/i,
      );
      assert.match(negative, /invented product|third-party branding|jewelry focus/i);
    });
  });

  it("9. no female candidate in Mediterranean", () => {
    for (const { built, prompt } of mediterraneanPrompts()) {
      assert.equal(built.discoveryBlueprint?.gender, "male");
      assert.match(prompt, /ONLY adult male/i);
      assert.ok(!/ONLY adult female/i.test(prompt));
      assert.ok(!/female subject/i.test(prompt.split("Avoid:")[0] ?? ""));
    }
  });

  it("10. no aggressive expression direction", () => {
    for (const { prompt } of mediterraneanPrompts()) {
      assert.match(prompt, /calm|approachable|quiet confidence|soft focused/i);
      assert.match(prompt, /NOT AGGRESSION|never aggressive|no aggression/i);
      const positive = prompt.toLowerCase();
      assert.ok(!/\bangry eyebrows\b/.test(positive) || /avoid/.test(positive));
      assert.ok(!positive.includes("gangster energy") || positive.includes("avoid"));
    }
  });

  it("11–12. premium model-quality and realistic-skin blocks exist", () => {
    for (const { prompt } of mediterraneanPrompts()) {
      assert.match(prompt, /FASHION MODEL QUALITY BAR|agency-castable|commercially memorable/i);
      assert.match(prompt, /natural pores|realistic.*skin|authentic skin/i);
      assert.match(prompt, /not an idealized AI beauty clone|not porcelain|not waxy/i);
    }
  });

  it("13–14. candidate-specific backgrounds and lighting are unique (L3 casting sets)", () => {
    const backgrounds = MEDITERRANEAN_DISCOVERY_BLUEPRINTS.map((b) => b.backgroundDirection);
    const lightings = MEDITERRANEAN_DISCOVERY_BLUEPRINTS.map((b) => b.lightingDirection);
    assert.equal(new Set(backgrounds).size, 4);
    assert.equal(new Set(lightings).size, 4);
    const castBackgrounds = mediterraneanPrompts().map(
      ({ built }) => built.discoveryIdentityInstance!.castingBackground,
    );
    // L3 samples casting backgrounds from per-slot pools — unique across A–D for a fixed run.
    assert.equal(new Set(castBackgrounds).size, 4);
    for (const { prompt, built } of mediterraneanPrompts()) {
      assert.ok(prompt.includes(built.discoveryIdentityInstance!.castingBackground));
      assert.match(prompt, /PREMIUM CASTING PHOTOGRAPHY|A1 PREMIUM CASTING SET/i);
    }
  });

  it("15. prompt fingerprints remain unique", () => {
    const fps = mediterraneanPrompts().map((r) => r.built.promptFingerprint);
    assert.equal(new Set(fps).size, 4);
  });

  it("16–17. A1 remains exactly four provider images — no beauty-regen loop", () => {
    assert.equal(MEDITERRANEAN_DISCOVERY_BLUEPRINTS.length, 4);
    assert.deepEqual(STAGE_A1_DISCOVERY_ASSET_TYPES, ["portrait_front"]);
    assert.equal(imagesPerCandidateForStage("discovery"), 1);
    const project = projectForArchetype(ARCH_MED, "proj-cost-a1");
    const built = buildCandidatePrompt({
      project,
      assetType: "portrait_front",
      candidateNumber: 1,
    });
    const verdict = passesDiscoveryQualityGate({
      built,
      project,
      variation: built.variation,
      assetTypes: ["portrait_front"],
      simulateFailUntilAttempt: 2,
      attempt: 1,
    });
    assert.equal(verdict.shouldRegenerate, false);
  });

  it("18. visual evaluation remains honest and not_performed", () => {
    const project = projectForArchetype(ARCH_MED, "proj-visual-honest");
    const built = buildCandidatePrompt({
      project,
      assetType: "portrait_front",
      candidateNumber: 1,
    });
    const assessment = assessCandidateQuality({
      project,
      variation: built.variation,
      assetTypes: ["portrait_front"],
    });
    assert.equal(assessment.visualEvaluation.status, "not_performed");
    assert.equal(assessment.scoreHonesty.visualStatusDefault, "not_performed");
    assert.equal(assessment.scoreHonesty.visualDecisionMaker, "manual_review_required");
    assert.equal(emptyVisualEvaluation().status, "not_performed");
    assert.equal(defaultA1VisualCastingEvaluation().status, "not_performed");
    assert.equal(assessment.dimensions.overall, assessment.briefFit);
  });

  it("snapshot: each Mediterranean prompt contains L3 identity, fashion, garment, photo, composition, presence, negatives, PI, male lock", () => {
    const rows = mediterraneanPrompts();
    const blueprints = MEDITERRANEAN_DISCOVERY_BLUEPRINTS;
    rows.forEach(({ prompt, negative, built }, i) => {
      const bp = blueprints[i]!;
      const l3 = built.discoveryIdentityInstance!;
      assert.equal(built.discoveryBlueprint?.id, bp.id);
      assert.ok(built.slotBlueprint);
      assert.ok(prompt.includes(bp.name) || prompt.includes(built.slotBlueprint!.name));
      assert.ok(prompt.includes(l3.regionalCluster) || prompt.includes(built.slotBlueprint!.regionalCluster));
      assert.ok(prompt.includes(l3.faceGeometry));
      assert.ok(prompt.includes(l3.garmentColor) || prompt.includes(built.slotBlueprint!.fashionDirection.slice(0, 20)));
      assert.ok(prompt.includes(l3.castingBackground));
      assert.match(prompt, /Generate a new individual inside this casting lane\./i);
      assert.match(prompt, /premium European streetwear casting test|fashion agency photography|50mm–85mm/i);
      assert.match(prompt, /mid-torso|upper torso|shoulders FULLY visible/i);
      assert.match(prompt, /calm|approachable|quietly confident/i);
      assert.match(negative, /passport photo/);
      assert.match(prompt, /PRODUCT INTELLIGENCE|Product Intelligence/);
      assert.match(prompt, /ONLY adult male/);
      assert.ok(built.promptFingerprint.length >= 8);
      for (const other of rows) {
        if (other.n === rows[i]!.n) continue;
        assert.ok(
          !prompt.includes(other.built.discoveryIdentityInstance!.faceGeometry) ||
            other.built.discoveryIdentityInstance!.faceGeometry === l3.faceGeometry,
          `${bp.slot} must not contain other slot faceGeometry`,
        );
      }
      assert.ok(!/ONLY adult female/i.test(prompt));
      assert.match(prompt, /not a campaign location|Keep Stage A controlled/i);
      assert.doesNotMatch(
        prompt,
        /set in (a )?(parking garage|street cafe|clothing rack|shop interior)/i,
      );
      for (const label of GLOBAL_LABELS) {
        assert.ok(!prompt.includes(label));
      }
    });
    assert.equal(new Set(rows.map((r) => r.built.promptFingerprint)).size, 4);
  });

  it("intended-use labels match A–D card metadata", () => {
    assert.deepEqual(
      MEDITERRANEAN_DISCOVERY_BLUEPRINTS.map((b) => b.intendedUseLabel),
      [
        "Homepage · Shopify · Premium Campaign",
        "Social · Zip Hoodie · Community Campaign",
        "Lifestyle · Editorial Social · Storytelling",
        "Flagship Campaign · Product Hero · Video",
      ],
    );
  });
});

describe("Phase 1.9A character diversity — permanent anatomy", () => {
  it("Mediterranean slots differ across all required anatomical axes", () => {
    const list = MEDITERRANEAN_DISCOVERY_BLUEPRINTS;
    assertDiscoveryCastBlueprintsUnique(list);
    for (const key of [
      "faceGeometry",
      "jaw",
      "forehead",
      "eyebrowDensity",
      "eyes",
      "nose",
      "lips",
      "cheekbones",
      "earShape",
      "facialProportions",
      "hairline",
      "facialHair",
    ] as const) {
      assert.equal(
        new Set(list.map((b) => b[key])).size,
        4,
        `expected unique ${key}`,
      );
    }
    assert.equal(
      new Set(list.map((b) => b.fashionCasting.neckProportions)).size,
      4,
    );
  });

  it("Mediterranean prompts carry L3 anatomy and anti-clone language", () => {
    const project = projectForArchetype(ARCH_MED, "proj-phase19a");
    for (const n of [1, 2, 3, 4]) {
      const built = buildCandidatePrompt({
        project,
        assetType: "portrait_front",
        candidateNumber: n,
        generationRunId: "run-phase19a",
      });
      const l3 = built.discoveryIdentityInstance!;
      assert.ok(built.prompt.includes(l3.forehead));
      assert.ok(built.prompt.includes(l3.eyebrows));
      assert.ok(built.prompt.includes(l3.ears));
      assert.ok(built.prompt.includes(l3.hairline));
      assert.ok(built.prompt.includes(l3.facialRatioVariant));
      assert.match(built.prompt, /Generate a new individual inside this casting lane\./i);
      assert.match(built.prompt, /brother|clone|repetitive Mediterranean template|generic handsome/i);
      assert.match(built.prompt, /DISCOVERY IDENTITY INSTANCE \(L3\)/);
    }
  });

  it("no Mediterranean prompt reuses another slot's jaw or nose", () => {
    const project = projectForArchetype(ARCH_MED, "proj-phase19a-cross");
    const rows = [1, 2, 3, 4].map((n) =>
      buildCandidatePrompt({
        project,
        assetType: "portrait_front",
        candidateNumber: n,
      }),
    );
    for (const row of rows) {
      const self = row.discoveryBlueprint!;
      for (const other of MEDITERRANEAN_DISCOVERY_BLUEPRINTS) {
        if (other.id === self.id) continue;
        assert.ok(!row.prompt.includes(other.jaw), `${self.slot} contains ${other.slot} jaw`);
        assert.ok(!row.prompt.includes(other.nose), `${self.slot} contains ${other.slot} nose`);
        assert.ok(
          !row.prompt.includes(other.forehead),
          `${self.slot} contains ${other.slot} forehead`,
        );
      }
    }
  });
});

describe("Phase 1.9A.1 discovery diversity sampling", () => {
  it("Mediterranean cast uses four distinct regional clusters", () => {
    const clusters = MEDITERRANEAN_DISCOVERY_BLUEPRINTS.map(
      (b) => b.diversitySampling.regionalCluster,
    );
    assert.equal(new Set(clusters).size, 4);
    assert.match(clusters[0]!, /Spanish|Iberian/i);
    assert.match(clusters[1]!, /North African|Maghrebi/i);
    assert.match(clusters[2]!, /Greek|Balkan/i);
    assert.match(clusters[3]!, /Lebanese|Levantine/i);
  });

  it("L3 anatomy appears before Brand Memory; legacy Diversity Brief is absent", () => {
    const project = projectForArchetype(ARCH_MED, "proj-phase19a1");
    for (const n of [1, 2, 3, 4]) {
      const built = buildCandidatePrompt({
        project,
        assetType: "portrait_front",
        candidateNumber: n,
        generationRunId: "run-phase19a1",
      });
      assert.match(
        built.prompt,
        /Generate a new individual inside this casting lane\./i,
      );
      assert.equal(built.blocks.diversityBrief, "");
      assert.doesNotMatch(built.prompt, /DISCOVERY DIVERSITY BRIEF/);
      assert.doesNotMatch(built.prompt, /CANDIDATE-SPECIFIC BIOLOGICAL IDENTITY/);
      const l3Idx = built.prompt.indexOf("DISCOVERY IDENTITY INSTANCE (L3)");
      const brandIdx = built.prompt.indexOf("PREMIUM STREETWEAR BRAND DNA");
      assert.ok(l3Idx >= 0 && brandIdx > l3Idx);
      assert.ok(
        built.prompt.includes(built.slotBlueprint!.regionalCluster),
      );
      assert.ok(
        built.prompt.includes(built.discoveryIdentityInstance!.regionalCluster),
      );
    }
  });

  it("diversity axes and anti-relative negatives are present", () => {
    const project = projectForArchetype(ARCH_MED, "proj-phase19a1-neg");
    const built = buildCandidatePrompt({
      project,
      assetType: "portrait_front",
      candidateNumber: 2,
    });
    assert.match(built.prompt, /skull proportions|chin shape|nose bridge|eyebrow angle/i);
    assert.match(built.negativePrompt, /brothers|cousins|twins|similar relatives|same nose template/i);
    assertDiscoveryCastBlueprintsUnique(MEDITERRANEAN_DISCOVERY_BLUEPRINTS);
  });
});
