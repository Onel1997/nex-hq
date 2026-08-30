import assert from "node:assert/strict";
import test from "node:test";

import {
  applyDepthAwareGuidance,
  buildDepthAwareSurfaceGuidance,
  classifyHybridDepthQuality,
} from "@/lib/image/artwork-compositing/depth-aware-surface-v1";
import type { SurfaceConformingPlan } from "@/lib/image/artwork-compositing/surface-conforming-v1";
import {
  DEPTH_AWARE_SURFACE_INTEGRATION_VERSION_V1,
  DEFAULT_DEPTH_AWARE_SURFACE_INTEGRATION,
  DEFAULT_OWNER_VERTICAL_DEPTH_AWARE_SURFACE_INTEGRATION,
} from "@/lib/image/artwork-compositing/types";

const settings = DEFAULT_DEPTH_AWARE_SURFACE_INTEGRATION.depthAware!;

test("new owner-height jobs use a modestly stronger but still bounded local surface profile", () => {
  const refined =
    DEFAULT_OWNER_VERTICAL_DEPTH_AWARE_SURFACE_INTEGRATION.depthAware!;
  assert.ok(refined.planeResponse > settings.planeResponse);
  assert.ok(refined.perspectiveResponse > settings.perspectiveResponse);
  assert.ok(refined.relativeDepthResponse > settings.relativeDepthResponse);
  assert.ok(refined.maximumLocalWarpRatio <= 0.015);
  assert.equal(refined.maximumTypographyDistortion, settings.maximumTypographyDistortion);
});
const rect = { x: 50, y: 45, width: 200, height: 210 };

function shirtPixels(input: {
  width?: number;
  height?: number;
  lean?: number;
  contrast?: number;
} = {}) {
  const width = input.width ?? 300;
  const height = input.height ?? 300;
  const lean = input.lean ?? 0.055;
  const contrast = input.contrast ?? 42;
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const localX = x - width / 2 - y * lean;
      const fold = Math.sin(x / 17 + y / 37) * contrast * 0.25;
      const plane = (localX / width) * contrast;
      const value = Math.max(0, Math.min(255, Math.round(188 + plane + fold)));
      const offset = (y * width + x) * 4;
      pixels[offset] = value;
      pixels[offset + 1] = value;
      pixels[offset + 2] = value;
      pixels[offset + 3] = 255;
    }
  }
  return pixels;
}

function mask(lean = 0.055) {
  return (x: number, y: number) => {
    const center = 150 + (y - 150) * lean;
    return y >= 20 && y <= 285 && x >= center - 132 && x <= center + 132;
  };
}

function sleeveSensitiveMask(x: number, y: number): boolean {
  if (y < 20 || y > 285) return false;
  const center = 150 + (y - 150) * 0.02;
  const halfWidth = y < 150 ? 145 : 100;
  return x >= center - halfWidth && x <= center + halfWidth;
}

function garmentDepthWithBackground(backgroundVariant: 0 | 1) {
  const pixels = new Uint8ClampedArray(300 * 300 * 4);
  for (let y = 0; y < 300; y += 1) {
    for (let x = 0; x < 300; x += 1) {
      const garment = sleeveSensitiveMask(x, y);
      const value = garment
        ? Math.round(
            126 +
              (x - 150) * 0.08 +
              (y - 150) * 0.035 +
              Math.sin(x / 29 + y / 41) * 3,
          )
        : backgroundVariant === 0
          ? 0
          : (x + y) % 2 === 0
            ? 255
            : 5;
      const offset = (y * 300 + x) * 4;
      pixels[offset] = value;
      pixels[offset + 1] = value;
      pixels[offset + 2] = value;
      pixels[offset + 3] = 255;
    }
  }
  return pixels;
}

function emptySurfacePlan(): SurfaceConformingPlan {
  return {
    rect,
    columns: settings.gridColumns,
    rows: settings.gridRows,
    nodes: Array.from(
      { length: settings.gridColumns * settings.gridRows },
      () => ({ displacementX: 0, displacementY: 0 }),
    ),
    evidence: {
      contractVersion: "nexhq-surface-conforming-integration-v1",
      status: "READY",
      reason: "READY",
      warpEnabled: false,
      warpStrength: 0,
      maximumAppliedWarpPx: 0,
      clampReasons: ["GARMENT_EDGE_ENVELOPE"],
      curvatureEvidence: 0,
      foldResponseEvidence: 0,
      shadingResponseEvidence: 0,
      textureResponseEvidence: 0,
      maskClippingCoverage: 1,
      effectivePrintRealismConfidence: 1,
      flatOverlayRisk: 1,
      typographyDistortionEstimate: 0,
      gridColumns: settings.gridColumns,
      gridRows: settings.gridRows,
      deterministic: true,
      sourceAuthorityPreserved: true,
      failClosedReason: null,
    },
  };
}

test("depth-aware guidance uses frozen local surface evidence without changing the global footprint", () => {
  const input = {
    pixels: shirtPixels(),
    imageWidth: 300,
    imageHeight: 300,
    artworkRect: rect,
    maskContains: mask(),
    settings,
  };
  const first = buildDepthAwareSurfaceGuidance(input);
  const second = buildDepthAwareSurfaceGuidance(input);
  assert.equal(first.status, "READY");
  assert.deepEqual(second, first, "same frozen pixels must produce the same guidance");
  if (first.status !== "READY") return;
  assert.ok(first.guidance.evidence.depthConfidence >= settings.minimumDepthConfidence);
  assert.equal(
    first.guidance.evidence.depthPlaneFitMethod,
    "GARMENT_MASKED_ROBUST_DEPTH_PLANE_V1",
  );
  assert.ok(
    Math.abs(first.guidance.evidence.normalizedDepthPlaneSlopeX ?? 0) > 0.01,
  );
  assert.ok(first.guidance.nodes.some((node) => Math.hypot(node.displacementX, node.displacementY) > 0.05));
  for (let row = 0; row < settings.gridRows; row += 1) {
    for (let column = 0; column < settings.gridColumns; column += 1) {
      if (
        row === 0 ||
        row === settings.gridRows - 1 ||
        column === 0 ||
        column === settings.gridColumns - 1
      ) {
        assert.deepEqual(
          first.guidance.nodes[row * settings.gridColumns + column],
          { displacementX: 0, displacementY: 0 },
          "outer footprint boundary must remain pinned",
        );
      }
    }
  }
});

test("combined depth and surface mesh preserves footprint and protects typography", () => {
  const guidance = buildDepthAwareSurfaceGuidance({
    pixels: shirtPixels(),
    imageWidth: 300,
    imageHeight: 300,
    artworkRect: rect,
    maskContains: mask(),
    settings,
  });
  assert.equal(guidance.status, "READY");
  if (guidance.status !== "READY") return;
  const combined = applyDepthAwareGuidance({
    surfacePlan: emptySurfacePlan(),
    guidance: guidance.guidance,
    settings,
    maximumCombinedWarpRatio: 0.02,
  });
  assert.equal(combined.status, "READY");
  if (combined.status !== "READY") return;
  assert.equal(combined.plan.rect, emptySurfacePlan().rect);
  assert.equal(combined.evidence.globalFootprintPreserved, true);
  assert.equal(combined.evidence.secondaryScaleApplied, false);
  assert.equal(combined.evidence.secondaryTranslationApplied, false);
  assert.ok(combined.evidence.typographyRisk <= settings.maximumTypographyDistortion);
  assert.ok(combined.evidence.maximumLocalWarpPx > 0);
});

test("validated real Depth Anything evidence drives the local mesh without a second global transform", () => {
  const realDepthPixels = shirtPixels({ lean: 0.02, contrast: 90 });
  const result = buildDepthAwareSurfaceGuidance({
    pixels: shirtPixels({ contrast: 28 }),
    imageWidth: 300,
    imageHeight: 300,
    artworkRect: rect,
    garmentAnalysisRect: { x: 0, y: 0, width: 299, height: 299 },
    maskContains: mask(),
    settings,
    realDepth: {
      pixels: realDepthPixels,
      width: 300,
      height: 300,
      provider: "fal",
      model: "fal-ai/image-preprocessors/depth-anything/v2",
      adapterVersion: "nexhq-fal-depth-anything-v2-v1",
      depthMapChecksumSha256: "d".repeat(64),
      sourceBaseChecksumSha256: "b".repeat(64),
      dynamicRange: 0.42,
    },
  });
  assert.equal(result.status, "READY");
  if (result.status !== "READY") return;
  assert.equal(result.guidance.evidence.estimator, "REAL_DEPTH_ANYTHING_V2");
  assert.equal(result.guidance.evidence.realDepth?.provider, "fal");
  assert.equal(result.guidance.evidence.globalFootprintPreserved, true);
  assert.equal(result.guidance.evidence.secondaryScaleApplied, false);
  assert.equal(result.guidance.evidence.secondaryTranslationApplied, false);
  assert.equal(
    result.guidance.evidence.depthQualityClassification,
    "DEPTH_STRONG",
  );
  assert.equal(
    result.guidance.evidence.surfaceGuidanceMode,
    "REAL_DEPTH_DOMINANT",
  );
});

test("validated flat T-shirt depth passes as low-stable near-planar hybrid evidence", () => {
  const result = buildDepthAwareSurfaceGuidance({
    pixels: shirtPixels({ lean: 0.008, contrast: 34 }),
    imageWidth: 300,
    imageHeight: 300,
    artworkRect: rect,
    garmentAnalysisRect: rect,
    maskContains: mask(0.008),
    settings,
    realDepth: {
      pixels: garmentDepthWithBackground(0),
      width: 300,
      height: 300,
      provider: "fal",
      model: "fal-ai/image-preprocessors/depth-anything/v2",
      adapterVersion: "nexhq-fal-depth-anything-v2-v1",
      depthMapChecksumSha256: "d".repeat(64),
      sourceBaseChecksumSha256: "b".repeat(64),
      dynamicRange: 0.055,
      discontinuityFraction: 0,
      minimumDynamicRange: 0.04,
      maximumDiscontinuityFraction: 0.08,
    },
  });
  assert.equal(result.status, "READY");
  if (result.status !== "READY") return;
  assert.equal(
    result.guidance.evidence.depthQualityClassification,
    "DEPTH_LOW_STABLE",
  );
  assert.equal(
    result.guidance.evidence.surfaceGuidanceMode,
    "NEAR_PLANAR_HYBRID",
  );
  assert.equal(result.guidance.evidence.realDepth?.discontinuityFraction, 0);
  assert.ok(
    (result.guidance.evidence.realDepthConfidence ?? 1) <
      settings.minimumDepthConfidence,
    "the original amplitude-weighted confidence remains truthful",
  );
  assert.ok(
    (result.guidance.evidence.blendedSurfaceConfidence ?? 0) >=
      settings.minimumDepthConfidence,
  );
  assert.ok(result.guidance.evidence.maximumLocalWarpPx > 0);
  assert.ok(
    result.guidance.evidence.maximumLocalWarpPx <
      rect.width * settings.maximumLocalWarpRatio,
  );
  assert.equal(result.guidance.evidence.globalFootprintPreserved, true);
  assert.equal(result.guidance.evidence.secondaryScaleApplied, false);
  assert.equal(result.guidance.evidence.secondaryTranslationApplied, false);
});

test("low-range corrupt and contradictory depth remain fail-closed", () => {
  const baseQuality = {
    dynamicRange: 0.055,
    minimumDynamicRange: 0.04,
    discontinuityFraction: 0,
    maximumDiscontinuityFraction: 0.08,
    maskCoverage: 1,
    torsoStability: 0.92,
    planeTiltDegrees: 0.6,
    perspectiveEstimate: 0.03,
    localFabricEvidence: 0.8,
    acceptedSampleCount: 61,
    totalSampleCount: 63,
    rejectedSampleCount: 2,
    realDepthConfidence: 0.46,
  };
  assert.equal(
    classifyHybridDepthQuality(baseQuality).classification,
    "DEPTH_LOW_STABLE",
  );
  assert.equal(
    classifyHybridDepthQuality({
      ...baseQuality,
      dynamicRange: 0.02,
    }).classification,
    "DEPTH_UNSAFE",
    "a map below its validated floor cannot become low-stable",
  );
  assert.equal(
    classifyHybridDepthQuality({
      ...baseQuality,
      discontinuityFraction: 0.12,
    }).classification,
    "DEPTH_UNSAFE",
    "severe discontinuity remains unsafe",
  );
  assert.equal(
    classifyHybridDepthQuality({
      ...baseQuality,
      perspectiveEstimate: 0.62,
    }).classification,
    "DEPTH_UNSAFE",
    "low-range depth that contradicts the near-planar torso cannot pass",
  );
});

test("garment-only robust plane prevents sleeve width from saturating mild perspective", () => {
  const realDepth = garmentDepthWithBackground(0);
  const legacy = buildDepthAwareSurfaceGuidance({
    pixels: shirtPixels({ contrast: 28 }),
    imageWidth: 300,
    imageHeight: 300,
    artworkRect: rect,
    maskContains: sleeveSensitiveMask,
    settings: {
      ...settings,
      contractVersion: DEPTH_AWARE_SURFACE_INTEGRATION_VERSION_V1,
    },
    realDepth: {
      pixels: realDepth,
      width: 300,
      height: 300,
      provider: "fal",
      model: "fal-ai/image-preprocessors/depth-anything/v2",
      adapterVersion: "nexhq-fal-depth-anything-v2-v1",
      depthMapChecksumSha256: "d".repeat(64),
      sourceBaseChecksumSha256: "b".repeat(64),
      dynamicRange: 0.094,
    },
  });
  assert.equal(legacy.status, "REFUSED");
  if (legacy.status !== "REFUSED") return;
  assert.equal(legacy.evidence.reason, "UNSAFE_LOCAL_WARP_REQUIRED");
  assert.equal(legacy.evidence.localPerspectiveEstimate, 1);

  const corrected = buildDepthAwareSurfaceGuidance({
    pixels: shirtPixels({ contrast: 28 }),
    imageWidth: 300,
    imageHeight: 300,
    artworkRect: rect,
    garmentAnalysisRect: rect,
    maskContains: sleeveSensitiveMask,
    settings,
    realDepth: {
      pixels: realDepth,
      width: 300,
      height: 300,
      provider: "fal",
      model: "fal-ai/image-preprocessors/depth-anything/v2",
      adapterVersion: "nexhq-fal-depth-anything-v2-v1",
      depthMapChecksumSha256: "d".repeat(64),
      sourceBaseChecksumSha256: "b".repeat(64),
      dynamicRange: 0.094,
    },
  });
  assert.equal(corrected.status, "READY");
  if (corrected.status !== "READY") return;
  assert.ok(corrected.guidance.evidence.localPerspectiveEstimate < 1);
  assert.equal(
    corrected.guidance.evidence.depthAnalysisScope,
    "SAM_TORSO_PRINT_NEIGHBORHOOD",
  );
  assert.equal(corrected.guidance.evidence.nodesExceedingBounds, 0);
  assert.equal(corrected.guidance.evidence.rejectedWarpExcessPx, 0);
  assert.equal(
    corrected.guidance.evidence.requestedMaximumLocalWarpPx,
    corrected.guidance.evidence.safeBoundedMaximumLocalWarpPx,
  );
  assert.equal(
    corrected.guidance.evidence.maximumLocalWarpPx,
    corrected.guidance.evidence.safeBoundedMaximumLocalWarpPx,
  );
});

test("background depth cannot influence the garment-masked torso plane", () => {
  const run = (pixels: Uint8ClampedArray) =>
    buildDepthAwareSurfaceGuidance({
      pixels: shirtPixels({ contrast: 28 }),
      imageWidth: 300,
      imageHeight: 300,
      artworkRect: rect,
      garmentAnalysisRect: rect,
      maskContains: sleeveSensitiveMask,
      settings,
      realDepth: {
        pixels,
        width: 300,
        height: 300,
        provider: "fal",
        model: "fal-ai/image-preprocessors/depth-anything/v2",
        adapterVersion: "nexhq-fal-depth-anything-v2-v1",
        depthMapChecksumSha256: "d".repeat(64),
        sourceBaseChecksumSha256: "b".repeat(64),
        dynamicRange: 0.094,
      },
    });
  const darkBackground = run(garmentDepthWithBackground(0));
  const extremeBackground = run(garmentDepthWithBackground(1));
  assert.equal(darkBackground.status, "READY");
  assert.deepEqual(
    extremeBackground,
    darkBackground,
    "only SAM-masked torso/print-neighbourhood depth may affect the plane",
  );
});

test("weak depth and surface evidence fails closed instead of silently using a flat overlay", () => {
  const pixels = new Uint8ClampedArray(300 * 300 * 4);
  for (let index = 0; index < 300 * 300; index += 1) {
    pixels[index * 4] = 190;
    pixels[index * 4 + 1] = 190;
    pixels[index * 4 + 2] = 190;
    pixels[index * 4 + 3] = 255;
  }
  const result = buildDepthAwareSurfaceGuidance({
    pixels,
    imageWidth: 300,
    imageHeight: 300,
    artworkRect: rect,
    maskContains: () => true,
    settings,
  });
  assert.equal(result.status, "REFUSED");
  if (result.status !== "REFUSED") return;
  assert.equal(result.evidence.reason, "DEPTH_EVIDENCE_INSUFFICIENT");
  assert.equal(result.evidence.globalFootprintPreserved, true);
});

test("a strong unsafe shirt-plane turn is refused rather than flattened", () => {
  const result = buildDepthAwareSurfaceGuidance({
    pixels: shirtPixels({ lean: 0.8 }),
    imageWidth: 300,
    imageHeight: 300,
    artworkRect: rect,
    garmentAnalysisRect: { x: 0, y: 0, width: 299, height: 299 },
    maskContains: mask(0.8),
    settings,
  });
  assert.equal(result.status, "REFUSED");
  if (result.status !== "REFUSED") return;
  assert.ok([
    "UNSAFE_LOCAL_WARP_REQUIRED",
    "MASK_COVERAGE_UNSAFE",
  ].includes(result.evidence.reason));
});

test("an actually excessive sampled transform still fails with requested and safe warp evidence", () => {
  const guidance = buildDepthAwareSurfaceGuidance({
    pixels: shirtPixels(),
    imageWidth: 300,
    imageHeight: 300,
    artworkRect: rect,
    maskContains: mask(),
    settings,
  });
  assert.equal(guidance.status, "READY");
  if (guidance.status !== "READY") return;
  const excessive = {
    ...guidance.guidance,
    nodes: guidance.guidance.nodes.map((node, index) => {
      const row = Math.floor(index / settings.gridColumns);
      const column = index % settings.gridColumns;
      return row > 0 &&
        row < settings.gridRows - 1 &&
        column > 0 &&
        column < settings.gridColumns - 1
        ? { displacementX: node.displacementX + 30, displacementY: 0 }
        : node;
    }),
  };
  const result = applyDepthAwareGuidance({
    surfacePlan: emptySurfacePlan(),
    guidance: excessive,
    settings,
    maximumCombinedWarpRatio: 0.02,
  });
  assert.equal(result.status, "REFUSED");
  if (result.status !== "REFUSED") return;
  assert.equal(result.evidence.reason, "UNSAFE_LOCAL_WARP_REQUIRED");
  assert.ok((result.evidence.requestedMaximumLocalWarpPx ?? 0) > 20);
  assert.ok((result.evidence.safeBoundedMaximumLocalWarpPx ?? 0) > 0);
  assert.equal(result.evidence.maximumLocalWarpPx, 0);
  assert.ok((result.evidence.nodesExceedingBounds ?? 0) > 0);
});

test("garment mask coverage rejects potential skin/background leakage", () => {
  const result = buildDepthAwareSurfaceGuidance({
    pixels: shirtPixels(),
    imageWidth: 300,
    imageHeight: 300,
    artworkRect: rect,
    maskContains: (x, y) => x >= 80 && x <= 225 && y >= 45 && y <= 255,
    settings,
  });
  assert.equal(result.status, "REFUSED");
  if (result.status !== "REFUSED") return;
  assert.equal(result.evidence.reason, "MASK_COVERAGE_UNSAFE");
});
