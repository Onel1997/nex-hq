import assert from "node:assert/strict";
import test from "node:test";

import { createCanvas } from "canvas";

import { inspectBasePrintPurity } from "@/lib/image/deterministic-runtime/base-print-purity";
import { printSurfaceSchema } from "@/lib/image/print-surface/types";

const surface = printSurfaceSchema.parse({
  contractVersion: "print-surface-v1",
  printSurfaceId: "front-large",
  version: 1,
  productProfileId: "tee",
  variantId: null,
  region: "front_center",
  displayName: "Großer Frontprint",
  geometryStatus: "CALIBRATED",
  quad: [
    { x: 0.25, y: 0.2 },
    { x: 0.75, y: 0.2 },
    { x: 0.75, y: 0.75 },
    { x: 0.25, y: 0.75 },
  ],
  boundingBox: { x: 0.25, y: 0.2, width: 0.5, height: 0.55 },
  orientationDegrees: 0,
  perspectiveAnchors: [],
  clippingMaskReference: null,
  safeMargin: { top: 0, right: 0, bottom: 0, left: 0 },
  artworkScale: 1,
  rotationDegrees: 0,
  warpMode: "NONE",
  provenance: {
    source: "NEXHQ_PRODUCT_TEMPLATE",
    calibratedBy: null,
    calibratedAt: null,
  },
});

function baseImage(
  contaminated: boolean,
  garmentColor = "#c7ad96",
): Buffer {
  const canvas = createCanvas(400, 400);
  const context = canvas.getContext("2d");
  context.fillStyle = garmentColor;
  context.fillRect(0, 0, 400, 400);
  const gradient = context.createLinearGradient(100, 80, 300, 300);
  if (garmentColor === "#111111") {
    gradient.addColorStop(0, "#282828");
    gradient.addColorStop(1, "#090909");
  } else if (garmentColor === "#f4f2ed") {
    gradient.addColorStop(0, "#ffffff");
    gradient.addColorStop(1, "#d8d6d0");
  } else {
    gradient.addColorStop(0, "#d0b9a4");
    gradient.addColorStop(1, "#bfa58f");
  }
  context.fillStyle = gradient;
  context.fillRect(100, 80, 200, 220);
  context.strokeStyle = garmentColor === "#111111" ? "#333333" : "#a9917e";
  context.lineWidth = 4;
  context.beginPath();
  context.moveTo(112, 92);
  context.bezierCurveTo(155, 122, 235, 104, 288, 132);
  context.stroke();
  const fold = context.createLinearGradient(180, 110, 220, 290);
  fold.addColorStop(0, "rgba(0, 0, 0, 0)");
  fold.addColorStop(0.52, "rgba(0, 0, 0, 0.2)");
  fold.addColorStop(1, "rgba(255, 255, 255, 0.04)");
  context.fillStyle = fold;
  context.fillRect(170, 100, 65, 190);
  if (contaminated) {
    context.fillStyle = "#b3002d";
    context.fillRect(140, 165, 120, 62);
    context.fillStyle = "#ffffff";
    context.font = "bold 28px sans-serif";
    context.fillText("LOGO", 155, 205);
  }
  return canvas.toBuffer("image/png");
}

test("plain garment region passes the local Stage A purity guard", async () => {
  const result = await inspectBasePrintPurity({
    bytes: baseImage(false),
    printSurface: surface,
  });
  assert.equal(result.status, "PASS");
  assert.equal(result.reason, "CLEAR");
  assert.deepEqual(result.assessedRegion, {
    x: 100,
    y: 80,
    width: 200,
    height: 220,
  });
  assert.ok(result.analysisRegion.y > result.assessedRegion.y);
});

for (const [label, color] of [
  ["beige", "#c7ad96"],
  ["black", "#111111"],
  ["white", "#f4f2ed"],
] as const) {
  test(`normal ${label} fabric shadows, folds, and seams pass`, async () => {
    const result = await inspectBasePrintPurity({
      bytes: baseImage(false, color),
      printSurface: surface,
    });
    assert.equal(result.status, "PASS");
    assert.equal(result.reason, "CLEAR");
  });
}

test("coherent high-contrast garment graphic is rejected before Stage B", async () => {
  const result = await inspectBasePrintPurity({
    bytes: baseImage(true),
    printSurface: surface,
  });
  assert.equal(result.status, "SUSPECTED_CONTAMINATION");
  assert.equal(result.reason, "GRAPHIC_PATTERN");
  assert.ok(result.largestSharpComponentFraction > 0);
});

test("unreadable bases fail closed", async () => {
  const result = await inspectBasePrintPurity({
    bytes: Buffer.from("not-an-image"),
    printSurface: surface,
  });
  assert.equal(result.status, "SUSPECTED_CONTAMINATION");
  assert.equal(result.reason, "UNREADABLE_BASE");
});
