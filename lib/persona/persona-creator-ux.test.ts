/**
 * Persona Creator Phase 1.3 — presentation helpers (no backend).
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computeCastProgressView,
  computeCreatorCostPreview,
  computeLiveCastScores,
  isPersonaDefined,
  mockComparisonCandidates,
  type CreatorFormState,
} from "@/components/persona/persona-creator-ux";

const baseForm: CreatorFormState = {
  name: "Milaene Face I",
  brand_role: "primary_male",
  gender_presentation: "Male",
  age_range: "28-35",
  height_range: "180-188 cm",
  body_type: "Athletic lean",
  skin_tone_direction: "Light to medium olive",
  face_shape_direction: "Defined jaw",
  hair_direction: "Dark brown, short neat",
  facial_hair_direction: "Clean shaven",
  eye_direction: "Brown",
  expression_direction: "Quiet confidence",
  personality: "Reserved warmth",
  fashion_style: "Quiet luxury streetwear",
  preferred_brand_looks: "Quiet Luxury",
  preferred_outfits: "Black wide pants",
  excluded_features: "flashy jewelry",
  visual_keywords: "editorial, premium",
  intended_usage: "image_and_video",
  candidate_count: 4,
  provider_mode: "manual_upload",
  quality_mode: "premium_editorial",
  additional_description: "",
  description: "",
};

describe("Persona Creator Phase 1.3 UX helpers", () => {
  it("marks persona defined when core fields are set", () => {
    assert.equal(isPersonaDefined(baseForm), true);
    assert.equal(isPersonaDefined({ ...baseForm, name: "" }), false);
  });

  it("computes deterministic scores in 0–100", () => {
    const scores = computeLiveCastScores(baseForm);
    for (const value of Object.values(scores)) {
      assert.ok(value >= 0 && value <= 100);
    }
    const empty = computeLiveCastScores({
      ...baseForm,
      name: "",
      fashion_style: "",
      visual_keywords: "",
      preferred_brand_looks: "",
      expression_direction: "",
      personality: "",
      hair_direction: "",
      eye_direction: "",
      skin_tone_direction: "",
      age_range: "",
      height_range: "",
      body_type: "",
    });
    assert.ok(empty.consistency < scores.consistency);
  });

  it("previews zero cost for manual upload", () => {
    const preview = computeCreatorCostPreview(baseForm);
    assert.equal(preview.estimatedTotal, 0);
    assert.equal(preview.provider, "Manual");
  });

  it("previews provider cost without calling APIs", () => {
    const preview = computeCreatorCostPreview({
      ...baseForm,
      provider_mode: "image_provider",
      candidate_count: 4,
    });
    assert.ok(preview.estimatedMin > 0);
    assert.ok(preview.estimatedMax >= preview.estimatedMin);
    assert.equal(preview.provider, "OpenAI");
    assert.equal(preview.candidateCount, 4);
  });

  it("builds cast progress and comparison mockups without AI", () => {
    const progress = computeCastProgressView(baseForm);
    assert.equal(progress.currentMilestone, "Persona defined");
    assert.equal(progress.nextMilestone, "Candidates generated");
    assert.ok(progress.percent >= 14);

    const cards = mockComparisonCandidates(baseForm);
    assert.equal(cards.length, 4);
    assert.equal(cards[0]?.label, "Candidate A");
    for (const card of cards) {
      assert.ok(card.luxury >= 0 && card.luxury <= 100);
      assert.ok(card.realism >= 0 && card.realism <= 100);
    }
  });
});
