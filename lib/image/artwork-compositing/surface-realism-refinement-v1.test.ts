import assert from "node:assert/strict";
import test from "node:test";

import {
  refineSurfaceRealism,
} from "@/lib/image/artwork-compositing/surface-realism-refinement-v1";
import type { SurfaceConformingPlan } from "@/lib/image/artwork-compositing/surface-conforming-v1";
import {
  DEFAULT_SURFACE_REALISM_REFINEMENT_INTEGRATION,
  type DepthAwareSurfaceEvidence,
} from "@/lib/image/artwork-compositing/types";

const integration = DEFAULT_SURFACE_REALISM_REFINEMENT_INTEGRATION;
const settings = integration.surfaceRealismRefinement!;
const rect = { x: 52, y: 42, width: 196, height: 216 };

function raster(input: {
  depth?: boolean;
  lean?: number;
  perspective?: number;
  folds?: number;
} = {}): Uint8ClampedArray {
  const width = 300;
  const height = 300;
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const lean = input.lean ?? 0.08;
      const perspective = input.perspective ?? 0.1;
      const folds = input.folds ?? 14;
      const plane =
        ((x - width / 2) / width) * perspective * 110 +
        ((y - height / 2) / height) * lean * 90;
      const fold = Math.sin(x / 24 + y / 43) * folds;
      const base = input.depth ? 128 : 184;
      const value = Math.round(Math.max(0, Math.min(255, base + plane + fold)));
      const offset = (y * width + x) * 4;
      pixels[offset] = value;
      pixels[offset + 1] = value;
      pixels[offset + 2] = value;
      pixels[offset + 3] = 255;
    }
  }
  return pixels;
}

function plan(): SurfaceConformingPlan {
  const columns = integration.depthAware!.gridColumns;
  const rows = integration.depthAware!.gridRows;
  return {
    rect,
    columns,
    rows,
    nodes: Array.from({ length: columns * rows }, (_, index) => {
      const row = Math.floor(index / columns);
      const column = index % columns;
      const boundary =
        row === 0 || row === rows - 1 || column === 0 || column === columns - 1;
      return boundary
        ? { displacementX: 0, displacementY: 0 }
        : {
            displacementX: Math.sin(row / 2) * 0.35,
            displacementY: Math.cos(column / 2) * 0.22,
          };
    }),
    evidence: {
      contractVersion: "nexhq-surface-conforming-integration-v1",
      status: "READY",
      reason: "READY",
      warpEnabled: true,
      warpStrength: 0.003,
      maximumAppliedWarpPx: 0.5,
      clampReasons: ["GARMENT_EDGE_ENVELOPE"],
      curvatureEvidence: 0.3,
      foldResponseEvidence: 0.3,
      shadingResponseEvidence: 0.3,
      textureResponseEvidence: 0.3,
      maskClippingCoverage: 1,
      effectivePrintRealismConfidence: 0.9,
      flatOverlayRisk: 0.3,
      typographyDistortionEstimate: 0.01,
      gridColumns: columns,
      gridRows: rows,
      deterministic: true,
      sourceAuthorityPreserved: true,
      failClosedReason: null,
    },
  };
}

function depthEvidence(overrides: Partial<DepthAwareSurfaceEvidence> = {}): DepthAwareSurfaceEvidence {
  return {
    contractVersion: "nexhq-depth-aware-surface-integration-v1",
    status: "READY",
    reason: "READY",
    estimator: "REAL_DEPTH_ANYTHING_V2",
    depthEvidenceAvailable: true,
    localPlaneTiltDegrees: 4.2,
    localPerspectiveEstimate: 0.42,
    depthConfidence: 0.86,
    surfaceConfidence: 0.84,
    appliedLocalWarpStrength: 0.008,
    maximumLocalWarpPx: 2.1,
    typographyRisk: 0.02,
    globalFootprintPreserved: true,
    secondaryScaleApplied: false,
    secondaryTranslationApplied: false,
    maskCoverage: 1,
    clampReasons: ["FOOTPRINT_BOUNDARY_PINNED"],
    deterministic: true,
    sourceBaseOnly: true,
    sourceAuthorityPreserved: true,
    failClosedReason: null,
    ...overrides,
  };
}

function refine(input: {
  base?: Uint8ClampedArray;
  depth?: Uint8ClampedArray | null;
  evidence?: DepthAwareSurfaceEvidence;
  maskContains?: (x: number, y: number) => boolean;
} = {}) {
  return refineSurfaceRealism({
    pixels: input.base ?? raster(),
    imageWidth: 300,
    imageHeight: 300,
    surfacePlan: plan(),
    depthEvidence: input.evidence ?? depthEvidence(),
    maskContains: input.maskContains ?? (() => true),
    settings,
    maximumCombinedWarpRatio: integration.maxDisplacementRatio,
    ...(input.depth === null
      ? {}
      : {
          realDepth: {
            pixels: input.depth ?? raster({ depth: true, perspective: 0.24 }),
            width: 300,
            height: 300,
            dynamicRange: 0.42,
          },
        }),
  });
}

test("Parkhaus-style mild lean receives stronger coherent plane and surface-direction guidance", () => {
  const result = refine();
  assert.equal(result.status, "READY");
  if (result.status !== "READY") return;
  assert.equal(result.evidence.contractVersion, "nexhq-surface-realism-refinement-v1");
  assert.equal(result.evidence.realDepthUsed, true);
  assert.equal(result.evidence.strongerPlaneGuidanceUsed, true);
  assert.equal(result.evidence.surfaceDirectionEvidenceUsed, true);
  assert.ok(
    result.evidence.maximumLocalWarpPx > 0.45,
    `expected visible refinement, received ${result.evidence.maximumLocalWarpPx}`,
  );
  assert.ok(result.evidence.localWarpStrength <= integration.maxDisplacementRatio);
});

test("refinement keeps every outer node pinned and performs no global placement pass", () => {
  const before = plan();
  const result = refine();
  assert.equal(result.status, "READY");
  if (result.status !== "READY") return;
  assert.deepEqual(result.plan.rect, before.rect);
  assert.equal(result.evidence.footprintPinned, true);
  assert.equal(result.evidence.registeredYPreserved, true);
  assert.equal(result.evidence.secondContainApplied, false);
  assert.equal(result.evidence.secondGlobalScaleApplied, false);
  assert.equal(result.evidence.secondGlobalTranslationApplied, false);
  for (let row = 0; row < result.plan.rows; row += 1) {
    for (let column = 0; column < result.plan.columns; column += 1) {
      if (
        row === 0 ||
        row === result.plan.rows - 1 ||
        column === 0 ||
        column === result.plan.columns - 1
      ) {
        assert.deepEqual(
          result.plan.nodes[row * result.plan.columns + column],
          { displacementX: 0, displacementY: 0 },
        );
      }
    }
  }
});

test("Clean Studio-style near-front plane remains stable and deterministic", () => {
  const input = {
    base: raster({ lean: 0.005, perspective: 0.01, folds: 4 }),
    depth: raster({ depth: true, lean: 0.005, perspective: 0.01, folds: 3 }),
    evidence: depthEvidence({
      localPlaneTiltDegrees: 0.25,
      localPerspectiveEstimate: 0.03,
    }),
  };
  const first = refine(input);
  const second = refine(input);
  assert.deepEqual(second, first);
  assert.equal(first.status, "READY");
  if (first.status !== "READY") return;
  assert.ok(first.evidence.localWarpStrength < 0.01);
  assert.equal(first.evidence.footprintPinned, true);
});

test("low-stable real depth continues into near-planar fabric refinement", () => {
  const result = refine({
    base: raster({ lean: 0.004, perspective: 0.012, folds: 6 }),
    depth: raster({ depth: true, lean: 0.004, perspective: 0.012, folds: 3 }),
    evidence: depthEvidence({
      contractVersion:
        "nexhq-depth-aware-surface-integration-v1.2-hybrid-low-depth",
      localPlaneTiltDegrees: -0.6,
      localPerspectiveEstimate: 0.032,
      depthConfidence: 0.92,
      surfaceConfidence: 0.96,
      depthQualityClassification: "DEPTH_LOW_STABLE",
      surfaceGuidanceMode: "NEAR_PLANAR_HYBRID",
      realDepthConfidence: 0.464,
      torsoStability: 0.89,
      localFabricEvidence: 1,
      depthDiscontinuityStability: 1,
      depthSampleCoverage: 61 / 63,
      blendedSurfaceConfidence: 0.92,
    }),
  });
  assert.equal(result.status, "READY");
  if (result.status !== "READY") return;
  assert.equal(result.evidence.realDepthUsed, true);
  assert.equal(result.evidence.footprintPinned, true);
  assert.equal(result.evidence.secondGlobalScaleApplied, false);
  assert.equal(result.evidence.secondGlobalTranslationApplied, false);
  assert.ok(result.evidence.maximumLocalWarpPx > 0);
  assert.ok(result.evidence.shadingTransferStrength > 0);
  assert.ok(result.evidence.textureTransferStrength > 0);
});

test("local fallback remains bounded when real depth is unavailable", () => {
  const result = refine({ depth: null });
  assert.equal(result.status, "READY");
  if (result.status !== "READY") return;
  assert.equal(result.evidence.realDepthUsed, false);
  assert.equal(result.evidence.localFallbackUsed, true);
  assert.ok(result.evidence.typographyRisk <= settings.maximumTypographyDistortion);
});

test("unsafe surface direction is refused instead of silently flattening", () => {
  const result = refine({
    evidence: depthEvidence({ localPlaneTiltDegrees: 13.5 }),
  });
  assert.equal(result.status, "REFUSED");
  if (result.status !== "REFUSED") return;
  assert.equal(result.evidence.reason, "UNSAFE_REFINEMENT_REQUIRED");
  assert.equal(result.evidence.footprintPinned, true);
});

test("strict garment-mask coverage prevents skin or background leakage", () => {
  const result = refine({
    maskContains: (x, y) => x >= 65 && x <= 235 && y >= 45 && y <= 255,
  });
  assert.equal(result.status, "REFUSED");
  if (result.status !== "REFUSED") return;
  assert.equal(result.evidence.reason, "SURFACE_DIRECTION_EVIDENCE_INSUFFICIENT");
  assert.ok(result.evidence.maskCoverage < 0.985);
});
