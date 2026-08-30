import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_ORIENTED_FRONT_PRINT_PLANE_POLICY,
  DEFAULT_NORMAL_ASSISTED_ORIENTED_FRONT_PRINT_PLANE_POLICY,
  ORIENTED_FRONT_PRINT_PLANE_NORMAL_ASSISTED_VERSION,
  ORIENTED_FRONT_PRINT_PLANE_V2_LEGACY_VERSION,
  ORIENTED_FRONT_PRINT_PLANE_VERSION,
  resolveOrientedFrontPrintPlaneV2,
  supportsOrientedFrontPrintPlane,
} from "@/lib/image/deterministic-runtime/oriented-front-print-plane-v2";
import type { FrontTorsoPrintEnvelope } from "@/lib/image/deterministic-runtime/front-torso-print-envelope";
import type { NormalOrientationEvidence } from "@/lib/image/normal-estimation/types";

const envelope: FrontTorsoPrintEnvelope = {
  contractVersion: "nexhq-front-torso-print-envelope-v1",
  status: "READY",
  reason: "READY",
  fullGarmentBounds: { x: 0.14, y: 0.08, width: 0.72, height: 0.84 },
  torsoBounds: { x: 0.29, y: 0.23, width: 0.42, height: 0.64 },
  printableTorsoBounds: { x: 0.305, y: 0.27, width: 0.39, height: 0.54 },
  fullGarmentWidthRatio: 0.72,
  torsoWidthRatio: 0.42,
  torsoHeightRatio: 0.64,
  torsoToFullWidthRatio: 0.583,
  sleeveSuppressionRatio: 0.416,
  shoulderSuppressionRatio: 0.25,
  sleeveInfluenceRemoved: true,
  shoulderFlareRemoved: true,
  collarClearanceApplied: true,
  sampledRowCount: 220,
  stableRowCount: 210,
  rowWidthStability: 0.96,
  confidence: 0.93,
};

test("only fresh supported T-shirt front presets are eligible", () => {
  for (const preset of [
    "FRONT_LARGE",
    "FRONT_CENTER_CHEST",
    "FRONT_LEFT_CHEST",
  ] as const) {
    assert.equal(
      supportsOrientedFrontPrintPlane("Oversized T-Shirt", "FRONT", preset),
      true,
    );
  }
  assert.equal(
    supportsOrientedFrontPrintPlane("Oversized T-Shirt", "BACK", "FRONT_LARGE"),
    false,
  );
  assert.equal(
    supportsOrientedFrontPrintPlane("Zip Hoodie", "FRONT", "FRONT_LARGE"),
    false,
  );
});

function rows(input: {
  centerSlope?: number;
  widthSlope?: number;
  upperDisagreement?: number;
  backgroundOutliers?: boolean;
} = {}) {
  const centerSlope = input.centerSlope ?? 0;
  return Array.from({ length: 601 }, (_, index) => {
    const row = 220 + index;
    const y = row / 1000;
    const disagreement =
      y < 0.43 ? (input.upperDisagreement ?? 0) * Math.sin(index * 0.31) : 0;
    const center = 500 + centerSlope * (row - 520) + disagreement;
    const width =
      input.backgroundOutliers && index % 47 === 0
        ? 760
        : 390 + (input.widthSlope ?? 0) * (row - 520);
    return {
      row,
      left: Math.round(center - width / 2),
      right: Math.round(center + width / 2),
    };
  });
}

function resolve(input: {
  centerSlope?: number;
  widthSlope?: number;
  bounds?: { x: number; y: number; width: number; height: number };
  ownerScale?: number;
  ownerOffsetX?: number;
  ownerOffsetY?: number;
  upperDisagreement?: number;
  backgroundOutliers?: boolean;
}) {
  return resolveOrientedFrontPrintPlaneV2({
    rows: rows(input),
    imageWidth: 1000,
    imageHeight: 1000,
    torsoEnvelope: envelope,
    printBounds: input.bounds ?? { x: 0.38, y: 0.37, width: 0.24, height: 0.32 },
    ownerScale: input.ownerScale ?? 0.86,
    ownerOffsetX: input.ownerOffsetX ?? 0,
    ownerOffsetY: input.ownerOffsetY ?? -0.08,
    policy: DEFAULT_ORIENTED_FRONT_PRINT_PLANE_POLICY,
    maskContains: (x, y) =>
      x >= 0.29 && x <= 0.71 && y >= 0.23 && y <= 0.87,
  });
}

test("Clean Studio straight shirt freezes a near-zero oriented plane", () => {
  const result = resolve({});
  assert.equal(result.contractVersion, ORIENTED_FRONT_PRINT_PLANE_VERSION);
  assert.equal(result.status, "READY");
  assert.ok(Math.abs(result.appliedRotationDegrees) < 0.1);
  assert.equal(result.backgroundEvidenceExcluded, true);
  assert.equal(result.globalFootprintPreserved, true);
  assert.equal(result.secondContainApplied, false);
  assert.equal(result.secondGlobalScaleApplied, false);
  assert.equal(result.secondGlobalTranslationApplied, false);
});

test("Parkhaus mild right and left torso lean produce signed mild orientation", () => {
  const right = resolve({ centerSlope: -0.035 });
  const left = resolve({ centerSlope: 0.035 });
  assert.equal(right.status, "READY");
  assert.equal(left.status, "READY");
  assert.ok(right.appliedRotationDegrees > 1.5);
  assert.ok(left.appliedRotationDegrees < -1.5);
  assert.ok(Math.abs(right.appliedRotationDegrees) < 5);
  assert.ok(Math.abs(left.appliedRotationDegrees) < 5);
});

test("background-width outliers cannot control the garment-only orientation", () => {
  const clean = resolve({ centerSlope: -0.028 });
  const withPillars = resolve({
    centerSlope: -0.028,
    backgroundOutliers: true,
  });
  assert.equal(clean.status, "READY");
  assert.equal(withPillars.status, "READY");
  assert.ok(
    Math.abs(
      clean.appliedRotationDegrees - withPillars.appliedRotationDegrees,
    ) < 0.05,
  );
});

test("shoulder/collar disagreement reduces orientation confidence", () => {
  const stable = resolve({ centerSlope: -0.02 });
  const disagreeing = resolve({
    centerSlope: -0.02,
    upperDisagreement: 18,
  });
  assert.ok(
    disagreeing.orientationConfidence < stable.orientationConfidence,
  );
  assert.ok(
    disagreeing.shoulderCollarAgreement < stable.shoulderCollarAgreement,
  );
});

test("owner X/Y/scale move the same oriented plane without changing orientation", () => {
  const original = resolve({ centerSlope: -0.03 });
  const moved = resolve({
    centerSlope: -0.03,
    bounds: { x: 0.4, y: 0.34, width: 0.2, height: 0.27 },
    ownerScale: 0.72,
    ownerOffsetX: 0.1,
    ownerOffsetY: -0.18,
  });
  assert.equal(original.status, "READY");
  assert.equal(moved.status, "READY");
  assert.ok(
    Math.abs(
      original.appliedRotationDegrees - moved.appliedRotationDegrees,
    ) < 0.05,
  );
  assert.equal(moved.ownerScale, 0.72);
  assert.equal(moved.ownerOffsetX, 0.1);
  assert.equal(moved.ownerOffsetY, -0.18);
  const movedCenterY =
    moved.orientedQuad!.reduce((sum, point) => sum + point.y, 0) / 4;
  assert.ok(Number.isFinite(movedCenterY));
  assert.ok(
    Math.abs(
      moved.ownerLocalFootprint!.localY - (0.34 - 0.27) / 0.54,
    ) < 1e-9,
  );
});

test("a 90% FRONT_LARGE footprint remains valid in the oriented torso frame", () => {
  const result = resolve({
    centerSlope: -0.045,
    bounds: { x: 0.31, y: 0.275, width: 0.38, height: 0.525 },
    ownerScale: 0.9,
  });
  assert.equal(result.status, "READY");
  assert.ok(Math.abs(result.appliedRotationDegrees) > 2);
  assert.equal(result.containment?.torsoPolygon.status, "PASS");
  assert.equal(result.containment?.samMask.status, "PASS");
  assert.equal(result.ownerScale, 0.9);
  assert.equal(result.globalFootprintPreserved, true);
});

test("Parkhaus -2.62 degree lean with silhouette taper projects safely instead of hitting the old perspective gate", () => {
  const centerSlope = Math.tan((2.62 * Math.PI) / 180);
  const result = resolve({
    centerSlope,
    widthSlope: 0.17,
    bounds: { x: 0.31, y: 0.3, width: 0.37, height: 0.48 },
    ownerScale: 0.9,
  });
  assert.equal(result.status, "READY");
  assert.ok(Math.abs(result.estimatedRotationDegrees + 2.62) < 0.1);
  assert.ok(Math.abs(result.rawBoundaryTaper ?? 0) > 0.1);
  assert.ok(
    Math.abs(result.perspectiveAmount) <=
      DEFAULT_ORIENTED_FRONT_PRINT_PLANE_POLICY.maximumPerspectiveRatio + 1e-9,
  );
  assert.equal(result.samContainment, 1);
  assert.equal(result.containment?.collar.status, "PASS");
  assert.equal(result.containment?.hem.status, "PASS");
});

test("oriented torso containment uses the polygon rather than the old upright AABB", () => {
  const result = resolve({
    centerSlope: 0.046,
    bounds: { x: 0.315, y: 0.29, width: 0.37, height: 0.49 },
  });
  assert.equal(result.status, "READY");
  assert.equal(result.allCornersInsideTorso, true);
  assert.ok(
    result.orientedQuad!.some(
      (point) => point.x < envelope.printableTorsoBounds!.x ||
        point.x >
          envelope.printableTorsoBounds!.x +
            envelope.printableTorsoBounds!.width,
    ),
  );
});

test("true local U/V overflow fails without reducing owner scale", () => {
  const result = resolve({
    centerSlope: -0.03,
    bounds: { x: 0.29, y: 0.26, width: 0.41, height: 0.56 },
    ownerScale: 0.9,
  });
  assert.equal(result.status, "REFUSED");
  assert.ok(
    ["ORIENTED_PLANE_OUTSIDE_TORSO", "ORIENTED_PLANE_COLLAR_UNSAFE"].includes(
      result.reason,
    ),
  );
  assert.equal(result.globalFootprintPreserved, true);
  assert.equal(result.ownerScale, 0.9);
  assert.equal(result.appliedRotationDegrees, 0);
  assert.ok((result.containment?.overflow?.left ?? 0) > 0);
});

test("early orientation refusal reports containment as NOT_EVALUATED, never fake zero", () => {
  const result = resolve({ centerSlope: 0.16 });
  assert.equal(result.status, "REFUSED");
  assert.equal(result.reason, "ORIENTED_PLANE_UNSAFE_ROTATION");
  assert.equal(result.samContainment, null);
  assert.equal(result.collarClearanceApplied, null);
  assert.equal(result.hemClearanceApplied, null);
  assert.equal(result.containment?.samMask.status, "NOT_EVALUATED");
  assert.equal(result.containment?.collar.status, "NOT_EVALUATED");
});

test("historical V2 policy retains the frozen post-hoc rectangle behavior", () => {
  const result = resolveOrientedFrontPrintPlaneV2({
    rows: rows({ centerSlope: -0.03 }),
    imageWidth: 1000,
    imageHeight: 1000,
    torsoEnvelope: envelope,
    printBounds: { x: 0.38, y: 0.37, width: 0.24, height: 0.32 },
    ownerScale: 0.86,
    ownerOffsetX: 0,
    ownerOffsetY: 0,
    policy: {
      ...DEFAULT_ORIENTED_FRONT_PRINT_PLANE_POLICY,
      contractVersion: ORIENTED_FRONT_PRINT_PLANE_V2_LEGACY_VERSION,
    },
    maskContains: (x, y) =>
      x >= 0.29 && x <= 0.71 && y >= 0.23 && y <= 0.87,
  });
  assert.equal(result.contractVersion, ORIENTED_FRONT_PRINT_PLANE_V2_LEGACY_VERSION);
  assert.equal(result.torsoFrame, undefined);
});

function normalEvidence(orientationDegrees: number, confidence = 0.9): NormalOrientationEvidence {
  return {
    contractVersion: "nexhq-normal-assisted-oriented-torso-v1",
    status: "READY",
    reason: "READY",
    orientationDegrees,
    confidence,
    usableSamples: 240,
    rejectedOutliers: 12,
    medianNormal: { x: 0.08, y: -0.02, z: 0.996 },
    fieldConsistency: 0.91,
    directionalAnisotropy: 0.84,
    backgroundEvidenceExcluded: true,
    sleevesExcluded: true,
    collarTransitionExcluded: true,
    coordinateConvention: "IMAGE_X_RIGHT_IMAGE_Y_DOWN_NORMAL_Y_UP",
  };
}

test("V2.2 lets strong garment normals rescue weak silhouette without changing owner authority", () => {
  const weakRows = rows({ centerSlope: -0.015 }).map((row, index) => {
    const drift = Math.sin(index * 0.19) * 11;
    return {
      ...row,
      left: Math.round(row.left + drift),
      right: Math.round(row.right + drift),
    };
  });
  const result = resolveOrientedFrontPrintPlaneV2({
    rows: weakRows,
    imageWidth: 1000,
    imageHeight: 1000,
    torsoEnvelope: { ...envelope, rowWidthStability: 0.4, confidence: 0.5 },
    printBounds: { x: 0.38, y: 0.37, width: 0.24, height: 0.32 },
    ownerScale: 0.9,
    ownerOffsetX: 0.08,
    ownerOffsetY: -0.12,
    policy: DEFAULT_NORMAL_ASSISTED_ORIENTED_FRONT_PRINT_PLANE_POLICY,
    normalOrientation: normalEvidence(3.2),
    maskContains: (x, y) => x >= 0.29 && x <= 0.71 && y >= 0.23 && y <= 0.87,
  });
  assert.equal(result.contractVersion, ORIENTED_FRONT_PRINT_PLANE_NORMAL_ASSISTED_VERSION);
  assert.equal(result.status, "READY");
  assert.equal(result.normalAssistance?.relationship, "NORMAL_RESCUES_SILHOUETTE");
  assert.ok(Math.abs(result.appliedRotationDegrees - 3.2) < 0.1);
  assert.equal(result.ownerScale, 0.9);
  assert.equal(result.ownerOffsetX, 0.08);
  assert.equal(result.ownerOffsetY, -0.12);
  assert.equal(result.secondContainApplied, false);
  assert.equal(result.secondGlobalScaleApplied, false);
  assert.equal(result.secondGlobalTranslationApplied, false);
});

test("V2.2 keeps strong silhouette when normal evidence is weak", () => {
  const result = resolveOrientedFrontPrintPlaneV2({
    rows: rows({ centerSlope: -0.035 }), imageWidth: 1000, imageHeight: 1000,
    torsoEnvelope: envelope, printBounds: { x: 0.38, y: 0.37, width: 0.24, height: 0.32 },
    ownerScale: 0.86, ownerOffsetX: 0, ownerOffsetY: 0,
    policy: DEFAULT_NORMAL_ASSISTED_ORIENTED_FRONT_PRINT_PLANE_POLICY,
    normalOrientation: normalEvidence(0.5, 0.3),
    maskContains: (x, y) => x >= 0.29 && x <= 0.71 && y >= 0.23 && y <= 0.87,
  });
  assert.equal(result.status, "READY");
  assert.equal(result.normalAssistance?.relationship, "SILHOUETTE_RESCUES_NORMAL");
});

test("V2.2 fails closed when strong normal and silhouette orientations contradict", () => {
  const result = resolveOrientedFrontPrintPlaneV2({
    rows: rows({ centerSlope: 0.07 }), imageWidth: 1000, imageHeight: 1000,
    torsoEnvelope: envelope, printBounds: { x: 0.38, y: 0.37, width: 0.24, height: 0.32 },
    ownerScale: 0.86, ownerOffsetX: 0, ownerOffsetY: 0,
    policy: DEFAULT_NORMAL_ASSISTED_ORIENTED_FRONT_PRINT_PLANE_POLICY,
    normalOrientation: normalEvidence(5.5, 0.92),
    maskContains: (x, y) => x >= 0.29 && x <= 0.71 && y >= 0.23 && y <= 0.87,
  });
  assert.equal(result.status, "REFUSED");
  assert.equal(result.reason, "NORMAL_SILHOUETTE_CONTRADICTORY");
  assert.equal(result.samContainment, null);
});
