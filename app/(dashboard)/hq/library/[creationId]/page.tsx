import type { Metadata } from "next";

import { XerianoCreationDetail } from "@/components/xeriano/creation-detail";
import { hasXerianoAccountMembership } from "@/lib/xeriano/access-policy";
import { resolveXerianoAccess } from "@/lib/xeriano/auth";

export const metadata: Metadata = { title: "Kreation" };

export default async function OwnerCreationPage({
  params,
}: {
  params: Promise<{ creationId: string }>;
}) {
  const access = await resolveXerianoAccess();
  const hasAccount =
    access.status === "AUTHENTICATED" &&
    hasXerianoAccountMembership(access.context);

  if (!hasAccount) {
    return (
      <main className="xeriano-app-page xeriano-library-page">
        <div className="xeriano-inline-notice">
          Für diese Kreation wird eine aktive Xeriamo Account-Mitgliedschaft
          benötigt.
        </div>
      </main>
    );
  }

  const { creationId } = await params;
  return <XerianoCreationDetail creationId={creationId} ownerMode />;
}
