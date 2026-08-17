import assert from "node:assert/strict";
import test from "node:test";

import { buildShopifyProductReferencePackage } from "@/lib/product-library/product-reference-package";

test("Shopify reference package preserves source identity without inventing image roles", () => {
  const product = {
    id: "gid://shopify/Product/1",
    title: "Zip hoodie",
    handle: "zip-hoodie",
    status: "ACTIVE",
    productType: "Zip Hoodie",
    description: "",
    tags: [],
    totalInventory: 2,
    priceMin: "40",
    priceMax: "40",
    currency: "EUR",
    imageUrl: "https://cdn.shopify.com/front.png",
    images: ["https://cdn.shopify.com/front.png", "https://cdn.shopify.com/other.png"],
    imageReferences: [
      { id: "image-1", url: "https://cdn.shopify.com/front.png", altText: null, width: 1000, height: 1200 },
      { id: "image-2", url: "https://cdn.shopify.com/other.png", altText: null, width: 1000, height: 1200 },
    ],
    updatedAt: "2026-08-17T12:00:00.000Z",
    collections: [],
    variants: [],
  };

  const pkg = buildShopifyProductReferencePackage(product, "2026-08-17T12:30:00.000Z");
  assert.equal(pkg.authority, "SHOPIFY_LIVE");
  assert.equal(pkg.references[0]?.role, "FEATURED");
  assert.equal(pkg.references[1]?.role, "UNCLASSIFIED");
  assert.equal("artwork" in pkg, false);
});

test("explicit Shopify alt text may classify a view", () => {
  const product = {
    id: "gid://shopify/Product/2",
    title: "Jacket",
    handle: "jacket",
    status: "ACTIVE",
    productType: "Jacket",
    description: "",
    tags: [],
    totalInventory: 1,
    priceMin: "100",
    priceMax: "100",
    currency: "EUR",
    imageUrl: null,
    images: ["https://cdn.shopify.com/back.png"],
    imageReferences: [
      { id: "image-3", url: "https://cdn.shopify.com/back.png", altText: "Back view", width: null, height: null },
    ],
    updatedAt: "2026-08-17T12:00:00.000Z",
    collections: [],
    variants: [],
  };
  assert.equal(
    buildShopifyProductReferencePackage(product, "2026-08-17T12:30:00.000Z").references[0]?.role,
    "BACK",
  );
});
