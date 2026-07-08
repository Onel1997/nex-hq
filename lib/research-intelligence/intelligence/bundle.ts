import type { NormalizedProviderIntelligence } from "../normalization/interfaces";
import type { BrandIntelligence } from "../types/brand";
import type { CommercialIntelligence } from "../types/commercial";
import type { MarketIntelligence } from "../types/market";
import type { NormalizedSignal } from "../types/signals";
import type { TrendIntelligence } from "../types/trends";
import {
  emptyBrandIntelligence,
  emptyCommercialIntelligence,
  emptyMarketIntelligence,
  emptyTrendIntelligence,
} from "./domains";

/**
 * Intermediate bundle after normalization, before fusion.
 * One bundle per provider; fusion merges many bundles into unified intelligence.
 */
export interface IntelligenceBundle {
  providers: NormalizedProviderIntelligence[];
  signalCount: number;
  providerCount: number;
}

export function assembleIntelligenceBundle(
  normalized: NormalizedProviderIntelligence[],
): IntelligenceBundle {
  return {
    providers: normalized,
    signalCount: normalized.reduce((sum, item) => sum + item.signals.length, 0),
    providerCount: normalized.length,
  };
}

/** Structural merge helpers — no scoring, weighting, or ranking. */
export function mergeSignals(
  providers: NormalizedProviderIntelligence[],
): NormalizedSignal[] {
  return providers.flatMap((provider) => provider.signals);
}

export function mergeTrendIntelligence(
  slices: TrendIntelligence[],
): TrendIntelligence {
  return {
    rising: slices.flatMap((slice) => slice.rising),
    stable: slices.flatMap((slice) => slice.stable),
    declining: slices.flatMap((slice) => slice.declining),
    emerging: slices.flatMap((slice) => slice.emerging),
    opportunities: [...new Set(slices.flatMap((slice) => slice.opportunities))],
  };
}

export function mergeMarketIntelligence(
  slices: MarketIntelligence[],
): MarketIntelligence {
  return {
    segments: slices.flatMap((slice) => slice.segments),
    movements: slices.flatMap((slice) => slice.movements),
    priceBands: slices.flatMap((slice) => slice.priceBands),
    demandNarratives: [
      ...new Set(slices.flatMap((slice) => slice.demandNarratives)),
    ],
  };
}

export function mergeCommercialIntelligence(
  slices: CommercialIntelligence[],
): CommercialIntelligence {
  return {
    products: slices.flatMap((slice) => slice.products),
    demandIndicators: slices.flatMap((slice) => slice.demandIndicators),
    opportunities: slices.flatMap((slice) => slice.opportunities),
    inventoryNarratives: [
      ...new Set(slices.flatMap((slice) => slice.inventoryNarratives)),
    ],
  };
}

export function mergeBrandIntelligence(
  slices: BrandIntelligence[],
): BrandIntelligence {
  return {
    mentions: slices.flatMap((slice) => slice.mentions),
    momentum: slices.flatMap((slice) => slice.momentum),
    designers: slices.flatMap((slice) => slice.designers),
    culturalSignals: [
      ...new Set(slices.flatMap((slice) => slice.culturalSignals)),
    ],
  };
}

export function mergeDomainSlices(providers: NormalizedProviderIntelligence[]): {
  trends: TrendIntelligence;
  market: MarketIntelligence;
  commercial: CommercialIntelligence;
  brand: BrandIntelligence;
} {
  if (providers.length === 0) {
    return {
      trends: emptyTrendIntelligence(),
      market: emptyMarketIntelligence(),
      commercial: emptyCommercialIntelligence(),
      brand: emptyBrandIntelligence(),
    };
  }

  return {
    trends: mergeTrendIntelligence(providers.map((p) => p.trends)),
    market: mergeMarketIntelligence(providers.map((p) => p.market)),
    commercial: mergeCommercialIntelligence(providers.map((p) => p.commercial)),
    brand: mergeBrandIntelligence(providers.map((p) => p.brand)),
  };
}
