import { createHash } from "node:crypto";
import type { VideoGenerationInputV1 } from "./types";
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${stable(v)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}
export function fingerprintVideoInput(input: VideoGenerationInputV1) {
  return createHash("sha256").update(stable(input)).digest("hex");
}
