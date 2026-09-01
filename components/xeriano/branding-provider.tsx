"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { XeriamoPublicBrandingSnapshot } from "@/lib/xeriano/branding/contracts";
import { resolveXeriamoBrowserBranding, retainResolvedBrandingSnapshot } from "@/lib/xeriano/branding/presentation";

const BrandingContext = createContext<XeriamoPublicBrandingSnapshot>({ branding: {}, resolved: false });
export const XERIAMO_BRANDING_UPDATED_EVENT = "xeriamo-branding-updated";

function managedLink(rel: "icon" | "shortcut icon" | "apple-touch-icon") {
  let link = document.head.querySelector<HTMLLinkElement>(`link[data-xeriamo-branding="${rel}"]`);
  const endpoint = rel === "apple-touch-icon"
    ? "/api/public/branding/apple-touch-icon"
    : "/api/public/branding/favicon";
  if (!link) {
    link = Array.from(document.head.querySelectorAll<HTMLLinkElement>(`link[rel="${rel}"]`))
      .find((candidate) => candidate.getAttribute("href")?.startsWith(endpoint)) ?? null;
    if (link) link.dataset.xeriamoBranding = rel;
  }
  if (!link) {
    link = document.createElement("link");
    link.rel = rel;
    link.dataset.xeriamoBranding = rel;
    document.head.append(link);
  }
  return link;
}

export function XeriamoBrandingProvider({
  children,
  initialSnapshot,
}: {
  children?: ReactNode;
  initialSnapshot: XeriamoPublicBrandingSnapshot;
}) {
  // The server snapshot is also the hydration snapshot. An active wordmark is
  // never temporarily replaced by the fallback while public branding loads.
  const [snapshot, setSnapshot] = useState<XeriamoPublicBrandingSnapshot>(initialSnapshot);
  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/public/branding", { cache: "no-store" });
      const body = await response.json() as Partial<XeriamoPublicBrandingSnapshot>;
      if (!response.ok || body.resolved !== true || !body.branding) return;

      const next: XeriamoPublicBrandingSnapshot = { branding: body.branding, resolved: true };
      const changedIdentityUrls = (["ICON", "LOGO"] as const)
        .flatMap((role) => {
          const url = next.branding[role]?.url;
          return url && url !== snapshot.branding[role]?.url ? [url] : [];
        });

      await Promise.all(changedIdentityUrls.map((url) => new Promise<void>((resolve, reject) => {
        const image = new Image();
        image.onload = () => {
          if (typeof image.decode !== "function") {
            resolve();
            return;
          }
          void image.decode().then(resolve, resolve);
        };
        image.onerror = () => reject(new Error("BRANDING_IMAGE_UNAVAILABLE"));
        image.src = url;
      })));
      setSnapshot((current) => retainResolvedBrandingSnapshot(current, next));
    } catch { /* The current resolved snapshot remains visible. */ }
  }, [snapshot.branding]);

  useEffect(() => {
    window.addEventListener(XERIAMO_BRANDING_UPDATED_EVENT, load);
    return () => window.removeEventListener(XERIAMO_BRANDING_UPDATED_EVENT, load);
  }, [load]);

  useEffect(() => {
    const browserBranding = resolveXeriamoBrowserBranding(snapshot.branding);
    const favicon = managedLink("icon");
    favicon.href = browserBranding.favicon.url;
    favicon.type = browserBranding.favicon.mimeType;
    const shortcut = managedLink("shortcut icon");
    shortcut.href = browserBranding.favicon.url;
    shortcut.type = browserBranding.favicon.mimeType;
    const apple = managedLink("apple-touch-icon");
    apple.href = browserBranding.appleTouchIcon.url;
    apple.type = browserBranding.appleTouchIcon.mimeType;
  }, [snapshot.branding]);

  return <BrandingContext.Provider value={snapshot}>{children}</BrandingContext.Provider>;
}

export function useXeriamoBranding() {
  return useContext(BrandingContext).branding;
}

export function useXeriamoBrandingSnapshot() {
  return useContext(BrandingContext);
}
