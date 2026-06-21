/** Client-safe types for Analytics Chamber — predictive observatory. */

export interface AnalyticsExecutiveMetrics {
  revenue: string;
  orders: number;
  conversionRate: number;
  averageOrderValue: string;
}

export interface AnalyticsAgentPerformance {
  missionsCompleted: number;
  confidenceScore: number;
  activeAgents: number;
  decisionQuality: number;
}

export interface AnalyticsCommerceRow {
  id: string;
  label: string;
  value: string;
  intensity: number;
  direction: "up" | "down" | "flat";
}

export interface AnalyticsCommerceAnalytics {
  products: AnalyticsCommerceRow[];
  categories: AnalyticsCommerceRow[];
  seasonal: AnalyticsCommerceRow[];
}

export interface AnalyticsResearchAnalytics {
  trendConfidence: number;
  opportunities: Array<{ id: string; label: string; detail: string; confidence: number }>;
  competitorActivity: Array<{ id: string; label: string; detail: string; level: "low" | "medium" | "high" }>;
}

export interface AnalyticsNeuralPrediction {
  id: string;
  category: "demand" | "product" | "marketing";
  message: string;
  confidence: number;
}

export interface AnalyticsRadarSignal {
  id: string;
  angle: number;
  distance: number;
  intensity: number;
  label: string;
  kind: "commerce" | "research" | "brain" | "mission" | "forecast";
}

export interface AnalyticsChamberPayload {
  executive: AnalyticsExecutiveMetrics;
  agentPerformance: AnalyticsAgentPerformance;
  commerce: AnalyticsCommerceAnalytics;
  research: AnalyticsResearchAnalytics;
  neuralPredictions: AnalyticsNeuralPrediction[];
  radarSignals: AnalyticsRadarSignal[];
  futureSystems: string[];
  loadedAt: string;
}
