import type { Metadata } from "next";
import { ArrowDown, CreditCard, Gem, Gift, WalletCards } from "lucide-react";

import { XerianoBillingActionButton } from "@/components/xeriano/billing-action-button";
import { XerianoPlanCatalog, XerianoTopUpCatalog } from "@/components/xeriano/billing-catalog";
import { XerianoBillingReturnStatus } from "@/components/xeriano/billing-return-status";
import { resolveActiveXerianoPlan } from "@/lib/xeriano/plans";
import { getXerianoPlanIntentPresentation } from "@/lib/xeriano/plan-intent";
import { getXerianoStripeAvailability } from "@/lib/xeriano/stripe-config";
import {
  loadXerianoAccountSummary,
  loadXerianoBillingPresentation,
  loadXerianoBillingReturnState,
  loadXerianoCreditHistory,
  requireXerianoAccount,
} from "@/lib/xeriano/server";

export const metadata: Metadata = { title: "Credits & Plan" };

const ENTRY_LABELS: Record<string, string> = {
  GRANT: "Credit-Gutschrift",
  COMMIT: "Generierung",
  RELEASE: "Reservierung freigegeben",
  REFUND: "Credit-Erstattung",
  EXPIRE: "Credits abgelaufen",
};

export default async function CreditsPage({
  searchParams,
}: {
  searchParams: Promise<{ billing?: string; session_id?: string; plan?: string }>;
}) {
  const context = await requireXerianoAccount();
  const query = await searchParams;
  const [summary, history, billing, billingReturn] = await Promise.all([
    loadXerianoAccountSummary(context.accountId),
    loadXerianoCreditHistory(context.accountId),
    loadXerianoBillingPresentation(context.accountId),
    query.billing === "processing"
      ? loadXerianoBillingReturnState(context.accountId, query.session_id)
      : Promise.resolve(null),
  ]);
  const billingAvailability = getXerianoStripeAvailability();
  const intendedPlan = getXerianoPlanIntentPresentation(query.plan);
  const hasManagedSubscription = billing.hasSubscription && billing.status !== "CANCELED" && billing.status !== "INACTIVE";
  const currentPlan = resolveActiveXerianoPlan(summary?.plan);
  const summaryItems = [
    { label: "Total Credits", value: summary?.totalAvailable, icon: WalletCards },
    { label: "Subscription", value: summary?.subscriptionCredits, icon: CreditCard },
    { label: "Top-up", value: summary?.topUpCredits, icon: Gem },
    { label: "Trial", value: summary?.trialCredits, icon: ArrowDown },
    { label: "Beta", value: summary?.manualCredits, icon: Gift },
  ];

  return (
    <div className="xeriano-app-page xeriano-credits-page">
      <header className="xeriano-page-header">
        <div>
          <span className="xeriano-eyebrow">Credits & Plan</span>
          <h1>Deine Credits</h1>
          <p>Kontostand, Plan und Guthaben an einem Ort.</p>
        </div>
      </header>

      {query.billing === "processing" ? (
        <XerianoBillingReturnStatus state={billingReturn!} />
      ) : query.billing === "canceled" ? (
        <section className="xeriano-billing-return is-neutral" role="status"><div><strong>Checkout abgebrochen</strong><span>Dein Plan und deine Credits wurden nicht verändert.</span></div></section>
      ) : null}

      {intendedPlan ? (
        <section className="xeriano-plan-intent-notice" role="status">
          <div>
            <strong>{intendedPlan.name} ausgewählt</strong>
            <span>Prüfe den Plan und starte den Checkout mit einem ausdrücklichen Klick.</span>
          </div>
          <a href="#plaene">Zum ausgewählten Plan</a>
        </section>
      ) : null}

      <section className="xeriano-wallet-summary" aria-label="Credit-Übersicht">
        {summaryItems.map(({ label, value, icon: Icon }, index) => (
          <article className={index === 0 ? "is-total" : undefined} key={label}>
            <span><Icon aria-hidden="true" />{label}</span>
            <strong>{value?.toLocaleString("de-DE") ?? "—"}</strong>
          </article>
        ))}
      </section>

      <section className="xeriano-current-plan-card">
        <div>
          <span className="xeriano-section-label">Dein aktueller Plan</span>
          <h2>{currentPlan?.name ?? summary?.plan ?? "Nicht verfügbar"}</h2>
          <p>
            {currentPlan
              ? `${currentPlan.grantedCredits.toLocaleString("de-DE")} ${currentPlan.code === "FREE" ? "einmalige Credits · keine monatliche Auffüllung" : "Credits pro Monat"}`
              : "Die Plan-Autorität ist gerade nicht verfügbar."}
          </p>
          {summary?.renewalAt ? <small>Nächste Verlängerung: {new Date(summary.renewalAt).toLocaleDateString("de-DE")}</small> : null}
          {currentPlan?.code === "FREE" ? <small>Dein vorhandener historischer Kontostand bleibt unverändert.</small> : null}
        </div>
        {hasManagedSubscription && billing.hasStripeCustomer && billingAvailability.portal ? (
          <XerianoBillingActionButton action="PORTAL" className="xeriano-secondary-button">Plan & Abrechnung verwalten</XerianoBillingActionButton>
        ) : <a className="xeriano-secondary-button" href="#plaene">Plan ändern</a>}
      </section>

      <section className="xeriano-billing-section" id="plaene">
        <header><span className="xeriano-section-label">Pläne</span><h2>Wähle, was zu deinem Workflow passt.</h2><p>Neue Abos starten im sicheren Stripe Checkout. Bestehende Abos verwaltest du im Kundenportal.</p></header>
        <XerianoPlanCatalog
          billingAvailability={billingAvailability}
          currentPlanCode={hasManagedSubscription || summary?.plan === "FREE" ? summary?.plan : null}
          hasPaidPlan={hasManagedSubscription}
          intendedProductCode={intendedPlan?.productCode ?? null}
          mode="ACCOUNT"
        />
      </section>

      <section className="xeriano-billing-section xeriano-topup-section">
        <header><span className="xeriano-section-label">Top-ups</span><h2>Credits flexibel aufladen.</h2><p>Top-up Credits verfallen nicht und bleiben getrennt von monatlichen Plan-Credits.</p></header>
        <XerianoTopUpCatalog billingAvailability={billingAvailability} showActions />
      </section>

      <section className="xeriano-history-placeholder">
        <h2>Credit-Verlauf</h2>
        {history.length ? (
          <div className="xeriano-credit-history">
            {history.map((entry) => (
              <article key={entry.id}>
                <div><strong>{ENTRY_LABELS[entry.type] ?? entry.type}</strong><span>{entry.modelId ?? "Xeriamo"} · {new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(entry.createdAt))}</span></div>
                <strong className={entry.credits >= 0 ? "is-positive" : "is-negative"}>{entry.credits >= 0 ? "+" : ""}{entry.credits.toLocaleString("de-DE")} Credits</strong>
              </article>
            ))}
          </div>
        ) : <p>Noch keine bestätigten Transaktionen.</p>}
      </section>
    </div>
  );
}
