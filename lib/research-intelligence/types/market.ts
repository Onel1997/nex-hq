import type { ProviderProvenance } from "./provider-source";

export type MarketChannel =
  | "owned_commerce"
  | "marketplace"
  | "resale"
  | "social_commerce"
  | "search_demand"
  | "editorial";

export interface PriceBandObservation {
  id: string;
  label: string;
  currency: string;
  min: number;
  max: number;
  sweetSpot?: number;
  channel: MarketChannel;
  provenance: ProviderProvenance;
}

export interface MarketMovement {
  id: string;
  label: string;
  channel: MarketChannel;
  direction: "expanding" | "contracting" | "stable";
  narrative: string;
  provenance: ProviderProvenance;
}

export interface MarketSegment {
  id: string;
  label: string;
  channel: MarketChannel;
  categories: string[];
  provenance: ProviderProvenance;
}

export interface MarketIntelligence {
  segments: MarketSegment[];
  movements: MarketMovement[];
  priceBands: PriceBandObservation[];
  demandNarratives: string[];
}
