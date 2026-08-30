import assert from "node:assert/strict";
import test from "node:test";

import {
  FRONT_TORSO_PRINT_ENVELOPE_VERSION,
  resolveFrontTorsoPrintEnvelope,
  type GarmentRowSpan,
} from "@/lib/image/deterministic-runtime/front-torso-print-envelope";

function oversizedRows(input?: {
  torsoLeft?: number;
  torsoRight?: number;
  sleeveLeft?: number;
  sleeveRight?: number;
  jitter?: number;
}): GarmentRowSpan[] {
  const torsoLeft = input?.torsoLeft ?? 110;
  const torsoRight = input?.torsoRight ?? 274;
  const sleeveLeft = input?.sleeveLeft ?? 44;
  const sleeveRight = input?.sleeveRight ?? 340;
  const jitter = input?.jitter ?? 2;
  const rows: GarmentRowSpan[] = [];
  for (let row = 92; row <= 360; row += 1) {
    const relative = (row - 92) / (360 - 92);
    const upperExpansion = relative < 0.64;
    const wave = Math.round(Math.sin(row * 0.21) * jitter);
    rows.push({
      row,
      left: (upperExpansion ? sleeveLeft : torsoLeft) + wave,
      right: (upperExpansion ? sleeveRight : torsoRight) + wave,
    });
  }
  return rows;
}

test("oversized T-shirt torso envelope excludes wide sleeves and dropped shoulders", () => {
  const result = resolveFrontTorsoPrintEnvelope({
    rows: oversizedRows(),
    imageWidth: 384,
    imageHeight: 384,
    fullGarmentBounds: { x: 44 / 384, y: 92 / 384, width: 297 / 384, height: 269 / 384 },
    neckExclusionBottom: 0.31,
  });
  assert.equal(result.contractVersion, FRONT_TORSO_PRINT_ENVELOPE_VERSION);
  assert.equal(result.status, "READY");
  assert.ok(result.torsoBounds);
  assert.ok(result.torsoBounds.x > result.fullGarmentBounds.x);
  assert.ok(
    result.torsoBounds.x + result.torsoBounds.width <
      result.fullGarmentBounds.x + result.fullGarmentBounds.width,
  );
  assert.ok(result.sleeveSuppressionRatio > 0.35);
  assert.ok(result.shoulderSuppressionRatio > 0.35);
  assert.equal(result.sleeveInfluenceRemoved, true);
  assert.equal(result.shoulderFlareRemoved, true);
  assert.equal(result.collarClearanceApplied, true);
});

test("normal T-shirt keeps a stable central torso rather than the shoulder row", () => {
  const result = resolveFrontTorsoPrintEnvelope({
    rows: oversizedRows({
      torsoLeft: 92,
      torsoRight: 292,
      sleeveLeft: 67,
      sleeveRight: 317,
      jitter: 1,
    }),
    imageWidth: 384,
    imageHeight: 384,
    fullGarmentBounds: { x: 67 / 384, y: 92 / 384, width: 251 / 384, height: 269 / 384 },
    neckExclusionBottom: 0.31,
  });
  assert.equal(result.status, "READY");
  assert.ok(result.torsoWidthRatio < 0.9);
  assert.ok(result.printableTorsoBounds);
  assert.ok(
    result.printableTorsoBounds.width < result.fullGarmentBounds.width,
  );
});

test("unstable lower torso rows fail closed instead of guessing", () => {
  const rows = oversizedRows().map((span) => {
    const relative = (span.row - 92) / (360 - 92);
    if (relative < 0.72) return span;
    const phase = span.row % 4;
    return {
      ...span,
      left: phase === 0 ? 30 : phase === 1 ? 80 : phase === 2 ? 128 : 165,
      right: phase === 0 ? 350 : phase === 1 ? 315 : phase === 2 ? 255 : 220,
    };
  });
  const result = resolveFrontTorsoPrintEnvelope({
    rows,
    imageWidth: 384,
    imageHeight: 384,
    fullGarmentBounds: { x: 30 / 384, y: 92 / 384, width: 321 / 384, height: 269 / 384 },
    neckExclusionBottom: 0.31,
  });
  assert.equal(result.status, "UNSAFE");
  assert.match(result.reason, /TORSO|SLEEVE/);
});

test("cropped visible torso fails closed", () => {
  const rows = oversizedRows().filter((span) => span.row <= 210);
  const result = resolveFrontTorsoPrintEnvelope({
    rows,
    imageWidth: 384,
    imageHeight: 384,
    fullGarmentBounds: { x: 44 / 384, y: 92 / 384, width: 297 / 384, height: 119 / 384 },
    neckExclusionBottom: 0.31,
  });
  assert.equal(result.status, "UNSAFE");
});
