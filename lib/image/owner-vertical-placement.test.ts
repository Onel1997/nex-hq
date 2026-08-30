import assert from "node:assert/strict";
import test from "node:test";

import {
  createOwnerVerticalPlacement,
  OWNER_VERTICAL_PLACEMENT_VERSION,
} from "@/lib/image/owner-vertical-placement";
import { defaultOwnerArtworkPlacement } from "@/lib/product-library/product-family";

const TEMPLATE = { templateId: "vacancy-front", version: 3 };
const PRINTABLE = { x: 0.2, y: 0.17, width: 0.6, height: 0.57 };

function contract(offsetY: number) {
  return createOwnerVerticalPlacement({
    placementPreset: "FRONT_LARGE",
    printableArea: PRINTABLE,
    ownerPlacement: {
      ...defaultOwnerArtworkPlacement(TEMPLATE),
      offsetY,
    },
    artworkWidth: 5000,
    artworkHeight: 5000,
    referenceWidth: 320,
    referenceHeight: 420,
    expectedTorsoFootprint: {
      width: 0.86,
      height: 0.66,
      centerY: 0.5 + offsetY * 0.04,
    },
  });
}

test("owner can move Artwork upward and downward using one canonical contain", () => {
  const higher = contract(-0.6);
  const centered = contract(0);
  const lower = contract(0.6);
  assert.equal(higher.contractVersion, OWNER_VERTICAL_PLACEMENT_VERSION);
  assert.ok(higher.previewCenterY < centered.previewCenterY);
  assert.ok(lower.previewCenterY > centered.previewCenterY);
  assert.equal(higher.ownerOffsetY, -0.6);
  assert.equal(lower.ownerOffsetY, 0.6);
  assert.equal(higher.containApplicationCount, 1);
  assert.equal(higher.globalScaleApplicationCount, 1);
  assert.equal(higher.globalTranslationApplicationCount, 1);
});

test("vertical placement freezes full contain rectangle and owner authority", () => {
  const frozen = contract(-0.35);
  assert.equal(frozen.ownerScale, 0.9);
  assert.equal(frozen.ownerOffsetX, 0);
  assert.equal(frozen.ownerOffsetY, -0.35);
  assert.ok(frozen.canonicalContainedArtworkRectangle.width > 0);
  assert.ok(frozen.canonicalContainedArtworkRectangle.height > 0);
  assert.equal(frozen.failureMode, "FAIL_CLOSED");
  assert.equal(
    frozen.torsoEnvelopeReference.contractVersion,
    "nexhq-front-torso-print-envelope-v1",
  );
});
