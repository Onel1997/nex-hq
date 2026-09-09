import { createCanvas, loadImage } from "canvas";

import { readPngMetadata, ensurePngSrgbMetadata } from "@/lib/design-studio/png-metadata";
import { readRasterDimensions } from "@/lib/design-studio/raster-metadata";
import {
  ARTWORK_PREP_MAX_DIMENSION,
  ARTWORK_PREP_MAX_PIXELS,
  ARTWORK_PREP_OUTPUT_MAX_BYTES,
  ARTWORK_PREP_RASTER_MAX_BYTES,
  ARTWORK_PREP_SVG_MAX_BYTES,
  artworkPrepMimeTypeSchema,
} from "@/lib/artwork-prep-studio/contracts";
import { validateDesignSignature } from "@/lib/xeriano/library";
import { isSafePrivateSvg } from "@/lib/xeriano/svg-raster-core";

export class ArtworkPrepImageError extends Error {
  constructor(readonly code: string, message: string, readonly status = 400) {
    super(message);
    this.name = "ArtworkPrepImageError";
  }
}

function svgDimensions(bytes: Buffer) {
  const opening = bytes.toString("utf8").match(/<svg\b[^>]*>/i)?.[0];
  if (!opening) throw new ArtworkPrepImageError("SVG_INVALID", "Dieses SVG besitzt keine sichere Zeichenfläche.");
  const numeric = (value: string | undefined) => {
    const match = value?.match(/^\s*(\d+(?:\.\d+)?)\s*(?:px)?\s*$/i);
    const parsed = match ? Number(match[1]) : Number.NaN;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  };
  const width = numeric(opening.match(/\swidth\s*=\s*["']([^"']+)["']/i)?.[1]);
  const height = numeric(opening.match(/\sheight\s*=\s*["']([^"']+)["']/i)?.[1]);
  const viewBox = opening.match(/\sviewBox\s*=\s*["']([^"']+)["']/i)?.[1]
    ?.trim().split(/[\s,]+/).map(Number);
  const viewWidth = viewBox?.length === 4 && Number.isFinite(viewBox[2]) && viewBox[2]! > 0 ? viewBox[2]! : null;
  const viewHeight = viewBox?.length === 4 && Number.isFinite(viewBox[3]) && viewBox[3]! > 0 ? viewBox[3]! : null;
  const resolvedWidth = width ?? viewWidth;
  const resolvedHeight = height ?? viewHeight;
  if (!resolvedWidth || !resolvedHeight) {
    throw new ArtworkPrepImageError("SVG_INVALID", "Dieses SVG besitzt keine sichere Zeichenfläche.");
  }
  return { width: Math.round(resolvedWidth), height: Math.round(resolvedHeight) };
}

function assertDimensions(width: number, height: number) {
  if (
    !Number.isInteger(width)
    || !Number.isInteger(height)
    || width <= 0
    || height <= 0
    || width > ARTWORK_PREP_MAX_DIMENSION
    || height > ARTWORK_PREP_MAX_DIMENSION
    || width * height > ARTWORK_PREP_MAX_PIXELS
  ) {
    throw new ArtworkPrepImageError(
      "ARTWORK_DIMENSIONS_INVALID",
      "Das Artwork besitzt nicht unterstützte Abmessungen.",
    );
  }
}

async function transparency(bytes: Buffer, width: number, height: number) {
  const image = await loadImage(bytes);
  const canvas = createCanvas(width, height);
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);
  const rowHeight = 32;
  for (let top = 0; top < height; top += rowHeight) {
    const pixels = context.getImageData(0, top, width, Math.min(rowHeight, height - top)).data;
    for (let index = 3; index < pixels.length; index += 4) {
      if (pixels[index]! < 255) return true;
    }
  }
  return false;
}

export async function inspectArtworkBytes(input: {
  bytes: Buffer;
  mimeType: string;
  allowDerivedSize?: boolean;
}) {
  const mimeType = artworkPrepMimeTypeSchema.parse(input.mimeType);
  const maxBytes = input.allowDerivedSize
    ? ARTWORK_PREP_OUTPUT_MAX_BYTES
    : mimeType === "image/svg+xml"
      ? ARTWORK_PREP_SVG_MAX_BYTES
      : ARTWORK_PREP_RASTER_MAX_BYTES;
  if (!input.bytes.length || input.bytes.length > maxBytes) {
    throw new ArtworkPrepImageError("ARTWORK_TOO_LARGE", "Dieses Artwork ist zu groß.");
  }
  if (mimeType === "image/svg+xml") {
    if (!isSafePrivateSvg(input.bytes)) {
      throw new ArtworkPrepImageError("SVG_UNSAFE", "Dieses SVG kann nicht sicher verwendet werden.");
    }
    const dimensions = svgDimensions(input.bytes);
    assertDimensions(dimensions.width, dimensions.height);
    return {
      ...dimensions,
      mimeType,
      hasAlpha: true,
      hasTransparency: await transparency(input.bytes, dimensions.width, dimensions.height),
    };
  }
  if (!validateDesignSignature(input.bytes, mimeType)) {
    throw new ArtworkPrepImageError("ARTWORK_SIGNATURE_INVALID", "Dateityp und Dateisignatur stimmen nicht überein.");
  }
  let dimensions: { width: number; height: number };
  try {
    dimensions = await readRasterDimensions(input.bytes);
  } catch {
    throw new ArtworkPrepImageError("ARTWORK_DECODE_FAILED", "Das Artwork konnte nicht gelesen werden.");
  }
  assertDimensions(dimensions.width, dimensions.height);
  const hasAlpha = mimeType === "image/png"
    ? readPngMetadata(input.bytes).hasAlphaChannel
    : mimeType === "image/webp";
  return {
    ...dimensions,
    mimeType,
    hasAlpha,
    hasTransparency: hasAlpha
      ? await transparency(input.bytes, dimensions.width, dimensions.height)
      : false,
  };
}

export async function renderArtworkBackground(input: {
  bytes: Buffer;
  mimeType: string;
  color: string;
  resolution?: number;
}) {
  if (!/^#[0-9a-fA-F]{6}$/.test(input.color)) {
    throw new ArtworkPrepImageError("BACKGROUND_COLOR_INVALID", "Bitte wähle eine gültige Hintergrundfarbe.");
  }
  const inspected = await inspectArtworkBytes({ bytes: input.bytes, mimeType: input.mimeType, allowDerivedSize: true });
  if (!inspected.hasTransparency) {
    throw new ArtworkPrepImageError(
      "BACKGROUND_REMOVAL_REQUIRED",
      "Entferne zuerst den vorhandenen Hintergrund, bevor du eine neue Farbe verwendest.",
    );
  }
  const image = await loadImage(input.bytes);
  const canvas = createCanvas(inspected.width, inspected.height);
  const context = canvas.getContext("2d");
  context.fillStyle = input.color;
  context.fillRect(0, 0, inspected.width, inspected.height);
  context.drawImage(image, 0, 0, inspected.width, inspected.height);
  const output = ensurePngSrgbMetadata(canvas.toBuffer("image/png", {
    compressionLevel: 6,
    ...(input.resolution ? { resolution: input.resolution } : {}),
  }));
  if (!output.length || output.length > ARTWORK_PREP_OUTPUT_MAX_BYTES) {
    throw new ArtworkPrepImageError("BACKGROUND_RESULT_TOO_LARGE", "Die Hintergrundvariante ist zu groß.");
  }
  const verified = await inspectArtworkBytes({ bytes: output, mimeType: "image/png", allowDerivedSize: true });
  if (verified.width !== inspected.width || verified.height !== inspected.height) {
    throw new ArtworkPrepImageError("BACKGROUND_RESULT_INVALID", "Die Hintergrundvariante konnte nicht sicher geprüft werden.", 503);
  }
  return { bytes: output, metadata: verified };
}
