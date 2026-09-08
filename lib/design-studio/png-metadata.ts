import { createCanvas, loadImage } from "canvas";
import { validateDesignSignature } from "@/lib/xeriano/library";

export const PNG_300_DPI_PIXELS_PER_METER = 11_811 as const;

export type PngMetadata = {
  width: number;
  height: number;
  colorType: number;
  hasAlphaChannel: boolean;
  pixelsPerMeterX: number | null;
  pixelsPerMeterY: number | null;
  resolutionUnit: number | null;
  srgbRenderingIntent: number | null;
};

type PngChunk = { type: string; data: Buffer; start: number; end: number };

function chunks(bytes: Buffer): PngChunk[] {
  if (!validateDesignSignature(bytes, "image/png")) throw new Error("PNG_SIGNATURE_INVALID");
  const result: PngChunk[] = [];
  let offset = 8;
  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const end = offset + 12 + length;
    if (length > bytes.length || end > bytes.length) throw new Error("PNG_STRUCTURE_INVALID");
    const type = bytes.toString("ascii", offset + 4, offset + 8);
    result.push({ type, data: bytes.subarray(offset + 8, offset + 8 + length), start: offset, end });
    offset = end;
    if (type === "IEND") break;
  }
  if (result[0]?.type !== "IHDR" || !result.some((chunk) => chunk.type === "IDAT") || result.at(-1)?.type !== "IEND") {
    throw new Error("PNG_STRUCTURE_INVALID");
  }
  return result;
}

export function readPngMetadata(bytes: Buffer): PngMetadata {
  const parsed = chunks(bytes);
  const ihdr = parsed[0]!.data;
  if (ihdr.length !== 13) throw new Error("PNG_IHDR_INVALID");
  const width = ihdr.readUInt32BE(0);
  const height = ihdr.readUInt32BE(4);
  const colorType = ihdr[9]!;
  const phys = parsed.find((chunk) => chunk.type === "pHYs")?.data ?? null;
  const srgb = parsed.find((chunk) => chunk.type === "sRGB")?.data ?? null;
  return {
    width,
    height,
    colorType,
    hasAlphaChannel: colorType === 4 || colorType === 6,
    pixelsPerMeterX: phys?.length === 9 ? phys.readUInt32BE(0) : null,
    pixelsPerMeterY: phys?.length === 9 ? phys.readUInt32BE(4) : null,
    resolutionUnit: phys?.length === 9 ? phys[8]! : null,
    srgbRenderingIntent: srgb?.length === 1 ? srgb[0]! : null,
  };
}

function crc32(bytes: Buffer) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function encodeChunk(type: string, data: Buffer) {
  const typeBytes = Buffer.from(type, "ascii");
  const output = Buffer.allocUnsafe(12 + data.length);
  output.writeUInt32BE(data.length, 0);
  typeBytes.copy(output, 4);
  data.copy(output, 8);
  output.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), 8 + data.length);
  return output;
}

/** node-canvas emits pHYs but no explicit sRGB chunk. Add the standard
 * perceptual sRGB marker without touching any pixel data. */
export function ensurePngSrgbMetadata(bytes: Buffer): Buffer {
  const parsed = chunks(bytes);
  if (parsed.some((chunk) => chunk.type === "sRGB")) return bytes;
  const ihdr = parsed[0]!;
  return Buffer.concat([
    bytes.subarray(0, ihdr.end),
    encodeChunk("sRGB", Buffer.from([0])),
    bytes.subarray(ihdr.end),
  ]);
}

export async function assertTransparentPng(bytes: Buffer) {
  const metadata = readPngMetadata(bytes);
  if (!metadata.hasAlphaChannel) throw new Error("PNG_ALPHA_CHANNEL_REQUIRED");
  if (metadata.width <= 0 || metadata.height <= 0 || metadata.width * metadata.height > 40_000_000) {
    throw new Error("PNG_DIMENSIONS_INVALID");
  }
  const image = await loadImage(bytes);
  const canvas = createCanvas(metadata.width, metadata.height);
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, metadata.width, metadata.height);
  context.drawImage(image, 0, 0, metadata.width, metadata.height);
  const rows = 64;
  for (let top = 0; top < metadata.height; top += rows) {
    const height = Math.min(rows, metadata.height - top);
    const pixels = context.getImageData(0, top, metadata.width, height).data;
    for (let index = 3; index < pixels.length; index += 4) {
      if (pixels[index]! < 255) return metadata;
    }
  }
  throw new Error("PNG_TRANSPARENCY_REQUIRED");
}
