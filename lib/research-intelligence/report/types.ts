/**
 * Research Studio report model — Phase 5.6.
 * Presentation layer over UnifiedResearchIntelligence + reasoning + brand intelligence + creative brief.
 */

import { DEFAULT_LOCALE } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";

export const RESEARCH_STUDIO_REPORT_VERSION = "5.6.0";

export type PrioritySignal = "develop" | "watch" | "reject";

export interface ReportPrioritizedOpportunity {
  id: string;
  trend: string;
  brandFit: number;
  trendScore: number;
  commercialPotential: number;
  whyRecommended: string;
  nextStep: string;
  sourceKeys: string[];
  prioritySignal: PrioritySignal;
  productHint: string | null;
  designDirection: string | null;
}

export interface ReportExecutiveNarrative {
  whatFound: string;
  whyInteresting: string;
  milaeneFit: string;
  shouldAct: string;
  fullText: string;
}

export interface ReportSourceTrustEntry {
  sourceKey: string;
  label: string;
  stars: number;
  connected: boolean;
  statusLabel: string;
}

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

export type {
  BrandFitDimension,
  BrandIntelligenceSection,
  LaunchPriority,
  ScoredOpportunity,
} from "../brand-intelligence/types";

export interface ReportScoredOpportunity {
  id: string;
  title: string;
  trendScore: number;
  brandFit: number;
  brandFitTier: string;
  commercialPotential: number;
  competition: number;
  longevity: number;
  originality: number;
  manufacturingDifficulty: number;
  launchPriority: string;
  matches: string[];
  conflicts: string[];
  adjustments: string[];
  reasons: string[];
  sourceKeys: string[];
  rejected: boolean;
  rejectionReasons: string[];
}

export type {
  CreativeBriefScores,
  ResearchCreativeBrief,
} from "../creative-brief/types";

export interface ReportCreativeBrief {
  conceptName: string;
  executiveSummary: string;
  businessCase: string;
  scores: {
    trendScore: number;
    brandFit: number;
    commercialPotential: number;
    competition: number;
    longevity: number;
    originality: number;
  };
  targetAudience: string[];
  recommendedProduct: string;
  alternativeProducts: string[];
  recommendedPlacement: string[];
  typographyDirection: string[];
  graphicDirection: string[];
  colorPalette: string[];
  materialRecommendation: string[];
  printTechnique: string[];
  productionNotes: string;
  avoid: string[];
  researchEvidence: string[];
  nextStep: string;
  anchorOpportunityTitle: string | null;
}

export interface ReportBrandIntelligence {
  brandFitScore: number;
  brandFitTier: string;
  brandFitTierLabel: string;
  reasons: string[];
  matches: string[];
  conflicts: string[];
  recommendedAdjustments: string[];
  dimensionBreakdown: Array<{ id: string; label: string; score: number; rationale: string }>;
  topOpportunities: ReportScoredOpportunity[];
  rejectedOpportunities: ReportScoredOpportunity[];
  summary: string;
  shopifyCatalogLoaded: boolean;
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
  executiveNarrative: ReportExecutiveNarrative | null;
  prioritizedOpportunities: ReportPrioritizedOpportunity[];
  sourceTrust: ReportSourceTrustEntry[];
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
  brandIntelligence: ReportBrandIntelligence | null;
  creativeBrief: ReportCreativeBrief | null;
}

export function emptyResearchStudioReport(
  generatedAt: string = new Date().toISOString(),
): ResearchStudioReport {
  return {
    version: RESEARCH_STUDIO_REPORT_VERSION,
    generatedAt,
    title: getDictionary(DEFAULT_LOCALE).intelligence.report.titleDefault,
    overallConfidence: 0,
    overallTier: "low",
    intelligenceWeak: true,
    caveats: [getDictionary(DEFAULT_LOCALE).intelligence.confidence.noProvidersBaseline],
    executiveSummary: null,
    executiveNarrative: null,
    prioritizedOpportunities: [],
    sourceTrust: [],
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
    brandIntelligence: null,
    creativeBrief: null,
  };
}
