import type { ArtworkFileKind } from "@/lib/design/artwork-validation";
import type { ArtworkPixelData } from "./types";

const MAX_ANALYSIS_DIMENSION = 1200;

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not rasterize artwork for analysis."));
    img.src = url;
  });
}

function scaleDimensions(
  width: number,
  height: number,
): { width: number; height: number; scale: number } {
  const longest = Math.max(width, height);
  if (longest <= MAX_ANALYSIS_DIMENSION) {
    return { width, height, scale: 1 };
  }
  const scale = MAX_ANALYSIS_DIMENSION / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    scale,
  };
}

export async function loadArtworkPixels(input: {
  fileKind: ArtworkFileKind;
  objectUrl: string;
  width?: number;
  height?: number;
}): Promise<ArtworkPixelData | null> {
  if (input.fileKind !== "png" && input.fileKind !== "svg") {
    return null;
  }

  const img = await loadImage(input.objectUrl);
  const sourceW = input.width ?? img.naturalWidth;
  const sourceH = input.height ?? img.naturalHeight;
  const { width, height } = scaleDimensions(sourceW, sourceH);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;

  ctx.drawImage(img, 0, 0, width, height);
  const imageData = ctx.getImageData(0, 0, width, height);
  return { width, height, imageData };
}

export function forEachOpaquePixel(
  data: ImageData,
  callback: (x: number, y: number, r: number, g: number, b: number, a: number) => void,
): void {
  const { width, height, data: pixels } = data;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const a = pixels[i + 3];
      if (a < 20) continue;
      callback(x, y, pixels[i], pixels[i + 1], pixels[i + 2], a);
    }
  }
}

export function computeOpaqueBounds(data: ImageData): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  opaqueCount: number;
} | null {
  let minX = data.width;
  let minY = data.height;
  let maxX = 0;
  let maxY = 0;
  let opaqueCount = 0;

  forEachOpaquePixel(data, (x, y) => {
    opaqueCount += 1;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  });

  if (opaqueCount === 0) return null;
  return { minX, minY, maxX, maxY, opaqueCount };
}

export function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

export function luminance(r: number, g: number, b: number): number {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

export function saturation(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  if (max === 0) return 0;
  return (max - min) / max;
}
