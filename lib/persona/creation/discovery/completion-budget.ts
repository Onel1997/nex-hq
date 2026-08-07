/**
 * Phase 2.2A — Discovery Completion Budget.
 * User confirms MAXIMUM spend once; auto-replacements stay inside the cap.
 */

import {
  DEFAULT_DISCOVERY_ATTEMPTS_PER_SLOT,
  FAL_FLUX_IMAGE_COST_EUR_MIN,
  FAL_FLUX_IMAGE_COST_EUR_MAX,
  type DiscoveryProviderId,
  discoveryProviderDisplayName,
} from "../provider/discovery-provider-config";
import {
  OPENAI_IMAGE_COST_EUR_MIN,
  OPENAI_IMAGE_COST_EUR_MAX,
} from "../provider/cost";

export type DiscoveryCompletionBudget = {
  providerId: DiscoveryProviderId;
  providerDisplayName: string;
  providerModel: string;
  slotCount: number;
  maxAttemptsPerSlot: number;
  estimatedInitialCostEur: number;
  authorizedMaxCostEur: number;
  estimatedUnitMinEur: number;
  estimatedUnitMaxEur: number;
  costStatus: "estimated";
  confirmationRequired: true;
  confirmationMessage: string;
};

export type DiscoveryBudgetLedger = {
  estimatedInitialCostEur: number;
  authorizedMaxCostEur: number;
  actualProviderCostEur: number;
  attemptsUsed: number;
  remainingAuthorizedAttempts: number;
  maxAttemptsPerSlot: number;
  costStatus: "estimated" | "provider_confirmed" | "unknown" | "allocated_estimate";
};

export function unitCostBand(providerId: DiscoveryProviderId): {
  min: number;
  max: number;
} {
  if (providerId === "fal_flux") {
    return { min: FAL_FLUX_IMAGE_COST_EUR_MIN, max: FAL_FLUX_IMAGE_COST_EUR_MAX };
  }
  if (providerId === "openai") {
    return { min: OPENAI_IMAGE_COST_EUR_MIN, max: OPENAI_IMAGE_COST_EUR_MAX };
  }
  // fake / test provider — non-zero estimated band so budget math stays valid
  return { min: 0.01, max: 0.02 };
}

export function buildDiscoveryCompletionBudget(input: {
  providerId: DiscoveryProviderId;
  providerModel: string;
  slotCount?: number;
  maxAttemptsPerSlot?: number;
}): DiscoveryCompletionBudget {
  const slotCount = input.slotCount ?? 4;
  const maxAttemptsPerSlot =
    input.maxAttemptsPerSlot ?? DEFAULT_DISCOVERY_ATTEMPTS_PER_SLOT;
  const band = unitCostBand(input.providerId);
  const mid = (band.min + band.max) / 2;
  const estimatedInitialCostEur = Number((slotCount * mid).toFixed(4));
  const authorizedMaxCostEur = Number(
    (slotCount * maxAttemptsPerSlot * mid).toFixed(4),
  );
  const providerDisplayName = discoveryProviderDisplayName(input.providerId);
  const confirmationMessage =
    `Generate ${slotCount} discovery faces.\n` +
    `Automatically replace candidates rejected by biological face protection, ` +
    `up to ${maxAttemptsPerSlot} attempts per slot.\n` +
    `Provider: ${providerDisplayName} (${input.providerModel}).\n` +
    `Maximum authorized provider spend: €${authorizedMaxCostEur.toFixed(2)} ` +
    `(estimated; not billing-confirmed).`;

  return {
    providerId: input.providerId,
    providerDisplayName,
    providerModel: input.providerModel,
    slotCount,
    maxAttemptsPerSlot,
    estimatedInitialCostEur,
    authorizedMaxCostEur,
    estimatedUnitMinEur: band.min,
    estimatedUnitMaxEur: band.max,
    costStatus: "estimated",
    confirmationRequired: true,
    confirmationMessage,
  };
}

export function createBudgetLedger(
  budget: DiscoveryCompletionBudget,
): DiscoveryBudgetLedger {
  return {
    estimatedInitialCostEur: budget.estimatedInitialCostEur,
    authorizedMaxCostEur: budget.authorizedMaxCostEur,
    actualProviderCostEur: 0,
    attemptsUsed: 0,
    remainingAuthorizedAttempts: budget.slotCount * budget.maxAttemptsPerSlot,
    maxAttemptsPerSlot: budget.maxAttemptsPerSlot,
    costStatus: "estimated",
  };
}

export function canSpendAttempt(
  ledger: DiscoveryBudgetLedger,
  unitCostEur: number,
): boolean {
  if (ledger.remainingAuthorizedAttempts <= 0) return false;
  const next = ledger.actualProviderCostEur + unitCostEur;
  // Never exceed confirmed maximum (use small epsilon for float).
  return next <= ledger.authorizedMaxCostEur + 1e-9;
}

export function recordAttemptSpend(
  ledger: DiscoveryBudgetLedger,
  unitCostEur: number,
): DiscoveryBudgetLedger {
  if (!canSpendAttempt(ledger, unitCostEur)) {
    throw new Error("discovery_budget_exceeded");
  }
  return {
    ...ledger,
    actualProviderCostEur: Number(
      (ledger.actualProviderCostEur + unitCostEur).toFixed(4),
    ),
    attemptsUsed: ledger.attemptsUsed + 1,
    remainingAuthorizedAttempts: Math.max(0, ledger.remainingAuthorizedAttempts - 1),
  };
}
