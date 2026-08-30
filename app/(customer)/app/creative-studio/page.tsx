import type { Viewport } from "next";

import { CreativeStudioWorkspace } from "@/components/creative-studio/creative-studio-workspace";
import { getXerianoCreativeCustomerConfig } from "@/lib/xeriano/customer-config";
import { requireXerianoAccount, loadXerianoAccountSummary } from "@/lib/xeriano/server";
import "@/app/creative-studio.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

export default async function CustomerCreativePage({
  searchParams,
}: {
  searchParams: Promise<{ libraryAsset?: string; creation?: string; mode?: string }>;
}) {
  const [query, context] = await Promise.all([searchParams, requireXerianoAccount()]);
  const summary = await loadXerianoAccountSummary(context.accountId);
  return (
    <div className="xeriano-embedded-studio">
      <CreativeStudioWorkspace
        customerMode
        customerConfig={getXerianoCreativeCustomerConfig()}
        customerStatus={summary ?? undefined}
        initialLibraryAssetId={query.libraryAsset}
        initialCreationId={query.creation}
        initialCreationMode={query.mode === "edit" ? "edit" : query.mode === "recreate" ? "recreate" : undefined}
      />
    </div>
  );
}
