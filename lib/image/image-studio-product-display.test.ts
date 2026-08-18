import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canPreparePaidImageEstimate,
  isAuthoritativeProductContext,
  isAuthoritativeProductSelection,
  isImageStudioHandoffDebugEnabled,
  resolveDesignMissionHints,
  resolveImageStudioProductHeader,
  resolvePrepareEstimateBlocker,
} from "./image-studio-product-display";
import { PRODUCT_PRODUCTION_CONTEXT_VERSION } from "./product-production-context";

const liveContext = {
  version: PRODUCT_PRODUCTION_CONTEXT_VERSION,
  productId: "gid://shopify/Product/1",
  variantId: "gid://shopify/ProductVariant/1",
  productName: "CRUISING - Heavy Oversized Tee",
  productType: "T-Shirt",
  color: "Schwarz",
  size: "L",
  material: null,
  fit: null,
  collection: "Cruising",
  availability: "AVAILABLE" as const,
  active: true,
  authority: "SHOPIFY_LIVE" as const,
  authoritative: true,
  provenance: {
    source: "Shopify Admin GraphQL live read",
    sourceRecordId: "gid://shopify/ProductVariant/1",
    capturedAt: "2026-08-17T01:00:00.000Z",
    sourceVersion: "2026-08-17T00:30:00.000Z",
  },
};

describe("Image Studio product authority display", () => {
  it("does not treat Design mission garment metadata as authoritative product truth", () => {
    const hints = resolveDesignMissionHints({
      designName: "Quiet Ascent Hero",
      collection: "Faith Collection",
      garment: "Faith Oversized Hoodie",
      colorway: "Black",
      version: "V2",
      classification: "Hero Piece",
      creativeDirection: "—",
      designStory: "—",
      fashionLanguage: "—",
      typographyRules: "—",
      symbols: "—",
      ornaments: "—",
      commercialIntent: "—",
      imagePrompt: "—",
      mockupPrompt: "—",
      blueprintReview: "—",
      commercialScore: null,
      commercialApproved: true,
      imported: true,
    });
    assert.ok(hints);
    assert.equal(hints?.garment, "Faith Oversized Hoodie");

    const header = resolveImageStudioProductHeader({
      productContext: null,
      selectedProductLabel: null,
    });
    assert.equal(header.value, "Kein Produkt ausgewählt");
    assert.equal(header.authoritative, false);
  });

  it("requires server-verified Shopify context with exact variant for authority", () => {
    assert.equal(
      isAuthoritativeProductSelection({
        authority: "SHOPIFY_LIVE",
        productId: "gid://shopify/Product/1",
        variantId: null,
      }),
      false,
    );
    assert.equal(isAuthoritativeProductContext(liveContext), true);
    const header = resolveImageStudioProductHeader({
      productContext: liveContext,
      selectedProductLabel: "CRUISING - Heavy Oversized Tee · L / Schwarz",
    });
    assert.equal(header.authoritative, true);
    assert.match(header.value, /CRUISING/i);
  });

  it("blocks Prepare / Estimate until server-verified Shopify context exists", () => {
    assert.equal(
      canPreparePaidImageEstimate({
        briefReady: true,
        productContext: null,
        masterArtworkApproved: true,
        hasBrandModel: true,
      }),
      false,
    );
    assert.match(
      resolvePrepareEstimateBlocker({
        briefReady: true,
        productContext: {
          ...liveContext,
          authoritative: false,
          authority: "DESIGN_HANDOFF_LOCAL",
        },
        masterArtworkApproved: true,
        hasBrandModel: true,
      }) ?? "",
      /Shopify/
    );
    assert.equal(
      canPreparePaidImageEstimate({
        briefReady: true,
        productContext: liveContext,
        masterArtworkApproved: true,
        hasBrandModel: true,
      }),
      true,
    );
  });

  it("clears Prepare gate when verified product context is removed", () => {
    assert.equal(
      canPreparePaidImageEstimate({
        briefReady: true,
        productContext: liveContext,
        masterArtworkApproved: true,
        hasBrandModel: true,
      }),
      true,
    );
    assert.equal(
      canPreparePaidImageEstimate({
        briefReady: true,
        productContext: null,
        masterArtworkApproved: true,
        hasBrandModel: true,
      }),
      false,
    );
  });

  it("blocks paid preparation until an image-eligible Brand Model is selected", () => {
    assert.match(
      resolvePrepareEstimateBlocker({
        briefReady: true,
        productContext: liveContext,
        masterArtworkApproved: true,
        hasBrandModel: false,
      }) ?? "",
      /für Bilder freigegebenes Markenmodel/i,
    );
  });

  it("hides handoff debug overlay unless explicit debug mode is enabled", () => {
    assert.equal(isImageStudioHandoffDebugEnabled(""), false);
    assert.equal(isImageStudioHandoffDebugEnabled("?foo=1"), false);
    assert.equal(isImageStudioHandoffDebugEnabled("?handoffDebug=1"), true);
  });
});
