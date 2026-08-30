import { createHash } from "node:crypto";

import { createCanvas, loadImage } from "canvas";
import { z } from "zod";

import type { NormalizedQuad, PrintSurface } from "@/lib/image/print-surface/types";
import { printSurfaceSchema } from "@/lib/image/print-surface/types";
import type { OwnerArtworkPlacement } from "@/lib/product-library/product-family";
import type { NormalizedPrintArea, ProductFamilySide } from "@/lib/product-library/product-family";
import {
  semanticPlacementPresetSchema,
  type SemanticPlacementPreset,
} from "@/lib/image/semantic-print-placement";
import {
  OWNER_PRINT_FOOTPRINT_VERSION,
  type OwnerPrintFootprint,
} from "@/lib/image/owner-print-footprint";
import {
  frontTorsoPrintEnvelopeSchema,
  resolveFrontTorsoPrintEnvelope,
  type FrontTorsoPrintEnvelope,
} from "@/lib/image/deterministic-runtime/front-torso-print-envelope";
import {
  ownerVerticalPlacementEvidenceSchema,
  type OwnerVerticalPlacement,
} from "@/lib/image/owner-vertical-placement";
import {
  orientedFrontPrintPlaneEvidenceSchema,
  resolveOrientedFrontPrintPlaneV2,
  type OrientedFrontPrintPlaneEvidence,
  type OrientedFrontPrintPlanePolicy,
} from "@/lib/image/deterministic-runtime/oriented-front-print-plane-v2";
import { analyzeGarmentNormalOrientation } from "@/lib/image/normal-estimation/analysis";

const boxSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  width: z.number().positive().max(1),
  height: z.number().positive().max(1),
}).strict();

const relativeIntentBoxSchema = z
  .object({
    x: z.number().min(-1).max(1),
    y: z.number().min(-1).max(1),
    width: z.number().positive().max(1),
    height: z.number().positive().max(1),
  })
  .strict();

export type NormalizedBounds = z.infer<typeof boxSchema>;

export const FRONT_LARGE_GARMENT_TUNING_VERSION =
  "nexhq-front-large-garment-v3.1" as const;
export const FRONT_LARGE_EFFECTIVE_SCALE_MULTIPLIER = 1.1;
export const FRONT_LARGE_UPWARD_SHIFT_GARMENT_RATIO = 0.035;

export const garmentRegistrationV3Schema = z.object({
  contractVersion: z.literal("garment-registration-v3"),
  mappingVersion: z.literal("GENERATED_GARMENT_RELATIVE_V3"),
  status: z.enum(["REGISTERED", "LOW_CONFIDENCE"]),
  reason: z.enum([
    "REGISTERED",
    "UNREADABLE_BASE",
    "UNSUPPORTED_PRODUCT",
    "FACE_NOT_FOUND",
    "GARMENT_NOT_FOUND",
    "FRONT_TORSO_UNSAFE",
    "LARGE_FRONT_UNSAFE",
    "OWNER_VERTICAL_PLACEMENT_UNSAFE",
    "PRINT_REGION_OUTSIDE_GARMENT",
    "FACE_OR_NECK_OVERLAP",
    "ORIENTED_PLANE_EVIDENCE_INSUFFICIENT",
    "ORIENTED_PLANE_UNSAFE_ROTATION",
    "ORIENTED_PLANE_OUTSIDE_TORSO",
    "ORIENTED_PLANE_COLLAR_UNSAFE",
    "ORIENTED_PLANE_TYPOGRAPHY_UNSAFE",
    "ORIENTED_PLANE_CONTRADICTORY_DEPTH",
    "MIDAS_NORMAL_MISSING",
    "MIDAS_NORMAL_INVALID",
    "NORMAL_EVIDENCE_INSUFFICIENT",
    "NORMAL_SILHOUETTE_CONTRADICTORY",
    "NORMAL_FIELD_UNSTABLE",
    "NORMAL_ASSISTED_PLANE_UNSAFE",
    "DEPTH_NORMAL_CONTRADICTORY",
  ]),
  confidence: z.number().min(0).max(1),
  garmentBounds: boxSchema.nullable(),
  garmentBodyBounds: boxSchema.nullable(),
  faceBounds: boxSchema.nullable(),
  neckExclusionBottom: z.number().min(0).max(1).nullable(),
  registeredPrintQuad: z.tuple([
    z.object({ x: z.number(), y: z.number() }),
    z.object({ x: z.number(), y: z.number() }),
    z.object({ x: z.number(), y: z.number() }),
    z.object({ x: z.number(), y: z.number() }),
  ]).nullable(),
  garmentOutline: z.array(z.object({ x: z.number(), y: z.number() })).max(24),
  frontTorsoEnvelope: frontTorsoPrintEnvelopeSchema.optional(),
  orientedFrontPrintPlane: orientedFrontPrintPlaneEvidenceSchema.optional(),
  maskCoverage: z.number().min(0).max(1),
  placementEvidence: z
    .object({
      placementPreset: semanticPlacementPresetSchema.nullable(),
      ownerUniformScale: z.number().min(0.1).max(1),
      ownerOffsetX: z.number().min(-1).max(1),
      ownerOffsetY: z.number().min(-1).max(1),
      garmentRelativeIntent: relativeIntentBoxSchema,
      requestedPrintBounds: boxSchema,
      finalPrintBounds: boxSchema,
      clampDeltaX: z.number().min(-1).max(1),
      clampDeltaY: z.number().min(-1).max(1),
      sizeReductionRatio: z.number().min(0).max(1),
      clampReasons: z.array(
        z.enum([
          "GARMENT_LEFT",
          "GARMENT_RIGHT",
          "COLLAR_CLEARANCE",
          "GARMENT_HEM",
        ]),
      ),
      largeFrontPreserved: z.boolean(),
      frontLargeTuning: z
        .object({
          version: z.literal(FRONT_LARGE_GARMENT_TUNING_VERSION),
          scaleMultiplier: z.number().min(1).max(1.15),
          upwardShiftGarmentRatio: z.number().min(0).max(0.1),
          effectiveUniformScale: z.number().positive(),
          effectiveCenterY: z.number().min(0).max(1),
        })
        .strict()
        .optional(),
      ownerPrintFootprint: z
        .object({
          contractVersion: z.literal(OWNER_PRINT_FOOTPRINT_VERSION),
          requestedWidthRatio: z.number().positive().max(1),
          requestedHeightRatio: z.number().positive().max(1),
          registeredWidthRatio: z.number().positive().max(1),
          registeredHeightRatio: z.number().positive().max(1),
          registrationScaleDelta: z.number().min(-1).max(1),
          footprintPreserved: z.boolean(),
          failureStage: z.enum(["REGISTRATION"]).nullable(),
        })
        .strict()
        .optional(),
      ownerVerticalPlacement: ownerVerticalPlacementEvidenceSchema.optional(),
    })
    .strict()
    .nullable(),
  expectedColor: z.string().nullable(),
  boundaryEvidence: z
    .enum(["LOCAL_COLOR_COMPONENT", "SAM3_VALIDATED_MASK"])
    .optional(),
  segmentationMaskChecksumSha256: z
    .string()
    .regex(/^[a-f0-9]{64}$/i)
    .optional(),
  imageWidth: z.number().int().positive(),
  imageHeight: z.number().int().positive(),
}).strict();

export type GarmentRegistrationV3 = z.infer<typeof garmentRegistrationV3Schema>;

type Rgb = { r: number; g: number; b: number };

const COLOR_ANCHORS: Array<{ pattern: RegExp; rgb: Rgb }> = [
  { pattern: /schwarz|black|noir/i, rgb: { r: 30, g: 30, b: 32 } },
  { pattern: /weiß|weiss|white|cream/i, rgb: { r: 226, g: 225, b: 218 } },
  { pattern: /beige|sand|stone/i, rgb: { r: 190, g: 170, b: 140 } },
  { pattern: /babyblau|light.?blue|hellblau|sky/i, rgb: { r: 151, g: 194, b: 220 } },
  { pattern: /grau|grey|gray/i, rgb: { r: 125, g: 125, b: 128 } },
  { pattern: /navy|marine/i, rgb: { r: 32, g: 45, b: 68 } },
  { pattern: /blau|blue/i, rgb: { r: 70, g: 115, b: 170 } },
];

function expectedColor(value: string | null): Rgb | null {
  if (!value) return null;
  return COLOR_ANCHORS.find((entry) => entry.pattern.test(value))?.rgb ?? null;
}

function distance(first: Rgb, second: Rgb): number {
  return Math.hypot(first.r - second.r, first.g - second.g, first.b - second.b);
}

function median(values: number[]): number {
  values.sort((a, b) => a - b);
  return values[Math.floor(values.length / 2)] ?? 0;
}

function clamp(value: number, minimum = 0, maximum = 1): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function garmentKind(productType: string): "TSHIRT" | "HOODIE" | "ZIP_HOODIE" | "JOGGER" | "OTHER" {
  const value = productType.toLocaleLowerCase("de-DE");
  if (/zip/.test(value) && /hood/.test(value)) return "ZIP_HOODIE";
  if (/hood/.test(value)) return "HOODIE";
  if (/jogger|pants|hose/.test(value)) return "JOGGER";
  if (/shirt|tee/.test(value)) return "TSHIRT";
  return "OTHER";
}

const TEMPLATE_GARMENT_FRAMES: Record<"TSHIRT" | "HOODIE" | "ZIP_HOODIE" | "JOGGER", NormalizedBounds> = {
  TSHIRT: { x: 0.14, y: 0.07, width: 0.72, height: 0.86 },
  HOODIE: { x: 0.12, y: 0.05, width: 0.76, height: 0.9 },
  ZIP_HOODIE: { x: 0.12, y: 0.05, width: 0.76, height: 0.9 },
  JOGGER: { x: 0.12, y: 0.08, width: 0.76, height: 0.87 },
};

export function printIntentWithinGarment(input: {
  productType: string;
  printableArea: NormalizedPrintArea;
  placement: OwnerArtworkPlacement;
  placementPreset?: SemanticPlacementPreset | null;
}): NormalizedBounds | null {
  const kind = garmentKind(input.productType);
  if (kind === "OTHER") return null;
  const frame = TEMPLATE_GARMENT_FRAMES[kind];
  const area = input.printableArea;
  const relative = {
    x: clamp((area.x - frame.x) / frame.width),
    y: clamp((area.y - frame.y) / frame.height),
    width: clamp(area.width / frame.width, 0.08, 0.88),
    height: clamp(area.height / frame.height, 0.08, 0.72),
  };
  relative.x = clamp(relative.x, 0, 1 - relative.width);
  relative.y = clamp(relative.y, 0.04, 1 - relative.height);

  const width = relative.width * input.placement.uniformScale;
  const height = relative.height * input.placement.uniformScale;
  const travelX = Math.max(0, relative.width - width) / 2;
  const travelY = Math.max(0, relative.height - height) / 2;
  const calibratedIntent = {
    x: relative.x + travelX + input.placement.offsetX * travelX,
    y: relative.y + travelY + input.placement.offsetY * travelY,
    width,
    height,
  };
  if (kind !== "TSHIRT") return calibratedIntent;

  // Chest placements are intentionally separate templates. A large-front
  // selection keeps the calibrated size, but its visual centre is never
  // silently promoted into the upper-chest zone.
  if (input.placementPreset === "FRONT_LEFT_CHEST") {
    const chestWidth = Math.min(calibratedIntent.width, 0.24);
    const chestHeight = Math.min(calibratedIntent.height, 0.2);
    const centerX = 0.66 + input.placement.offsetX * 0.035;
    const centerY = 0.27 + input.placement.offsetY * 0.035;
    return {
      x: clamp(centerX - chestWidth / 2, 0, 1 - chestWidth),
      y: clamp(centerY - chestHeight / 2, 0.08, 1 - chestHeight),
      width: chestWidth,
      height: chestHeight,
    };
  }
  if (input.placementPreset === "FRONT_CENTER_CHEST") {
    const chestWidth = Math.min(calibratedIntent.width, 0.34);
    const chestHeight = Math.min(calibratedIntent.height, 0.25);
    const centerX = 0.5 + input.placement.offsetX * 0.035;
    const centerY = 0.3 + input.placement.offsetY * 0.04;
    return {
      x: clamp(centerX - chestWidth / 2, 0, 1 - chestWidth),
      y: clamp(centerY - chestHeight / 2, 0.1, 1 - chestHeight),
      width: chestWidth,
      height: chestHeight,
    };
  }
  if (input.placementPreset === "FRONT_LARGE") {
    const centerX = calibratedIntent.x + calibratedIntent.width / 2;
    const calibratedCenterY =
      calibratedIntent.y + calibratedIntent.height / 2;
    const tunedWidth = Math.min(
      0.968,
      calibratedIntent.width * FRONT_LARGE_EFFECTIVE_SCALE_MULTIPLIER,
    );
    const tunedHeight = Math.min(
      0.792,
      calibratedIntent.height * FRONT_LARGE_EFFECTIVE_SCALE_MULTIPLIER,
    );
    const centerY = clamp(
      calibratedCenterY - FRONT_LARGE_UPWARD_SHIFT_GARMENT_RATIO,
      0.49,
      0.63,
    );
    return {
      x: clamp(centerX - tunedWidth / 2, 0, 1 - tunedWidth),
      y: clamp(centerY - tunedHeight / 2, 0.08, 1 - tunedHeight),
      width: tunedWidth,
      height: tunedHeight,
    };
  }
  return calibratedIntent;
}

function failure(input: {
  reason: Exclude<GarmentRegistrationV3["reason"], "REGISTERED">;
  width: number;
  height: number;
  color: string | null;
  faceBounds: NormalizedBounds | null;
  garmentBounds?: NormalizedBounds | null;
  garmentBodyBounds?: NormalizedBounds | null;
  confidence?: number;
  coverage?: number;
  placementEvidence?: GarmentRegistrationV3["placementEvidence"];
  garmentOutline?: GarmentRegistrationV3["garmentOutline"];
  frontTorsoEnvelope?: FrontTorsoPrintEnvelope;
  orientedFrontPrintPlane?: OrientedFrontPrintPlaneEvidence;
}): GarmentRegistrationV3 {
  return garmentRegistrationV3Schema.parse({
    contractVersion: "garment-registration-v3",
    mappingVersion: "GENERATED_GARMENT_RELATIVE_V3",
    status: "LOW_CONFIDENCE",
    reason: input.reason,
    confidence: input.confidence ?? 0,
    garmentBounds: input.garmentBounds ?? null,
    garmentBodyBounds: input.garmentBodyBounds ?? null,
    faceBounds: input.faceBounds,
    neckExclusionBottom: input.faceBounds
      ? clamp(input.faceBounds.y + input.faceBounds.height * 1.35)
      : null,
    registeredPrintQuad: null,
    garmentOutline: input.garmentOutline ?? [],
    ...(input.frontTorsoEnvelope
      ? { frontTorsoEnvelope: input.frontTorsoEnvelope }
      : {}),
    ...(input.orientedFrontPrintPlane
      ? { orientedFrontPrintPlane: input.orientedFrontPrintPlane }
      : {}),
    maskCoverage: input.coverage ?? 0,
    placementEvidence: input.placementEvidence ?? null,
    expectedColor: input.color,
    imageWidth: input.width,
    imageHeight: input.height,
  });
}

/**
 * Local, deterministic T-shirt/hoodie registration. It finds the connected
 * garment-colour component below the face/neck (or around the product centre),
 * then transfers frozen MarketPrint intent in garment coordinates. No provider
 * or browser path participates.
 */
export async function registerGeneratedGarmentV3(input: {
  bytes: Buffer;
  productType: string;
  productColor: string | null;
  side: ProductFamilySide;
  printableArea: NormalizedPrintArea;
  ownerPlacement: OwnerArtworkPlacement;
  placementPreset?: SemanticPlacementPreset | null;
  faceBounds?: NormalizedBounds | null;
  requireFaceBounds?: boolean;
  segmentationMask?: {
    bytes: Buffer;
    checksumSha256: string;
    width: number;
    height: number;
  } | null;
  ownerPrintFootprint?: OwnerPrintFootprint | null;
  ownerVerticalPlacement?: OwnerVerticalPlacement | null;
  orientedFrontPrintPlane?: OrientedFrontPrintPlanePolicy | null;
  normalMap?: {
    bytes: Buffer;
    checksumSha256: string;
    width: number;
    height: number;
  } | null;
}): Promise<GarmentRegistrationV3> {
  let source: Awaited<ReturnType<typeof loadImage>>;
  try {
    source = await loadImage(input.bytes);
  } catch {
    return failure({ reason: "UNREADABLE_BASE", width: 1, height: 1, color: input.productColor, faceBounds: input.faceBounds ?? null });
  }
  const kind = garmentKind(input.productType);
  if (kind === "OTHER") {
    return failure({ reason: "UNSUPPORTED_PRODUCT", width: source.width, height: source.height, color: input.productColor, faceBounds: input.faceBounds ?? null });
  }
  const legacyIntent = printIntentWithinGarment({
    productType: input.productType,
    printableArea: input.printableArea,
    placement: input.ownerPlacement,
    placementPreset: input.placementPreset,
  });
  if (!legacyIntent) {
    return failure({ reason: "UNSUPPORTED_PRODUCT", width: source.width, height: source.height, color: input.productColor, faceBounds: input.faceBounds ?? null });
  }
  if (input.requireFaceBounds && !input.faceBounds) {
    return failure({
      reason: "FACE_NOT_FOUND",
      width: source.width,
      height: source.height,
      color: input.productColor,
      faceBounds: null,
    });
  }

  const maximum = 384;
  const ratio = Math.min(1, maximum / Math.max(source.width, source.height));
  const width = Math.max(32, Math.round(source.width * ratio));
  const height = Math.max(32, Math.round(source.height * ratio));
  const canvas = createCanvas(width, height);
  const context = canvas.getContext("2d");
  context.drawImage(source, 0, 0, width, height);
  const pixels = context.getImageData(0, 0, width, height).data;
  let samMask: Uint8Array | null = null;
  if (input.segmentationMask) {
    const actualChecksum = createHash("sha256")
      .update(input.segmentationMask.bytes)
      .digest("hex");
    if (
      actualChecksum !== input.segmentationMask.checksumSha256 ||
      input.segmentationMask.width !== source.width ||
      input.segmentationMask.height !== source.height
    ) {
      return failure({
        reason: "GARMENT_NOT_FOUND",
        width: source.width,
        height: source.height,
        color: input.productColor,
        faceBounds: input.faceBounds ?? null,
      });
    }
    try {
      const maskImage = await loadImage(input.segmentationMask.bytes);
      if (maskImage.width !== source.width || maskImage.height !== source.height) {
        throw new Error("mask dimensions mismatch");
      }
      const maskCanvas = createCanvas(width, height);
      const maskContext = maskCanvas.getContext("2d");
      maskContext.imageSmoothingEnabled = false;
      maskContext.drawImage(maskImage, 0, 0, width, height);
      const maskPixels = maskContext.getImageData(0, 0, width, height).data;
      samMask = new Uint8Array(width * height);
      for (let index = 0; index < samMask.length; index += 1) {
        const offset = index * 4;
        const luminance =
          maskPixels[offset]! * 0.2126 +
          maskPixels[offset + 1]! * 0.7152 +
          maskPixels[offset + 2]! * 0.0722;
        if (maskPixels[offset + 3]! >= 128 && luminance >= 128) {
          samMask[index] = 1;
        }
      }
    } catch {
      return failure({
        reason: "GARMENT_NOT_FOUND",
        width: source.width,
        height: source.height,
        color: input.productColor,
        faceBounds: input.faceBounds ?? null,
      });
    }
  }
  const face = input.faceBounds ?? null;
  const centerX = face ? face.x + face.width / 2 : 0.5;
  const neckBottom = face ? clamp(face.y + face.height * 1.35, 0.12, 0.58) : 0.2;
  const seedTop = clamp(neckBottom + 0.025, 0.18, 0.62);
  const seedBottom = clamp(seedTop + (face ? Math.max(0.07, face.height * 0.75) : 0.16), seedTop + 0.04, 0.75);
  const seedLeft = clamp(centerX - (face ? Math.max(0.07, face.width * 0.55) : 0.08));
  const seedRight = clamp(centerX + (face ? Math.max(0.07, face.width * 0.55) : 0.08));
  const samples: Rgb[] = [];
  for (let y = Math.floor(seedTop * height); y < Math.ceil(seedBottom * height); y += 2) {
    for (let x = Math.floor(seedLeft * width); x < Math.ceil(seedRight * width); x += 2) {
      const index = (y * width + x) * 4;
      samples.push({ r: pixels[index]!, g: pixels[index + 1]!, b: pixels[index + 2]! });
    }
  }
  const seedColor = {
    r: median(samples.map((sample) => sample.r)),
    g: median(samples.map((sample) => sample.g)),
    b: median(samples.map((sample) => sample.b)),
  };
  const expected = expectedColor(input.productColor);
  // If the central torso sample is far from the declared garment colour, the
  // generated shirt cannot be located confidently enough for paid placement.
  const seedMatchesExpected =
    Boolean(samMask) || !expected || distance(seedColor, expected) <= 125;
  if (!samMask && expected && !seedMatchesExpected) {
    return failure({
      reason: "GARMENT_NOT_FOUND",
      width: source.width,
      height: source.height,
      color: input.productColor,
      faceBounds: face,
      confidence: 0.1,
    });
  }
  const candidate = samMask ?? new Uint8Array(width * height);
  const searchTop = Math.floor(Math.max(0.12, neckBottom - 0.015) * height);
  const searchBottom = Math.ceil(0.94 * height);
  if (!samMask) {
    for (let y = searchTop; y < searchBottom; y += 1) {
      for (let x = Math.floor(0.06 * width); x < Math.ceil(0.94 * width); x += 1) {
        const index = (y * width + x) * 4;
        const color = { r: pixels[index]!, g: pixels[index + 1]!, b: pixels[index + 2]! };
        const seedDistance = distance(color, seedColor);
        const expectedDistance = expected ? distance(color, expected) : Number.POSITIVE_INFINITY;
        if (seedDistance <= 92 || (seedMatchesExpected && expectedDistance <= 105)) {
          candidate[y * width + x] = 1;
        }
      }
    }
  }

  const legPreset =
    input.placementPreset === "LEFT_LEG" ||
    input.placementPreset === "UPPER_LEFT_LEG"
      ? "LEFT"
      : input.placementPreset === "RIGHT_LEG" ||
          input.placementPreset === "UPPER_RIGHT_LEG"
        ? "RIGHT"
        : null;
  const seedX = Math.round(
    (kind === "JOGGER" ? (legPreset === "LEFT" ? 0.38 : legPreset === "RIGHT" ? 0.62 : 0.5) : centerX) *
      (width - 1),
  );
  const seedY = Math.round(
    (kind === "JOGGER" ? 0.62 : (seedTop + seedBottom) / 2) *
      (height - 1),
  );
  let start = seedY * width + seedX;
  if (!candidate[start]) {
    let found = -1;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (let index = 0; index < candidate.length; index += 1) {
      if (!candidate[index]) continue;
      const x = index % width;
      const y = Math.floor(index / width);
      const squaredDistance = (x - seedX) ** 2 + (y - seedY) ** 2;
      if (squaredDistance < bestDistance) {
        bestDistance = squaredDistance;
        found = index;
      }
    }
    if (found < 0) return failure({ reason: "GARMENT_NOT_FOUND", width: source.width, height: source.height, color: input.productColor, faceBounds: face });
    start = found;
  }

  const visited = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let head = 0;
  let tail = 0;
  queue[tail++] = start;
  visited[start] = 1;
  let minX = width;
  let maxX = 0;
  let minY = height;
  let maxY = 0;
  let count = 0;
  const rows = new Map<number, { left: number; right: number }>();
  while (head < tail) {
    const current = queue[head++]!;
    const y = Math.floor(current / width);
    const x = current % width;
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y); count += 1;
    const row = rows.get(y);
    rows.set(y, row ? { left: Math.min(row.left, x), right: Math.max(row.right, x) } : { left: x, right: x });
    const neighbors = [x > 0 ? current - 1 : -1, x < width - 1 ? current + 1 : -1, y > searchTop ? current - width : -1, y < searchBottom - 1 ? current + width : -1];
    for (const next of neighbors) if (next >= 0 && candidate[next] && !visited[next]) { visited[next] = 1; queue[tail++] = next; }
  }

  const componentBounds: NormalizedBounds = {
    x: minX / width,
    y: minY / height,
    width: (maxX - minX + 1) / width,
    height: (maxY - minY + 1) / height,
  };
  const componentFraction = count / (width * height);
  const spansAlmostEntireSearchArea =
    minX <= Math.floor(width * 0.065) &&
    maxX >= Math.ceil(width * 0.935);
  if (
    componentBounds.width < 0.2 ||
    componentBounds.height < 0.2 ||
    componentFraction < 0.035 ||
    componentFraction > 0.58 ||
    spansAlmostEntireSearchArea
  ) {
    return failure({ reason: "GARMENT_NOT_FOUND", width: source.width, height: source.height, color: input.productColor, faceBounds: face, garmentBounds: componentBounds, confidence: Math.min(0.49, componentFraction * 4) });
  }

  const boundaryRows = samMask
    ? (() => {
        const result = new Map<number, { left: number; right: number }>();
        for (let row = 0; row < height; row += 1) {
          for (let column = 0; column < width; column += 1) {
            if (!samMask[row * width + column]) continue;
            const span = result.get(row);
            result.set(
              row,
              span
                ? {
                    left: Math.min(span.left, column),
                    right: Math.max(span.right, column),
                  }
                : { left: column, right: column },
            );
          }
        }
        return result;
      })()
    : rows;
  const boundaryEntries = [...boundaryRows.entries()];
  const boundaryMinY = Math.min(...boundaryEntries.map(([row]) => row));
  const boundaryMaxY = Math.max(...boundaryEntries.map(([row]) => row));
  const boundaryMinX = Math.min(
    ...boundaryEntries.map(([, span]) => span.left),
  );
  const boundaryMaxX = Math.max(
    ...boundaryEntries.map(([, span]) => span.right),
  );
  const garmentBounds: NormalizedBounds = {
    x: boundaryMinX / width,
    y: boundaryMinY / height,
    width: (boundaryMaxX - boundaryMinX + 1) / width,
    height: (boundaryMaxY - boundaryMinY + 1) / height,
  };

  const sampledRows = boundaryEntries
    .filter(
      ([row]) =>
        row >= Math.floor(garmentBounds.y * height) && row <= boundaryMaxY,
    )
    .filter(
      (_, index, all) =>
        index % Math.max(1, Math.floor(all.length / 6)) === 0,
    )
    .slice(0, 6);
  const garmentOutline = [
    ...sampledRows.map(([row, span]) => ({
      x: span.left / width,
      y: row / height,
    })),
    ...sampledRows
      .slice()
      .reverse()
      .map(([row, span]) => ({ x: span.right / width, y: row / height })),
  ];

  const useFrontTorsoEnvelope =
    kind === "TSHIRT" &&
    input.side === "FRONT" &&
    ((input.placementPreset === "FRONT_LARGE" &&
      Boolean(input.ownerPrintFootprint)) ||
      Boolean(input.orientedFrontPrintPlane)) &&
    Boolean(samMask);
  const frontTorsoEnvelope = useFrontTorsoEnvelope
    ? resolveFrontTorsoPrintEnvelope({
        rows: boundaryEntries.map(([row, span]) => ({ row, ...span })),
        imageWidth: width,
        imageHeight: height,
        fullGarmentBounds: garmentBounds,
        neckExclusionBottom: neckBottom,
      })
    : null;
  if (frontTorsoEnvelope?.status === "UNSAFE") {
    return failure({
      reason: "FRONT_TORSO_UNSAFE",
      width: source.width,
      height: source.height,
      color: input.productColor,
      faceBounds: face,
      garmentBounds,
      garmentBodyBounds: frontTorsoEnvelope.torsoBounds,
      confidence: frontTorsoEnvelope.confidence,
      garmentOutline,
      frontTorsoEnvelope,
    });
  }

  const legacyTorsoRows = [...rows.entries()].filter(([row]) => {
    const position = (row - minY) / Math.max(1, maxY - minY);
    return position >= 0.2 && position <= 0.9;
  });
  if (legacyTorsoRows.length < 4) {
    return failure({
      reason: "GARMENT_NOT_FOUND",
      width: source.width,
      height: source.height,
      color: input.productColor,
      faceBounds: face,
      garmentBounds,
      confidence: 0.3,
      garmentOutline,
    });
  }
  const torsoLeft = median(legacyTorsoRows.map(([, span]) => span.left)) / width;
  const torsoRight = median(legacyTorsoRows.map(([, span]) => span.right)) / width;
  const horizontalExpansion = Math.min(
    garmentBounds.width * 0.035,
    Math.max(0, torsoRight - torsoLeft) * 0.035,
  );
  const legacyGarmentBodyBounds: NormalizedBounds = {
    x: clamp(torsoLeft - horizontalExpansion, garmentBounds.x, 1),
    y: Math.max(garmentBounds.y, neckBottom),
    width: clamp(
      torsoRight - torsoLeft + horizontalExpansion * 2,
      0.16,
      garmentBounds.x + garmentBounds.width -
        clamp(torsoLeft - horizontalExpansion, garmentBounds.x, 1),
    ),
    height:
      garmentBounds.y + garmentBounds.height -
      Math.max(garmentBounds.y, neckBottom),
  };
  const garmentBodyBounds =
    frontTorsoEnvelope?.torsoBounds ?? legacyGarmentBodyBounds;

  const footprint = input.ownerPrintFootprint ?? null;
  const intent: NormalizedBounds = footprint
    ? (() => {
        const width =
          garmentBodyBounds.width *
          footprint.requestedTemplateGarmentWidthRatio;
        const height =
          (width * source.width) /
          (footprint.artwork.aspectRatio * source.height);
        const relativeHeight = height / garmentBodyBounds.height;
        return {
          x: footprint.requestedCenterX -
            footprint.requestedTemplateGarmentWidthRatio / 2,
          y: footprint.requestedCenterY - relativeHeight / 2,
          width: footprint.requestedTemplateGarmentWidthRatio,
          height: relativeHeight,
        };
      })()
    : legacyIntent;
  if (
    intent.width > 1 ||
    intent.height > 1 ||
    (!footprint &&
      (intent.x < 0 ||
        intent.y < 0 ||
        intent.x + intent.width > 1 ||
        intent.y + intent.height > 1))
  ) {
    return failure({
      reason: "LARGE_FRONT_UNSAFE",
      width: source.width,
      height: source.height,
      color: input.productColor,
      faceBounds: face,
      garmentBounds,
      garmentBodyBounds,
      confidence: 0.4,
      garmentOutline,
      ...(frontTorsoEnvelope ? { frontTorsoEnvelope } : {}),
    });
  }
  const requestedBox: NormalizedBounds = {
    x: garmentBodyBounds.x + garmentBodyBounds.width * intent.x,
    y: garmentBodyBounds.y + garmentBodyBounds.height * intent.y,
    width: garmentBodyBounds.width * intent.width,
    height: garmentBodyBounds.height * intent.height,
  };
  const verticalContract = input.ownerVerticalPlacement ?? null;
  const requestedCenterYRelative =
    (requestedBox.y + requestedBox.height / 2 - garmentBodyBounds.y) /
    garmentBodyBounds.height;
  if (
    verticalContract &&
    (verticalContract.placementPreset !== input.placementPreset ||
      Math.abs(
        requestedCenterYRelative -
          verticalContract.expectedFinalFootprint.centerY,
      ) > 1e-6)
  ) {
    return failure({
      reason: "OWNER_VERTICAL_PLACEMENT_UNSAFE",
      width: source.width,
      height: source.height,
      color: input.productColor,
      faceBounds: face,
      garmentBounds,
      garmentBodyBounds,
      confidence: 0.4,
      garmentOutline,
      ...(frontTorsoEnvelope ? { frontTorsoEnvelope } : {}),
    });
  }
  const largeFront =
    kind === "TSHIRT" &&
    input.side === "FRONT" &&
    input.placementPreset === "FRONT_LARGE";
  const printableTorsoBounds = frontTorsoEnvelope?.printableTorsoBounds;
  const safeLeft = printableTorsoBounds
    ? printableTorsoBounds.x
    : garmentBodyBounds.x + garmentBodyBounds.width * 0.02;
  const safeRight = printableTorsoBounds
    ? printableTorsoBounds.x + printableTorsoBounds.width
    : garmentBodyBounds.x + garmentBodyBounds.width * 0.98;
  const safeTop = printableTorsoBounds
    ? printableTorsoBounds.y
    : Math.max(
        neckBottom + 0.008,
        garmentBodyBounds.y +
          garmentBodyBounds.height * (largeFront ? 0.12 : 0.04),
      );
  const safeBottom = printableTorsoBounds
    ? printableTorsoBounds.y + printableTorsoBounds.height
    : garmentBodyBounds.y +
      garmentBodyBounds.height * (largeFront ? 0.94 : 0.97);
  const clampReasons: Array<
    "GARMENT_LEFT" | "GARMENT_RIGHT" | "COLLAR_CLEARANCE" | "GARMENT_HEM"
  > = [];
  if (
    requestedBox.width > safeRight - safeLeft ||
    requestedBox.height > safeBottom - safeTop
  ) {
    const unsafeEvidence: NonNullable<
      GarmentRegistrationV3["placementEvidence"]
    > = {
      placementPreset: input.placementPreset ?? null,
      ownerUniformScale:
        footprint?.ownerPlacement.uniformScale ?? input.ownerPlacement.uniformScale,
      ownerOffsetX:
        footprint?.ownerPlacement.offsetX ?? input.ownerPlacement.offsetX,
      ownerOffsetY:
        footprint?.ownerPlacement.offsetY ?? input.ownerPlacement.offsetY,
      garmentRelativeIntent: intent,
      requestedPrintBounds: requestedBox,
      finalPrintBounds: requestedBox,
      clampDeltaX: 0,
      clampDeltaY: 0,
      sizeReductionRatio: 1,
      clampReasons: [],
      largeFrontPreserved: false,
      ...(footprint
        ? {
            ownerPrintFootprint: {
              contractVersion: OWNER_PRINT_FOOTPRINT_VERSION,
              requestedWidthRatio: intent.width,
              requestedHeightRatio: intent.height,
              registeredWidthRatio: intent.width,
              registeredHeightRatio: intent.height,
              registrationScaleDelta: 0,
              footprintPreserved: false,
              failureStage: "REGISTRATION" as const,
            },
          }
        : {}),
      ...(largeFront && !footprint
        ? {
            frontLargeTuning: {
              version: FRONT_LARGE_GARMENT_TUNING_VERSION,
              scaleMultiplier: FRONT_LARGE_EFFECTIVE_SCALE_MULTIPLIER,
              upwardShiftGarmentRatio:
                FRONT_LARGE_UPWARD_SHIFT_GARMENT_RATIO,
              effectiveUniformScale:
                input.ownerPlacement.uniformScale *
                FRONT_LARGE_EFFECTIVE_SCALE_MULTIPLIER,
              effectiveCenterY: intent.y + intent.height / 2,
            },
          }
        : {}),
    };
    return failure({
      reason: largeFront ? "LARGE_FRONT_UNSAFE" : "PRINT_REGION_OUTSIDE_GARMENT",
      width: source.width,
      height: source.height,
      color: input.productColor,
      faceBounds: face,
      garmentBounds,
      garmentBodyBounds,
      confidence: 0.45,
      garmentOutline,
      placementEvidence: unsafeEvidence,
      ...(frontTorsoEnvelope ? { frontTorsoEnvelope } : {}),
    });
  }
  const box = { ...requestedBox };
  if (box.x < safeLeft) {
    box.x = safeLeft;
    clampReasons.push("GARMENT_LEFT");
  }
  if (box.x + box.width > safeRight) {
    box.x = safeRight - box.width;
    clampReasons.push("GARMENT_RIGHT");
  }
  if (box.y < safeTop) {
    box.y = safeTop;
    clampReasons.push("COLLAR_CLEARANCE");
  }
  if (box.y + box.height > safeBottom) {
    box.y = safeBottom - box.height;
    clampReasons.push("GARMENT_HEM");
  }
  const relativeCenterY =
    (box.y + box.height / 2 - garmentBodyBounds.y) /
    garmentBodyBounds.height;
  const relativeTop =
    (box.y - garmentBodyBounds.y) / garmentBodyBounds.height;
  const verticalClampDelta =
    (box.y - requestedBox.y) / garmentBodyBounds.height;
  const verticalClampReason = clampReasons.includes("COLLAR_CLEARANCE")
    ? ("COLLAR_CLEARANCE" as const)
    : clampReasons.includes("GARMENT_HEM")
      ? ("GARMENT_HEM" as const)
      : null;
  const verticalWithinSafetyTolerance =
    !verticalContract ||
    Math.abs(verticalClampDelta) <=
      verticalContract.maximumVerticalClampRatio + 1e-9;
  if (verticalContract && !verticalWithinSafetyTolerance) {
    return failure({
      reason: "OWNER_VERTICAL_PLACEMENT_UNSAFE",
      width: source.width,
      height: source.height,
      color: input.productColor,
      faceBounds: face,
      garmentBounds,
      garmentBodyBounds,
      confidence: 0.5,
      garmentOutline,
      ...(frontTorsoEnvelope ? { frontTorsoEnvelope } : {}),
    });
  }
  const largeFrontPreserved =
    !largeFront ||
    ((footprint
      ? Math.max(intent.width, intent.height) >= 0.5 &&
        relativeCenterY >= 0.38
      : intent.width >= 0.5 &&
        intent.height >= 0.42 &&
        relativeCenterY >= 0.48) &&
      relativeCenterY <= 0.68 &&
      relativeTop >= (frontTorsoEnvelope ? 0 : 0.1));
  const placementEvidence: NonNullable<
    GarmentRegistrationV3["placementEvidence"]
  > = {
    placementPreset: input.placementPreset ?? null,
    ownerUniformScale:
      footprint?.ownerPlacement.uniformScale ?? input.ownerPlacement.uniformScale,
    ownerOffsetX:
      footprint?.ownerPlacement.offsetX ?? input.ownerPlacement.offsetX,
    ownerOffsetY:
      footprint?.ownerPlacement.offsetY ?? input.ownerPlacement.offsetY,
    garmentRelativeIntent: intent,
    requestedPrintBounds: requestedBox,
    finalPrintBounds: box,
    clampDeltaX: box.x - requestedBox.x,
    clampDeltaY: box.y - requestedBox.y,
    sizeReductionRatio: 1,
    clampReasons,
    largeFrontPreserved,
    ...(footprint
      ? {
          ownerPrintFootprint: {
            contractVersion: OWNER_PRINT_FOOTPRINT_VERSION,
            requestedWidthRatio: intent.width,
            requestedHeightRatio: intent.height,
            registeredWidthRatio: box.width / garmentBodyBounds.width,
            registeredHeightRatio: box.height / garmentBodyBounds.height,
            registrationScaleDelta: Math.min(
              box.width / requestedBox.width,
              box.height / requestedBox.height,
            ) - 1,
            footprintPreserved:
              Math.abs(box.width / requestedBox.width - 1) <=
                footprint.maximumLinearSafetyDeviation &&
              Math.abs(box.height / requestedBox.height - 1) <=
                footprint.maximumLinearSafetyDeviation,
            failureStage: null,
          },
        }
      : {}),
    ...(verticalContract
      ? {
          ownerVerticalPlacement: {
            contractVersion: verticalContract.contractVersion,
            placementPreset: verticalContract.placementPreset,
            ownerYRequested: verticalContract.ownerOffsetY,
            previewY: verticalContract.previewCenterY,
            requestedRegisteredY: requestedCenterYRelative,
            registeredY: relativeCenterY,
            finalY: relativeCenterY,
            yPreserved: Math.abs(verticalClampDelta) <= 1e-9,
            withinSafetyTolerance: true,
            clampApplied: Math.abs(verticalClampDelta) > 1e-9,
            clampDelta: verticalClampDelta,
            clampReason: verticalClampReason,
            footprintPreserved: true,
            secondContainApplied: false,
            secondGlobalScaleApplied: false,
            secondGlobalTranslationApplied: false,
          },
        }
      : {}),
    ...(largeFront && !footprint
      ? {
          frontLargeTuning: {
            version: FRONT_LARGE_GARMENT_TUNING_VERSION,
            scaleMultiplier: FRONT_LARGE_EFFECTIVE_SCALE_MULTIPLIER,
            upwardShiftGarmentRatio:
              FRONT_LARGE_UPWARD_SHIFT_GARMENT_RATIO,
            effectiveUniformScale:
              input.ownerPlacement.uniformScale *
              FRONT_LARGE_EFFECTIVE_SCALE_MULTIPLIER,
            effectiveCenterY: intent.y + intent.height / 2,
          },
        }
      : {}),
  };
  if (!largeFrontPreserved) {
    return failure({
      reason: verticalContract
        ? "OWNER_VERTICAL_PLACEMENT_UNSAFE"
        : "LARGE_FRONT_UNSAFE",
      width: source.width,
      height: source.height,
      color: input.productColor,
      faceBounds: face,
      garmentBounds,
      garmentBodyBounds,
      confidence: 0.5,
      placementEvidence,
      garmentOutline,
      ...(frontTorsoEnvelope ? { frontTorsoEnvelope } : {}),
    });
  }
  if (
    footprint &&
    !placementEvidence.ownerPrintFootprint?.footprintPreserved
  ) {
    return failure({
      reason: "LARGE_FRONT_UNSAFE",
      width: source.width,
      height: source.height,
      color: input.productColor,
      faceBounds: face,
      garmentBounds,
      garmentBodyBounds,
      confidence: 0.5,
      placementEvidence: {
        ...placementEvidence,
        ownerPrintFootprint: {
          ...placementEvidence.ownerPrintFootprint!,
          failureStage: "REGISTRATION",
        },
      },
      garmentOutline,
      ...(frontTorsoEnvelope ? { frontTorsoEnvelope } : {}),
    });
  }
  const needsNormalAssistance =
    input.orientedFrontPrintPlane?.contractVersion ===
    "nexhq-oriented-front-print-plane-v2.2-normal-assisted";
  if (needsNormalAssistance && !input.normalMap) {
    return failure({
      reason: "MIDAS_NORMAL_MISSING",
      width: source.width,
      height: source.height,
      color: input.productColor,
      faceBounds: face,
      garmentBounds,
      garmentBodyBounds,
      confidence: 0,
      placementEvidence,
      garmentOutline,
      ...(frontTorsoEnvelope ? { frontTorsoEnvelope } : {}),
    });
  }
  let normalOrientation = null;
  if (needsNormalAssistance && input.normalMap && frontTorsoEnvelope?.printableTorsoBounds) {
    const checksum = createHash("sha256").update(input.normalMap.bytes).digest("hex");
    if (
      checksum !== input.normalMap.checksumSha256 ||
      input.normalMap.width !== source.width ||
      input.normalMap.height !== source.height
    ) {
      return failure({ reason: "MIDAS_NORMAL_INVALID", width: source.width, height: source.height, color: input.productColor, faceBounds: face, garmentBounds, garmentBodyBounds, confidence: 0, placementEvidence, garmentOutline, frontTorsoEnvelope });
    }
    const safe = frontTorsoEnvelope.printableTorsoBounds;
    const neighborhood = {
      x: Math.max(safe.x, box.x - box.width * 0.12),
      y: Math.max(safe.y, box.y - box.height * 0.12),
      right: Math.min(safe.x + safe.width, box.x + box.width * 1.12),
      bottom: Math.min(safe.y + safe.height, box.y + box.height * 1.12),
    };
    normalOrientation = await analyzeGarmentNormalOrientation({
      normalMapBytes: input.normalMap.bytes,
      imageWidth: source.width,
      imageHeight: source.height,
      contains: (x, y) => {
        if (x < neighborhood.x || x > neighborhood.right || y < neighborhood.y || y > neighborhood.bottom) return false;
        const px = Math.min(width - 1, Math.max(0, Math.round(x * (width - 1))));
        const py = Math.min(height - 1, Math.max(0, Math.round(y * (height - 1))));
        return visited[py * width + px] === 1;
      },
    });
  }
  const orientedFrontPrintPlane =
    input.orientedFrontPrintPlane && frontTorsoEnvelope
      ? resolveOrientedFrontPrintPlaneV2({
          rows: boundaryEntries.map(([row, span]) => ({ row, ...span })),
          imageWidth: width,
          imageHeight: height,
          torsoEnvelope: frontTorsoEnvelope,
          printBounds: box,
          ownerScale:
            footprint?.ownerPlacement.uniformScale ??
            input.ownerPlacement.uniformScale,
          ownerOffsetX:
            footprint?.ownerPlacement.offsetX ?? input.ownerPlacement.offsetX,
          ownerOffsetY:
            footprint?.ownerPlacement.offsetY ?? input.ownerPlacement.offsetY,
          policy: input.orientedFrontPrintPlane,
          maskContains: (x, y) => {
            const px = Math.min(
              width - 1,
              Math.max(0, Math.round(x * (width - 1))),
            );
            const py = Math.min(
              height - 1,
              Math.max(0, Math.round(y * (height - 1))),
            );
            return visited[py * width + px] === 1;
          },
          ...(normalOrientation ? { normalOrientation } : {}),
        })
      : null;
  if (orientedFrontPrintPlane?.status === "REFUSED") {
    return failure({
      reason: orientedFrontPrintPlane.reason as Exclude<
        GarmentRegistrationV3["reason"],
        "REGISTERED"
      >,
      width: source.width,
      height: source.height,
      color: input.productColor,
      faceBounds: face,
      garmentBounds,
      garmentBodyBounds,
      confidence: orientedFrontPrintPlane.orientationConfidence,
      placementEvidence,
      garmentOutline,
      orientedFrontPrintPlane,
      ...(frontTorsoEnvelope ? { frontTorsoEnvelope } : {}),
    });
  }
  const quad: NormalizedQuad = orientedFrontPrintPlane?.orientedQuad ?? [
    { x: box.x, y: box.y },
    { x: box.x + box.width, y: box.y },
    { x: box.x + box.width, y: box.y + box.height },
    { x: box.x, y: box.y + box.height },
  ];

  const quadPoint = (u: number, v: number) => {
    const [tl, tr, br, bl] = quad;
    return {
      x:
        tl.x * (1 - u) * (1 - v) +
        tr.x * u * (1 - v) +
        br.x * u * v +
        bl.x * (1 - u) * v,
      y:
        tl.y * (1 - u) * (1 - v) +
        tr.y * u * (1 - v) +
        br.y * u * v +
        bl.y * (1 - u) * v,
    };
  };

  let covered = 0;
  let total = 0;
  for (let gy = 0; gy < 12; gy += 1) for (let gx = 0; gx < 12; gx += 1) {
    const point = quadPoint((gx + 0.5) / 12, (gy + 0.5) / 12);
    const x = Math.min(width - 1, Math.max(0, Math.round(point.x * (width - 1))));
    const y = Math.min(height - 1, Math.max(0, Math.round(point.y * (height - 1))));
    total += 1;
    if (visited[y * width + x]) covered += 1;
  }
  const coverage = covered / total;
  const quadXs = quad.map((point) => point.x);
  const quadYs = quad.map((point) => point.y);
  const quadBounds = {
    x: Math.min(...quadXs),
    y: Math.min(...quadYs),
    width: Math.max(...quadXs) - Math.min(...quadXs),
    height: Math.max(...quadYs) - Math.min(...quadYs),
  };
  const overlapsFace = face && quadBounds.x < face.x + face.width && quadBounds.x + quadBounds.width > face.x && quadBounds.y < face.y + face.height && quadBounds.y + quadBounds.height > face.y;
  if (overlapsFace || quadBounds.y < neckBottom - 1e-6) {
    return failure({ reason: "FACE_OR_NECK_OVERLAP", width: source.width, height: source.height, color: input.productColor, faceBounds: face, garmentBounds, garmentBodyBounds, confidence: 0.2, coverage, placementEvidence, garmentOutline, ...(orientedFrontPrintPlane ? { orientedFrontPrintPlane } : {}), ...(frontTorsoEnvelope ? { frontTorsoEnvelope } : {}) });
  }
  const confidence = clamp(coverage * 0.62 + Math.min(1, componentFraction / 0.18) * 0.23 + (seedMatchesExpected ? 0.15 : 0.04));
  if (coverage < 0.78 || confidence < 0.62) {
    return failure({ reason: largeFront ? "LARGE_FRONT_UNSAFE" : "PRINT_REGION_OUTSIDE_GARMENT", width: source.width, height: source.height, color: input.productColor, faceBounds: face, garmentBounds, garmentBodyBounds, confidence, coverage, placementEvidence, garmentOutline, ...(orientedFrontPrintPlane ? { orientedFrontPrintPlane } : {}), ...(frontTorsoEnvelope ? { frontTorsoEnvelope } : {}) });
  }
  return garmentRegistrationV3Schema.parse({
    contractVersion: "garment-registration-v3",
    mappingVersion: "GENERATED_GARMENT_RELATIVE_V3",
    status: "REGISTERED",
    reason: "REGISTERED",
    confidence,
    garmentBounds,
    garmentBodyBounds,
    faceBounds: face,
    neckExclusionBottom: face ? neckBottom : null,
    registeredPrintQuad: quad,
    garmentOutline,
    ...(frontTorsoEnvelope ? { frontTorsoEnvelope } : {}),
    ...(orientedFrontPrintPlane ? { orientedFrontPrintPlane } : {}),
    maskCoverage: coverage,
    placementEvidence,
    expectedColor: input.productColor,
    boundaryEvidence: samMask
      ? "SAM3_VALIDATED_MASK"
      : "LOCAL_COLOR_COMPONENT",
    ...(input.segmentationMask
      ? {
          segmentationMaskChecksumSha256:
            input.segmentationMask.checksumSha256,
        }
      : {}),
    imageWidth: source.width,
    imageHeight: source.height,
  });
}

export function printSurfaceForGarmentRegistrationV3(
  surface: PrintSurface,
  registration: GarmentRegistrationV3,
): PrintSurface {
  if (registration.status !== "REGISTERED" || !registration.registeredPrintQuad) {
    throw new Error("Druckfläche konnte auf diesem Bild nicht sicher erkannt werden.");
  }
  const xs = registration.registeredPrintQuad.map((point) => point.x);
  const ys = registration.registeredPrintQuad.map((point) => point.y);
  return printSurfaceSchema.parse({
    ...surface,
    quad: registration.registeredPrintQuad,
    boundingBox: {
      x: Math.min(...xs),
      y: Math.min(...ys),
      width: Math.max(...xs) - Math.min(...xs),
      height: Math.max(...ys) - Math.min(...ys),
    },
    warpMode: registration.orientedFrontPrintPlane?.status === "READY"
      ? "PERSPECTIVE"
      : "NONE",
  });
}
