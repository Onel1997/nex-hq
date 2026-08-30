import { createHash } from "node:crypto";

export const VALID_TEST_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAABmJLR0QA/wD/AP+gvaeTAAAAFElEQVQImWP8z8BQz8DAwMDEAAUAGBcBgkMreBoAAAAASUVORK5CYII=",
  "base64",
);

function crc32(bytes: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const typeBytes = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])));
  return Buffer.concat([length, typeBytes, data, checksum]);
}

export function validLargeTestPng(targetByteLength = 10_485_760 + 4096): Buffer {
  const signature = VALID_TEST_PNG.subarray(0, 8);
  const ihdrEnd = 8 + 12 + VALID_TEST_PNG.readUInt32BE(8);
  const prefix = VALID_TEST_PNG.subarray(8, ihdrEnd);
  const remainder = VALID_TEST_PNG.subarray(ihdrEnd);
  const paddingLength = targetByteLength - VALID_TEST_PNG.length - 12;
  if (paddingLength <= 0) return VALID_TEST_PNG;
  return Buffer.concat([
    signature,
    prefix,
    pngChunk("naAa", Buffer.alloc(paddingLength, 0x61)),
    remainder,
  ]);
}

export function integrityMeta(bytes: Buffer) {
  return {
    expectedByteLength: bytes.length,
    expectedChecksumSha256: createHash("sha256").update(bytes).digest("hex"),
  };
}
