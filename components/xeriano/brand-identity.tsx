"use client";

/* eslint-disable @next/next/no-img-element -- Runtime-managed SVG/ICO/PNG branding uses stable revalidated endpoints. */

import { useXeriamoBranding } from "./branding-provider";

export function XeriamoBrandLockup() {
  return (
    <span className="xeriamo-brand-lockup">
      <span className="xeriamo-brand-lockup-mark" aria-hidden="true">
        <XeriamoBrandIdentity role="ICON" markOnly />
      </span>
      <span className="xeriamo-brand-lockup-wordmark">
        <XeriamoBrandIdentity role="LOGO" />
      </span>
    </span>
  );
}

export function XeriamoBrandIdentity({
  role,
  showName = false,
  markOnly = false,
}: {
  role: "LOGO" | "ICON";
  showName?: boolean;
  /** Compact Owner shells provide their single visible name beside this mark. */
  markOnly?: boolean;
}) {
  const asset = useXeriamoBranding()[role];
  const showVisibleName = !markOnly && (showName || !asset);
  const logoAspectRatio = asset?.width && asset.height ? asset.width / asset.height : null;
  const hasSquareLogoCanvas = role === "LOGO" && logoAspectRatio !== null && logoAspectRatio >= 0.8 && logoAspectRatio <= 1.25;
  return (
    <span className={`xeriamo-brand-identity is-${role.toLowerCase()}${asset ? " has-asset" : " is-fallback"}${hasSquareLogoCanvas ? " has-square-canvas" : ""}`}>
      {asset ? <img src={asset.url} alt="" aria-hidden="true" /> : role === "ICON" ? <span className="xeriamo-brand-fallback-mark" aria-hidden="true">X</span> : null}
      {showVisibleName ? <strong>Xeriamo</strong> : markOnly ? null : <span className="sr-only">Xeriamo</span>}
    </span>
  );
}
