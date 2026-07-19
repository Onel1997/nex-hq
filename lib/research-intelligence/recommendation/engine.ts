import {
  buildSourceSupport,
  extractColorTerms,
  rankOpportunityTerms,
  rankSignalsByWeight,
  rankTrendClusters,
} from "../fusion/weighted-fusion";
import { isCatalogProductReference } from "../pattern-intelligence/catalog-filter";
import { isNoiseEntity } from "../pattern-intelligence/entity-quality";
import { dedupeRecommendationsSemantic } from "../clean-signals/semantic-dedup";
import type { ConfidenceScoreId } from "../types/confidence";
import type { ResearchReasoningIntelligence } from "../types/reasoning";
import type {
  RecommendationEvidence,
  RecommendationIntelligence,
  RecommendationType,
  ResearchRecommendation,
} from "../types/recommendation";
import { RECOMMENDATION_ENGINE_MODEL_VERSION } from "../types/recommendation";
import type { UnifiedResearchIntelligence } from "../types/unified";
import {
  blendScores,
  derivePriority,
  graphicThemeForTerms,
  hasActionableData,
  isWeakIntelligence,
  launchTimingNarrative,
  missingSourceActions,
  type RecommendationRuleContext,
  RULE_THRESHOLDS,
  typographyDirectionForTerms,
} from "./rules";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/config";
import {
  formatIntelligenceTemplate,
  getIntelligenceCopy,
  tierLabel,
} from "../copy";

export const RECOMMENDATION_ENGINE_VERSION = RECOMMENDATION_ENGINE_MODEL_VERSION;

export interface RecommendationInput {
  intelligence: UnifiedResearchIntelligence;
  reasoning: ResearchReasoningIntelligence;
  generatedAt?: string;
  catalogProductTitles?: string[];
}

let recommendationCounter = 0;

function recId(type: RecommendationType, slug: string): string {
  recommendationCounter += 1;
  const safe = slug.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `rec-${type}-${safe || recommendationCounter}`.slice(0, 96);
}

function resetRecommendationCounter(): void {
  recommendationCounter = 0;
}

function evidence(
  id: string,
  label: string,
  options: Partial<RecommendationEvidence> = {},
): RecommendationEvidence {
  return { id, label, ...options };
}

function makeRecommendation(
  partial: Omit<ResearchRecommendation, "narrative"> & { narrative?: string },
): ResearchRecommendation {
  return {
    ...partial,
    narrative: partial.narrative ?? partial.why,
  };
}

function buildResearchActions(
  ctx: RecommendationRuleContext,
  locale: Locale = DEFAULT_LOCALE,
): ResearchRecommendation[] {
  const copy = getIntelligenceCopy(locale);
  const actions = missingSourceActions(ctx, locale);
  const confidence = Math.min(ctx.confidence.overallScore, 45);
  const why = isWeakIntelligence(ctx)
    ? formatIntelligenceTemplate(copy.recommendations.expandWhyWeak, {
        tier: tierLabel(ctx.confidence.overall, locale),
        score: ctx.confidence.overallScore,
      })
    : copy.recommendations.expandWhyGaps;

  const items: ResearchRecommendation[] = [
    makeRecommendation({
      id: recId("next_research_action", "expand-research"),
      title: copy.recommendations.expandCoverage,
      type: "next_research_action",
      priority: "explore",
      confidence,
      why,
      evidence: [
        evidence(
          "ev-research-weak-overall",
          formatIntelligenceTemplate(copy.recommendations.overallConfidenceEvidence, {
            score: ctx.confidence.overallScore,
          }),
          { scoreId: "source_diversity" },
        ),
        evidence(
          "ev-research-providers",
          formatIntelligenceTemplate(copy.recommendations.providersFused, {
            count: ctx.intelligence.manifest.providerCount,
          }),
        ),
      ],
      sourceSupport: buildSourceSupport(
        ctx.intelligence.manifest.contributions.map((item) => String(item.sourceKey)),
      ),
      risks: ctx.reasoning.risks.map((risk) => risk.label),
      suggestedNextStep: actions[0] ?? copy.recommendations.expandNextStep,
      audiences: ["research", "ceo"],
      tags: ["research-gap", "coverage"],
      sourceDomains: ["signal", "trend"],
      relatedScoreIds: ["source_diversity", "source_agreement", "trend_confidence"],
    }),
  ];

  for (const [index, action] of actions.slice(0, 3).entries()) {
    items.push(
      makeRecommendation({
        id: recId("next_research_action", `source-gap-${index}`),
        title: action.replace(/\.$/, ""),
        type: "next_research_action",
        priority: "explore",
        confidence: Math.min(ctx.confidence.scores.source_diversity.score, 40),
        why: copy.recommendations.sourceGapWhy,
        evidence: [
          evidence(`ev-source-gap-${index}`, action),
          evidence(
            "ev-source-diversity",
            formatIntelligenceTemplate(copy.recommendations.sourceDiversityEvidence, {
              score: ctx.confidence.scores.source_diversity.score,
            }),
            { scoreId: "source_diversity" },
          ),
        ],
        sourceSupport: buildSourceSupport(
          ctx.intelligence.manifest.contributions.map((item) => String(item.sourceKey)),
        ),
        risks: [],
        suggestedNextStep: action,
        audiences: ["research"],
        tags: ["source-gap"],
        sourceDomains: ["signal"],
        relatedScoreIds: ["source_diversity", "source_agreement"],
      }),
    );
  }

  return items;
}

function buildDesignDirections(ctx: RecommendationRuleContext): ResearchRecommendation[] {
  const copy = getIntelligenceCopy(DEFAULT_LOCALE).recommendations;
  const trendScore = ctx.confidence.scores.trend_confidence.score;
  const brandScore = ctx.confidence.scores.brand_fit_confidence.score;
  if (trendScore < RULE_THRESHOLDS.minTrendForDesign) return [];

  const clusters = rankTrendClusters(ctx.intelligence.trends).slice(0, 3);
  if (clusters.length === 0) return [];

  return clusters.map((ranked, index) => {
    const label = ranked.item.label;
    const confidence = blendScores(ctx.confidence, [
      "trend_confidence",
      "brand_fit_confidence",
      "source_agreement",
    ]);
    const adjustedConfidence = Math.min(
      confidence,
      brandScore < RULE_THRESHOLDS.minBrandFitForDesign ? confidence - 15 : confidence,
    );

    return makeRecommendation({
      id: recId("design_direction", label),
      title: formatIntelligenceTemplate(copy.exploreDesign, { label }),
      type: "design_direction",
      priority: derivePriority(adjustedConfidence, "design_direction", ctx),
      confidence: Math.max(0, adjustedConfidence),
      why: formatIntelligenceTemplate(copy.designWhy, { label }),
      evidence: [
        evidence(
          `ev-design-cluster-${index}`,
          formatIntelligenceTemplate(copy.trendClusterScore, {
            label,
            score: ranked.weightedScore,
          }),
          {
            sourceKey: ranked.sourceKey,
            signalId: ranked.item.observations[0]?.id,
            scoreId: "trend_confidence",
          },
        ),
        evidence(`ev-design-trend-score`, ctx.confidence.scores.trend_confidence.rationale, {
          scoreId: "trend_confidence",
        }),
        evidence(`ev-design-brand-fit`, ctx.confidence.scores.brand_fit_confidence.rationale, {
          scoreId: "brand_fit_confidence",
        }),
      ],
      sourceSupport: buildSourceSupport([ranked.sourceKey]),
      risks: ctx.reasoning.risks
        .filter((risk) => risk.severity !== "low")
        .map((risk) => `${risk.label}: ${risk.reason}`),
      suggestedNextStep:
        adjustedConfidence >= RULE_THRESHOLDS.moderateOverall
          ? formatIntelligenceTemplate(copy.designNextStrong, { label })
          : formatIntelligenceTemplate(copy.designNextWeak, { label }),
      audiences: ["design", "research"],
      tags: [ranked.item.subjectType, "design-direction"],
      sourceDomains: ["trend", "brand"],
      relatedScoreIds: ["trend_confidence", "brand_fit_confidence", "novelty"],
    });
  });
}

function buildProductOpportunities(
  ctx: RecommendationRuleContext,
  catalogTitles: string[] = [],
): ResearchRecommendation[] {
  const copy = getIntelligenceCopy(DEFAULT_LOCALE).recommendations;
  const commercialScore = ctx.confidence.scores.commercial_confidence.score;
  if (commercialScore < RULE_THRESHOLDS.minCommercialForProduct) return [];

  const items: ResearchRecommendation[] = [];

  for (const [index, opportunity] of ctx.intelligence.commercial.opportunities.slice(0, 3).entries()) {
    if (isCatalogProductReference(opportunity.title, catalogTitles)) continue;
    const sourceKey = String(opportunity.provenance.sourceKey);
    const confidence = blendScores(ctx.confidence, [
      "commercial_confidence",
      "source_agreement",
      "launch_readiness",
    ]);

    items.push(
      makeRecommendation({
        id: recId("product_opportunity", opportunity.title),
        title: opportunity.title,
        type: "product_opportunity",
        priority: derivePriority(confidence, "product_opportunity", ctx),
        confidence,
        why: formatIntelligenceTemplate(copy.productCommercialWhy, {
          rationale: opportunity.rationale,
          tier: ctx.confidence.scores.commercial_confidence.tier,
          score: commercialScore,
        }),
        evidence: [
          evidence(`ev-product-opp-${index}`, opportunity.rationale, {
            sourceKey,
            scoreId: "commercial_confidence",
          }),
          evidence("ev-product-commercial", ctx.confidence.scores.commercial_confidence.rationale, {
            scoreId: "commercial_confidence",
          }),
        ],
        sourceSupport: buildSourceSupport([sourceKey]),
        risks: ctx.confidence.scores.saturation_risk.score >= 60
          ? [ctx.confidence.scores.saturation_risk.rationale]
          : [],
        suggestedNextStep:
          confidence >= RULE_THRESHOLDS.strongOverall
            ? copy.productValidateSku
            : copy.productMonitor,
        audiences: ["commerce", "ceo"],
        tags: [...opportunity.tags, "product"],
        sourceDomains: ["commercial"],
        relatedScoreIds: ["commercial_confidence", "launch_readiness", "saturation_risk"],
      }),
    );
  }

  const rankedProducts = rankSignalsByWeight(
    ctx.intelligence.signals.filter(
      (signal) =>
        signal.category === "commerce" ||
        signal.entities.some((entity) => entity.type === "product" || entity.type === "listing"),
    ),
  ).slice(0, 2);

  for (const [index, ranked] of rankedProducts.entries()) {
    if (isCatalogProductReference(ranked.item.label, catalogTitles)) continue;
    if (isNoiseEntity(ranked.item.label)) continue;
    const confidence = blendScores(ctx.confidence, ["commercial_confidence", "source_agreement"]);
    items.push(
      makeRecommendation({
        id: recId("product_opportunity", ranked.item.label),
        title: formatIntelligenceTemplate(copy.productSignalTitle, { label: ranked.item.label }),
        type: "product_opportunity",
        priority: derivePriority(confidence, "product_opportunity", ctx),
        confidence,
        why: formatIntelligenceTemplate(copy.productSignalWhy, {
          score: ranked.weightedScore,
          source: ranked.sourceKey,
          headline: ranked.item.headline,
        }),
        evidence: [
          evidence(`ev-product-signal-${index}`, ranked.item.headline, {
            sourceKey: ranked.sourceKey,
            signalId: ranked.item.id,
            scoreId: "commercial_confidence",
          }),
        ],
        sourceSupport: buildSourceSupport([ranked.sourceKey]),
        risks: [],
        suggestedNextStep: copy.productCrossRef,
        audiences: ["commerce"],
        tags: ["commerce-signal"],
        sourceDomains: ["commercial", "signal"],
        relatedScoreIds: ["commercial_confidence"],
      }),
    );
  }

  return items;
}

function buildCollectionConcepts(ctx: RecommendationRuleContext): ResearchRecommendation[] {
  const copy = getIntelligenceCopy(DEFAULT_LOCALE).recommendations;
  const novelty = ctx.confidence.scores.novelty.score;
  const brandFit = ctx.confidence.scores.brand_fit_confidence.score;
  if (novelty < RULE_THRESHOLDS.minNoveltyForCollection || brandFit < RULE_THRESHOLDS.minBrandFitForDesign) {
    return [];
  }

  const terms = rankOpportunityTerms(ctx.intelligence).slice(0, 2);
  const aligned = ctx.reasoning.brandFit.alignedSignals.slice(0, 3);
  if (terms.length === 0 && aligned.length === 0) return [];

  const anchor = terms[0]?.term ?? aligned[0] ?? "archive";
  const confidence = blendScores(ctx.confidence, [
    "brand_fit_confidence",
    "novelty",
    "longevity",
  ]);

  return [
    makeRecommendation({
      id: recId("collection_concept", anchor),
      title: formatIntelligenceTemplate(copy.collectionTitle, {
        anchor,
        alignment: ctx.reasoning.brandFit.fits
          ? copy.collectionAligned
          : copy.collectionCaution,
      }),
      type: "collection_concept",
      priority: derivePriority(confidence, "collection_concept", ctx),
      confidence,
      why: formatIntelligenceTemplate(copy.collectionWhy, {
        novelty,
        brandFit,
        anchor,
        summary: ctx.reasoning.brandFit.summary,
      }),
      evidence: [
        evidence("ev-collection-novelty", ctx.confidence.scores.novelty.rationale, {
          scoreId: "novelty",
        }),
        evidence("ev-collection-brand", ctx.confidence.scores.brand_fit_confidence.rationale, {
          scoreId: "brand_fit_confidence",
        }),
        ...(terms[0]
          ? [
              evidence(
                "ev-collection-term",
                formatIntelligenceTemplate(copy.weightedTerm, { term: terms[0].term }),
                { scoreId: "trend_confidence" },
              ),
            ]
          : []),
      ],
      sourceSupport: buildSourceSupport(terms[0]?.sourceKeys ?? []),
      risks: ctx.reasoning.brandFit.misalignedSignals.map((signal) =>
        formatIntelligenceTemplate(copy.misalignedCue, { signal }),
      ),
      suggestedNextStep: ctx.reasoning.brandFit.fits
        ? copy.collectionCapsuleBrief
        : copy.reconcileBeforeCapsule,
      audiences: ["design", "ceo"],
      tags: ["collection", "capsule"],
      sourceDomains: ["trend", "brand"],
      relatedScoreIds: ["brand_fit_confidence", "novelty", "longevity"],
    }),
  ];
}

function buildColorPalettes(ctx: RecommendationRuleContext): ResearchRecommendation[] {
  const copy = getIntelligenceCopy(DEFAULT_LOCALE).recommendations;
  const colors = extractColorTerms(ctx.intelligence).slice(0, 4);
  if (colors.length === 0) return [];
  if (ctx.confidence.scores.trend_confidence.score < 30) return [];

  const labels = colors.map((color) => color.term);
  const confidence = blendScores(ctx.confidence, [
    "trend_confidence",
    "brand_fit_confidence",
    "seasonality",
  ]);

  return [
    makeRecommendation({
      id: recId("color_palette", labels.join("-")),
      title: formatIntelligenceTemplate(copy.colorPaletteTitle, { colors: labels.join(", ") }),
      type: "color_palette",
      priority: derivePriority(confidence, "color_palette", ctx),
      confidence,
      why: formatIntelligenceTemplate(copy.colorPaletteWhy, {
        count: labels.length,
        tier: tierLabel(ctx.confidence.scores.trend_confidence.tier, DEFAULT_LOCALE),
      }),
      evidence: colors.map((color, index) =>
        evidence(
          `ev-color-${index}`,
          formatIntelligenceTemplate(copy.colorSignal, {
            color: color.term,
            score: color.weightedScore,
          }),
          {
            sourceKey: color.sourceKeys[0],
            signalId: color.signalIds[0],
            scoreId: "trend_confidence",
          },
        ),
      ),
      sourceSupport: buildSourceSupport(colors.flatMap((color) => color.sourceKeys)),
      risks:
        ctx.confidence.scores.saturation_risk.score >= 60
          ? [copy.colorSaturationRisk]
          : [],
      suggestedNextStep: copy.colorNextStep,
      audiences: ["design"],
      tags: ["color", "palette"],
      sourceDomains: ["trend", "brand", "market"],
      relatedScoreIds: ["trend_confidence", "brand_fit_confidence", "seasonality"],
    }),
  ];
}

function buildTypographyDirections(ctx: RecommendationRuleContext): ResearchRecommendation[] {
  const copy = getIntelligenceCopy(DEFAULT_LOCALE).recommendations;
  const terms = [
    ...rankOpportunityTerms(ctx.intelligence).slice(0, 4).map((term) => term.term),
    ...ctx.reasoning.brandFit.alignedSignals,
  ];
  const direction = typographyDirectionForTerms(terms);
  if (!direction) return [];
  if (ctx.confidence.scores.brand_fit_confidence.score < 30) return [];

  const confidence = blendScores(ctx.confidence, ["brand_fit_confidence", "longevity"]);

  return [
    makeRecommendation({
      id: recId("typography_direction", "milaene-type"),
      title: copy.typographyTitle,
      type: "typography_direction",
      priority: derivePriority(confidence, "typography_direction", ctx),
      confidence,
      why: formatIntelligenceTemplate(copy.typographyWhy, {
        score: ctx.confidence.scores.brand_fit_confidence.score,
        direction,
      }),
      evidence: [
        evidence("ev-type-brand", ctx.confidence.scores.brand_fit_confidence.rationale, {
          scoreId: "brand_fit_confidence",
        }),
        evidence(
          "ev-type-aligned",
          formatIntelligenceTemplate(copy.alignedSignals, {
            signals: terms.slice(0, 4).join(", ") || "—",
          }),
        ),
      ],
      sourceSupport: buildSourceSupport(
        ctx.reasoning.confirmingSources.slice(0, 3).map((source) => source.sourceKey),
      ),
      risks: [],
      suggestedNextStep: copy.typographyNext,
      audiences: ["design"],
      tags: ["typography"],
      sourceDomains: ["brand"],
      relatedScoreIds: ["brand_fit_confidence", "longevity"],
    }),
  ];
}

function buildGraphicThemes(ctx: RecommendationRuleContext): ResearchRecommendation[] {
  const copy = getIntelligenceCopy(DEFAULT_LOCALE).recommendations;
  const terms = rankOpportunityTerms(ctx.intelligence).slice(0, 5).map((term) => term.term);
  const graphicSignals = ctx.intelligence.signals.filter((signal) =>
    signal.tags.some((tag) => /graphic|print|emblem|logo|aesthetic/i.test(tag)),
  );
  if (terms.length === 0 && graphicSignals.length === 0) return [];
  if (ctx.confidence.scores.trend_confidence.score < 35) return [];

  const confidence = blendScores(ctx.confidence, [
    "trend_confidence",
    "brand_fit_confidence",
    "novelty",
  ]);

  const theme =
    graphicThemeForTerms([
      ...terms,
      ...graphicSignals.map((signal) => signal.label),
    ]) ?? copy.graphicDefault;

  return [
    makeRecommendation({
      id: recId("graphic_theme", theme.slice(0, 24)),
      title: formatIntelligenceTemplate(copy.graphicTitle, { theme }),
      type: "graphic_theme",
      priority: derivePriority(confidence, "graphic_theme", ctx),
      confidence,
      why: formatIntelligenceTemplate(copy.graphicWhy, {
        tier: tierLabel(ctx.confidence.scores.novelty.tier, DEFAULT_LOCALE),
      }),
      evidence: [
        evidence("ev-graphic-trend", ctx.confidence.scores.trend_confidence.rationale, {
          scoreId: "trend_confidence",
        }),
        ...graphicSignals.slice(0, 2).map((signal, index) =>
          evidence(`ev-graphic-signal-${index}`, signal.headline, {
            sourceKey: String(signal.provenance.sourceKey),
            signalId: signal.id,
          }),
        ),
      ],
      sourceSupport: buildSourceSupport(
        graphicSignals.map((signal) => String(signal.provenance.sourceKey)),
      ),
      risks: ctx.reasoning.brandFit.misalignedSignals.length
        ? [
            formatIntelligenceTemplate(copy.brandTension, {
              signals: ctx.reasoning.brandFit.misalignedSignals.slice(0, 2).join(", "),
            }),
          ]
        : [],
      suggestedNextStep: copy.graphicNext,
      audiences: ["design"],
      tags: ["graphic", "print"],
      sourceDomains: ["trend", "brand"],
      relatedScoreIds: ["trend_confidence", "brand_fit_confidence", "novelty"],
    }),
  ];
}

function buildLaunchTiming(ctx: RecommendationRuleContext): ResearchRecommendation[] {
  const copy = getIntelligenceCopy(DEFAULT_LOCALE).recommendations;
  const seasonality = ctx.confidence.scores.seasonality.score;
  const readiness = ctx.confidence.scores.launch_readiness.score;
  if (seasonality < RULE_THRESHOLDS.minSeasonalityForLaunch && readiness < 50) return [];

  const confidence = blendScores(ctx.confidence, [
    "seasonality",
    "launch_readiness",
    "longevity",
  ]);
  const narrative = launchTimingNarrative(ctx);

  return [
    makeRecommendation({
      id: recId("launch_timing", "window"),
      title: copy.launchTitle,
      type: "launch_timing",
      priority:
        readiness >= RULE_THRESHOLDS.minLaunchReadinessForAct && seasonality >= 55
          ? derivePriority(confidence, "launch_timing", ctx)
          : "monitor",
      confidence,
      why: narrative,
      evidence: [
        evidence("ev-launch-seasonality", ctx.confidence.scores.seasonality.rationale, {
          scoreId: "seasonality",
        }),
        evidence("ev-launch-readiness", ctx.confidence.scores.launch_readiness.rationale, {
          scoreId: "launch_readiness",
        }),
        evidence("ev-launch-longevity", ctx.confidence.scores.longevity.rationale, {
          scoreId: "longevity",
        }),
      ],
      sourceSupport: buildSourceSupport(
        ctx.reasoning.confirmingSources.slice(0, 4).map((source) => source.sourceKey),
        Object.fromEntries(
          ctx.reasoning.confirmingSources.map((source) => [source.sourceKey, source.summary]),
        ),
      ),
      risks: ctx.confidence.scores.saturation_risk.score >= 65
        ? [ctx.confidence.scores.saturation_risk.rationale]
        : [],
      suggestedNextStep:
        readiness >= RULE_THRESHOLDS.minLaunchReadinessForAct
          ? copy.launchAlignCalendar
          : copy.launchMonitor,
      audiences: ["ceo", "commerce", "marketing"],
      tags: ["launch", "timing"],
      sourceDomains: ["market", "trend"],
      relatedScoreIds: ["seasonality", "launch_readiness", "longevity"],
    }),
  ];
}

function buildRiskWarnings(ctx: RecommendationRuleContext): ResearchRecommendation[] {
  const copy = getIntelligenceCopy(DEFAULT_LOCALE).recommendations;
  return ctx.reasoning.risks.map((risk) => {
    const relatedScores = risk.relatedScoreIds as ConfidenceScoreId[];
    const confidence = blendScores(ctx.confidence, relatedScores.length ? relatedScores : ["source_agreement"]);

    return makeRecommendation({
      id: recId("risk_warning", risk.id),
      title: formatIntelligenceTemplate(copy.riskTitle, { label: risk.label }),
      type: "risk_warning",
      priority: derivePriority(confidence, "risk_warning", ctx),
      confidence,
      why: risk.reason,
      evidence: relatedScores.map((scoreId, index) =>
        evidence(`ev-risk-${risk.id}-${index}`, ctx.confidence.scores[scoreId].rationale, { scoreId }),
      ),
      sourceSupport: buildSourceSupport(
        ctx.reasoning.disagreeingSources.map((source) => source.sourceKey),
        Object.fromEntries(
          ctx.reasoning.disagreeingSources.map((source) => [source.sourceKey, source.summary]),
        ),
      ),
      risks: [risk.reason],
      suggestedNextStep:
        risk.severity === "high" ? copy.riskPause : copy.riskTrack,
      audiences: ["research", "ceo"],
      tags: ["risk", risk.severity],
      sourceDomains: ["trend", "commercial", "brand"],
      relatedScoreIds: relatedScores,
    });
  });
}

function buildSummary(items: ResearchRecommendation[], ctx: RecommendationRuleContext): string {
  const copy = getIntelligenceCopy(DEFAULT_LOCALE).recommendations;
  if (!hasActionableData(ctx)) {
    return copy.summaryEmpty;
  }
  const act = items.filter((item) => item.priority === "act").length;
  const monitor = items.filter((item) => item.priority === "monitor").length;
  const explore = items.filter((item) => item.priority === "explore").length;
  return formatIntelligenceTemplate(copy.summaryGenerated, {
    count: items.length,
    act,
    monitor,
    explore,
    tier: tierLabel(ctx.confidence.overall, DEFAULT_LOCALE),
  });
}

export function generateRecommendations(input: RecommendationInput): RecommendationIntelligence {
  resetRecommendationCounter();

  const generatedAt = input.generatedAt ?? input.intelligence.generatedAt;
  const catalogTitles = input.catalogProductTitles ?? [];
  const ctx: RecommendationRuleContext = {
    intelligence: input.intelligence,
    confidence: input.intelligence.confidence,
    reasoning: input.reasoning,
  };

  if (!hasActionableData(ctx)) {
    const weakItems = buildResearchActions(ctx, DEFAULT_LOCALE);
    const copy = getIntelligenceCopy(DEFAULT_LOCALE).recommendations;
    return {
      version: RECOMMENDATION_ENGINE_MODEL_VERSION,
      items: weakItems,
      generatedAt,
      summary: buildSummary(weakItems, ctx),
      caveats: [
        ...ctx.confidence.caveats,
        copy.caveatInsufficient,
      ],
    };
  }

  const items: ResearchRecommendation[] = [];

  if (isWeakIntelligence(ctx)) {
    items.push(...buildResearchActions(ctx, DEFAULT_LOCALE));
  }

  items.push(
    ...buildRiskWarnings(ctx),
    ...buildDesignDirections(ctx),
    ...buildProductOpportunities(ctx, catalogTitles),
    ...buildCollectionConcepts(ctx),
    ...buildColorPalettes(ctx),
    ...buildTypographyDirections(ctx),
    ...buildGraphicThemes(ctx),
    ...buildLaunchTiming(ctx),
  );

  if (items.filter((item) => item.type !== "risk_warning").length === 0) {
    items.push(...buildResearchActions(ctx, DEFAULT_LOCALE));
  }

  const deduped = dedupeRecommendationsSemantic(items);
  const sorted = deduped.sort((a, b) => b.confidence - a.confidence);

  const copy = getIntelligenceCopy(DEFAULT_LOCALE).recommendations;
  return {
    version: RECOMMENDATION_ENGINE_MODEL_VERSION,
    items: sorted,
    generatedAt,
    summary: buildSummary(sorted, ctx),
    caveats: [
      ...ctx.confidence.caveats,
      ...ctx.reasoning.caveats,
      copy.caveatDeterministic,
    ],
  };
}

function dedupeRecommendations(items: ResearchRecommendation[]): ResearchRecommendation[] {
  const seen = new Set<string>();
  const result: ResearchRecommendation[] = [];
  for (const item of items) {
    const key = `${item.type}:${item.title.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

export function enrichIntelligenceWithRecommendations(
  intelligence: UnifiedResearchIntelligence,
  reasoning: ResearchReasoningIntelligence,
  generatedAt?: string,
  catalogProductTitles?: string[],
): UnifiedResearchIntelligence {
  const recommendations = generateRecommendations({
    intelligence,
    reasoning,
    generatedAt,
    catalogProductTitles,
  });
  return { ...intelligence, recommendations };
}
