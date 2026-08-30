import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { createCanvas } from "canvas";

import {
  assertSafeShopifyCdnUrl,
  completeFrozenProductReference,
  freezeShopifyProductReferences,
} from "@/lib/product-library/freeze-product-references";

function pngFixture(): Buffer {
  const canvas = createCanvas(16, 20);
  const context = canvas.getContext("2d");
  context.fillStyle = "#111111";
  context.fillRect(0, 0, 16, 20);
  return canvas.toBuffer("image/png");
}

test("Shopify reference freezing binds exact bytes before paid confirmation", async () => {
  const writes: Array<{ path: string; bytes: Buffer; mimeType: string }> = [];
  const bytes = pngFixture();
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
    fetchImpl: async () => new Response(new Uint8Array(bytes), { status: 200, headers: { "content-type": "image/png" } }),
    async persist(object) { writes.push(object); },
  });
  assert.equal(writes.length, 1);
  assert.equal(pkg.references[0]?.contentChecksumSha256, createHash("sha256").update(bytes).digest("hex"));
  assert.equal(pkg.references[0]?.mimeType, "image/png");
  assert.equal(pkg.references[0]?.byteLength, bytes.length);
  assert.match(pkg.references[0]?.privateStoragePath ?? "", /product-references/);
});

test("legacy frozen metadata is completed only from verified private image bytes", () => {
  const bytes = pngFixture();
  const reference = completeFrozenProductReference(
    {
      referenceId: "legacy-image",
      source: "SHOPIFY_MEDIA",
      role: "FEATURED",
      sourceImageId: "legacy-image",
      sourceUrl: "https://cdn.shopify.com/legacy.png",
      privateStoragePath: "workspace/product-references/legacy.png",
      contentChecksumSha256: createHash("sha256").update(bytes).digest("hex"),
      mimeType: null,
      byteLength: null,
      width: 16,
      height: 20,
      altText: null,
      variantIds: [],
    },
    bytes,
  );
  assert.equal(reference.mimeType, "image/png");
  assert.equal(reference.byteLength, bytes.length);
});

test("declared Product reference metadata must match private bytes", () => {
  const bytes = pngFixture();
  assert.throws(
    () =>
      completeFrozenProductReference(
        {
          referenceId: "mismatch-image",
          source: "SHOPIFY_MEDIA",
          role: "FEATURED",
          sourceImageId: "mismatch-image",
          sourceUrl: "https://cdn.shopify.com/mismatch.png",
          privateStoragePath: "workspace/product-references/mismatch.png",
          contentChecksumSha256: createHash("sha256")
            .update(bytes)
            .digest("hex"),
          mimeType: "image/jpeg",
          byteLength: bytes.length,
          width: 16,
          height: 20,
          altText: null,
          variantIds: [],
        },
        bytes,
      ),
    /MIME type does not match/,
  );
});

test("frozen Product reference checksum mismatch fails closed", () => {
  const bytes = pngFixture();
  assert.throws(
    () =>
      completeFrozenProductReference(
        {
          referenceId: "checksum-mismatch",
          source: "SHOPIFY_MEDIA",
          role: "FEATURED",
          sourceImageId: "checksum-mismatch",
          sourceUrl: "https://cdn.shopify.com/checksum-mismatch.png",
          privateStoragePath:
            "workspace/product-references/checksum-mismatch.png",
          contentChecksumSha256: "a".repeat(64),
          mimeType: "image/png",
          byteLength: bytes.length,
          width: 16,
          height: 20,
          altText: null,
          variantIds: [],
        },
        bytes,
      ),
    /checksum does not match/,
  );
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
