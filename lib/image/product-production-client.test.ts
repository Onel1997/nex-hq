import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { toImageProductSelection } from "./product-production-client";
import { PRODUCT_PRODUCTION_CONTEXT_VERSION } from "./product-production-context";

describe("Image product production client", () => {
  it("binds live Shopify selection to server-verified production context", () => {
    const bound = toImageProductSelection(
      {
        authority: "SHOPIFY_LIVE",
        productId: "gid://shopify/Product/cruising",
        variantId: "gid://shopify/ProductVariant/cruising-black-l",
      },
      {
        version: PRODUCT_PRODUCTION_CONTEXT_VERSION,
        productId: "gid://shopify/Product/cruising",
        variantId: "gid://shopify/ProductVariant/cruising-black-l",
        productName: "CRUISING - Heavy Oversized Tee",
        productType: "T-Shirt",
        color: "Schwarz",
        size: "L",
        material: null,
        fit: null,
        collection: "Cruising",
        availability: "AVAILABLE",
        active: true,
        authority: "SHOPIFY_LIVE",
        authoritative: true,
        provenance: {
          source: "Shopify Admin GraphQL live read",
          sourceRecordId: "gid://shopify/ProductVariant/cruising-black-l",
          capturedAt: "2026-08-17T01:00:00.000Z",
          sourceVersion: "2026-08-17T00:45:00.000Z",
        },
      },
    );
    assert.equal(bound.selection.variantId, "gid://shopify/ProductVariant/cruising-black-l");
    assert.equal(bound.productionContext.authoritative, true);
    assert.equal(bound.productionContext.color, "Schwarz");
    assert.equal(bound.productionContext.size, "L");
  });
});
