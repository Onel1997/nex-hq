import type { ConfidenceIntelligence, ConfidenceScoreId } from "../types/confidence";
import type { ResearchReasoningIntelligence } from "../types/reasoning";
import type { RecommendationPriority, RecommendationType } from "../types/recommendation";
import type { UnifiedResearchIntelligence } from "../types/unified";

export const RULE_THRESHOLDS = {
  weakOverall: 35,
  moderateOverall: 50,
  strongOverall: 70,
  minTrendForDesign: 40,
  minBrandFitForDesign: 35,
  minCommercialForProduct: 40,
  minNoveltyForCollection: 35,
  minSeasonalityForLaunch: 40,
  minLaunchReadinessForAct: 55,
  highSaturationAvoid: 75,
  lowSourceDiversity: 45,
  lowSourceAgreement: 40,
} as const;

export interface RecommendationRuleContext {
  intelligence: UnifiedResearchIntelligence;
  confidence: ConfidenceIntelligence;
  reasoning: ResearchReasoningIntelligence;
}

export function hasActionableData(ctx: RecommendationRuleContext): boolean {
  return (
    ctx.intelligence.manifest.providerCount > 0 &&
    (ctx.intelligence.signals.length > 0 ||
      ctx.intelligence.trends.rising.length > 0 ||
      ctx.intelligence.trends.emerging.length > 0)
  );
}

export function isWeakIntelligence(ctx: RecommendationRuleContext): boolean {
  if (!hasActionableData(ctx)) return true;
  return (
    ctx.confidence.overallScore < RULE_THRESHOLDS.weakOverall ||
    ctx.confidence.scores.source_diversity.score < RULE_THRESHOLDS.lowSourceDiversity
  );
}

export function derivePriority(
  confidence: number,
  type: RecommendationType,
  ctx: RecommendationRuleContext,
): RecommendationPriority {
  if (type === "risk_warning") {
    const saturation = ctx.confidence.scores.saturation_risk.score;
    const brandFit = ctx.confidence.scores.brand_fit_confidence.score;
    if (saturation >= RULE_THRESHOLDS.highSaturationAvoid || brandFit < 25) {
      return "avoid";
    }
    return confidence >= 55 ? "monitor" : "explore";
  }

  if (type === "next_research_action") {
    return "explore";
  }

  if (confidence >= RULE_THRESHOLDS.strongOverall) {
    const blockingRisk = ctx.reasoning.risks.some((risk) => risk.severity === "high");
    return blockingRisk ? "monitor" : "act";
  }

  if (confidence >= RULE_THRESHOLDS.moderateOverall) {
    return "monitor";
  }

  return "explore";
}

export function blendScores(
  confidence: ConfidenceIntelligence,
  scoreIds: ConfidenceScoreId[],
): number {
  if (scoreIds.length === 0) return 0;
  const total = scoreIds.reduce((sum, id) => sum + confidence.scores[id].score, 0);
  return Math.round(total / scoreIds.length);
}

export function typographyDirectionForTerms(terms: string[]): string | null {
  const joined = terms.join(" ").toLowerCase();
  if (/minimal|quiet|luxury|restraint|understated/.test(joined)) {
    return "Refined grotesk with generous tracking — quiet confidence, minimal hierarchy";
  }
  if (/archive|heritage|vintage|classic/.test(joined)) {
    return "Editorial serif paired with restrained sans — archive luxury tone";
  }
  if (/streetwear|urban|bold|graphic/.test(joined)) {
    return "Condensed bold sans for headlines with clean body grotesk";
  }
  if (/craft|artisan|elevated/.test(joined)) {
    return "Humanist serif with subtle contrast — craft-forward editorial";
  }
  return null;
}

export function graphicThemeForTerms(terms: string[]): string {
  const joined = terms.join(" ").toLowerCase();
  if (/emblem|symbol|logo|monogram/.test(joined)) {
    return "Micro-emblem and restrained symbol language";
  }
  if (/archive|heritage|vintage/.test(joined)) {
    return "Archive graphic marks with distressed texture restraint";
  }
  if (/minimal|quiet|understated/.test(joined)) {
    return "Negative-space graphic restraint — single focal mark";
  }
  if (/streetwear|urban|graphic/.test(joined)) {
    return "Bold placement graphics with controlled density";
  }
  return "Abstract texture-led graphic system with brand-fit moderation";
}

export function launchTimingNarrative(ctx: RecommendationRuleContext): string {
  const seasonality = ctx.confidence.scores.seasonality.score;
  const readiness = ctx.confidence.scores.launch_readiness.score;
  const longevity = ctx.confidence.scores.longevity.score;

  if (seasonality >= 65 && readiness >= 65) {
    return "Seasonal demand and launch readiness align — window supports a near-term drop.";
  }
  if (seasonality >= 50 && longevity >= 55) {
    return "Seasonal framing is present with durable longevity — plan a phased launch across the season.";
  }
  if (seasonality < 40) {
    return "Seasonality signal is weak — defer hard launch timing until demand seasonality clarifies.";
  }
  return "Launch timing is provisional — monitor seasonal signals before committing to a calendar date.";
}

export function missingSourceActions(ctx: RecommendationRuleContext): string[] {
  const present = new Set(
    ctx.intelligence.manifest.contributions.map((item) => String(item.sourceKey)),
  );
  const actions: string[] = [];
  if (!present.has("shopify")) {
    actions.push("Connect Shopify for commercial truth baseline.");
  }
  if (!present.has("google_trends")) {
    actions.push("Enable Google Trends for search-demand validation.");
  }
  if (!present.has("tiktok") && !present.has("pinterest")) {
    actions.push("Add TikTok or Pinterest for social momentum coverage.");
  }
  if (ctx.confidence.scores.source_agreement.score < RULE_THRESHOLDS.lowSourceAgreement) {
    actions.push("Reconcile conflicting sources on shared trend terms before acting.");
  }
  return actions;
}
