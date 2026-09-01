import type { XeriamoPublicBranding, XeriamoPublicBrandingSnapshot } from "./contracts";

const STATIC_FALLBACK_VERSION = "xeriamo-fallback-v1";

export type XeriamoBrowserBrandingLink = {
  url: string;
  mimeType: string;
  version: string;
  sourceRole: "FAVICON" | "ICON" | "APPLE_TOUCH_ICON" | "STATIC_FALLBACK";
};

function versionedEndpoint(pathname: string, version: string) {
  return `${pathname}?v=${encodeURIComponent(version)}`;
}

/** A failed/unresolved refresh can never erase a valid hydrated snapshot. */
export function retainResolvedBrandingSnapshot(
  current: XeriamoPublicBrandingSnapshot,
  next: XeriamoPublicBrandingSnapshot,
) {
  return next.resolved ? next : current;
}

/** One authority for browser-icon fallback order and deterministic cache busting. */
export function resolveXeriamoBrowserBranding(
  branding: XeriamoPublicBranding,
): { favicon: XeriamoBrowserBrandingLink; appleTouchIcon: XeriamoBrowserBrandingLink } {
  const faviconSource = branding.FAVICON ?? branding.ICON;
  const appleSource = branding.APPLE_TOUCH_ICON ?? (
    branding.ICON?.mimeType === "image/png" ? branding.ICON : undefined
  );

  const faviconVersion = faviconSource?.version ?? STATIC_FALLBACK_VERSION;
  const appleVersion = appleSource?.version ?? STATIC_FALLBACK_VERSION;

  return {
    favicon: {
      url: versionedEndpoint("/api/public/branding/favicon", faviconVersion),
      mimeType: faviconSource?.mimeType ?? "image/x-icon",
      version: faviconVersion,
      sourceRole: faviconSource?.role === "FAVICON"
        ? "FAVICON"
        : faviconSource?.role === "ICON"
          ? "ICON"
          : "STATIC_FALLBACK",
    },
    appleTouchIcon: {
      url: versionedEndpoint("/api/public/branding/apple-touch-icon", appleVersion),
      mimeType: appleSource?.mimeType ?? "image/png",
      version: appleVersion,
      sourceRole: appleSource?.role === "APPLE_TOUCH_ICON"
        ? "APPLE_TOUCH_ICON"
        : appleSource?.role === "ICON"
          ? "ICON"
          : "STATIC_FALLBACK",
    },
  };
}
