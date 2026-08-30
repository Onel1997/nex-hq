import { z } from "zod";

export const FRONT_TORSO_PRINT_ENVELOPE_VERSION =
  "nexhq-front-torso-print-envelope-v1" as const;

const boundsSchema = z
  .object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    width: z.number().positive().max(1),
    height: z.number().positive().max(1),
  })
  .strict();

export const frontTorsoPrintEnvelopeSchema = z
  .object({
    contractVersion: z.literal(FRONT_TORSO_PRINT_ENVELOPE_VERSION),
    status: z.enum(["READY", "UNSAFE"]),
    reason: z.enum([
      "READY",
      "INSUFFICIENT_TORSO_ROWS",
      "TORSO_WIDTH_UNSTABLE",
      "SLEEVE_SEPARATION_UNSAFE",
      "COLLAR_EXCLUSION_UNSAFE",
      "VISIBLE_TORSO_TOO_CROPPED",
    ]),
    fullGarmentBounds: boundsSchema,
    torsoBounds: boundsSchema.nullable(),
    printableTorsoBounds: boundsSchema.nullable(),
    fullGarmentWidthRatio: z.number().positive().max(1),
    torsoWidthRatio: z.number().min(0).max(1),
    torsoHeightRatio: z.number().min(0).max(1),
    torsoToFullWidthRatio: z.number().min(0).max(1),
    sleeveSuppressionRatio: z.number().min(0).max(1),
    shoulderSuppressionRatio: z.number().min(0).max(1),
    sleeveInfluenceRemoved: z.boolean(),
    shoulderFlareRemoved: z.boolean(),
    collarClearanceApplied: z.boolean(),
    sampledRowCount: z.number().int().nonnegative(),
    stableRowCount: z.number().int().nonnegative(),
    rowWidthStability: z.number().min(0).max(1),
    confidence: z.number().min(0).max(1),
  })
  .strict();

export type FrontTorsoPrintEnvelope = z.infer<
  typeof frontTorsoPrintEnvelopeSchema
>;

export type GarmentRowSpan = {
  row: number;
  left: number;
  right: number;
};

function clamp(value: number, minimum = 0, maximum = 1): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function quantile(values: number[], fraction: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.floor((sorted.length - 1) * fraction)),
  );
  return sorted[index] ?? 0;
}

function median(values: number[]): number {
  return quantile(values, 0.5);
}

function unsafe(input: {
  reason: Exclude<FrontTorsoPrintEnvelope["reason"], "READY">;
  fullGarmentBounds: FrontTorsoPrintEnvelope["fullGarmentBounds"];
  sampledRowCount: number;
  stableRowCount?: number;
  rowWidthStability?: number;
  torsoBounds?: FrontTorsoPrintEnvelope["torsoBounds"];
  printableTorsoBounds?: FrontTorsoPrintEnvelope["printableTorsoBounds"];
  torsoWidthRatio?: number;
  torsoHeightRatio?: number;
  torsoToFullWidthRatio?: number;
  sleeveSuppressionRatio?: number;
  shoulderSuppressionRatio?: number;
  collarClearanceApplied?: boolean;
  confidence?: number;
}): FrontTorsoPrintEnvelope {
  const sleeveSuppressionRatio = input.sleeveSuppressionRatio ?? 0;
  const shoulderSuppressionRatio = input.shoulderSuppressionRatio ?? 0;
  return frontTorsoPrintEnvelopeSchema.parse({
    contractVersion: FRONT_TORSO_PRINT_ENVELOPE_VERSION,
    status: "UNSAFE",
    reason: input.reason,
    fullGarmentBounds: input.fullGarmentBounds,
    torsoBounds: input.torsoBounds ?? null,
    printableTorsoBounds: input.printableTorsoBounds ?? null,
    fullGarmentWidthRatio: input.fullGarmentBounds.width,
    torsoWidthRatio: clamp(input.torsoWidthRatio ?? 0),
    torsoHeightRatio: clamp(input.torsoHeightRatio ?? 0),
    torsoToFullWidthRatio: clamp(input.torsoToFullWidthRatio ?? 0),
    sleeveSuppressionRatio,
    shoulderSuppressionRatio,
    sleeveInfluenceRemoved: sleeveSuppressionRatio >= 0.06,
    shoulderFlareRemoved: shoulderSuppressionRatio >= 0.04,
    collarClearanceApplied: input.collarClearanceApplied ?? false,
    sampledRowCount: input.sampledRowCount,
    stableRowCount: input.stableRowCount ?? 0,
    rowWidthStability: input.rowWidthStability ?? 0,
    confidence: input.confidence ?? 0,
  });
}

/**
 * Extracts the physical front body of a T-shirt from a validated garment
 * component. The lower central rows provide the width authority because they
 * are least affected by sleeves and dropped shoulders. The full SAM outline is
 * retained independently for clipping and diagnostics.
 */
export function resolveFrontTorsoPrintEnvelope(input: {
  rows: GarmentRowSpan[];
  imageWidth: number;
  imageHeight: number;
  fullGarmentBounds: FrontTorsoPrintEnvelope["fullGarmentBounds"];
  neckExclusionBottom: number;
}): FrontTorsoPrintEnvelope {
  const full = input.fullGarmentBounds;
  const fullTopPx = full.y * input.imageHeight;
  const fullHeightPx = full.height * input.imageHeight;
  const relativeRow = (row: number) =>
    (row - fullTopPx) / Math.max(1, fullHeightPx);
  const lowerCentralRows = input.rows.filter(({ row }) => {
    const relative = relativeRow(row);
    return relative >= 0.72 && relative <= 0.94;
  });
  if (lowerCentralRows.length < 8) {
    return unsafe({
      reason: "INSUFFICIENT_TORSO_ROWS",
      fullGarmentBounds: full,
      sampledRowCount: lowerCentralRows.length,
    });
  }

  const widths = lowerCentralRows.map((span) => span.right - span.left + 1);
  // A lower quartile rejects rows widened by arms hanging beside an oversized
  // shirt. It does not alter the mask; it only identifies the stable body.
  const stableWidthAuthority = quantile(widths, 0.25);
  const stableRows = lowerCentralRows.filter((span) => {
    const width = span.right - span.left + 1;
    return (
      width >= stableWidthAuthority * 0.78 &&
      width <= stableWidthAuthority * 1.12
    );
  });
  if (stableRows.length < Math.max(6, Math.floor(lowerCentralRows.length * 0.24))) {
    return unsafe({
      reason: "TORSO_WIDTH_UNSTABLE",
      fullGarmentBounds: full,
      sampledRowCount: lowerCentralRows.length,
      stableRowCount: stableRows.length,
    });
  }

  const stableWidths = stableRows.map((span) => span.right - span.left + 1);
  const stableMedianWidth = median(stableWidths);
  const widthMad = median(
    stableWidths.map((width) => Math.abs(width - stableMedianWidth)),
  );
  const rowWidthStability = clamp(
    1 - widthMad / Math.max(1, stableMedianWidth) / 0.18,
  );
  const stableCenter = median(
    stableRows.map((span) => (span.left + span.right + 1) / 2),
  );
  const stableHalfWidth = stableMedianWidth / 2;
  const horizontalAllowance = stableMedianWidth * 0.018;
  const leftPx = stableCenter - stableHalfWidth - horizontalAllowance;
  const rightPx = stableCenter + stableHalfWidth + horizontalAllowance;

  const upperRows = input.rows.filter(({ row }) => {
    const relative = relativeRow(row);
    return relative >= 0.2 && relative <= 0.68;
  });
  const upperExpandedWidth = quantile(
    upperRows.map((span) => span.right - span.left + 1),
    0.75,
  );
  const torsoWidth = rightPx - leftPx;
  const fullWidthPx = full.width * input.imageWidth;
  const sleeveSuppressionRatio = clamp(1 - torsoWidth / fullWidthPx);
  const shoulderSuppressionRatio = clamp(
    upperExpandedWidth > 0 ? 1 - torsoWidth / upperExpandedWidth : 0,
  );

  const torsoTop = Math.max(
    input.neckExclusionBottom + Math.max(0.012, full.height * 0.035),
    full.y + full.height * 0.14,
  );
  const torsoBottom = full.y + full.height * 0.92;
  const torsoBounds = {
    x: clamp(leftPx / input.imageWidth),
    y: clamp(torsoTop),
    width: clamp(torsoWidth / input.imageWidth, 0.001, 1),
    height: clamp(torsoBottom - torsoTop, 0.001, 1),
  };
  torsoBounds.width = Math.min(torsoBounds.width, 1 - torsoBounds.x);
  torsoBounds.height = Math.min(torsoBounds.height, 1 - torsoBounds.y);

  const printableInsetX = torsoBounds.width * 0.015;
  const printableTorsoBounds = {
    x: torsoBounds.x + printableInsetX,
    y: torsoBounds.y,
    width: torsoBounds.width - printableInsetX * 2,
    height: torsoBounds.height,
  };
  const collarClearanceApplied = torsoBounds.y > input.neckExclusionBottom;
  const torsoWidthRatio = torsoBounds.width;
  const torsoHeightRatio = torsoBounds.height;
  const torsoToFullWidthRatio = torsoBounds.width / full.width;
  const centerMad = median(
    stableRows.map((span) =>
      Math.abs((span.left + span.right + 1) / 2 - stableCenter),
    ),
  );
  const centerStability = clamp(
    1 - centerMad / Math.max(1, stableMedianWidth) / 0.12,
  );
  const confidence = clamp(
    rowWidthStability * 0.38 +
      centerStability * 0.24 +
      clamp(sleeveSuppressionRatio / 0.18) * 0.2 +
      (collarClearanceApplied ? 0.18 : 0),
  );

  if (
    rowWidthStability < 0.58 ||
    torsoToFullWidthRatio < 0.34 ||
    torsoToFullWidthRatio > 0.94
  ) {
    return unsafe({
      reason: "TORSO_WIDTH_UNSTABLE",
      fullGarmentBounds: full,
      sampledRowCount: lowerCentralRows.length,
      stableRowCount: stableRows.length,
      rowWidthStability,
      torsoBounds,
      printableTorsoBounds,
      torsoWidthRatio,
      torsoHeightRatio,
      torsoToFullWidthRatio,
      sleeveSuppressionRatio,
      shoulderSuppressionRatio,
      collarClearanceApplied,
      confidence,
    });
  }
  if (sleeveSuppressionRatio < 0.06 && shoulderSuppressionRatio < 0.04) {
    return unsafe({
      reason: "SLEEVE_SEPARATION_UNSAFE",
      fullGarmentBounds: full,
      sampledRowCount: lowerCentralRows.length,
      stableRowCount: stableRows.length,
      rowWidthStability,
      torsoBounds,
      printableTorsoBounds,
      torsoWidthRatio,
      torsoHeightRatio,
      torsoToFullWidthRatio,
      sleeveSuppressionRatio,
      shoulderSuppressionRatio,
      collarClearanceApplied,
      confidence,
    });
  }
  if (!collarClearanceApplied) {
    return unsafe({
      reason: "COLLAR_EXCLUSION_UNSAFE",
      fullGarmentBounds: full,
      sampledRowCount: lowerCentralRows.length,
      stableRowCount: stableRows.length,
      rowWidthStability,
      torsoBounds,
      printableTorsoBounds,
      torsoWidthRatio,
      torsoHeightRatio,
      torsoToFullWidthRatio,
      sleeveSuppressionRatio,
      shoulderSuppressionRatio,
      collarClearanceApplied,
      confidence,
    });
  }
  if (torsoBounds.height < 0.26 || torsoBounds.height / full.height < 0.42) {
    return unsafe({
      reason: "VISIBLE_TORSO_TOO_CROPPED",
      fullGarmentBounds: full,
      sampledRowCount: lowerCentralRows.length,
      stableRowCount: stableRows.length,
      rowWidthStability,
      torsoBounds,
      printableTorsoBounds,
      torsoWidthRatio,
      torsoHeightRatio,
      torsoToFullWidthRatio,
      sleeveSuppressionRatio,
      shoulderSuppressionRatio,
      collarClearanceApplied,
      confidence,
    });
  }

  return frontTorsoPrintEnvelopeSchema.parse({
    contractVersion: FRONT_TORSO_PRINT_ENVELOPE_VERSION,
    status: "READY",
    reason: "READY",
    fullGarmentBounds: full,
    torsoBounds,
    printableTorsoBounds,
    fullGarmentWidthRatio: full.width,
    torsoWidthRatio,
    torsoHeightRatio,
    torsoToFullWidthRatio,
    sleeveSuppressionRatio,
    shoulderSuppressionRatio,
    sleeveInfluenceRemoved: sleeveSuppressionRatio >= 0.06,
    shoulderFlareRemoved: shoulderSuppressionRatio >= 0.04,
    collarClearanceApplied,
    sampledRowCount: lowerCentralRows.length,
    stableRowCount: stableRows.length,
    rowWidthStability,
    confidence,
  });
}
