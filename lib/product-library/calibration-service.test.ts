import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import test from "node:test";

import { calibrateShopifyProductSurface } from "@/lib/product-library/calibration-service";
import { MemoryProductProfileRepository } from "@/lib/product-library/memory-repository";
import type { ShopifyProductDetail } from "@/lib/shopify/fetch-product-detail";

const workspaceId = randomUUID();
const actorId = randomUUID();
const productId = "gid://shopify/Product/1";
const variantId = "gid://shopify/ProductVariant/1";
const now = "2026-08-17T15:00:00.000Z";
const bytes = Buffer.from("product-reference");
const checksum = createHash("sha256").update(bytes).digest("hex");
const quad: [
  { x: number; y: number },
  { x: number; y: number },
  { x: number; y: number },
  { x: number; y: number },
] = [
  { x: 0.3, y: 0.35 },
  { x: 0.7, y: 0.35 },
  { x: 0.68, y: 0.7 },
  { x: 0.32, y: 0.7 },
];

const detail: ShopifyProductDetail = {
  id: productId,
  title: "Zip Hoodie",
  handle: "zip-hoodie",
  status: "ACTIVE",
  productType: "Zip Hoodie",
  description: "",
  tags: [],
  totalInventory: 1,
  priceMin: "1",
  priceMax: "1",
  currency: "EUR",
  imageUrl: "https://cdn.shopify.com/fixture.png",
  images: ["https://cdn.shopify.com/fixture.png"],
  imageReferences: [
    {
      id: "image-1",
      url: "https://cdn.shopify.com/fixture.png",
      altText: null,
      width: 1000,
      height: 1200,
    },
  ],
  updatedAt: now,
  collections: ["Core"],
  variants: [
    {
      id: variantId,
      title: "Black / L",
      price: "1",
      currency: "EUR",
      inventory: 1,
      available: true,
      updatedAt: now,
      options: [
        { name: "Color", value: "Black" },
        { name: "Size", value: "L" },
      ],
    },
  ],
};

function dependencies(repository: MemoryProductProfileRepository) {
  return {
    repository,
    fetchDetail: async () => detail,
    resolveContext: async () => ({
      version: "product-production-context-v1" as const,
      productId,
      variantId,
      productName: "Zip Hoodie",
      productType: "Zip Hoodie",
      color: "Black",
      size: "L",
      material: null,
      fit: null,
      collection: "Core",
      availability: "AVAILABLE" as const,
      active: true,
      authority: "SHOPIFY_LIVE" as const,
      authoritative: true,
      provenance: {
        source: "Shopify fixture",
        sourceRecordId: variantId,
        capturedAt: now,
        sourceVersion: now,
      },
    }),
    freezeReferences: async ({
      package: input,
    }: {
      package: ReturnType<
        typeof import("@/lib/product-library/product-reference-package").buildShopifyProductReferencePackage
      >;
    }) => ({
      ...input,
      references: input.references.map((reference) => ({
        ...reference,
        privateStoragePath: `${workspaceId}/product-references/${checksum}.png`,
        contentChecksumSha256: checksum,
        mimeType: "image/png" as const,
        byteLength: bytes.length,
      })),
    }),
    persistReference: async () => undefined,
    now: () => now,
  };
}

test("owner-defined surface freezes references and versions only changed geometry", async () => {
  const repository = new MemoryProductProfileRepository();
  const request = {
    authority: "SHOPIFY_LIVE" as const,
    productId,
    variantId,
    surface: {
      printSurfaceId: "front-center",
      region: "front_center" as const,
      quad,
      calibrationAttestation: true as const,
    },
  };
  const first = await calibrateShopifyProductSurface(
    { workspaceId, actorId },
    request,
    dependencies(repository),
  );
  assert.equal(first.profile.version, 1);
  assert.equal(first.printSurface.version, 1);
  assert.equal(first.printSurface.geometryStatus, "HUMAN_DEFINED");
  assert.equal(first.profile.references[0]!.contentChecksumSha256, checksum);
  assert.equal(first.profile.references[0]!.role, "FEATURED");
  assert.equal("artwork" in first.profile, false);

  const replay = await calibrateShopifyProductSurface(
    { workspaceId, actorId },
    request,
    dependencies(repository),
  );
  assert.equal(replay.profile.version, 1);
  assert.equal(replay.printSurface.version, 1);

  const changed = await calibrateShopifyProductSurface(
    { workspaceId, actorId },
    {
      ...request,
      surface: {
        ...request.surface,
        quad: [{ ...quad[0], x: 0.31 }, quad[1], quad[2], quad[3]],
      },
    },
    dependencies(repository),
  );
  assert.equal(changed.profile.version, 2);
  assert.equal(changed.printSurface.version, 2);
});

test("calibration refuses missing explicit owner attestation instead of fabricating geometry", async () => {
  const repository = new MemoryProductProfileRepository();
  await assert.rejects(() =>
    calibrateShopifyProductSurface(
      { workspaceId, actorId },
      {
        authority: "SHOPIFY_LIVE",
        productId,
        variantId,
        surface: {
          printSurfaceId: "front-center",
          region: "front_center",
          quad,
          calibrationAttestation: false,
        },
      } as never,
      dependencies(repository),
    ),
  );
});

test("exact-variant calibration needs no cross-variant or Product-family attestation", async () => {
  const repository = new MemoryProductProfileRepository();
  const result = await calibrateShopifyProductSurface(
    { workspaceId, actorId },
    {
      authority: "SHOPIFY_LIVE",
      productId,
      variantId,
      reuse: {
        scope: "PRODUCT_PROFILE",
        physicalProductKey: `shopify-product:${productId}`,
        physicalProductLabel: "Zip Hoodie",
        compatibleShopifyProductIds: [productId],
        variantPolicy: "EXACT_VARIANT",
        normalizedVariantGeometryAttestation: false,
        familyEquivalenceAttestation: false,
      },
      surface: {
        printSurfaceId: "front-left-exact",
        region: "front_left",
        quad,
        calibrationAttestation: true,
      },
    },
    dependencies(repository),
  );
  assert.equal(result.printSurface.variantId, variantId);
  assert.equal(result.printSurface.reuse?.variantPolicy, "EXACT_VARIANT");
  assert.equal(result.printSurface.reuse?.scope, "PRODUCT_PROFILE");
});

test("owner-confirmed family calibration is normalized, versioned, and reusable across compatible variants", async () => {
  const repository = new MemoryProductProfileRepository();
  const request = {
    authority: "SHOPIFY_LIVE" as const,
    productId,
    variantId,
    reuse: {
      scope: "PRODUCT_FAMILY" as const,
      physicalProductKey: "marketprint:heavy-zip-hoodie",
      physicalProductLabel: "Heavy Zip Hoodie",
      compatibleShopifyProductIds: [productId, "gid://shopify/Product/2"],
      normalizedVariantGeometryAttestation: true as const,
      familyEquivalenceAttestation: true,
    },
    surface: {
      printSurfaceId: "zip-hoodie-back-large",
      region: "back_center" as const,
      quad,
      calibrationAttestation: true as const,
    },
  };

  const first = await calibrateShopifyProductSurface(
    { workspaceId, actorId },
    request,
    dependencies(repository),
  );
  assert.equal(first.printSurface.variantId, null);
  assert.equal(first.printSurface.reuse?.scope, "PRODUCT_FAMILY");
  assert.equal(
    first.printSurface.reuse?.variantPolicy,
    "ALL_COMPATIBLE_VARIANTS",
  );
  assert.equal(first.printSurface.reuse?.sourceProductProfileVersion, 1);

  const replay = await calibrateShopifyProductSurface(
    { workspaceId, actorId },
    request,
    dependencies(repository),
  );
  assert.equal(replay.profile.version, 1);
  assert.equal(replay.printSurface.version, 1);

  const changed = await calibrateShopifyProductSurface(
    { workspaceId, actorId },
    {
      ...request,
      surface: {
        ...request.surface,
        quad: [{ ...quad[0], x: 0.31 }, quad[1], quad[2], quad[3]],
      },
    },
    dependencies(repository),
  );
  assert.equal(changed.profile.version, 2);
  assert.equal(changed.printSurface.version, 2);
  assert.equal(changed.printSurface.reuse?.sourceProductProfileVersion, 2);
});

test("Product-family reuse requires explicit physical-equivalence evidence", async () => {
  const repository = new MemoryProductProfileRepository();
  await assert.rejects(() =>
    calibrateShopifyProductSurface(
      { workspaceId, actorId },
      {
        authority: "SHOPIFY_LIVE",
        productId,
        variantId,
        reuse: {
          scope: "PRODUCT_FAMILY",
          physicalProductKey: "marketprint:heavy-zip-hoodie",
          physicalProductLabel: "Heavy Zip Hoodie",
          compatibleShopifyProductIds: [productId, "gid://shopify/Product/2"],
          normalizedVariantGeometryAttestation: true,
          familyEquivalenceAttestation: false,
        },
        surface: {
          printSurfaceId: "zip-hoodie-back-large",
          region: "back_center",
          quad,
          calibrationAttestation: true,
        },
      },
      dependencies(repository),
    ),
  );
});
