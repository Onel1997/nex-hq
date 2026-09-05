import type { Metadata, Viewport } from "next";

import "@/app/video-editor-studio.css";
import { VideoEditorStudioWorkspace } from "@/components/video-editor-studio/video-editor-workspace";
import {
  hasXerianoAccountMembership,
  hasXerianoOwnerAuthority,
  resolveXerianoAccess,
} from "@/lib/xeriano/auth";

export const metadata: Metadata = { title: "Video Editor Studio" };
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

export default async function OwnerVideoEditorStudioPage() {
  const access = await resolveXerianoAccess();
  const allowed =
    access.status === "AUTHENTICATED" &&
    hasXerianoAccountMembership(access.context) &&
    hasXerianoOwnerAuthority(access.context);
  if (!allowed) {
    return <div className="xeriano-inline-notice">Das Video Editor Studio ist derzeit nur im OWNER-Workspace verfügbar.</div>;
  }
  return <div className="xeriano-embedded-studio"><VideoEditorStudioWorkspace /></div>;
}

