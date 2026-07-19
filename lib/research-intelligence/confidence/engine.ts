import {
  formatIntelligenceTemplate,
  getIntelligenceCopy,
  roleLabelLocalized,
  tierLabel,
} from "../copy";
import { localizeConfidenceIntelligence } from "../copy/localize-confidence";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/config";
import {
  clampScore,
  directionsAgree,
  horizonLongevityWeight,
  normalizeTerm,
  safeRatio,
  scoreToTier,
  strengthToScore,
  uniqueTerms,
  weightedAverage,
} from "./scoring-utils";
import {
  getSourceWeight,
  getSourceWeightProfile,
  KNOWN_SOURCE_COUNT,
} from "./source-weights";
import {
  MILAENE_BRAND_PROFILE,
  termConflictsBrandFit,
  termMatchesBrandFit,
} from "./brand-profile";
import type {
  ConfidenceEvidence,
  ConfidenceIntelligence,
  ConfidenceScore,
  ConfidenceScoreId,
  DomainConfidence,
} from "../types/confidence";
import { CONFIDENCE_SCORE_IDS } from "../types/confidence";
import type { UnifiedResearchIntelligence } from "../types/unified";
import type { NormalizedSignal, SignalDirection } from "../types/signals";

export const CONFIDENCE_ENGINE_VERSION = "5.1.0";

interface TermObservation {
  term: string;
  sourceKey: string;
  direction: SignalDirection;
  weight: number;
  signalId?: string;
  label: string;
}

interface ScoringContext {
  intelligence: UnifiedResearchIntelligence;
  signals: NormalizedSignal[];
  terms: TermObservation[];
  sourceKeys: string[];
  hasData: boolean;
  locale: Locale;
}

function buildScoringContext(
  intelligence: UnifiedResearchIntelligence,
): ScoringContext {
  const signals = intelligence.signals ?? [];
  const terms: TermObservation[] = [];

  for (const signal of signals) {
    const weight = getSourceWeight(signal.provenance.sourceKey);
    const sourceKey = String(signal.provenance.sourceKey);
    terms.push({
      term: normalizeTerm(signal.label),
      sourceKey,
      direction: signal.direction,
      weight,
      signalId: signal.id,
      label: signal.label,
    });
    for (const entity of signal.entities) {
      terms.push({
        term: normalizeTerm(entity.label),
        sourceKey,
        direction: signal.direction,
        weight,
        signalId: signal.id,
        label: entity.label,
      });
    }
  }

  for (const cluster of [
    ...intelligence.trends.rising,
    ...intelligence.trends.stable,
    ...intelligence.trends.declining,
    ...intelligence.trends.emerging,
  ]) {
    for (const observation of cluster.observations) {
      const weight = getSourceWeight(observation.provenance.sourceKey);
      terms.push({
        term: normalizeTerm(observation.subject),
        sourceKey: String(observation.provenance.sourceKey),
        direction: observation.direction,
        weight,
        signalId: observation.id,
        label: observation.subject,
      });
    }
    for (const related of cluster.relatedTerms) {
      const weight = cluster.observations.length
        ? getSourceWeight(cluster.observations[0].provenance.sourceKey)
        : 0.5;
      terms.push({
        term: normalizeTerm(related),
        sourceKey: cluster.observations[0]
          ? String(cluster.observations[0].provenance.sourceKey)
          : "unknown",
        direction: "stable",
        weight,
        label: related,
      });
    }
  }

  const sourceKeys = [
    ...new Set([
      ...signals.map((signal) => String(signal.provenance.sourceKey)),
      ...intelligence.manifest.contributions.map((item) => String(item.sourceKey)),
    ]),
  ];

  return {
    intelligence,
    signals,
    terms,
    sourceKeys,
    hasData: signals.length > 0 || intelligence.manifest.providerCount > 0,
    locale: DEFAULT_LOCALE,
  };
}

function evidenceId(scoreId: string, index: number): string {
  return `${scoreId}-evidence-${index}`;
}

function makeScore(
  id: ConfidenceScoreId,
  score: number,
  rationale: string,
  evidence: ConfidenceEvidence[],
  locale: Locale = DEFAULT_LOCALE,
): ConfidenceScore {
  const clamped = clampScore(score);
  return {
    id,
    label: getIntelligenceCopy(locale).scores[id],
    score: clamped,
    tier: scoreToTier(clamped),
    rationale,
    evidence,
  };
}

function scoreTrendConfidence(ctx: ScoringContext): ConfidenceScore {
  const { intelligence, signals, hasData, locale } = ctx;
  const copy = getIntelligenceCopy(locale);
  if (!hasData) {
    return makeScore(
      "trend_confidence",
      0,
      copy.confidence.noData,
      [],
      locale,
    );
  }

  const risingCount =
    intelligence.trends.rising.length + intelligence.trends.emerging.length;
  const decliningCount = intelligence.trends.declining.length;
  const totalClusters =
    risingCount +
    intelligence.trends.stable.length +
    decliningCount +
    intelligence.trends.emerging.length;

  const positiveSignals = signals.filter(
    (signal) => signal.direction === "up" || signal.direction === "emerging",
  );
  const negativeSignals = signals.filter(
    (signal) => signal.direction === "down" || signal.direction === "declining",
  );

  const weightedPositive = weightedAverage(
    positiveSignals.map((signal) => ({
      value: 100,
      weight: getSourceWeight(signal.provenance.sourceKey),
    })),
  );
  const weightedNegative = weightedAverage(
    negativeSignals.map((signal) => ({
      value: 100,
      weight: getSourceWeight(signal.provenance.sourceKey),
    })),
  );

  const clusterMomentum = clampScore(
    safeRatio(risingCount, Math.max(totalClusters, 1)) * 100,
  );
  const signalBalance = clampScore(weightedPositive - weightedNegative * 0.5 + 35);
  const score = clampScore(clusterMomentum * 0.45 + signalBalance * 0.55);

  const evidence: ConfidenceEvidence[] = [
    {
      id: evidenceId("trend_confidence", 0),
      label: `${risingCount} rising/emerging trend clusters`,
      weight: 0.45,
      contribution: clusterMomentum,
      direction: risingCount > 0 ? "supports" : "neutral",
    },
    {
      id: evidenceId("trend_confidence", 1),
      label: `${positiveSignals.length} positive directional signals`,
      weight: 0.3,
      contribution: weightedPositive,
      direction: positiveSignals.length > negativeSignals.length ? "supports" : "contradicts",
    },
    {
      id: evidenceId("trend_confidence", 2),
      label: `${negativeSignals.length} negative directional signals`,
      weight: 0.25,
      contribution: weightedNegative,
      direction: negativeSignals.length > positiveSignals.length ? "contradicts" : "neutral",
    },
  ];

  const tier = tierLabel(scoreToTier(score), locale);
  return makeScore(
    "trend_confidence",
    score,
    risingCount > decliningCount
      ? formatIntelligenceTemplate(copy.confidence.trendMomentumRising, {
          tier,
          rising: risingCount,
          declining: decliningCount,
        })
      : formatIntelligenceTemplate(copy.confidence.trendMomentumLimited, {
          tier,
          declining: decliningCount,
        }),
    evidence,
    locale,
  );
}

function scoreCommercialConfidence(ctx: ScoringContext): ConfidenceScore {
  const { intelligence, hasData, locale } = ctx;
  const copy = getIntelligenceCopy(locale);
  if (!hasData) {
    return makeScore(
      "commercial_confidence",
      0,
      copy.confidence.noCommercial,
      [],
      locale,
    );
  }

  const shopifySignals = ctx.signals.filter(
    (signal) => String(signal.provenance.sourceKey) === "shopify",
  );
  const commerceSignals = ctx.signals.filter((signal) => {
    const role = getSourceWeightProfile(signal.provenance.sourceKey).role;
    return role === "commerce_validation" || role === "commercial_truth";
  });

  const demandScore = weightedAverage(
    intelligence.commercial.demandIndicators.map((indicator) => ({
      value: strengthToScore(indicator.strength),
      weight: getSourceWeight(indicator.provenance.sourceKey),
    })),
  );

  const productScore = clampScore(
    safeRatio(intelligence.commercial.products.length, 8) * 100,
  );
  const shopifyScore = clampScore(
    safeRatio(shopifySignals.length, 5) * 100 * getSourceWeight("shopify"),
  );
  const validationScore = clampScore(
    safeRatio(commerceSignals.length, 10) * 100,
  );

  const score = clampScore(
    shopifyScore * 0.35 +
      demandScore * 0.3 +
      productScore * 0.2 +
      validationScore * 0.15,
  );

  const evidence: ConfidenceEvidence[] = [
    {
      id: evidenceId("commercial_confidence", 0),
      label: `${shopifySignals.length} Shopify commercial-truth signals`,
      sourceKey: "shopify",
      weight: 0.35,
      contribution: shopifyScore,
      direction: shopifySignals.length > 0 ? "supports" : "neutral",
    },
    {
      id: evidenceId("commercial_confidence", 1),
      label: `${intelligence.commercial.demandIndicators.length} demand indicators`,
      weight: 0.3,
      contribution: demandScore,
      direction: demandScore >= 50 ? "supports" : "neutral",
    },
    {
      id: evidenceId("commercial_confidence", 2),
      label: `${intelligence.commercial.products.length} product insights`,
      weight: 0.2,
      contribution: productScore,
      direction: productScore >= 40 ? "supports" : "neutral",
    },
    {
      id: evidenceId("commercial_confidence", 3),
      label: `${commerceSignals.length} commerce-validation signals`,
      weight: 0.15,
      contribution: validationScore,
      direction: commerceSignals.length > 0 ? "supports" : "neutral",
    },
  ];

  const tier = tierLabel(scoreToTier(score), locale);
  return makeScore(
    "commercial_confidence",
    score,
    shopifySignals.length > 0
      ? formatIntelligenceTemplate(copy.confidence.commercialWithShopify, { tier })
      : formatIntelligenceTemplate(copy.confidence.commercialWithoutShopify, { tier }),
    evidence,
    locale,
  );
}

function scoreBrandFitConfidence(ctx: ScoringContext): ConfidenceScore {
  const { intelligence, hasData } = ctx;
  if (!hasData) {
    return makeScore("brand_fit_confidence", 0,
      "No signals available to assess Milaene brand fit.",
      [],
    );
  }

  const candidateTerms = uniqueTerms([
    ...ctx.terms.map((term) => term.term),
    ...intelligence.brand.culturalSignals,
    ...intelligence.trends.opportunities,
    ...intelligence.brand.mentions.map((mention) => mention.name),
  ]);

  const aligned = candidateTerms.filter(termMatchesBrandFit);
  const conflicts = candidateTerms.filter(termConflictsBrandFit);
  const alignmentRatio = safeRatio(aligned.length, Math.max(candidateTerms.length, 1));
  const conflictPenalty = safeRatio(conflicts.length, Math.max(candidateTerms.length, 1));

  const aestheticHits = MILAENE_BRAND_PROFILE.preferredAesthetics.filter((aesthetic) =>
    candidateTerms.some((term) => term.includes(aesthetic) || aesthetic.includes(term)),
  );

  const score = clampScore(
    alignmentRatio * 70 + aestheticHits.length * 8 - conflictPenalty * 40 + 20,
  );

  const copy = getIntelligenceCopy(ctx.locale);
  const evidence: ConfidenceEvidence[] = [
    {
      id: evidenceId("brand_fit_confidence", 0),
      label: formatIntelligenceTemplate(copy.recommendations.alignedTermsDetected, {
        count: String(aligned.length),
      }),
      weight: 0.5,
      contribution: clampScore(alignmentRatio * 100),
      direction: aligned.length > 0 ? "supports" : "neutral",
    },
    {
      id: evidenceId("brand_fit_confidence", 1),
      label: formatIntelligenceTemplate(copy.recommendations.misalignedTermsDetected, {
        count: String(conflicts.length),
      }),
      weight: 0.3,
      contribution: clampScore(conflictPenalty * 100),
      direction: conflicts.length > 0 ? "contradicts" : "neutral",
    },
    {
      id: evidenceId("brand_fit_confidence", 2),
      label: formatIntelligenceTemplate(copy.recommendations.aestheticMatches, {
        count: String(aestheticHits.length),
      }),
      weight: 0.2,
      contribution: clampScore(aestheticHits.length * 25),
      direction: aestheticHits.length > 0 ? "supports" : "neutral",
    },
  ];

  return makeScore("brand_fit_confidence", score,
    conflicts.length > aligned.length
      ? formatIntelligenceTemplate(copy.recommendations.brandFitMisaligned, {
          tier: tierLabel(scoreToTier(score), ctx.locale),
        })
      : formatIntelligenceTemplate(copy.recommendations.brandFitAligned, {
          tier: tierLabel(scoreToTier(score), ctx.locale),
          count: String(aligned.length),
        }),
    evidence,
    ctx.locale,
  );
}

function scoreSourceAgreement(ctx: ScoringContext): ConfidenceScore {
  const { terms, hasData } = ctx;
  if (!hasData || terms.length === 0) {
    return makeScore("source_agreement", 0,
      "Insufficient cross-source observations to measure agreement.",
      [],
    );
  }

  const byTerm = new Map<string, TermObservation[]>();
  for (const term of terms) {
    if (!term.term) continue;
    const bucket = byTerm.get(term.term) ?? [];
    bucket.push(term);
    byTerm.set(term.term, bucket);
  }

  let comparable = 0;
  let aligned = 0;
  const disagreementExamples: string[] = [];

  for (const [term, observations] of byTerm) {
    const uniqueSources = [...new Set(observations.map((item) => item.sourceKey))];
    if (uniqueSources.length < 2) continue;

    for (let i = 0; i < observations.length; i += 1) {
      for (let j = i + 1; j < observations.length; j += 1) {
        if (observations[i].sourceKey === observations[j].sourceKey) continue;
        comparable += 1;
        if (directionsAgree(observations[i].direction, observations[j].direction)) {
          aligned += 1;
        } else {
          disagreementExamples.push(term);
        }
      }
    }
  }

  const agreementRatio = safeRatio(aligned, comparable);
  const score = comparable > 0 ? clampScore(agreementRatio * 100) : clampScore(ctx.sourceKeys.length * 8);

  const copy = getIntelligenceCopy(ctx.locale);
  const evidence: ConfidenceEvidence[] = [
    {
      id: evidenceId("source_agreement", 0),
      label: formatIntelligenceTemplate(copy.recommendations.alignedDirectionPairs, {
        count: String(aligned),
      }),
      weight: 0.6,
      contribution: clampScore(agreementRatio * 100),
      direction: aligned > 0 ? "supports" : "neutral",
    },
    {
      id: evidenceId("source_agreement", 1),
      label: formatIntelligenceTemplate(copy.recommendations.conflictingDirectionPairs, {
        count: String(comparable - aligned),
      }),
      weight: 0.4,
      contribution: clampScore(safeRatio(comparable - aligned, Math.max(comparable, 1)) * 100),
      direction: comparable - aligned > aligned ? "contradicts" : "neutral",
    },
  ];

  if (disagreementExamples.length > 0) {
    evidence.push({
      id: evidenceId("source_agreement", 2),
      label: formatIntelligenceTemplate(copy.recommendations.disagreementOn, {
        terms: uniqueTerms(disagreementExamples).slice(0, 3).join(", "),
      }),
      weight: 0.2,
      contribution: clampScore(disagreementExamples.length * 5),
      direction: "contradicts",
    });
  }

  return makeScore("source_agreement", score,
    comparable > 0
      ? formatIntelligenceTemplate(copy.recommendations.sourceAgreementVerified, {
          tier: tierLabel(scoreToTier(score), ctx.locale),
          count: String(comparable),
        })
      : copy.recommendations.sourceAgreementLimited,
    evidence,
    ctx.locale,
  );
}

function scoreSourceDiversity(ctx: ScoringContext): ConfidenceScore {
  const { sourceKeys, hasData } = ctx;
  if (!hasData) {
    return makeScore("source_diversity", 0,
      "No providers contributed intelligence.",
      [],
    );
  }

  const roles = new Set(
    sourceKeys.map((key) => getSourceWeightProfile(key).role),
  );
  const coverageScore = clampScore(safeRatio(sourceKeys.length, KNOWN_SOURCE_COUNT) * 100);
  const roleScore = clampScore(safeRatio(roles.size, 6) * 100);
  const score = clampScore(coverageScore * 0.55 + roleScore * 0.45);

  const evidence: ConfidenceEvidence[] = sourceKeys.map((sourceKey, index) => ({
    id: evidenceId("source_diversity", index),
    label: `${getSourceWeightProfile(sourceKey).label} (${roleLabelLocalized(getSourceWeightProfile(sourceKey).role, ctx.locale)})`,
    sourceKey,
    weight: getSourceWeight(sourceKey),
    contribution: clampScore(getSourceWeight(sourceKey) * 100),
    direction: "supports",
  }));

  return makeScore("source_diversity", score,
    `${sourceKeys.length} of ${KNOWN_SOURCE_COUNT} known sources contributed across ${roles.size} intelligence roles.`,
    evidence,
  );
}

function scoreSaturationRisk(ctx: ScoringContext): ConfidenceScore {
  const { intelligence, terms, hasData } = ctx;
  if (!hasData) {
    return makeScore("saturation_risk", 0,
      "No saturation signal — intelligence landscape is empty.",
      [],
    );
  }

  const termCounts = new Map<string, number>();
  for (const term of terms) {
    if (!term.term) continue;
    termCounts.set(term.term, (termCounts.get(term.term) ?? 0) + 1);
  }

  const repeatedTerms = [...termCounts.entries()].filter(([, count]) => count >= 3);
  const stableDensity = intelligence.trends.stable.length;
  const totalClusters =
    intelligence.trends.rising.length +
    intelligence.trends.stable.length +
    intelligence.trends.declining.length +
    intelligence.trends.emerging.length;

  const repetitionScore = clampScore(
    safeRatio(repeatedTerms.length, Math.max(termCounts.size, 1)) * 100,
  );
  const stableShare = clampScore(safeRatio(stableDensity, Math.max(totalClusters, 1)) * 100);
  const score = clampScore(repetitionScore * 0.55 + stableShare * 0.45);

  const evidence: ConfidenceEvidence[] = [
    {
      id: evidenceId("saturation_risk", 0),
      label: `${repeatedTerms.length} terms repeated across 3+ observations`,
      weight: 0.55,
      contribution: repetitionScore,
      direction: repeatedTerms.length > 0 ? "contradicts" : "neutral",
    },
    {
      id: evidenceId("saturation_risk", 1),
      label: `${stableDensity} stable trend clusters`,
      weight: 0.45,
      contribution: stableShare,
      direction: stableDensity > intelligence.trends.emerging.length ? "contradicts" : "neutral",
    },
  ];

  return makeScore("saturation_risk", score,
    score >= 65
      ? "Saturation risk is elevated — repeated terms and stable clusters suggest the market is already crowded."
      : "Saturation risk is moderate to low — limited repetition across the fused intelligence landscape.",
    evidence,
  );
}

function scoreNovelty(ctx: ScoringContext): ConfidenceScore {
  const { intelligence, hasData } = ctx;
  if (!hasData) {
    return makeScore("novelty", 0, "No novelty signal available.", []);
  }

  const emerging = intelligence.trends.emerging.length;
  const rising = intelligence.trends.rising.length;
  const declining = intelligence.trends.declining.length;
  const total = emerging + rising + intelligence.trends.stable.length + declining;

  const emergingShare = safeRatio(emerging + rising * 0.5, Math.max(total, 1));
  const saturation = scoreSaturationRisk(ctx).score;
  const score = clampScore(emergingShare * 100 * 0.7 + (100 - saturation) * 0.3);

  return makeScore("novelty", score,
    emerging > declining
      ? `Novelty is ${scoreToTier(score)} with ${emerging} emerging clusters ahead of ${declining} declining signals.`
      : `Novelty is ${scoreToTier(score)} — emerging signals are limited relative to established or declining patterns.`,
    [
      {
        id: evidenceId("novelty", 0),
        label: `${emerging} emerging trend clusters`,
        weight: 0.5,
        contribution: clampScore(emergingShare * 100),
        direction: emerging > 0 ? "supports" : "neutral",
      },
      {
        id: evidenceId("novelty", 1),
        label: `Inverse saturation contribution (${100 - saturation})`,
        weight: 0.5,
        contribution: 100 - saturation,
        direction: saturation < 50 ? "supports" : "contradicts",
      },
    ],
  );
}

function scoreLongevity(ctx: ScoringContext): ConfidenceScore {
  const { intelligence, hasData } = ctx;
  if (!hasData) {
    return makeScore("longevity", 0, "No longevity signal available.", []);
  }

  const observations = [
    ...intelligence.trends.rising,
    ...intelligence.trends.stable,
    ...intelligence.trends.declining,
    ...intelligence.trends.emerging,
  ].flatMap((cluster) => cluster.observations);

  const weightedHorizon = weightedAverage(
    observations.map((observation) => ({
      value: horizonLongevityWeight(observation.horizon) * 100,
      weight: getSourceWeight(observation.provenance.sourceKey),
    })),
  );

  const stableWeight = clampScore(
    safeRatio(intelligence.trends.stable.length, Math.max(observations.length, 1)) * 100,
  );
  const decliningPenalty = clampScore(
    safeRatio(intelligence.trends.declining.length, Math.max(observations.length, 1)) * 100,
  );

  const score = clampScore(weightedHorizon * 0.5 + stableWeight * 0.35 - decliningPenalty * 0.15 + 15);

  return makeScore("longevity", score,
    `Longevity is ${scoreToTier(score)} based on structural and seasonal horizon mix with ${intelligence.trends.stable.length} stable anchors.`,
    [
      {
        id: evidenceId("longevity", 0),
        label: `Weighted horizon longevity (${Math.round(weightedHorizon)})`,
        weight: 0.5,
        contribution: weightedHorizon,
        direction: weightedHorizon >= 50 ? "supports" : "neutral",
      },
      {
        id: evidenceId("longevity", 1),
        label: `${intelligence.trends.stable.length} stable clusters`,
        weight: 0.35,
        contribution: stableWeight,
        direction: stableWeight >= 40 ? "supports" : "neutral",
      },
      {
        id: evidenceId("longevity", 2),
        label: `${intelligence.trends.declining.length} declining clusters`,
        weight: 0.15,
        contribution: decliningPenalty,
        direction: decliningPenalty > 30 ? "contradicts" : "neutral",
      },
    ],
  );
}

function scoreSeasonality(ctx: ScoringContext): ConfidenceScore {
  const { intelligence, signals, hasData } = ctx;
  if (!hasData) {
    return makeScore("seasonality", 0, "No seasonality signal available.", []);
  }

  const seasonalTags = signals.filter((signal) =>
    signal.tags.some((tag) => /season|peak|holiday|fw|ss/i.test(tag)),
  );
  const seasonalObservations = [
    ...intelligence.trends.rising,
    ...intelligence.trends.stable,
    ...intelligence.trends.emerging,
  ]
    .flatMap((cluster) => cluster.observations)
    .filter((observation) => observation.horizon === "seasonal");

  const narrativeHits = intelligence.market.demandNarratives.filter((narrative) =>
    /season|peak|holiday|quarter/i.test(narrative),
  );

  const tagScore = clampScore(safeRatio(seasonalTags.length, Math.max(signals.length, 1)) * 100);
  const obsScore = clampScore(seasonalObservations.length * 12);
  const narrativeScore = clampScore(narrativeHits.length * 20);
  const score = clampScore(tagScore * 0.4 + obsScore * 0.35 + narrativeScore * 0.25);

  return makeScore("seasonality", score,
    score >= 50
      ? `Seasonality is ${scoreToTier(score)} — seasonal tags, horizons, and demand narratives align.`
      : `Seasonality is ${scoreToTier(score)} — limited explicit seasonal framing in current intelligence.`,
    [
      {
        id: evidenceId("seasonality", 0),
        label: `${seasonalTags.length} season-tagged signals`,
        weight: 0.4,
        contribution: tagScore,
        direction: seasonalTags.length > 0 ? "supports" : "neutral",
      },
      {
        id: evidenceId("seasonality", 1),
        label: `${seasonalObservations.length} seasonal horizon observations`,
        weight: 0.35,
        contribution: obsScore,
        direction: seasonalObservations.length > 0 ? "supports" : "neutral",
      },
      {
        id: evidenceId("seasonality", 2),
        label: `${narrativeHits.length} seasonal demand narratives`,
        weight: 0.25,
        contribution: narrativeScore,
        direction: narrativeHits.length > 0 ? "supports" : "neutral",
      },
    ],
  );
}

function scoreLaunchReadiness(
  scores: Record<ConfidenceScoreId, ConfidenceScore>,
  locale: Locale = DEFAULT_LOCALE,
): ConfidenceScore {
  const copy = getIntelligenceCopy(locale);
  const saturation = scores.saturation_risk.score;
  const readiness = clampScore(
    scores.trend_confidence.score * 0.2 +
      scores.commercial_confidence.score * 0.25 +
      scores.brand_fit_confidence.score * 0.2 +
      scores.source_agreement.score * 0.15 +
      (100 - saturation) * 0.1 +
      scores.source_diversity.score * 0.1,
  );

  return makeScore(
    "launch_readiness",
    readiness,
    formatIntelligenceTemplate(copy.confidence.launchReadinessComposite, {
      tier: tierLabel(scoreToTier(readiness), locale),
    }),
    [
      {
        id: evidenceId("launch_readiness", 0),
        label: "Composite of trend, commercial, and brand-fit confidence",
        weight: 0.65,
        contribution: clampScore(
          (scores.trend_confidence.score +
            scores.commercial_confidence.score +
            scores.brand_fit_confidence.score) /
            3,
        ),
        direction: readiness >= 50 ? "supports" : "neutral",
      },
      {
        id: evidenceId("launch_readiness", 1),
        label: "Agreement and diversity modifiers",
        weight: 0.25,
        contribution: clampScore(
          (scores.source_agreement.score + scores.source_diversity.score) / 2,
        ),
        direction: "neutral",
      },
      {
        id: evidenceId("launch_readiness", 2),
        label: `Saturation headroom (${100 - saturation})`,
        weight: 0.1,
        contribution: 100 - saturation,
        direction: saturation < 50 ? "supports" : "contradicts",
      },
    ],
    locale,
  );
}

function buildDomainConfidence(
  ctx: ScoringContext,
  scores: Record<ConfidenceScoreId, ConfidenceScore>,
): DomainConfidence[] {
  const domains: DomainConfidence[] = [
    {
      domain: "trend",
      tier: scores.trend_confidence.tier,
      score: scores.trend_confidence.score,
      factors: scores.trend_confidence.evidence.map((item) => ({
        id: item.id,
        label: item.label,
        weight: item.weight,
        rationale: `Contribution ${item.contribution} (${item.direction})`,
      })),
    },
    {
      domain: "commercial",
      tier: scores.commercial_confidence.tier,
      score: scores.commercial_confidence.score,
      factors: scores.commercial_confidence.evidence.map((item) => ({
        id: item.id,
        label: item.label,
        weight: item.weight,
        rationale: `Contribution ${item.contribution} (${item.direction})`,
      })),
    },
    {
      domain: "brand",
      tier: scores.brand_fit_confidence.tier,
      score: scores.brand_fit_confidence.score,
      factors: scores.brand_fit_confidence.evidence.map((item) => ({
        id: item.id,
        label: item.label,
        weight: item.weight,
        rationale: `Contribution ${item.contribution} (${item.direction})`,
      })),
    },
    {
      domain: "market",
      tier: scores.seasonality.tier,
      score: scores.seasonality.score,
      factors: scores.seasonality.evidence.map((item) => ({
        id: item.id,
        label: item.label,
        weight: item.weight,
        rationale: `Contribution ${item.contribution} (${item.direction})`,
      })),
    },
  ];

  if (!ctx.hasData) {
    return domains.map((domain) => ({
      ...domain,
      tier: "low",
      score: 0,
      factors: [],
    }));
  }

  return domains;
}

function buildCaveats(ctx: ScoringContext, scores: Record<ConfidenceScoreId, ConfidenceScore>): string[] {
  const copy = getIntelligenceCopy(ctx.locale);
  const caveats: string[] = [];
  if (!ctx.hasData) {
    caveats.push(copy.confidence.noProvidersBaseline);
    return caveats;
  }
  if (ctx.sourceKeys.length < 3) {
    caveats.push(copy.confidence.limitedSourceDiversity);
  }
  if (scores.source_agreement.score < 40) {
    caveats.push(copy.confidence.sourceDisagreement);
  }
  if (scores.saturation_risk.score >= 70) {
    caveats.push(copy.confidence.elevatedSaturation);
  }
  if (!ctx.sourceKeys.includes("shopify")) {
    caveats.push(copy.confidence.shopifyAbsent);
  }
  if (ctx.intelligence.manifest.simulatedProviderCount > 0) {
    caveats.push(
      formatIntelligenceTemplate(copy.confidence.simulatedProviders, {
        count: String(ctx.intelligence.manifest.simulatedProviderCount),
      }),
    );
  }
  return caveats;
}

export function computeConfidenceIntelligence(
  intelligence: UnifiedResearchIntelligence,
): ConfidenceIntelligence {
  const ctx = buildScoringContext(intelligence);

  const partialScores = {
    trend_confidence: scoreTrendConfidence(ctx),
    commercial_confidence: scoreCommercialConfidence(ctx),
    brand_fit_confidence: scoreBrandFitConfidence(ctx),
    source_agreement: scoreSourceAgreement(ctx),
    source_diversity: scoreSourceDiversity(ctx),
    saturation_risk: scoreSaturationRisk(ctx),
    novelty: scoreNovelty(ctx),
    longevity: scoreLongevity(ctx),
    seasonality: scoreSeasonality(ctx),
  } satisfies Omit<Record<ConfidenceScoreId, ConfidenceScore>, "launch_readiness">;

  const scores = {
    ...partialScores,
    launch_readiness: scoreLaunchReadiness(
      {
        ...partialScores,
        launch_readiness: makeScore("launch_readiness", 0, "", [], ctx.locale),
      },
      ctx.locale,
    ),
  } as Record<ConfidenceScoreId, ConfidenceScore>;

  const coreAverage = weightedAverage(
    CONFIDENCE_SCORE_IDS.filter((id) => id !== "saturation_risk" && id !== "launch_readiness").map(
      (id) => ({
        value: scores[id].score,
        weight: id === "source_agreement" || id === "source_diversity" ? 0.8 : 1,
      }),
    ),
  );
  const overallScore = clampScore(
    coreAverage * 0.85 + scores.launch_readiness.score * 0.15 - scores.saturation_risk.score * 0.1,
  );

  return localizeConfidenceIntelligence(
    {
      overall: scoreToTier(overallScore),
      overallScore,
      scores,
      domains: buildDomainConfidence(ctx, scores),
      caveats: buildCaveats(ctx, scores),
    },
    ctx.locale,
  );
}
