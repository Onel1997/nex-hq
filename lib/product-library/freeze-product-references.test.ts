import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { assertSafeShopifyCdnUrl, freezeShopifyProductReferences } from "@/lib/product-library/freeze-product-references";

test("Shopify reference freezing binds exact bytes before paid confirmation", async () => {
  const writes: Array<{ path: string; bytes: Buffer; mimeType: string }> = [];
  const bytes = Buffer.from("fake-png-fixture");
  const pkg = await freezeShopifyProductReferences({
    workspaceId: "11111111-1111-4111-8111-111111111111",
    package: {
      schemaVersion: "product-reference-package-v1",
      packageId: "shopify:product:version",
      authority: "SHOPIFY_LIVE",
      productProfileId: "shopify:product",
      shopifyProductId: "gid://shopify/Product/1",
      productVersion: "v1",
      capturedAt: "2026-08-17T12:00:00.000Z",
      provenance: "test",
      references: [{
        referenceId: "image-1",
        source: "SHOPIFY_MEDIA",
        role: "FEATURED",
        sourceImageId: "image-1",
        sourceUrl: "https://cdn.shopify.com/image.png",
        privateStoragePath: null,
        contentChecksumSha256: null,
        width: 100,
        height: 100,
        altText: null,
        variantIds: [],
      }],
    },
    fetchImpl: async () => new Response(bytes, { status: 200, headers: { "content-type": "image/png" } }),
    async persist(object) { writes.push(object); },
  });
  assert.equal(writes.length, 1);
  assert.equal(pkg.references[0]?.contentChecksumSha256, createHash("sha256").update(bytes).digest("hex"));
  assert.match(pkg.references[0]?.privateStoragePath ?? "", /product-references/);
});

test("remote reference resolver blocks SSRF and non-HTTPS URLs", () => {
  for (const url of [
    "http://cdn.shopify.com/image.png",
    "https://example.com/image.png",
    "https://cdn.shopify.com@127.0.0.1/image.png",
  ]) {
    assert.throws(() => assertSafeShopifyCdnUrl(url));
  }
});
