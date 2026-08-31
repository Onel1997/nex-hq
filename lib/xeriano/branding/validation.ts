import { loadImage } from "canvas";
import { isSafePrivateSvg } from "@/lib/xeriano/svg-raster-core";
import type { XeriamoBrandingRole } from "./contracts";

export const BRANDING_MAX_BYTES: Record<XeriamoBrandingRole, number> = {
  LOGO: 5 * 1024 * 1024,
  ICON: 2 * 1024 * 1024,
  FAVICON: 1024 * 1024,
  APPLE_TOUCH_ICON: 2 * 1024 * 1024,
};

const ALLOWED_MIME: Record<XeriamoBrandingRole, readonly string[]> = {
  LOGO: ["image/png", "image/webp", "image/svg+xml"],
  ICON: ["image/png", "image/webp", "image/svg+xml"],
  FAVICON: ["image/png", "image/svg+xml", "image/x-icon"],
  APPLE_TOUCH_ICON: ["image/png"],
};

export class BrandingValidationError extends Error {
  constructor(public code: "INVALID_FILE" | "FILE_TOO_LARGE" | "UNSAFE_SVG") {
    super(code);
  }
}

function detectedMime(bytes: Buffer): string | null {
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "image/png";
  if (bytes.length >= 12 && bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  if (bytes.length >= 22 && bytes.readUInt16LE(0) === 0 && bytes.readUInt16LE(2) === 1 && bytes.readUInt16LE(4) > 0) {
    const imageBytes = bytes.readUInt32LE(14);
    const imageOffset = bytes.readUInt32LE(18);
    if (imageBytes > 0 && imageOffset >= 22 && imageOffset + imageBytes <= bytes.length) return "image/x-icon";
  }
  const text = bytes.subarray(0, Math.min(bytes.length, 512)).toString("utf8").trimStart();
  if (/^(?:<\?xml[^>]*>\s*)?<svg\b/i.test(text)) return "image/svg+xml";
  return null;
}

function declaredMime(value: string) {
  const normalized = value.toLowerCase().split(";", 1)[0]?.trim() ?? "";
  if (normalized === "image/vnd.microsoft.icon") return "image/x-icon";
  return normalized;
}

function svgDimensions(bytes: Buffer): { width: number | null; height: number | null } {
  const opening = bytes.toString("utf8").match(/<svg\b[^>]*>/i)?.[0] ?? "";
  const numeric = (name: string) => {
    const value = opening.match(new RegExp(`\\s${name}\\s*=\\s*["'](\\d+(?:\\.\\d+)?)`, "i"))?.[1];
    const number = value ? Math.round(Number(value)) : Number.NaN;
    return Number.isInteger(number) && number > 0 ? number : null;
  };
  let width = numeric("width");
  let height = numeric("height");
  const viewBox = opening.match(/\sviewBox\s*=\s*["']([^"']+)["']/i)?.[1]
    ?.trim().split(/[\s,]+/).map(Number);
  const viewWidth = viewBox?.length === 4 && Number.isFinite(viewBox[2]) && viewBox[2]! > 0 ? Math.round(viewBox[2]!) : null;
  const viewHeight = viewBox?.length === 4 && Number.isFinite(viewBox[3]) && viewBox[3]! > 0 ? Math.round(viewBox[3]!) : null;
  width ??= viewWidth;
  height ??= viewHeight;
  return { width, height };
}

async function dimensions(bytes: Buffer, mimeType: string) {
  if (mimeType === "image/svg+xml") return svgDimensions(bytes);
  if (mimeType === "image/x-icon") {
    const width = bytes[6] === 0 ? 256 : bytes[6] ?? null;
    const height = bytes[7] === 0 ? 256 : bytes[7] ?? null;
    return { width, height };
  }
  try {
    const image = await loadImage(bytes);
    const width = Math.round(image.width);
    const height = Math.round(image.height);
    if (width < 1 || height < 1 || width > 16384 || height > 16384) throw new Error();
    return { width, height };
  } catch {
    throw new BrandingValidationError("INVALID_FILE");
  }
}

export async function validateBrandingUpload(input: {
  role: XeriamoBrandingRole;
  bytes: Buffer;
  declaredMimeType: string;
  originalFilename: string;
}) {
  if (!input.bytes.length) throw new BrandingValidationError("INVALID_FILE");
  if (input.bytes.length > BRANDING_MAX_BYTES[input.role]) throw new BrandingValidationError("FILE_TOO_LARGE");
  const mimeType = detectedMime(input.bytes);
  if (!mimeType || !ALLOWED_MIME[input.role].includes(mimeType)) throw new BrandingValidationError("INVALID_FILE");
  const declared = declaredMime(input.declaredMimeType);
  if (declared && declared !== "application/octet-stream" && declared !== mimeType) throw new BrandingValidationError("INVALID_FILE");
  if (mimeType === "image/svg+xml" && !isSafePrivateSvg(input.bytes)) throw new BrandingValidationError("UNSAFE_SVG");
  const measured = await dimensions(input.bytes, mimeType);
  const filename = input.originalFilename.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 180);
  if (!filename) throw new BrandingValidationError("INVALID_FILE");
  return { mimeType, ...measured, filename };
}

export function brandingExtension(mimeType: string) {
  if (mimeType === "image/svg+xml") return "svg";
  if (mimeType === "image/webp") return "webp";
  if (mimeType === "image/x-icon") return "ico";
  return "png";
}
