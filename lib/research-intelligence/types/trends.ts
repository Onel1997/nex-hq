import type { ProviderProvenance } from "./provider-source";
import type { SignalDirection } from "./signals";

export type TrendHorizon = "immediate" | "seasonal" | "structural";

export type TrendSubjectType =
  | "color"
  | "silhouette"
  | "material"
  | "graphic"
  | "category"
  | "keyword"
  | "aesthetic"
  | "season"
  | "creator"
  | "topic";

export interface TrendObservation {
  id: string;
  subject: string;
  subjectType: TrendSubjectType;
  direction: SignalDirection;
  horizon: TrendHorizon;
  mentionCount?: number;
  changePercent?: number;
  provenance: ProviderProvenance;
}

export interface TrendCluster {
  id: string;
  label: string;
  subjectType: TrendSubjectType;
  observations: TrendObservation[];
  relatedTerms: string[];
}

export interface TrendIntelligence {
  rising: TrendCluster[];
  stable: TrendCluster[];
  declining: TrendCluster[];
  emerging: TrendCluster[];
  opportunities: string[];
}
