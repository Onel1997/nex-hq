import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import {
  activePaidCreditSources,
  assertPricingActivationAllowed,
  classifyPricingSafety,
  evaluateGenerationPricing,
  netRevenuePerCredit,
  pricingEvaluationSnapshot,
  resolveLowestPaidNetRevenuePerCredit,
  roundUpToCreditIncrement,
  XERIANO_ECONOMIC_POLICY,
} from "./pricing-engine";
import {
  XERIANO_FUTURE_VIDEO_PRICE_TARGETS,
  XERIANO_NANO_DESIRED_DRAFT,
  getCustomerPublishedPricingDto,
  quoteXerianoCredits,
} from "./pricing";
import {
  XERIANO_PLAN_VERSIONS,
  XERIANO_TOP_UP_VERSIONS,
  XERIANO_TRIAL,
} from "./plans";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");
const evaluatedAt = "2026-08-30T14:00:00.000Z";

test("launch commercial catalog contains only approved monthly plan economics", () => {
  assert.deepEqual(
    XERIANO_PLAN_VERSIONS.map((plan) => [plan.code, plan.grossPriceMinor, plan.grantedCredits]),
    [["FREE", 0, 30], ["CREATOR", 1900, 700], ["PRO", 3900, 1400], ["STUDIO", 6900, 2500], ["MAX", 11900, 4250]],
  );
  assert.equal(XERIANO_PLAN_VERSIONS.every((plan) => plan.billingInterval === "NONE" || plan.billingInterval === "MONTHLY"), true);
  assert.equal(XERIANO_TRIAL.credits, 30);
  assert.equal(XERIANO_TRIAL.commercialValueAuthority, false);
});

test("launch top-ups are versioned, active and non-expiring", () => {
  assert.deepEqual(
    XERIANO_TOP_UP_VERSIONS.map((product) => [product.grantedCredits, product.grossPriceMinor]),
    [[250, 800], [500, 1500], [1000, 2900], [2500, 7000]],
  );
  assert.equal(XERIANO_TOP_UP_VERSIONS.every((product) => product.active && !product.expires), true);
});

test("lowest paid net credit value is derived across paid plans and top-ups", () => {
  const sources = activePaidCreditSources();
  assert.equal(sources.length, 8);
  assert.equal(sources.some((source) => source.id.startsWith("free-")), false);
  const lowest = resolveLowestPaidNetRevenuePerCredit();
  assert.equal(lowest.source.id, "creator-monthly-launch-v2");
  assert.deepEqual(lowest.value, { numerator: 19, denominator: 833 });
  assert.deepEqual(netRevenuePerCredit(sources.find((source) => source.id === "topup-2500-launch-v1")!, 1900), { numerator: 2, denominator: 85 });
});

test("inactive sources are excluded and the minimum is selected dynamically", () => {
  const result = resolveLowestPaidNetRevenuePerCredit({
    taxBasisPoints: 1900,
    sources: [
      { id: "inactive-cheap", kind: "PLAN", grossPriceMinor: 1, currency: "EUR", grantedCredits: 1000, active: false },
      { id: "paid-a", kind: "PLAN", grossPriceMinor: 1000, currency: "EUR", grantedCredits: 100, active: true },
      { id: "paid-b", kind: "TOP_UP", grossPriceMinor: 1800, currency: "EUR", grantedCredits: 200, active: true },
    ],
  });
  assert.equal(result.source.id, "paid-b");
  assert.throws(() => resolveLowestPaidNetRevenuePerCredit({ sources: [], taxBasisPoints: 1900 }), /ECONOMICS_UNVERIFIED/);
  assert.throws(() => resolveLowestPaidNetRevenuePerCredit({ taxBasisPoints: null }), /ECONOMICS_UNVERIFIED/);
});

test("margin classification has exact hard and target boundaries", () => {
  assert.equal(classifyPricingSafety({ providerCostVerified: false, economicsVerified: true, marginBasisPoints: 9000 }), "COST_UNVERIFIED");
  assert.equal(classifyPricingSafety({ providerCostVerified: true, economicsVerified: false }), "ECONOMICS_UNVERIFIED");
  assert.equal(classifyPricingSafety({ providerCostVerified: true, economicsVerified: true, marginBasisPoints: 4999 }), "UNSAFE");
  assert.equal(classifyPricingSafety({ providerCostVerified: true, economicsVerified: true, marginBasisPoints: 5000 }), "SAFE_BELOW_TARGET");
  assert.equal(classifyPricingSafety({ providerCostVerified: true, economicsVerified: true, marginBasisPoints: 6499 }), "SAFE_BELOW_TARGET");
  assert.equal(classifyPricingSafety({ providerCostVerified: true, economicsVerified: true, marginBasisPoints: 6500 }), "TARGET_OR_BETTER");
});

test("clean credit rounding is deterministic and never rounds down", () => {
  assert.equal(roundUpToCreditIncrement(9.01, 5), 10);
  assert.equal(roundUpToCreditIncrement(10, 5), 10);
  assert.equal(roundUpToCreditIncrement(11.1, 5), 15);
  assert.equal(roundUpToCreditIncrement(31.2, 5), 35);
});

test("Nano desired 10-credit price is preserved as an inactive UNSAFE draft", () => {
  assert.equal(XERIANO_NANO_DESIRED_DRAFT.configuredCredits, 10);
  assert.equal(XERIANO_NANO_DESIRED_DRAFT.active, false);
  const evaluation = evaluateGenerationPricing({
    quote: { modelId: "nano-banana-pro", quality: "1K" },
    configuredCredits: 10,
    evaluatedAt,
  });
  assert.equal(evaluation.providerCostMicros, "150000");
  assert.equal(evaluation.providerCostVersion, "fal-public-pricing-2026-08-27");
  assert.equal(evaluation.estimatedNetRevenueEur, "0.22809123");
  assert.equal(evaluation.estimatedProviderGrossMarginBasisPoints, 3423);
  assert.equal(evaluation.minimumRawCredits, "13.15263157");
  assert.equal(evaluation.minimumRoundedCredits, 15);
  assert.equal(evaluation.targetRoundedCredits, 20);
  assert.equal(evaluation.safetyStatus, "UNSAFE");
  assert.throws(() => assertPricingActivationAllowed(evaluation), /UNSAFE_PRICING_ACTIVATION/);
});

test("OWNER-approved Nano 15/30 and current Kling pricing remain safe and server authoritative", () => {
  const nano = evaluateGenerationPricing({ quote: { modelId: "nano-banana-pro", quality: "1K" }, evaluatedAt });
  assert.equal(nano.configuredCredits, 15);
  assert.equal(nano.estimatedNetRevenueEur, "0.34213685");
  assert.equal(nano.estimatedGrossProfitEur, "0.19213685");
  assert.equal(nano.estimatedProviderGrossMarginBasisPoints, 5615);
  assert.equal(nano.safetyStatus, "SAFE_BELOW_TARGET");
  assert.equal(nano.minimumRoundedCredits, 15);
  assert.equal(nano.targetRoundedCredits, 20);
  assert.doesNotThrow(() => assertPricingActivationAllowed(nano));

  const nano4k = evaluateGenerationPricing({ quote: { modelId: "nano-banana-pro", quality: "4K" }, evaluatedAt });
  assert.equal(nano4k.configuredCredits, 30);
  assert.equal(nano4k.estimatedNetRevenueEur, "0.68427370");
  assert.equal(nano4k.estimatedGrossProfitEur, "0.38427370");
  assert.equal(nano4k.estimatedProviderGrossMarginBasisPoints, 5615);
  assert.equal(nano4k.safetyStatus, "SAFE_BELOW_TARGET");
  assert.equal(nano4k.minimumRoundedCredits, 30);
  assert.equal(nano4k.targetRoundedCredits, 40);

  const kling = evaluateGenerationPricing({ quote: { modelId: "kling-v3-pro-motion-control", durationSeconds: 5 }, evaluatedAt });
  assert.equal(kling.configuredCredits, 125);
  assert.equal(kling.providerCostMicros, "840000");
  assert.equal(kling.estimatedNetRevenueEur, "2.85114045");
  assert.equal(kling.estimatedProviderGrossMarginBasisPoints, 7053);
  assert.equal(kling.minimumRoundedCredits, 75);
  assert.equal(kling.targetRoundedCredits, 110);
  assert.equal(kling.safetyStatus, "TARGET_OR_BETTER");
  assert.equal(quoteXerianoCredits({ modelId: "kling-v3-pro-motion-control", durationSeconds: 5 }), 125);
});

test("pricing snapshots retain immutable versioned economic provenance", () => {
  const evaluation = evaluateGenerationPricing({ quote: { modelId: "nano-banana-pro", quality: "2K" }, evaluatedAt });
  const snapshot = pricingEvaluationSnapshot(evaluation);
  assert.equal(Object.isFrozen(snapshot), true);
  assert.equal(snapshot.pricingVersion, "xeriano-generation-pricing-v2-economy");
  assert.equal(snapshot.commercialCatalogVersion, "xeriano-commercial-launch-v2-plan-hierarchy");
  assert.equal(snapshot.economicPolicyVersion, "xeriano-economics-eur-v1");
  assert.equal(snapshot.providerCostVersion, "fal-public-pricing-2026-08-27");
  assert.equal(snapshot.fxVersion, "usd-eur-conservative-parity-v1");
});

test("customer pricing DTO redacts provider costs, margin and economic assumptions", () => {
  const dto = JSON.stringify(getCustomerPublishedPricingDto());
  assert.doesNotMatch(dto, /providerCost|margin|taxBasis|fxVersion|minimumSafe/i);
  assert.match(dto, /creditsByQuality/);
  assert.match(dto, /creditsPerSecond/);
  assert.doesNotMatch(read("lib/xeriano/pricing.ts"), /fal-ai\/|bytedance\//);
});

test("future business video labels are inactive targets and never falsely mapped", () => {
  assert.equal(XERIANO_FUTURE_VIDEO_PRICE_TARGETS.every((target) => target.mappedModelId === null), true);
  assert.equal(XERIANO_FUTURE_VIDEO_PRICE_TARGETS.some((target) => target.businessLabel.startsWith("Veo")), true);
  assert.equal(XERIANO_FUTURE_VIDEO_PRICE_TARGETS.some((target) => target.businessLabel.startsWith("Seedance 2.0")), true);
});

test("additive economy migrations are strict, versioned and do not weaken customer RLS", () => {
  const commercial = read("supabase/migrations/20260830120000_xeriano_commercial_economy_v1.sql");
  const generation = read("supabase/migrations/20260830121000_xeriano_generation_economics_v1.sql");
  assert.match(commercial, /xeriano_plan_versions/);
  assert.match(commercial, /xeriano_topup_product_versions/);
  assert.match(commercial, /tax_basis_points/);
  assert.match(commercial, /trial:v2[^]*30/);
  assert.match(commercial, /topup_product_version_id[^]*expires_at is null/);
  assert.match(generation, /xeriano_provider_cost_rules/);
  assert.match(generation, /xeriano_generation_pricing_rules/);
  assert.match(generation, /xeriano_provider_cost_events/);
  assert.match(commercial, /VERSIONED_ECONOMIC_RECORD_IMMUTABLE/);
  assert.match(generation, /nano-banana-pro-standard-owner-draft-10[^]*false,true,false,'UNSAFE'/);
  for (const sql of [commercial, generation]) {
    assert.doesNotMatch(sql, /using\s*\(\s*true\s*\)/i);
    assert.match(sql, /revoke all[^]*from public,anon,authenticated/i);
  }
});

test("plan hierarchy V2 preserves V1 history and activates only the corrected identities", () => {
  const migration = read("supabase/migrations/20260830160000_xeriano_final_plan_hierarchy_v2.sql");
  assert.match(migration, /catalog_version='xeriano-commercial-launch-v1' and active/);
  assert.match(migration, /'PRO','pro-monthly-v3','Pro',true,'LAUNCH',3900[^]*1400,2,2/);
  assert.match(migration, /'STUDIO','studio-monthly-v2','Studio',true,'LAUNCH',6900[^]*2500,2,2/);
  assert.match(migration, /xeriano_plan_versions_one_active_per_code_idx/);
  assert.match(migration, /mapping\.product_kind='SUBSCRIPTION'[^]*active=false|set active=false[^]*mapping\.product_kind='SUBSCRIPTION'/);
  assert.doesNotMatch(migration, /update public\.xeriano_credit_(?:buckets|ledger)|delete from public\.xeriano_credit_(?:buckets|ledger)/);
  assert.doesNotMatch(migration, /update public\.xeriano_credit_reservations|update public\.xeriano_generation_claims/);
  assert.match(migration, /trial:v2[^]*30,30/);
});

test("wallet summary remains derived from buckets with no second mutable wallet", () => {
  const server = read("lib/xeriano/server.ts");
  const migrations = read("supabase/migrations/20260830120000_xeriano_commercial_economy_v1.sql") +
    read("supabase/migrations/20260830121000_xeriano_generation_economics_v1.sql");
  assert.match(server, /totalAvailable/);
  assert.match(server, /trialCredits/);
  assert.match(server, /subscriptionCredits/);
  assert.match(server, /topUpCredits/);
  assert.match(server, /reservedCredits/);
  assert.doesNotMatch(migrations, /create table[^;]*xeriano_credit_wallets/i);
});

test("financial calculations use integer money, exact rationals and basis points", () => {
  const source = read("lib/xeriano/pricing-engine.ts");
  assert.match(source, /grossPriceMinor/);
  assert.match(source, /taxBasisPoints/);
  assert.match(source, /ExactFraction/);
  assert.doesNotMatch(source, /parseFloat|toFixed\(/);
  assert.equal(XERIANO_ECONOMIC_POLICY.hardMarginBasisPoints, 5000);
  assert.equal(XERIANO_ECONOMIC_POLICY.targetMarginBasisPoints, 6500);
});
