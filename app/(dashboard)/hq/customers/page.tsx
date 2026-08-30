import type { Metadata } from "next";
import Link from "next/link";
import { Search, UsersRound } from "lucide-react";

import {
  listXerianoOwnerCustomers,
  normalizeOwnerCustomerListInput,
  XerianoOwnerCustomerError,
} from "@/lib/xeriano/owner-customer-center";

export const metadata: Metadata = { title: "Kunden" };

function date(value: string) {
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(new Date(value));
}

function pageHref(input: { search: string | null; plan: string | null; status: string | null }, page: number) {
  const query = new URLSearchParams();
  if (input.search) query.set("q", input.search);
  if (input.plan) query.set("plan", input.plan);
  if (input.status) query.set("status", input.status);
  query.set("page", String(page));
  return `/hq/customers?${query.toString()}`;
}

export default async function OwnerCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; plan?: string; status?: string; page?: string }>;
}) {
  const query = await searchParams;
  const input = normalizeOwnerCustomerListInput({
    search: query.q,
    plan: query.plan,
    status: query.status,
    page: Number(query.page),
    pageSize: 25,
  });
  let result;
  try {
    result = await listXerianoOwnerCustomers(input);
  } catch (error) {
    if (error instanceof XerianoOwnerCustomerError && error.code === "CUSTOMER_CENTER_UNAVAILABLE") {
      return (
        <main className="owner-customers-page">
          <header className="owner-customers-hero"><div><span>OWNER · XERIAMO</span><h1>Kunden</h1><p>Konto-, Plan- und Credit-Autorität für die Private Beta.</p></div></header>
          <section className="owner-customers-unavailable"><h2>Customer Center noch nicht aktiv</h2><p>Wende zuerst die beiden additiven Manual-Credit-Migrationen auf Staging an.</p></section>
        </main>
      );
    }
    throw error;
  }

  return (
    <main className="owner-customers-page">
      <header className="owner-customers-hero">
        <div><span>OWNER · XERIAMO</span><h1>Kunden</h1><p>Konto-, Plan- und Credit-Autorität für die Private Beta.</p></div>
        <div className="owner-customers-count"><UsersRound aria-hidden="true" /><strong>{result.total.toLocaleString("de-DE")}</strong><span>Kunden</span></div>
      </header>

      <form className="owner-customers-filters" method="get">
        <label className="owner-customers-search"><Search aria-hidden="true" /><input defaultValue={input.search ?? ""} name="q" placeholder="E-Mail oder Name" type="search" /></label>
        <label><span>Plan</span><select defaultValue={input.plan ?? ""} name="plan"><option value="">Alle Pläne</option><option>FREE</option><option>CREATOR</option><option>PRO</option><option>STUDIO</option><option>MAX</option></select></label>
        <label><span>Status</span><select defaultValue={input.status ?? ""} name="status"><option value="">Alle Status</option><option>ACTIVE</option><option>SUSPENDED</option><option>CLOSED</option></select></label>
        <button type="submit">Filtern</button>
      </form>

      {result.customers.length ? (
        <div className="owner-customers-table-wrap">
          <table className="owner-customers-table">
            <thead><tr><th>Kunde</th><th>Plan</th><th>Credits</th><th>Aufteilung</th><th>Registriert</th><th>Aktivität</th><th><span className="sr-only">Öffnen</span></th></tr></thead>
            <tbody>
              {result.customers.map((customer) => (
                <tr key={customer.accountId}>
                  <td><strong>{customer.displayName}</strong><span>{customer.email}</span></td>
                  <td><span className={`owner-plan-badge is-${customer.currentPlan.toLowerCase()}`}>{customer.currentPlan}</span><small>{customer.accountStatus}</small></td>
                  <td><strong>{customer.totalAvailable.toLocaleString("de-DE")}</strong><span>verfügbar</span></td>
                  <td><span>Abo {customer.subscriptionAvailable.toLocaleString("de-DE")}</span><span>Top-up {customer.topUpAvailable.toLocaleString("de-DE")}</span><span>Beta {customer.manualAvailable.toLocaleString("de-DE")}</span></td>
                  <td>{date(customer.registeredAt)}</td>
                  <td>{date(customer.latestActivityAt)}</td>
                  <td><Link href={`/hq/customers/${customer.accountId}`}>Öffnen</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <section className="owner-customers-empty"><h2>Keine Kunden gefunden</h2><p>Prüfe Suche und Filter.</p></section>}

      {result.totalPages > 1 ? (
        <nav className="owner-customers-pagination" aria-label="Kundenseiten">
          {result.page > 1 ? <Link href={pageHref(input, result.page - 1)}>Zurück</Link> : <span />}
          <span>Seite {result.page} von {result.totalPages}</span>
          {result.page < result.totalPages ? <Link href={pageHref(input, result.page + 1)}>Weiter</Link> : <span />}
        </nav>
      ) : null}
    </main>
  );
}
