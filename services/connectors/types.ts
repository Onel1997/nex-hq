import type { DataSourceId } from "@/services/data-sources";

export type ConnectorMode = "live" | "simulated";

export type IntelligenceSignalCategory =
  | "social"
  | "trend"
  | "commerce"
  | "competitor"
  | "consumer";

export interface IntelligenceSignal {
  id: string;
  category: IntelligenceSignalCategory;
  source: DataSourceId;
  label: string;
  message: string;
  score: number;
  direction: "up" | "down" | "stable";
  tags?: string[];
}

export interface SourceIntelligence<T> {
  source: DataSourceId;
  mode: ConnectorMode;
  loadedAt: string;
  signals: IntelligenceSignal[];
  data: T;
}

export interface ConnectorInput {
  keywords?: string[];
  region?: string;
}
