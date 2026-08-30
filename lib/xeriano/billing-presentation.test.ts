import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import {
  getXerianoCommercialCatalogDto,
  resolveActiveXerianoPlan,
} from "./plans";
import { resolveXerianoBillingReturnState } from "./billing-return";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

test("customer billing presentation uses the exact active launch catalog", () => {
  const catalog = getXerianoCommercialCatalogDto();

  assert.deepEqual(
    catalog.plans.map((plan) => [plan.code, plan.grossPriceMinor, plan.grantedCredits]),
    [
      ["FREE", 0, 30],
      ["CREATOR", 1_900, 700],
      ["PRO", 3_900, 1_400],
      ["STUDIO", 6_900, 2_500],
      ["MAX", 11_900, 4_250],
    ],
  );
  assert.deepEqual(
    catalog.topUps.map((topUp) => [topUp.grantedCredits, topUp.grossPriceMinor, topUp.expires]),
    [[250, 800, false], [500, 1_500, false], [1_000, 2_900, false], [2_500, 7_000, false]],
  );
});

test("current plan resolution is canonical, case-insensitive and fail-closed", () => {
  assert.equal(resolveActiveXerianoPlan("free")?.code, "FREE");
  assert.equal(resolveActiveXerianoPlan(" PRO ")?.grantedCredits, 1_400);
  assert.equal(resolveActiveXerianoPlan(" STUDIO ")?.grantedCredits, 2_500);
  assert.equal(resolveActiveXerianoPlan("LEGACY_UNKNOWN"), null);
  assert.equal(resolveActiveXerianoPlan(null), null);
});

test("public and authenticated plan surfaces share one customer-safe catalog component", () => {
  const publicPricing = read("app/(public)/pricing/page.tsx");
  const authenticatedCredits = read("app/(customer)/app/credits/page.tsx");
  const catalogComponent = read("components/xeriano/billing-catalog.tsx");

  assert.match(publicPricing, /XerianoTopUpCatalog showActions=\{false\}/);
  assert.match(authenticatedCredits, /XerianoPlanCatalog[\s\S]+XerianoTopUpCatalog[\s\S]+showActions/);
  assert.match(catalogComponent, /getXerianoCommercialCatalogDto/);
  assert.doesNotMatch(publicPricing + authenticatedCredits, /\b(?:250|500|1[.,_]000|2[.,_]500) Credits\b/);

  const serialized = JSON.stringify(getXerianoCommercialCatalogDto());
  assert.doesNotMatch(serialized, /providerCost|margin|safetyFloor|stripe/i);
});

test("billing presentation mutates no financial authority and uses product-scoped readiness", () => {
  const billingUi = [
    "components/xeriano/billing-catalog.tsx",
    "app/(customer)/app/credits/page.tsx",
    "app/(customer)/app/account/page.tsx",
    "app/(public)/pricing/page.tsx",
  ].map(read).join("\n");

  assert.match(billingUi, /billingAvailability\?\.products/);
  assert.match(billingUi, /Aktuell nicht verfügbar/);
  assert.match(billingUi, /XerianoBillingActionButton/);
  assert.doesNotMatch(billingUi, /reserveXeriano|commitCredit|grantCredit|checkout\.sessions|stripe\./i);
  assert.doesNotMatch(billingUi, /\/api\/(?:creative-studio|ugc-video-studio)\/generate/);
});

test("public and authenticated plan selection preserve only canonical product intent", () => {
  const pricing = read("app/(public)/pricing/page.tsx");
  const catalog = read("components/xeriano/billing-catalog.tsx");
  const credits = read("app/(customer)/app/credits/page.tsx");
  assert.match(pricing, /authenticatedCustomer/);
  assert.match(catalog, /withXerianoPlanIntent/);
  assert.match(catalog, /intendedProductCode/);
  assert.match(credits, /getXerianoPlanIntentPresentation/);
  assert.match(credits, /Prüfe den Plan und starte den Checkout mit einem ausdrücklichen Klick/);
  assert.doesNotMatch(catalog, /stripePriceId|grossPriceMinor:\s*\d|grantedCredits:\s*\d/);
});

test("account keeps billing compact and links to the authoritative Credits page", () => {
  const account = read("app/(customer)/app/account/page.tsx");
  assert.match(account, /Plan & Abrechnung/);
  assert.match(account, /href="\/app\/credits"/);
  assert.match(account, /summary\.totalAvailable/);
  assert.doesNotMatch(account, /XerianoPlanCatalog|XerianoTopUpCatalog/);
});

test("mobile billing cards remain compact, touch-safe and overflow-safe", () => {
  const css = read("app/xeriano.css");
  assert.match(css, /\.xeriano-catalog-topup-grid\{[^}]*repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(css, /@media\(max-width:900px\)[\s\S]*\.xeriano-catalog-topup-grid\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css, /@media\(max-width:620px\)[\s\S]*\.xeriano-catalog-topup-grid\{grid-template-columns:1fr/);
  assert.match(css, /\.xeriano-catalog-plan-action\{[^}]*min-height:44px/);
  assert.match(css, /\.xeriano-topup-buy-button\{[^}]*min-height:4[46]px[^}]*white-space:nowrap/);
  assert.match(css, /\.xeriano-topup-unavailable-button\{[^}]*min-height:44px/);
  assert.doesNotMatch(css, /\.xeriano-catalog-topup-grid button\{/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
  assert.match(css, /\.xeriano-catalog-topup-grid>article\{min-width:0/);
});

test("all canonical top-ups render active checkout CTAs without handwritten prices", () => {
  const catalog = read("components/xeriano/billing-catalog.tsx");
  assert.match(catalog, /billingAvailability\?\.products\[`TOPUP_\$\{topUp\.grantedCredits\}`/);
  assert.match(catalog, /xeriano-topup-buy-button/);
  assert.match(catalog, /topUp\.grantedCredits\.toLocaleString\("de-DE"\)[\s\S]*Credits kaufen/);
  assert.match(catalog, /xeriano-topup-unavailable-button/);
  assert.doesNotMatch(catalog, /250 Credits kaufen|500 Credits kaufen|1\.000 Credits kaufen|2\.500 Credits kaufen/);
});

test("billing return remains processing until account-scoped grant authority exists", () => {
  assert.deepEqual(resolveXerianoBillingReturnState(null), { status: "PROCESSING", kind: null });
  assert.deepEqual(resolveXerianoBillingReturnState({
    mode: "TOP_UP",
    checkoutStatus: "PAID",
    matchingGrantExists: false,
  }), { status: "PROCESSING", kind: "TOP_UP" });
  assert.deepEqual(resolveXerianoBillingReturnState({
    mode: "SUBSCRIPTION",
    checkoutStatus: "CREATED",
    matchingGrantExists: true,
  }), { status: "PROCESSING", kind: "SUBSCRIPTION" });
});

test("authoritative subscription and top-up grants clear the processing state", () => {
  assert.deepEqual(resolveXerianoBillingReturnState({
    mode: "SUBSCRIPTION",
    checkoutStatus: "COMPLETED",
    matchingGrantExists: true,
  }), { status: "CONFIRMED", kind: "SUBSCRIPTION" });
  assert.deepEqual(resolveXerianoBillingReturnState({
    mode: "TOP_UP",
    checkoutStatus: "PAID",
    matchingGrantExists: true,
  }), { status: "CONFIRMED", kind: "TOP_UP" });

  const page = read("app/(customer)/app/credits/page.tsx");
  const status = read("components/xeriano/billing-return-status.tsx");
  const server = read("lib/xeriano/server.ts");
  assert.match(page, /loadXerianoBillingReturnState\(context\.accountId, query\.session_id\)/);
  assert.match(status, /Credits wurden hinzugefügt\./);
  assert.match(status, /Zahlung bestätigt\./);
  assert.match(status, /router\.refresh\(\)/);
  assert.match(status, /router\.replace\("\/app\/credits", \{ scroll: false \}\)/);
  assert.match(server, /\.eq\("account_id", accountId\)/);
  assert.match(server, /\.eq\("billing_source_id", checkoutSessionId\)/);
  assert.doesNotMatch(status, /session_id|checkoutSessionId|stripePriceId|stripeCustomerId/i);
});

test("billing confirmation presentation has no financial mutation or optimistic grant", () => {
  const implementation = [
    "lib/xeriano/billing-return.ts",
    "components/xeriano/billing-return-status.tsx",
    "app/(customer)/app/credits/page.tsx",
  ].map(read).join("\n");
  assert.doesNotMatch(implementation, /insert\(|update\(|\.rpc\(|grantCredit|reserveXeriano|checkout\.sessions|stripe\./i);
});
