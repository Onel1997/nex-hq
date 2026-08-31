import type { Metadata, Viewport } from "next";

import { CreativeStudioWorkspace } from "@/components/creative-studio/creative-studio-workspace";
import { getCreativeProviderPublicConfig } from "@/lib/creative-studio/nano-banana-config";
import { hasXerianoAccountMembership } from "@/lib/xeriano/access-policy";
import { resolveXerianoAccess } from "@/lib/xeriano/auth";
import "@/app/creative-studio.css";

export const metadata: Metadata = { title: "Creative Studio" };
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

export default async function OwnerCreativeStudioPage({
  searchParams,
}: {
  searchParams: Promise<{ libraryAsset?: string; creation?: string; mode?: string }>;
}) {
  const [access, query] = await Promise.all([resolveXerianoAccess(), searchParams]);
  const hasAccount =
    access.status === "AUTHENTICATED" &&
    hasXerianoAccountMembership(access.context);
  if (!hasAccount) {
    return <div className="xeriano-inline-notice">Für das Creative Studio wird eine aktive Xeriamo Account-Mitgliedschaft benötigt.</div>;
  }
  return (
    <div className="xeriano-embedded-studio">
      <CreativeStudioWorkspace
        ownerMode
        providerConfig={getCreativeProviderPublicConfig()}
        initialLibraryAssetId={query.libraryAsset}
        initialCreationId={query.creation}
        initialCreationMode={query.mode === "edit" ? "edit" : query.mode === "recreate" ? "recreate" : undefined}
      />
    </div>
  );
}
