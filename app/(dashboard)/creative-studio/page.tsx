import type { Metadata, Viewport } from "next";

import { CreativeStudioWorkspace } from "@/components/creative-studio/creative-studio-workspace";
import { getCreativeProviderPublicConfig } from "@/lib/creative-studio/nano-banana-config";
import "@/app/creative-studio.css";

export const metadata: Metadata = {
  title: "Creative Studio | Xeriamo Owner",
  description: "Flexible Bildgenerierung mit Referenzen und Prompt",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

export default function CreativeStudioPage() {
  return (
    <CreativeStudioWorkspace
      providerConfig={getCreativeProviderPublicConfig()}
    />
  );
}
