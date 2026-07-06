import type { ArtworkFileMetadata, ArtworkValidationIssue } from "./types";

const PRINT_DPI = 300;
const IDEAL_SHORTEST_SIDE = 3000;
const MIN_FILE_BYTES = 10_000;

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load PNG image."));
    img.src = url;
  });
}

function detectTransparency(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): boolean {
  const sampleStep = Math.max(1, Math.floor(Math.sqrt(width * height) / 250));
  const data = ctx.getImageData(0, 0, width, height).data;

  for (let y = 0; y < height; y += sampleStep) {
    for (let x = 0; x < width; x += sampleStep) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha < 250) return true;
    }
  }
  return false;
}

function formatAspectRatio(width: number, height: number): string {
  const ratio = width / height;
  return `${ratio.toFixed(2)}:1`;
}

function formatPrintSize(width: number, height: number): string {
  const wIn = (width / PRINT_DPI).toFixed(1);
  const hIn = (height / PRINT_DPI).toFixed(1);
  return `${wIn}" × ${hIn}" at ${PRINT_DPI} DPI`;
}

function isUnusualAspectRatio(width: number, height: number): boolean {
  const ratio = width / height;
  if (ratio < 0.4 || ratio > 2.5) return true;
  const standardRatios = [1, 4 / 5, 5 / 6, 3 / 4, 2 / 3];
  return !standardRatios.some((std) => Math.abs(ratio - std) < 0.08);
}

export async function validatePngFile(
  file: File,
  objectUrl: string,
  uploadedAt: string,
): Promise<{ metadata: ArtworkFileMetadata; issues: ArtworkValidationIssue[] }> {
  const issues: ArtworkValidationIssue[] = [];

  if (file.size < MIN_FILE_BYTES) {
    issues.push({
      code: "file-too-small",
      message: "File is unusually small for print production.",
      severity: "warning",
    });
  }

  let img: HTMLImageElement;
  try {
    img = await loadImage(objectUrl);
  } catch {
    throw new Error("Could not read PNG file. The image may be corrupt.");
  }

  const width = img.naturalWidth;
  const height = img.naturalHeight;

  if (width <= 0 || height <= 0) {
    throw new Error("PNG has invalid dimensions.");
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    throw new Error("Browser could not analyze PNG transparency.");
  }

  ctx.drawImage(img, 0, 0);
  const hasTransparency = detectTransparency(ctx, width, height);
  const shortestSide = Math.min(width, height);

  if (!hasTransparency) {
    issues.push({
      code: "no-transparency",
      message: "No transparency detected — artwork may include a solid background.",
      severity: "warning",
    });
  }

  if (shortestSide < IDEAL_SHORTEST_SIDE) {
    issues.push({
      code: "low-resolution",
      message: `Shortest side is ${shortestSide}px — recommend at least ${IDEAL_SHORTEST_SIDE}px for print.`,
      severity: "warning",
    });
  }

  if (isUnusualAspectRatio(width, height)) {
    issues.push({
      code: "unusual-aspect-ratio",
      message: `Aspect ratio ${formatAspectRatio(width, height)} is outside common garment print ratios.`,
      severity: "warning",
    });
  }

  const metadata: ArtworkFileMetadata = {
    fileName: file.name,
    fileKind: "png",
    mimeType: file.type || "image/png",
    fileSize: file.size,
    uploadedAt,
    previewSupported: true,
    width,
    height,
    dimensionsLabel: `${width} × ${height} px`,
    aspectRatio: width / height,
    aspectRatioLabel: formatAspectRatio(width, height),
    hasTransparency,
    estimatedDpi: PRINT_DPI,
    printSizeAt300Dpi: formatPrintSize(width, height),
  };

  return { metadata, issues };
}
