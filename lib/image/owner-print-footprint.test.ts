import assert from "node:assert/strict";
import test from "node:test";

import { createOwnerPrintFootprint } from "@/lib/image/owner-print-footprint";
import { defaultOwnerArtworkPlacement } from "@/lib/product-library/product-family";

const printableArea = { x: 0.22, y: 0.17, width: 0.56, height: 0.62 };
const template = { templateId: "vacancy-front", version: 3 };

function footprint(width: number, height: number) {
  return createOwnerPrintFootprint({
    placementPreset: "FRONT_LARGE",
    printableArea,
    ownerPlacement: defaultOwnerArtworkPlacement(template),
    artworkWidth: width,
    artworkHeight: height,
    referenceWidth: 2000,
    referenceHeight: 3000,
  });
}

test("freezes the one exact contained square owner footprint", () => {
  const result = footprint(5000, 5000);
  assert.equal(result.containApplicationCount, 1);
  assert.equal(result.ownerPlacement.uniformScale, 0.9);
  assert.equal(result.artwork.aspectRatio, 1);
  assert.ok(result.requestedTemplateGarmentWidthRatio > 0.8);
  assert.ok(
    Math.abs(
      result.initialContainedArtworkRectangle.width * 2000 -
        result.initialContainedArtworkRectangle.height * 3000,
    ) < 1e-9,
  );
});

test("wide and tall Artwork preserve full bounds without a second fit", () => {
  const wide = footprint(6000, 3000);
  const tall = footprint(3000, 6000);
  assert.equal(wide.artwork.aspectRatio, 2);
  assert.equal(tall.artwork.aspectRatio, 0.5);
  assert.equal(wide.containApplicationCount, 1);
  assert.equal(tall.containApplicationCount, 1);
  assert.ok(wide.initialContainedArtworkRectangle.height > 0);
  assert.ok(tall.initialContainedArtworkRectangle.width > 0);
});
