"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { XeriamoPublicBranding } from "@/lib/xeriano/branding/contracts";

const BrandingContext = createContext<XeriamoPublicBranding>({});
export const XERIAMO_BRANDING_UPDATED_EVENT = "xeriamo-branding-updated";

function managedLink(rel: "icon" | "apple-touch-icon") {
  let link = document.head.querySelector<HTMLLinkElement>(`link[data-xeriamo-branding="${rel}"]`);
  if (!link) {
    link = document.createElement("link");
    link.rel = rel;
    link.dataset.xeriamoBranding = rel;
    document.head.append(link);
  }
  return link;
}

export function XeriamoBrandingProvider({ children }: { children: ReactNode }) {
  const [branding, setBranding] = useState<XeriamoPublicBranding>({});
  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/public/branding", { cache: "no-store" });
      const body = await response.json() as { branding?: XeriamoPublicBranding };
      if (response.ok && body.branding) setBranding(body.branding);
    } catch { /* Text/X and static icon fallbacks remain visible. */ }
  }, []);

  useEffect(() => {
    void load();
    window.addEventListener(XERIAMO_BRANDING_UPDATED_EVENT, load);
    return () => window.removeEventListener(XERIAMO_BRANDING_UPDATED_EVENT, load);
  }, [load]);

  useEffect(() => {
    const favicon = branding.FAVICON;
    if (favicon) {
      const link = managedLink("icon");
      link.href = favicon.url;
      link.type = favicon.mimeType;
    }
    const apple = branding.APPLE_TOUCH_ICON ?? (branding.ICON?.mimeType === "image/png" ? branding.ICON : undefined);
    if (apple) {
      const link = managedLink("apple-touch-icon");
      link.href = apple.url;
      link.type = apple.mimeType;
    }
  }, [branding]);

  return <BrandingContext.Provider value={branding}>{children}</BrandingContext.Provider>;
}

export function useXeriamoBranding() {
  return useContext(BrandingContext);
}
