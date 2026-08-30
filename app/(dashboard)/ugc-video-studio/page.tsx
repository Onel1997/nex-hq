import type { Metadata, Viewport } from "next";

import { UgcVideoStudioWorkspace } from "@/components/ugc-video-studio/ugc-video-studio-workspace";
import { getUgcVideoProviderPublicConfig } from "@/lib/ugc-video-studio/provider-config";
import "@/app/ugc-video-studio.css";

export const metadata: Metadata = {
  title: "UGC Video Studio | Xeriamo Owner",
  description: "Flexible UGC-Videos mit Referenzen und Prompt",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

export default function UgcVideoStudioPage() {
  return (
    <UgcVideoStudioWorkspace
      providerConfig={getUgcVideoProviderPublicConfig()}
    />
  );
}
