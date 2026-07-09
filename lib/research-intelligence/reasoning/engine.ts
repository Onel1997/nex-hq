import { MILAENE_BRAND_PROFILE, termConflictsBrandFit, termMatchesBrandFit } from "../confidence/brand-profile";
import { directionsAgree, normalizeTerm, uniqueTerms } from "../confidence/scoring-utils";
import {
  getSourceWeightProfile,
  roleLabel,
} from "../confidence/source-weights";
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
  locale?: string;
  generatedAt: string;
}

function buildTrendSignificance(
  intelligence: UnifiedResearchIntelligence,
  confidence: ConfidenceIntelligence,
): string[] {
  const lines: string[] = [];
  const rising = intelligence.trends.rising.length + intelligence.trends.emerging.length;
  const declining = intelligence.trends.declining.length;

  if (rising === 0 && intelligence.signals.length === 0) {
    return ["No trend landscape detected — intelligence feed is empty."];
  }

  if (rising > 0) {
    const topRising = [
      ...intelligence.trends.rising,
      ...intelligence.trends.emerging,
    ]
      .slice(0, 3)
      .map((cluster) => cluster.label);
    lines.push(
      `${rising} rising or emerging trend cluster(s) indicate directional momentum${topRising.length ? `: ${topRising.join(", ")}` : ""}.`,
    );
  }

  if (confidence.scores.trend_confidence.score >= 65) {
    lines.push(
      `Trend confidence is ${confidence.scores.trend_confidence.tier} (${confidence.scores.trend_confidence.score}/100) — multiple sources reinforce the same directional shift.`,
    );
  } else if (confidence.scores.trend_confidence.score > 0) {
    lines.push(
      `Trend confidence is ${confidence.scores.trend_confidence.tier} (${confidence.scores.trend_confidence.score}/100) — momentum exists but cross-source reinforcement is partial.`,
    );
  }

  if (declining > rising) {
    lines.push(
      `Declining clusters (${declining}) outnumber rising signals — the trend landscape may be rotating away from these themes.`,
    );
  }

  if (intelligence.trends.opportunities.length > 0) {
    lines.push(
      `Opportunity terms surfaced: ${intelligence.trends.opportunities.slice(0, 5).join(", ")}.`,
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
): SourceReasoning[] {
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
    const summary =
      mode === "confirming"
        ? unique.length > 0
          ? `${profile.label} confirms momentum on ${unique.slice(0, 4).join(", ")} as ${roleLabel(profile.role)}.`
          : `${profile.label} contributes ${bucket.evidenceIds.length} supporting signal(s) as ${roleLabel(profile.role)}.`
        : `${profile.label} diverges on ${unique.slice(0, 4).join(", ")} — directional conflict with peer sources.`;

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
        summary: `${profile.label} contributed ${contribution.signalCount} signal(s) as ${roleLabel(profile.role)}.`,
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

function buildRisks(confidence: ConfidenceIntelligence): RiskReasoning[] {
  const risks: RiskReasoning[] = [];

  if (confidence.scores.saturation_risk.score >= 60) {
    risks.push({
      id: "saturation",
      label: "Market saturation",
      severity: confidence.scores.saturation_risk.score >= 80 ? "high" : "medium",
      reason: confidence.scores.saturation_risk.rationale,
      relatedScoreIds: ["saturation_risk"],
    });
  }

  if (confidence.scores.source_agreement.score < 45) {
    risks.push({
      id: "source-disagreement",
      label: "Source disagreement",
      severity: confidence.scores.source_agreement.score < 25 ? "high" : "medium",
      reason: confidence.scores.source_agreement.rationale,
      relatedScoreIds: ["source_agreement"],
    });
  }

  if (confidence.scores.brand_fit_confidence.score < 40) {
    risks.push({
      id: "brand-misfit",
      label: "Milaene brand misalignment",
      severity: confidence.scores.brand_fit_confidence.score < 20 ? "high" : "medium",
      reason: confidence.scores.brand_fit_confidence.rationale,
      relatedScoreIds: ["brand_fit_confidence"],
    });
  }

  if (confidence.scores.commercial_confidence.score < 35) {
    risks.push({
      id: "weak-commercial",
      label: "Weak commercial validation",
      severity: "medium",
      reason: confidence.scores.commercial_confidence.rationale,
      relatedScoreIds: ["commercial_confidence"],
    });
  }

  if (confidence.scores.longevity.score < 35) {
    risks.push({
      id: "short-lived",
      label: "Short-lived trend risk",
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
): BrandFitReasoning {
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
    summary = "Insufficient intelligence to assess Milaene brand fit.";
  } else if (fits) {
    summary = `Trend landscape aligns with ${MILAENE_BRAND_PROFILE.name}'s quiet luxury and archive streetwear DNA — ${alignedSignals.length} reinforcing cue(s) detected.`;
  } else {
    summary = `Trend landscape shows tension with ${MILAENE_BRAND_PROFILE.name} positioning — ${misalignedSignals.length} misaligned cue(s) vs ${alignedSignals.length} aligned.`;
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
): string[] {
  const narratives: string[] = [];

  if (intelligence.manifest.providerCount === 0) {
    return ["Research Director evaluation complete — no provider data to reason over."];
  }

  narratives.push(
    `Fused intelligence from ${intelligence.manifest.providerCount} provider(s) yields ${confidence.overall} overall confidence (${confidence.overallScore}/100).`,
  );

  if (confirming.length > 0) {
    narratives.push(
      `Strongest confirming sources: ${confirming.slice(0, 3).map((item) => item.summary.split(" as ")[0]).join("; ")}.`,
    );
  }

  narratives.push(brandFit.summary);

  if (risks.length > 0) {
    narratives.push(`Key risks: ${risks.map((risk) => risk.label).join(", ")}.`);
  } else {
    narratives.push("No elevated risk flags in the current scoring pass.");
  }

  narratives.push(
    `Launch readiness scored at ${confidence.scores.launch_readiness.score}/100 (${confidence.scores.launch_readiness.tier}) — scoring only, not a go-to-market recommendation.`,
  );

  return narratives;
}

export function computeResearchReasoning(
  intelligence: UnifiedResearchIntelligence,
  confidence: ConfidenceIntelligence,
  context: ReasoningContext,
): ResearchReasoningIntelligence {
  const confirmingSources = buildSourceReasoning(intelligence, confidence, "confirming");
  const disagreeingSources = buildSourceReasoning(intelligence, confidence, "disagreeing");
  const brandFit = buildBrandFitReasoning(intelligence, confidence);
  const risks = buildRisks(confidence);
  const trendSignificance = buildTrendSignificance(intelligence, confidence);
  const scoreEvidence = buildScoreEvidence(confidence);

  const caveats = [...confidence.caveats];
  if (disagreeingSources.length > 0) {
    caveats.push(
      `${disagreeingSources.length} source(s) show directional disagreement — review disagreeingSources for detail.`,
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
    ),
    caveats,
  };
}
