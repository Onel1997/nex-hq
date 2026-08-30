import assert from "node:assert/strict";
import test from "node:test";

import { resolveCreativePopoverPosition } from "@/lib/creative-studio/popover-position";

const anchor = {
  top: 180,
  right: 360,
  bottom: 230,
  left: 260,
  width: 100,
  height: 50,
};

for (const viewportWidth of [375, 390, 414, 430]) {
  test(`compact Creative popover stays inside a ${viewportWidth}px viewport`, () => {
    const resolved = resolveCreativePopoverPosition({
      anchor,
      popover: { width: 320, height: 240 },
      viewportWidth,
      viewportHeight: 780,
    });
    const left = anchor.left + resolved.xOffset;
    assert.ok(left >= 10);
    assert.ok(left + Math.min(320, viewportWidth - 20) <= viewportWidth - 10);
    assert.equal(resolved.placement, "below");
  });
}

test("compact Creative popover flips above when the lower viewport is too short", () => {
  const resolved = resolveCreativePopoverPosition({
    anchor: { ...anchor, top: 620, bottom: 670 },
    popover: { width: 180, height: 220 },
    viewportWidth: 390,
    viewportHeight: 700,
  });
  assert.equal(resolved.placement, "above");
  assert.ok(resolved.availableHeight > 500);
});
