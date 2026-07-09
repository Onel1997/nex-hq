import { getSourceWeight, getSourceWeightProfile } from "../confidence/source-weights";
import { clampScore, normalizeTerm } from "../confidence/scoring-utils";
import type { NormalizedSignal, SignalDirection } from "../types/signals";
import type { TrendCluster, TrendIntelligence } from "../types/trends";
import type { UnifiedResearchIntelligence } from "../types/unified";

export interface WeightedItem<T> {
  item: T;
  sourceKey: string;
  weight: number;
  directionBoost: number;
  weightedScore: number;
}

export interface WeightedTerm {
  term: string;
  sourceKeys: string[];
  weight: number;
  weightedScore: number;
  signalIds: string[];
}

const POSITIVE_DIRECTIONS = new Set<SignalDirection>(["up", "emerging"]);

export function directionBoost(direction: SignalDirection): number {
  if (POSITIVE_DIRECTIONS.has(direction)) return 1;
  if (direction === "stable") return 0.55;
  return 0.2;
}

function mentionBoost(count?: number): number {
  if (count == null || count <= 0) return 1;
  return Math.min(1.5, 1 + Math.log10(count + 1) * 0.15);
}

export function rankSignalsByWeight(
  signals: NormalizedSignal[],
): WeightedItem<NormalizedSignal>[] {
  return signals
    .map((signal) => {
      const weight = getSourceWeight(signal.provenance.sourceKey);
      const boost = directionBoost(signal.direction);
      const weightedScore = clampScore(weight * boost * 100);
      return {
        item: signal,
        sourceKey: String(signal.provenance.sourceKey),
        weight,
        directionBoost: boost,
        weightedScore,
      };
    })
    .sort((a, b) => b.weightedScore - a.weightedScore);
}

export function rankTrendClusters(
  trends: TrendIntelligence,
): WeightedItem<TrendCluster>[] {
  const clusters = [
    ...trends.emerging.map((cluster) => ({ cluster, bucket: "emerging" as const })),
    ...trends.rising.map((cluster) => ({ cluster, bucket: "rising" as const })),
    ...trends.stable.map((cluster) => ({ cluster, bucket: "stable" as const })),
  ];

  return clusters
    .map(({ cluster, bucket }) => {
      const observation = cluster.observations[0];
      const sourceKey = observation
        ? String(observation.provenance.sourceKey)
        : "unknown";
      const weight = observation
        ? getSourceWeight(observation.provenance.sourceKey)
        : 0.5;
      const bucketBoost = bucket === "emerging" ? 1 : bucket === "rising" ? 0.9 : 0.55;
      const mention = mentionBoost(observation?.mentionCount);
      const weightedScore = clampScore(weight * bucketBoost * mention * 100);

      return {
        item: cluster,
        sourceKey,
        weight,
        directionBoost: bucketBoost,
        weightedScore,
      };
    })
    .sort((a, b) => b.weightedScore - a.weightedScore);
}

export function rankOpportunityTerms(
  intelligence: UnifiedResearchIntelligence,
): WeightedTerm[] {
  const map = new Map<string, WeightedTerm>();

  const ingest = (
    term: string,
    sourceKey: string,
    signalId?: string,
    direction: SignalDirection = "up",
  ) => {
    const normalized = normalizeTerm(term);
    if (!normalized) return;
    const weight = getSourceWeight(sourceKey);
    const score = weight * directionBoost(direction) * 100;
    const existing = map.get(normalized);
    if (existing) {
      existing.weightedScore = clampScore(existing.weightedScore + score * 0.35);
      existing.weight = Math.max(existing.weight, weight);
      if (!existing.sourceKeys.includes(sourceKey)) {
        existing.sourceKeys.push(sourceKey);
      }
      if (signalId && !existing.signalIds.includes(signalId)) {
        existing.signalIds.push(signalId);
      }
      return;
    }
    map.set(normalized, {
      term: normalized,
      sourceKeys: [sourceKey],
      weight,
      weightedScore: clampScore(score),
      signalIds: signalId ? [signalId] : [],
    });
  };

  for (const signal of intelligence.signals) {
    ingest(
      signal.label,
      String(signal.provenance.sourceKey),
      signal.id,
      signal.direction,
    );
    for (const entity of signal.entities) {
      ingest(
        entity.label,
        String(signal.provenance.sourceKey),
        signal.id,
        signal.direction,
      );
    }
  }

  for (const term of intelligence.trends.opportunities) {
    const ranked = rankSignalsByWeight(intelligence.signals);
    const top = ranked[0];
    ingest(term, top?.sourceKey ?? "unknown", top?.item.id);
  }

  return [...map.values()].sort((a, b) => b.weightedScore - a.weightedScore);
}

export function extractColorTerms(intelligence: UnifiedResearchIntelligence): WeightedTerm[] {
  const colors: WeightedTerm[] = [];

  for (const signal of intelligence.signals) {
    for (const entity of signal.entities) {
      if (entity.type !== "color") continue;
      const sourceKey = String(signal.provenance.sourceKey);
      const weight = getSourceWeight(signal.provenance.sourceKey);
      colors.push({
        term: normalizeTerm(entity.label),
        sourceKeys: [sourceKey],
        weight,
        weightedScore: clampScore(weight * directionBoost(signal.direction) * 100),
        signalIds: [signal.id],
      });
    }
    if (/color/i.test(signal.headline) || signal.tags.includes("color")) {
      const sourceKey = String(signal.provenance.sourceKey);
      colors.push({
        term: normalizeTerm(signal.label),
        sourceKeys: [sourceKey],
        weight: getSourceWeight(signal.provenance.sourceKey),
        weightedScore: clampScore(
          getSourceWeight(signal.provenance.sourceKey) * directionBoost(signal.direction) * 100,
        ),
        signalIds: [signal.id],
      });
    }
  }

  for (const narrative of intelligence.market.demandNarratives) {
    const match = narrative.match(/color signal · (.+)/i);
    if (!match) continue;
    colors.push({
      term: normalizeTerm(match[1]),
      sourceKeys: ["market"],
      weight: 0.6,
      weightedScore: 55,
      signalIds: [],
    });
  }

  for (const cultural of intelligence.brand.culturalSignals) {
    if (!/^[a-z\s-]+$/i.test(cultural) || cultural.length > 24) continue;
    colors.push({
      term: normalizeTerm(cultural),
      sourceKeys: ["brand"],
      weight: 0.55,
      weightedScore: 50,
      signalIds: [],
    });
  }

  const deduped = new Map<string, WeightedTerm>();
  for (const color of colors) {
    if (!color.term) continue;
    const existing = deduped.get(color.term);
    if (!existing) {
      deduped.set(color.term, color);
      continue;
    }
    existing.weightedScore = clampScore(existing.weightedScore + color.weightedScore * 0.25);
    existing.sourceKeys = [...new Set([...existing.sourceKeys, ...color.sourceKeys])];
    existing.signalIds = [...new Set([...existing.signalIds, ...color.signalIds])];
  }

  return [...deduped.values()].sort((a, b) => b.weightedScore - a.weightedScore);
}

export function buildSourceSupport(
  sourceKeys: string[],
  summaries: Record<string, string> = {},
): import("../types/recommendation").RecommendationSourceSupport[] {
  return [...new Set(sourceKeys)].map((sourceKey) => {
    const profile = getSourceWeightProfile(sourceKey);
    return {
      sourceKey,
      role: profile.role,
      weight: profile.weight,
      summary:
        summaries[sourceKey] ??
        `${profile.label} contributes as ${profile.role.replace(/_/g, " ")}.`,
    };
  });
}
