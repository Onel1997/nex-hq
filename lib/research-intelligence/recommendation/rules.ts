import type { ConfidenceIntelligence, ConfidenceScoreId } from "../types/confidence";
import type { ResearchReasoningIntelligence } from "../types/reasoning";
import type { RecommendationPriority, RecommendationType } from "../types/recommendation";
import type { UnifiedResearchIntelligence } from "../types/unified";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/config";
import { getIntelligenceCopy } from "../copy";

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
  const copy = getIntelligenceCopy(DEFAULT_LOCALE).typography;
  const joined = terms.join(" ").toLowerCase();
  if (/minimal|quiet|luxury|restraint|understated/.test(joined)) {
    return copy.minimalGrotesk;
  }
  if (/archive|heritage|vintage|classic/.test(joined)) {
    return copy.archiveSerif;
  }
  if (/streetwear|urban|bold|graphic/.test(joined)) {
    return copy.condensedSans;
  }
  if (/craft|artisan|elevated/.test(joined)) {
    return copy.humanistSerif;
  }
  return null;
}

export function graphicThemeForTerms(terms: string[]): string {
  const copy = getIntelligenceCopy(DEFAULT_LOCALE).graphic;
  const joined = terms.join(" ").toLowerCase();
  if (/emblem|symbol|logo|monogram/.test(joined)) {
    return copy.emblem;
  }
  if (/archive|heritage|vintage/.test(joined)) {
    return copy.archive;
  }
  if (/minimal|quiet|understated/.test(joined)) {
    return copy.minimal;
  }
  if (/streetwear|urban|graphic/.test(joined)) {
    return copy.streetwear;
  }
  return copy.abstract;
}

export function launchTimingNarrative(ctx: RecommendationRuleContext): string {
  const copy = getIntelligenceCopy(DEFAULT_LOCALE).launch;
  const seasonality = ctx.confidence.scores.seasonality.score;
  const readiness = ctx.confidence.scores.launch_readiness.score;
  const longevity = ctx.confidence.scores.longevity.score;

  if (seasonality >= 65 && readiness >= 65) {
    return copy.aligned;
  }
  if (seasonality >= 50 && longevity >= 55) {
    return copy.phased;
  }
  if (seasonality < 40) {
    return copy.weakSeason;
  }
  return copy.provisional;
}

export function missingSourceActions(
  ctx: RecommendationRuleContext,
  locale: Locale = DEFAULT_LOCALE,
): string[] {
  const copy = getIntelligenceCopy(locale);
  const present = new Set(
    ctx.intelligence.manifest.contributions.map((item) => String(item.sourceKey)),
  );
  const actions: string[] = [];
  if (!present.has("shopify")) {
    actions.push(copy.recommendations.connectShopify);
  }
  if (!present.has("google_trends")) {
    actions.push(copy.recommendations.enableGoogleTrends);
  }
  if (!present.has("tiktok") && !present.has("pinterest")) {
    actions.push(copy.recommendations.addSocialSources);
  }
  if (ctx.confidence.scores.source_agreement.score < RULE_THRESHOLDS.lowSourceAgreement) {
    actions.push(copy.recommendations.reconcileSources);
  }
  return actions;
}
