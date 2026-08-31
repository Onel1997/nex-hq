import { createCanvas, loadImage } from "canvas";

export function isSafePrivateSvg(bytes: Buffer): boolean {
  const text = bytes.toString("utf8").trim();
  return (/^<\?xml[^>]*>\s*<svg\b|^<svg\b/i.test(text))
    && !/<!DOCTYPE|<!ENTITY/i.test(text)
    && !/<(?:script|foreignObject|iframe|object|embed)\b/i.test(text)
    && !/\son[a-z]+\s*=/i.test(text)
    && !/(?:href|src)\s*=\s*["']\s*(?:javascript:|https?:|\/\/|file:|ftp:)/i.test(text)
    && !/url\s*\(\s*["']?\s*(?:javascript:|https?:|\/\/|file:|ftp:)/i.test(text)
    && !/<style\b[\s\S]*?(?:@import|url\s*\()/i.test(text);
}

export type PrivateSvgRasterOptions = {
  longEdge?: number;
  upscale?: boolean;
};

function numericLength(value: string | undefined) {
  if (!value) return null;
  const match = value.match(/^\s*(\d+(?:\.\d+)?)\s*(?:px)?\s*$/i);
  const parsed = match ? Number(match[1]) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function rasterSource(text: string, longEdge: number, upscale: boolean) {
  const opening = text.match(/<svg\b[^>]*>/i)?.[0];
  if (!opening) throw new Error("SVG_DIMENSIONS_INVALID");
  const widthValue = opening.match(/\swidth\s*=\s*["']([^"']+)["']/i)?.[1];
  const heightValue = opening.match(/\sheight\s*=\s*["']([^"']+)["']/i)?.[1];
  const viewBoxValue = opening.match(/\sviewBox\s*=\s*["']([^"']+)["']/i)?.[1];
  const viewBox = viewBoxValue?.trim().split(/[\s,]+/).map(Number);
  const viewBoxWidth = viewBox?.length === 4 && Number.isFinite(viewBox[2]) && viewBox[2]! > 0 ? viewBox[2]! : null;
  const viewBoxHeight = viewBox?.length === 4 && Number.isFinite(viewBox[3]) && viewBox[3]! > 0 ? viewBox[3]! : null;
  let sourceWidth = numericLength(widthValue);
  let sourceHeight = numericLength(heightValue);
  if ((!sourceWidth || !sourceHeight) && viewBoxWidth && viewBoxHeight) {
    if (!sourceWidth && sourceHeight) sourceWidth = sourceHeight * (viewBoxWidth / viewBoxHeight);
    else if (sourceWidth && !sourceHeight) sourceHeight = sourceWidth * (viewBoxHeight / viewBoxWidth);
    else { sourceWidth = viewBoxWidth; sourceHeight = viewBoxHeight; }
  }
  if (!sourceWidth || !sourceHeight) throw new Error("SVG_DIMENSIONS_INVALID");
  const targetLongEdge = upscale ? longEdge : Math.min(longEdge, Math.max(sourceWidth, sourceHeight));
  const scale = targetLongEdge / Math.max(sourceWidth, sourceHeight);
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  const normalizedOpening = opening
    .replace(/\s+width\s*=\s*["'][^"']*["']/i, "")
    .replace(/\s+height\s*=\s*["'][^"']*["']/i, "")
    .replace(/>$/, ` width="${width}" height="${height}">`);
  return { bytes: Buffer.from(text.replace(opening, normalizedOpening)), width, height };
}

export async function rasterizePrivateSvgCore(
  bytes: Buffer,
  options: PrivateSvgRasterOptions = {},
): Promise<Buffer> {
  if (!isSafePrivateSvg(bytes)) throw new Error("UNSAFE_SVG");
  const longEdge = options.longEdge ?? 2048;
  if (!Number.isInteger(longEdge) || longEdge < 256 || longEdge > 4096) {
    throw new Error("SVG_RASTER_SIZE_INVALID");
  }
  const source = rasterSource(bytes.toString("utf8").trim(), longEdge, options.upscale === true);
  const image = await loadImage(source.bytes);
  const { width, height } = source;
  const canvas = createCanvas(width, height);
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);
  return canvas.toBuffer("image/png");
}
