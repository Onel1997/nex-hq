import type { Metadata, Viewport } from "next";
import "@/app/artwork-prep-studio.css";
import { ArtworkPrepWorkspace } from "@/components/artwork-prep-studio/artwork-prep-workspace";
import { hasXerianoAccountMembership, hasXerianoOwnerAuthority, resolveXerianoAccess } from "@/lib/xeriano/auth";

export const metadata: Metadata = { title: "Artwork Prep Studio" };
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", interactiveWidget: "resizes-content" };

export default async function ArtworkPrepStudioPage() {
  const access = await resolveXerianoAccess();
  const allowed = access.status === "AUTHENTICATED" && hasXerianoAccountMembership(access.context) && hasXerianoOwnerAuthority(access.context);
  if (!allowed) return <div className="xeriano-inline-notice">Das Artwork Prep Studio ist derzeit nur im OWNER-Workspace verfügbar.</div>;
  return <div className="xeriano-embedded-studio"><ArtworkPrepWorkspace/></div>;
}
