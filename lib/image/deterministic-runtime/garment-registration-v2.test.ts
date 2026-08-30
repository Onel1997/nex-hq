import assert from "node:assert/strict";
import test from "node:test";

import { createCanvas } from "canvas";

import {
  printIntentWithinGarment,
  printSurfaceForGarmentRegistration,
  registerGeneratedGarmentV2,
  type NormalizedBounds,
} from "@/lib/image/deterministic-runtime/garment-registration-v2";
import { defaultOwnerArtworkPlacement } from "@/lib/product-library/product-family";
import { printSurfaceSchema } from "@/lib/image/print-surface/types";

const FACE: NormalizedBounds = { x: 0.43, y: 0.07, width: 0.14, height: 0.15 };
const TEMPLATE = { templateId: "vacancy-front", version: 3 };
const PRINTABLE = { x: 0.2, y: 0.17, width: 0.6, height: 0.57 };

function baseWithShirt(color: string, background = "#c33c66"): Buffer {
  const canvas = createCanvas(320, 420);
  const context = canvas.getContext("2d");
  context.fillStyle = background;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#9b6f54";
  context.fillRect(138, 30, 44, 62);
  context.fillStyle = color;
  context.fillRect(72, 112, 176, 280);
  // Mild deterministic cloth lighting/folds must remain part of the garment
  // component rather than being mistaken for its boundary.
  context.fillStyle = "rgba(255,255,255,.08)";
  context.fillRect(120, 112, 8, 280);
  context.fillStyle = "rgba(0,0,0,.07)";
  context.fillRect(196, 112, 7, 280);
  return canvas.toBuffer("image/png");
}

for (const [label, color, value] of [
  ["white", "#e8e6df", "Weiß"],
  ["black", "#242529", "Schwarz"],
  ["beige", "#bea98d", "Beige"],
  ["light blue", "#98c3dc", "Babyblau"],
] as const) {
  test(`Garment Registration V2 maps ${label} T-shirt inside garment and below neck`, async () => {
    const result = await registerGeneratedGarmentV2({
      bytes: baseWithShirt(color),
      productType: "Vacancy T-Shirt",
      productColor: value,
      side: "FRONT",
      printableArea: PRINTABLE,
      ownerPlacement: defaultOwnerArtworkPlacement(TEMPLATE),
      faceBounds: FACE,
    });
    assert.equal(result.status, "REGISTERED");
    assert.ok(result.confidence >= 0.62);
    assert.ok(result.maskCoverage >= 0.78);
    const quad = result.registeredPrintQuad!;
    assert.ok(quad.every((point) => point.y > FACE.y + FACE.height));
    assert.ok(quad.every((point) => point.x >= result.garmentBounds!.x));
    assert.ok(
      quad.every(
        (point) =>
          point.x <= result.garmentBounds!.x + result.garmentBounds!.width &&
          point.y <= result.garmentBounds!.y + result.garmentBounds!.height,
      ),
    );
  });
}

test("MarketPrint intent preserves owner uniform scale and translation", () => {
  const base = defaultOwnerArtworkPlacement(TEMPLATE);
  const centered = printIntentWithinGarment({
    productType: "Vacancy T-Shirt",
    printableArea: PRINTABLE,
    placement: base,
  })!;
  const adjusted = printIntentWithinGarment({
    productType: "Vacancy T-Shirt",
    printableArea: PRINTABLE,
    placement: { ...base, uniformScale: 0.6, offsetX: 1, offsetY: -1 },
  })!;
  assert.ok(adjusted.width < centered.width);
  assert.ok(adjusted.height < centered.height);
  assert.ok(adjusted.x > centered.x);
  assert.ok(adjusted.y < centered.y);
  assert.equal(
    adjusted.width / adjusted.height,
    centered.width / centered.height,
  );
});

test("low-confidence garment registration fails closed", async () => {
  const canvas = createCanvas(320, 420);
  const context = canvas.getContext("2d");
  context.fillStyle = "#b44c73";
  context.fillRect(0, 0, 320, 420);
  const result = await registerGeneratedGarmentV2({
    bytes: canvas.toBuffer("image/png"),
    productType: "Vacancy T-Shirt",
    productColor: "Schwarz",
    side: "FRONT",
    printableArea: PRINTABLE,
    ownerPlacement: defaultOwnerArtworkPlacement(TEMPLATE),
    faceBounds: FACE,
  });
  assert.equal(result.status, "LOW_CONFIDENCE");
  assert.equal(result.registeredPrintQuad, null);
});

test("front model registration fails closed when the face/neck exclusion cannot be established", async () => {
  const result = await registerGeneratedGarmentV2({
    bytes: baseWithShirt("#242529"),
    productType: "Vacancy T-Shirt",
    productColor: "Schwarz",
    side: "FRONT",
    printableArea: PRINTABLE,
    ownerPlacement: defaultOwnerArtworkPlacement(TEMPLATE),
    requireFaceBounds: true,
  });
  assert.equal(result.status, "LOW_CONFIDENCE");
  assert.equal(result.reason, "FACE_NOT_FOUND");
  assert.equal(result.registeredPrintQuad, null);
});

test("registered V2 region is consumed as the deterministic compositor surface", async () => {
  const registration = await registerGeneratedGarmentV2({
    bytes: baseWithShirt("#242529"),
    productType: "Vacancy T-Shirt",
    productColor: "Schwarz",
    side: "FRONT",
    printableArea: PRINTABLE,
    ownerPlacement: defaultOwnerArtworkPlacement(TEMPLATE),
    faceBounds: FACE,
  });
  const surface = printSurfaceSchema.parse({
    contractVersion: "print-surface-v1",
    printSurfaceId: "surface-front",
    productProfileId: "profile-1",
    variantId: null,
    version: 1,
    displayName: "Vorne",
    region: "front_center",
    geometryStatus: "CALIBRATED",
    surfaceKind: "PRINT",
    supportedPrintMethods: [],
    boundingBox: { x: 0.3, y: 0.3, width: 0.3, height: 0.3 },
    safeMargin: { top: 0, right: 0, bottom: 0, left: 0 },
    quad: [
      { x: 0.3, y: 0.3 }, { x: 0.6, y: 0.3 },
      { x: 0.6, y: 0.6 }, { x: 0.3, y: 0.6 },
    ],
    warpMode: "NONE",
    artworkScale: 1,
    rotationDegrees: 0,
    clippingMaskReference: null,
    calibration: null,
    authority: "PRODUCT_PROFILE",
    templateId: null,
    templateVersion: null,
    orientationDegrees: 0,
    perspectiveAnchors: [],
    provenance: {
      source: "OWNER_CALIBRATION",
      calibratedBy: "owner",
      calibratedAt: "2026-08-21T00:00:00.000Z",
    },
  });
  const registered = printSurfaceForGarmentRegistration(surface, registration);
  assert.deepEqual(registered.quad, registration.registeredPrintQuad);
  assert.equal(registered.warpMode, "NONE");
});
