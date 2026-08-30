import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { createCanvas } from "canvas";

import {
  printIntentWithinGarment,
  FRONT_LARGE_EFFECTIVE_SCALE_MULTIPLIER,
  FRONT_LARGE_UPWARD_SHIFT_GARMENT_RATIO,
  printSurfaceForGarmentRegistrationV3,
  registerGeneratedGarmentV3,
  type NormalizedBounds,
} from "@/lib/image/deterministic-runtime/garment-registration-v3";
import { defaultOwnerArtworkPlacement } from "@/lib/product-library/product-family";
import { printSurfaceSchema } from "@/lib/image/print-surface/types";
import { createOwnerPrintFootprint } from "@/lib/image/owner-print-footprint";
import { createOwnerVerticalPlacement } from "@/lib/image/owner-vertical-placement";
import {
  DEFAULT_ORIENTED_FRONT_PRINT_PLANE_POLICY,
  ORIENTED_FRONT_PRINT_PLANE_VERSION,
} from "@/lib/image/deterministic-runtime/oriented-front-print-plane-v2";

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
  context.fillRect(55, 112, 45, 82);
  context.fillRect(220, 112, 45, 82);
  context.fillRect(72, 112, 176, 280);
  context.fillStyle = "rgba(255,255,255,.08)";
  context.fillRect(120, 112, 8, 280);
  context.fillStyle = "rgba(0,0,0,.07)";
  context.fillRect(196, 112, 7, 280);
  return canvas.toBuffer("image/png");
}

function shirtMask(): Buffer {
  const canvas = createCanvas(320, 420);
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#fff";
  context.fillRect(55, 112, 45, 82);
  context.fillRect(220, 112, 45, 82);
  context.fillRect(72, 112, 176, 280);
  return canvas.toBuffer("image/png");
}

function leaningShirtMask(direction: -1 | 1): Buffer {
  const canvas = createCanvas(320, 420);
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#fff";
  const topShift = direction * -5;
  const bottomShift = direction * 5;
  context.beginPath();
  context.moveTo(72 + topShift, 112);
  context.lineTo(248 + topShift, 112);
  context.lineTo(248 + bottomShift, 392);
  context.lineTo(72 + bottomShift, 392);
  context.closePath();
  context.fill();
  context.fillRect(55 + topShift, 112, 45, 82);
  context.fillRect(220 + topShift, 112, 45, 82);
  return canvas.toBuffer("image/png");
}

function placement(scale = 0.9, offsetX = 0, offsetY = 0) {
  return {
    ...defaultOwnerArtworkPlacement(TEMPLATE),
    uniformScale: scale,
    offsetX,
    offsetY,
  };
}

for (const [label, color, value] of [
  ["white", "#e8e6df", "Weiß"],
  ["black", "#242529", "Schwarz"],
  ["beige", "#bea98d", "Beige"],
  ["light blue", "#98c3dc", "Babyblau"],
] as const) {
  test(`V3 keeps a ${label} large-front print large, central and below the collar`, async () => {
    const ownerPlacement = placement();
    const mask = shirtMask();
    const ownerPrintFootprint = createOwnerPrintFootprint({
      placementPreset: "FRONT_LARGE",
      printableArea: PRINTABLE,
      ownerPlacement,
      artworkWidth: 5000,
      artworkHeight: 5000,
      referenceWidth: 320,
      referenceHeight: 420,
    });
    const result = await registerGeneratedGarmentV3({
      bytes: baseWithShirt(color),
      productType: "Vacancy T-Shirt",
      productColor: value,
      side: "FRONT",
      printableArea: PRINTABLE,
      ownerPlacement,
      ownerPrintFootprint,
      placementPreset: "FRONT_LARGE",
      faceBounds: FACE,
      requireFaceBounds: true,
      segmentationMask: {
        bytes: mask,
        checksumSha256: createHash("sha256").update(mask).digest("hex"),
        width: 320,
        height: 420,
      },
    });
    assert.equal(result.status, "REGISTERED");
    assert.equal(result.reason, "REGISTERED");
    assert.equal(result.placementEvidence?.largeFrontPreserved, true);
    assert.equal(result.placementEvidence?.sizeReductionRatio, 1);
    const body = result.garmentBodyBounds!;
    const box = result.placementEvidence!.finalPrintBounds;
    const centerY = (box.y + box.height / 2 - body.y) / body.height;
    const centerX = (box.x + box.width / 2 - body.x) / body.width;
    assert.ok(box.width / body.width >= 0.5);
    assert.ok(box.height / body.height >= 0.42);
    assert.ok(Math.abs(centerY - ownerPrintFootprint.requestedCenterY) < 1e-9);
    assert.ok(Math.abs(centerX - ownerPrintFootprint.requestedCenterX) < 1e-9);
    assert.ok(box.y > FACE.y + FACE.height);
    assert.ok(box.x >= body.x && box.x + box.width <= body.x + body.width);
    assert.equal(result.frontTorsoEnvelope?.status, "READY");
  });
}

test("large front, center chest, and left chest are distinct garment intents", () => {
  const common = {
    productType: "Vacancy T-Shirt",
    printableArea: PRINTABLE,
    placement: placement(),
  };
  const large = printIntentWithinGarment({ ...common, placementPreset: "FRONT_LARGE" })!;
  const center = printIntentWithinGarment({ ...common, placementPreset: "FRONT_CENTER_CHEST" })!;
  const left = printIntentWithinGarment({ ...common, placementPreset: "FRONT_LEFT_CHEST" })!;
  assert.ok(large.width > center.width);
  assert.ok(large.height > center.height);
  assert.ok(large.y + large.height / 2 > center.y + center.height / 2);
  assert.ok(left.x + left.width / 2 > center.x + center.width / 2);
  const untunedLargeWidth = (PRINTABLE.width / 0.72) * 0.9;
  assert.ok(
    Math.abs(
      large.width / untunedLargeWidth -
        FRONT_LARGE_EFFECTIVE_SCALE_MULTIPLIER,
    ) < 1e-12,
  );
  assert.ok(large.y + large.height / 2 < 0.54);
});

test("owner large-front translation and uniform scale remain frozen when safe", async () => {
  const centered = await registerGeneratedGarmentV3({
    bytes: baseWithShirt("#242529"),
    productType: "Vacancy T-Shirt",
    productColor: "Schwarz",
    side: "FRONT",
    printableArea: PRINTABLE,
    ownerPlacement: placement(0.9),
    placementPreset: "FRONT_LARGE",
    faceBounds: FACE,
  });
  const moved = await registerGeneratedGarmentV3({
    bytes: baseWithShirt("#242529"),
    productType: "Vacancy T-Shirt",
    productColor: "Schwarz",
    side: "FRONT",
    printableArea: PRINTABLE,
    ownerPlacement: placement(0.8, 0.8, 0.8),
    placementPreset: "FRONT_LARGE",
    faceBounds: FACE,
  });
  assert.equal(centered.status, "REGISTERED");
  assert.equal(moved.status, "REGISTERED");
  assert.ok(moved.placementEvidence!.finalPrintBounds.width < centered.placementEvidence!.finalPrintBounds.width);
  assert.ok(moved.placementEvidence!.finalPrintBounds.x > centered.placementEvidence!.finalPrintBounds.x);
  assert.ok(moved.placementEvidence!.finalPrintBounds.y >= centered.placementEvidence!.finalPrintBounds.y);
  assert.equal(
    centered.placementEvidence!.frontLargeTuning?.scaleMultiplier,
    FRONT_LARGE_EFFECTIVE_SCALE_MULTIPLIER,
  );
  assert.equal(
    centered.placementEvidence!.frontLargeTuning
      ?.upwardShiftGarmentRatio,
    FRONT_LARGE_UPWARD_SHIFT_GARMENT_RATIO,
  );
});

test("unsafe small large-front intent fails instead of becoming a chest print", async () => {
  const result = await registerGeneratedGarmentV3({
    bytes: baseWithShirt("#242529"),
    productType: "Vacancy T-Shirt",
    productColor: "Schwarz",
    side: "FRONT",
    printableArea: PRINTABLE,
    ownerPlacement: placement(0.3),
    placementPreset: "FRONT_LARGE",
    faceBounds: FACE,
  });
  assert.equal(result.status, "LOW_CONFIDENCE");
  assert.equal(result.reason, "LARGE_FRONT_UNSAFE");
  assert.equal(result.placementEvidence?.largeFrontPreserved, false);
  assert.equal(result.registeredPrintQuad, null);
});

test("registered V3 surface consumes the exact final garment-relative region", async () => {
  const registration = await registerGeneratedGarmentV3({
    bytes: baseWithShirt("#242529"),
    productType: "Vacancy T-Shirt",
    productColor: "Schwarz",
    side: "FRONT",
    printableArea: PRINTABLE,
    ownerPlacement: placement(),
    placementPreset: "FRONT_LARGE",
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
  const registered = printSurfaceForGarmentRegistrationV3(surface, registration);
  assert.deepEqual(registered.quad, registration.registeredPrintQuad);
  assert.equal(registered.warpMode, "NONE");
});

test("V3 consumes the validated SAM mask as its strongest garment boundary evidence", async () => {
  const mask = shirtMask();
  const checksum = createHash("sha256").update(mask).digest("hex");
  const registration = await registerGeneratedGarmentV3({
    bytes: baseWithShirt("#242529"),
    productType: "Vacancy T-Shirt",
    productColor: "Schwarz",
    side: "FRONT",
    printableArea: PRINTABLE,
    ownerPlacement: placement(),
    placementPreset: "FRONT_LARGE",
    faceBounds: FACE,
    segmentationMask: {
      bytes: mask,
      checksumSha256: checksum,
      width: 320,
      height: 420,
    },
  });
  assert.equal(registration.status, "REGISTERED");
  assert.equal(registration.boundaryEvidence, "SAM3_VALIDATED_MASK");
  assert.equal(registration.segmentationMaskChecksumSha256, checksum);
  assert.equal(registration.placementEvidence?.largeFrontPreserved, true);
  assert.ok(registration.maskCoverage >= 0.78);
});

test("owner footprint maps once and remains large without chest fallback", async () => {
  const ownerPlacement = placement();
  const ownerPrintFootprint = createOwnerPrintFootprint({
    placementPreset: "FRONT_LARGE",
    printableArea: PRINTABLE,
    ownerPlacement,
    artworkWidth: 5000,
    artworkHeight: 5000,
    referenceWidth: 320,
    referenceHeight: 420,
  });
  const result = await registerGeneratedGarmentV3({
    bytes: baseWithShirt("#242529"),
    productType: "Vacancy T-Shirt",
    productColor: "Schwarz",
    side: "FRONT",
    printableArea: PRINTABLE,
    ownerPlacement: { ...ownerPlacement, uniformScale: 1 },
    ownerPrintFootprint,
    placementPreset: "FRONT_LARGE",
    faceBounds: FACE,
    segmentationMask: {
      bytes: shirtMask(),
      checksumSha256: createHash("sha256").update(shirtMask()).digest("hex"),
      width: 320,
      height: 420,
    },
  });
  assert.equal(result.status, "REGISTERED");
  const evidence = result.placementEvidence?.ownerPrintFootprint;
  assert.ok(evidence);
  assert.equal(evidence.footprintPreserved, true);
  assert.equal(evidence.registrationScaleDelta, 0);
  assert.ok(evidence.registeredWidthRatio >= 0.85);
  assert.equal(result.placementEvidence?.ownerUniformScale, 0.9);
  assert.equal(result.placementEvidence?.frontLargeTuning, undefined);
  assert.equal(result.frontTorsoEnvelope?.status, "READY");
  assert.equal(result.frontTorsoEnvelope?.sleeveInfluenceRemoved, true);
  assert.ok(
    result.frontTorsoEnvelope!.torsoBounds!.width <
      result.frontTorsoEnvelope!.fullGarmentBounds.width,
  );
  assert.ok(
    result.placementEvidence!.finalPrintBounds.x >=
      result.frontTorsoEnvelope!.torsoBounds!.x,
  );
  assert.ok(
    result.placementEvidence!.finalPrintBounds.x +
        result.placementEvidence!.finalPrintBounds.width <=
      result.frontTorsoEnvelope!.torsoBounds!.x +
        result.frontTorsoEnvelope!.torsoBounds!.width,
  );
});

test("owner vertical intent maps from preview to the registered torso without recentering", async () => {
  const ownerPlacement = placement(0.82, 0, -0.45);
  const ownerPrintFootprint = createOwnerPrintFootprint({
    placementPreset: "FRONT_LARGE",
    printableArea: PRINTABLE,
    ownerPlacement,
    artworkWidth: 5000,
    artworkHeight: 5000,
    referenceWidth: 320,
    referenceHeight: 420,
  });
  const ownerVerticalPlacement = createOwnerVerticalPlacement({
    placementPreset: "FRONT_LARGE",
    printableArea: PRINTABLE,
    ownerPlacement,
    artworkWidth: 5000,
    artworkHeight: 5000,
    referenceWidth: 320,
    referenceHeight: 420,
    expectedTorsoFootprint: {
      width: ownerPrintFootprint.requestedTemplateGarmentWidthRatio,
      height: ownerPrintFootprint.requestedTemplateGarmentHeightRatio,
      centerY: ownerPrintFootprint.requestedCenterY,
    },
  });
  const mask = shirtMask();
  const result = await registerGeneratedGarmentV3({
    bytes: baseWithShirt("#98c3dc"),
    productType: "Vacancy T-Shirt",
    productColor: "Babyblau",
    side: "FRONT",
    printableArea: PRINTABLE,
    ownerPlacement: { ...ownerPlacement, uniformScale: 1, offsetX: 0, offsetY: 0 },
    ownerPrintFootprint,
    ownerVerticalPlacement,
    placementPreset: "FRONT_LARGE",
    faceBounds: FACE,
    segmentationMask: {
      bytes: mask,
      checksumSha256: createHash("sha256").update(mask).digest("hex"),
      width: 320,
      height: 420,
    },
  });
  assert.equal(result.status, "REGISTERED");
  const evidence = result.placementEvidence?.ownerVerticalPlacement;
  assert.ok(evidence);
  assert.equal(evidence.ownerYRequested, -0.45);
  assert.equal(evidence.previewY, ownerVerticalPlacement.previewCenterY);
  assert.ok(
    Math.abs(
      evidence.requestedRegisteredY -
        ownerVerticalPlacement.expectedFinalFootprint.centerY,
    ) < 1e-12,
  );
  assert.ok(
    Math.abs(evidence.registeredY - evidence.requestedRegisteredY) < 1e-12,
  );
  assert.equal(evidence.finalY, evidence.registeredY);
  assert.equal(evidence.yPreserved, true);
  assert.equal(evidence.clampApplied, false);
  assert.equal(evidence.secondContainApplied, false);
  assert.equal(evidence.secondGlobalScaleApplied, false);
  assert.equal(evidence.secondGlobalTranslationApplied, false);
});

test("collar safety clamp is explicit and an unsafe requested height fails closed", async () => {
  const ownerPlacement = placement(0.9, 0, -0.8);
  const ownerPrintFootprint = createOwnerPrintFootprint({
    placementPreset: "FRONT_LARGE",
    printableArea: PRINTABLE,
    ownerPlacement,
    artworkWidth: 5000,
    artworkHeight: 5000,
    referenceWidth: 320,
    referenceHeight: 420,
  });
  const ownerVerticalPlacement = createOwnerVerticalPlacement({
    placementPreset: "FRONT_LARGE",
    printableArea: PRINTABLE,
    ownerPlacement,
    artworkWidth: 5000,
    artworkHeight: 5000,
    referenceWidth: 320,
    referenceHeight: 420,
    expectedTorsoFootprint: {
      width: ownerPrintFootprint.requestedTemplateGarmentWidthRatio,
      height: ownerPrintFootprint.requestedTemplateGarmentHeightRatio,
      centerY: ownerPrintFootprint.requestedCenterY,
    },
  });
  const mask = shirtMask();
  const result = await registerGeneratedGarmentV3({
    bytes: baseWithShirt("#e8e6df"),
    productType: "Vacancy T-Shirt",
    productColor: "Weiß",
    side: "FRONT",
    printableArea: PRINTABLE,
    ownerPlacement: { ...ownerPlacement, uniformScale: 1, offsetX: 0, offsetY: 0 },
    ownerPrintFootprint,
    ownerVerticalPlacement,
    placementPreset: "FRONT_LARGE",
    faceBounds: FACE,
    segmentationMask: {
      bytes: mask,
      checksumSha256: createHash("sha256").update(mask).digest("hex"),
      width: 320,
      height: 420,
    },
  });
  assert.equal(result.status, "LOW_CONFIDENCE");
  assert.equal(result.reason, "OWNER_VERTICAL_PLACEMENT_UNSAFE");
  assert.equal(
    result.placementEvidence?.ownerVerticalPlacement?.clampApplied,
    true,
  );
  assert.equal(
    result.placementEvidence?.ownerVerticalPlacement?.clampReason,
    "COLLAR_CLEARANCE",
  );
  assert.equal(
    result.placementEvidence?.ownerVerticalPlacement?.yPreserved,
    false,
  );
  assert.equal(result.registeredPrintQuad, null);
});

test("unsafe full owner footprint fails instead of receiving hidden shrink", async () => {
  const ownerPlacement = placement(1);
  const ownerPrintFootprint = createOwnerPrintFootprint({
    placementPreset: "FRONT_LARGE",
    printableArea: PRINTABLE,
    ownerPlacement,
    artworkWidth: 1000,
    artworkHeight: 5000,
    referenceWidth: 320,
    referenceHeight: 420,
  });
  const result = await registerGeneratedGarmentV3({
    bytes: baseWithShirt("#242529"),
    productType: "Vacancy T-Shirt",
    productColor: "Schwarz",
    side: "FRONT",
    printableArea: PRINTABLE,
    ownerPlacement,
    ownerPrintFootprint,
    placementPreset: "FRONT_LARGE",
    faceBounds: FACE,
  });
  assert.equal(result.status, "LOW_CONFIDENCE");
  assert.equal(result.reason, "LARGE_FRONT_UNSAFE");
  assert.equal(result.registeredPrintQuad, null);
});

test("fresh Parkhaus-style registration freezes a garment-only oriented FRONT_LARGE quad", async () => {
  const ownerPlacement = placement(0.78);
  const ownerPrintFootprint = createOwnerPrintFootprint({
    placementPreset: "FRONT_LARGE",
    printableArea: PRINTABLE,
    ownerPlacement,
    artworkWidth: 5000,
    artworkHeight: 5000,
    referenceWidth: 320,
    referenceHeight: 420,
  });
  const mask = leaningShirtMask(1);
  const result = await registerGeneratedGarmentV3({
    bytes: baseWithShirt("#242529"),
    productType: "Vacancy T-Shirt",
    productColor: "Schwarz",
    side: "FRONT",
    printableArea: PRINTABLE,
    ownerPlacement,
    ownerPrintFootprint,
    placementPreset: "FRONT_LARGE",
    faceBounds: FACE,
    segmentationMask: {
      bytes: mask,
      checksumSha256: createHash("sha256").update(mask).digest("hex"),
      width: 320,
      height: 420,
    },
    orientedFrontPrintPlane: DEFAULT_ORIENTED_FRONT_PRINT_PLANE_POLICY,
  });
  assert.equal(
    result.status,
    "REGISTERED",
    JSON.stringify({
      reason: result.reason,
      torso: result.frontTorsoEnvelope,
      oriented: result.orientedFrontPrintPlane,
    }),
  );
  assert.equal(
    result.orientedFrontPrintPlane?.contractVersion,
    ORIENTED_FRONT_PRINT_PLANE_VERSION,
  );
  assert.equal(result.orientedFrontPrintPlane?.status, "READY");
  assert.ok(
    Math.abs(result.orientedFrontPrintPlane?.appliedRotationDegrees ?? 0) > 0.5,
  );
  assert.equal(result.orientedFrontPrintPlane?.backgroundEvidenceExcluded, true);
  assert.equal(result.orientedFrontPrintPlane?.globalFootprintPreserved, true);
  assert.equal(result.orientedFrontPrintPlane?.secondContainApplied, false);
  assert.deepEqual(
    result.registeredPrintQuad,
    result.orientedFrontPrintPlane?.orientedQuad,
  );
  const surface = printSurfaceForGarmentRegistrationV3(
    printSurfaceSchema.parse({
      contractVersion: "print-surface-v1",
      printSurfaceId: "surface-oriented-front",
      productProfileId: "profile-1",
      variantId: null,
      version: 1,
      displayName: "Vorne",
      region: "front_center",
      geometryStatus: "CALIBRATED",
      surfaceKind: "PRINT",
      supportedPrintMethods: [],
      boundingBox: null,
      safeMargin: { top: 0, right: 0, bottom: 0, left: 0 },
      quad: [
        { x: 0.3, y: 0.3 },
        { x: 0.7, y: 0.3 },
        { x: 0.7, y: 0.7 },
        { x: 0.3, y: 0.7 },
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
        calibratedAt: "2026-08-26T12:00:00.000Z",
        calibratedBy: "owner",
      },
    }),
    result,
  );
  assert.equal(surface.warpMode, "PERSPECTIVE");
  assert.deepEqual(surface.quad, result.registeredPrintQuad);
});
