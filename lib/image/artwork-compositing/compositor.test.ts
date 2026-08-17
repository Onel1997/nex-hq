import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { createCanvas, loadImage } from "canvas";

import { compositeApprovedArtwork, printRegionPixelSize } from "@/lib/image/artwork-compositing/compositor";
import type { NormalizedQuad, PrintSurface } from "@/lib/image/print-surface/types";

const hash = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");

function png(width: number, height: number, pixels: Array<[number, number, number, number]>): Buffer {
  const canvas = createCanvas(width, height);
  const context = canvas.getContext("2d");
  const image = context.createImageData(width, height);
  pixels.forEach((pixel, index) => image.data.set(pixel, index * 4));
  context.putImageData(image, 0, 0);
  return canvas.toBuffer("image/png");
}

function surface(quad: NormalizedQuad = [
  { x: 2 / 7, y: 2 / 7 },
  { x: 5 / 7, y: 2 / 7 },
  { x: 5 / 7, y: 5 / 7 },
  { x: 2 / 7, y: 5 / 7 },
]): PrintSurface {
  return {
    contractVersion: "print-surface-v1" as const,
    printSurfaceId: "surface-1",
    version: 1,
    productProfileId: "product-1",
    variantId: "variant-1",
    region: "front_center" as const,
    geometryStatus: "HUMAN_DEFINED" as const,
    quad,
    boundingBox: null,
    orientationDegrees: 0,
    perspectiveAnchors: [],
    clippingMaskReference: null,
    safeMargin: { top: 0, right: 0, bottom: 0, left: 0 },
    artworkScale: 1,
    rotationDegrees: 0,
    warpMode: "PERSPECTIVE" as const,
    provenance: {
      source: "OWNER_CALIBRATION" as const,
      calibratedBy: "owner",
      calibratedAt: "2026-08-17T12:00:00.000Z",
    },
  };
}

function request(artworkBytes: Buffer, baseBytes: Buffer, printSurface = surface()) {
  return {
    artwork: {
      id: "11111111-1111-4111-8111-111111111111",
      version: "V1",
      checksumSha256: hash(artworkBytes),
      bytes: artworkBytes,
    },
    baseImage: {
      id: "base-1",
      checksumSha256: hash(baseBytes),
      bytes: baseBytes,
    },
    printSurface,
    shadingFactor: 1,
  };
}

test("original source pixels and relative layout survive an axis-aligned transform", async () => {
  const artwork = png(2, 2, [
    [255, 0, 0, 255], [0, 255, 0, 255],
    [0, 0, 255, 255], [255, 255, 0, 255],
  ]);
  const base = png(8, 8, Array.from({ length: 64 }, () => [20, 20, 20, 255]));
  const result = await compositeApprovedArtwork(request(artwork, base), "2026-08-17T12:00:00.000Z");
  const image = await loadImage(result.pngBytes);
  const canvas = createCanvas(8, 8);
  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, 8, 8).data;
  const at = (x: number, y: number) => Array.from(pixels.slice((y * 8 + x) * 4, (y * 8 + x) * 4 + 4));
  assert.deepEqual(at(2, 2), [255, 0, 0, 255]);
  assert.deepEqual(at(5, 2), [0, 255, 0, 255]);
  assert.deepEqual(at(2, 5), [0, 0, 255, 255]);
  assert.deepEqual(at(5, 5), [255, 255, 0, 255]);
});

test("transparency leaves base pixels untouched", async () => {
  const artwork = png(2, 2, [
    [255, 0, 0, 0], [0, 255, 0, 255],
    [0, 0, 255, 255], [255, 255, 0, 255],
  ]);
  const base = png(8, 8, Array.from({ length: 64 }, () => [20, 30, 40, 255]));
  const result = await compositeApprovedArtwork(request(artwork, base));
  const image = await loadImage(result.pngBytes);
  const canvas = createCanvas(8, 8);
  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0);
  assert.deepEqual(Array.from(context.getImageData(2, 2, 1, 1).data), [20, 30, 40, 255]);
});

test("identical inputs produce identical bytes/checksum and provenance", async () => {
  const artwork = png(2, 2, Array.from({ length: 4 }, () => [200, 50, 100, 255]));
  const base = png(8, 8, Array.from({ length: 64 }, () => [20, 20, 20, 255]));
  const first = await compositeApprovedArtwork(request(artwork, base), "2026-08-17T12:00:00.000Z");
  const second = await compositeApprovedArtwork(request(artwork, base), "2026-08-17T12:00:00.000Z");
  assert.equal(first.outputChecksumSha256, second.outputChecksumSha256);
  assert.deepEqual(first.pngBytes, second.pngBytes);
  assert.deepEqual(first.provenance, second.provenance);
});

test("perspective surface is deterministic and a changed surface changes output", async () => {
  const artwork = png(3, 3, [
    [255, 0, 0, 255], [255, 0, 0, 255], [0, 255, 0, 255],
    [255, 0, 0, 255], [255, 255, 255, 255], [0, 255, 0, 255],
    [0, 0, 255, 255], [0, 0, 255, 255], [255, 255, 0, 255],
  ]);
  const base = png(8, 8, Array.from({ length: 64 }, () => [0, 0, 0, 255]));
  const trapezoid = surface([
    { x: 3 / 7, y: 1 / 7 }, { x: 5 / 7, y: 2 / 7 },
    { x: 6 / 7, y: 6 / 7 }, { x: 1 / 7, y: 5 / 7 },
  ]);
  const first = await compositeApprovedArtwork(request(artwork, base));
  const changed = await compositeApprovedArtwork(request(artwork, base, trapezoid));
  assert.notEqual(first.outputChecksumSha256, changed.outputChecksumSha256);
  assert.equal(changed.provenance.transformMatrix.length, 9);
});

test("checksum mismatch fails closed before compositing", async () => {
  const artwork = png(1, 1, [[255, 0, 0, 255]]);
  const base = png(2, 2, Array.from({ length: 4 }, () => [0, 0, 0, 255]));
  await assert.rejects(
    () => compositeApprovedArtwork({
      ...request(artwork, base),
      artwork: { ...request(artwork, base).artwork, checksumSha256: "0".repeat(64) },
    }),
    /checksum mismatch/,
  );
});

test("unsupported mask/placement modifiers fail closed instead of being ignored", async () => {
  const artwork = png(2, 2, Array.from({ length: 4 }, () => [255, 0, 0, 255]));
  const base = png(8, 8, Array.from({ length: 64 }, () => [0, 0, 0, 255]));
  await assert.rejects(
    () => compositeApprovedArtwork(request(artwork, base, {
      ...surface(),
      clippingMaskReference: "private/mask.png",
    })),
    /does not yet support/,
  );
});

test("high-resolution Artwork stays high-resolution at input and Stage B has no 1024 cap", async () => {
  const sourceWidth = 400;
  const sourceHeight = 500;
  const outputWidth = 1600;
  const outputHeight = 2000;
  const artwork = png(
    sourceWidth,
    sourceHeight,
    Array.from({ length: sourceWidth * sourceHeight }, (_, index) => [
      index % 251,
      40,
      180,
      index % 17 === 0 ? 0 : 255,
    ]),
  );
  const sourceChecksum = hash(artwork);
  const decodedSource = await loadImage(artwork);
  assert.equal(decodedSource.width, sourceWidth);
  assert.equal(decodedSource.height, sourceHeight);
  assert.notEqual(sourceWidth, 1024);
  assert.notEqual(outputWidth, 1024);

  const largeSurface = surface([
    { x: 0.05, y: 0.05 },
    { x: 0.95, y: 0.05 },
    { x: 0.95, y: 0.95 },
    { x: 0.05, y: 0.95 },
  ]);
  const base = png(outputWidth, outputHeight, Array.from({ length: outputWidth * outputHeight }, () => [12, 18, 24, 255]));
  const first = await compositeApprovedArtwork(request(artwork, base, largeSurface), "2026-08-17T12:00:00.000Z");
  const second = await compositeApprovedArtwork(request(artwork, base, largeSurface), "2026-08-17T12:00:00.000Z");
  const output = await loadImage(first.pngBytes);
  assert.equal(output.width, outputWidth);
  assert.equal(output.height, outputHeight);
  assert.equal(first.provenance.sourceWidth, sourceWidth);
  assert.equal(first.provenance.sourceHeight, sourceHeight);
  assert.equal(first.provenance.outputWidth, outputWidth);
  assert.equal(first.provenance.outputHeight, outputHeight);
  assert.equal(first.provenance.samplingStrategy, "BILINEAR_SOURCE_PIXEL");
  assert.ok(first.provenance.printRegionWidth > 1024);
  assert.ok(first.provenance.printRegionHeight > 1024);
  assert.equal(first.outputChecksumSha256, second.outputChecksumSha256);
  assert.deepEqual(first.pngBytes, second.pngBytes);
  assert.equal(hash(artwork), sourceChecksum);

  const transparent = await loadImage(first.pngBytes);
  const inspect = createCanvas(outputWidth, outputHeight);
  const context = inspect.getContext("2d");
  context.drawImage(transparent, 0, 0);
  assert.deepEqual(Array.from(context.getImageData(0, 0, 1, 1).data), [12, 18, 24, 255]);
});

test("owner front_center quad on the previous 768×1024 fake base is only a few hundred pixels", () => {
  const ownerQuad: NormalizedQuad = [
    { x: 0.30, y: 0.35 },
    { x: 0.70, y: 0.35 },
    { x: 0.68, y: 0.70 },
    { x: 0.32, y: 0.70 },
  ];
  const previous = printRegionPixelSize(ownerQuad, 768, 1024);
  assert.equal(previous.width, 308);
  assert.equal(previous.height, 359);
});
