import type { Metadata, Viewport } from "next";

import { UgcVideoStudioWorkspace } from "@/components/ugc-video-studio/ugc-video-studio-workspace";
import { getUgcVideoProviderPublicConfig } from "@/lib/ugc-video-studio/provider-config";
import { hasXerianoAccountMembership } from "@/lib/xeriano/access-policy";
import { resolveXerianoAccess } from "@/lib/xeriano/auth";
import "@/app/ugc-video-studio.css";

export const metadata: Metadata = { title: "UGC Video Studio" };
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

export default async function OwnerUgcVideoStudioPage({
  searchParams,
}: {
  searchParams: Promise<{ libraryAsset?: string }>;
}) {
  const [access, query] = await Promise.all([resolveXerianoAccess(), searchParams]);
  const hasAccount =
    access.status === "AUTHENTICATED" &&
    hasXerianoAccountMembership(access.context);
  if (!hasAccount) {
    return <div className="xeriano-inline-notice">Für das UGC Video Studio wird eine aktive Xeriamo Account-Mitgliedschaft benötigt.</div>;
  }
  return (
    <div className="xeriano-embedded-studio">
      <UgcVideoStudioWorkspace
        ownerMode
        providerConfig={getUgcVideoProviderPublicConfig()}
        initialModelId="kling-v3-pro-motion-control"
        initialLibraryAssetId={query.libraryAsset}
      />
    </div>
  );
}
