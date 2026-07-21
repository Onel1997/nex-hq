import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PersonaCreationProject } from "./domain/creation-types";
import { STAGE_A_ASSET_TYPES } from "./domain/creation-types";
import { getCreationPreset, PERSONA_CREATION_PRESETS } from "./creation/presets";
import {
  ACTIVE_CASTING_POOL,
  FUTURE_CASTING_POOL_PRESETS,
  assertCandidateIdentityDiversity,
  assessCandidateQuality,
  auditCandidateIdentityDiversity,
  buildCandidatePrompt,
  buildCastingRecommendation,
  buildDiversityReport,
  CANDIDATE_VARIATION_PROFILES,
  fingerprintDistance,
  qualityFieldsForCandidate,
  rankCandidatesByCommercialScore,
  resolveCandidateVariation,
  resolveCastingGenerateCount,
  selectTopCandidatesForDisplay,
  variationFingerprint,
} from "./creation/candidate-intelligence";
import type { CandidateVariationProfile } from "./creation/candidate-intelligence";

function streetLuxuryProject(
  overrides: Partial<PersonaCreationProject> = {},
): PersonaCreationProject {
  const preset = getCreationPreset("milaene_street_luxury")!;
  return {
    id: "proj-street-1",
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
    ...overrides,
  };
}

function fashionWeekVariation(): CandidateVariationProfile {
  const base = resolveCandidateVariation(1);
  return {
    ...base,
    id: "fashion_week_clone",
    label: "Fashion Week Clone",
    style: "high fashion editorial",
    identityDescriptor:
      "Runway fashion week model with Vogue magazine cover energy and aggressive CEO presence",
    expression: "intimidating editorial intensity, fashion week scowl",
    presence: "catwalk high-fashion corporate magazine cover",
    socialPresence: "catwalk high-fashion corporate magazine cover",
    wardrobe: "sharp runway suit, fashion week styling",
    aesthetic: "Vogue fashion week runway editorial",
    posture: "aggressive catwalk stance",
    promptLines: [
      "Fashion week runway energy",
      "Vogue magazine cover pose",
      "High-fashion editorial intensity",
    ],
  };
}

const AGGRESSIVE_PROMPT_TERMS =
  /\b(rebel|intimidating|intense|severe|dominant|hard authority|confrontational|dangerous|sharp fashion face|aggressive confidence|piercing stare|runway|fashion week|high-fashion intensity)\b/i;

describe("Milaene premium streetwear lifestyle casting", () => {
  it("exposes milaene_street_luxury preset without removing legacy presets", () => {
    const street = getCreationPreset("milaene_street_luxury");
    assert.ok(street);
    assert.equal(street!.brand_role, "primary_male");
    assert.equal(street!.candidate_count, 4);
    assert.equal(street!.intended_usage, "image_and_video");
    assert.match(street!.fashion_style, /Premium Streetwear Lifestyle Casting/i);
    assert.match(street!.age_range, /23/);
    assert.match(street!.excluded_features, /fashion week|CEO|runway/i);
    assert.ok(PERSONA_CREATION_PRESETS.some((p) => p.id === "primary_male_quiet_luxury"));
    assert.ok(PERSONA_CREATION_PRESETS.some((p) => p.id === "secondary_male_street_editorial"));
    assert.ok(PERSONA_CREATION_PRESETS.some((p) => p.id === "primary_female_minimal_editorial"));
  });

  it("uses four distinct lifestyle identities with unique descriptors", () => {
    const ids = [1, 2, 3, 4].map((n) => resolveCandidateVariation(n).id);
    assert.deepEqual(ids, [
      "relaxed_mediterranean",
      "modern_creator",
      "clean_street_athletic",
      "weekend_community",
    ]);

    const descriptors = [1, 2, 3, 4].map(
      (n) => resolveCandidateVariation(n).identityDescriptor,
    );
    assert.equal(new Set(descriptors).size, 4);
    assert.equal(
      new Set([1, 2, 3, 4].map((n) => variationFingerprint(resolveCandidateVariation(n)))).size,
      4,
    );
  });

  it("keeps identity lock per candidate across Stage A angles", () => {
    const project = streetLuxuryProject();
    const c1Front = buildCandidatePrompt({
      project,
      assetType: "portrait_front",
      candidateNumber: 1,
    });
    const c1Half = buildCandidatePrompt({
      project,
      assetType: "half_body",
      candidateNumber: 1,
    });
    const c1Three = buildCandidatePrompt({
      project,
      assetType: "portrait_three_quarter",
      candidateNumber: 1,
    });
    const c2Front = buildCandidatePrompt({
      project,
      assetType: "portrait_front",
      candidateNumber: 2,
    });

    assert.equal(c1Front.identityLock, c1Half.identityLock);
    assert.equal(c1Front.identityLock, c1Three.identityLock);
    assert.match(c1Front.identityLock, /Candidate 1 only/);
    assert.match(c1Front.identityLock, /Relaxed Mediterranean/);
    assert.notEqual(c1Front.identityLock, c2Front.identityLock);

    const locks = [1, 2, 3, 4].map(
      (n) =>
        buildCandidatePrompt({
          project,
          assetType: "portrait_front",
          candidateNumber: n,
        }).identityLock,
    );
    assert.equal(new Set(locks).size, 4);
  });

  it("prioritizes identity lock before brand DNA and editorial support", () => {
    const project = streetLuxuryProject();
    const built = buildCandidatePrompt({
      project,
      assetType: "portrait_front",
      candidateNumber: 1,
    });

    const identityIdx = built.prompt.indexOf("CANDIDATE IDENTITY LOCK");
    const appearanceIdx = built.prompt.indexOf("AUTHENTIC HUMAN APPEARANCE");
    const presenceIdx = built.prompt.indexOf("CALM / FRIENDLY COMMERCIAL PRESENCE");
    const brandIdx = built.prompt.indexOf("BRAND DNA");
    const wardrobeIdx = built.prompt.indexOf("WARDROBE AND FIT");
    const cameraIdx = built.prompt.indexOf("CAMERA");
    const envIdx = built.prompt.indexOf("CONTROLLED NEUTRAL CASTING ENVIRONMENT");
    const editorialIdx = built.prompt.indexOf("EDITORIAL SUPPORT");

    assert.ok(identityIdx >= 0 && identityIdx < appearanceIdx);
    assert.ok(appearanceIdx < presenceIdx);
    assert.ok(presenceIdx < brandIdx);
    assert.ok(brandIdx < wardrobeIdx);
    assert.ok(wardrobeIdx < cameraIdx);
    assert.ok(cameraIdx < envIdx);
    assert.ok(envIdx < editorialIdx);

    assert.match(built.prompt, /streetwear/i);
    assert.match(built.prompt, /Instagram|TikTok/i);
    assert.match(built.prompt, /magazine cover|luxury-fashion cast|classic fashion model/i);
    assert.match(built.negativePrompt, /fashion week|runway|CEO portrait|intimidating stare/i);
    assert.match(built.blocks.wardrobe, /heavyweight|tee|hoodie/i);
    assert.match(built.blocks.lighting, /plaster|studio|concrete|daylight/i);
  });

  it("encodes calm authentic presence without a shared olive face recipe", () => {
    const project = streetLuxuryProject();
    const tones = new Set<string>();
    for (const n of [1, 2, 3, 4]) {
      const built = buildCandidatePrompt({
        project,
        assetType: "portrait_front",
        candidateNumber: n,
      });
      tones.add(built.variation.skinTone);
      assert.match(built.prompt, /friendly|approachable|authentic|relaxed|calm/i);
      assert.match(built.prompt, /DIFFERENT/i);
      assert.match(
        built.variation.expression,
        /friendly|calm|warm|easy|relaxed|soft|quiet/i,
      );
      assert.doesNotMatch(built.identityLock, AGGRESSIVE_PROMPT_TERMS);
      assert.match(built.prompt, /pores|skin texture|asymmetry/i);
    }
    assert.equal(tones.size, 4);
    assert.match(resolveCandidateVariation(4).skinTone, /deep brown|dark skin/i);
    assert.doesNotMatch(resolveCandidateVariation(4).faceGeometry, /oval-rectangle/i);
  });

  it("scores authenticity heavily and keeps cast diversity healthy", () => {
    const project = streetLuxuryProject();
    const lifestyle = assessCandidateQuality({
      project,
      variation: resolveCandidateVariation(1),
      assetTypes: ["portrait_front", "portrait_three_quarter", "half_body"],
    });
    assert.ok(lifestyle.dimensions.authenticity >= 60);
    assert.ok(lifestyle.dimensions.lifestyleFit >= 55);
    assert.ok(lifestyle.dimensions.streetwearMatch >= 55);
    assert.ok(lifestyle.dimensions.overall >= 50);
    assert.ok(lifestyle.dimensions.editorialQuality < lifestyle.dimensions.authenticity);
    assert.ok(
      qualityFieldsForCandidate(lifestyle).visual_strengths.includes("Relaxed Mediterranean") ||
        qualityFieldsForCandidate(lifestyle).visual_strengths.includes("Casting role"),
    );

    const report = buildDiversityReport({ candidateNumbers: [1, 2, 3, 4] });
    assert.equal(report.lowDiversity, false);
    assert.ok(
      fingerprintDistance(
        variationFingerprint(resolveCandidateVariation(1)),
        variationFingerprint(resolveCandidateVariation(2)),
      ) >= 35,
    );
  });
});

describe("Phase 1.6A candidate identity diversity & Stage A direction", () => {
  it("asserts four biologically distinct identity profiles", () => {
    assert.doesNotThrow(() => assertCandidateIdentityDiversity());
    const audit = auditCandidateIdentityDiversity();
    assert.equal(audit.ok, true);
    assert.equal(audit.violations.length, 0);
    assert.equal(audit.profileCount, 4);

    const geometries = CANDIDATE_VARIATION_PROFILES.map((p) => p.faceGeometry);
    const jaws = CANDIDATE_VARIATION_PROFILES.map((p) => p.jawShape);
    const noses = CANDIDATE_VARIATION_PROFILES.map((p) => p.noseShape);
    const eyes = CANDIDATE_VARIATION_PROFILES.map((p) => p.eyeShape);
    const hairs = CANDIDATE_VARIATION_PROFILES.map(
      (p) => `${p.hairTexture}|${p.haircut}`,
    );
    const skins = CANDIDATE_VARIATION_PROFILES.map((p) => p.skinTone);

    assert.equal(new Set(geometries).size, 4);
    assert.equal(new Set(jaws).size, 4);
    assert.equal(new Set(noses).size, 4);
    assert.equal(new Set(eyes).size, 4);
    assert.equal(new Set(hairs).size, 4);
    assert.equal(new Set(skins).size, 4);

    const c1 = resolveCandidateVariation(1);
    const c4 = resolveCandidateVariation(4);
    assert.notEqual(c1.faceGeometry, c4.faceGeometry);
    assert.notEqual(c1.jawShape, c4.jawShape);
    assert.notEqual(c1.haircut, c4.haircut);
    assert.notEqual(c1.hairTexture, c4.hairTexture);
    assert.match(c4.identityDescriptor, /Afro-European|mixed-heritage|deep brown|community/i);
  });

  it("fails diversity audit when critical keys collide", () => {
    const clone = {
      ...resolveCandidateVariation(2),
      id: "clone_of_1",
      identityDescriptor: resolveCandidateVariation(1).identityDescriptor,
      faceGeometry: resolveCandidateVariation(1).faceGeometry,
      skinTone: resolveCandidateVariation(1).skinTone,
      hairTexture: resolveCandidateVariation(1).hairTexture,
      haircut: resolveCandidateVariation(1).haircut,
      jawShape: resolveCandidateVariation(1).jawShape,
      noseShape: resolveCandidateVariation(1).noseShape,
      eyeShape: resolveCandidateVariation(1).eyeShape,
    };
    const audit = auditCandidateIdentityDiversity([
      resolveCandidateVariation(1),
      clone,
    ]);
    assert.equal(audit.ok, false);
    assert.ok(audit.violations.some((v) => v.code === "duplicate_identity_descriptor"));
    assert.ok(audit.violations.some((v) => v.code === "duplicate_face_geometry"));
    assert.throws(() =>
      assertCandidateIdentityDiversity([resolveCandidateVariation(1), clone]),
    );
  });

  it("keeps Stage A at exactly three controlled casting assets", () => {
    assert.deepEqual(STAGE_A_ASSET_TYPES, [
      "portrait_front",
      "portrait_three_quarter",
      "half_body",
    ]);
    const project = streetLuxuryProject();
    const front = buildCandidatePrompt({
      project,
      assetType: "portrait_front",
      candidateNumber: 1,
    });
    const three = buildCandidatePrompt({
      project,
      assetType: "portrait_three_quarter",
      candidateNumber: 1,
    });
    const half = buildCandidatePrompt({
      project,
      assetType: "half_body",
      candidateNumber: 1,
    });

    assert.match(front.blocks.camera, /Front Portrait/i);
    assert.match(three.blocks.camera, /30–45|three quarter/i);
    assert.match(half.blocks.camera, /Half Body|streetwear fit/i);
    assert.match(front.variation.background, /warm grey plaster|controlled casting/i);
    assert.doesNotMatch(front.variation.background, /cafe|parking|clothing rack|street scene/i);
    assert.doesNotMatch(front.variation.aesthetic, /campaign shoot|lookbook location/i);
    assert.match(half.blocks.camera, /never runway|never.*military|Natural shoulder/i);
  });

  it("uses candidate-specific wardrobe and backgrounds without campaign locations", () => {
    const wardrobes = CANDIDATE_VARIATION_PROFILES.map((p) => p.wardrobe);
    const backgrounds = CANDIDATE_VARIATION_PROFILES.map((p) => p.background);
    assert.equal(new Set(wardrobes).size, 4);
    assert.equal(new Set(backgrounds).size, 4);
    assert.match(wardrobes[0]!, /tee|hoodie/i);
    assert.match(wardrobes[1]!, /hoodie|tee/i);
    assert.match(wardrobes[2]!, /tee/i);
    assert.match(wardrobes[3]!, /off-white|grey|hoodie|tee/i);
    assert.match(backgrounds[0]!, /plaster|grey/i);
    assert.match(backgrounds[1]!, /charcoal|studio/i);
    assert.match(backgrounds[2]!, /concrete/i);
    assert.match(backgrounds[3]!, /off-white|daylight/i);
    for (const bg of backgrounds) {
      assert.doesNotMatch(bg, /street|cafe|parking|shop|car/i);
    }
  });

  it("removes aggressive and high-fashion direction from active casting prompts", () => {
    const project = streetLuxuryProject();
    for (const n of [1, 2, 3, 4]) {
      const built = buildCandidatePrompt({
        project,
        assetType: "portrait_front",
        candidateNumber: n,
      });
      assert.doesNotMatch(built.prompt, /\brebel\b/i);
      assert.doesNotMatch(built.prompt, /\bpiercing stare\b/i);
      assert.doesNotMatch(built.prompt, /\bhard authority\b/i);
      assert.doesNotMatch(built.prompt, /\bCEO portrait\b/i);
      assert.match(built.prompt, /relaxed confidence|approachable|quiet (self-assurance|confidence)|friendly eyes|soft neutral/i);
      assert.match(
        built.negativePrompt,
        /aggressive expression|intimidating stare|gangster styling|generic AI face|identical beige background/,
      );
    }
  });
});

describe("Commercial Brand Casting Intelligence", () => {
  it("exposes commercial face dimensions and agency casting metadata", () => {
    const project = streetLuxuryProject();
    const assessment = assessCandidateQuality({
      project,
      variation: resolveCandidateVariation(1),
      assetTypes: ["portrait_front", "portrait_three_quarter", "half_body"],
    });

    assert.equal(assessment.method, "rule_based_brief_fit_v1");
    assert.ok(typeof assessment.briefFit === "number");
    assert.equal(assessment.briefFit, assessment.dimensions.overall);
    assert.equal(assessment.visualEvaluation.status, "not_performed");
    assert.ok(typeof assessment.dimensions.commercialFace === "number");
    assert.ok(typeof assessment.dimensions.brandRecall === "number");
    assert.ok(typeof assessment.dimensions.memorability === "number");
    assert.ok(typeof assessment.dimensions.premiumPresence === "number");
    assert.ok(typeof assessment.dimensions.campaignVersatility === "number");
    assert.ok(typeof assessment.dimensions.eyeContact === "number");
    assert.ok(typeof assessment.dimensions.facialBalance === "number");
    assert.ok(typeof assessment.dimensions.lifestyleAuthenticity === "number");
    assert.equal(
      assessment.dimensions.commercialFace,
      assessment.dimensions.commercialQuality,
    );
    assert.equal(
      assessment.dimensions.authenticity,
      assessment.dimensions.lifestyleAuthenticity,
    );
    assert.ok(assessment.casting.bestFor.length >= 3);
    assert.ok(assessment.casting.primaryUse);
    assert.ok(assessment.strengths.length >= 1);
  });

  it("weights commercial face and streetwear over editorial beauty", () => {
    const project = streetLuxuryProject();
    const street = assessCandidateQuality({
      project,
      variation: resolveCandidateVariation(1),
      assetTypes: ["portrait_front", "portrait_three_quarter", "half_body"],
    });
    const fashion = assessCandidateQuality({
      project,
      variation: fashionWeekVariation(),
      assetTypes: ["portrait_front", "portrait_three_quarter", "half_body"],
    });

    assert.ok(
      street.dimensions.overall > fashion.dimensions.overall,
      `street overall ${street.dimensions.overall} should beat fashion ${fashion.dimensions.overall}`,
    );
    assert.ok(street.dimensions.streetwearMatch > fashion.dimensions.streetwearMatch);
    assert.ok(street.dimensions.authenticity > fashion.dimensions.authenticity);
    assert.ok(
      fashion.risks.some(
        (r) =>
          /fashion-week|too aggressive|too mature|authenticity|editorial/i.test(r),
      ),
    );
  });

  it("ranks candidates by commercial overall and marks recommended brand face", () => {
    const project = streetLuxuryProject();
    const scored = [1, 2, 3, 4].map((n) => {
      const assessment = assessCandidateQuality({
        project,
        variation: resolveCandidateVariation(n),
        assetTypes: ["portrait_front", "portrait_three_quarter", "half_body"],
      });
      return {
        id: `c-${n}`,
        candidate_number: n,
        overallScore: assessment.dimensions.overall,
        commercialFace: assessment.dimensions.commercialFace,
        streetwearMatch: assessment.dimensions.streetwearMatch,
        authenticity: assessment.dimensions.authenticity,
      };
    });

    const ranked = rankCandidatesByCommercialScore(scored);
    assert.equal(ranked.length, 4);
    assert.equal(ranked[0]!.rank, 1);
    assert.equal(ranked[0]!.isRecommendedBrandFace, true);
    assert.equal(ranked[1]!.isRecommendedBrandFace, false);
    for (let i = 1; i < ranked.length; i += 1) {
      assert.ok(ranked[i - 1]!.overallScore >= ranked[i]!.overallScore);
    }
  });

  it("builds casting recommendations with agency channels", () => {
    const project = streetLuxuryProject();
    const assessment = assessCandidateQuality({
      project,
      variation: resolveCandidateVariation(1),
      assetTypes: ["portrait_front", "portrait_three_quarter", "half_body"],
    });
    const rec = buildCastingRecommendation(assessment.dimensions);
    const allowed = new Set([
      "Social Media",
      "Website",
      "Paid Ads",
      "Product Mockups",
      "Lookbooks",
      "Campaign Videos",
      "Email Marketing",
      "Homepage Hero",
      "Brand Ambassador",
    ]);
    assert.ok(rec.bestFor.every((c) => allowed.has(c)));
    assert.ok(allowed.has(rec.primaryUse));
  });

  it("keeps casting pool architecture inactive at 4-of-4", () => {
    assert.equal(ACTIVE_CASTING_POOL.mode, "generate_all_visible");
    assert.equal(ACTIVE_CASTING_POOL.generateCount, 4);
    assert.equal(ACTIVE_CASTING_POOL.displayCount, 4);
    assert.equal(resolveCastingGenerateCount(4), 4);
    assert.equal(resolveCastingGenerateCount(4, ACTIVE_CASTING_POOL), 4);

    const pool = Array.from({ length: 20 }, (_, i) => ({
      id: `p-${i + 1}`,
      candidate_number: i + 1,
      overallScore: 90 - i,
    }));

    const active = selectTopCandidatesForDisplay(pool, ACTIVE_CASTING_POOL);
    assert.equal(active.length, 20);

    const future = selectTopCandidatesForDisplay(
      pool,
      FUTURE_CASTING_POOL_PRESETS.generate_20_show_5,
    );
    assert.equal(future.length, 5);
    assert.equal(future[0]!.isRecommendedBrandFace, true);
    assert.equal(future[0]!.overallScore, 90);
    assert.equal(
      resolveCastingGenerateCount(4, FUTURE_CASTING_POOL_PRESETS.generate_40_show_5),
      40,
    );
  });
});
