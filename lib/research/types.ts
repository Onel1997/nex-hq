/** Structured design brief — Research HQ → Design Studio handoff. */
export interface ResearchDesignBrief {
  collectionIdea: string;
  productSuggestions: string[];
  recommendedProducts?: string[];
  recommendedColors?: string[];
  recommendedMaterials?: string[];
  recommendedPrintAreas?: string[];
  targetAudience: string;
  colorPalette: Array<{ name: string; hex?: string; role: string }>;
  styleDirection: string;
  silhouettes: string[];
  designs?: string[];
  trendScore: number;
  socialScore?: number;
  demandScore?: number;
  competitorScore: number;
  confidence: number;
  connectorScores?: {
    socialScore?: number;
    demandScore?: number;
    trendScore?: number;
    confidence?: number;
  };
  intelligenceMode?: "live" | "simulated";
  priority?: string;
  rationale: string;
  opportunityId?: string;
  sourceReportId?: string;
  generatedAt: string;
}

export interface TrendDimension {
  label: string;
  change: number;
  direction: "up" | "down" | "stable";
  dnaMatch: number;
}

export interface TrendIntelligence {
  colors: TrendDimension[];
  silhouettes: TrendDimension[];
  materials: TrendDimension[];
  graphics: TrendDimension[];
  seasons: TrendDimension[];
  rising: TrendDimension[];
  declining: TrendDimension[];
  newOpportunities: string[];
}
