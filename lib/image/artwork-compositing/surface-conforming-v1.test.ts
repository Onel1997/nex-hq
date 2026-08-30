import assert from "node:assert/strict";
import test from "node:test";

import {
  analyzeArtworkSurfaceContent,
  analyzeTypographyDeformation,
} from "@/lib/image/artwork-compositing/surface-conforming-v1";

const RECT = { x: 0, y: 0, width: 300, height: 300 };

function mesh(
  transform: (x: number, y: number) => {
    displacementX: number;
    displacementY: number;
  },
  columns = 7,
  rows = 9,
) {
  return Array.from({ length: columns * rows }, (_, index) => {
    const row = Math.floor(index / columns);
    const column = index % columns;
    return transform(
      (column / (columns - 1) - 0.5) * RECT.width,
      (row / (rows - 1) - 0.5) * RECT.height,
    );
  });
}

test("curved shirt with a smooth 4–5 px rigid surface turn is typography-safe", () => {
  const angle = 0.022;
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  const result = analyzeTypographyDeformation({
    nodes: mesh((x, y) => ({
      // displacement = (I - rotation) * position, therefore the actual
      // sampling Jacobian is the rotation itself.
      displacementX: x - (cosine * x - sine * y),
      displacementY: y - (sine * x + cosine * y),
    })),
    columns: 7,
    rows: 9,
    rect: RECT,
  });
  assert.ok(result.analysis.maximumLocalRotationDegrees > 1);
  assert.ok(result.analysis.maximumPrincipalScaleDeviation < 1e-6);
  assert.ok(result.analysis.maximumLocalShear < 1e-6);
  assert.ok(result.distortion < 0.001);
});

test("actual strong local shear remains fail-closed evidence", () => {
  const result = analyzeTypographyDeformation({
    nodes: mesh((_x, y) => ({
      displacementX: y * 0.16,
      displacementY: 0,
    })),
    columns: 7,
    rows: 9,
    rect: RECT,
  });
  assert.ok(result.analysis.maximumLocalShear > 0.15);
  assert.ok(result.distortion > 0.075);
});

test("actual strong local scale deformation remains fail-closed evidence", () => {
  const result = analyzeTypographyDeformation({
    nodes: mesh((x) => ({
      displacementX: x * 0.14,
      displacementY: 0,
    })),
    columns: 7,
    rows: 9,
    rect: RECT,
  });
  assert.ok(result.analysis.maximumPrincipalScaleDeviation > 0.13);
  assert.ok(result.distortion > 0.075);
});

test("severe fold discontinuity remains unsafe", () => {
  const result = analyzeTypographyDeformation({
    nodes: mesh((x, y) => ({
      displacementX: x * (y < 0 ? 0.01 : 0.19),
      displacementY: 0,
    })),
    columns: 7,
    rows: 9,
    rect: RECT,
  });
  assert.ok(result.analysis.maximumNeighborJacobianDiscontinuity > 0.075);
  assert.ok(result.distortion > 0.075);
});

test("transparent padding cells do not inflate typography risk", () => {
  const width = 70;
  const height = 90;
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let y = 34; y < 56; y += 1) {
    for (let x = 24; x < 46; x += 1) {
      pixels[(y * width + x) * 4 + 3] = 255;
    }
  }
  const content = analyzeArtworkSurfaceContent({
    pixels,
    width,
    height,
    columns: 7,
    rows: 9,
  });
  const nodes = mesh((_x, y) => ({
    displacementX: Math.abs(y) > 85 ? y * 0.2 : 0,
    displacementY: 0,
  }));
  const unfiltered = analyzeTypographyDeformation({
    nodes,
    columns: 7,
    rows: 9,
    rect: RECT,
  });
  const filtered = analyzeTypographyDeformation({
    nodes,
    columns: 7,
    rows: 9,
    rect: RECT,
    artworkContent: content,
  });
  assert.ok(unfiltered.distortion > 0.075);
  assert.ok(filtered.distortion < 0.001);
  assert.ok(filtered.analysis.ignoredTransparentCellCount > 0);
  assert.deepEqual(filtered.analysis.contentBoundsNormalized, {
    x: 24 / 70,
    y: 34 / 90,
    width: 22 / 70,
    height: 22 / 90,
  });
});
