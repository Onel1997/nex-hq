import { createHash } from "node:crypto";

import { createCanvas, loadImage } from "canvas";

import { assertPrintSurfaceReady, type NormalizedQuad } from "@/lib/image/print-surface/types";
import {
  COMPOSITOR_SAMPLING,
  COMPOSITOR_VERSION,
  compositingProvenanceSchema,
  deterministicCompositeRequestSchema,
  type DeterministicCompositeRequest,
  type DeterministicCompositeResult,
} from "@/lib/image/artwork-compositing/types";

type Matrix3 = [number, number, number, number, number, number, number, number, number];

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function printRegionPixelSize(quad: NormalizedQuad, outputWidth: number, outputHeight: number): {
  width: number;
  height: number;
} {
  const xs = quad.map((point) => point.x * (outputWidth - 1));
  const ys = quad.map((point) => point.y * (outputHeight - 1));
  return {
    width: Math.max(1, Math.round(Math.max(...xs) - Math.min(...xs)) + 1),
    height: Math.max(1, Math.round(Math.max(...ys) - Math.min(...ys)) + 1),
  };
}

function solveLinearSystem(matrix: number[][], vector: number[]): number[] {
  const size = vector.length;
  const augmented = matrix.map((row, index) => [...row, vector[index]!]);
  for (let column = 0; column < size; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < size; row += 1) {
      if (Math.abs(augmented[row]![column]!) > Math.abs(augmented[pivot]![column]!)) pivot = row;
    }
    [augmented[column], augmented[pivot]] = [augmented[pivot]!, augmented[column]!];
    const divisor = augmented[column]![column]!;
    if (Math.abs(divisor) < 1e-12) throw new Error("Print surface transform is degenerate.");
    for (let index = column; index <= size; index += 1) augmented[column]![index]! /= divisor;
    for (let row = 0; row < size; row += 1) {
      if (row === column) continue;
      const factor = augmented[row]![column]!;
      for (let index = column; index <= size; index += 1) {
        augmented[row]![index]! -= factor * augmented[column]![index]!;
      }
    }
  }
  return augmented.map((row) => row[size]!);
}

function homography(
  source: Array<[number, number]>,
  target: Array<[number, number]>,
): Matrix3 {
  const rows: number[][] = [];
  const values: number[] = [];
  for (let index = 0; index < 4; index += 1) {
    const [x, y] = source[index]!;
    const [u, v] = target[index]!;
    rows.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    values.push(u);
    rows.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    values.push(v);
  }
  const result = solveLinearSystem(rows, values);
  return [...result, 1] as Matrix3;
}

function invert(matrix: Matrix3): Matrix3 {
  const [a, b, c, d, e, f, g, h, i] = matrix;
  const A = e * i - f * h;
  const B = f * g - d * i;
  const C = d * h - e * g;
  const determinant = a * A + b * B + c * C;
  if (Math.abs(determinant) < 1e-12) throw new Error("Print surface transform is not invertible.");
  return [
    A / determinant,
    (c * h - b * i) / determinant,
    (b * f - c * e) / determinant,
    B / determinant,
    (a * i - c * g) / determinant,
    (c * d - a * f) / determinant,
    C / determinant,
    (b * g - a * h) / determinant,
    (a * e - b * d) / determinant,
  ];
}

function mapPoint(matrix: Matrix3, x: number, y: number): [number, number] {
  const denominator = matrix[6] * x + matrix[7] * y + matrix[8];
  return [
    (matrix[0] * x + matrix[1] * y + matrix[2]) / denominator,
    (matrix[3] * x + matrix[4] * y + matrix[5]) / denominator,
  ];
}

function lerp(start: number, end: number, t: number): number {
  return start * (1 - t) + end * t;
}

/**
 * Deterministic bilinear sample of original source RGBA. This is reconstruction
 * of approved pixels, not generative redrawing: each output channel is a
 * weighted average of at most four neighbouring source pixels.
 */
function sampleBilinear(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
): [number, number, number, number] {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(x0 + 1, width - 1);
  const y1 = Math.min(y0 + 1, height - 1);
  const tx = x - x0;
  const ty = y - y0;
  const at = (sx: number, sy: number) => {
    const index = (sy * width + sx) * 4;
    const alpha = pixels[index + 3]! / 255;
    return [
      pixels[index]! * alpha,
      pixels[index + 1]! * alpha,
      pixels[index + 2]! * alpha,
      pixels[index + 3]!,
    ] as const;
  };
  const p00 = at(x0, y0);
  const p10 = at(x1, y0);
  const p01 = at(x0, y1);
  const p11 = at(x1, y1);
  const top = p00.map((channel, index) => lerp(channel, p10[index]!, tx));
  const bottom = p01.map((channel, index) => lerp(channel, p11[index]!, tx));
  const mixed = top.map((channel, index) => lerp(channel, bottom[index]!, ty));
  const alpha = mixed[3]! / 255;
  if (alpha <= 0) return [0, 0, 0, 0];
  return [
    Math.round(mixed[0]! / alpha),
    Math.round(mixed[1]! / alpha),
    Math.round(mixed[2]! / alpha),
    Math.round(mixed[3]!),
  ];
}

/**
 * Deterministically maps source RGBA pixels into a calibrated garment quad.
 * The compositor performs no content synthesis. Bilinear sampling reconstructs
 * approved source pixels into the destination print region. Output resolution
 * is the native base-image resolution; Master Artwork is never resized as a
 * stored source.
 */
export async function compositeApprovedArtwork(
  input: DeterministicCompositeRequest,
  now = new Date().toISOString(),
): Promise<DeterministicCompositeResult> {
  const request = deterministicCompositeRequestSchema.parse(input);
  assertPrintSurfaceReady(request.printSurface);
  if (request.printSurface.warpMode !== "PERSPECTIVE") {
    throw new Error("Compositor v1 currently requires a PERSPECTIVE PrintSurface.");
  }
  if (request.printSurface.clippingMaskReference) {
    throw new Error("Compositor v1 does not yet support an external clipping-mask raster.");
  }
  if (
    request.printSurface.artworkScale !== 1 ||
    request.printSurface.rotationDegrees !== 0 ||
    Object.values(request.printSurface.safeMargin).some((margin) => margin !== 0)
  ) {
    throw new Error("Compositor v1 requires scale, rotation, and safe margins to be resolved into the calibrated quad.");
  }
  if (sha256(request.artwork.bytes) !== request.artwork.checksumSha256) {
    throw new Error("Master Artwork checksum mismatch; deterministic composite refused.");
  }
  if (sha256(request.baseImage.bytes) !== request.baseImage.checksumSha256) {
    throw new Error("Base image checksum mismatch; deterministic composite refused.");
  }

  const [baseImage, artworkImage] = await Promise.all([
    loadImage(request.baseImage.bytes),
    loadImage(request.artwork.bytes),
  ]);
  if (artworkImage.width < 1 || artworkImage.height < 1) {
    throw new Error("Master Artwork decoded with invalid dimensions.");
  }
  const canvas = createCanvas(baseImage.width, baseImage.height);
  const context = canvas.getContext("2d");
  context.drawImage(baseImage, 0, 0);
  const basePixels = context.getImageData(0, 0, canvas.width, canvas.height);

  const artworkCanvas = createCanvas(artworkImage.width, artworkImage.height);
  const artworkContext = artworkCanvas.getContext("2d");
  artworkContext.drawImage(artworkImage, 0, 0, artworkImage.width, artworkImage.height);
  if (artworkCanvas.width !== artworkImage.width || artworkCanvas.height !== artworkImage.height) {
    throw new Error("Stage B refused to downsample the canonical Master Artwork raster.");
  }
  const artworkPixels = artworkContext.getImageData(0, 0, artworkCanvas.width, artworkCanvas.height);

  const source: Array<[number, number]> = [
    [0, 0],
    [artworkCanvas.width - 1, 0],
    [artworkCanvas.width - 1, artworkCanvas.height - 1],
    [0, artworkCanvas.height - 1],
  ];
  const target: Array<[number, number]> = request.printSurface.quad.map((point) => [
    point.x * (canvas.width - 1),
    point.y * (canvas.height - 1),
  ]) as Array<[number, number]>;
  const transform = homography(source, target);
  const inverse = invert(transform);
  const minX = Math.max(0, Math.floor(Math.min(...target.map(([x]) => x))));
  const maxX = Math.min(canvas.width - 1, Math.ceil(Math.max(...target.map(([x]) => x))));
  const minY = Math.max(0, Math.floor(Math.min(...target.map(([, y]) => y))));
  const maxY = Math.min(canvas.height - 1, Math.ceil(Math.max(...target.map(([, y]) => y))));
  const printRegion = printRegionPixelSize(request.printSurface.quad, canvas.width, canvas.height);

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const [sourceX, sourceY] = mapPoint(inverse, x, y);
      if (sourceX < 0 || sourceY < 0 || sourceX > artworkCanvas.width - 1 || sourceY > artworkCanvas.height - 1) continue;
      const [sourceRed, sourceGreen, sourceBlue, sourceAlphaByte] = sampleBilinear(
        artworkPixels.data,
        artworkCanvas.width,
        artworkCanvas.height,
        sourceX,
        sourceY,
      );
      const sourceAlpha = sourceAlphaByte / 255;
      if (sourceAlpha === 0) continue;
      const destinationIndex = (y * canvas.width + x) * 4;
      const destinationAlpha = basePixels.data[destinationIndex + 3]! / 255;
      const outputAlpha = sourceAlpha + destinationAlpha * (1 - sourceAlpha);
      const sourceChannels = [sourceRed, sourceGreen, sourceBlue];
      for (let channel = 0; channel < 3; channel += 1) {
        const sourceColor = sourceChannels[channel]! * request.shadingFactor;
        const destinationColor = basePixels.data[destinationIndex + channel]!;
        basePixels.data[destinationIndex + channel] = Math.round(
          (sourceColor * sourceAlpha + destinationColor * destinationAlpha * (1 - sourceAlpha)) / outputAlpha,
        );
      }
      basePixels.data[destinationIndex + 3] = Math.round(outputAlpha * 255);
    }
  }
  context.putImageData(basePixels, 0, 0);
  const pngBytes = canvas.toBuffer("image/png");
  const outputChecksumSha256 = sha256(pngBytes);
  const provenance = compositingProvenanceSchema.parse({
    contractVersion: "compositing-provenance-v1",
    compositorVersion: COMPOSITOR_VERSION,
    masterArtworkId: request.artwork.id,
    masterArtworkVersion: request.artwork.version,
    masterArtworkChecksumSha256: request.artwork.checksumSha256,
    baseImageId: request.baseImage.id,
    baseImageChecksumSha256: request.baseImage.checksumSha256,
    printSurfaceId: request.printSurface.printSurfaceId,
    targetPrintRegion: request.printSurface.region,
    transformMatrix: transform,
    blendingStrategy: request.shadingFactor === 1 ? "SOURCE_OVER" : "SOURCE_OVER_WITH_UNIFORM_SHADING",
    shadingFactor: request.shadingFactor,
    samplingStrategy: COMPOSITOR_SAMPLING,
    sourceWidth: artworkImage.width,
    sourceHeight: artworkImage.height,
    outputWidth: canvas.width,
    outputHeight: canvas.height,
    printRegionWidth: printRegion.width,
    printRegionHeight: printRegion.height,
    outputChecksumSha256,
    createdAt: now,
  });
  return { pngBytes, outputChecksumSha256, provenance };
}
