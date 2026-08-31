import {
  nanoBananaUnitPriceUsd,
  NANO_BANANA_PRO_EDIT_MODEL_ID,
  NANO_BANANA_PRO_TEXT_MODEL_ID,
  NANO_BANANA_PRO_PRICING_VERSION,
} from "@/lib/creative-studio/nano-banana-config";
import {
  KLING_V3_PRO_MOTION_CONTROL_MODEL_ID,
  KLING_V3_PRO_MOTION_PRICE_PER_SECOND_USD,
  KLING_V3_PRO_MOTION_PRICING_SOURCE,
  KLING_V3_PRO_MOTION_PRICING_VERSION,
} from "@/lib/ugc-video-studio/kling-motion-config";
import { resolveDesignProviderCost } from "@/lib/design-studio/pricing-config";
import { DESIGN_UTILITY_PRICING_VERSION, resolveDesignUtilityConfig } from "@/lib/design-studio/utility-config";
import {
  XERIANO_COMMERCIAL_CATALOG_VERSION,
  XERIANO_PLAN_VERSIONS,
  XERIANO_TOP_UP_VERSIONS,
} from "@/lib/xeriano/plans";
import {
  quoteXerianoCredits,
  XERIANO_CREDIT_PRICING_VERSION,
  type XerianoCreditQuoteInput,
} from "@/lib/xeriano/pricing";

const MICROS_PER_CURRENCY_UNIT = 1_000_000;
const BPS_SCALE = 10_000;

export const XERIANO_ECONOMIC_POLICY = Object.freeze({
  version: "xeriano-economics-eur-v1",
  currency: "EUR" as const,
  taxBasisPoints: 1_900,
  hardMarginBasisPoints: 5_000,
  targetMarginBasisPoints: 6_500,
  creditIncrement: 5,
  fx: Object.freeze({
    USD_EUR: Object.freeze({
      version: "usd-eur-conservative-parity-v1",
      numerator: 1,
      denominator: 1,
      note: "Conservative V1 assumption; replace only with a versioned OWNER-approved FX policy.",
    }),
  }),
});

export type PricingSafetyStatus =
  | "UNSAFE"
  | "SAFE_BELOW_TARGET"
  | "TARGET_OR_BETTER"
  | "COST_UNVERIFIED"
  | "ECONOMICS_UNVERIFIED";

/** Exact rational used for financial calculations. Both sides are safe integers. */
export type ExactFraction = { numerator: number; denominator: number };

export type PaidCreditSource = {
  id: string;
  kind: "PLAN" | "TOP_UP";
  grossPriceMinor: number;
  currency: "EUR";
  grantedCredits: number;
  active: boolean;
  validFrom?: string;
  validUntil?: string | null;
};

export type ProviderCostQuote = {
  provider: "fal";
  providerModel: string;
  operation: "IMAGE" | "VIDEO";
  billingUnit: "PER_IMAGE" | "PER_SECOND";
  originalCurrency: "USD";
  originalCostMicros: number;
  convertedCostEurMicros: number;
  costVersion: string;
  source: string;
  verified: boolean;
  fxVersion: string;
};

export type PricingEvaluation = {
  configuredCredits: number;
  pricingRuleId: string;
  pricingVersion: string;
  commercialCatalogVersion: string;
  economicPolicyVersion: string;
  taxBasisPoints: number;
  hardMarginBasisPoints: number;
  targetMarginBasisPoints: number;
  provider: string;
  providerModel: string;
  operation: "IMAGE" | "VIDEO";
  providerCostCurrency: "USD";
  providerCostMicros: string;
  providerCostEurMicros: string;
  providerCostVersion: string;
  providerCostSource: string;
  fxVersion: string;
  lowestPaidSourceId: string;
  lowestNetRevenuePerCreditEur: string;
  estimatedNetRevenueEur: string;
  estimatedGrossProfitEur: string;
  estimatedProviderGrossMarginBasisPoints: number;
  minimumRawCredits: string;
  minimumRoundedCredits: number;
  targetRawCredits: string;
  targetRoundedCredits: number;
  safetyStatus: PricingSafetyStatus;
  evaluatedAt: string;
};

function assertSafeInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value)) throw new Error(`${name}_MUST_BE_SAFE_INTEGER`);
}

function decimalStringToMicros(value: string): number {
  if (!/^\d+(?:\.\d+)?$/.test(value)) throw new Error("INVALID_DECIMAL_MONEY");
  const [whole, fraction = ""] = value.split(".");
  const micros = Number(whole!) * MICROS_PER_CURRENCY_UNIT +
    Number((fraction + "000000").slice(0, 6));
  assertSafeInteger(micros, "MONEY_MICROS");
  return micros;
}

function reduceFraction(value: ExactFraction): ExactFraction {
  if (!Number.isSafeInteger(value.numerator) || !Number.isSafeInteger(value.denominator) || value.denominator <= 0) {
    throw new Error("UNSAFE_FINANCIAL_ARITHMETIC");
  }
  let a = Math.abs(value.numerator);
  let b = value.denominator;
  while (b !== 0) [a, b] = [b, a % b];
  if (a === 0) return { numerator: 0, denominator: 1 };
  return { numerator: value.numerator / a, denominator: value.denominator / a };
}

function multiplyFractions(left: ExactFraction, right: ExactFraction): ExactFraction {
  const leftReduced = reduceFraction(left);
  const rightReduced = reduceFraction(right);
  const crossLeft = reduceFraction({ numerator: leftReduced.numerator, denominator: rightReduced.denominator });
  const crossRight = reduceFraction({ numerator: rightReduced.numerator, denominator: leftReduced.denominator });
  return reduceFraction({
    numerator: crossLeft.numerator * crossRight.numerator,
    denominator: crossLeft.denominator * crossRight.denominator,
  });
}

function divideFractions(left: ExactFraction, right: ExactFraction): ExactFraction {
  if (right.numerator <= 0) throw new Error("UNSAFE_FINANCIAL_ARITHMETIC");
  return multiplyFractions(left, { numerator: right.denominator, denominator: right.numerator });
}

function subtractFractions(left: ExactFraction, right: ExactFraction): ExactFraction {
  const divisor = greatestCommonDivisor(left.denominator, right.denominator);
  const leftFactor = right.denominator / divisor;
  const rightFactor = left.denominator / divisor;
  return reduceFraction({
    numerator: left.numerator * leftFactor - right.numerator * rightFactor,
    denominator: left.denominator * leftFactor,
  });
}

function greatestCommonDivisor(left: number, right: number): number {
  let a = Math.abs(left);
  let b = Math.abs(right);
  while (b !== 0) [a, b] = [b, a % b];
  return a;
}

function fractionToDecimal(value: ExactFraction, places = 8): string {
  const negative = value.numerator < 0;
  const absolute = negative ? -value.numerator : value.numerator;
  const whole = Math.floor(absolute / value.denominator);
  let remainder = absolute % value.denominator;
  let decimals = "";
  for (let index = 0; index < places; index += 1) {
    remainder *= 10;
    decimals += String(Math.floor(remainder / value.denominator));
    remainder %= value.denominator;
  }
  return `${negative ? "-" : ""}${whole}.${decimals}`;
}

function ceilFraction(value: ExactFraction): number {
  return Math.floor((value.numerator + value.denominator - 1) / value.denominator);
}

export function roundUpToCreditIncrement(value: number, increment = 5): number {
  if (!Number.isFinite(value) || value < 0 || !Number.isInteger(increment) || increment <= 0) {
    throw new Error("INVALID_CREDIT_ROUNDING_INPUT");
  }
  return Math.ceil(value / increment) * increment;
}

export function classifyPricingSafety(input: {
  providerCostVerified: boolean;
  economicsVerified: boolean;
  marginBasisPoints?: number;
  hardMarginBasisPoints?: number;
  targetMarginBasisPoints?: number;
}): PricingSafetyStatus {
  if (!input.providerCostVerified) return "COST_UNVERIFIED";
  if (!input.economicsVerified || !Number.isInteger(input.marginBasisPoints)) {
    return "ECONOMICS_UNVERIFIED";
  }
  const hard = input.hardMarginBasisPoints ?? XERIANO_ECONOMIC_POLICY.hardMarginBasisPoints;
  const target = input.targetMarginBasisPoints ?? XERIANO_ECONOMIC_POLICY.targetMarginBasisPoints;
  if (input.marginBasisPoints! < hard) return "UNSAFE";
  if (input.marginBasisPoints! < target) return "SAFE_BELOW_TARGET";
  return "TARGET_OR_BETTER";
}

function isEffective(source: PaidCreditSource, at: number): boolean {
  const starts = source.validFrom ? Date.parse(source.validFrom) : Number.NEGATIVE_INFINITY;
  const ends = source.validUntil ? Date.parse(source.validUntil) : Number.POSITIVE_INFINITY;
  return source.active && starts <= at && at < ends;
}

export function activePaidCreditSources(at = Date.now()): PaidCreditSource[] {
  const plans: PaidCreditSource[] = XERIANO_PLAN_VERSIONS
    .filter((plan) => plan.active && plan.grossPriceMinor > 0 && plan.grantedCredits > 0)
    .map((plan) => ({
      id: plan.id,
      kind: "PLAN",
      grossPriceMinor: plan.grossPriceMinor,
      currency: plan.currency,
      grantedCredits: plan.grantedCredits,
      active: plan.active,
      validFrom: plan.validFrom,
      validUntil: plan.validUntil,
    }));
  const topUps: PaidCreditSource[] = XERIANO_TOP_UP_VERSIONS
    .filter((product) => product.active)
    .map((product) => ({
      id: product.id,
      kind: "TOP_UP",
      grossPriceMinor: product.grossPriceMinor,
      currency: product.currency,
      grantedCredits: product.grantedCredits,
      active: product.active,
      validFrom: product.validFrom,
      validUntil: product.validUntil,
    }));
  return [...plans, ...topUps].filter((source) => isEffective(source, at));
}

export function netRevenuePerCredit(
  source: PaidCreditSource,
  taxBasisPoints: number,
): ExactFraction {
  assertSafeInteger(source.grossPriceMinor, "GROSS_PRICE_MINOR");
  assertSafeInteger(source.grantedCredits, "GRANTED_CREDITS");
  assertSafeInteger(taxBasisPoints, "TAX_BASIS_POINTS");
  if (source.grossPriceMinor <= 0 || source.grantedCredits <= 0 || taxBasisPoints < 0) {
    throw new Error("ECONOMICS_UNVERIFIED");
  }
  return reduceFraction({
    numerator: source.grossPriceMinor * BPS_SCALE,
    denominator:
      source.grantedCredits * 100 * (BPS_SCALE + taxBasisPoints),
  });
}

export function resolveLowestPaidNetRevenuePerCredit(input?: {
  sources?: PaidCreditSource[];
  taxBasisPoints?: number | null;
  evaluatedAt?: string;
}): { source: PaidCreditSource; value: ExactFraction } {
  const taxBasisPoints = input?.taxBasisPoints === null
    ? null
    : input?.taxBasisPoints ?? XERIANO_ECONOMIC_POLICY.taxBasisPoints;
  if (taxBasisPoints === null) throw new Error("ECONOMICS_UNVERIFIED");
  const at = input?.evaluatedAt ? Date.parse(input.evaluatedAt) : Date.now();
  if (!Number.isFinite(at)) throw new Error("ECONOMICS_UNVERIFIED");
  const sources = (input?.sources ?? activePaidCreditSources(at)).filter((source) => isEffective(source, at));
  if (!sources.length) throw new Error("ECONOMICS_UNVERIFIED");
  let lowest = { source: sources[0]!, value: netRevenuePerCredit(sources[0]!, taxBasisPoints) };
  for (const source of sources.slice(1)) {
    const value = netRevenuePerCredit(source, taxBasisPoints);
    if (value.numerator * lowest.value.denominator < lowest.value.numerator * value.denominator) {
      lowest = { source, value };
    }
  }
  return lowest;
}

export function resolveProviderCost(
  input: XerianoCreditQuoteInput,
  providerModelOverride?: string,
): ProviderCostQuote | null {
  const fx = XERIANO_ECONOMIC_POLICY.fx.USD_EUR;
  if (input.modelId === "design-background-remove" || input.modelId === "design-upscale") {
    const utility = resolveDesignUtilityConfig(
      input.modelId === "design-background-remove" ? "BACKGROUND_REMOVE" : "UPSCALE",
    );
    return {
      provider: "fal",
      providerModel: providerModelOverride ?? utility.endpoint,
      operation: "IMAGE",
      billingUnit: "PER_IMAGE",
      originalCurrency: "USD",
      originalCostMicros: utility.providerCostUsdMicros,
      convertedCostEurMicros: Math.ceil(utility.providerCostUsdMicros * fx.numerator / fx.denominator),
      costVersion: DESIGN_UTILITY_PRICING_VERSION,
      source: utility.providerCostSource,
      verified: true,
      fxVersion: fx.version,
    };
  }
  if (input.modelId === "ideogram-4" || input.modelId === "recraft-4") {
    const design = resolveDesignProviderCost({
      model: input.designModel,
      quality: input.quality,
      outputMode: input.outputMode,
      aspectRatio: input.aspectRatio,
      resolution: input.resolution,
      count: input.count,
      reference: input.hasReference
        ? { name: "reference", mimeType: "image/png", byteLength: 1 }
        : null,
    });
    return {
      provider: "fal",
      providerModel: providerModelOverride ?? design.providerModel,
      operation: "IMAGE",
      billingUnit: "PER_IMAGE",
      originalCurrency: "USD",
      originalCostMicros: design.totalCostMicros,
      convertedCostEurMicros: Math.ceil(design.totalCostMicros * fx.numerator / fx.denominator),
      costVersion: design.version,
      source: design.source,
      verified: true,
      fxVersion: fx.version,
    };
  }
  if (input.modelId === "nano-banana-pro") {
    const unitMicros = decimalStringToMicros(nanoBananaUnitPriceUsd(input.quality).toString());
    const originalCostMicros = unitMicros * (input.count ?? 1);
    return {
      provider: "fal",
      providerModel:
        providerModelOverride === NANO_BANANA_PRO_TEXT_MODEL_ID
          ? NANO_BANANA_PRO_TEXT_MODEL_ID
          : NANO_BANANA_PRO_EDIT_MODEL_ID,
      operation: "IMAGE",
      billingUnit: "PER_IMAGE",
      originalCurrency: "USD",
      originalCostMicros,
      convertedCostEurMicros:
        Math.ceil(originalCostMicros * fx.numerator / fx.denominator),
      costVersion: NANO_BANANA_PRO_PRICING_VERSION,
      source: "Existing Nano Banana provider cost configuration",
      verified: true,
      fxVersion: fx.version,
    };
  }
  if (input.modelId !== "kling-v3-pro-motion-control") return null;
  if (!Number.isInteger(input.durationSeconds) || input.durationSeconds <= 0) return null;
  const unitMicros = decimalStringToMicros(
    KLING_V3_PRO_MOTION_PRICE_PER_SECOND_USD.toString(),
  );
  const originalCostMicros = unitMicros * input.durationSeconds;
  return {
    provider: "fal",
    providerModel: KLING_V3_PRO_MOTION_CONTROL_MODEL_ID,
    operation: "VIDEO",
    billingUnit: "PER_SECOND",
    originalCurrency: "USD",
    originalCostMicros,
    convertedCostEurMicros:
      Math.ceil(originalCostMicros * fx.numerator / fx.denominator),
    costVersion: KLING_V3_PRO_MOTION_PRICING_VERSION,
    source: KLING_V3_PRO_MOTION_PRICING_SOURCE,
    verified: true,
    fxVersion: fx.version,
  };
}

function recommendedCredits(input: {
  providerCostEurMicros: number;
  marginBasisPoints: number;
  netRevenuePerCredit: ExactFraction;
}): { raw: ExactFraction; rounded: number } {
  const requiredRevenue = divideFractions(
    { numerator: input.providerCostEurMicros, denominator: MICROS_PER_CURRENCY_UNIT },
    { numerator: BPS_SCALE - input.marginBasisPoints, denominator: BPS_SCALE },
  );
  const raw = divideFractions(requiredRevenue, input.netRevenuePerCredit);
  const whole = ceilFraction(raw);
  return {
    raw,
    rounded: roundUpToCreditIncrement(whole, XERIANO_ECONOMIC_POLICY.creditIncrement),
  };
}

export function evaluateGenerationPricing(input: {
  quote: XerianoCreditQuoteInput;
  configuredCredits?: number;
  providerModelOverride?: string;
  taxBasisPoints?: number | null;
  evaluatedAt?: string;
  pricingVersionOverride?: string;
  pricingRuleIdOverride?: string;
}): PricingEvaluation {
  const configuredCredits = input.configuredCredits ?? quoteXerianoCredits(input.quote);
  if (!Number.isInteger(configuredCredits) || configuredCredits <= 0) {
    throw new Error("CUSTOMER_PRICING_UNAVAILABLE");
  }
  const providerCost = resolveProviderCost(input.quote, input.providerModelOverride);
  if (!providerCost?.verified) throw new Error("COST_UNVERIFIED");
  const taxBasisPoints = input.taxBasisPoints === null
    ? null
    : input.taxBasisPoints ?? XERIANO_ECONOMIC_POLICY.taxBasisPoints;
  if (taxBasisPoints === null) throw new Error("ECONOMICS_UNVERIFIED");
  const lowest = resolveLowestPaidNetRevenuePerCredit({
    taxBasisPoints,
    evaluatedAt: input.evaluatedAt,
  });
  const netRevenue = multiplyFractions(lowest.value, { numerator: configuredCredits, denominator: 1 });
  const costEur = reduceFraction({
    numerator: providerCost.convertedCostEurMicros,
    denominator: MICROS_PER_CURRENCY_UNIT,
  });
  const grossProfit = subtractFractions(netRevenue, costEur);
  const margin = divideFractions(grossProfit, netRevenue);
  const marginBasisPoints = Math.floor(margin.numerator * BPS_SCALE / margin.denominator);
  const minimum = recommendedCredits({
    providerCostEurMicros: providerCost.convertedCostEurMicros,
    marginBasisPoints: XERIANO_ECONOMIC_POLICY.hardMarginBasisPoints,
    netRevenuePerCredit: lowest.value,
  });
  const target = recommendedCredits({
    providerCostEurMicros: providerCost.convertedCostEurMicros,
    marginBasisPoints: XERIANO_ECONOMIC_POLICY.targetMarginBasisPoints,
    netRevenuePerCredit: lowest.value,
  });
  const safetyStatus = classifyPricingSafety({
    providerCostVerified: providerCost.verified,
    economicsVerified: true,
    marginBasisPoints,
  });
  const priceRule = input.pricingRuleIdOverride ?? (
    input.quote.modelId === "nano-banana-pro"
      ? "nano-banana-pro-quality-v2"
      : input.quote.modelId === "kling-v3-pro-motion-control"
        ? "kling-v3-motion-per-second-v2"
        : input.quote.modelId === "design-background-remove"
          ? "design-background-remove-v1"
          : input.quote.modelId === "design-upscale"
            ? "design-upscale-2x-v1"
            : "design-generation-v1"
  );
  return {
    configuredCredits,
    pricingRuleId: priceRule,
    pricingVersion: input.pricingVersionOverride ?? XERIANO_CREDIT_PRICING_VERSION,
    commercialCatalogVersion: XERIANO_COMMERCIAL_CATALOG_VERSION,
    economicPolicyVersion: XERIANO_ECONOMIC_POLICY.version,
    taxBasisPoints,
    hardMarginBasisPoints: XERIANO_ECONOMIC_POLICY.hardMarginBasisPoints,
    targetMarginBasisPoints: XERIANO_ECONOMIC_POLICY.targetMarginBasisPoints,
    provider: providerCost.provider,
    providerModel: providerCost.providerModel,
    operation: providerCost.operation,
    providerCostCurrency: providerCost.originalCurrency,
    providerCostMicros: providerCost.originalCostMicros.toString(),
    providerCostEurMicros: providerCost.convertedCostEurMicros.toString(),
    providerCostVersion: providerCost.costVersion,
    providerCostSource: providerCost.source,
    fxVersion: providerCost.fxVersion,
    lowestPaidSourceId: lowest.source.id,
    lowestNetRevenuePerCreditEur: fractionToDecimal(lowest.value),
    estimatedNetRevenueEur: fractionToDecimal(netRevenue),
    estimatedGrossProfitEur: fractionToDecimal(grossProfit),
    estimatedProviderGrossMarginBasisPoints: marginBasisPoints,
    minimumRawCredits: fractionToDecimal(minimum.raw),
    minimumRoundedCredits: minimum.rounded,
    targetRawCredits: fractionToDecimal(target.raw),
    targetRoundedCredits: target.rounded,
    safetyStatus,
    evaluatedAt: input.evaluatedAt ?? new Date().toISOString(),
  };
}

export function assertPricingActivationAllowed(evaluation: PricingEvaluation): void {
  if (evaluation.safetyStatus === "UNSAFE") throw new Error("UNSAFE_PRICING_ACTIVATION");
  if (evaluation.safetyStatus === "COST_UNVERIFIED") throw new Error("COST_UNVERIFIED");
  if (evaluation.safetyStatus === "ECONOMICS_UNVERIFIED") throw new Error("ECONOMICS_UNVERIFIED");
}

export function pricingEvaluationSnapshot(evaluation: PricingEvaluation) {
  return Object.freeze({ ...evaluation });
}
