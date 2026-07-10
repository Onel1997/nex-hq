/**
 * Brand Intelligence Engine — Phase 2 types.
 * Milaene Brand Fit scoring layer between Fusion and Final Report.
 */

export const BRAND_INTELLIGENCE_VERSION = "2.0.0";

export type LaunchPriority = "A" | "B" | "C" | "D";

export type BrandFitTier =
  | "perfect"
  | "excellent"
  | "good"
  | "weak"
  | "reject";

export interface BrandFitDimension {
  id: string;
  label: string;
  score: number;
  rationale: string;
}

export interface ScoredOpportunity {
  id: string;
  title: string;
  trendScore: number;
  brandFit: number;
  brandFitTier: BrandFitTier;
  commercialPotential: number;
  competition: number;
  longevity: number;
  originality: number;
  manufacturingDifficulty: number;
  launchPriority: LaunchPriority;
  matches: string[];
  conflicts: string[];
  adjustments: string[];
  reasons: string[];
  sourceKeys: string[];
  rejected: boolean;
  rejectionReasons: string[];
}

export interface ShopifyLearningContext {
  loaded: boolean;
  productCount: number;
  bestsellerTitles: string[];
  collectionNames: string[];
  tags: string[];
  materials: string[];
  titles: string[];
  /** Architecture hooks — populated when Shopify performance APIs are connected */
  futureMetrics: {
    sales: boolean;
    ctr: boolean;
    conversion: boolean;
    returns: boolean;
    roas: boolean;
    favorites: boolean;
  };
}

export interface BrandIntelligenceSection {
  version: typeof BRAND_INTELLIGENCE_VERSION;
  generatedAt: string;
  brandFitScore: number;
  brandFitTier: BrandFitTier;
  brandFitTierLabel: string;
  reasons: string[];
  matches: string[];
  conflicts: string[];
  recommendedAdjustments: string[];
  dimensionBreakdown: BrandFitDimension[];
  topOpportunities: ScoredOpportunity[];
  rejectedOpportunities: ScoredOpportunity[];
  shopifyLearning: ShopifyLearningContext;
  summary: string;
}

export interface BrandIntelligenceEngineInput {
  intelligence: import("../types/unified").UnifiedResearchIntelligence;
  reasoning: import("../types/reasoning").ResearchReasoningIntelligence;
  generatedAt?: string;
}

export interface BrandIntelligenceEngineResult {
  intelligence: import("../types/unified").UnifiedResearchIntelligence;
  brandIntelligence: BrandIntelligenceSection;
}
