import type { ProviderProvenance } from "./provider-source";

export type BrandSignalType =
  | "mention"
  | "designer"
  | "luxury"
  | "streetwear"
  | "archive"
  | "competitor"
  | "creator";

export interface BrandMention {
  id: string;
  name: string;
  mentionCount: number;
  signalType: BrandSignalType;
  provenance: ProviderProvenance;
}

export interface BrandMomentum {
  id: string;
  name: string;
  narrative: string;
  signalType: BrandSignalType;
  provenance: ProviderProvenance;
}

export interface DesignerSignal {
  id: string;
  designer: string;
  context: string;
  provenance: ProviderProvenance;
}

export interface BrandIntelligence {
  mentions: BrandMention[];
  momentum: BrandMomentum[];
  designers: DesignerSignal[];
  culturalSignals: string[];
}
