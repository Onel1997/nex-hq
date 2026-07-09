/**
 * Research Studio report model — Phase 5.3.
 * Presentation layer over UnifiedResearchIntelligence + reasoning + recommendations.
 */

export const RESEARCH_STUDIO_REPORT_VERSION = "5.3.0";

export interface ReportScoreBlock {
  id: string;
  label: string;
  score: number;
  tier: string;
  rationale: string;
  evidence: string[];
}

export interface ReportSourceBadge {
  sourceKey: string;
  label: string;
  role: string;
  weight: number;
  signalCount: number;
  mode: "live" | "simulated";
}

export interface ReportSourceCoverage {
  providerCount: number;
  liveCount: number;
  simulatedCount: number;
  rolesCovered: string[];
  sources: ReportSourceBadge[];
}

export interface ReportInsight {
  id: string;
  headline: string;
  detail: string;
  sourceKeys: string[];
}

export interface ReportOpportunity {
  id: string;
  title: string;
  detail: string;
  confidence: number;
  priority: string;
  sourceKeys: string[];
}

export interface ReportRecommendationCard {
  id: string;
  title: string;
  why: string;
  confidence: number;
  priority: string;
  suggestedNextStep: string;
  evidence: string[];
  sourceKeys: string[];
  risks: string[];
}

export interface ReportRiskCard {
  id: string;
  title: string;
  severity: string;
  reason: string;
  relatedScoreIds: string[];
}

export interface ReportActionCard {
  id: string;
  title: string;
  why: string;
  priority: string;
  suggestedNextStep: string;
}

export interface ResearchStudioReport {
  version: typeof RESEARCH_STUDIO_REPORT_VERSION;
  generatedAt: string;
  title: string;
  overallConfidence: number;
  overallTier: string;
  intelligenceWeak: boolean;
  caveats: string[];
  executiveSummary: string | null;
  trendConfidence: ReportScoreBlock | null;
  commercialConfidence: ReportScoreBlock | null;
  sourceAgreement: ReportScoreBlock | null;
  sourceCoverage: ReportSourceCoverage | null;
  keyInsights: ReportInsight[];
  topOpportunities: ReportOpportunity[];
  designDirections: ReportRecommendationCard[];
  recommendedProducts: ReportRecommendationCard[];
  colorPalettes: ReportRecommendationCard[];
  typographyDirection: ReportRecommendationCard | null;
  graphicThemeDirection: ReportRecommendationCard | null;
  riskWarnings: ReportRiskCard[];
  suggestedNextActions: ReportActionCard[];
}

export function emptyResearchStudioReport(
  generatedAt: string = new Date().toISOString(),
): ResearchStudioReport {
  return {
    version: RESEARCH_STUDIO_REPORT_VERSION,
    generatedAt,
    title: "Research Intelligence Report",
    overallConfidence: 0,
    overallTier: "low",
    intelligenceWeak: true,
    caveats: ["No fused intelligence available."],
    executiveSummary: null,
    trendConfidence: null,
    commercialConfidence: null,
    sourceAgreement: null,
    sourceCoverage: null,
    keyInsights: [],
    topOpportunities: [],
    designDirections: [],
    recommendedProducts: [],
    colorPalettes: [],
    typographyDirection: null,
    graphicThemeDirection: null,
    riskWarnings: [],
    suggestedNextActions: [],
  };
}
