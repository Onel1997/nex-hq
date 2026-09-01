import type { XeriamoBrandingRole } from "./contracts";

export type XeriamoPublicBrandingBytes = {
  bytes: Uint8Array;
  mimeType: string;
};

export function selectPublicBrandingCandidates<
  T extends { role: XeriamoBrandingRole; mime_type: string },
>(rows: readonly T[], role: XeriamoBrandingRole): T[] {
  const exact = rows.find((candidate) => candidate.role === role);
  const iconFallback = rows.find((candidate) => candidate.role === "ICON");
  return [
    exact,
    role === "FAVICON" ? iconFallback : undefined,
    role === "APPLE_TOUCH_ICON" && iconFallback?.mime_type === "image/png" ? iconFallback : undefined,
  ].filter((candidate, index, all): candidate is T => Boolean(candidate) && all.indexOf(candidate) === index);
}

export function createXeriamoRootFaviconResponse(asset: XeriamoPublicBrandingBytes | null) {
  if (!asset) {
    return new Response(null, {
      status: 503,
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  }

  return new Response(new Uint8Array(asset.bytes), {
    status: 200,
    headers: {
      "Content-Type": asset.mimeType,
      "Content-Length": String(asset.bytes.length),
      "Cache-Control": "no-store, max-age=0",
      Pragma: "no-cache",
      Expires: "0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
