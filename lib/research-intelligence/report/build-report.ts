import { rankOpportunityTerms } from "../fusion/weighted-fusion";
import { getSourceWeightProfile, roleLabel } from "../confidence/source-weights";
import type { ConfidenceScoreId } from "../types/confidence";
import type { ResearchRecommendation, RecommendationType } from "../types/recommendation";
import type { ResearchReasoningIntelligence } from "../types/reasoning";
import type { UnifiedResearchIntelligence } from "../types/unified";
import { truncateText, uniqueSourceKeys } from "./formatters";
import type {
  ReportActionCard,
  ReportInsight,
  ReportOpportunity,
  ReportRecommendationCard,
  ReportRiskCard,
  ReportScoreBlock,
  ReportSourceCoverage,
  ResearchStudioReport,
} from "./types";
import { RESEARCH_STUDIO_REPORT_VERSION } from "./types";

export interface BuildResearchReportInput {
  intelligence: UnifiedResearchIntelligence;
  reasoning: ResearchReasoningIntelligence;
  title?: string;
}

function scoreBlock(
  id: ConfidenceScoreId,
  intelligence: UnifiedResearchIntelligence,
): ReportScoreBlock | null {
  const score = intelligence.confidence.scores[id];
  if (!score) return null;
  if (score.score === 0 && score.evidence.length === 0) return null;

  return {
    id,
    label: score.label,
    score: score.score,
    tier: score.tier,
    rationale: score.rationale,
    evidence: score.evidence.map(
      (item) =>
        `${item.label} (${item.direction}, contribution ${item.contribution})`,
    ),
  };
}

function recommendationCard(rec: ResearchRecommendation): ReportRecommendationCard {
  return {
    id: rec.id,
    title: rec.title,
    why: rec.why,
    confidence: rec.confidence,
    priority: rec.priority,
    suggestedNextStep: rec.suggestedNextStep,
    evidence: rec.evidence.map((item) => item.label),
    sourceKeys: uniqueSourceKeys(rec.sourceSupport.map((item) => item.sourceKey)),
    risks: rec.risks,
  };
}

function recommendationsByType(
  intelligence: UnifiedResearchIntelligence,
  type: RecommendationType,
): ReportRecommendationCard[] {
  return intelligence.recommendations.items
    .filter((item) => item.type === type)
    .map(recommendationCard);
}

function buildSourceCoverage(
  intelligence: UnifiedResearchIntelligence,
): ReportSourceCoverage | null {
  if (intelligence.manifest.providerCount === 0) return null;

  const sources = intelligence.manifest.contributions.map((contribution) => {
    const profile = getSourceWeightProfile(contribution.sourceKey);
    return {
      sourceKey: String(contribution.sourceKey),
      label: profile.label,
      role: roleLabel(profile.role),
      weight: profile.weight,
      signalCount: contribution.signalCount,
      mode: contribution.mode,
    };
  });

  const rolesCovered = [...new Set(sources.map((source) => source.role))];

  return {
    providerCount: intelligence.manifest.providerCount,
    liveCount: intelligence.manifest.liveProviderCount,
    simulatedCount: intelligence.manifest.simulatedProviderCount,
    rolesCovered,
    sources,
  };
}

function buildExecutiveSummary(
  intelligence: UnifiedResearchIntelligence,
  reasoning: ResearchReasoningIntelligence,
  weak: boolean,
): string | null {
  if (weak) {
    return (
      reasoning.narratives[0] ??
      "Intelligence coverage is limited. Expand live sources before committing to creative or commercial direction."
    );
  }

  const parts = [
    reasoning.narratives[0],
    intelligence.recommendations.summary,
    reasoning.brandFit.summary,
  ].filter(Boolean);

  if (parts.length === 0) return null;
  return truncateText(parts.join(" "), 480);
}

function buildKeyInsights(
  intelligence: UnifiedResearchIntelligence,
  reasoning: ResearchReasoningIntelligence,
): ReportInsight[] {
  const insights: ReportInsight[] = [];

  for (const [index, line] of reasoning.trendSignificance.entries()) {
    insights.push({
      id: `insight-trend-${index}`,
      headline: "Trend signal",
      detail: line,
      sourceKeys: reasoning.confirmingSources.slice(0, 3).map((s) => s.sourceKey),
    });
  }

  for (const score of reasoning.scoreEvidence.slice(0, 4)) {
    if (score.score < 35) continue;
    insights.push({
      id: `insight-score-${score.scoreId}`,
      headline: score.label,
      detail: score.rationale,
      sourceKeys: [],
    });
  }

  for (const [index, narrative] of intelligence.market.demandNarratives.slice(0, 2).entries()) {
    insights.push({
      id: `insight-market-${index}`,
      headline: "Market demand",
      detail: narrative,
      sourceKeys: [],
    });
  }

  return insights.slice(0, 8);
}

function buildTopOpportunities(
  intelligence: UnifiedResearchIntelligence,
): ReportOpportunity[] {
  const fromRecommendations = recommendationsByType(
    intelligence,
    "product_opportunity",
  ).map((card) => ({
    id: card.id,
    title: card.title,
    detail: card.why,
    confidence: card.confidence,
    priority: card.priority,
    sourceKeys: card.sourceKeys,
  }));

  if (fromRecommendations.length > 0) {
    return fromRecommendations.slice(0, 6);
  }

  const ranked = rankOpportunityTerms(intelligence).slice(0, 6);
  return ranked.map((term, index) => ({
    id: `opportunity-term-${index}`,
    title: term.term,
    detail: `Weighted opportunity score ${term.weightedScore}/100 across ${term.sourceKeys.length} source(s).`,
    confidence: term.weightedScore,
    priority: term.weightedScore >= 65 ? "monitor" : "explore",
    sourceKeys: term.sourceKeys,
  }));
}

function buildRiskWarnings(
  intelligence: UnifiedResearchIntelligence,
  reasoning: ResearchReasoningIntelligence,
): ReportRiskCard[] {
  const fromRecs = recommendationsByType(intelligence, "risk_warning").map((card) => ({
    id: card.id,
    title: card.title,
    severity: card.priority === "avoid" ? "high" : "medium",
    reason: card.why,
    relatedScoreIds: [],
  }));

  if (fromRecs.length > 0) return fromRecs;

  return reasoning.risks.map((risk) => ({
    id: risk.id,
    title: risk.label,
    severity: risk.severity,
    reason: risk.reason,
    relatedScoreIds: risk.relatedScoreIds,
  }));
}

function buildSuggestedActions(
  intelligence: UnifiedResearchIntelligence,
): ReportActionCard[] {
  const researchActions = recommendationsByType(intelligence, "next_research_action");
  const launchActions = recommendationsByType(intelligence, "launch_timing");

  const actions: ReportActionCard[] = [
    ...researchActions.map((card) => ({
      id: card.id,
      title: card.title,
      why: card.why,
      priority: card.priority,
      suggestedNextStep: card.suggestedNextStep,
    })),
    ...launchActions.map((card) => ({
      id: card.id,
      title: card.title,
      why: card.why,
      priority: card.priority,
      suggestedNextStep: card.suggestedNextStep,
    })),
  ];

  return actions.slice(0, 6);
}

function isWeakIntelligence(intelligence: UnifiedResearchIntelligence): boolean {
  return (
    intelligence.manifest.providerCount === 0 ||
    intelligence.signals.length === 0 ||
    intelligence.confidence.overallScore < 35
  );
}

export function buildResearchReport(input: BuildResearchReportInput): ResearchStudioReport {
  const { intelligence, reasoning } = input;
  const weak = isWeakIntelligence(intelligence);
  const title =
    input.title?.trim() ||
    (weak
      ? "Research Intelligence — Limited Coverage"
      : "Research Intelligence Report");

  const designDirections = recommendationsByType(intelligence, "design_direction");
  const recommendedProducts = recommendationsByType(intelligence, "product_opportunity");
  const colorPalettes = recommendationsByType(intelligence, "color_palette");
  const typographyCards = recommendationsByType(intelligence, "typography_direction");
  const graphicCards = recommendationsByType(intelligence, "graphic_theme");

  const keyInsights = buildKeyInsights(intelligence, reasoning);
  const topOpportunities = buildTopOpportunities(intelligence);
  const riskWarnings = buildRiskWarnings(intelligence, reasoning);
  const suggestedNextActions = buildSuggestedActions(intelligence);

  const report: ResearchStudioReport = {
    version: RESEARCH_STUDIO_REPORT_VERSION,
    generatedAt: intelligence.generatedAt,
    title,
    overallConfidence: intelligence.confidence.overallScore,
    overallTier: intelligence.confidence.overall,
    intelligenceWeak: weak,
    caveats: [
      ...intelligence.confidence.caveats,
      ...reasoning.caveats,
      ...intelligence.recommendations.caveats,
    ],
    executiveSummary: buildExecutiveSummary(intelligence, reasoning, weak),
    trendConfidence: scoreBlock("trend_confidence", intelligence),
    commercialConfidence: scoreBlock("commercial_confidence", intelligence),
    sourceAgreement: scoreBlock("source_agreement", intelligence),
    sourceCoverage: buildSourceCoverage(intelligence),
    keyInsights,
    topOpportunities,
    designDirections,
    recommendedProducts,
    colorPalettes,
    typographyDirection: typographyCards[0] ?? null,
    graphicThemeDirection: graphicCards[0] ?? null,
    riskWarnings,
    suggestedNextActions,
  };

  return report;
}

export function reportHasVisibleSections(report: ResearchStudioReport): boolean {
  return Boolean(
    report.executiveSummary ||
      report.trendConfidence ||
      report.commercialConfidence ||
      report.sourceAgreement ||
      report.sourceCoverage ||
      report.keyInsights.length > 0 ||
      report.topOpportunities.length > 0 ||
      report.designDirections.length > 0 ||
      report.recommendedProducts.length > 0 ||
      report.colorPalettes.length > 0 ||
      report.typographyDirection ||
      report.graphicThemeDirection ||
      report.riskWarnings.length > 0 ||
      report.suggestedNextActions.length > 0,
  );
}
