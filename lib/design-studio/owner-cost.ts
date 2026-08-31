import type { XerianoCustomerCreditQuote } from "@/lib/xeriano/customer-generation";

/** Server-only formatting of the versioned EUR estimate stored by economics. */
export function ownerEstimatedCostLabel(quote: XerianoCustomerCreditQuote): string | null {
  const economics = quote.pricingSnapshot.economics;
  if (!economics || typeof economics !== "object") return null;
  const micros = (economics as Record<string, unknown>).providerCostEurMicros;
  if (typeof micros !== "string" || !/^\d+$/.test(micros)) return null;
  const amount = Number(micros) / 1_000_000;
  if (!Number.isFinite(amount)) return null;
  return `ca. ${new Intl.NumberFormat("de-DE", {
    style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(amount)}`;
}
