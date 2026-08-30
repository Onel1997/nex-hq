import assert from "node:assert/strict";
import test from "node:test";

import { resolveAspectLockedArtworkPlacement } from "./aspect-ratio-lock";
import {
  resolveStrictContainFit,
  STRICT_CONTAIN_OWNER_ERROR,
} from "./strict-contain-fit";
import {
  resolveOwnerArtworkQuad,
  type OwnerArtworkPlacement,
} from "../../product-library/product-family";

const target = { x: 10, y: 20, width: 300, height: 200 };

test("tall Artwork is fully contained with empty horizontal space", () => {
  const fit = resolveStrictContainFit({
    sourceWidth: 100,
    sourceHeight: 400,
    target,
  });
  assert.equal(fit.rect.height, 200);
  assert.equal(fit.rect.width, 50);
  assert.equal(fit.rect.x, 135);
  assert.equal(fit.rect.y, 20);
  assert.equal(fit.diagnostics.unusedHorizontalSpace, 250);
  assert.equal(fit.diagnostics.unusedVerticalSpace, 0);
  assert.equal(fit.diagnostics.cropApplied, false);
  assert.equal(fit.diagnostics.distortionApplied, false);
  assert.equal(fit.diagnostics.ratioPreserved, true);
});

test("wide Artwork is fully contained with empty vertical space", () => {
  const fit = resolveStrictContainFit({
    sourceWidth: 600,
    sourceHeight: 100,
    target,
  });
  assert.equal(fit.rect.width, 300);
  assert.equal(fit.rect.height, 50);
  assert.equal(fit.rect.x, 10);
  assert.equal(fit.rect.y, 95);
  assert.equal(fit.diagnostics.unusedHorizontalSpace, 0);
  assert.equal(fit.diagnostics.unusedVerticalSpace, 150);
});

test("square Artwork remains square in a non-square print area", () => {
  const fit = resolveStrictContainFit({
    sourceWidth: 5000,
    sourceHeight: 5000,
    target,
    ownerPlacement: { uniformScale: 0.8, offsetX: 1, offsetY: -1 },
  });
  assert.equal(fit.rect.width, 160);
  assert.equal(fit.rect.height, 160);
  assert.equal(fit.rect.x, 150);
  assert.equal(fit.rect.y, 20);
  assert.equal(fit.rect.width / fit.rect.height, 1);
  assert.equal(fit.diagnostics.ownerScale, 0.8);
  assert.equal(fit.diagnostics.ownerOffsetX, 1);
  assert.equal(fit.diagnostics.ownerOffsetY, -1);
});

test("owner translation cannot move a transparent or typography-bearing raster outside the safe area", () => {
  // Geometry deliberately has no pixel-content heuristic: transparent padding,
  // irregular silhouettes, and top/bottom typography retain their full bounds.
  const fit = resolveStrictContainFit({
    sourceWidth: 1000,
    sourceHeight: 2000,
    target,
    ownerPlacement: { uniformScale: 1, offsetX: -1, offsetY: 1 },
  });
  assert.ok(fit.rect.x >= target.x);
  assert.ok(fit.rect.y >= target.y);
  assert.ok(fit.rect.x + fit.rect.width <= target.x + target.width);
  assert.ok(fit.rect.y + fit.rect.height <= target.y + target.height);
  assert.equal(fit.diagnostics.fitMode, "CONTAIN");
});

test("invalid non-uniform-like owner input fails with the owner-safe message", () => {
  assert.throws(
    () =>
      resolveStrictContainFit({
        sourceWidth: 100,
        sourceHeight: 100,
        target,
        ownerPlacement: { uniformScale: 1.1, offsetX: 0, offsetY: 0 },
      }),
    new RegExp(STRICT_CONTAIN_OWNER_ERROR.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
  );
});

test("Product Family preview and deterministic production use the identical contain contract", () => {
  const outputWidth = 1001;
  const outputHeight = 801;
  const printableArea = { x: 0.2, y: 0.15, width: 0.6, height: 0.7 };
  const ownerPlacement: OwnerArtworkPlacement = {
    contractVersion: "owner-artwork-placement-v1",
    templateId: "front",
    templateVersion: 1,
    uniformScale: 0.72,
    offsetX: 0.35,
    offsetY: -0.45,
    aspectRatioPolicy: "LOCKED_UNIFORM_CONTAIN",
  };
  const preview = resolveOwnerArtworkQuad({
    printableArea,
    artworkWidth: 900,
    artworkHeight: 1600,
    referenceWidth: outputWidth - 1,
    referenceHeight: outputHeight - 1,
    placement: ownerPlacement,
  });
  const production = resolveAspectLockedArtworkPlacement({
    sourceWidth: 900,
    sourceHeight: 1600,
    surfaceQuad: [
      { x: printableArea.x, y: printableArea.y },
      { x: printableArea.x + printableArea.width, y: printableArea.y },
      {
        x: printableArea.x + printableArea.width,
        y: printableArea.y + printableArea.height,
      },
      { x: printableArea.x, y: printableArea.y + printableArea.height },
    ],
    outputWidth,
    outputHeight,
    ownerPlacement,
  });
  production.quad.forEach((point, index) => {
    assert.ok(Math.abs(point.x / (outputWidth - 1) - preview[index]!.x) < 1e-10);
    assert.ok(Math.abs(point.y / (outputHeight - 1) - preview[index]!.y) < 1e-10);
  });
  assert.equal(production.containFit.cropApplied, false);
  assert.equal(production.containFit.distortionApplied, false);
});
