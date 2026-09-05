import "server-only";

import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { open } from "node:fs/promises";
import { once } from "node:events";

import { requireEnv } from "@/lib/config/env";
import type { VideoEditorSourceLocator } from "./sources";
import { createVideoEditorSourceSignedUrl } from "./sources";

function assertTrustedSignedUrl(value: string) {
  const signed = new URL(value);
  const configured = new URL(requireEnv("NEXT_PUBLIC_SUPABASE_URL"));
  if (
    signed.protocol !== "https:" ||
    signed.username || signed.password || signed.port || signed.hash ||
    signed.hostname !== configured.hostname ||
    !signed.pathname.includes("/storage/v1/object/sign/")
  ) throw new Error("VIDEO_EDITOR_STORAGE_URL_INVALID");
  return signed.toString();
}

function signatureMatches(bytes: Buffer, mimeType: string) {
  if (["video/mp4", "video/quicktime", "video/x-m4v"].includes(mimeType)) {
    return bytes.byteLength >= 12 && bytes.subarray(4, 8).toString("ascii") === "ftyp";
  }
  if (mimeType === "video/webm") return bytes.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
  if (mimeType === "audio/mpeg") return bytes.subarray(0, 3).toString("ascii") === "ID3" || (bytes[0] === 0xff && ((bytes[1] ?? 0) & 0xe0) === 0xe0);
  if (["audio/wav", "audio/x-wav"].includes(mimeType)) return bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WAVE";
  return false;
}

export async function streamVideoEditorSourceToFile(input: {
  locator: VideoEditorSourceLocator;
  destination: string;
  deadlineAt: number;
}) {
  const remaining = input.deadlineAt - Date.now();
  if (remaining <= 1_000) throw new Error("VIDEO_EDITOR_TIMEOUT");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), remaining);
  const output = createWriteStream(input.destination, { flags: "wx" });
  const hash = createHash("sha256");
  let bytesWritten = 0;
  try {
    const response = await fetch(assertTrustedSignedUrl(await createVideoEditorSourceSignedUrl(input.locator)), {
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok || !response.body) throw new Error("VIDEO_EDITOR_SOURCE_READ_FAILED");
    const declaredLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(declaredLength) && declaredLength !== input.locator.byteLength) throw new Error("VIDEO_EDITOR_SOURCE_SIZE_MISMATCH");
    const reader = response.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytesWritten += value.byteLength;
      if (bytesWritten > input.locator.byteLength) {
        await reader.cancel();
        throw new Error("VIDEO_EDITOR_SOURCE_SIZE_MISMATCH");
      }
      const chunk = Buffer.from(value);
      hash.update(chunk);
      if (!output.write(chunk)) await once(output, "drain");
    }
    output.end();
    await once(output, "close");
    if (bytesWritten !== input.locator.byteLength) throw new Error("VIDEO_EDITOR_SOURCE_SIZE_MISMATCH");
    const checksum = hash.digest("hex");
    if (input.locator.checksum && checksum !== input.locator.checksum) throw new Error("VIDEO_EDITOR_SOURCE_CHECKSUM_MISMATCH");
    const file = await open(input.destination, "r");
    try {
      const head = Buffer.alloc(16);
      const read = await file.read(head, 0, 16, 0);
      if (!signatureMatches(head.subarray(0, read.bytesRead), input.locator.mimeType)) throw new Error("VIDEO_EDITOR_SOURCE_INVALID");
    } finally {
      await file.close();
    }
    return { bytesWritten, checksum };
  } catch (error) {
    output.destroy();
    if (error instanceof Error && (error.name === "AbortError" || error.message === "VIDEO_EDITOR_TIMEOUT")) throw new Error("VIDEO_EDITOR_TIMEOUT");
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
