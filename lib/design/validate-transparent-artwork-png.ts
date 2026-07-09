import { inflateSync } from "node:zlib";
import { TRANSPARENT_ARTWORK_BACKGROUND_WARNING } from "@/lib/design/sanitize-print-artwork";

export interface TransparentArtworkPngValidation {
  valid: boolean;
  reason?: string;
  edgeConnectedOpaqueRatio: number;
  fullyTransparentRatio: number;
}

interface RgbaImage {
  width: number;
  height: number;
  data: Uint8Array;
}

function unfilterScanline(
  filterType: number,
  row: Buffer,
  previous: Buffer,
  bytesPerPixel: number,
): Buffer {
  const out = Buffer.from(row);
  if (filterType === 1) {
    for (let i = bytesPerPixel; i < out.length; i += 1) {
      out[i] = (out[i] + out[i - bytesPerPixel]) & 0xff;
    }
  } else if (filterType === 2) {
    for (let i = 0; i < out.length; i += 1) {
      out[i] = (out[i] + previous[i]) & 0xff;
    }
  }
  return out;
}

function decodePngRgba(buffer: Buffer): RgbaImage {
  let offset = 8;
  let width = 0;
  let height = 0;
  let colorType = 0;
  const idatChunks: Buffer[] = [];

  while (offset + 8 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    offset += 12 + length;
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      colorType = data[9] ?? 0;
    } else if (type === "IDAT") {
      idatChunks.push(Buffer.from(data));
    } else if (type === "IEND") {
      break;
    }
  }

  const raw = inflateSync(Buffer.concat(idatChunks));
  const pixels = new Uint8Array(width * height * 4);

  if (colorType === 6) {
    const stride = width * 4;
    let rawOffset = 0;
    let previous = Buffer.alloc(stride);
    for (let y = 0; y < height; y += 1) {
      const filterType = raw[rawOffset] ?? 0;
      rawOffset += 1;
      const row = raw.subarray(rawOffset, rawOffset + stride);
      rawOffset += stride;
      const recon = unfilterScanline(filterType, Buffer.from(row), previous, 4);
      previous = Buffer.from(recon);
      for (let x = 0; x < width; x += 1) {
        const dst = (y * width + x) * 4;
        const src = x * 4;
        pixels[dst] = recon[src] ?? 0;
        pixels[dst + 1] = recon[src + 1] ?? 0;
        pixels[dst + 2] = recon[src + 2] ?? 0;
        pixels[dst + 3] = recon[src + 3] ?? 0;
      }
    }
    return { width, height, data: pixels };
  }

  if (colorType === 2) {
    return {
      width,
      height,
      data: pixels.fill(255),
    };
  }

  throw new Error(`Unsupported PNG color type: ${colorType}`);
}

function measureEdgeConnectedOpaqueRatio(image: RgbaImage): number {
  const { width, height, data } = image;
  const visited = new Uint8Array(width * height);
  const queue: number[] = [];

  const tryPush = (x: number, y: number) => {
    const idx = y * width + x;
    if (visited[idx] || (data[idx * 4 + 3] ?? 0) < 128) return;
    visited[idx] = 1;
    queue.push(idx);
  };

  for (let x = 0; x < width; x += 1) {
    tryPush(x, 0);
    tryPush(x, height - 1);
  }
  for (let y = 0; y < height; y += 1) {
    tryPush(0, y);
    tryPush(width - 1, y);
  }

  let connected = 0;
  while (queue.length > 0) {
    const idx = queue.pop()!;
    connected += 1;
    const x = idx % width;
    const y = Math.floor(idx / width);
    if (x > 0) tryPush(x - 1, y);
    if (x < width - 1) tryPush(x + 1, y);
    if (y > 0) tryPush(x, y - 1);
    if (y < height - 1) tryPush(x, y + 1);
  }

  return connected / (width * height);
}

function measureFullyTransparentRatio(image: RgbaImage): number {
  const total = image.width * image.height;
  let transparent = 0;
  for (let i = 0; i < total; i += 1) {
    if ((image.data[i * 4 + 3] ?? 0) < 16) transparent += 1;
  }
  return transparent / total;
}

export function validateTransparentArtworkPng(buffer: Buffer): TransparentArtworkPngValidation {
  const image = decodePngRgba(buffer);
  const edgeConnectedOpaqueRatio = measureEdgeConnectedOpaqueRatio(image);
  const fullyTransparentRatio = measureFullyTransparentRatio(image);

  if (edgeConnectedOpaqueRatio > 0.2 || fullyTransparentRatio < 0.08) {
    return {
      valid: false,
      reason: TRANSPARENT_ARTWORK_BACKGROUND_WARNING,
      edgeConnectedOpaqueRatio,
      fullyTransparentRatio,
    };
  }

  return { valid: true, edgeConnectedOpaqueRatio, fullyTransparentRatio };
}

export const MASTER_ARTWORK_PNG_MAX_ATTEMPTS = 5;
