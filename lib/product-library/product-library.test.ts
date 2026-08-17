import assert from "node:assert/strict";
import test from "node:test";

import { productProductionBindingV2Schema, productProfileSchema } from "@/lib/product-library/types";

const base = {
  schemaVersion: "product-profile-v1" as const,
  productProfileId: "manual-sample-1",
  workspaceId: "22222222-2222-4222-8222-222222222222",
  name: "Future technical jacket",
  productType: "technical jacket",
  variants: [],
  colorways: ["black"],
  sizes: ["M"],
  collections: [],
  active: null,
  available: null,
  construction: { material: "nylon", pockets: ["front zip"], seams: [] },
  references: [],
  printSurfaces: [],
  embroideryRegions: [],
  provenance: {
    source: "owner-managed sample",
    capturedAt: "2026-08-17T12:00:00.000Z",
    sourceVersion: null,
  },
  version: 1,
  createdBy: "owner",
  createdAt: "2026-08-17T12:00:00.000Z",
  updatedAt: "2026-08-17T12:00:00.000Z",
};

test("manual ProductProfile exists without Artwork and never claims Shopify", () => {
  const profile = productProfileSchema.parse({
    ...base,
    authority: "MANUAL_PROFILE",
    shopifyProductId: null,
  });
  assert.equal(profile.authority, "MANUAL_PROFILE");
  assert.equal("artwork" in profile, false);
});

test("SHOPIFY_LIVE requires exact Shopify identity", () => {
  assert.throws(() => productProfileSchema.parse({
    ...base,
    authority: "SHOPIFY_LIVE",
    shopifyProductId: null,
  }));

  const profile = productProfileSchema.parse({
    ...base,
    productProfileId: "shopify:123",
    authority: "SHOPIFY_LIVE",
    shopifyProductId: "gid://shopify/Product/123",
  });
  assert.equal(profile.authority, "SHOPIFY_LIVE");
});

test("manual profile cannot fabricate a Shopify ID and product types stay extensible", () => {
  assert.throws(() => productProfileSchema.parse({
    ...base,
    authority: "MANUAL_PROFILE",
    shopifyProductId: "gid://shopify/Product/fake",
  }));

  const jogger = productProfileSchema.parse({
    ...base,
    authority: "MANUAL_PROFILE",
    shopifyProductId: null,
    productType: "wide-leg technical jogger",
  });
  assert.equal(jogger.productType, "wide-leg technical jogger");
});

test("manual Product can be frozen for Image v2 without Artwork or Shopify identity", () => {
  const binding = productProductionBindingV2Schema.parse({
    version: "product-production-binding-v2",
    productProfileId: "manual-sample-1",
    profileVersion: 2,
    authority: "MANUAL_PROFILE",
    shopifyProductId: null,
    variantId: "manual-black-m",
    productName: "Future technical jacket",
    productType: "technical jacket",
    color: "Black",
    size: "M",
    material: "Nylon",
    fit: null,
    collection: null,
    availability: "UNKNOWN",
    active: null,
    provenance: { source: "owner-managed sample", capturedAt: "2026-08-17T12:00:00.000Z", sourceVersion: "2" },
  });
  assert.equal(binding.authority, "MANUAL_PROFILE");
  assert.equal("artwork" in binding, false);
});
