import type {
  ConnectorMode,
  ConnectorIntelligenceScores,
  IntelligenceSignal,
} from "./types";

/** Clamp and round a raw value into a 0–100 intelligence score. */
export function normalizeScore(value: number, min = 0, max = 100): number {
  if (max <= min) return 0;
  const normalized = ((value - min) / (max - min)) * 100;
  return Math.max(0, Math.min(100, Math.round(normalized)));
}

export interface ConfidenceInput {
  mode: ConnectorMode;
  sampleSize: number;
  /** 0–1 — how recent / complete the source payload is */
  freshness?: number;
  /** 0–1 — signal coherence (e.g. API success vs partial data) */
  dataQuality?: number;
}

/** Derive connector confidence from sample size, freshness, and live vs simulated mode. */
export function computeConfidence(input: ConfidenceInput): number {
  const freshness = input.freshness ?? 0.85;
  const dataQuality = input.dataQuality ?? 1;

  if (input.mode === "simulated") {
    return Math.round(Math.min(72, 58 + Math.min(14, input.sampleSize / 3)));
  }

  const base = 68;
  const sampleBoost = Math.min(22, input.sampleSize * 1.2);
  const freshBoost = freshness * 8;
  return Math.round(
    Math.min(98, (base + sampleBoost + freshBoost) * dataQuality),
  );
}

export type { ConnectorIntelligenceScores } from "./types";

/** Apply score normalization and attach confidence to a connector signal batch. */
export function normalizeSignals(
  signals: IntelligenceSignal[],
  confidence: number,
): IntelligenceSignal[] {
  return signals.map((signal) => ({
    ...signal,
    score: normalizeScore(signal.score),
    confidence: Math.round(
      normalizeScore(confidence * (0.85 + (signal.score / 100) * 0.15)),
    ),
  }));
}

/** Aggregate layer scores from normalized connector signals. */
export function aggregateConnectorScores(
  signals: IntelligenceSignal[],
  weights: {
    social?: number;
    demand?: number;
    trend?: number;
  },
  confidence: number,
): ConnectorIntelligenceScores {
  const social = signals.filter((s) => s.category === "social");
  const trend = signals.filter((s) => s.category === "trend");
  const demandPool = signals.filter(
    (s) =>
      s.category === "consumer" ||
      s.tags?.includes("demand") ||
      s.tags?.includes("keyword"),
  );

  const avg = (pool: IntelligenceSignal[], fallback: number) =>
    pool.length > 0
      ? Math.round(pool.reduce((sum, s) => sum + s.score, 0) / pool.length)
      : fallback;

  const socialScore = avg(social, 55);
  const trendScore = avg(trend, 55);
  const demandFromConsumer = avg(demandPool, trendScore);
  const demandScore = Math.round(
    trendScore * (weights.trend ?? 0.35) +
      demandFromConsumer * (weights.demand ?? 0.65),
  );

  return {
    socialScore,
    demandScore,
    trendScore,
    confidence,
  };
}
