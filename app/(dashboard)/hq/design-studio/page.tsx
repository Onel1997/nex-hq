import type { Metadata } from "next";

import { CustomerDesignStudio } from "@/components/xeriano/customer-design-studio";
import { hasXerianoAccountMembership } from "@/lib/xeriano/access-policy";
import { resolveXerianoAccess } from "@/lib/xeriano/auth";

export const metadata: Metadata = { title: "Design Studio" };

export default async function OwnerDesignStudioPage() {
  const access = await resolveXerianoAccess();
  const hasAccount =
    access.status === "AUTHENTICATED" &&
    hasXerianoAccountMembership(access.context);

  if (!hasAccount) {
    return (
      <main className="xeriano-studio-page">
        <div className="xeriano-inline-notice">
          Für das Design Studio wird eine aktive Xeriamo Account-Mitgliedschaft benötigt.
        </div>
      </main>
    );
  }

  return <CustomerDesignStudio audience="OWNER" />;
}
