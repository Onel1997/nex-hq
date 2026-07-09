/**
 * Milaene brand-fit heuristics for deterministic research scoring.
 * Encoded locally — does not import Brain or workspace modules.
 */
export const MILAENE_BRAND_PROFILE = {
  workspaceId: "milaene",
  name: "Milaene",
  positiveTerms: [
    "minimal",
    "luxury",
    "restraint",
    "archive",
    "streetwear",
    "quiet",
    "emblem",
    "understated",
    "premium",
    "refined",
    "tailored",
    "monochrome",
    "neutral",
    "heritage",
    "craft",
    "elevated",
    "essential",
    "timeless",
    "subtle",
    "confidence",
  ],
  negativeTerms: [
    "maximalist",
    "fast fashion",
    "loud",
    "neon",
    "novelty",
    "costume",
    "trend-chasing",
    "disposable",
    "flashy",
    "overbranded",
    "logomania",
    "cheap",
    "mass market",
  ],
  preferredAesthetics: [
    "streetwear",
    "archive",
    "luxury restraint",
    "minimal confidence",
    "quiet luxury",
  ],
} as const;

export function termMatchesBrandFit(term: string): boolean {
  const normalized = term.toLowerCase();
  return MILAENE_BRAND_PROFILE.positiveTerms.some(
    (positive) => normalized.includes(positive) || positive.includes(normalized),
  );
}

export function termConflictsBrandFit(term: string): boolean {
  const normalized = term.toLowerCase();
  return MILAENE_BRAND_PROFILE.negativeTerms.some(
    (negative) => normalized.includes(negative) || negative.includes(normalized),
  );
}
