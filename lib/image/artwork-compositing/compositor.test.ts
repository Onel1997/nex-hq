import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { createCanvas, loadImage } from "canvas";

import {
  classifyDepthNormalAgreement,
  combineOrientedAndLocalTypographyRisk,
  compositeApprovedArtwork,
  printRegionPixelSize,
} from "@/lib/image/artwork-compositing/compositor";
import { resolveAspectLockedArtworkPlacement } from "@/lib/image/artwork-compositing/aspect-ratio-lock";
import {
  DEFAULT_FABRIC_AWARE_INTEGRATION,
  DEFAULT_DEPTH_AWARE_SURFACE_INTEGRATION,
  DEFAULT_OWNER_VERTICAL_DEPTH_AWARE_SURFACE_INTEGRATION,
  DEFAULT_SURFACE_REALISM_REFINEMENT_INTEGRATION,
  DEFAULT_SURFACE_CONFORMING_FABRIC_INTEGRATION,
  COMPOSITOR_VERSION_V1,
  COMPOSITOR_VERSION_V2,
  COMPOSITOR_VERSION_V3,
} from "@/lib/image/artwork-compositing/types";
import { resolveFabricAwarePixelAdjustment } from "@/lib/image/artwork-compositing/fabric-aware-v1";
import {
  buildSurfaceConformingPlan,
  resolveSurfaceConformingDisplacement,
} from "@/lib/image/artwork-compositing/surface-conforming-v1";
import type { NormalizedQuad, PrintSurface } from "@/lib/image/print-surface/types";
import { createOwnerPrintFootprint } from "@/lib/image/owner-print-footprint";
import { createOwnerVerticalPlacement } from "@/lib/image/owner-vertical-placement";
import { defaultOwnerArtworkPlacement } from "@/lib/product-library/product-family";
import {
  ORIENTED_FRONT_PRINT_PLANE_VERSION,
  orientedFrontPrintPlaneEvidenceSchema,
} from "@/lib/image/deterministic-runtime/oriented-front-print-plane-v2";

test("Depth Anything cross-check never reorients the frozen global plane and rejects only strong confident contradiction", () => {
  const agrees = classifyDepthNormalAgreement({
    depthPlaneSlopeX: 0.31,
    depthConfidence: 0.88,
    normalFacingX: 0.24,
    normalConfidence: 0.86,
  });
  assert.equal(agrees.agreementClass, "DEPTH_AGREES");
  assert.equal(agrees.globalPlaneReoriented, false);

  const mild = classifyDepthNormalAgreement({
    depthPlaneSlopeX: 0.42,
    depthConfidence: 0.82,
    normalFacingX: 0.05,
    normalConfidence: 0.81,
  });
  assert.equal(mild.agreementClass, "DEPTH_MILD_DIFFERENCE");
  assert.equal(mild.globalPlaneReoriented, false);

  const contradictory = classifyDepthNormalAgreement({
    depthPlaneSlopeX: 0.48,
    depthConfidence: 0.9,
    normalFacingX: -0.42,
    normalConfidence: 0.91,
  });
  assert.equal(contradictory.agreementClass, "DEPTH_CONTRADICTORY");
  assert.equal(contradictory.globalPlaneReoriented, false);

  const weakOpposition = classifyDepthNormalAgreement({
    depthPlaneSlopeX: 0.48,
    depthConfidence: 0.45,
    normalFacingX: -0.42,
    normalConfidence: 0.91,
  });
  assert.notEqual(weakOpposition.agreementClass, "DEPTH_CONTRADICTORY");
});

const hash = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");

function png(width: number, height: number, pixels: Array<[number, number, number, number]>): Buffer {
  const canvas = createCanvas(width, height);
  const context = canvas.getContext("2d");
  const image = context.createImageData(width, height);
  pixels.forEach((pixel, index) => image.data.set(pixel, index * 4));
  context.putImageData(image, 0, 0);
  return canvas.toBuffer("image/png");
}

function surface(quad: NormalizedQuad = [
  { x: 2 / 7, y: 2 / 7 },
  { x: 5 / 7, y: 2 / 7 },
  { x: 5 / 7, y: 5 / 7 },
  { x: 2 / 7, y: 5 / 7 },
]): PrintSurface {
  return {
    contractVersion: "print-surface-v1" as const,
    printSurfaceId: "surface-1",
    version: 1,
    productProfileId: "product-1",
    variantId: "variant-1",
    region: "front_center" as const,
    geometryStatus: "HUMAN_DEFINED" as const,
    quad,
    boundingBox: null,
    orientationDegrees: 0,
    perspectiveAnchors: [],
    clippingMaskReference: null,
    safeMargin: { top: 0, right: 0, bottom: 0, left: 0 },
    artworkScale: 1,
    rotationDegrees: 0,
    warpMode: "PERSPECTIVE" as const,
    provenance: {
      source: "OWNER_CALIBRATION" as const,
      calibratedBy: "owner",
      calibratedAt: "2026-08-17T12:00:00.000Z",
    },
  };
}

function request(
  artworkBytes: Buffer,
  baseBytes: Buffer,
  printSurface = surface(),
  compositorVersion:
    | typeof COMPOSITOR_VERSION_V1
    | typeof COMPOSITOR_VERSION_V2
    | typeof COMPOSITOR_VERSION_V3 =
    COMPOSITOR_VERSION_V2,
) {
  return {
    compositorVersion,
    artwork: {
      id: "11111111-1111-4111-8111-111111111111",
      version: "V1",
      checksumSha256: hash(artworkBytes),
      bytes: artworkBytes,
    },
    baseImage: {
      id: "base-1",
      checksumSha256: hash(baseBytes),
      bytes: baseBytes,
    },
    printSurface,
    shadingFactor: 1,
    ...(compositorVersion === COMPOSITOR_VERSION_V3
      ? { fabricIntegration: DEFAULT_FABRIC_AWARE_INTEGRATION }
      : {}),
  };
}

function orientedEvidence(
  quad: NormalizedQuad,
  bounds = { x: 0.2, y: 0.2, width: 0.6, height: 0.6 },
) {
  return orientedFrontPrintPlaneEvidenceSchema.parse({
    contractVersion: ORIENTED_FRONT_PRINT_PLANE_VERSION,
    status: "READY",
    reason: "READY",
    evidenceClass: "ORIENTATION_STRONG",
    orientationConfidence: 0.91,
    estimatedRotationDegrees: 3.2,
    appliedRotationDegrees: 3.2,
    topEdgeTiltDegrees: 3.2,
    bottomEdgeTiltDegrees: 3.2,
    leftSideTiltDegrees: -1.1,
    rightSideTiltDegrees: 1.1,
    perspectiveAmount: 0.02,
    sampleCount: 140,
    rejectedSampleCount: 4,
    torsoEdgeStability: 0.9,
    centerlineStability: 0.93,
    shoulderCollarAgreement: 0.88,
    backgroundEvidenceExcluded: true,
    realDepthSupportUsed: false,
    requestedAxisAlignedBounds: bounds,
    orientedQuad: quad,
    allCornersInsideTorso: true,
    samContainment: 1,
    collarClearanceApplied: true,
    hemClearanceApplied: true,
    registrationTypographyRisk: 0.01,
    ownerScale: 0.9,
    ownerOffsetX: 0,
    ownerOffsetY: -0.1,
    globalFootprintPreserved: true,
    secondContainApplied: false,
    secondGlobalScaleApplied: false,
    secondGlobalTranslationApplied: false,
    clampReasons: [],
    failureReason: null,
  });
}

test("historical compositor v1 retains its frozen perspective-fill interpretation", async () => {
  const artwork = png(2, 2, [
    [255, 0, 0, 255], [0, 255, 0, 255],
    [0, 0, 255, 255], [255, 255, 0, 255],
  ]);
  const base = png(8, 8, Array.from({ length: 64 }, () => [20, 20, 20, 255]));
  const result = await compositeApprovedArtwork(
    request(artwork, base, surface(), COMPOSITOR_VERSION_V1),
    "2026-08-17T12:00:00.000Z",
  );
  const image = await loadImage(result.pngBytes);
  const canvas = createCanvas(8, 8);
  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, 8, 8).data;
  const at = (x: number, y: number) => Array.from(pixels.slice((y * 8 + x) * 4, (y * 8 + x) * 4 + 4));
  assert.deepEqual(at(2, 2), [255, 0, 0, 255]);
  assert.deepEqual(at(5, 2), [0, 255, 0, 255]);
  assert.deepEqual(at(2, 5), [0, 0, 255, 255]);
  assert.deepEqual(at(5, 5), [255, 255, 0, 255]);
  assert.equal(result.provenance.compositorVersion, COMPOSITOR_VERSION_V1);
  assert.equal(
    result.provenance.artworkPlacementMode,
    "LEGACY_PERSPECTIVE_FILL",
  );
});

test("compositor v2 preserves exact source aspect ratio and leaves natural empty space", async () => {
  const artwork = png(4, 2, [
    [255, 0, 0, 255], [255, 0, 0, 255], [0, 255, 0, 255], [0, 255, 0, 255],
    [0, 0, 255, 255], [0, 0, 255, 255], [255, 255, 0, 255], [255, 255, 0, 255],
  ]);
  const base = png(12, 12, Array.from({ length: 144 }, () => [20, 20, 20, 255]));
  const squareSurface = surface([
    { x: 2 / 11, y: 2 / 11 },
    { x: 9 / 11, y: 2 / 11 },
    { x: 9 / 11, y: 9 / 11 },
    { x: 2 / 11, y: 9 / 11 },
  ]);
  const result = await compositeApprovedArtwork(
    request(artwork, base, squareSurface),
    "2026-08-17T12:00:00.000Z",
  );
  assert.equal(result.provenance.compositorVersion, COMPOSITOR_VERSION_V2);
  assert.equal(
    result.provenance.artworkPlacementMode,
    "CONTAIN_UNIFORM_ASPECT_LOCKED",
  );
  assert.equal(result.provenance.sourceAspectRatio, 2);
  assert.ok(result.provenance.appliedArtworkRect);
  assert.ok(result.provenance.effectiveUniformScale);
  assert.equal(result.provenance.containFit?.fitMode, "CONTAIN");
  assert.equal(result.provenance.containFit?.ratioPreserved, true);
  assert.equal(result.provenance.containFit?.cropApplied, false);
  assert.equal(result.provenance.containFit?.distortionApplied, false);
  assert.ok(
    Math.abs(
      result.provenance.appliedArtworkRect!.width /
        result.provenance.appliedArtworkRect!.height -
        2,
    ) < 1e-12,
  );

  const output = await loadImage(result.pngBytes);
  const inspect = createCanvas(12, 12);
  const context = inspect.getContext("2d");
  context.drawImage(output, 0, 0);
  assert.deepEqual(
    Array.from(context.getImageData(5, 2, 1, 1).data),
    [20, 20, 20, 255],
    "vertical letterbox space must remain instead of stretching the Artwork",
  );
  assert.notDeepEqual(
    Array.from(context.getImageData(5, 5, 1, 1).data),
    [20, 20, 20, 255],
  );
});

test("owner scale and X/Y move the full contained Artwork as one locked unit", async () => {
  const artwork = png(
    2,
    4,
    Array.from({ length: 8 }, () => [245, 30, 40, 255]),
  );
  const base = png(
    20,
    20,
    Array.from({ length: 400 }, () => [20, 20, 20, 255]),
  );
  const printSurface = surface([
    { x: 2 / 19, y: 2 / 19 },
    { x: 17 / 19, y: 2 / 19 },
    { x: 17 / 19, y: 17 / 19 },
    { x: 2 / 19, y: 17 / 19 },
  ]);
  const result = await compositeApprovedArtwork(
    {
      ...request(artwork, base, printSurface),
      artworkContainPlacement: {
        contractVersion: "nexhq-strict-artwork-contain-fit-v1",
        fitMode: "CONTAIN" as const,
        uniformScale: 0.5,
        offsetX: 1,
        offsetY: -1,
      },
    },
    "2026-08-23T12:00:00.000Z",
  );
  const fit = result.provenance.containFit!;
  assert.equal(fit.ownerScale, 0.5);
  assert.equal(fit.ownerOffsetX, 1);
  assert.equal(fit.ownerOffsetY, -1);
  assert.equal(fit.ratioPreserved, true);
  assert.equal(fit.cropApplied, false);
  assert.equal(fit.distortionApplied, false);
  assert.equal(
    result.provenance.appliedArtworkRect!.width /
      result.provenance.appliedArtworkRect!.height,
    0.5,
  );
  assert.ok(
    result.provenance.appliedArtworkRect!.x +
      result.provenance.appliedArtworkRect!.width <=
      fit.targetPrintableArea.x + fit.targetPrintableArea.width,
  );
});

test("aspect-lock resolver uses one uniform scale inside a trapezoid", () => {
  const placement = resolveAspectLockedArtworkPlacement({
    sourceWidth: 1600,
    sourceHeight: 900,
    outputWidth: 1000,
    outputHeight: 1200,
    surfaceQuad: [
      { x: 0.35, y: 0.2 },
      { x: 0.65, y: 0.24 },
      { x: 0.72, y: 0.78 },
      { x: 0.28, y: 0.76 },
    ],
  });
  assert.ok(Math.abs(placement.rect.width / placement.rect.height - 16 / 9) < 1e-12);
  assert.equal(placement.transformMatrix[0], placement.transformMatrix[4]);
  assert.equal(placement.transformMatrix[1], 0);
  assert.equal(placement.transformMatrix[3], 0);
  assert.equal(placement.transformMatrix[6], 0);
  assert.equal(placement.transformMatrix[7], 0);
});

test("fabric-aware v1 is deterministic, bounded, and keeps the uniform Artwork rectangle", async () => {
  const artwork = png(
    8,
    4,
    Array.from({ length: 32 }, (_, index) => [
      index < 16 ? 240 : 30,
      index % 4 < 2 ? 45 : 205,
      120,
      255,
    ]),
  );
  const baseCanvas = createCanvas(80, 80);
  const baseContext = baseCanvas.getContext("2d");
  const gradient = baseContext.createLinearGradient(0, 0, 80, 80);
  gradient.addColorStop(0, "#d4c7b7");
  gradient.addColorStop(0.48, "#9b8d7f");
  gradient.addColorStop(0.52, "#d9cdbf");
  gradient.addColorStop(1, "#8c8177");
  baseContext.fillStyle = gradient;
  baseContext.fillRect(0, 0, 80, 80);
  const base = baseCanvas.toBuffer("image/png");
  const printSurface = surface([
    { x: 0.2, y: 0.2 },
    { x: 0.8, y: 0.2 },
    { x: 0.8, y: 0.8 },
    { x: 0.2, y: 0.8 },
  ]);
  const first = await compositeApprovedArtwork(
    request(artwork, base, printSurface, COMPOSITOR_VERSION_V3),
    "2026-08-20T12:00:00.000Z",
  );
  const second = await compositeApprovedArtwork(
    request(artwork, base, printSurface, COMPOSITOR_VERSION_V3),
    "2026-08-20T12:00:00.000Z",
  );
  const flat = await compositeApprovedArtwork(
    request(artwork, base, printSurface, COMPOSITOR_VERSION_V2),
    "2026-08-20T12:00:00.000Z",
  );
  assert.equal(first.outputChecksumSha256, second.outputChecksumSha256);
  assert.deepEqual(first.pngBytes, second.pngBytes);
  assert.notEqual(first.outputChecksumSha256, flat.outputChecksumSha256);
  assert.equal(first.provenance.blendingStrategy, "FABRIC_AWARE_PRINT_V1");
  assert.equal(
    first.provenance.fabricIntegration?.sourceAuthorityPreserved,
    true,
  );
  assert.equal(first.provenance.masterArtworkChecksumSha256, hash(artwork));
  assert.equal(first.provenance.sourceAspectRatio, 2);
  assert.ok(first.provenance.appliedArtworkRect);
  assert.ok(
    Math.abs(
      first.provenance.appliedArtworkRect!.width /
        first.provenance.appliedArtworkRect!.height -
        2,
    ) < 1e-12,
  );
  const maxAllowed = Math.hypot(
    first.provenance.appliedArtworkRect!.width *
      DEFAULT_FABRIC_AWARE_INTEGRATION.maxDisplacementRatio,
    first.provenance.appliedArtworkRect!.height *
      DEFAULT_FABRIC_AWARE_INTEGRATION.maxDisplacementRatio *
      0.65,
  );
  assert.ok(
    first.provenance.fabricIntegration!.maxAppliedDisplacementPx <=
      maxAllowed + 1e-9,
  );
});

test("fabric displacement is pinned to zero at Artwork bounds", () => {
  const pixels = new Uint8ClampedArray(40 * 40 * 4);
  for (let index = 0; index < pixels.length; index += 4) {
    const column = (index / 4) % 40;
    pixels[index] = column * 6;
    pixels[index + 1] = column * 6;
    pixels[index + 2] = column * 6;
    pixels[index + 3] = 255;
  }
  const adjustment = resolveFabricAwarePixelAdjustment({
    pixels,
    imageWidth: 40,
    imageHeight: 40,
    artworkRect: { x: 5, y: 5, width: 30, height: 30 },
    regionMeanLuminance: 120,
    x: 4.5,
    y: 20,
    settings: DEFAULT_FABRIC_AWARE_INTEGRATION,
  });
  assert.ok(Math.abs(adjustment.displacementX) < 0.02);
  assert.ok(Math.abs(adjustment.displacementY) < 0.02);
  const orientedEdge = resolveFabricAwarePixelAdjustment({
    pixels,
    imageWidth: 40,
    imageHeight: 40,
    artworkRect: { x: 5, y: 5, width: 30, height: 30 },
    regionMeanLuminance: 120,
    x: 20,
    y: 20,
    boundaryU: 0,
    boundaryV: 0.5,
    settings: DEFAULT_FABRIC_AWARE_INTEGRATION,
  });
  assert.equal(orientedEdge.displacementX, 0);
  assert.equal(orientedEdge.displacementY, 0);
});

test("new-job fabric response is stronger but remains inside the same hard displacement bound", () => {
  const pixels = new Uint8ClampedArray(40 * 40 * 4);
  for (let y = 0; y < 40; y += 1) {
    for (let x = 0; x < 40; x += 1) {
      const index = (y * 40 + x) * 4;
      const value = Math.max(0, Math.min(255, x * 5 + (y % 4) * 12));
      pixels[index] = value;
      pixels[index + 1] = value;
      pixels[index + 2] = value;
      pixels[index + 3] = 255;
    }
  }
  const shared = {
    pixels,
    imageWidth: 40,
    imageHeight: 40,
    artworkRect: { x: 5, y: 5, width: 30, height: 30 },
    regionMeanLuminance: 110,
    x: 20,
    y: 19,
  };
  const legacy = resolveFabricAwarePixelAdjustment({
    ...shared,
    settings: {
      mode: "FABRIC_AWARE_PRINT_V1",
      maxDisplacementRatio: 0.02,
      lightingStrength: 0.32,
      textureStrength: 0.18,
      inkOpacity: 0.93,
    },
  });
  const strengthened = resolveFabricAwarePixelAdjustment({
    ...shared,
    settings: DEFAULT_FABRIC_AWARE_INTEGRATION,
  });
  assert.ok(
    Math.hypot(strengthened.displacementX, strengthened.displacementY) >=
      Math.hypot(legacy.displacementX, legacy.displacementY),
  );
  assert.equal(DEFAULT_FABRIC_AWARE_INTEGRATION.displacementResponse, 1.12);
  assert.equal(DEFAULT_FABRIC_AWARE_INTEGRATION.shadingRange, 0.2);
  assert.ok(
    Math.abs(strengthened.displacementX) <=
      shared.artworkRect.width *
        DEFAULT_FABRIC_AWARE_INTEGRATION.maxDisplacementRatio,
  );
});

test("surface-realism light and texture transfer is stronger but hue-safe and bounded", () => {
  const pixels = new Uint8ClampedArray(80 * 80 * 4);
  for (let y = 0; y < 80; y += 1) {
    for (let x = 0; x < 80; x += 1) {
      const offset = (y * 80 + x) * 4;
      const value = Math.round(
        Math.max(0, Math.min(255, 170 + (x - 40) * 0.7 + Math.sin(y / 4) * 12)),
      );
      pixels.set([value, value, value, 255], offset);
    }
  }
  const shared = {
    pixels,
    imageWidth: 80,
    imageHeight: 80,
    artworkRect: { x: 10, y: 10, width: 60, height: 60 },
    regionMeanLuminance: 170,
    x: 60,
    y: 38,
  };
  const previous = resolveFabricAwarePixelAdjustment({
    ...shared,
    settings: DEFAULT_OWNER_VERTICAL_DEPTH_AWARE_SURFACE_INTEGRATION,
  });
  const refined = resolveFabricAwarePixelAdjustment({
    ...shared,
    settings: DEFAULT_SURFACE_REALISM_REFINEMENT_INTEGRATION,
  });
  assert.ok(Math.abs(refined.shading - 1) > Math.abs(previous.shading - 1));
  assert.ok(refined.shading >= 0.8 && refined.shading <= 1.2);
  assert.equal(
    DEFAULT_SURFACE_REALISM_REFINEMENT_INTEGRATION
      .surfaceRealismRefinement?.shadingTransferStrength,
    0.28,
  );
});

test("surface-conforming mesh is deterministic on light and dark shirts and remains bounded", () => {
  for (const tone of [224, 38]) {
    const width = 120;
    const height = 120;
    const pixels = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const offset = (y * width + x) * 4;
        const fold = Math.sin(x / 7) * 9 + Math.cos(y / 13) * 6;
        const value = Math.max(0, Math.min(255, tone + fold));
        pixels[offset] = value;
        pixels[offset + 1] = value;
        pixels[offset + 2] = value;
        pixels[offset + 3] = 255;
      }
    }
    const args = {
      pixels,
      imageWidth: width,
      imageHeight: height,
      artworkRect: { x: 30, y: 28, width: 60, height: 68 },
      maskContains: (x: number, y: number) =>
        x >= 18 && x <= 102 && y >= 12 && y <= 112,
      settings:
        DEFAULT_SURFACE_CONFORMING_FABRIC_INTEGRATION.surfaceConforming!,
    };
    const first = buildSurfaceConformingPlan(args);
    const second = buildSurfaceConformingPlan(args);
    assert.equal(first.status, "READY");
    assert.deepEqual(first, second);
    if (first.status !== "READY") throw new Error("expected plan");
    assert.equal(first.plan.evidence.sourceAuthorityPreserved, true);
    assert.ok(
      first.plan.evidence.warpStrength <=
        DEFAULT_SURFACE_CONFORMING_FABRIC_INTEGRATION.surfaceConforming!
          .maximumWarpRatio,
    );
    const displacement = resolveSurfaceConformingDisplacement({
      plan: first.plan,
      x: 60,
      y: 60,
    });
    assert.ok(Number.isFinite(displacement.displacementX));
    assert.ok(Number.isFinite(displacement.displacementY));
  }
});

test("surface-conforming integration fails closed when the validated garment mask cannot contain the print", () => {
  const pixels = new Uint8ClampedArray(80 * 80 * 4).fill(180);
  const result = buildSurfaceConformingPlan({
    pixels,
    imageWidth: 80,
    imageHeight: 80,
    artworkRect: { x: 20, y: 20, width: 40, height: 40 },
    maskContains: (x, y) => x >= 20 && x <= 38 && y >= 20 && y <= 60,
    settings:
      DEFAULT_SURFACE_CONFORMING_FABRIC_INTEGRATION.surfaceConforming!,
  });
  assert.equal(result.status, "REFUSED");
  if (result.status !== "REFUSED") throw new Error("expected refusal");
  assert.equal(result.evidence.reason, "MASK_COVERAGE_UNSAFE");
  assert.equal(result.evidence.sourceAuthorityPreserved, true);
});

test("transparency leaves base pixels untouched", async () => {
  const artwork = png(2, 2, [
    [255, 0, 0, 0], [0, 255, 0, 255],
    [0, 0, 255, 255], [255, 255, 0, 255],
  ]);
  const base = png(8, 8, Array.from({ length: 64 }, () => [20, 30, 40, 255]));
  const result = await compositeApprovedArtwork(request(artwork, base));
  const image = await loadImage(result.pngBytes);
  const canvas = createCanvas(8, 8);
  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0);
  assert.deepEqual(Array.from(context.getImageData(2, 2, 1, 1).data), [20, 30, 40, 255]);
});

test("identical inputs produce identical bytes/checksum and provenance", async () => {
  const artwork = png(2, 2, Array.from({ length: 4 }, () => [200, 50, 100, 255]));
  const base = png(8, 8, Array.from({ length: 64 }, () => [20, 20, 20, 255]));
  const first = await compositeApprovedArtwork(request(artwork, base), "2026-08-17T12:00:00.000Z");
  const second = await compositeApprovedArtwork(request(artwork, base), "2026-08-17T12:00:00.000Z");
  assert.equal(first.outputChecksumSha256, second.outputChecksumSha256);
  assert.deepEqual(first.pngBytes, second.pngBytes);
  assert.deepEqual(first.provenance, second.provenance);
});

test("perspective surface is deterministic and a changed surface changes output", async () => {
  const artwork = png(3, 3, [
    [255, 0, 0, 255], [255, 0, 0, 255], [0, 255, 0, 255],
    [255, 0, 0, 255], [255, 255, 255, 255], [0, 255, 0, 255],
    [0, 0, 255, 255], [0, 0, 255, 255], [255, 255, 0, 255],
  ]);
  const base = png(8, 8, Array.from({ length: 64 }, () => [0, 0, 0, 255]));
  const trapezoid = surface([
    { x: 3 / 7, y: 1 / 7 }, { x: 5 / 7, y: 2 / 7 },
    { x: 6 / 7, y: 6 / 7 }, { x: 1 / 7, y: 5 / 7 },
  ]);
  const first = await compositeApprovedArtwork(request(artwork, base));
  const changed = await compositeApprovedArtwork(request(artwork, base, trapezoid));
  assert.notEqual(first.outputChecksumSha256, changed.outputChecksumSha256);
  assert.equal(changed.provenance.transformMatrix.length, 9);
});

test("current compositor maps one strict contain into the frozen oriented garment plane", async () => {
  const artwork = png(
    4,
    4,
    Array.from({ length: 16 }, (_value, index) =>
      index % 2 === 0
        ? [245, 40, 65, 255] as [number, number, number, number]
        : [25, 220, 170, 255] as [number, number, number, number],
    ),
  );
  const base = png(
    32,
    32,
    Array.from({ length: 32 * 32 }, () => [24, 24, 24, 255]),
  );
  const quad: NormalizedQuad = [
    { x: 0.22, y: 0.18 },
    { x: 0.82, y: 0.22 },
    { x: 0.78, y: 0.82 },
    { x: 0.18, y: 0.78 },
  ];
  const axisAligned = await compositeApprovedArtwork(
    request(artwork, base, surface()),
  );
  const oriented = await compositeApprovedArtwork({
    ...request(artwork, base, surface(quad)),
    orientedFrontPrintPlane: orientedEvidence(quad),
  });
  assert.notEqual(
    oriented.outputChecksumSha256,
    axisAligned.outputChecksumSha256,
  );
  assert.deepEqual(
    oriented.provenance.orientedFrontPrintPlane?.orientedQuad,
    quad,
  );
  assert.equal(
    oriented.provenance.orientedFrontPrintPlane?.globalFootprintPreserved,
    true,
  );
  assert.equal(
    oriented.provenance.orientedFrontPrintPlane?.secondContainApplied,
    false,
  );
  assert.equal(
    oriented.provenance.orientedFrontPrintPlane?.secondGlobalScaleApplied,
    false,
  );
  assert.equal(
    oriented.provenance.orientedFrontPrintPlane
      ?.secondGlobalTranslationApplied,
    false,
  );
  assert.equal(oriented.provenance.containFit?.fitMode, "CONTAIN");
});

test("typography safety evaluates oriented perspective and local mesh deformation together", () => {
  const combined = combineOrientedAndLocalTypographyRisk(0.03, 0.05);
  assert.ok(Math.abs(combined - 0.0785) < 1e-12);
  assert.ok(combined > 0.075);
});

test("checksum mismatch fails closed before compositing", async () => {
  const artwork = png(1, 1, [[255, 0, 0, 255]]);
  const base = png(2, 2, Array.from({ length: 4 }, () => [0, 0, 0, 255]));
  await assert.rejects(
    () => compositeApprovedArtwork({
      ...request(artwork, base),
      artwork: { ...request(artwork, base).artwork, checksumSha256: "0".repeat(64) },
    }),
    /checksum mismatch/,
  );
});

test("unsupported mask/placement modifiers fail closed instead of being ignored", async () => {
  const artwork = png(2, 2, Array.from({ length: 4 }, () => [255, 0, 0, 255]));
  const base = png(8, 8, Array.from({ length: 64 }, () => [0, 0, 0, 255]));
  await assert.rejects(
    () => compositeApprovedArtwork(request(artwork, base, {
      ...surface(),
      clippingMaskReference: "private/mask.png",
    })),
    /does not yet support/,
  );
});

test("high-resolution Artwork stays high-resolution at input and Stage B has no 1024 cap", async () => {
  const sourceWidth = 400;
  const sourceHeight = 500;
  const outputWidth = 1600;
  const outputHeight = 2000;
  const artwork = png(
    sourceWidth,
    sourceHeight,
    Array.from({ length: sourceWidth * sourceHeight }, (_, index) => [
      index % 251,
      40,
      180,
      index % 17 === 0 ? 0 : 255,
    ]),
  );
  const sourceChecksum = hash(artwork);
  const decodedSource = await loadImage(artwork);
  assert.equal(decodedSource.width, sourceWidth);
  assert.equal(decodedSource.height, sourceHeight);
  assert.notEqual(sourceWidth, 1024);
  assert.notEqual(outputWidth, 1024);

  const largeSurface = surface([
    { x: 0.05, y: 0.05 },
    { x: 0.95, y: 0.05 },
    { x: 0.95, y: 0.95 },
    { x: 0.05, y: 0.95 },
  ]);
  const base = png(outputWidth, outputHeight, Array.from({ length: outputWidth * outputHeight }, () => [12, 18, 24, 255]));
  const first = await compositeApprovedArtwork(request(artwork, base, largeSurface), "2026-08-17T12:00:00.000Z");
  const second = await compositeApprovedArtwork(request(artwork, base, largeSurface), "2026-08-17T12:00:00.000Z");
  const output = await loadImage(first.pngBytes);
  assert.equal(output.width, outputWidth);
  assert.equal(output.height, outputHeight);
  assert.equal(first.provenance.sourceWidth, sourceWidth);
  assert.equal(first.provenance.sourceHeight, sourceHeight);
  assert.equal(first.provenance.outputWidth, outputWidth);
  assert.equal(first.provenance.outputHeight, outputHeight);
  assert.equal(first.provenance.samplingStrategy, "BILINEAR_SOURCE_PIXEL");
  assert.ok(first.provenance.printRegionWidth > 1024);
  assert.ok(first.provenance.printRegionHeight > 1024);
  assert.equal(first.outputChecksumSha256, second.outputChecksumSha256);
  assert.deepEqual(first.pngBytes, second.pngBytes);
  assert.equal(hash(artwork), sourceChecksum);

  const transparent = await loadImage(first.pngBytes);
  const inspect = createCanvas(outputWidth, outputHeight);
  const context = inspect.getContext("2d");
  context.drawImage(transparent, 0, 0);
  assert.deepEqual(Array.from(context.getImageData(0, 0, 1, 1).data), [12, 18, 24, 255]);
});

test("owner front_center quad on the previous 768×1024 fake base is only a few hundred pixels", () => {
  const ownerQuad: NormalizedQuad = [
    { x: 0.30, y: 0.35 },
    { x: 0.70, y: 0.35 },
    { x: 0.68, y: 0.70 },
    { x: 0.32, y: 0.70 },
  ];
  const previous = printRegionPixelSize(ownerQuad, 768, 1024);
  assert.equal(previous.width, 308);
  assert.equal(previous.height, 359);
});

test("SAM garment mask clips Stage B to the exact Base-bound garment pixels", async () => {
  const artwork = png(
    4,
    4,
    Array.from({ length: 16 }, () => [235, 30, 80, 255]),
  );
  const base = png(
    32,
    32,
    Array.from({ length: 32 * 32 }, () => [28, 32, 38, 255]),
  );
  const mask = png(
    32,
    32,
    Array.from({ length: 32 * 32 }, (_, index) => {
      const x = index % 32;
      const y = Math.floor(index / 32);
      return x >= 6 && x <= 25 && y >= 5 && y <= 28
        ? [255, 255, 255, 255]
        : [0, 0, 0, 0];
    }),
  );
  const printSurface = {
    ...surface([
      { x: 0.28, y: 0.28 },
      { x: 0.72, y: 0.28 },
      { x: 0.72, y: 0.72 },
      { x: 0.28, y: 0.72 },
    ]),
    warpMode: "NONE" as const,
  };
  const result = await compositeApprovedArtwork({
    ...request(artwork, base, printSurface, COMPOSITOR_VERSION_V3),
    garmentMask: {
      contractVersion: "garment-segmentation-v1",
      bytes: mask,
      checksumSha256: hash(mask),
      sourceBaseChecksumSha256: hash(base),
      width: 32,
      height: 32,
    },
  });
  assert.equal(
    result.provenance.garmentMaskClipping?.everyAppliedPixelInsideMask,
    true,
  );
  assert.equal(
    result.provenance.garmentMaskClipping?.sourceBaseChecksumSha256,
    hash(base),
  );
  assert.ok(
    (result.provenance.garmentMaskClipping?.appliedRectMaskCoverage ?? 0) >=
      0.985,
  );
});

test("Product Family surface pass uses the SAM mask, preserves Artwork authority, and modulates folds and light", async () => {
  const artwork = png(
    16,
    12,
    Array.from({ length: 16 * 12 }, (_, index) => {
      const x = index % 16;
      return x < 8 ? [235, 35, 70, 255] : [30, 210, 180, 255];
    }),
  );
  const baseCanvas = createCanvas(96, 96);
  const baseContext = baseCanvas.getContext("2d");
  const baseData = baseContext.createImageData(96, 96);
  for (let y = 0; y < 96; y += 1) {
    for (let x = 0; x < 96; x += 1) {
      const offset = (y * 96 + x) * 4;
      const fold = Math.sin(x / 8) * 13 + Math.cos(y / 15) * 8;
      const value = Math.max(0, Math.min(255, 176 + fold));
      baseData.data.set([value, value - 5, value - 10, 255], offset);
    }
  }
  baseContext.putImageData(baseData, 0, 0);
  const base = baseCanvas.toBuffer("image/png");
  const mask = png(
    96,
    96,
    Array.from({ length: 96 * 96 }, (_, index) => {
      const x = index % 96;
      const y = Math.floor(index / 96);
      const halfWidth = 36 - Math.abs(y - 50) * 0.08;
      return y >= 8 && y <= 91 && Math.abs(x - 48) <= halfWidth
        ? [255, 255, 255, 255]
        : [0, 0, 0, 0];
    }),
  );
  const printSurface = {
    ...surface([
      { x: 0.25, y: 0.24 },
      { x: 0.75, y: 0.24 },
      { x: 0.75, y: 0.78 },
      { x: 0.25, y: 0.78 },
    ]),
    warpMode: "NONE" as const,
  };
  const surfaceRequest = {
    ...request(artwork, base, printSurface, COMPOSITOR_VERSION_V3),
    fabricIntegration: DEFAULT_SURFACE_CONFORMING_FABRIC_INTEGRATION,
    garmentMask: {
      contractVersion: "garment-segmentation-v1" as const,
      bytes: mask,
      checksumSha256: hash(mask),
      sourceBaseChecksumSha256: hash(base),
      width: 96,
      height: 96,
    },
  };
  const first = await compositeApprovedArtwork(
    surfaceRequest,
    "2026-08-23T09:00:00.000Z",
  );
  const second = await compositeApprovedArtwork(
    surfaceRequest,
    "2026-08-23T09:00:00.000Z",
  );
  assert.equal(first.outputChecksumSha256, second.outputChecksumSha256);
  assert.equal(first.provenance.masterArtworkChecksumSha256, hash(artwork));
  assert.equal(
    first.provenance.fabricIntegration?.surfaceIntegration?.status,
    "READY",
  );
  assert.equal(
    first.provenance.fabricIntegration?.surfaceIntegration
      ?.sourceAuthorityPreserved,
    true,
  );
  assert.equal(
    first.provenance.garmentMaskClipping?.everyAppliedPixelInsideMask,
    true,
  );
  assert.ok(
    (first.provenance.fabricIntegration?.surfaceIntegration
      ?.shadingResponseEvidence ?? 0) > 0,
  );
  assert.ok(
    (first.provenance.fabricIntegration?.surfaceIntegration
      ?.foldResponseEvidence ?? 0) > 0,
  );
  const outputImage = await loadImage(first.pngBytes);
  const outputCanvas = createCanvas(96, 96);
  const outputContext = outputCanvas.getContext("2d");
  outputContext.drawImage(outputImage, 0, 0);
  assert.deepEqual(
    Array.from(outputContext.getImageData(4, 4, 1, 1).data),
    Array.from(baseContext.getImageData(4, 4, 1, 1).data),
    "background outside the validated garment mask remains untouched",
  );
});

test("depth-aware Product Family pass changes only local sampling and records frozen footprint-safe diagnostics", async () => {
  const artwork = png(
    18,
    18,
    Array.from({ length: 18 * 18 }, (_, index) => {
      const x = index % 18;
      const y = Math.floor(index / 18);
      return x === 0 || y === 0 || x === 17 || y === 17
        ? [250, 245, 230, 255]
        : [35, 50, 180, 255];
    }),
  );
  const baseCanvas = createCanvas(128, 128);
  const context = baseCanvas.getContext("2d");
  const data = context.createImageData(128, 128);
  for (let y = 0; y < 128; y += 1) {
    for (let x = 0; x < 128; x += 1) {
      const offset = (y * 128 + x) * 4;
      const localPlane = (x - 64 - y * 0.045) * 0.42;
      const fold = Math.sin(x / 10 + y / 27) * 12;
      const value = Math.round(Math.max(50, Math.min(235, 178 + localPlane + fold)));
      data.data.set([value, value, value, 255], offset);
    }
  }
  context.putImageData(data, 0, 0);
  const base = baseCanvas.toBuffer("image/png");
  const mask = png(
    128,
    128,
    Array.from({ length: 128 * 128 }, (_, index) => {
      const x = index % 128;
      const y = Math.floor(index / 128);
      const center = 64 + (y - 64) * 0.045;
      return y >= 8 && y <= 122 && Math.abs(x - center) <= 51
        ? [255, 255, 255, 255]
        : [0, 0, 0, 0];
    }),
  );
  const printSurface = {
    ...surface([
      { x: 0.28, y: 0.25 },
      { x: 0.72, y: 0.25 },
      { x: 0.72, y: 0.76 },
      { x: 0.28, y: 0.76 },
    ]),
    warpMode: "NONE" as const,
  };
  const result = await compositeApprovedArtwork({
    ...request(artwork, base, printSurface, COMPOSITOR_VERSION_V3),
    fabricIntegration: DEFAULT_DEPTH_AWARE_SURFACE_INTEGRATION,
    garmentMask: {
      contractVersion: "garment-segmentation-v1",
      bytes: mask,
      checksumSha256: hash(mask),
      sourceBaseChecksumSha256: hash(base),
      width: 128,
      height: 128,
    },
  });
  const evidence = result.provenance.fabricIntegration?.depthAwareIntegration;
  assert.equal(evidence?.status, "READY");
  assert.equal(evidence?.globalFootprintPreserved, true);
  assert.equal(evidence?.secondaryScaleApplied, false);
  assert.equal(evidence?.secondaryTranslationApplied, false);
  assert.equal(evidence?.sourceAuthorityPreserved, true);
  assert.ok((evidence?.maximumLocalWarpPx ?? 0) > 0);
  assert.equal(
    result.provenance.garmentMaskClipping?.everyAppliedPixelInsideMask,
    true,
  );
  assert.equal(result.provenance.masterArtworkChecksumSha256, hash(artwork));
});

test("owner footprint is contained once and surface mapping preserves its global size", async () => {
  const artwork = png(
    16,
    16,
    Array.from({ length: 256 }, () => [235, 35, 70, 255]),
  );
  const base = png(
    96,
    96,
    Array.from({ length: 96 * 96 }, () => [180, 176, 170, 255]),
  );
  const mask = png(
    96,
    96,
    Array.from({ length: 96 * 96 }, () => [255, 255, 255, 255]),
  );
  const printSurface = {
    ...surface([
      { x: 0.2, y: 0.2 },
      { x: 0.8, y: 0.2 },
      { x: 0.8, y: 0.8 },
      { x: 0.2, y: 0.8 },
    ]),
    warpMode: "NONE" as const,
  };
  const contract = createOwnerPrintFootprint({
    placementPreset: "FRONT_LARGE",
    printableArea: { x: 0.2, y: 0.17, width: 0.6, height: 0.57 },
    ownerPlacement: {
      ...defaultOwnerArtworkPlacement({ templateId: "front", version: 1 }),
      uniformScale: 1,
    },
    artworkWidth: 16,
    artworkHeight: 16,
    referenceWidth: 96,
    referenceHeight: 96,
  });
  const vertical = createOwnerVerticalPlacement({
    placementPreset: "FRONT_LARGE",
    printableArea: { x: 0.2, y: 0.17, width: 0.6, height: 0.57 },
    ownerPlacement: {
      ...defaultOwnerArtworkPlacement({ templateId: "front", version: 1 }),
      uniformScale: 1,
    },
    artworkWidth: 16,
    artworkHeight: 16,
    referenceWidth: 96,
    referenceHeight: 96,
    expectedTorsoFootprint: { width: 0.75, height: 0.75, centerY: 0.5 },
  });
  const result = await compositeApprovedArtwork({
    ...request(artwork, base, printSurface, COMPOSITOR_VERSION_V3),
    fabricIntegration: DEFAULT_SURFACE_CONFORMING_FABRIC_INTEGRATION,
    artworkContainPlacement: {
      contractVersion: "nexhq-strict-artwork-contain-fit-v1",
      fitMode: "CONTAIN",
      uniformScale: 1,
      offsetX: 0,
      offsetY: 0,
    },
    ownerPrintFootprint: {
      contract,
      garmentBodyBounds: { x: 0.1, y: 0.1, width: 0.8, height: 0.8 },
      requestedWidthRatio: 0.75,
      requestedHeightRatio: 0.75,
      registeredWidthRatio: 0.75,
      registeredHeightRatio: 0.75,
      registrationScaleDelta: 0,
      registrationClampReasons: [],
    },
    ownerVerticalPlacement: {
      contract: vertical,
      garmentBodyBounds: { x: 0.1, y: 0.1, width: 0.8, height: 0.8 },
      registeredY: 0.5,
      clampDelta: 0,
      clampReason: null,
    },
    garmentMask: {
      contractVersion: "garment-segmentation-v1",
      bytes: mask,
      checksumSha256: hash(mask),
      sourceBaseChecksumSha256: hash(base),
      width: 96,
      height: 96,
    },
  });
  const evidence = result.provenance.ownerPrintFootprint;
  assert.ok(evidence);
  assert.equal(evidence.containApplicationCount, 1);
  assert.equal(evidence.surfaceAverageAreaChange, 0);
  assert.equal(evidence.totalFootprintShrink, 0);
  assert.equal(evidence.footprintPreserved, true);
  assert.deepEqual(evidence.preSurfaceFootprint, evidence.postSurfaceFootprint);
  const verticalEvidence = result.provenance.ownerVerticalPlacement;
  assert.ok(verticalEvidence);
  assert.equal(verticalEvidence.registeredY, 0.5);
  assert.equal(verticalEvidence.finalY, 0.5);
  assert.equal(verticalEvidence.yPreserved, true);
  assert.equal(verticalEvidence.secondContainApplied, false);
  assert.equal(verticalEvidence.secondGlobalScaleApplied, false);
  assert.equal(verticalEvidence.secondGlobalTranslationApplied, false);
});

test("FRONT_LARGE compositor freezes refined Parkhaus surface evidence without moving the owner footprint", async () => {
  const artwork = png(
    20,
    20,
    Array.from({ length: 400 }, (_, index) => {
      const x = index % 20;
      return x < 10 ? [235, 42, 70, 255] : [30, 205, 185, 255];
    }),
  );
  const base = png(
    128,
    128,
    Array.from({ length: 128 * 128 }, (_, index) => {
      const x = index % 128;
      const y = Math.floor(index / 128);
      const value = Math.round(
        Math.max(30, Math.min(240, 174 + (x - 64) * 0.25 + Math.sin(x / 9 + y / 21) * 13)),
      );
      return [value, value - 3, value - 7, 255];
    }),
  );
  const depth = png(
    128,
    128,
    Array.from({ length: 128 * 128 }, (_, index) => {
      const x = index % 128;
      const y = Math.floor(index / 128);
      const value = Math.round(
        Math.max(0, Math.min(255, 110 + x * 0.48 + y * 0.12 + Math.sin(y / 13) * 7)),
      );
      return [value, value, value, 255];
    }),
  );
  const mask = png(
    128,
    128,
    Array.from({ length: 128 * 128 }, () => [255, 255, 255, 255]),
  );
  const printSurface = {
    ...surface([
      { x: 0.2, y: 0.2 },
      { x: 0.8, y: 0.2 },
      { x: 0.8, y: 0.8 },
      { x: 0.2, y: 0.8 },
    ]),
    warpMode: "NONE" as const,
  };
  const ownerPlacement = {
    ...defaultOwnerArtworkPlacement({ templateId: "front", version: 1 }),
    uniformScale: 1,
  };
  const contract = createOwnerPrintFootprint({
    placementPreset: "FRONT_LARGE",
    printableArea: { x: 0.2, y: 0.17, width: 0.6, height: 0.57 },
    ownerPlacement,
    artworkWidth: 20,
    artworkHeight: 20,
    referenceWidth: 128,
    referenceHeight: 128,
  });
  const vertical = createOwnerVerticalPlacement({
    placementPreset: "FRONT_LARGE",
    printableArea: { x: 0.2, y: 0.17, width: 0.6, height: 0.57 },
    ownerPlacement,
    artworkWidth: 20,
    artworkHeight: 20,
    referenceWidth: 128,
    referenceHeight: 128,
    expectedTorsoFootprint: { width: 0.75, height: 0.75, centerY: 0.5 },
  });
  const result = await compositeApprovedArtwork({
    ...request(artwork, base, printSurface, COMPOSITOR_VERSION_V3),
    fabricIntegration: DEFAULT_SURFACE_REALISM_REFINEMENT_INTEGRATION,
    artworkContainPlacement: {
      contractVersion: "nexhq-strict-artwork-contain-fit-v1",
      fitMode: "CONTAIN",
      uniformScale: 1,
      offsetX: 0,
      offsetY: 0,
    },
    ownerPrintFootprint: {
      contract,
      garmentBodyBounds: { x: 0.1, y: 0.1, width: 0.8, height: 0.8 },
      requestedWidthRatio: 0.75,
      requestedHeightRatio: 0.75,
      registeredWidthRatio: 0.75,
      registeredHeightRatio: 0.75,
      registrationScaleDelta: 0,
      registrationClampReasons: [],
    },
    ownerVerticalPlacement: {
      contract: vertical,
      garmentBodyBounds: { x: 0.1, y: 0.1, width: 0.8, height: 0.8 },
      registeredY: 0.5,
      clampDelta: 0,
      clampReason: null,
    },
    garmentMask: {
      contractVersion: "garment-segmentation-v1",
      bytes: mask,
      checksumSha256: hash(mask),
      sourceBaseChecksumSha256: hash(base),
      width: 128,
      height: 128,
    },
    depthMap: {
      contractVersion: "nexhq-depth-estimation-v1",
      bytes: depth,
      checksumSha256: hash(depth),
      sourceBaseChecksumSha256: hash(base),
      width: 128,
      height: 128,
      provider: "fal",
      model: "fal-ai/image-preprocessors/depth-anything/v2",
      adapterVersion: "nexhq-fal-depth-anything-v2-v1",
      dynamicRange: 0.42,
    },
  });
  const evidence =
    result.provenance.fabricIntegration?.surfaceRealismRefinementEvidence;
  assert.equal(evidence?.status, "READY");
  assert.equal(evidence?.realDepthUsed, true);
  assert.equal(evidence?.footprintPinned, true);
  assert.equal(evidence?.registeredYPreserved, true);
  assert.equal(evidence?.secondContainApplied, false);
  assert.equal(evidence?.secondGlobalScaleApplied, false);
  assert.equal(evidence?.secondGlobalTranslationApplied, false);
  assert.equal(result.provenance.ownerPrintFootprint?.totalFootprintShrink, 0);
  assert.ok(
    Math.abs((result.provenance.ownerVerticalPlacement?.finalY ?? 0) - 0.5) <
      1e-12,
  );
  assert.equal(
    result.provenance.garmentMaskClipping?.everyAppliedPixelInsideMask,
    true,
  );
  assert.equal(result.provenance.masterArtworkChecksumSha256, hash(artwork));
});

test("surface-conforming Product Family settings refuse Stage B without a validated SAM mask", async () => {
  const artwork = png(
    8,
    8,
    Array.from({ length: 64 }, () => [240, 40, 70, 255]),
  );
  const base = png(
    96,
    96,
    Array.from({ length: 96 * 96 }, () => [190, 184, 176, 255]),
  );
  await assert.rejects(
    () =>
      compositeApprovedArtwork({
        ...request(
          artwork,
          base,
          {
            ...surface([
              { x: 0.25, y: 0.25 },
              { x: 0.75, y: 0.25 },
              { x: 0.75, y: 0.75 },
              { x: 0.25, y: 0.75 },
            ]),
            warpMode: "NONE" as const,
          },
          COMPOSITOR_VERSION_V3,
        ),
        fabricIntegration: DEFAULT_SURFACE_CONFORMING_FABRIC_INTEGRATION,
      }),
    /Shirt-Oberfläche|surface/i,
  );
});

test("Stage B fails when safe SAM clipping would materially destroy print intent", async () => {
  const artwork = png(
    4,
    4,
    Array.from({ length: 16 }, () => [235, 30, 80, 255]),
  );
  const base = png(
    32,
    32,
    Array.from({ length: 32 * 32 }, () => [28, 32, 38, 255]),
  );
  const mask = png(
    32,
    32,
    Array.from({ length: 32 * 32 }, (_, index) => {
      const x = index % 32;
      const y = Math.floor(index / 32);
      return x >= 6 && x <= 14 && y >= 5 && y <= 28
        ? [255, 255, 255, 255]
        : [0, 0, 0, 0];
    }),
  );
  await assert.rejects(
    () =>
      compositeApprovedArtwork({
        ...request(
          artwork,
          base,
          {
            ...surface([
              { x: 0.28, y: 0.28 },
              { x: 0.72, y: 0.28 },
              { x: 0.72, y: 0.72 },
              { x: 0.28, y: 0.72 },
            ]),
            warpMode: "NONE" as const,
          },
          COMPOSITOR_VERSION_V3,
        ),
        garmentMask: {
          contractVersion: "garment-segmentation-v1",
          bytes: mask,
          checksumSha256: hash(mask),
          sourceBaseChecksumSha256: hash(base),
          width: 32,
          height: 32,
        },
      }),
    /materially destroy/i,
  );
});
