import "server-only";

import { DEFAULT_LOCALE } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";

import { rankOpportunityTerms, rankTrendClusters } from "../fusion/weighted-fusion";
import type { RecommendationType } from "../types/recommendation";
import type { UnifiedResearchIntelligence } from "../types/unified";
import type { ResearchReasoningIntelligence } from "../types/reasoning";
import {
  BRAND_FIT_THRESHOLD,
  buildAdjustments,
  computeBrandFitDimensions,
  computeBrandFitScore,
  extractConflicts,
  extractMatches,
  scoreOpportunityText,
  tierFromScore,
} from "./scoring";
import { emptyShopifyLearningContext, loadShopifyLearningContext } from "./shopify-learning";
import {
  BRAND_INTELLIGENCE_VERSION,
  type BrandIntelligenceEngineInput,
  type BrandIntelligenceEngineResult,
  type BrandIntelligenceSection,
  type ScoredOpportunity,
} from "./types";

const SCORABLE_RECOMMENDATION_TYPES = new Set<RecommendationType>([
  "design_direction",
  "product_opportunity",
  "collection_concept",
  "color_palette",
  "typography_direction",
  "graphic_theme",
]);

function opportunityId(prefix: string, title: string, index: number): string {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `brand-${prefix}-${slug || index}`.slice(0, 96);
}

function extractScorableItems(
  intelligence: UnifiedResearchIntelligence,
  reasoning: ResearchReasoningIntelligence,
): Array<{ id: string; title: string; trendScore: number; sourceKeys: string[] }> {
  const items: Array<{ id: string; title: string; trendScore: number; sourceKeys: string[] }> = [];
  const seen = new Set<string>();

  const add = (id: string, title: string, trendScore: number, sourceKeys: string[]) => {
    const key = title.toLowerCase().trim();
    if (!key || seen.has(key)) return;
    seen.add(key);
    items.push({ id, title, trendScore, sourceKeys });
  };

  for (const rec of intelligence.recommendations.items) {
    if (!SCORABLE_RECOMMENDATION_TYPES.has(rec.type)) continue;
    add(
      rec.id,
      rec.title.replace(/^Explore "|" as a design direction$/g, "").replace(/^Product signal: /, "").replace(/^Graphic theme: /, "").replace(/^Color palette direction: /, ""),
      rec.confidence,
      rec.sourceSupport.map((support) => support.sourceKey),
    );
  }

  for (const [index, term] of rankOpportunityTerms(intelligence).slice(0, 8).entries()) {
    add(opportunityId("term", term.term, index), term.term, term.weightedScore, term.sourceKeys);
  }

  for (const [index, cluster] of rankTrendClusters(intelligence.trends).slice(0, 6).entries()) {
    add(
      opportunityId("trend", cluster.item.label, index),
      cluster.item.label,
      cluster.weightedScore,
      [cluster.sourceKey],
    );
  }

  for (const [index, opportunity] of intelligence.commercial.opportunities.slice(0, 4).entries()) {
    add(
      opportunityId("commercial", opportunity.title, index),
      opportunity.title,
      intelligence.confidence.scores.commercial_confidence.score,
      [String(opportunity.provenance.sourceKey)],
    );
  }

  for (const [index, signal] of reasoning.brandFit.alignedSignals.slice(0, 4).entries()) {
    add(opportunityId("aligned", signal, index), signal, reasoning.brandFit.score, []);
  }

  for (const [index, signal] of reasoning.brandFit.misalignedSignals.slice(0, 4).entries()) {
    add(opportunityId("misaligned", signal, index), signal, 50, []);
  }

  return items;
}

function filterRecommendations(
  intelligence: UnifiedResearchIntelligence,
  rejectedTitles: Set<string>,
): UnifiedResearchIntelligence {
  const filteredItems = intelligence.recommendations.items.filter((rec) => {
    if (!SCORABLE_RECOMMENDATION_TYPES.has(rec.type)) return true;
    const normalizedTitle = rec.title.toLowerCase();
    for (const rejected of rejectedTitles) {
      if (normalizedTitle.includes(rejected) || rejected.includes(normalizedTitle)) {
        return false;
      }
    }
    return true;
  });

  return {
    ...intelligence,
    recommendations: {
      ...intelligence.recommendations,
      items: filteredItems,
      caveats: [
        ...intelligence.recommendations.caveats,
        `Brand Intelligence hat ${intelligence.recommendations.items.length - filteredItems.length} Empfehlung(en) unterhalb des Brand-Fit-Schwellenwerts (${BRAND_FIT_THRESHOLD}) herausgefiltert.`,
      ],
    },
  };
}

function buildOverallBrandIntelligence(
  opportunities: ScoredOpportunity[],
  shopify: ReturnType<typeof emptyShopifyLearningContext> extends infer T ? T : never,
  generatedAt: string,
  reasoning: ResearchReasoningIntelligence,
): BrandIntelligenceSection {
  const approved = opportunities.filter((opp) => !opp.rejected);
  const rejected = opportunities.filter((opp) => opp.rejected);

  const aggregateText = [
    ...approved.slice(0, 5).map((opp) => opp.title),
    ...reasoning.brandFit.alignedSignals,
    ...reasoning.brandFit.misalignedSignals,
  ].join(" ");

  const dimensions = computeBrandFitDimensions(aggregateText || "milaene streetwear", shopify);
  const brandFitScore = approved.length > 0
    ? Math.round(approved.reduce((sum, opp) => sum + opp.brandFit, 0) / approved.length)
    : computeBrandFitScore(dimensions);

  const brandFitTier = tierFromScore(brandFitScore);
  const matches = [
    ...new Set([
      ...extractMatches(aggregateText),
      ...reasoning.brandFit.alignedSignals,
      ...approved.flatMap((opp) => opp.matches),
    ]),
  ].slice(0, 8);

  const conflicts = [
    ...new Set([
      ...extractConflicts(aggregateText),
      ...reasoning.brandFit.misalignedSignals,
      ...rejected.flatMap((opp) => opp.conflicts),
    ]),
  ].slice(0, 8);

  const recommendedAdjustments = [
    ...buildAdjustments(dimensions, conflicts),
    ...approved.flatMap((opp) => opp.adjustments),
  ].slice(0, 6);

  const tierLabels: Record<string, string> = {
    perfect: "Perfekte Übereinstimmung",
    excellent: "Exzellent",
    good: "Gut",
    weak: "Schwach",
    reject: "Ablehnen",
  };

  const summary = rejected.length > 0
    ? `Brand Intelligence hat ${opportunities.length} Signale bewertet — ${approved.length} freigegeben, ${rejected.length} unter Brand Fit ${BRAND_FIT_THRESHOLD} abgelehnt.`
    : `Brand Intelligence hat ${approved.length} Signale validiert — alle erfüllen die Milaene-Brand-Fit-Standards.`;

  return {
    version: BRAND_INTELLIGENCE_VERSION,
    generatedAt,
    brandFitScore,
    brandFitTier,
    brandFitTierLabel: tierLabels[brandFitTier] ?? "Schwach",
    reasons: approved.length > 0
      ? approved[0].reasons
      : rejected[0]?.rejectionReasons ?? [getDictionary(DEFAULT_LOCALE).intelligence.brand.insufficientSignals],
    matches,
    conflicts,
    recommendedAdjustments,
    dimensionBreakdown: dimensions,
    topOpportunities: approved
      .sort((a, b) => b.brandFit - a.brandFit || b.trendScore - a.trendScore)
      .slice(0, 8),
    rejectedOpportunities: rejected
      .sort((a, b) => b.trendScore - a.trendScore)
      .slice(0, 8),
    shopifyLearning: shopify,
    summary,
  };
}

/**
 * Milaene Brand Fit Engine — evaluates every fused signal before the Final Report.
 * Inserted between Fusion/Evaluation and Report build. Deterministic only.
 */
export async function runBrandIntelligenceEngine(
  input: BrandIntelligenceEngineInput,
): Promise<BrandIntelligenceEngineResult> {
  const generatedAt = input.generatedAt ?? input.intelligence.generatedAt;
  const shopify = await loadShopifyLearningContext();

  const confidence = input.intelligence.confidence;
  const commercialPotential = confidence.scores.commercial_confidence.score;
  const competition = confidence.scores.saturation_risk.score;
  const longevity = confidence.scores.longevity.score;
  const originality = confidence.scores.novelty.score;
  const defaultTrendScore = confidence.scores.trend_confidence.score;

  const scorableItems = extractScorableItems(input.intelligence, input.reasoning);

  const opportunities: ScoredOpportunity[] = scorableItems.map((item) =>
    scoreOpportunityText(
      item.id,
      item.title,
      item.trendScore || defaultTrendScore,
      commercialPotential,
      competition,
      longevity,
      originality,
      item.sourceKeys,
      shopify,
    ),
  );

  const rejectedTitles = new Set(
    opportunities.filter((opp) => opp.rejected).map((opp) => opp.title.toLowerCase()),
  );

  const filteredIntelligence = filterRecommendations(input.intelligence, rejectedTitles);

  const brandIntelligence = buildOverallBrandIntelligence(
    opportunities,
    shopify,
    generatedAt,
    input.reasoning,
  );

  return {
    intelligence: filteredIntelligence,
    brandIntelligence,
  };
}

export function runBrandIntelligenceEngineSync(
  input: BrandIntelligenceEngineInput,
): BrandIntelligenceEngineResult {
  const generatedAt = input.generatedAt ?? input.intelligence.generatedAt;
  const shopify = emptyShopifyLearningContext();

  const confidence = input.intelligence.confidence;
  const commercialPotential = confidence.scores.commercial_confidence.score;
  const competition = confidence.scores.saturation_risk.score;
  const longevity = confidence.scores.longevity.score;
  const originality = confidence.scores.novelty.score;
  const defaultTrendScore = confidence.scores.trend_confidence.score;

  const scorableItems = extractScorableItems(input.intelligence, input.reasoning);

  const opportunities: ScoredOpportunity[] = scorableItems.map((item) =>
    scoreOpportunityText(
      item.id,
      item.title,
      item.trendScore || defaultTrendScore,
      commercialPotential,
      competition,
      longevity,
      originality,
      item.sourceKeys,
      shopify,
    ),
  );

  const rejectedTitles = new Set(
    opportunities.filter((opp) => opp.rejected).map((opp) => opp.title.toLowerCase()),
  );

  return {
    intelligence: filterRecommendations(input.intelligence, rejectedTitles),
    brandIntelligence: buildOverallBrandIntelligence(
      opportunities,
      shopify,
      generatedAt,
      input.reasoning,
    ),
  };
}
