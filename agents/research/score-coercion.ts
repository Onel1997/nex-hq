/** Round a 0–100 score for display and persisted output. */
export function roundPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

/** Absolute minimum DNA score for any finalized design. */
export const ABSOLUTE_DNA_FLOOR = 60;

export const COMMERCIAL_CONFIDENCE_LEVELS = ["High", "Medium", "Low"] as const;

export type CommercialConfidenceLevel =
  (typeof COMMERCIAL_CONFIDENCE_LEVELS)[number];

/** Coerce 0–100 scores from numbers, numeric strings, or High/Medium/Low labels. */
export function coercePercentScore(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    const scaled = value > 0 && value <= 1 ? value * 100 : value;
    return Math.max(0, Math.min(100, Math.round(scaled)));
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return undefined;

    const lower = trimmed.toLowerCase();
    if (lower === "high") return 85;
    if (lower === "medium") return 70;
    if (lower === "low") return 55;

    const parsed = Number.parseFloat(
      trimmed.replace(/%/g, "").replace(/€/g, "").trim(),
    );
    if (!Number.isNaN(parsed)) {
      return coercePercentScore(parsed);
    }
  }

  return undefined;
}

/** Coerce retail price from strings like "89€" or bare numbers. */
export function coerceRetailPrice(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length >= 2 ? trimmed : undefined;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return `${Math.round(value)}€`;
  }

  return undefined;
}

export function commercialConfidenceLevel(
  score: number,
): CommercialConfidenceLevel {
  if (score >= 85) return "High";
  if (score >= 70) return "Medium";
  return "Low";
}

/** Human-readable commercial confidence for UI (High / Medium / Low). */
export function normalizeCommercialConfidence(value: number | string): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    return commercialConfidenceLevel(value);
  }

  const coerced = coercePercentScore(value);
  if (coerced !== undefined) {
    return commercialConfidenceLevel(coerced);
  }

  if (typeof value === "string") {
    const lower = value.trim().toLowerCase();
    const match = COMMERCIAL_CONFIDENCE_LEVELS.find(
      (level) => level.toLowerCase() === lower,
    );
    if (match) return match;
  }

  return String(value);
}

/** @deprecated Use normalizeCommercialConfidence */
export const formatCommercialConfidence = normalizeCommercialConfidence;

export function coerceCampaignPotential(
  value: unknown,
): "low" | "medium" | "high" | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    if (value >= 75) return "high";
    if (value >= 50) return "medium";
    return "low";
  }

  if (typeof value === "string") {
    const lower = value.trim().toLowerCase();
    if (lower === "high" || lower === "medium" || lower === "low") {
      return lower;
    }
    if (lower.includes("high")) return "high";
    if (lower.includes("medium")) return "medium";
    if (lower.includes("low")) return "low";
  }

  return undefined;
}

export function coerceRepeatabilityScore(
  value: unknown,
): "High" | "Medium" | "Low" | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    if (value >= 75) return "High";
    if (value >= 50) return "Medium";
    return "Low";
  }

  if (typeof value === "string") {
    const lower = value.trim().toLowerCase();
    if (lower === "high") return "High";
    if (lower === "medium") return "Medium";
    if (lower === "low") return "Low";
  }

  return undefined;
}
