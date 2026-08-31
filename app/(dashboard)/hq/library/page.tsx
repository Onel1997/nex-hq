import type { Metadata } from "next";

import { XerianoLibraryGrid } from "@/components/xeriano/library-grid";
import { resolveXerianoAccess } from "@/lib/xeriano/auth";
import { hasXerianoAccountMembership } from "@/lib/xeriano/access-policy";

export const metadata: Metadata = { title: "Bibliothek" };

export default async function OwnerLibraryPage() {
  const access = await resolveXerianoAccess();
  const hasAccount =
    access.status === "AUTHENTICATED" &&
    hasXerianoAccountMembership(access.context);

  return (
    <main className="xeriano-app-page xeriano-library-page">
      <header className="xeriano-page-header">
        <div>
          <span className="xeriano-eyebrow">OWNER · XERIAMO</span>
          <h1>Bibliothek</h1>
          <p>Designs, Bilder, Videos und Kreationen deines Xeriamo Accounts.</p>
        </div>
      </header>
      {hasAccount ? (
        <XerianoLibraryGrid basePath="/hq/library" />
      ) : (
        <div className="xeriano-inline-notice">
          Für die Bibliothek wird eine aktive Xeriamo Account-Mitgliedschaft
          benötigt.
        </div>
      )}
    </main>
  );
}
