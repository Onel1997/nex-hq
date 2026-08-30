import type { Viewport } from "next";

import { UgcVideoStudioWorkspace } from "@/components/ugc-video-studio/ugc-video-studio-workspace";
import { getXerianoUgcCustomerConfig } from "@/lib/xeriano/customer-config";
import { requireXerianoAccount, loadXerianoAccountSummary } from "@/lib/xeriano/server";
import "@/app/ugc-video-studio.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

export default async function CustomerUgcPage({
  searchParams,
}: {
  searchParams: Promise<{ libraryAsset?: string }>;
}) {
  const [query, context] = await Promise.all([searchParams, requireXerianoAccount()]);
  const summary = await loadXerianoAccountSummary(context.accountId);
  return (
    <div className="xeriano-embedded-studio">
      <UgcVideoStudioWorkspace
        customerMode
        customerConfig={getXerianoUgcCustomerConfig()}
        customerStatus={summary ?? undefined}
        initialModelId="kling-v3-pro-motion-control"
        initialLibraryAssetId={query.libraryAsset}
      />
    </div>
  );
}
