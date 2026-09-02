import type { UgcVideoStoredAsset } from "@/lib/ugc-video-studio/server-storage";

export type UgcVideoByteRange =
  | { kind: "FULL" }
  | { kind: "PARTIAL"; start: number; end: number }
  | { kind: "UNSATISFIABLE" };

export function resolveUgcVideoByteRange(
  header: string | null,
  byteLength: number,
): UgcVideoByteRange {
  if (!header) return { kind: "FULL" };
  if (byteLength <= 0 || !header.startsWith("bytes=") || header.includes(",")) {
    return { kind: "UNSATISFIABLE" };
  }
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match || (!match[1] && !match[2])) return { kind: "UNSATISFIABLE" };

  if (!match[1]) {
    const suffixLength = Number(match[2]);
    if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) {
      return { kind: "UNSATISFIABLE" };
    }
    return {
      kind: "PARTIAL",
      start: Math.max(0, byteLength - suffixLength),
      end: byteLength - 1,
    };
  }

  const start = Number(match[1]);
  const requestedEnd = match[2] ? Number(match[2]) : byteLength - 1;
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(requestedEnd) ||
    start < 0 ||
    requestedEnd < start ||
    start >= byteLength
  ) {
    return { kind: "UNSATISFIABLE" };
  }
  return {
    kind: "PARTIAL",
    start,
    end: Math.min(requestedEnd, byteLength - 1),
  };
}

export function buildUgcVideoAssetResponse(input: {
  request: Request;
  asset: UgcVideoStoredAsset;
  resultId: string;
  download: boolean;
  head?: boolean;
}): Response {
  const total = input.asset.bytes.byteLength;
  const range = resolveUgcVideoByteRange(input.request.headers.get("range"), total);
  const commonHeaders: Record<string, string> = {
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, no-store",
    "Content-Type": input.asset.mimeType,
    "X-Content-Type-Options": "nosniff",
    "Content-Disposition": `${input.download ? "attachment" : "inline"}; filename="ugc-video-${input.resultId}.mp4"`,
  };

  if (range.kind === "UNSATISFIABLE") {
    return new Response(null, {
      status: 416,
      headers: { ...commonHeaders, "Content-Range": `bytes */${total}` },
    });
  }

  if (range.kind === "PARTIAL") {
    const bytes = input.asset.bytes.subarray(range.start, range.end + 1);
    return new Response(input.head ? null : Uint8Array.from(bytes), {
      status: 206,
      headers: {
        ...commonHeaders,
        "Content-Length": String(bytes.byteLength),
        "Content-Range": `bytes ${range.start}-${range.end}/${total}`,
      },
    });
  }

  return new Response(input.head ? null : Uint8Array.from(input.asset.bytes), {
    status: 200,
    headers: { ...commonHeaders, "Content-Length": String(total) },
  });
}
