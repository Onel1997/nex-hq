import type { Metadata } from "next";
import Link from "next/link";

import { logoutOwner } from "@/app/auth-actions";
import { loadXerianoAccountSummary, requireXerianoAccount } from "@/lib/xeriano/server";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  const context = await requireXerianoAccount();
  const summary = await loadXerianoAccountSummary(context.accountId);
  return (
    <div className="xeriano-app-page">
      <header className="xeriano-page-header">
        <div><span className="xeriano-eyebrow">Account</span><h1>{context.accountName}</h1><p>{context.email}</p></div>
      </header>
      <div className="xeriano-account-grid xeriano-account-grid-compact">
        <section>
          <span className="xeriano-section-label">Plan & Abrechnung</span>
          <h2>{summary?.plan ?? "Noch nicht aktiv"}</h2>
          <dl>
            <div><dt>Credits</dt><dd>{summary ? summary.totalAvailable.toLocaleString("de-DE") : "—"}</dd></div>
            {summary?.renewalAt ? <div><dt>Nächste Verlängerung</dt><dd>{new Date(summary.renewalAt).toLocaleDateString("de-DE")}</dd></div> : null}
          </dl>
          <Link href="/app/credits" className="xeriano-secondary-button">Plan & Credits verwalten</Link>
        </section>
        <section>
          <span className="xeriano-section-label">Einstellungen</span>
          <h2>Dein Konto</h2>
          <dl><div><dt>Sprache</dt><dd>Deutsch</dd></div></dl>
          <form action={logoutOwner}><button className="xeriano-danger-button">Abmelden</button></form>
        </section>
      </div>
    </div>
  );
}
