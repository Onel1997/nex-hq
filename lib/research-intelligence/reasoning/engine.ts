import { MILAENE_BRAND_PROFILE, termConflictsBrandFit, termMatchesBrandFit } from "../confidence/brand-profile";
import { directionsAgree, normalizeTerm, uniqueTerms } from "../confidence/scoring-utils";
import {
  getSourceWeightProfile,
} from "../confidence/source-weights";
import {
  formatIntelligenceTemplate,
  getIntelligenceCopy,
  roleLabelLocalized,
  tierLabel,
} from "../copy";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/config";
import type { ConfidenceIntelligence, ConfidenceScoreId } from "../types/confidence";
import type { UnifiedResearchIntelligence } from "../types/unified";
import type {
  BrandFitReasoning,
  ResearchReasoningIntelligence,
  RiskReasoning,
  ScoreEvidenceSummary,
  SourceReasoning,
} from "../types/reasoning";
import { RESEARCH_REASONING_VERSION } from "../types/reasoning";

export const REASONING_LAYER_VERSION = RESEARCH_REASONING_VERSION;

export interface ReasoningContext {
  workspaceId?: string;
  locale?: Locale;
  generatedAt: string;
}

function buildTrendSignificance(
  intelligence: UnifiedResearchIntelligence,
  confidence: ConfidenceIntelligence,
  locale: Locale = DEFAULT_LOCALE,
): string[] {
  const copy = getIntelligenceCopy(locale);
  const lines: string[] = [];
  const rising = intelligence.trends.rising.length + intelligence.trends.emerging.length;
  const declining = intelligence.trends.declining.length;

  if (rising === 0 && intelligence.signals.length === 0) {
    return [copy.reasoning.emptyTrendLandscape];
  }

  if (rising > 0) {
    const topRising = [
      ...intelligence.trends.rising,
      ...intelligence.trends.emerging,
    ]
      .slice(0, 3)
      .map((cluster) => cluster.label);
    const terms =
      topRising.length > 0 ? `: ${topRising.join(", ")}` : "";
    lines.push(
      formatIntelligenceTemplate(copy.reasoning.risingClusters, {
        count: rising,
        terms,
      }),
    );
  }

  if (confidence.scores.trend_confidence.score >= 65) {
    lines.push(
      formatIntelligenceTemplate(copy.reasoning.trendConfidenceHigh, {
        tier: tierLabel(confidence.scores.trend_confidence.tier, locale),
        score: confidence.scores.trend_confidence.score,
      }),
    );
  } else if (confidence.scores.trend_confidence.score > 0) {
    lines.push(
      formatIntelligenceTemplate(copy.reasoning.trendConfidencePartial, {
        tier: tierLabel(confidence.scores.trend_confidence.tier, locale),
        score: confidence.scores.trend_confidence.score,
      }),
    );
  }

  if (declining > rising) {
    lines.push(
      formatIntelligenceTemplate(copy.reasoning.decliningDominant, {
        declining,
      }),
    );
  }

  if (intelligence.trends.opportunities.length > 0) {
    lines.push(
      formatIntelligenceTemplate(copy.reasoning.opportunityTerms, {
        terms: intelligence.trends.opportunities.slice(0, 5).join(", "),
      }),
    );
  }

  return lines;
}

function collectTermDirections(
  intelligence: UnifiedResearchIntelligence,
): Map<string, Map<string, import("../types/signals").SignalDirection>> {
  const map = new Map<string, Map<string, import("../types/signals").SignalDirection>>();

  for (const signal of intelligence.signals) {
    const term = normalizeTerm(signal.label);
    if (!term) continue;
    const sourceKey = String(signal.provenance.sourceKey);
    const bucket = map.get(term) ?? new Map();
    bucket.set(sourceKey, signal.direction);
    map.set(term, bucket);
  }

  return map;
}

function buildSourceReasoning(
  intelligence: UnifiedResearchIntelligence,
  confidence: ConfidenceIntelligence,
  mode: "confirming" | "disagreeing",
  locale: Locale = DEFAULT_LOCALE,
): SourceReasoning[] {
  const copy = getIntelligenceCopy(locale);
  const termDirections = collectTermDirections(intelligence);
  const bySource = new Map<string, { supports: string[]; contradicts: string[]; evidenceIds: string[] }>();

  for (const [term, sources] of termDirections) {
    const entries = [...sources.entries()];
    if (entries.length < 2) continue;

    for (let i = 0; i < entries.length; i += 1) {
      for (let j = i + 1; j < entries.length; j += 1) {
        const [sourceA, directionA] = entries[i];
        const [sourceB, directionB] = entries[j];
        const agree = directionsAgree(directionA, directionB);

        if (mode === "confirming" && agree) {
          for (const sourceKey of [sourceA, sourceB]) {
            const bucket = bySource.get(sourceKey) ?? { supports: [], contradicts: [], evidenceIds: [] };
            bucket.supports.push(term);
            bySource.set(sourceKey, bucket);
          }
        }
        if (mode === "disagreeing" && !agree) {
          for (const sourceKey of [sourceA, sourceB]) {
            const bucket = bySource.get(sourceKey) ?? { supports: [], contradicts: [], evidenceIds: [] };
            bucket.contradicts.push(term);
            bySource.set(sourceKey, bucket);
          }
        }
      }
    }
  }

  for (const signal of intelligence.signals) {
    const sourceKey = String(signal.provenance.sourceKey);
    const bucket = bySource.get(sourceKey) ?? { supports: [], contradicts: [], evidenceIds: [] };
    bucket.evidenceIds.push(signal.id);
    bySource.set(sourceKey, bucket);
  }

  const results: SourceReasoning[] = [];

  for (const [sourceKey, bucket] of bySource) {
    const profile = getSourceWeightProfile(sourceKey);
    const terms = mode === "confirming" ? bucket.supports : bucket.contradicts;
    if (terms.length === 0 && mode === "disagreeing") continue;
    if (mode === "confirming" && terms.length === 0 && bucket.evidenceIds.length === 0) continue;

    const unique = uniqueTerms(terms);
    const role = roleLabelLocalized(profile.role, locale);
    const summary =
      mode === "confirming"
        ? unique.length > 0
          ? formatIntelligenceTemplate(copy.reasoning.sourceConfirms, {
              provider: profile.label,
              terms: unique.slice(0, 4).join(", "),
              role,
            })
          : formatIntelligenceTemplate(copy.reasoning.sourceContributes, {
              provider: profile.label,
              count: bucket.evidenceIds.length,
              role,
            })
        : formatIntelligenceTemplate(copy.reasoning.sourceDiverges, {
            provider: profile.label,
            terms: unique.slice(0, 4).join(", "),
          });

    if (mode === "disagreeing" && unique.length === 0) continue;

    results.push({
      sourceKey,
      role: profile.role,
      summary,
      evidenceIds: [...new Set(bucket.evidenceIds)].slice(0, 12),
      weight: profile.weight,
    });
  }

  if (mode === "confirming" && results.length === 0) {
    for (const contribution of intelligence.manifest.contributions) {
      const sourceKey = String(contribution.sourceKey);
      const profile = getSourceWeightProfile(sourceKey);
      results.push({
        sourceKey,
        role: profile.role,
        summary: formatIntelligenceTemplate(copy.reasoning.sourceContributed, {
          provider: profile.label,
          count: contribution.signalCount,
          role: roleLabelLocalized(profile.role, locale),
        }),
        evidenceIds: intelligence.signals
          .filter((signal) => String(signal.provenance.sourceKey) === sourceKey)
          .map((signal) => signal.id)
          .slice(0, 8),
        weight: profile.weight,
      });
    }
  }

  return results.sort((a, b) => b.weight - a.weight);
}

function buildRisks(
  confidence: ConfidenceIntelligence,
  locale: Locale = DEFAULT_LOCALE,
): RiskReasoning[] {
  const copy = getIntelligenceCopy(locale);
  const risks: RiskReasoning[] = [];

  if (confidence.scores.saturation_risk.score >= 60) {
    risks.push({
      id: "saturation",
      label: copy.risks.marketSaturation,
      severity: confidence.scores.saturation_risk.score >= 80 ? "high" : "medium",
      reason: confidence.scores.saturation_risk.rationale,
      relatedScoreIds: ["saturation_risk"],
    });
  }

  if (confidence.scores.source_agreement.score < 45) {
    risks.push({
      id: "source-disagreement",
      label: copy.risks.sourceDisagreement,
      severity: confidence.scores.source_agreement.score < 25 ? "high" : "medium",
      reason: confidence.scores.source_agreement.rationale,
      relatedScoreIds: ["source_agreement"],
    });
  }

  if (confidence.scores.brand_fit_confidence.score < 40) {
    risks.push({
      id: "brand-misfit",
      label: copy.risks.brandMisalignment,
      severity: confidence.scores.brand_fit_confidence.score < 20 ? "high" : "medium",
      reason: confidence.scores.brand_fit_confidence.rationale,
      relatedScoreIds: ["brand_fit_confidence"],
    });
  }

  if (confidence.scores.commercial_confidence.score < 35) {
    risks.push({
      id: "weak-commercial",
      label: copy.risks.weakCommercial,
      severity: "medium",
      reason: confidence.scores.commercial_confidence.rationale,
      relatedScoreIds: ["commercial_confidence"],
    });
  }

  if (confidence.scores.longevity.score < 35) {
    risks.push({
      id: "short-lived",
      label: copy.risks.shortLivedTrend,
      severity: "low",
      reason: confidence.scores.longevity.rationale,
      relatedScoreIds: ["longevity"],
    });
  }

  return risks;
}

function buildBrandFitReasoning(
  intelligence: UnifiedResearchIntelligence,
  confidence: ConfidenceIntelligence,
  locale: Locale = DEFAULT_LOCALE,
): BrandFitReasoning {
  const copy = getIntelligenceCopy(locale);
  const candidateTerms = uniqueTerms([
    ...intelligence.signals.map((signal) => signal.label),
    ...intelligence.brand.culturalSignals,
    ...intelligence.trends.opportunities,
  ]);

  const alignedSignals = candidateTerms.filter(termMatchesBrandFit);
  const misalignedSignals = candidateTerms.filter(termConflictsBrandFit);
  const score = confidence.scores.brand_fit_confidence.score;
  const fits = score >= 50 && alignedSignals.length >= misalignedSignals.length;

  let summary: string;
  if (candidateTerms.length === 0) {
    summary = copy.reasoning.brandFitInsufficient;
  } else if (fits) {
    summary = formatIntelligenceTemplate(copy.reasoning.brandFitAligned, {
      brand: MILAENE_BRAND_PROFILE.name,
      count: alignedSignals.length,
    });
  } else {
    summary = formatIntelligenceTemplate(copy.reasoning.brandFitTension, {
      brand: MILAENE_BRAND_PROFILE.name,
      misaligned: misalignedSignals.length,
      aligned: alignedSignals.length,
    });
  }

  return {
    fits,
    score,
    tier: score >= 65 ? "high" : score >= 35 ? "medium" : "low",
    alignedSignals: alignedSignals.slice(0, 8),
    misalignedSignals: misalignedSignals.slice(0, 8),
    summary,
  };
}

function buildScoreEvidence(confidence: ConfidenceIntelligence): ScoreEvidenceSummary[] {
  return (Object.keys(confidence.scores) as ConfidenceScoreId[]).map((scoreId) => {
    const score = confidence.scores[scoreId];
    return {
      scoreId,
      label: score.label,
      score: score.score,
      tier: score.tier,
      rationale: score.rationale,
      evidence: score.evidence.map(
        (item) =>
          `${item.label} (weight ${item.weight}, contribution ${item.contribution}, ${item.direction})`,
      ),
    };
  });
}

function buildNarratives(
  intelligence: UnifiedResearchIntelligence,
  confidence: ConfidenceIntelligence,
  brandFit: BrandFitReasoning,
  confirming: SourceReasoning[],
  risks: RiskReasoning[],
  locale: Locale = DEFAULT_LOCALE,
): string[] {
  const copy = getIntelligenceCopy(locale);
  const narratives: string[] = [];

  if (intelligence.manifest.providerCount === 0) {
    return [copy.reasoning.noProviders];
  }

  narratives.push(
    formatIntelligenceTemplate(copy.reasoning.fusedSummary, {
      providers: intelligence.manifest.providerCount,
      tier: tierLabel(confidence.overall, locale),
      score: confidence.overallScore,
    }),
  );

  if (confirming.length > 0) {
    narratives.push(
      formatIntelligenceTemplate(copy.reasoning.confirmingSources, {
        summaries: confirming
          .slice(0, 3)
          .map((item) => item.summary)
          .join("; "),
      }),
    );
  }

  narratives.push(brandFit.summary);

  if (risks.length > 0) {
    narratives.push(
      formatIntelligenceTemplate(copy.reasoning.keyRisks, {
        risks: risks.map((risk) => risk.label).join(", "),
      }),
    );
  } else {
    narratives.push(copy.reasoning.noElevatedRisks);
  }

  narratives.push(
    formatIntelligenceTemplate(copy.reasoning.launchReadinessNote, {
      score: confidence.scores.launch_readiness.score,
      tier: tierLabel(confidence.scores.launch_readiness.tier, locale),
    }),
  );

  return narratives;
}

export function computeResearchReasoning(
  intelligence: UnifiedResearchIntelligence,
  confidence: ConfidenceIntelligence,
  context: ReasoningContext,
): ResearchReasoningIntelligence {
  const locale = context.locale ?? DEFAULT_LOCALE;
  const copy = getIntelligenceCopy(locale);
  const confirmingSources = buildSourceReasoning(intelligence, confidence, "confirming", locale);
  const disagreeingSources = buildSourceReasoning(intelligence, confidence, "disagreeing", locale);
  const brandFit = buildBrandFitReasoning(intelligence, confidence, locale);
  const risks = buildRisks(confidence, locale);
  const trendSignificance = buildTrendSignificance(intelligence, confidence, locale);
  const scoreEvidence = buildScoreEvidence(confidence);

  const caveats = [...confidence.caveats];
  if (disagreeingSources.length > 0) {
    caveats.push(
      formatIntelligenceTemplate(copy.confidence.disagreeingSources, {
        count: String(disagreeingSources.length),
      }),
    );
  }

  return {
    version: RESEARCH_REASONING_VERSION,
    generatedAt: context.generatedAt,
    trendSignificance,
    confirmingSources,
    disagreeingSources,
    risks,
    brandFit,
    scoreEvidence,
    narratives: buildNarratives(
      intelligence,
      confidence,
      brandFit,
      confirmingSources,
      risks,
      locale,
    ),
    caveats,
  };
}
