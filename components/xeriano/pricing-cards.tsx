import { XerianoPlanCatalog } from "@/components/xeriano/billing-catalog";

export function PricingCards({ authenticatedCustomer = false }: { authenticatedCustomer?: boolean }) {
  return (
    <>
      <p className="xeriano-billing-note">Monatliche Abrechnung · inklusive anwendbarer Steuern</p>
      <XerianoPlanCatalog authenticatedCustomer={authenticatedCustomer} mode="PUBLIC" />
    </>
  );
}
