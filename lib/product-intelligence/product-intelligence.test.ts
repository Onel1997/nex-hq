import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildCandidatePrompt } from "@/lib/persona/creation/candidate-intelligence/prompt-builder";
import { getCreationPreset } from "@/lib/persona/creation/presets";
import type { PersonaCreationProject } from "@/lib/persona/domain/creation-types";
import {
  MILAENE_PRODUCT_CATALOG,
  PRODUCT_INTELLIGENCE_VERSION,
  PRODUCT_SOURCE_PRIORITY,
  ShopifyProductCatalogProvider,
  assertRequestedProductExists,
  assertRequestedVariantExists,
  buildCatalogContentFingerprint,
  buildProductGenerationConstraints,
  createProductIntelligenceSnapshot,
  formatProductConstraintsPrompt,
  formatProductIntelligencePrompt,
  formatProductWardrobeConstraintsForPersona,
  getAllowedProductTypes,
  getForbiddenProductTypes,
  getHeroProducts,
  isColorAllowedForProduct,
  isProductGenerationEligible,
  isProductTypeAllowed,
  isVariantAvailable,
  mergeProductCatalogs,
  resolveProductCatalog,
  resolveProductCatalogSeedOnly,
  type Product,
  type ProductCatalog,
} from "./index";

function streetLuxuryProject(): PersonaCreationProject {
  const preset = getCreationPreset("milaene_street_luxury")!;
  return {
    id: "proj-pi-1",
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

describe("Product Intelligence Engine (Phase 1.7B)", () => {
  it("1. allows existing product types", () => {
    assert.equal(
      isProductTypeAllowed(MILAENE_PRODUCT_CATALOG, "oversized heavyweight tee"),
      true,
    );
    assert.equal(
      isProductTypeAllowed(MILAENE_PRODUCT_CATALOG, "heavyweight hoodie"),
      true,
    );
    assert.equal(
      isProductTypeAllowed(MILAENE_PRODUCT_CATALOG, "zip hoodie"),
      true,
    );
    assert.ok(
      getAllowedProductTypes(MILAENE_PRODUCT_CATALOG).includes(
        "oversized heavyweight tee",
      ),
    );
  });

  it("2. rejects missing product types", () => {
    assert.equal(
      isProductTypeAllowed(MILAENE_PRODUCT_CATALOG, "cargo pants"),
      false,
    );
    assert.equal(
      isProductTypeAllowed(MILAENE_PRODUCT_CATALOG, "structured cap"),
      false,
    );
  });

  it("3. rejects cap generation when no cap exists", () => {
    assert.equal(isProductTypeAllowed(MILAENE_PRODUCT_CATALOG, "cap"), false);
    assert.ok(
      getForbiddenProductTypes(MILAENE_PRODUCT_CATALOG).some((t) =>
        /cap/i.test(t),
      ),
    );
    assert.ok(
      MILAENE_PRODUCT_CATALOG.forbiddenCategories.includes("caps"),
    );
    assert.ok(
      !MILAENE_PRODUCT_CATALOG.products.some(
        (p) => p.category === "caps" && isProductGenerationEligible(p),
      ),
    );
  });

  it("4. rejects jacket generation when no jacket exists", () => {
    assert.equal(
      isProductTypeAllowed(MILAENE_PRODUCT_CATALOG, "jacket"),
      false,
    );
    assert.ok(
      MILAENE_PRODUCT_CATALOG.forbiddenCategories.includes("jackets"),
    );
  });

  it("5. accepts valid product colors", () => {
    assert.equal(
      isColorAllowedForProduct(
        MILAENE_PRODUCT_CATALOG,
        "milaene-oversized-heavyweight-tee",
        "washed black",
      ),
      true,
    );
    assert.equal(
      isColorAllowedForProduct(
        MILAENE_PRODUCT_CATALOG,
        "milaene-heavyweight-hoodie",
        "muted taupe",
      ),
      true,
    );
  });

  it("6. rejects invalid product colors", () => {
    assert.equal(
      isColorAllowedForProduct(
        MILAENE_PRODUCT_CATALOG,
        "milaene-oversized-heavyweight-tee",
        "neon pink",
      ),
      false,
    );
    assert.equal(
      isColorAllowedForProduct(
        MILAENE_PRODUCT_CATALOG,
        "milaene-oversized-heavyweight-tee",
        "signal green",
      ),
      false,
    );
  });

  it("7. inactive products are not generation-eligible", () => {
    const inactive = MILAENE_PRODUCT_CATALOG.products.find(
      (p) => p.id === "milaene-archived-draft-tee",
    );
    assert.ok(inactive);
    assert.equal(isProductGenerationEligible(inactive!), false);
    assert.equal(
      isProductTypeAllowed(MILAENE_PRODUCT_CATALOG, "classic tee"),
      false,
    );
  });

  it("8. returns hero products correctly", () => {
    const heroes = getHeroProducts(MILAENE_PRODUCT_CATALOG);
    assert.equal(heroes.length, 2);
    assert.deepEqual(
      heroes.map((h) => h.id).sort(),
      [
        "milaene-heavyweight-hoodie",
        "milaene-oversized-heavyweight-tee",
      ].sort(),
    );
  });

  it("9. prompt constraints contain allowed products and forbidden categories", () => {
    const full = formatProductIntelligencePrompt(MILAENE_PRODUCT_CATALOG);
    const constraints = formatProductConstraintsPrompt(MILAENE_PRODUCT_CATALOG);
    assert.match(full, /oversized heavyweight tee/i);
    assert.match(full, /heavyweight hoodie/i);
    assert.match(full, /zip hoodie/i);
    assert.match(full, /Forbidden Categories:/);
    assert.match(full, /caps/);
    assert.match(full, /jackets/);
    assert.match(full, /Never invent/i);
    assert.match(constraints, /Allowed Product Types:/);
    assert.match(constraints, /Forbidden Categories:/);
    assert.match(constraints, /caps/);
  });

  it("10. product snapshot is deterministic and versioned", () => {
    const a = createProductIntelligenceSnapshot(MILAENE_PRODUCT_CATALOG, {
      capturedAt: "2026-07-21T00:00:00.000Z",
    });
    const b = createProductIntelligenceSnapshot(MILAENE_PRODUCT_CATALOG, {
      capturedAt: "2026-07-21T00:00:00.000Z",
    });
    assert.equal(a.productIntelligenceVersion, PRODUCT_INTELLIGENCE_VERSION);
    assert.equal(a.catalogVersion, MILAENE_PRODUCT_CATALOG.version);
    assert.equal(a.productConstraintSource, "seed");
    assert.equal(a.contentFingerprint, b.contentFingerprint);
    assert.equal(
      a.contentFingerprint,
      buildCatalogContentFingerprint(MILAENE_PRODUCT_CATALOG),
    );
    assert.ok(a.selectedProductIds);
    assert.ok(a.selectedVariantIds);
    assert.deepEqual(a.heroProductIds.sort(), b.heroProductIds.sort());
  });

  it("11. Persona wardrobe constraints consume Product Intelligence without duplicating catalog truth", () => {
    const built = buildCandidatePrompt({
      project: streetLuxuryProject(),
      assetType: "portrait_front",
      candidateNumber: 1,
      productCatalog: MILAENE_PRODUCT_CATALOG,
    });

    assert.match(
      built.blocks.wardrobe,
      /PRODUCT INTELLIGENCE WARDROBE/,
    );
    assert.match(built.blocks.wardrobe, /oversized heavyweight tee/i);
    assert.match(built.blocks.wardrobe, /heavyweight hoodie/i);
    assert.match(built.blocks.wardrobe, /zip hoodie/i);
    assert.match(built.blocks.wardrobe, /Forbidden categories:/);
    assert.match(built.blocks.wardrobe, /caps/);
    // Brand Memory wardrobeBasics must not be the catalog SSOT in wardrobe
    assert.doesNotMatch(
      built.blocks.wardrobe,
      /Allowed family: washed black \/ charcoal/,
    );
    assert.equal(
      built.productIntelligence.productIntelligenceVersion,
      PRODUCT_INTELLIGENCE_VERSION,
    );
    assert.equal(built.productIntelligence.productConstraintSource, "seed");

    const piWardrobe =
      formatProductWardrobeConstraintsForPersona(MILAENE_PRODUCT_CATALOG);
    assert.match(piWardrobe, /Stage A casting/);
    assert.doesNotMatch(piWardrobe, /\bSKU\b/);
  });

  it("12. no Shopify or paid provider call occurs during Product Intelligence tests", () => {
    // Pure local seed — these helpers must not require network or providers.
    const constraints = buildProductGenerationConstraints(
      MILAENE_PRODUCT_CATALOG,
    );
    assert.ok(constraints.allowedProductTypes.length >= 2);
    assert.ok(
      assertRequestedProductExists(
        MILAENE_PRODUCT_CATALOG,
        "milaene-heavyweight-hoodie",
      ),
    );
    const variantId =
      MILAENE_PRODUCT_CATALOG.products.find(
        (p) => p.id === "milaene-heavyweight-hoodie",
      )!.variants[0]!.id;
    assert.ok(
      assertRequestedVariantExists(MILAENE_PRODUCT_CATALOG, variantId),
    );
    assert.equal(isVariantAvailable(MILAENE_PRODUCT_CATALOG, variantId), true);
    assert.equal(
      isVariantAvailable(MILAENE_PRODUCT_CATALOG, "invented-variant"),
      false,
    );
  });
});

describe("Product Intelligence 1.7B Patch — Zip Hoodie & Shopify authority", () => {
  it("1. Zip Hoodie is allowed", () => {
    assert.equal(
      isProductTypeAllowed(MILAENE_PRODUCT_CATALOG, "zip hoodie"),
      true,
    );
    assert.equal(
      isProductTypeAllowed(MILAENE_PRODUCT_CATALOG, "zip_hoodie"),
      true,
    );
  });

  it("2. Zip Hoodie is no longer listed as forbidden", () => {
    const forbidden = getForbiddenProductTypes(MILAENE_PRODUCT_CATALOG);
    assert.ok(!forbidden.some((t) => /zip\s*hoodie/i.test(t)));
  });

  it("3. Zip Hoodie can be generation-eligible", () => {
    const zip = MILAENE_PRODUCT_CATALOG.products.find(
      (p) => p.id === "milaene-zip-hoodie",
    );
    assert.ok(zip);
    assert.equal(isProductGenerationEligible(zip!), true);
    assert.equal(zip!.active, true);
    assert.equal(zip!.sellable, true);
    assert.equal(zip!.imageGenerationAllowed, true);
    assert.equal(zip!.videoGenerationAllowed, true);
    assert.equal(zip!.confidence, "confirmed_direction");
  });

  it("4. exact unconfirmed Zip Hoodie variants remain unknown", () => {
    const zip = MILAENE_PRODUCT_CATALOG.products.find(
      (p) => p.id === "milaene-zip-hoodie",
    )!;
    assert.equal(zip.availableColors.length, 0);
    assert.equal(zip.availableSizes.length, 0);
    assert.equal(zip.variants.length, 0);
    assert.equal(zip.gsm, null);
    assert.equal(
      isColorAllowedForProduct(
        MILAENE_PRODUCT_CATALOG,
        "milaene-zip-hoodie",
        "washed black",
      ),
      false,
    );
  });

  it("5. Shopify live data overrides seed data", () => {
    const seedTitle = MILAENE_PRODUCT_CATALOG.products.find(
      (p) => p.slug === "heavyweight-hoodie",
    )!.title;

    const shopifyCatalog: ProductCatalog = {
      brandSlug: "milaene",
      brandName: "Milaene",
      version: "shopify-test-1",
      source: "shopify_live",
      updatedAt: "2026-07-21T12:00:00.000Z",
      products: [
        {
          ...MILAENE_PRODUCT_CATALOG.products.find(
            (p) => p.slug === "heavyweight-hoodie",
          )!,
          title: "Shopify Live Heavyweight Hoodie",
          source: "shopify_live",
          confidence: "confirmed",
          availableColors: [
            {
              id: "color-shopify-black",
              name: "shopify black",
              slug: "shopify-black",
              confidence: "confirmed",
            },
          ],
        },
      ],
      collections: [],
      forbiddenProductTypes: [],
      forbiddenCategories: ["caps", "jackets"],
      notes: [],
    };

    const merged = mergeProductCatalogs({
      brandSlug: "milaene",
      brandName: "Milaene",
      seed: MILAENE_PRODUCT_CATALOG,
      shopify: shopifyCatalog,
      sync: {
        catalogSource: "shopify_live",
        sourcePriority: PRODUCT_SOURCE_PRIORITY,
        lastSyncedAt: shopifyCatalog.updatedAt,
        liveCatalogAvailable: true,
        usingSeedFallback: false,
        stale: false,
        syncError: null,
      },
    });

    const hoodie = merged.products.find((p) => p.slug === "heavyweight-hoodie")!;
    assert.equal(hoodie.title, "Shopify Live Heavyweight Hoodie");
    assert.notEqual(hoodie.title, seedTitle);
    assert.equal(hoodie.source, "shopify_live");
    assert.equal(hoodie.availableColors[0]?.name, "shopify black");
    assert.equal(merged.source, "shopify_live");
  });

  it("6. Seed is used only as fallback", async () => {
    const result = await resolveProductCatalog({
      brandSlug: "milaene",
      seedOnly: false,
      allowSeedFallback: true,
    });
    assert.equal(result.sync.usingSeedFallback, true);
    assert.equal(result.sync.liveCatalogAvailable, false);
    assert.equal(result.sync.catalogSource, "seed");
    assert.equal(result.catalog.source, "seed");
  });

  it("7. Missing Shopify connection does not fake live data", async () => {
    const shopify = new ShopifyProductCatalogProvider();
    const connection = await shopify.validateConnection();
    assert.equal(connection.available, false);
    assert.ok(connection.reason);
    await assert.rejects(() => shopify.loadProducts());
    const status = shopify.getLastSyncStatus();
    assert.equal(status.liveCatalogAvailable, false);
    assert.equal(status.usingSeedFallback, true);
  });

  it("8. Archived Shopify product is not eligible", () => {
    const archived: Product = {
      ...MILAENE_PRODUCT_CATALOG.products.find(
        (p) => p.id === "milaene-zip-hoodie",
      )!,
      id: "shopify-archived-zip",
      slug: "archived-zip-hoodie",
      status: "archived",
      active: false,
      sellable: false,
      imageGenerationAllowed: false,
      videoGenerationAllowed: false,
      source: "shopify_live",
      confidence: "confirmed",
    };
    assert.equal(isProductGenerationEligible(archived), false);
  });

  it("9. Product color must exist on the live product", () => {
    const live: ProductCatalog = {
      ...MILAENE_PRODUCT_CATALOG,
      source: "shopify_live",
      products: [
        {
          ...MILAENE_PRODUCT_CATALOG.products.find(
            (p) => p.id === "milaene-oversized-heavyweight-tee",
          )!,
          source: "shopify_live",
          confidence: "confirmed",
          availableColors: [
            {
              id: "color-live-only",
              name: "live only black",
              slug: "live-only-black",
              confidence: "confirmed",
            },
          ],
        },
      ],
    };
    assert.equal(
      isColorAllowedForProduct(
        live,
        "milaene-oversized-heavyweight-tee",
        "live only black",
      ),
      true,
    );
    assert.equal(
      isColorAllowedForProduct(
        live,
        "milaene-oversized-heavyweight-tee",
        "washed black",
      ),
      false,
    );
  });

  it("10. Cap remains forbidden when absent", () => {
    assert.equal(isProductTypeAllowed(MILAENE_PRODUCT_CATALOG, "cap"), false);
    assert.ok(MILAENE_PRODUCT_CATALOG.forbiddenCategories.includes("caps"));
  });

  it("11. Jacket remains forbidden when absent", () => {
    assert.equal(isProductTypeAllowed(MILAENE_PRODUCT_CATALOG, "jacket"), false);
    assert.ok(MILAENE_PRODUCT_CATALOG.forbiddenCategories.includes("jackets"));
  });

  it("12. Prompt constraints report the correct source", () => {
    const prompt = formatProductConstraintsPrompt(MILAENE_PRODUCT_CATALOG);
    assert.match(prompt, /seed fallback/i);
    assert.match(prompt, /Using Seed Fallback:\ntrue/);
    assert.match(prompt, /zip hoodie/i);
    assert.doesNotMatch(prompt, /confirmed from Shopify/i);

    const full = formatProductIntelligencePrompt(MILAENE_PRODUCT_CATALOG);
    assert.match(full, /seed fallback/i);
    assert.match(full, /not live Shopify/i);
  });

  it("13. No Shopify request occurs during tests", async () => {
    const seedOnly = resolveProductCatalogSeedOnly("milaene");
    assert.equal(seedOnly.sync.liveCatalogAvailable, false);
    const shopify = new ShopifyProductCatalogProvider();
    assert.equal((await shopify.validateConnection()).available, false);
    // Provider throws rather than calling network — no credentials used.
  });

  it("14. Existing Product Intelligence tests remain green (zip still eligible)", () => {
    assert.ok(
      getAllowedProductTypes(MILAENE_PRODUCT_CATALOG).includes("zip hoodie"),
    );
    assert.ok(
      getHeroProducts(MILAENE_PRODUCT_CATALOG).every(
        (h) => h.id !== "milaene-zip-hoodie",
      ),
    );
  });
});
