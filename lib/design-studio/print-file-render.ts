import { createCanvas, loadImage } from "canvas";
import { isSafePrivateSvg } from "@/lib/xeriano/svg-raster-core";
import {
  PRINT_FILE_DPI,
  PRINT_FILE_HEIGHT,
  PRINT_FILE_SAFE_AREA,
  PRINT_FILE_WIDTH,
} from "@/lib/design-studio/print-file-contracts";
import { assertTransparentPng, ensurePngSrgbMetadata, readPngMetadata } from "@/lib/design-studio/png-metadata";

const MAX_OUTPUT_BYTES = 50 * 1024 * 1024;

export class DesignPrintRenderError extends Error {
  constructor(readonly code: string, message: string, readonly status: number) {
    super(message);
  }
}

export function resolvePrintPlacement(width: number, height: number) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error("PRINT_SOURCE_DIMENSIONS_INVALID");
  }
  const scale = Math.min(PRINT_FILE_SAFE_AREA.width / width, PRINT_FILE_SAFE_AREA.height / height);
  const targetWidth = Math.max(1, Math.round(width * scale));
  const targetHeight = Math.max(1, Math.round(height * scale));
  return {
    width: targetWidth,
    height: targetHeight,
    left: Math.round((PRINT_FILE_WIDTH - targetWidth) / 2),
    top: Math.round((PRINT_FILE_HEIGHT - targetHeight) / 2),
  };
}

export function isRasterPrintUpscaleRequired(width: number, height: number) {
  const placement = resolvePrintPlacement(width, height);
  return placement.width > width || placement.height > height;
}

function printSvgSource(bytes: Buffer) {
  const text = bytes.toString("utf8").trim();
  const opening = text.match(/<svg\b[^>]*>/i)?.[0];
  const numericLength = (value: string | undefined) => {
    const match = value?.match(/^\s*(\d+(?:\.\d+)?)\s*(?:px)?\s*$/i);
    const parsed = match ? Number(match[1]) : Number.NaN;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  };
  const declaredWidth = numericLength(opening?.match(/\swidth\s*=\s*["']([^"']+)["']/i)?.[1]);
  const declaredHeight = numericLength(opening?.match(/\sheight\s*=\s*["']([^"']+)["']/i)?.[1]);
  const viewBox = opening?.match(/\sviewBox\s*=\s*["']([^"']+)["']/i)?.[1]
    ?.trim().split(/[\s,]+/).map(Number);
  const sourceWidth = viewBox?.length === 4 && Number.isFinite(viewBox[2]) && viewBox[2]! > 0
    ? viewBox[2]!
    : declaredWidth;
  const sourceHeight = viewBox?.length === 4 && Number.isFinite(viewBox[3]) && viewBox[3]! > 0
    ? viewBox[3]!
    : declaredHeight;
  if (!opening || !sourceWidth || !sourceHeight) {
    throw new DesignPrintRenderError("SOURCE_INVALID", "Dieses SVG besitzt keine sichere Zeichenfläche.", 400);
  }
  const placement = resolvePrintPlacement(sourceWidth, sourceHeight);
  const normalizedOpening = opening
    .replace(/\s+width\s*=\s*["'][^"']*["']/i, "")
    .replace(/\s+height\s*=\s*["'][^"']*["']/i, "")
    .replace(/>$/, ` width="${placement.width}" height="${placement.height}">`);
  return Buffer.from(text.replace(opening, normalizedOpening));
}

export async function renderDesignPrintFile(source: { bytes: Buffer; mimeType: string }) {
  if (source.mimeType === "image/svg+xml" && !isSafePrivateSvg(source.bytes)) {
    throw new DesignPrintRenderError("SOURCE_INVALID", "Dieses SVG kann nicht verwendet werden.", 400);
  }
  const sourceBytes = source.mimeType === "image/svg+xml" ? printSvgSource(source.bytes) : source.bytes;
  const image = await loadImage(sourceBytes);
  if (!image.width || !image.height) throw new DesignPrintRenderError("SOURCE_INVALID", "Dieses Design kann nicht als Druckdatei verwendet werden.", 400);
  const placement = resolvePrintPlacement(image.width, image.height);
  const canvas = createCanvas(PRINT_FILE_WIDTH, PRINT_FILE_HEIGHT);
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, PRINT_FILE_WIDTH, PRINT_FILE_HEIGHT);
  context.imageSmoothingEnabled = true;
  context.patternQuality = "best";
  context.quality = "best";
  context.drawImage(image, placement.left, placement.top, placement.width, placement.height);
  const bytes = ensurePngSrgbMetadata(canvas.toBuffer("image/png", {
    compressionLevel: 6,
    resolution: PRINT_FILE_DPI,
  }));
  if (bytes.length <= 0 || bytes.length > MAX_OUTPUT_BYTES) {
    throw new DesignPrintRenderError("PRINT_FILE_TOO_LARGE", "Die Druckdatei ist zu groß und wurde nicht gespeichert.", 400);
  }
  const metadata = readPngMetadata(bytes);
  if (metadata.width !== PRINT_FILE_WIDTH || metadata.height !== PRINT_FILE_HEIGHT
    || metadata.pixelsPerMeterX !== 11_811 || metadata.pixelsPerMeterY !== 11_811
    || metadata.resolutionUnit !== 1 || metadata.srgbRenderingIntent !== 0
    || !metadata.hasAlphaChannel) {
    throw new DesignPrintRenderError("PRINT_FILE_VALIDATION_FAILED", "Die Druckdatei konnte nicht sicher geprüft werden.", 503);
  }
  await assertTransparentPng(bytes);
  return bytes;
}
