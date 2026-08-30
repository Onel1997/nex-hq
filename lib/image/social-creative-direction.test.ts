import assert from "node:assert/strict";
import test from "node:test";

import {
  CREATIVE_PRESET_QUALITY_DIRECTION,
  CREATIVE_PRESETS,
  createCreativeDirection,
  createSocialVariationPlan,
  creativeDirectionForSelection,
  creativeDirectionPromptLines,
  creativePresetsForShot,
  socialCreativeDirectionV1Schema,
  suggestControlledVariations,
  updateCreativeDirection,
} from "./social-creative-direction";
import { CONTENT_PACKS } from "./content-packs";

test("Social and Shopify expose deliberately distinct preset spaces", () => {
  const shot = "content:premium-flatlay";
  const social = creativePresetsForShot(shot, "SOCIAL_CONTENT");
  const shopify = creativePresetsForShot(shot, "SHOPIFY_MOCKUP");
  assert.ok(social.length > shopify.length);
  assert.deepEqual(
    shopify.map((item) => item.id),
    ["SHOPIFY_STANDARD", "SHOPIFY_ALTERNATE", "SHOPIFY_DETAIL"],
  );
  assert.ok(social.some((item) => item.id === "SOFT_FLATLAY"));
  assert.ok(social.some((item) => item.id === "SPORTS_PROPS"));
});

test("model shots receive model-compatible controlled variety", () => {
  const presets = creativePresetsForShot(
    "content:lifestyle-with-model",
    "SOCIAL_CONTENT",
  );
  assert.ok(presets.some((item) => item.id === "URBAN_STREET"));
  assert.ok(presets.some((item) => item.id === "PARKING_GARAGE"));
  assert.ok(presets.some((item) => item.id === "STADIUM"));
  assert.equal(presets.some((item) => item.id === "SOFT_FLATLAY"), false);
});

test("product-only shots do not receive model-only presentations", () => {
  const presets = creativePresetsForShot(
    "content:premium-flatlay",
    "SOCIAL_CONTENT",
  );
  assert.equal(presets.some((item) => item.id === "URBAN_STREET"), false);
  assert.ok(presets.every((item) => item.modelCompatibility !== "MODEL"));
});

test("smart defaults are shot-aware and provider-neutral", () => {
  const flatlay = createCreativeDirection({
    shotId: "content:premium-flatlay",
    contentMode: "SOCIAL_CONTENT",
  });
  assert.equal(flatlay.presetId, "SOFT_FLATLAY");
  assert.equal(flatlay.camera.angle, "OVERHEAD");
  assert.equal(flatlay.productPresentation, "FLATLAY");

  const hero = createCreativeDirection({
    shotId: "content:social-hero-story",
    contentMode: "SOCIAL_CONTENT",
  });
  assert.equal(hero.presetId, "PARKING_GARAGE");
  assert.equal(hero.aspectIntent, "9:16");
});

test("canonical shot changes resolve a complete direction synchronously without an empty flicker state", () => {
  const first = creativeDirectionForSelection({
    direction: null,
    shotId: "content:lifestyle-with-model",
    contentMode: "SOCIAL_CONTENT",
  });
  assert.ok(first);
  const retained = creativeDirectionForSelection({
    direction: first,
    shotId: "content:lifestyle-with-model",
    contentMode: "SOCIAL_CONTENT",
  });
  assert.equal(retained, first);
  const changed = creativeDirectionForSelection({
    direction: first,
    shotId: "content:premium-flatlay",
    contentMode: "SOCIAL_CONTENT",
  });
  assert.equal(changed?.shotType, "content:premium-flatlay");
  assert.equal(changed?.presetId, "SOFT_FLATLAY");
});

test("owner adjustments remain runtime-validated structured direction", () => {
  const initial = createCreativeDirection({
    shotId: "content:lifestyle-with-model",
    contentMode: "SOCIAL_CONTENT",
  });
  const adjusted = updateCreativeDirection(initial, {
    sceneType: "STADIUM",
    locationType: "STADIUM",
    lighting: "WARM_EVENING",
    camera: { framing: "PORTRAIT", angle: "LOW_ANGLE" },
    mood: "CINEMATIC",
  });
  assert.equal(adjusted.source, "OWNER_ADJUSTED");
  assert.equal(
    socialCreativeDirectionV1Schema.parse(adjusted).sceneType,
    "STADIUM",
  );
});

test("variation plan creates zero jobs and preserves manual single-asset execution", () => {
  const shotId = "content:lifestyle-with-model";
  const directions = ["URBAN_STREET", "PARKING_GARAGE", "STADIUM"].map(
    (presetId) =>
      createCreativeDirection({
        shotId,
        contentMode: "SOCIAL_CONTENT",
        presetId: presetId as
          | "URBAN_STREET"
          | "PARKING_GARAGE"
          | "STADIUM",
        source: "OWNER_SELECTED",
      }),
  );
  const plan = createSocialVariationPlan(shotId, directions);
  assert.equal(plan.entries.length, 3);
  assert.equal(plan.automaticJobCount, 0);
  assert.equal(plan.executionPolicy, "MANUAL_SINGLE_ASSET_ONLY");
});

test("anti-repetition suggestions prefer unused scenes and locations", () => {
  const recent = [
    createCreativeDirection({
      shotId: "content:lifestyle-with-model",
      contentMode: "SOCIAL_CONTENT",
      presetId: "URBAN_STREET",
    }),
  ];
  const suggestions = suggestControlledVariations({
    shotId: "content:lifestyle-with-model",
    recent,
    limit: 4,
  });
  assert.notEqual(suggestions[0]?.id, "URBAN_STREET");
  assert.ok(suggestions.some((item) => item.id === "PARKING_GARAGE"));
});

test("Stage A prompt projection contains creative axes and forbids artwork recreation", () => {
  const direction = createCreativeDirection({
    shotId: "content:lifestyle-with-model",
    contentMode: "SOCIAL_CONTENT",
    presetId: "PARKING_GARAGE",
  });
  const prompt = creativeDirectionPromptLines(direction).join(" ");
  assert.match(prompt, /PARKING_GARAGE/);
  assert.match(prompt, /COOL_URBAN/);
  assert.match(prompt, /premium commercial fashion photography/i);
  assert.match(prompt, /clean modern architectural parking structure/i);
  assert.doesNotMatch(prompt, /checksum|artworkId|Master Artwork pixels/i);
});

test("key Social presets carry explicit premium, uncluttered provider direction", () => {
  const required = [
    "CLEAN_STUDIO",
    "EDITORIAL_STUDIO",
    "URBAN_STREET",
    "PARKING_GARAGE",
    "STADIUM",
    "MINIMAL_INTERIOR",
    "PREMIUM_INTERIOR",
  ] as const;
  for (const presetId of required) {
    const value = CREATIVE_PRESET_QUALITY_DIRECTION[presetId];
    assert.match(value, /premium|high-end/i, presetId);
    assert.match(value, /clean|refined|controlled|intentional/i, presetId);
  }
  assert.match(
    CREATIVE_PRESET_QUALITY_DIRECTION.URBAN_STREET,
    /well-maintained contemporary city setting/i,
  );
  assert.match(
    CREATIVE_PRESET_QUALITY_DIRECTION.URBAN_STREET,
    /never be inferred from the model's identity or ethnicity/i,
  );
  assert.match(
    CREATIVE_PRESET_QUALITY_DIRECTION.URBAN_STREET,
    /No derelict surroundings, grime, graffiti, clutter, random signage/i,
  );
});

test("Base Pack remains five slots and Winning Expansion remains broad", () => {
  assert.equal(CONTENT_PACKS.BASE.shotIds.length, 5);
  assert.equal(CONTENT_PACKS.WINNING_EXPANSION.shotIds.length, 15);
  assert.ok(CREATIVE_PRESETS.length >= 12);
});
