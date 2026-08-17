import assert from "node:assert/strict";
import test from "node:test";

import { assertPrintSurfaceReady, printSurfaceSchema } from "@/lib/image/print-surface/types";
import { EMPTY_CORNER_FIELDS, validateHumanDefinedQuad } from "@/lib/image/print-surface/validate-quad";

const base = {
  contractVersion: "print-surface-v1" as const,
  printSurfaceId: "surface-1",
  productProfileId: "product-1",
  variantId: null,
  region: "front_center" as const,
  boundingBox: null,
  orientationDegrees: 0,
  perspectiveAnchors: [],
  clippingMaskReference: null,
  safeMargin: { top: 0, right: 0, bottom: 0, left: 0 },
  artworkScale: 1,
  rotationDegrees: 0,
  warpMode: "PERSPECTIVE" as const,
  provenance: { source: "UNKNOWN" as const, calibratedBy: null, calibratedAt: null },
};

test("unknown Shopify geometry remains visibly uncalibrated", () => {
  const surface = printSurfaceSchema.parse({
    ...base,
    geometryStatus: "REQUIRES_CALIBRATION",
    quad: null,
  });
  assert.throws(() => assertPrintSurfaceReady(surface), /requires explicit/);
});

test("uncalibrated surface rejects invented quad", () => {
  assert.throws(() => printSurfaceSchema.parse({
    ...base,
    geometryStatus: "REQUIRES_CALIBRATION",
    quad: [{ x: 0.1, y: 0.1 }, { x: 0.9, y: 0.1 }, { x: 0.9, y: 0.9 }, { x: 0.1, y: 0.9 }],
  }));
});

test("empty corners are a missing PrintSurface, not fabricated geometry", () => {
  const result = validateHumanDefinedQuad(EMPTY_CORNER_FIELDS);
  assert.equal(result.ok, false);
  if (result.ok) throw new Error("expected missing PrintSurface");
  assert.equal(result.code, "MISSING_PRINT_SURFACE");
  assert.match(result.message, /Define the four front_center print-area corners/);
});

test("coordinates outside 0–1 are invalid", () => {
  const result = validateHumanDefinedQuad({
    tlx: "0.2", tly: "0.2", trx: "1.2", try: "0.2", brx: "0.8", bry: "0.8", blx: "0.2", bly: "0.8",
  });
  assert.equal(result.ok, false);
  if (result.ok) throw new Error("expected invalid coordinates");
  assert.equal(result.code, "INVALID_PRINT_SURFACE");
  assert.equal(result.fieldErrors.trx, "Must be between 0 and 1");
});

test("degenerate and mis-ordered quads are rejected", () => {
  const collinear = validateHumanDefinedQuad({
    tlx: "0.1", tly: "0.1", trx: "0.2", try: "0.1", brx: "0.3", bry: "0.1", blx: "0.4", bly: "0.1",
  });
  assert.equal(collinear.ok, false);
  const reversed = validateHumanDefinedQuad({
    tlx: "0.7", tly: "0.7", trx: "0.3", try: "0.7", brx: "0.3", bry: "0.3", blx: "0.7", bly: "0.3",
  });
  assert.equal(reversed.ok, false);
  if (reversed.ok) throw new Error("expected reversed ordering to fail");
  assert.match(reversed.message, /ordered TL → TR → BR → BL/);
});

test("human-defined surface requires a usable ordered quad", () => {
  const valid = printSurfaceSchema.parse({
    ...base,
    geometryStatus: "HUMAN_DEFINED",
    provenance: { source: "OWNER_CALIBRATION", calibratedBy: "owner", calibratedAt: "2026-08-17T12:00:00.000Z" },
    quad: [{ x: 0.3, y: 0.35 }, { x: 0.7, y: 0.35 }, { x: 0.68, y: 0.7 }, { x: 0.32, y: 0.7 }],
  });
  assertPrintSurfaceReady(valid);
  assert.throws(() => printSurfaceSchema.parse({
    ...base,
    geometryStatus: "HUMAN_DEFINED",
    provenance: { source: "OWNER_CALIBRATION", calibratedBy: "owner", calibratedAt: "2026-08-17T12:00:00.000Z" },
    quad: [{ x: 0.5, y: 0.5 }, { x: 0.5, y: 0.5 }, { x: 0.5, y: 0.5 }, { x: 0.5, y: 0.5 }],
  }));
});
