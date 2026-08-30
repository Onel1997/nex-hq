import { PersonaDomainError } from "@/lib/persona/domain/errors";
import { DESIGN_ARTWORK_INCOMPLETE_OWNER_ERROR } from "./types";

export interface MasterArtworkImageIntegrity {
  mimeType: "image/png" | "image/jpeg" | "image/webp";
  width?: number;
  height?: number;
  structurallyComplete: true;
}

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

let crcTable: Uint32Array | undefined;

function pngCrc32(bytes: Buffer): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let value = n;
      for (let bit = 0; bit < 8; bit += 1) {
        value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
      }
      crcTable[n] = value >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = crcTable[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function invalid(details: Record<string, unknown>): never {
  throw new PersonaDomainError(
    DESIGN_ARTWORK_INCOMPLETE_OWNER_ERROR,
    "WORKFLOW",
    { ...details, integrityFailure: true },
  );
}

function inspectPng(bytes: Buffer): MasterArtworkImageIntegrity {
  if (bytes.length < 33 || !bytes.subarray(0, 8).equals(PNG_SIGNATURE)) {
    invalid({ reason: "PNG_SIGNATURE_INVALID" });
  }
  let offset = 8;
  let width: number | undefined;
  let height: number | undefined;
  let sawIdat = false;
  let sawIend = false;
  let chunkIndex = 0;
  while (offset < bytes.length) {
    if (offset + 12 > bytes.length) {
      invalid({ reason: "PNG_CHUNK_HEADER_TRUNCATED", offset });
    }
    const length = bytes.readUInt32BE(offset);
    const typeOffset = offset + 4;
    const dataOffset = offset + 8;
    const crcOffset = dataOffset + length;
    const end = crcOffset + 4;
    if (end > bytes.length || end < offset) {
      invalid({
        reason: "PNG_CHUNK_TRUNCATED",
        offset,
        chunkType: bytes.subarray(typeOffset, typeOffset + 4).toString("ascii"),
        declaredChunkLength: length,
        availableByteLength: bytes.length,
      });
    }
    const type = bytes.subarray(typeOffset, typeOffset + 4).toString("ascii");
    const expectedCrc = bytes.readUInt32BE(crcOffset);
    const actualCrc = pngCrc32(bytes.subarray(typeOffset, crcOffset));
    if (actualCrc !== expectedCrc) {
      invalid({ reason: "PNG_CHUNK_CRC_MISMATCH", offset, chunkType: type });
    }
    if (chunkIndex === 0) {
      if (type !== "IHDR" || length !== 13) {
        invalid({ reason: "PNG_IHDR_INVALID" });
      }
      width = bytes.readUInt32BE(dataOffset);
      height = bytes.readUInt32BE(dataOffset + 4);
      if (!width || !height) invalid({ reason: "PNG_DIMENSIONS_INVALID" });
    }
    if (type === "IDAT") sawIdat = true;
    if (type === "IEND") {
      if (length !== 0 || !sawIdat || end !== bytes.length) {
        invalid({ reason: "PNG_IEND_INVALID", offset, trailingBytes: bytes.length - end });
      }
      sawIend = true;
      offset = end;
      break;
    }
    offset = end;
    chunkIndex += 1;
  }
  if (!sawIend || !sawIdat || offset !== bytes.length) {
    invalid({ reason: "PNG_INCOMPLETE", offset, availableByteLength: bytes.length });
  }
  return { mimeType: "image/png", width, height, structurallyComplete: true };
}

function inspectJpeg(bytes: Buffer): MasterArtworkImageIntegrity {
  if (
    bytes.length < 4 ||
    bytes[0] !== 0xff ||
    bytes[1] !== 0xd8 ||
    bytes[bytes.length - 2] !== 0xff ||
    bytes[bytes.length - 1] !== 0xd9
  ) {
    invalid({ reason: "JPEG_INCOMPLETE" });
  }
  return { mimeType: "image/jpeg", structurallyComplete: true };
}

function inspectWebp(bytes: Buffer): MasterArtworkImageIntegrity {
  const declaredPayloadLength = bytes.length >= 8 ? bytes.readUInt32LE(4) : -1;
  if (
    bytes.length < 12 ||
    bytes.subarray(0, 4).toString("ascii") !== "RIFF" ||
    bytes.subarray(8, 12).toString("ascii") !== "WEBP" ||
    declaredPayloadLength + 8 !== bytes.length
  ) {
    invalid({ reason: "WEBP_INCOMPLETE", declaredPayloadLength });
  }
  return { mimeType: "image/webp", structurallyComplete: true };
}

/**
 * Pure structural validation performed before native image decoders. It both
 * protects Artwork authority and prevents corrupt/truncated buffers from
 * reaching canvas/libpng, where malformed input can terminate the Node process.
 */
export function assertMasterArtworkImageIntegrity(
  bytes: Buffer,
  mimeType: "image/png" | "image/jpeg" | "image/webp",
): MasterArtworkImageIntegrity {
  if (mimeType === "image/png") return inspectPng(bytes);
  if (mimeType === "image/jpeg") return inspectJpeg(bytes);
  return inspectWebp(bytes);
}

export function assertSupportedRasterImageIntegrity(
  bytes: Buffer,
): MasterArtworkImageIntegrity {
  if (bytes.subarray(0, 8).equals(PNG_SIGNATURE)) {
    return inspectPng(bytes);
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    return inspectJpeg(bytes);
  }
  if (
    bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
    bytes.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return inspectWebp(bytes);
  }
  invalid({ reason: "UNSUPPORTED_OR_CORRUPT_RASTER" });
}
