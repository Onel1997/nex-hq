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
  /** 0–100 confidence derived from sample size and live vs simulated mode */
  confidence?: number;
}

export interface ConnectorIntelligenceScores {
  socialScore: number;
  demandScore: number;
  trendScore: number;
  confidence: number;
}

export interface SourceIntelligence<T> {
  source: DataSourceId;
  mode: ConnectorMode;
  loadedAt: string;
  signals: IntelligenceSignal[];
  data: T;
  scores?: ConnectorIntelligenceScores;
}

export interface ConnectorInput {
  keywords?: string[];
  region?: string;
}
