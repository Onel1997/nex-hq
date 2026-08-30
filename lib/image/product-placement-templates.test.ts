import assert from "node:assert/strict";
import test from "node:test";

import {
  printSurfaceFromProductTemplate,
  resolveAutomaticProductPlacement,
  resolveProductPlacementTemplate,
} from "@/lib/image/product-placement-templates";
import { printSurfaceSchema, type PrintSurface } from "@/lib/image/print-surface/types";
import { isAxisAlignedRectangleQuad } from "@/lib/image/artwork-compositing/compositor";

function storedSurface(input: {
  profileId: string;
  id: string;
  region: PrintSurface["region"];
  source?: "OWNER_CALIBRATION" | "PRODUCT_PROFILE";
}): PrintSurface {
  return printSurfaceSchema.parse({
    contractVersion: "print-surface-v1",
    printSurfaceId: input.id,
    version: 7,
    productProfileId: input.profileId,
    variantId: null,
    region: input.region,
    displayName: input.id,
    geometryStatus: "CALIBRATED",
    quad: [
      { x: 0.2, y: 0.2 },
      { x: 0.8, y: 0.2 },
      { x: 0.8, y: 0.8 },
      { x: 0.2, y: 0.8 },
    ],
    boundingBox: null,
    orientationDegrees: 0,
    perspectiveAnchors: [],
    clippingMaskReference: null,
    safeMargin: { top: 0, right: 0, bottom: 0, left: 0 },
    artworkScale: 1,
    rotationDegrees: 0,
    warpMode: "PERSPECTIVE",
    provenance: {
      source: input.source ?? "OWNER_CALIBRATION",
      calibratedBy: "owner",
      calibratedAt: "2026-08-20T10:00:00.000Z",
    },
  });
}

test("known T-Shirt templates resolve front, back, and left chest automatically", () => {
  for (const [side, preset] of [
    ["FRONT", "FRONT_LARGE"],
    ["BACK", "BACK_LARGE"],
    ["FRONT", "FRONT_LEFT_CHEST"],
  ] as const) {
    const result = resolveAutomaticProductPlacement({
      productProfileId: "heavy-oversized-tee",
      productType: "Heavy Oversized Tee",
      variantId: "black-l",
      printSide: side,
      placementPreset: preset,
      printSurfaces: [],
    });
    assert.equal(result.ok, true);
    if (!result.ok) continue;
    assert.equal(result.authority, "NEXHQ_PRODUCT_TEMPLATE");
    assert.equal(result.surface.provenance.source, "NEXHQ_PRODUCT_TEMPLATE");
    assert.equal(result.surface.variantId, null);
    assert.ok(result.surface.quad);
    assert.equal(result.surface.warpMode, "NONE");
    assert.equal(isAxisAlignedRectangleQuad(result.surface.quad!), true);
    assert.ok(result.surface.boundingBox);
    assert.equal(result.surface.orientationDegrees, 0);
    assert.equal(result.surface.rotationDegrees, 0);
  }
});

test("owner surface overrides verified family surface and standard template", () => {
  const owner = storedSurface({
    profileId: "selected-profile",
    id: "owner-front",
    region: "front_center",
  });
  const family = storedSurface({
    profileId: "family-profile",
    id: "family-front",
    region: "front_center",
    source: "PRODUCT_PROFILE",
  });
  const ownerResult = resolveAutomaticProductPlacement({
    productProfileId: "selected-profile",
    productType: "T-Shirt",
    variantId: "black-l",
    printSide: "FRONT",
    placementPreset: "FRONT_LARGE",
    printSurfaces: [family, owner],
  });
  assert.equal(ownerResult.ok, true);
  if (ownerResult.ok) {
    assert.equal(ownerResult.surface.printSurfaceId, "owner-front");
    assert.equal(ownerResult.authority, "OWNER_OR_PRODUCT_SURFACE");
  }

  const familyResult = resolveAutomaticProductPlacement({
    productProfileId: "selected-profile",
    productType: "T-Shirt",
    variantId: "black-l",
    printSide: "FRONT",
    placementPreset: "FRONT_LARGE",
    printSurfaces: [family],
  });
  assert.equal(familyResult.ok, true);
  if (familyResult.ok) {
    assert.equal(familyResult.surface.printSurfaceId, "family-front");
    assert.equal(familyResult.authority, "PRODUCT_FAMILY_SURFACE");
  }
});

test("template identity is versioned, Product-bound, and not Artwork-bound", () => {
  const template = resolveProductPlacementTemplate({
    productType: "Oversized Hoodie",
    printSide: "BACK",
    placementPreset: "BACK_LARGE",
  });
  assert.ok(template);
  const first = printSurfaceFromProductTemplate({
    template: template!,
    productProfileId: "hoodie-profile",
  });
  const second = printSurfaceFromProductTemplate({
    template: template!,
    productProfileId: "hoodie-profile",
  });
  assert.deepEqual(first, second);
  assert.equal(first.version, 1);
  assert.equal("artworkId" in first, false);
  assert.equal("artworkChecksum" in first, false);
  assert.equal("designId" in first, false);
});

test("Zip Hoodie never receives a fabricated centered-front template", () => {
  assert.equal(
    resolveProductPlacementTemplate({
      productType: "Zip Hoodie",
      printSide: "FRONT",
      placementPreset: "FRONT_LARGE",
    }),
    null,
  );
  assert.ok(
    resolveProductPlacementTemplate({
      productType: "Zip Hoodie",
      printSide: "FRONT",
      placementPreset: "FRONT_LEFT_CHEST",
    }),
  );
});

test("unknown and custom Products fail closed", () => {
  const result = resolveAutomaticProductPlacement({
    productProfileId: "custom-product",
    productType: "Experimental sculptural blank",
    variantId: "one",
    printSide: "FRONT",
    placementPreset: "FRONT_LARGE",
    printSurfaces: [],
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "INCOMPATIBLE_PRODUCT");
});
