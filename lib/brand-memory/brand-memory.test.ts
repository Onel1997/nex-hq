import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BRAND_MEMORY_BY_SLUG,
  MILAENE_BRAND_MEMORY,
  formatBrandMemoryForPersona,
  formatBrandMemoryPrompt,
  formatBrandMemoryWardrobeForPersona,
  getBrandMemoryForSlug,
  loadBrandMemoryBySlug,
} from "./index";

describe("Brand Memory Engine (Phase 1.7A)", () => {
  it("exposes a strongly typed Milaene Brand Memory with all SSOT fields", () => {
    const m = MILAENE_BRAND_MEMORY;
    assert.equal(m.slug, "milaene");
    assert.equal(m.brandName, "Milaene");
    assert.ok(m.mission.length > 20);
    assert.ok(m.positioning.length > 20);
    assert.ok(m.targetAudience.includes("18"));
    assert.ok(m.productCategories.length >= 3);
    assert.ok(m.allowedProductTypes.length >= 3);
    assert.ok(m.forbiddenProductTypes.length >= 3);
    assert.ok(m.colorPalette.length >= 4);
    assert.ok(m.materials.length >= 2);
    assert.ok(m.fit.labels.includes("Oversized"));
    assert.ok(m.fit.labels.includes("Heavyweight"));
    assert.ok(m.visualIdentity.philosophy.length >= 3);
    assert.ok(m.toneOfVoice.traits.length >= 3);
    assert.ok(m.lifestyleKeywords.length >= 3);
    assert.ok(m.communityKeywords.length >= 3);
    assert.ok(m.photographyStyle.length > 20);
    assert.ok(m.campaignStyle.length > 20);
    assert.ok(m.editorialStyle.length > 20);
    assert.ok(m.socialStyle.length > 20);
    assert.ok(m.wardrobeBasics.some((w) => /tee|hoodie/i.test(w)));
    assert.ok(m.representationChannels.includes("Instagram"));
  });

  it("resolves by slug and falls back to Milaene", () => {
    assert.equal(getBrandMemoryForSlug("milaene").brandName, "Milaene");
    assert.equal(loadBrandMemoryBySlug("milaene").slug, "milaene");
    assert.equal(getBrandMemoryForSlug("unknown-brand").brandName, "Milaene");
    assert.ok("milaene" in BRAND_MEMORY_BY_SLUG);
  });

  it("formats a full prompt block for cross-studio consumption", () => {
    const block = formatBrandMemoryPrompt(MILAENE_BRAND_MEMORY);
    assert.match(block, /## BRAND MEMORY/);
    assert.match(block, /Brand:\nMilaene/);
    assert.match(block, /Mission:/);
    assert.match(block, /Color Palette:/);
    assert.match(block, /Photography Style:/);
    assert.match(block, /Campaign Style:/);
    assert.match(block, /Editorial Style:/);
    assert.match(block, /Social Style:/);
    assert.match(block, /Oversized/);
  });

  it("formats Persona brand DNA from Brand Memory without hardcoded brand copy", () => {
    const dna = formatBrandMemoryForPersona(MILAENE_BRAND_MEMORY, {
      lifestyleDirection: "Premium Streetwear Lifestyle Casting",
      brandRole: "primary_male",
    });
    assert.match(dna, /MILAENE PREMIUM STREETWEAR BRAND DNA/);
    assert.match(dna, /Instagram/);
    assert.match(dna, /TikTok/);
    assert.match(dna, /primary_male/);
    assert.match(dna, /magazine cover|luxury-fashion cast/i);

    const wardrobe = formatBrandMemoryWardrobeForPersona(MILAENE_BRAND_MEMORY, {
      candidateWardrobe: "washed black oversized tee",
      productWardrobeConstraints:
        "PRODUCT INTELLIGENCE WARDROBE:\nAllowed garments: oversized heavyweight tee, heavyweight hoodie.",
    });
    assert.match(wardrobe, /PRODUCT INTELLIGENCE WARDROBE/);
    assert.match(wardrobe, /heavyweight|tee|hoodie/i);
    assert.match(wardrobe, /Oversized/);
  });
});
