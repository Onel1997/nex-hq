import assert from "node:assert/strict";
import test from "node:test";

import { resolveFrontLargeProductionTuning } from "@/lib/image/front-large-production-tuning";
import { isAxisAlignedRectangleQuad } from "@/lib/image/artwork-compositing/compositor";
import { printSurfaceSchema } from "@/lib/image/print-surface/types";

const surface = printSurfaceSchema.parse({
  contractVersion: "print-surface-v1",
  printSurfaceId: "owner-front-center",
  version: 7,
  productProfileId: "heavy-oversized-tee",
  variantId: null,
  region: "front_center",
  displayName: "Front",
  geometryStatus: "CALIBRATED",
  quad: [
    { x: 0.384, y: 0.285 },
    { x: 0.63, y: 0.29 },
    { x: 0.625, y: 0.574 },
    { x: 0.39, y: 0.568 },
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
    source: "OWNER_CALIBRATION",
    calibratedBy: "owner",
    calibratedAt: "2026-08-20T10:00:00.000Z",
  },
});

test("new T-shirt front-large tuning is 10% larger than V3, higher, rectangular, and frozen separately", () => {
  const result = resolveFrontLargeProductionTuning({
    productType: "Heavy Oversized Tee",
    placementPreset: "FRONT_LARGE",
    surface,
  });
  assert.ok(result);
  const oldWidth = 0.63 - 0.384;
  const oldHeight = 0.574 - 0.285;
  const newWidth = result!.quad[1].x - result!.quad[0].x;
  const newHeight = result!.quad[3].y - result!.quad[0].y;
  assert.ok(Math.abs(newWidth / oldWidth - 1.452) < 1e-12);
  assert.ok(Math.abs(newHeight / oldHeight - 1.452) < 1e-12);
  const oldCenterY = (0.285 + 0.574) / 2;
  const newCenterY = (result!.quad[0].y + result!.quad[3].y) / 2;
  assert.ok(Math.abs(newCenterY - (oldCenterY + 0.015)) < 1e-12);
  assert.equal(result!.version, "nexhq-front-large-tuning-v4");
  assert.equal(isAxisAlignedRectangleQuad(result!.quad), true);
  assert.equal(surface.quad?.[0].x, 0.384, "canonical Product truth is unchanged");
});

test("non-T-shirt and non-front-large placements are not reinterpreted", () => {
  assert.equal(
    resolveFrontLargeProductionTuning({
      productType: "Zip Hoodie",
      placementPreset: "FRONT_LARGE",
      surface,
    }),
    null,
  );
  assert.equal(
    resolveFrontLargeProductionTuning({
      productType: "Heavy Oversized Tee",
      placementPreset: "BACK_LARGE",
      surface,
    }),
    null,
  );
});
