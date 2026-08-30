import assert from "node:assert/strict";
import test from "node:test";

import { resolveUgcPopoverPosition } from "@/lib/ugc-video-studio/popover-position";

test("compact picker stays inside 375px viewport and flips above when needed", () => {
  const position = resolveUgcPopoverPosition({
    anchor: { top: 700, right: 365, bottom: 744, left: 20, width: 345, height: 44 },
    popover: { width: 420, height: 280 },
    viewportWidth: 375,
    viewportHeight: 760,
  });
  assert.equal(position.placement, "above");
  assert.ok(position.xOffset >= -10);
  assert.ok(position.availableHeight >= 280);
});

test("compact picker opens below when there is room", () => {
  const position = resolveUgcPopoverPosition({
    anchor: { top: 100, right: 370, bottom: 144, left: 16, width: 354, height: 44 },
    popover: { width: 354, height: 220 },
    viewportWidth: 390,
    viewportHeight: 844,
  });
  assert.equal(position.placement, "below");
  assert.equal(position.xOffset, 0);
});
