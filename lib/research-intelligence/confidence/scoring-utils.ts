import type { SignalDirection } from "../types/signals";

export function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function scoreToTier(score: number): import("../types/confidence").ConfidenceTier {
  if (score >= 85) return "verified";
  if (score >= 65) return "high";
  if (score >= 35) return "medium";
  return "low";
}

export function normalizeTerm(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function uniqueTerms(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const term = normalizeTerm(value);
    if (!term || seen.has(term)) continue;
    seen.add(term);
    result.push(term);
  }
  return result;
}

const POSITIVE_DIRECTIONS = new Set<SignalDirection>(["up", "emerging"]);
const NEGATIVE_DIRECTIONS = new Set<SignalDirection>(["down", "declining"]);

export function directionPolarity(direction: SignalDirection): 1 | 0 | -1 {
  if (POSITIVE_DIRECTIONS.has(direction)) return 1;
  if (NEGATIVE_DIRECTIONS.has(direction)) return -1;
  return 0;
}

export function directionsAgree(
  a: SignalDirection,
  b: SignalDirection,
): boolean {
  const polarityA = directionPolarity(a);
  const polarityB = directionPolarity(b);
  if (polarityA === 0 || polarityB === 0) return true;
  return polarityA === polarityB;
}

export function weightedAverage(
  entries: Array<{ value: number; weight: number }>,
): number {
  if (entries.length === 0) return 0;
  let totalWeight = 0;
  let total = 0;
  for (const entry of entries) {
    if (!Number.isFinite(entry.value) || !Number.isFinite(entry.weight)) continue;
    totalWeight += entry.weight;
    total += entry.value * entry.weight;
  }
  if (totalWeight === 0) return 0;
  return total / totalWeight;
}

export function safeRatio(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return numerator / denominator;
}

export function strengthToScore(strength: "weak" | "moderate" | "strong"): number {
  switch (strength) {
    case "strong":
      return 85;
    case "moderate":
      return 60;
    case "weak":
      return 30;
    default:
      return 0;
  }
}

/** Deterministic per-id offset for score differentiation without randomness. */
export function stableOffset(id: string, spread: number): number {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  const normalized = (Math.abs(hash) % 1000) / 1000;
  return Math.round((normalized * 2 - 1) * spread);
}

export function deriveBoundedScore(
  id: string,
  base: number,
  min: number,
  max: number,
  spread = 6,
): number {
  return clampScore(Math.max(min, Math.min(max, base + stableOffset(id, spread))));
}

export function horizonLongevityWeight(
  horizon: "immediate" | "seasonal" | "structural",
): number {
  switch (horizon) {
    case "structural":
      return 1;
    case "seasonal":
      return 0.65;
    case "immediate":
      return 0.35;
    default:
      return 0.5;
  }
}
