import type { Metadata } from "next";

import { PricingCards } from "@/components/xeriano/pricing-cards";
import { XerianoTopUpCatalog } from "@/components/xeriano/billing-catalog";
import { resolveXerianoAccess } from "@/lib/xeriano/auth";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Free, Creator, Pro, Studio und Max Pläne für Xeriamo.",
  alternates: { canonical: "/pricing" },
};

export default async function PricingPage() {
  const access = await resolveXerianoAccess();
  const authenticatedCustomer = access.status === "AUTHENTICATED" && access.context.role === "CUSTOMER";
  return (
    <main className="xeriano-pricing-page">
      <header><span className="xeriano-eyebrow">Xeriamo Credits</span><h1>Wähle den Plan, der zu deinem Content passt.</h1><p>Klare monatliche Credits für Bilder, Videos und deinen gesamten Workflow.</p></header>
      <PricingCards authenticatedCustomer={authenticatedCustomer} />
      <p className="xeriano-pricing-disclaimer">Die tatsächliche Nutzung hängt vom gewählten Modell und den Einstellungen ab.</p>
      <section className="xeriano-public-topups">
        <header><span className="xeriano-section-label">Flexibel erweitern</span><h2>Flexible Top-ups</h2><p>Top-up Credits verfallen nicht und bleiben getrennt von deinen monatlichen Plan-Credits.</p></header>
        <XerianoTopUpCatalog showActions={false} />
      </section>
    </main>
  );
}
