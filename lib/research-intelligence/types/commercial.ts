import type { ProviderProvenance } from "./provider-source";

export type CommercialSignalStrength = "weak" | "moderate" | "strong";

export interface ProductInsight {
  id: string;
  title: string;
  brand?: string;
  category?: string;
  price?: number;
  currency?: string;
  status?: string;
  provenance: ProviderProvenance;
}

export interface DemandIndicator {
  id: string;
  label: string;
  narrative: string;
  strength: CommercialSignalStrength;
  provenance: ProviderProvenance;
}

export interface CommercialOpportunity {
  id: string;
  title: string;
  rationale: string;
  tags: string[];
  provenance: ProviderProvenance;
}

export interface CommercialIntelligence {
  products: ProductInsight[];
  demandIndicators: DemandIndicator[];
  opportunities: CommercialOpportunity[];
  inventoryNarratives: string[];
}
