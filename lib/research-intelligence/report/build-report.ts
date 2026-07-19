import { rankOpportunityTerms } from "../fusion/weighted-fusion";
import type { BrandIntelligenceSection } from "../brand-intelligence/types";
import type { ResearchCreativeBrief } from "../creative-brief/types";
import { getSourceWeightProfile } from "../confidence/source-weights";
import { isCatalogProductReference } from "../pattern-intelligence/catalog-filter";
import { buildCleanResearchSignalSet } from "../clean-signals";
import { dedupeActionCardsSemantic } from "../clean-signals/semantic-dedup";
import { dedupeStrings } from "./prioritize";
import type { PatternIntelligenceSection } from "../pattern-intelligence/types";
import type { ConfidenceScoreId } from "../types/confidence";
import type { ResearchRecommendation, RecommendationType } from "../types/recommendation";
import type { ResearchReasoningIntelligence } from "../types/reasoning";
import type { UnifiedResearchIntelligence } from "../types/unified";
import {
  buildExecutiveNarrative,
  buildPrioritizedOpportunities,
  buildSourceTrust,
  humanizeInsightDetail,
} from "./prioritize";
import { truncateText, uniqueSourceKeys } from "./formatters";
import { DEFAULT_LOCALE } from "@/lib/i18n/config";
import {
  formatIntelligenceTemplate,
  getIntelligenceCopy,
  roleLabelLocalized,
} from "../copy";
import type {
  ReportActionCard,
  ReportBrandIntelligence,
  ReportBrandLearning,
  ReportCreativeBrief,
  ReportInsight,
  ReportOpportunity,
  ReportPatternIntelligence,
  ReportRecommendationCard,
  ReportRiskCard,
  ReportScoreBlock,
  ReportScoredOpportunity,
  ReportSourceCoverage,
  ResearchStudioReport,
} from "./types";
import { RESEARCH_STUDIO_REPORT_VERSION } from "./types";

export interface BuildResearchReportInput {
  intelligence: UnifiedResearchIntelligence;
  reasoning: ResearchReasoningIntelligence;
  brandIntelligence?: BrandIntelligenceSection | null;
  creativeBrief?: ResearchCreativeBrief | null;
  patternIntelligence?: PatternIntelligenceSection | null;
  title?: string;
  userRequest?: string;
  researchMode?: import("./types").ResearchReportMode;
  providerMode?: import("./types").ResearchProviderMode;
  creativeResearch?: import("../creative-research/types").CreativeResearchReportSection | null;
}

function scoreBlock(
  id: ConfidenceScoreId,
  intelligence: UnifiedResearchIntelligence,
  locale = DEFAULT_LOCALE,
): ReportScoreBlock | null {
  const score = intelligence.confidence.scores[id];
  if (!score) return null;
  if (score.score === 0 && score.evidence.length === 0) return null;

  const copy = getIntelligenceCopy(locale);
  const directionLabels = copy.report.directionLabels;

  return {
    id,
    label: score.label,
    score: score.score,
    tier: score.tier,
    rationale: score.rationale,
    evidence: score.evidence.map((item) =>
      formatIntelligenceTemplate(copy.report.evidenceLine, {
        label: item.label,
        direction: directionLabels[item.direction] ?? item.direction,
        contribution: item.contribution,
      }),
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
      role: roleLabelLocalized(profile.role, DEFAULT_LOCALE),
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
  brandIntelligence: BrandIntelligenceSection | null | undefined,
  weak: boolean,
  cleanSignalSet?: ReturnType<typeof buildCleanResearchSignalSet> | null,
  patternIntelligence?: PatternIntelligenceSection | null,
): string | null {
  const narrative = buildExecutiveNarrative(
    intelligence,
    reasoning,
    brandIntelligence,
    weak,
    cleanSignalSet,
    patternIntelligence,
  );
  if (narrative?.fullText) return narrative.fullText;

  const copy = getIntelligenceCopy(DEFAULT_LOCALE);
  if (weak) {
    return reasoning.narratives[0] ?? copy.report.weakExecutive;
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
  cleanSignalSet: ReturnType<typeof buildCleanResearchSignalSet> | null,
  patternIntelligence?: PatternIntelligenceSection | null,
): ReportInsight[] {
  const copy = getIntelligenceCopy(DEFAULT_LOCALE);
  const insights: ReportInsight[] = [];

  if (cleanSignalSet && cleanSignalSet.summaryLabels.length > 0) {
    insights.push({
      id: "insight-clean-trend",
      headline: copy.insights.trendSignal,
      detail: formatIntelligenceTemplate(copy.reasoning.risingClusters, {
        count: cleanSignalSet.summaryLabels.length,
        terms: `: ${cleanSignalSet.summaryLabels.slice(0, 4).join(", ")}`,
      }),
      sourceKeys: cleanSignalSet.signals
        .flatMap((signal) => signal.sourceKeys)
        .slice(0, 3),
    });
  }

  if (patternIntelligence?.designLanguage.material.length) {
    const materials = patternIntelligence.designLanguage.material.slice(0, 3).join(", ");
    insights.push({
      id: "insight-material",
      headline: "Material-Evidenz",
      detail: `Strukturierte Shopify-Materialsignale: ${materials}.`,
      sourceKeys: ["shopify"],
    });
  }

  if (patternIntelligence?.recommendedSilhouette) {
    insights.push({
      id: "insight-silhouette",
      headline: "Silhouette",
      detail: `Für den Suchauftrag relevante Silhouetten: ${[
        patternIntelligence.recommendedSilhouette,
        ...patternIntelligence.alternativeSilhouettes,
      ]
        .filter(Boolean)
        .slice(0, 3)
        .join(", ")}.`,
      sourceKeys: ["shopify"],
    });
  }

  for (const score of reasoning.scoreEvidence.slice(0, 3)) {
    if (score.score < 35) continue;
    if (/source agreement|quellenübereinstimmung/i.test(score.label) && score.score >= 65) {
      continue;
    }
    insights.push({
      id: `insight-score-${score.scoreId}`,
      headline: score.label,
      detail: humanizeInsightDetail(score.rationale, []),
      sourceKeys: [],
    });
  }

  if (intelligence.confidence.caveats.length > 0) {
    insights.push({
      id: "insight-coverage",
      headline: "Quellenabdeckung",
      detail: intelligence.confidence.caveats[0],
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

  const copy = getIntelligenceCopy(DEFAULT_LOCALE);
  const ranked = rankOpportunityTerms(intelligence).slice(0, 6);
  return ranked.map((term, index) => ({
    id: `opportunity-term-${index}`,
    title: term.term,
    detail: formatIntelligenceTemplate(copy.report.opportunityDetail, {
      score: term.weightedScore,
      sources: term.sourceKeys.length,
    }),
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

function mapScoredOpportunity(opp: BrandIntelligenceSection["topOpportunities"][number]): ReportScoredOpportunity {
  return {
    id: opp.id,
    title: opp.title,
    trendScore: opp.trendScore,
    brandFit: opp.brandFit,
    brandFitTier: opp.brandFitTier,
    commercialPotential: opp.commercialPotential,
    competition: opp.competition,
    longevity: opp.longevity,
    originality: opp.originality,
    manufacturingDifficulty: opp.manufacturingDifficulty,
    launchPriority: opp.launchPriority,
    confidence: opp.confidence,
    matches: opp.matches,
    conflicts: opp.conflicts,
    adjustments: opp.adjustments,
    reasons: opp.reasons,
    sourceKeys: opp.sourceKeys,
    rejected: opp.rejected,
    rejectionReasons: opp.rejectionReasons,
  };
}

function mapBrandIntelligence(
  section: BrandIntelligenceSection | null | undefined,
): ReportBrandIntelligence | null {
  if (!section) return null;

  return {
    brandFitScore: section.brandFitScore,
    brandFitTier: section.brandFitTier,
    brandFitTierLabel: section.brandFitTierLabel,
    reasons: section.reasons,
    matches: section.matches,
    conflicts: section.conflicts,
    recommendedAdjustments: section.recommendedAdjustments,
    dimensionBreakdown: section.dimensionBreakdown,
    topOpportunities: section.topOpportunities.map(mapScoredOpportunity),
    rejectedOpportunities: section.rejectedOpportunities.map(mapScoredOpportunity),
    summary: section.summary,
    shopifyCatalogLoaded: section.shopifyLearning.loaded,
  };
}

function mapCreativeBrief(
  brief: ResearchCreativeBrief | null | undefined,
): ReportCreativeBrief | null {
  if (!brief) return null;

  return {
    conceptName: brief.conceptName,
    executiveSummary: brief.executiveSummary,
    businessCase: brief.businessCase,
    missionStatement: brief.missionStatement,
    scores: brief.scores,
    targetAudience: brief.targetAudience,
    recommendedProduct: brief.recommendedProduct,
    alternativeProducts: brief.alternativeProducts,
    recommendedPlacement: brief.recommendedPlacement,
    typographyDirection: brief.typographyDirection,
    graphicDirection: brief.graphicDirection,
    colorPalette: brief.colorPalette,
    materialRecommendation: brief.materialRecommendation,
    printTechnique: brief.printTechnique,
    productionNotes: brief.productionNotes,
    avoid: brief.avoid,
    researchEvidence: brief.researchEvidence,
    nextStep: brief.nextStep,
    anchorOpportunityTitle: brief.anchorOpportunityTitle,
    designLanguage: brief.designLanguage,
    patternSummary: brief.patternSummary,
  };
}

function mapPatternIntelligence(
  section: PatternIntelligenceSection | null | undefined,
): ReportPatternIntelligence | null {
  if (!section) return null;
  return {
    loaded: section.loaded,
    analyzedProductCount: section.analyzedProductCount,
    patterns: section.patterns.map((pattern) => ({
      dimension: pattern.dimension,
      dimensionLabel: pattern.dimensionLabel,
      traits: pattern.traits,
      evidence: pattern.evidence,
    })),
    successReasons: section.successReasons,
    recommendedSilhouette: section.recommendedSilhouette,
    alternativeSilhouettes: section.alternativeSilhouettes,
  };
}

function mapBrandLearning(
  section: PatternIntelligenceSection | null | undefined,
): ReportBrandLearning[] {
  if (!section?.brandLearning.length) return [];
  return section.brandLearning.map((insight) => ({
    id: insight.id,
    statement:
      insight.status === "unconfirmed"
        ? `Noch nicht ausreichend bestätigt: ${insight.statement}`
        : insight.statement,
    evidence: `${insight.evidenceLevelLabel} — ${insight.evidence}`,
  }));
}

function filterCatalogRecommendations(
  cards: ReportRecommendationCard[],
  catalogTitles: string[],
): ReportRecommendationCard[] {
  const index = catalogTitles;
  return cards.filter((card) => !isCatalogProductReference(card.title, index));
}

function dedupeRecommendationCards(
  cards: ReportRecommendationCard[],
): ReportRecommendationCard[] {
  const seen = new Set<string>();
  return cards.filter((card) => {
    const key = card.title.toLowerCase().replace(/\s+/g, " ").trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function dedupeActionCards(actions: ReportActionCard[]): ReportActionCard[] {
  return dedupeActionCardsSemantic(actions);
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
  const copy = getIntelligenceCopy(DEFAULT_LOCALE);
  const title =
    input.title?.trim() ||
    (weak ? copy.report.titleLimited : copy.report.titleDefault);

  const catalogTitles = input.patternIntelligence?.catalogProductTitles ?? [];
  const cleanSignalSet = buildCleanResearchSignalSet({
    intelligence,
    catalogProductTitles: catalogTitles,
    userRequest: input.userRequest ?? input.title,
  });

  const designDirections = dedupeRecommendationCards(
    filterCatalogRecommendations(
      recommendationsByType(intelligence, "design_direction"),
      catalogTitles,
    ),
  );
  const recommendedProducts = dedupeRecommendationCards(
    filterCatalogRecommendations(
      recommendationsByType(intelligence, "product_opportunity"),
      catalogTitles,
    ),
  );
  const colorPalettes = recommendationsByType(intelligence, "color_palette");
  const typographyCards = recommendationsByType(intelligence, "typography_direction");
  const graphicCards = recommendationsByType(intelligence, "graphic_theme");

  const keyInsights = buildKeyInsights(
    intelligence,
    reasoning,
    cleanSignalSet,
    input.patternIntelligence,
  );
  const topOpportunities = buildTopOpportunities(intelligence);
  const riskWarnings = buildRiskWarnings(intelligence, reasoning);
  const suggestedNextActions = dedupeActionCards(buildSuggestedActions(intelligence));
  const allRecommendationCards = [
    ...designDirections,
    ...recommendedProducts,
    ...colorPalettes,
    ...(typographyCards[0] ? [typographyCards[0]] : []),
    ...(graphicCards[0] ? [graphicCards[0]] : []),
  ];
  const executiveNarrative = buildExecutiveNarrative(
    intelligence,
    reasoning,
    input.brandIntelligence,
    weak,
    cleanSignalSet,
    input.patternIntelligence,
  );
  const prioritizedOpportunities = buildPrioritizedOpportunities(
    intelligence,
    input.brandIntelligence,
    allRecommendationCards,
    input.patternIntelligence,
    input.userRequest ?? input.title,
  );
  const sourceTrust = buildSourceTrust(intelligence);

  const report: ResearchStudioReport = {
    version: RESEARCH_STUDIO_REPORT_VERSION,
    generatedAt: intelligence.generatedAt,
    title,
    researchMode: input.researchMode ?? "trend_intelligence",
    providerMode: input.providerMode ?? "full_intelligence",
    overallConfidence: intelligence.confidence.overallScore,
    overallTier: intelligence.confidence.overall,
    intelligenceWeak: weak,
    caveats: dedupeStrings([
      ...intelligence.confidence.caveats,
      ...reasoning.caveats,
      ...intelligence.recommendations.caveats,
    ]).slice(0, 6),
    executiveSummary: buildExecutiveSummary(
      intelligence,
      reasoning,
      input.brandIntelligence,
      weak,
      cleanSignalSet,
      input.patternIntelligence,
    ),
    executiveNarrative,
    prioritizedOpportunities,
    sourceTrust,
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
    brandIntelligence: mapBrandIntelligence(input.brandIntelligence),
    patternIntelligence: mapPatternIntelligence(input.patternIntelligence),
    brandLearning: mapBrandLearning(input.patternIntelligence),
    creativeBrief: mapCreativeBrief(input.creativeBrief),
    creativeResearch: input.creativeResearch ?? null,
  };

  return report;
}

export function reportHasVisibleSections(report: ResearchStudioReport): boolean {
  return Boolean(
    report.creativeResearch?.designIdeas.length ||
      report.creativeResearch?.collection ||
      report.executiveSummary ||
      report.executiveNarrative ||
      report.prioritizedOpportunities.length > 0 ||
      report.sourceTrust.length > 0 ||
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
      report.suggestedNextActions.length > 0 ||
      report.brandIntelligence !== null ||
      report.patternIntelligence !== null ||
      report.brandLearning.length > 0 ||
      report.creativeBrief !== null,
  );
}
