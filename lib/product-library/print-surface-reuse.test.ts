import assert from "node:assert/strict";
import test from "node:test";

import { printSurfaceSchema } from "@/lib/image/print-surface/types";
import {
  assertFamilySurfaceUsableForShopifyProduct,
  reusablePrintSurfacesForProduct,
} from "@/lib/product-library/print-surface-reuse";

const firstProductId = "gid://shopify/Product/1";
const secondProductId = "gid://shopify/Product/2";
const ownerProfileId = `shopify:${firstProductId}`;
const selectedProfileId = `shopify:${secondProductId}`;

function surface(overrides: Record<string, unknown> = {}) {
  return printSurfaceSchema.parse({
    contractVersion: "print-surface-v1",
    printSurfaceId: "heavy-tee-front-large",
    version: 2,
    productProfileId: ownerProfileId,
    variantId: null,
    region: "front_center",
    displayName: "Großer Frontprint",
    geometryStatus: "HUMAN_DEFINED",
    quad: [
      { x: 0.3, y: 0.3 },
      { x: 0.7, y: 0.3 },
      { x: 0.68, y: 0.72 },
      { x: 0.32, y: 0.72 },
    ],
    boundingBox: null,
    clippingMaskReference: null,
    provenance: {
      source: "OWNER_CALIBRATION",
      calibratedBy: "owner-1",
      calibratedAt: "2026-08-19T20:00:00.000Z",
    },
    reuse: {
      scope: "PRODUCT_FAMILY",
      physicalProductKey: "marketprint:heavy-oversized-tee",
      physicalProductLabel: "Heavy Oversized Tee",
      sourceProductProfileId: ownerProfileId,
      sourceProductProfileVersion: 4,
      variantPolicy: "ALL_COMPATIBLE_VARIANTS",
      compatibleShopifyProductIds: [firstProductId, secondProductId],
      equivalenceAuthority: "OWNER_CONFIRMED",
      confirmedBy: "owner-1",
      confirmedAt: "2026-08-19T20:00:00.000Z",
    },
    ...overrides,
  });
}

const family = {
  key: "marketprint:heavy-oversized-tee",
  label: "Heavy Oversized Tee",
  memberShopifyProductIds: [firstProductId, secondProductId],
  sourceLabel: "MarketPrint",
};

test("one owner-confirmed physical Product surface is reusable across listings and Artworks", () => {
  const profiles = [
    {
      productProfileId: ownerProfileId,
      version: 7,
      printSurfaces: [surface()],
    },
    { productProfileId: selectedProfileId, version: 3, printSurfaces: [] },
  ];
  const resolveForArtwork = () =>
    reusablePrintSurfacesForProduct({
      profiles,
      selectedProfile: profiles[1]!,
      selectedShopifyProductId: secondProductId,
      physicalFamily: family,
    });

  const firstArtwork = resolveForArtwork();
  const secondArtwork = resolveForArtwork();
  assert.equal(firstArtwork.length, 1);
  assert.deepEqual(firstArtwork, secondArtwork);
  assert.equal(firstArtwork[0]?.inherited, true);
  assert.equal(firstArtwork[0]?.ownerProfileKey, ownerProfileId);
  assert.equal(firstArtwork[0]?.ownerProfileVersion, 4);
});

test("supplier or family-title similarity alone never authorizes geometry inheritance", () => {
  const unauthorized = surface({ reuse: undefined });
  const results = reusablePrintSurfacesForProduct({
    profiles: [
      {
        productProfileId: ownerProfileId,
        version: 1,
        printSurfaces: [unauthorized],
      },
    ],
    selectedProfile: {
      productProfileId: selectedProfileId,
      version: 1,
      printSurfaces: [],
    },
    selectedShopifyProductId: secondProductId,
    physicalFamily: family,
  });
  assert.equal(results.length, 0);
});

test("an unrelated Product family cannot consume an otherwise valid surface", () => {
  const results = reusablePrintSurfacesForProduct({
    profiles: [
      {
        productProfileId: ownerProfileId,
        version: 4,
        printSurfaces: [surface()],
      },
    ],
    selectedProfile: {
      productProfileId: selectedProfileId,
      version: 1,
      printSurfaces: [],
    },
    selectedShopifyProductId: secondProductId,
    physicalFamily: {
      ...family,
      key: "marketprint:heavy-oversized-hoodie",
      label: "Heavy Oversized Hoodie",
    },
  });
  assert.equal(results.length, 0);
});

test("family surface supports normalized variants but exact-variant surfaces stay local", () => {
  const exact = surface({
    printSurfaceId: "exact-variant-front",
    variantId: "gid://shopify/ProductVariant/1",
    reuse: {
      scope: "PRODUCT_PROFILE",
      physicalProductKey: `shopify-product:${firstProductId}`,
      physicalProductLabel: "Listing one",
      sourceProductProfileId: ownerProfileId,
      sourceProductProfileVersion: 4,
      variantPolicy: "EXACT_VARIANT",
      compatibleShopifyProductIds: [firstProductId],
      equivalenceAuthority: "OWNER_CONFIRMED",
      confirmedBy: "owner-1",
      confirmedAt: "2026-08-19T20:00:00.000Z",
    },
  });
  const results = reusablePrintSurfacesForProduct({
    profiles: [
      {
        productProfileId: ownerProfileId,
        version: 4,
        printSurfaces: [surface(), exact],
      },
    ],
    selectedProfile: {
      productProfileId: selectedProfileId,
      version: 1,
      printSurfaces: [],
    },
    selectedShopifyProductId: secondProductId,
    physicalFamily: family,
  });
  assert.deepEqual(
    results.map((entry) => entry.surface.printSurfaceId),
    ["heavy-tee-front-large"],
  );
});

test("server guard fails closed when the selected listing lacks explicit family evidence", () => {
  const selectedProfile = {
    productProfileId: selectedProfileId,
  } as Parameters<
    typeof assertFamilySurfaceUsableForShopifyProduct
  >[0]["selectedProfile"];
  assert.doesNotThrow(() =>
    assertFamilySurfaceUsableForShopifyProduct({
      surface: surface(),
      selectedProfile,
      selectedShopifyProductId: secondProductId,
    }),
  );
  assert.throws(() =>
    assertFamilySurfaceUsableForShopifyProduct({
      surface: surface(),
      selectedProfile,
      selectedShopifyProductId: "gid://shopify/Product/999",
    }),
  );
});
