import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { OwnerManualCreditGrant } from "@/components/xeriano/owner-manual-credit-grant";
import {
  loadXerianoOwnerCustomerDetail,
  XerianoOwnerCustomerError,
} from "@/lib/xeriano/owner-customer-center";

export const metadata: Metadata = { title: "Kundendetail" };

const dateTime = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" });

export default async function OwnerCustomerDetailPage({
  params,
}: {
  params: Promise<{ accountId: string }>;
}) {
  const { accountId } = await params;
  let customer;
  try {
    customer = await loadXerianoOwnerCustomerDetail(accountId);
  } catch (error) {
    if (error instanceof XerianoOwnerCustomerError && error.code === "CUSTOMER_NOT_FOUND") notFound();
    throw error;
  }

  const wallet = [
    ["Gesamt", customer.totalAvailable],
    ["Subscription", customer.subscriptionAvailable],
    ["Top-up", customer.topUpAvailable],
    ["Trial", customer.trialAvailable],
    ["Beta / Manual", customer.manualAvailable],
    ["Reserviert", customer.reservedCredits],
  ] as const;

  return (
    <main className="owner-customers-page owner-customer-detail">
      <Link className="owner-customer-back" href="/hq/customers">← Alle Kunden</Link>
      <header className="owner-customers-hero">
        <div><span>OWNER · KUNDENDETAIL</span><h1>{customer.displayName}</h1><p>{customer.email}</p></div>
        <span className={`owner-plan-badge is-${customer.currentPlan.toLowerCase()}`}>{customer.currentPlan}</span>
      </header>

      <div className="owner-customer-overview">
        <section><span className="owner-customer-kicker">Account</span><h2>{customer.accountStatus}</h2><dl><div><dt>Registriert</dt><dd>{dateTime.format(new Date(customer.registeredAt))}</dd></div><div><dt>Letzte Aktivität</dt><dd>{dateTime.format(new Date(customer.latestActivityAt))}</dd></div></dl></section>
        <section><span className="owner-customer-kicker">Plan & Billing</span><h2>{customer.currentPlan}</h2><dl><div><dt>Subscription</dt><dd>{customer.subscriptionStatus}</dd></div><div><dt>Stripe Customer</dt><dd>{customer.billing.hasStripeCustomer ? "Vorhanden" : "Nicht vorhanden"}</dd></div><div><dt>Verlängerung</dt><dd>{customer.renewalAt ? dateTime.format(new Date(customer.renewalAt)) : "—"}</dd></div></dl></section>
      </div>

      <section className="owner-customer-wallet"><header><span className="owner-customer-kicker">Credits</span><h2>Wallet-Autorität</h2></header><div>{wallet.map(([label, value]) => <article key={label}><span>{label}</span><strong>{value.toLocaleString("de-DE")}</strong></article>)}</div></section>

      <OwnerManualCreditGrant accountId={customer.accountId} customerEmail={customer.email} />

      <div className="owner-customer-activity-grid">
        <section>
          <header><span className="owner-customer-kicker">Usage</span><h2>Credit-Verlauf</h2></header>
          <div className="owner-customer-records">
            {customer.ledger.length ? customer.ledger.map((entry) => <article key={entry.id}><div><strong>{entry.type}</strong><span>{entry.modelId ?? "Xeriamo"} · {dateTime.format(new Date(entry.createdAt))}</span></div><strong className={entry.credits >= 0 ? "is-positive" : ""}>{entry.credits >= 0 ? "+" : ""}{entry.credits.toLocaleString("de-DE")}</strong></article>) : <p>Noch keine Ledger-Einträge.</p>}
          </div>
        </section>
        <section>
          <header><span className="owner-customer-kicker">Audit</span><h2>Manual-Gutschriften</h2></header>
          <div className="owner-customer-records">
            {customer.manualGrants.length ? customer.manualGrants.map((grant) => <article key={grant.id}><div><strong>{grant.reason}</strong><span>{dateTime.format(new Date(grant.createdAt))}</span></div><strong className="is-positive">+{grant.amount.toLocaleString("de-DE")}</strong></article>) : <p>Noch keine Manual-Gutschrift.</p>}
          </div>
        </section>
      </div>

      <section className="owner-customer-creations"><header><span className="owner-customer-kicker">Aktivität</span><h2>Letzte Creations</h2></header><div>{customer.creations.length ? customer.creations.map((creation) => <article key={creation.id}><strong>{creation.type}</strong><span>{creation.modelId}</span><small>{creation.credits} Credits · {dateTime.format(new Date(creation.createdAt))}</small></article>) : <p>Noch keine Creation vorhanden.</p>}</div></section>

      <details className="owner-customer-technical"><summary>Technische IDs</summary><dl><div><dt>Account</dt><dd>{customer.accountId}</dd></div><div><dt>User</dt><dd>{customer.userId}</dd></div></dl></details>
    </main>
  );
}
