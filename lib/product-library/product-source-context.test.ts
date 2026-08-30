import assert from "node:assert/strict";
import test from "node:test";
import {
  deriveShopifyProductSourceContext,
  preserveOwnerConfirmedProductSource,
  productSourceContextSchema,
} from "./product-source-context";

const NOW = "2026-08-19T00:00:00.000Z";

test("MarketPrint, Brandsky, and Brandcanyon require explicit Shopify metadata", () => {
  assert.equal(deriveShopifyProductSourceContext({ vendor: "MarketPrint", capturedAt: NOW }).sourceProvider, "MARKETPRINT");
  assert.equal(deriveShopifyProductSourceContext({ tags: ["supplier:brandsky"], capturedAt: NOW }).sourceProvider, "BRANDSKY");
  assert.equal(deriveShopifyProductSourceContext({ tags: ["source:brandcanyon"], capturedAt: NOW }).sourceProvider, "BRANDCANYON");
  assert.equal(deriveShopifyProductSourceContext({ vendor: "Milaene", tags: ["MarketPrint-inspired title"], capturedAt: NOW }).sourceProvider, "UNKNOWN");
});

test("conflicting supplier evidence fails closed", () => {
  const context = deriveShopifyProductSourceContext({
    vendor: "MarketPrint",
    tags: ["supplier:brandsky"],
    capturedAt: NOW,
  });
  assert.equal(context.sourceProvider, "UNKNOWN");
  assert.equal(context.authority, "UNKNOWN");
});

test("unknown remains unknown and title inference is impossible by contract", () => {
  assert.deepEqual(deriveShopifyProductSourceContext({ capturedAt: NOW }), {
    sourceProvider: "UNKNOWN",
    authority: "UNKNOWN",
    evidence: [],
    lastVerifiedAt: null,
  });
});

test("explicit owner confirmation survives Shopify resync", () => {
  const owner = productSourceContextSchema.parse({
    sourceProvider: "MARKETPRINT",
    authority: "OWNER_CONFIRMED",
    evidence: [{ field: "MANUAL", value: "Owner verified supplier invoice" }],
    lastVerifiedAt: NOW,
  });
  const shopify = deriveShopifyProductSourceContext({ vendor: "Milaene", capturedAt: NOW });
  assert.deepEqual(preserveOwnerConfirmedProductSource(owner, shopify), owner);
});
