import type { FabricAwareIntegrationSettings } from "@/lib/image/artwork-compositing/types";

export type PixelRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type FabricAwarePixelAdjustment = {
  displacementX: number;
  displacementY: number;
  shading: number;
  inkOpacity: number;
};

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function luminanceAt(input: {
  pixels: Uint8ClampedArray;
  width: number;
  height: number;
  x: number;
  y: number;
}): number {
  const x = clamp(Math.round(input.x), 0, input.width - 1);
  const y = clamp(Math.round(input.y), 0, input.height - 1);
  const offset = (y * input.width + x) * 4;
  return (
    input.pixels[offset]! * 0.2126 +
    input.pixels[offset + 1]! * 0.7152 +
    input.pixels[offset + 2]! * 0.0722
  );
}

/**
 * Samples the frozen base only. It never derives or redraws Artwork content.
 * Displacement is zero at the Artwork rectangle boundary and is hard-capped to
 * a small percentage of the uniformly scaled rectangle.
 */
export function resolveFabricAwarePixelAdjustment(input: {
  pixels: Uint8ClampedArray;
  imageWidth: number;
  imageHeight: number;
  artworkRect: PixelRect;
  regionMeanLuminance: number;
  x: number;
  y: number;
  boundaryU?: number;
  boundaryV?: number;
  settings: FabricAwareIntegrationSettings;
}): FabricAwarePixelAdjustment {
  const radius = clamp(
    Math.round(Math.min(input.artworkRect.width, input.artworkRect.height) * 0.012),
    2,
    12,
  );
  const sample = (x: number, y: number) =>
    luminanceAt({
      pixels: input.pixels,
      width: input.imageWidth,
      height: input.imageHeight,
      x,
      y,
    });
  const center = sample(input.x, input.y);
  const left = sample(input.x - radius, input.y);
  const right = sample(input.x + radius, input.y);
  const top = sample(input.x, input.y - radius);
  const bottom = sample(input.x, input.y + radius);
  const lowFrequency = (center * 2 + left + right + top + bottom) / 6;
  const horizontalGradient = (right - left) / 255;
  const verticalGradient = (bottom - top) / 255;
  const localTexture = (center - lowFrequency) / 255;
  const u = clamp(
    input.boundaryU ??
      (input.x + 0.5 - input.artworkRect.x) / input.artworkRect.width,
    0,
    1,
  );
  const v = clamp(
    input.boundaryV ??
      (input.y + 0.5 - input.artworkRect.y) / input.artworkRect.height,
    0,
    1,
  );
  const boundaryEnvelope = Math.sin(Math.PI * u) * Math.sin(Math.PI * v);
  const maxX = input.artworkRect.width * input.settings.maxDisplacementRatio;
  const maxY = input.artworkRect.height * input.settings.maxDisplacementRatio * 0.65;
  // Missing response fields mean the historical V1 algorithm. New jobs freeze
  // the V1.1 response explicitly, so composite retries never reinterpret old
  // snapshots while new prints respond more visibly to bounded cloth evidence.
  const displacementResponse = input.settings.displacementResponse ?? 1;
  const shadingRange = input.settings.shadingRange ?? 0.16;
  const displacementX =
    clamp(
      (horizontalGradient * 2.2 + localTexture * 1.15) *
        displacementResponse,
      -1,
      1,
    ) *
    maxX *
    boundaryEnvelope;
  const displacementY =
    clamp(
      (verticalGradient * 1.55 + localTexture * 0.7) *
        displacementResponse,
      -1,
      1,
    ) *
    maxY *
    boundaryEnvelope;
  const broadLight = (lowFrequency - input.regionMeanLuminance) / 255;
  const realism = input.settings.surfaceRealismRefinement;
  const shading = realism
    ? (() => {
        const broadRadius = Math.min(30, radius * 3);
        const broadSurface =
          (center * 2 +
            sample(input.x - broadRadius, input.y) +
            sample(input.x + broadRadius, input.y) +
            sample(input.x, input.y - broadRadius) +
            sample(input.x, input.y + broadRadius)) /
          6;
        const normalizedBroadLight = clamp(
          (broadSurface - input.regionMeanLuminance) /
            realism.shadingNormalizationRange,
          -1,
          1,
        );
        const normalizedTexture = clamp(
          (center - lowFrequency) / 32,
          -1,
          1,
        );
        // Scalar modulation preserves hue and exact Artwork semantics. The
        // configured range keeps the stronger shirt shadows/highlights bounded
        // and prevents muddy or blown-out print colors.
        return clamp(
          1 +
            normalizedBroadLight * realism.shadingTransferStrength +
            normalizedTexture * realism.textureTransferStrength,
          1 - shadingRange,
          1 + shadingRange,
        );
      })()
    : clamp(
        1 +
          broadLight * input.settings.lightingStrength +
          localTexture * input.settings.textureStrength,
        1 - shadingRange,
        1 + shadingRange,
      );
  return {
    displacementX,
    displacementY,
    shading,
    inkOpacity: input.settings.inkOpacity,
  };
}

export function meanLuminanceForRect(input: {
  pixels: Uint8ClampedArray;
  imageWidth: number;
  imageHeight: number;
  rect: PixelRect;
  contains?: (x: number, y: number) => boolean;
}): number {
  const left = clamp(Math.floor(input.rect.x), 0, input.imageWidth - 1);
  const top = clamp(Math.floor(input.rect.y), 0, input.imageHeight - 1);
  const right = clamp(
    Math.ceil(input.rect.x + input.rect.width),
    left + 1,
    input.imageWidth,
  );
  const bottom = clamp(
    Math.ceil(input.rect.y + input.rect.height),
    top + 1,
    input.imageHeight,
  );
  const step = Math.max(1, Math.floor(Math.min(input.rect.width, input.rect.height) / 96));
  let total = 0;
  let count = 0;
  for (let y = top; y < bottom; y += step) {
    for (let x = left; x < right; x += step) {
      if (input.contains && !input.contains(x + 0.5, y + 0.5)) continue;
      total += luminanceAt({
        pixels: input.pixels,
        width: input.imageWidth,
        height: input.imageHeight,
        x,
        y,
      });
      count += 1;
    }
  }
  return count ? total / count : 127.5;
}
