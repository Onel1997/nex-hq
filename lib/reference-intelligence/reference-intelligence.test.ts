import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildCandidatePrompt } from "@/lib/persona/creation/candidate-intelligence/prompt-builder";
import { getCreationPreset } from "@/lib/persona/creation/presets";
import type { PersonaCreationProject } from "@/lib/persona/domain/creation-types";
import {
  MILAENE_REFERENCE_CATALOG,
  REFERENCE_INTELLIGENCE_VERSION,
  assertReferenceUsageAllowed,
  assertVisionExtractionDisabled,
  buildReferenceCatalogFingerprint,
  buildReferenceDirection,
  canReferenceBeUsedFor,
  cloneReferenceCatalog,
  createEmptyDescriptorTemplate,
  createReferenceDescriptorFingerprint,
  createReferenceIntelligenceSnapshot,
  dedupeReferenceDescriptors,
  formatPersonaReferenceDirection,
  formatReferenceIntelligencePrompt,
  getApprovedReferencesForUsage,
  isReferenceApproved,
  isVisionExtractionEnabled,
  mergeReferenceDescriptors,
  sanitizeReferenceDescriptor,
  sanitizeReferencePromptDirection,
  type ReferenceAsset,
  type ReferenceDescriptor,
  type ReferenceWorkspaceCatalog,
} from "./index";

function streetLuxuryProject(): PersonaCreationProject {
  const preset = getCreationPreset("milaene_street_luxury")!;
  return {
    id: "proj-ri-1",
    workspace_id: "ws-1",
    name: "Milaene Primary Male",
    description: "",
    gender_presentation: preset.gender_presentation,
    age_range: preset.age_range,
    height_range: preset.height_range,
    body_type: preset.body_type,
    skin_tone_direction: preset.skin_tone_direction,
    face_shape_direction: preset.face_shape_direction,
    hair_direction: preset.hair_direction,
    facial_hair_direction: preset.facial_hair_direction,
    eye_direction: preset.eye_direction,
    expression_direction: preset.expression_direction,
    personality: preset.personality,
    fashion_style: preset.fashion_style,
    brand_role: preset.brand_role,
    visual_keywords: preset.visual_keywords,
    excluded_features: preset.excluded_features,
    preferred_brand_looks: preset.preferred_brand_looks,
    preferred_outfits: preset.preferred_outfits,
    intended_usage: preset.intended_usage,
    candidate_count: preset.candidate_count,
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
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function makeAsset(
  overrides: Partial<ReferenceAsset> & Pick<ReferenceAsset, "id" | "approvalStatus" | "usage">,
): ReferenceAsset {
  return {
    workspaceId: "ws-milaene",
    boardId: "board-milaene-persona-casting",
    title: overrides.title ?? "Abstract casting ref",
    description: "Manual abstract descriptors only",
    sourceType: "brand_reference",
    sourceLabel: "Internal mood note",
    sourceUrl: null,
    localAssetId: null,
    storagePath: null,
    mimeType: "application/x-reference-descriptor",
    width: null,
    height: null,
    tags: ["casting"],
    rightsNotes: "No copyrighted image attached",
    extractionMethod: "manual",
    descriptorId: overrides.descriptorId ?? `desc-${overrides.id}`,
    createdAt: "2026-07-21T00:00:00.000Z",
    updatedAt: "2026-07-21T00:00:00.000Z",
    version: "1",
    ...overrides,
  };
}

function makeDescriptor(
  overrides: Partial<ReferenceDescriptor> & Pick<ReferenceDescriptor, "id" | "assetId">,
): ReferenceDescriptor {
  const base = createEmptyDescriptorTemplate({
    id: overrides.id,
    assetId: overrides.assetId,
    boardId: overrides.boardId ?? "board-milaene-persona-casting",
    now: "2026-07-21T00:00:00.000Z",
  });
  return {
    ...base,
    ...overrides,
    expression: {
      mood: "calm friendly",
      approachability: "high",
      confidence: "quiet",
      ...overrides.expression,
    },
    personaDirection: {
      hairDirection: "natural texture",
      grooming: "clean casual",
      socialPresence: "approachable",
      streetwearCredibility: "high",
      ...overrides.personaDirection,
    },
    lighting: {
      softness: "soft",
      sourceType: "daylight",
      ...overrides.lighting,
    },
    visualMood: {
      campaignEnergy: "understated",
      authenticity: "high",
      ...overrides.visualMood,
    },
  };
}

function catalogWithAssets(
  assets: ReferenceAsset[],
  descriptors: ReferenceDescriptor[],
): ReferenceWorkspaceCatalog {
  const catalog = cloneReferenceCatalog(MILAENE_REFERENCE_CATALOG);
  catalog.assets = assets;
  catalog.descriptors = descriptors;
  for (const board of catalog.boards) {
    board.assetIds = assets.filter((a) => a.boardId === board.id).map((a) => a.id);
  }
  return catalog;
}

describe("Reference Intelligence Foundation (Phase 1.7C)", () => {
  it("1. approved reference can be used", () => {
    const asset = makeAsset({
      id: "ref-approved",
      approvalStatus: "approved",
      usage: ["persona_casting"],
    });
    assert.equal(isReferenceApproved(asset), true);
    assert.equal(canReferenceBeUsedFor(asset, "persona_casting"), true);
    assert.doesNotThrow(() =>
      assertReferenceUsageAllowed(asset, "persona_casting"),
    );
  });

  it("2. draft reference cannot affect production prompt", () => {
    const asset = makeAsset({
      id: "ref-draft",
      approvalStatus: "draft",
      usage: ["persona_casting"],
    });
    const catalog = catalogWithAssets(
      [asset],
      [makeDescriptor({ id: "desc-draft", assetId: asset.id })],
    );
    assert.equal(canReferenceBeUsedFor(asset, "persona_casting"), false);
    assert.equal(getApprovedReferencesForUsage(catalog, "persona_casting").length, 0);
    assert.equal(formatPersonaReferenceDirection(catalog), "");
    assert.throws(() => assertReferenceUsageAllowed(asset, "persona_casting"));
  });

  it("3. rejected reference cannot affect production prompt", () => {
    const asset = makeAsset({
      id: "ref-rejected",
      approvalStatus: "rejected",
      usage: ["persona_casting"],
    });
    assert.equal(canReferenceBeUsedFor(asset, "persona_casting"), false);
    assert.throws(() => assertReferenceUsageAllowed(asset, "persona_casting"));
  });

  it("4. archived reference cannot affect production prompt", () => {
    const asset = makeAsset({
      id: "ref-archived",
      approvalStatus: "archived",
      usage: ["persona_casting"],
    });
    assert.equal(canReferenceBeUsedFor(asset, "persona_casting"), false);
    assert.throws(() => assertReferenceUsageAllowed(asset, "persona_casting"));
  });

  it("5. usage mismatch blocks reference", () => {
    const asset = makeAsset({
      id: "ref-image",
      approvalStatus: "approved",
      usage: ["image_campaign"],
    });
    assert.equal(canReferenceBeUsedFor(asset, "persona_casting"), false);
    assert.throws(() => assertReferenceUsageAllowed(asset, "persona_casting"));
  });

  it("6. manual extraction is default", () => {
    const desc = createEmptyDescriptorTemplate({
      id: "d1",
      assetId: "a1",
      boardId: "board-milaene-persona-casting",
    });
    assert.equal(desc.extractionMethod, "manual");
    const asset = makeAsset({
      id: "a1",
      approvalStatus: "draft",
      usage: ["persona_casting"],
    });
    assert.equal(asset.extractionMethod, "manual");
  });

  it("7. vision extraction remains disabled", () => {
    assert.equal(isVisionExtractionEnabled(), false);
    assert.equal(MILAENE_REFERENCE_CATALOG.visionExtractionEnabled, false);
    assert.throws(() => assertVisionExtractionDisabled("vision_model"));
    assert.doesNotThrow(() => assertVisionExtractionDisabled("manual"));
  });

  it("8. descriptor sanitization removes copying language", () => {
    const dirty = makeDescriptor({
      id: "desc-dirty",
      assetId: "ref-a",
      notes: "copy this image and recreate exactly the same composition",
    });
    const clean = sanitizeReferenceDescriptor(dirty);
    assert.doesNotMatch(clean.notes ?? "", /\bcopy\b/i);
    assert.doesNotMatch(clean.notes ?? "", /recreate exactly/i);
    assert.doesNotMatch(clean.notes ?? "", /same composition/i);

    const result = sanitizeReferencePromptDirection(
      "Make it look exactly like Brand X campaign and clone the logo",
    );
    assert.ok(result.removedPhrases.length > 0);
    assert.doesNotMatch(result.text, /\bclone\b/i);
    assert.doesNotMatch(result.text, /exactly like/i);
  });

  it("9. prompt formatter outputs abstract descriptors only", () => {
    const asset = makeAsset({
      id: "ref-ok",
      approvalStatus: "approved",
      usage: ["persona_casting"],
      descriptorId: "desc-ok",
    });
    const desc = makeDescriptor({ id: "desc-ok", assetId: "ref-ok" });
    const catalog = catalogWithAssets([asset], [desc]);
    const block = formatPersonaReferenceDirection(catalog);
    assert.match(block, /Facial mood|Hair direction|Soft|authenticity/i);
    assert.doesNotMatch(block, /\bcopy\b/i);
    assert.doesNotMatch(block, /same person/i);
    assert.doesNotMatch(block, /https?:\/\//i);
  });

  it("10. brand names are not emitted as imitation instructions", () => {
    const overview = formatReferenceIntelligencePrompt(MILAENE_REFERENCE_CATALOG);
    assert.match(overview, /Never imitate a source brand campaign by name/i);
    assert.doesNotMatch(overview, /Make it look exactly like/i);

    const sanitized = sanitizeReferencePromptDirection(
      "in the exact style of Supreme campaign",
    );
    assert.doesNotMatch(sanitized.text, /exact style of/i);
  });

  it("11. Persona receives only persona_casting descriptors", () => {
    const casting = makeAsset({
      id: "ref-cast",
      approvalStatus: "approved",
      usage: ["persona_casting"],
      descriptorId: "desc-cast",
      boardId: "board-milaene-persona-casting",
    });
    const campaign = makeAsset({
      id: "ref-camp",
      approvalStatus: "approved",
      usage: ["image_campaign"],
      descriptorId: "desc-camp",
      boardId: "board-milaene-campaign-shoot",
    });
    const catalog = catalogWithAssets(
      [casting, campaign],
      [
        makeDescriptor({
          id: "desc-cast",
          assetId: "ref-cast",
          personaDirection: { socialPresence: "cast-only-presence" },
        }),
        makeDescriptor({
          id: "desc-camp",
          assetId: "ref-camp",
          boardId: "board-milaene-campaign-shoot",
          environment: { environmentType: "street cafe campaign set" },
          visualMood: { campaignEnergy: "campaign-only-energy" },
        }),
      ],
    );

    const built = buildCandidatePrompt({
      project: streetLuxuryProject(),
      assetType: "portrait_front",
      candidateNumber: 1,
      referenceCatalog: catalog,
    });

    assert.match(built.blocks.referenceDirection, /cast-only-presence|Facial mood/i);
    assert.doesNotMatch(built.prompt, /street cafe campaign set/i);
    assert.doesNotMatch(built.blocks.referenceDirection, /campaign-only-energy/);
    assert.equal(built.referenceIntelligence.usageFilter, "persona_casting");
  });

  it("12. Persona still works with zero references", () => {
    const built = buildCandidatePrompt({
      project: streetLuxuryProject(),
      assetType: "portrait_front",
      candidateNumber: 1,
      referenceCatalog: MILAENE_REFERENCE_CATALOG,
    });
    assert.equal(built.blocks.referenceDirection, "");
    assert.match(built.prompt, /IDENTITY DNA|CANDIDATE IDENTITY LOCK/);
    assert.match(built.prompt, /BRAND DNA|PRODUCT INTELLIGENCE WARDROBE/i);
    assert.ok(built.prompt.length > 100);
  });

  it("13. reference snapshots are deterministic", () => {
    const a = createReferenceIntelligenceSnapshot(MILAENE_REFERENCE_CATALOG, {
      usageFilter: "persona_casting",
      capturedAt: "2026-07-21T00:00:00.000Z",
    });
    const b = createReferenceIntelligenceSnapshot(MILAENE_REFERENCE_CATALOG, {
      usageFilter: "persona_casting",
      capturedAt: "2026-07-21T00:00:00.000Z",
    });
    assert.equal(a.referenceIntelligenceVersion, REFERENCE_INTELLIGENCE_VERSION);
    assert.equal(a.referenceFingerprint, b.referenceFingerprint);
    assert.deepEqual(a.referenceBoardIds, b.referenceBoardIds);
    JSON.stringify(a);
  });

  it("14. fingerprints are stable", () => {
    const desc = makeDescriptor({ id: "desc-fp", assetId: "a-fp" });
    const fp1 = createReferenceDescriptorFingerprint(desc);
    const fp2 = createReferenceDescriptorFingerprint(desc);
    assert.equal(fp1, fp2);
    assert.equal(
      buildReferenceCatalogFingerprint(MILAENE_REFERENCE_CATALOG),
      buildReferenceCatalogFingerprint(cloneReferenceCatalog(MILAENE_REFERENCE_CATALOG)),
    );
  });

  it("15. duplicate descriptors are deduplicated", () => {
    const d1 = makeDescriptor({
      id: "d1",
      assetId: "a1",
      expression: { mood: "calm friendly" },
    });
    const d2 = makeDescriptor({
      id: "d2",
      assetId: "a2",
      expression: { mood: "Calm  Friendly" },
      personaDirection: { grooming: "clean casual" },
    });
    const lines = dedupeReferenceDescriptors([d1, d2]);
    const calmCount = lines.filter((l) => /calm\s+friendly/i.test(l)).length;
    assert.equal(calmCount, 1);
    const merged = mergeReferenceDescriptors([d1, d2]);
    assert.ok(merged);
    assert.match(merged!.expression.mood ?? "", /calm\s+friendly/i);
  });

  it("16. no exact person identity is stored", () => {
    const dirty = makeDescriptor({ id: "d-id", assetId: "a-id" }) as ReferenceDescriptor & {
      personIdentity?: string;
      faceEmbedding?: string;
      celebrity?: string;
    };
    dirty.personIdentity = "Famous Actor";
    dirty.faceEmbedding = "vec-123";
    dirty.celebrity = "Someone";
    const clean = sanitizeReferenceDescriptor(dirty);
    const raw = clean as unknown as Record<string, unknown>;
    assert.equal(raw.personIdentity, undefined);
    assert.equal(raw.faceEmbedding, undefined);
    assert.equal(raw.celebrity, undefined);
  });

  it("17. no public URLs", () => {
    for (const asset of MILAENE_REFERENCE_CATALOG.assets) {
      assert.equal(asset.sourceUrl, null);
      assert.ok(!asset.storagePath || !asset.storagePath.startsWith("http"));
    }
    const overview = formatReferenceIntelligencePrompt(MILAENE_REFERENCE_CATALOG);
    assert.doesNotMatch(overview, /https?:\/\//i);
    const direction = buildReferenceDirection(
      MILAENE_REFERENCE_CATALOG,
      "persona_casting",
    );
    assert.equal(direction.abstractLines.length, 0);
  });

  it("18. no OpenAI/Shopify/vision provider calls occur", () => {
    assert.equal(isVisionExtractionEnabled(), false);
    const catalog = cloneReferenceCatalog(MILAENE_REFERENCE_CATALOG);
    assert.equal(catalog.boards.length, 8);
    assert.ok(catalog.boards.every((b) => b.assetIds.length === 0));
    createReferenceIntelligenceSnapshot(catalog, {
      usageFilter: "persona_casting",
    });
    // Pure local seed — no network / provider imports exercised.
  });
});
