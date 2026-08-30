import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveBothSidePlan,
  resolveSemanticPlacement,
  semanticPlacementOptions,
  semanticPlacementSnapshot,
} from "@/lib/image/semantic-print-placement";
import {
  printSurfaceSchema,
  type PrintSurface,
} from "@/lib/image/print-surface/types";

const QUAD = [
  { x: 0.3, y: 0.3 },
  { x: 0.7, y: 0.3 },
  { x: 0.7, y: 0.7 },
  { x: 0.3, y: 0.7 },
] as const;

function surface(
  printSurfaceId: string,
  region: PrintSurface["region"],
  version = 1,
): PrintSurface {
  return printSurfaceSchema.parse({
    contractVersion: "print-surface-v1",
    printSurfaceId,
    version,
    productProfileId: "product-1",
    variantId: "variant-1",
    region,
    geometryStatus: "HUMAN_DEFINED",
    quad: QUAD,
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
      calibratedAt: "2026-08-19T12:00:00.000Z",
    },
  });
}

test("FRONT_LARGE resolves only to the exact existing front PrintSurface", () => {
  const result = resolveSemanticPlacement({
    productType: "Oversized T-Shirt",
    variantId: "variant-1",
    printSide: "FRONT",
    placementPreset: "FRONT_LARGE",
    printSurfaces: [surface("front-v1", "front_center", 2)],
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.surface.printSurfaceId, "front-v1");
  assert.equal(result.surface.version, 2);
  assert.equal(
    semanticPlacementSnapshot({
      printSide: "FRONT",
      placementPreset: "FRONT_LARGE",
      surface: result.surface,
    }).placementPreset,
    "FRONT_LARGE",
  );
});

test("BACK_LARGE resolves to back_center and missing geometry fails closed", () => {
  const back = resolveSemanticPlacement({
    productType: "Hoodie",
    variantId: "variant-1",
    printSide: "BACK",
    placementPreset: "BACK_LARGE",
    printSurfaces: [surface("back-v1", "back_center")],
  });
  assert.equal(back.ok, true);

  const missing = resolveSemanticPlacement({
    productType: "Hoodie",
    variantId: "variant-1",
    printSide: "BACK",
    placementPreset: "BACK_LARGE",
    printSurfaces: [],
  });
  assert.equal(missing.ok, false);
  if (missing.ok) return;
  assert.equal(missing.code, "MISSING_SURFACE");
  assert.match(missing.message, /keine passende Druckfläche/i);
});

test("Zip Hoodie never fabricates a centered front placement", () => {
  const centered = resolveSemanticPlacement({
    productType: "Zip Hoodie",
    variantId: "variant-1",
    printSide: "FRONT",
    placementPreset: "FRONT_LARGE",
    printSurfaces: [surface("center", "front_center")],
  });
  assert.equal(centered.ok, false);
  if (!centered.ok) assert.equal(centered.code, "INCOMPATIBLE_PRODUCT");

  const left = resolveSemanticPlacement({
    productType: "Zip Hoodie",
    variantId: "variant-1",
    printSide: "FRONT",
    placementPreset: "FRONT_LEFT_CHEST",
    printSurfaces: [surface("left", "front_left")],
  });
  assert.equal(left.ok, true);
});

test("Jogger receives leg presets and no chest presets", () => {
  const options = semanticPlacementOptions({
    productType: "Heavy Jogger",
    side: "FRONT",
  });
  assert.ok(options.some((option) => option.preset === "LEFT_LEG"));
  assert.ok(options.some((option) => option.preset === "UPPER_RIGHT_LEG"));
  assert.equal(
    options.some((option) => option.preset === "FRONT_LEFT_CHEST"),
    false,
  );
});

test("BOTH is a two-side plan and does not create an execution aggregate", () => {
  const plan = resolveBothSidePlan({
    productType: "T-Shirt",
    variantId: "variant-1",
    preset: "FRONT_LEFT_BACK_LARGE",
    printSurfaces: [
      surface("front", "front_left_chest"),
      surface("back", "back_center"),
    ],
  });
  assert.equal(plan.compatible, true);
  assert.equal(plan.front?.ok, true);
  assert.equal(plan.back?.ok, true);
  assert.equal("jobs" in plan, false);
  assert.equal("assets" in plan, false);
});
