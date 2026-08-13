/**
 * Phase 2.3D.9 — Local horizontal flip only.
 * No crop, resize, beautification, color adjustment, or provider calls.
 */

import { PersonaDomainError } from "@/lib/persona/domain/errors";

/**
 * Create a derived PNG by horizontal flip of the source image bytes.
 * Uses node-canvas (already in the face-api stack). No sharp.
 */
export async function horizontalMirrorImageBytes(
  sourceBytes: Buffer,
): Promise<Buffer> {
  if (!sourceBytes?.length) {
    throw new PersonaDomainError(
      "Cannot mirror empty image bytes.",
      "INVALID_REFERENCE_ASSET",
    );
  }

  const { loadImage, createCanvas } = await import("canvas");
  const img = await loadImage(sourceBytes);
  const width = img.width;
  const height = img.height;
  if (width <= 0 || height <= 0) {
    throw new PersonaDomainError(
      "Cannot mirror image with invalid dimensions.",
      "INVALID_REFERENCE_ASSET",
    );
  }

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  // Horizontal flip: scale X by -1 and translate.
  ctx.translate(width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(img, 0, 0);

  return canvas.toBuffer("image/png");
}

/**
 * Pure pixel-level check that `mirrored` is a horizontal flip of `original`
 * (same dimensions; each pixel maps to (w-1-x, y)). Used by tests.
 */
export function assertHorizontallyMirroredPngPixels(input: {
  originalRgba: Uint8ClampedArray | Buffer;
  mirroredRgba: Uint8ClampedArray | Buffer;
  width: number;
  height: number;
}): boolean {
  const { width, height } = input;
  const o = Buffer.from(input.originalRgba);
  const m = Buffer.from(input.mirroredRgba);
  const stride = width * 4;
  if (o.length < stride * height || m.length < stride * height) return false;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const oi = y * stride + x * 4;
      const mi = y * stride + (width - 1 - x) * 4;
      if (
        o[oi] !== m[mi] ||
        o[oi + 1] !== m[mi + 1] ||
        o[oi + 2] !== m[mi + 2] ||
        o[oi + 3] !== m[mi + 3]
      ) {
        return false;
      }
    }
  }
  return true;
}
