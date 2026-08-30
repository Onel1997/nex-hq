import { createCanvas, loadImage } from "canvas";
import { z } from "zod";

import type { NormalizedQuad, PrintSurface } from "@/lib/image/print-surface/types";
import { printSurfaceSchema } from "@/lib/image/print-surface/types";
import type { OwnerArtworkPlacement } from "@/lib/product-library/product-family";
import type { NormalizedPrintArea, ProductFamilySide } from "@/lib/product-library/product-family";

const boxSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  width: z.number().positive().max(1),
  height: z.number().positive().max(1),
}).strict();

export type NormalizedBounds = z.infer<typeof boxSchema>;

export const garmentRegistrationV2Schema = z.object({
  contractVersion: z.literal("garment-registration-v2"),
  mappingVersion: z.literal("GENERATED_GARMENT_RELATIVE_V2"),
  status: z.enum(["REGISTERED", "LOW_CONFIDENCE"]),
  reason: z.enum([
    "REGISTERED",
    "UNREADABLE_BASE",
    "UNSUPPORTED_PRODUCT",
    "FACE_NOT_FOUND",
    "GARMENT_NOT_FOUND",
    "PRINT_REGION_OUTSIDE_GARMENT",
    "FACE_OR_NECK_OVERLAP",
  ]),
  confidence: z.number().min(0).max(1),
  garmentBounds: boxSchema.nullable(),
  faceBounds: boxSchema.nullable(),
  neckExclusionBottom: z.number().min(0).max(1).nullable(),
  registeredPrintQuad: z.tuple([
    z.object({ x: z.number(), y: z.number() }),
    z.object({ x: z.number(), y: z.number() }),
    z.object({ x: z.number(), y: z.number() }),
    z.object({ x: z.number(), y: z.number() }),
  ]).nullable(),
  garmentOutline: z.array(z.object({ x: z.number(), y: z.number() })).max(24),
  maskCoverage: z.number().min(0).max(1),
  expectedColor: z.string().nullable(),
  imageWidth: z.number().int().positive(),
  imageHeight: z.number().int().positive(),
}).strict();

export type GarmentRegistrationV2 = z.infer<typeof garmentRegistrationV2Schema>;

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

function garmentKind(productType: string): "TSHIRT" | "HOODIE" | "ZIP_HOODIE" | "OTHER" {
  const value = productType.toLocaleLowerCase("de-DE");
  if (/zip/.test(value) && /hood/.test(value)) return "ZIP_HOODIE";
  if (/hood/.test(value)) return "HOODIE";
  if (/shirt|tee/.test(value)) return "TSHIRT";
  return "OTHER";
}

const TEMPLATE_GARMENT_FRAMES: Record<"TSHIRT" | "HOODIE" | "ZIP_HOODIE", NormalizedBounds> = {
  TSHIRT: { x: 0.14, y: 0.07, width: 0.72, height: 0.86 },
  HOODIE: { x: 0.12, y: 0.05, width: 0.76, height: 0.9 },
  ZIP_HOODIE: { x: 0.12, y: 0.05, width: 0.76, height: 0.9 },
};

export function printIntentWithinGarment(input: {
  productType: string;
  printableArea: NormalizedPrintArea;
  placement: OwnerArtworkPlacement;
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
  return {
    x: relative.x + travelX + input.placement.offsetX * travelX,
    y: relative.y + travelY + input.placement.offsetY * travelY,
    width,
    height,
  };
}

function failure(input: {
  reason: Exclude<GarmentRegistrationV2["reason"], "REGISTERED">;
  width: number;
  height: number;
  color: string | null;
  faceBounds: NormalizedBounds | null;
  garmentBounds?: NormalizedBounds | null;
  confidence?: number;
  coverage?: number;
}): GarmentRegistrationV2 {
  return garmentRegistrationV2Schema.parse({
    contractVersion: "garment-registration-v2",
    mappingVersion: "GENERATED_GARMENT_RELATIVE_V2",
    status: "LOW_CONFIDENCE",
    reason: input.reason,
    confidence: input.confidence ?? 0,
    garmentBounds: input.garmentBounds ?? null,
    faceBounds: input.faceBounds,
    neckExclusionBottom: input.faceBounds
      ? clamp(input.faceBounds.y + input.faceBounds.height * 1.35)
      : null,
    registeredPrintQuad: null,
    garmentOutline: [],
    maskCoverage: input.coverage ?? 0,
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
export async function registerGeneratedGarmentV2(input: {
  bytes: Buffer;
  productType: string;
  productColor: string | null;
  side: ProductFamilySide;
  printableArea: NormalizedPrintArea;
  ownerPlacement: OwnerArtworkPlacement;
  faceBounds?: NormalizedBounds | null;
  requireFaceBounds?: boolean;
}): Promise<GarmentRegistrationV2> {
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
  const intent = printIntentWithinGarment({
    productType: input.productType,
    printableArea: input.printableArea,
    placement: input.ownerPlacement,
  });
  if (!intent) {
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
  const seedMatchesExpected = !expected || distance(seedColor, expected) <= 125;
  if (expected && !seedMatchesExpected) {
    return failure({
      reason: "GARMENT_NOT_FOUND",
      width: source.width,
      height: source.height,
      color: input.productColor,
      faceBounds: face,
      confidence: 0.1,
    });
  }
  const candidate = new Uint8Array(width * height);
  const searchTop = Math.floor(Math.max(0.12, neckBottom - 0.015) * height);
  const searchBottom = Math.ceil(0.94 * height);
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

  const seedX = Math.round(centerX * (width - 1));
  const seedY = Math.round(((seedTop + seedBottom) / 2) * (height - 1));
  let start = seedY * width + seedX;
  if (!candidate[start]) {
    let found = -1;
    for (let radius = 1; radius <= Math.round(width * 0.12) && found < 0; radius += 1) {
      for (let dy = -radius; dy <= radius && found < 0; dy += 1) {
        for (const dx of [-radius, radius]) {
          const x = seedX + dx;
          const y = seedY + dy;
          if (x >= 0 && x < width && y >= 0 && y < height && candidate[y * width + x]) { found = y * width + x; break; }
        }
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

  const garmentBounds: NormalizedBounds = {
    x: minX / width,
    y: Math.max(minY / height, neckBottom),
    width: (maxX - minX + 1) / width,
    height: (maxY - Math.max(minY, Math.floor(neckBottom * height)) + 1) / height,
  };
  const componentFraction = count / (width * height);
  const spansAlmostEntireSearchArea =
    minX <= Math.floor(width * 0.065) &&
    maxX >= Math.ceil(width * 0.935);
  if (
    garmentBounds.width < 0.2 ||
    garmentBounds.height < 0.2 ||
    componentFraction < 0.035 ||
    componentFraction > 0.58 ||
    spansAlmostEntireSearchArea
  ) {
    return failure({ reason: "GARMENT_NOT_FOUND", width: source.width, height: source.height, color: input.productColor, faceBounds: face, garmentBounds, confidence: Math.min(0.49, componentFraction * 4) });
  }

  const box = {
    x: garmentBounds.x + garmentBounds.width * intent.x,
    y: garmentBounds.y + garmentBounds.height * intent.y,
    width: garmentBounds.width * intent.width,
    height: garmentBounds.height * intent.height,
  };
  box.x = clamp(box.x, garmentBounds.x, garmentBounds.x + garmentBounds.width - box.width);
  box.y = clamp(box.y, Math.max(garmentBounds.y, neckBottom), garmentBounds.y + garmentBounds.height - box.height);
  const quad: NormalizedQuad = [
    { x: box.x, y: box.y },
    { x: box.x + box.width, y: box.y },
    { x: box.x + box.width, y: box.y + box.height },
    { x: box.x, y: box.y + box.height },
  ];

  let covered = 0;
  let total = 0;
  for (let gy = 0; gy < 12; gy += 1) for (let gx = 0; gx < 12; gx += 1) {
    const x = Math.min(width - 1, Math.max(0, Math.round((box.x + box.width * ((gx + 0.5) / 12)) * width)));
    const y = Math.min(height - 1, Math.max(0, Math.round((box.y + box.height * ((gy + 0.5) / 12)) * height)));
    total += 1;
    if (visited[y * width + x]) covered += 1;
  }
  const coverage = covered / total;
  const overlapsFace = face && box.x < face.x + face.width && box.x + box.width > face.x && box.y < face.y + face.height && box.y + box.height > face.y;
  if (overlapsFace || box.y < neckBottom - 1e-6) {
    return failure({ reason: "FACE_OR_NECK_OVERLAP", width: source.width, height: source.height, color: input.productColor, faceBounds: face, garmentBounds, confidence: 0.2, coverage });
  }
  const confidence = clamp(coverage * 0.62 + Math.min(1, componentFraction / 0.18) * 0.23 + (seedMatchesExpected ? 0.15 : 0.04));
  if (coverage < 0.78 || confidence < 0.62) {
    return failure({ reason: "PRINT_REGION_OUTSIDE_GARMENT", width: source.width, height: source.height, color: input.productColor, faceBounds: face, garmentBounds, confidence, coverage });
  }

  const sampledRows = [...rows.entries()]
    .filter(([row]) => row >= Math.floor(garmentBounds.y * height) && row <= maxY)
    .filter((_, index, all) => index % Math.max(1, Math.floor(all.length / 6)) === 0)
    .slice(0, 6);
  const garmentOutline = [
    ...sampledRows.map(([row, span]) => ({ x: span.left / width, y: row / height })),
    ...sampledRows.slice().reverse().map(([row, span]) => ({ x: span.right / width, y: row / height })),
  ];
  return garmentRegistrationV2Schema.parse({
    contractVersion: "garment-registration-v2",
    mappingVersion: "GENERATED_GARMENT_RELATIVE_V2",
    status: "REGISTERED",
    reason: "REGISTERED",
    confidence,
    garmentBounds,
    faceBounds: face,
    neckExclusionBottom: face ? neckBottom : null,
    registeredPrintQuad: quad,
    garmentOutline,
    maskCoverage: coverage,
    expectedColor: input.productColor,
    imageWidth: source.width,
    imageHeight: source.height,
  });
}

export function printSurfaceForGarmentRegistration(
  surface: PrintSurface,
  registration: GarmentRegistrationV2,
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
    warpMode: "NONE",
  });
}
