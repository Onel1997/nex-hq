import { createHash } from "node:crypto";
import type { ImageGenerationInputSnapshot } from "./types";
import type { ImageGenerationInputSnapshotV2 } from "./types-v2";

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`;
}

export function fingerprintImageGenerationInput(
  input: ImageGenerationInputSnapshot | ImageGenerationInputSnapshotV2,
): string {
  return createHash("sha256").update(canonicalJson(input)).digest("hex");
}

export function checksumImageArtwork(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}
