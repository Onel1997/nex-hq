import type { BrandIntelligence } from "../types/brand";
import type { CommercialIntelligence } from "../types/commercial";
import type { MarketIntelligence } from "../types/market";
import type { TrendIntelligence } from "../types/trends";

export function emptyTrendIntelligence(): TrendIntelligence {
  return {
    rising: [],
    stable: [],
    declining: [],
    emerging: [],
    opportunities: [],
  };
}

export function emptyMarketIntelligence(): MarketIntelligence {
  return {
    segments: [],
    movements: [],
    priceBands: [],
    demandNarratives: [],
  };
}

export function emptyCommercialIntelligence(): CommercialIntelligence {
  return {
    products: [],
    demandIndicators: [],
    opportunities: [],
    inventoryNarratives: [],
  };
}

export function emptyBrandIntelligence(): BrandIntelligence {
  return {
    mentions: [],
    momentum: [],
    designers: [],
    culturalSignals: [],
  };
}

export interface IntelligenceDomainSlices {
  trends: TrendIntelligence;
  market: MarketIntelligence;
  commercial: CommercialIntelligence;
  brand: BrandIntelligence;
}

export function emptyDomainSlices(): IntelligenceDomainSlices {
  return {
    trends: emptyTrendIntelligence(),
    market: emptyMarketIntelligence(),
    commercial: emptyCommercialIntelligence(),
    brand: emptyBrandIntelligence(),
  };
}
