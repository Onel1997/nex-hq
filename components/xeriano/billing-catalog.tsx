import Link from "next/link";
import { Check, Sparkles } from "lucide-react";

import { XerianoBillingActionButton } from "@/components/xeriano/billing-action-button";
import { withXerianoPlanIntent } from "@/lib/xeriano/plan-intent";
import { getXerianoCommercialCatalogDto } from "@/lib/xeriano/plans";
import {
  type getXerianoStripeAvailability,
  type XerianoStripePlanCode,
} from "@/lib/xeriano/stripe-config";

type PlanCatalogProps = {
  currentPlanCode?: string | null;
  mode: "PUBLIC" | "ACCOUNT";
  billingAvailability?: ReturnType<typeof getXerianoStripeAvailability>;
  hasPaidPlan?: boolean;
  intendedProductCode?: XerianoStripePlanCode | null;
  authenticatedCustomer?: boolean;
};

export function XerianoPlanCatalog({
  currentPlanCode,
  mode,
  billingAvailability,
  hasPaidPlan = false,
  intendedProductCode = null,
  authenticatedCustomer = false,
}: PlanCatalogProps) {
  const { plans } = getXerianoCommercialCatalogDto();
  const current = currentPlanCode?.trim().toUpperCase();
  return (
    <div className="xeriano-catalog-plan-grid">
      {plans.map((plan) => {
        const isCurrent = plan.code === current;
        const productCode = plan.code === "FREE" ? null : `${plan.code}_MONTHLY` as XerianoStripePlanCode;
        const isIntended = productCode === intendedProductCode && !isCurrent;
        return (
          <article className={[isCurrent ? "is-current" : "", isIntended ? "is-intended" : ""].filter(Boolean).join(" ") || undefined} key={plan.version}>
            <header>
              <div>
                <span className="xeriano-catalog-plan-kicker">{plan.code === "FREE" ? "Zum Start" : "Monatlich"}</span>
                <h3>{plan.name}</h3>
              </div>
              {isCurrent ? <span className="xeriano-current-plan-badge">Aktueller Plan</span> : null}
              {isIntended ? <span className="xeriano-intended-plan-badge">Ausgewählt</span> : null}
            </header>
            <p className="xeriano-catalog-price">
              <strong>{(plan.grossPriceMinor / 100).toLocaleString("de-DE")} €</strong>
              <span>{plan.code === "FREE" ? "dauerhaft" : "/ Monat"}</span>
            </p>
            <p className="xeriano-catalog-credits">
              {plan.grantedCredits.toLocaleString("de-DE")} {plan.code === "FREE" ? "einmalige Credits" : "Credits monatlich"}
            </p>
            <ul>
              <li><Check aria-hidden="true" />Design und Creative Studio</li>
              <li><Check aria-hidden="true" />Private Bibliothek</li>
              <li><Check aria-hidden="true" />{plan.imageConcurrency} Bildgenerierung{plan.imageConcurrency > 1 ? "en" : ""} parallel</li>
              <li><Check aria-hidden="true" />{plan.videoConcurrency > 0 ? `${plan.videoConcurrency} Videogenerierung${plan.videoConcurrency > 1 ? "en" : ""} parallel` : "Video-Upgrade verfügbar"}</li>
            </ul>
            {mode === "PUBLIC" ? (
              <Link
                className="xeriano-catalog-plan-action"
                href={plan.code === "FREE"
                  ? "/register"
                  : withXerianoPlanIntent(authenticatedCustomer ? "/app/credits" : "/register", productCode)}
              >
                {plan.code === "FREE" ? "Kostenlos starten" : "Plan wählen"}
              </Link>
            ) : isCurrent ? (
              <button className="xeriano-catalog-plan-action" disabled title={isCurrent ? "Das ist dein aktueller Plan." : "Stripe wird im nächsten Schritt angebunden."}>
                Aktueller Plan
              </button>
            ) : plan.code === "FREE" ? (
              hasPaidPlan && billingAvailability?.portal ? (
                <XerianoBillingActionButton action="PORTAL">Plan verwalten</XerianoBillingActionButton>
              ) : <button className="xeriano-catalog-plan-action" disabled>Aktueller Plan erforderlich</button>
            ) : hasPaidPlan && billingAvailability?.portal ? (
              <XerianoBillingActionButton action="PORTAL">Plan verwalten</XerianoBillingActionButton>
            ) : productCode && billingAvailability?.products[productCode] ? (
              <XerianoBillingActionButton action="CHECKOUT" productCode={productCode}>
                {isIntended
                  ? `${plan.name} für ${(plan.grossPriceMinor / 100).toLocaleString("de-DE")} € wählen`
                  : "Plan wählen"}
              </XerianoBillingActionButton>
            ) : (
              <button className="xeriano-catalog-plan-action" disabled>Aktuell nicht verfügbar</button>
            )}
          </article>
        );
      })}
    </div>
  );
}

export function XerianoTopUpCatalog({
  showActions,
  billingAvailability,
}: {
  showActions: boolean;
  billingAvailability?: ReturnType<typeof getXerianoStripeAvailability>;
}) {
  const { topUps } = getXerianoCommercialCatalogDto();
  return (
    <div className="xeriano-catalog-topup-grid">
      {topUps.map((topUp) => (
        <article key={topUp.version}>
          <span className="xeriano-topup-icon"><Sparkles aria-hidden="true" /></span>
          <div>
            <strong>{topUp.grantedCredits.toLocaleString("de-DE")} Credits</strong>
            <span>Verfallen nicht</span>
          </div>
          <p>{(topUp.grossPriceMinor / 100).toLocaleString("de-DE")} €</p>
          {showActions ? billingAvailability?.products[`TOPUP_${topUp.grantedCredits}` as keyof typeof billingAvailability.products] ? (
            <XerianoBillingActionButton
              action="CHECKOUT"
              className="xeriano-topup-buy-button"
              productCode={`TOPUP_${topUp.grantedCredits}`}
            >
              {topUp.grantedCredits.toLocaleString("de-DE")} Credits kaufen
            </XerianoBillingActionButton>
          ) : (
            <button className="xeriano-topup-unavailable-button" disabled>Aktuell nicht verfügbar</button>
          ) : null}
        </article>
      ))}
    </div>
  );
}
