/**
 * Casting pool architecture — prepare for large agency casts (20 / 40)
 * while today's active path still generates and shows all 4 candidates.
 *
 * IMPORTANT: Pool-show-top mode is NOT activated. Do not wire generateCount
 * above DEFAULT without product + cost review.
 */

export type CastingPoolMode =
  /** Generate N, show all N (current production behavior). */
  | "generate_all_visible"
  /** Generate large pool, rank, show only top displayCount (future). */
  | "generate_pool_show_top";

export interface CastingPoolConfig {
  /** How many candidates the provider should generate. */
  generateCount: number;
  /** How many ranked faces to surface in the board UI. */
  displayCount: number;
  mode: CastingPoolMode;
}

/** Active production config — still 4-of-4, no pool truncation. */
export const ACTIVE_CASTING_POOL: CastingPoolConfig = {
  generateCount: 4,
  displayCount: 4,
  mode: "generate_all_visible",
};

/** Future presets — exported for tests / later activation only. */
export const FUTURE_CASTING_POOL_PRESETS = {
  generate_20_show_5: {
    generateCount: 20,
    displayCount: 5,
    mode: "generate_pool_show_top",
  },
  generate_40_show_5: {
    generateCount: 40,
    displayCount: 5,
    mode: "generate_pool_show_top",
  },
} as const satisfies Record<string, CastingPoolConfig>;

export interface RankableCandidate {
  id: string;
  candidate_number: number;
  overallScore: number;
  commercialFace?: number;
  streetwearMatch?: number;
  authenticity?: number;
}

export interface RankedCastingCandidate<T extends RankableCandidate = RankableCandidate>
  extends RankableCandidate {
  rank: number;
  isRecommendedBrandFace: boolean;
  source: T;
}

/**
 * Rank candidates by commercial overall score (desc), then stable tie-breakers.
 */
export function rankCandidatesByCommercialScore<T extends RankableCandidate>(
  candidates: T[],
): RankedCastingCandidate<T>[] {
  const sorted = [...candidates].sort((a, b) => {
    if (b.overallScore !== a.overallScore) return b.overallScore - a.overallScore;
    const aStreet = a.streetwearMatch ?? 0;
    const bStreet = b.streetwearMatch ?? 0;
    if (bStreet !== aStreet) return bStreet - aStreet;
    const aAuth = a.authenticity ?? 0;
    const bAuth = b.authenticity ?? 0;
    if (bAuth !== aAuth) return bAuth - aAuth;
    return a.candidate_number - b.candidate_number;
  });

  return sorted.map((source, index) => ({
    id: source.id,
    candidate_number: source.candidate_number,
    overallScore: source.overallScore,
    commercialFace: source.commercialFace,
    streetwearMatch: source.streetwearMatch,
    authenticity: source.authenticity,
    rank: index + 1,
    isRecommendedBrandFace: index === 0 && sorted.length > 0,
    source,
  }));
}

/**
 * Select which candidates the board should display.
 * Today: returns full ranked list (generate_all_visible).
 * Future generate_pool_show_top: returns only top displayCount.
 */
export function selectTopCandidatesForDisplay<T extends RankableCandidate>(
  candidates: T[],
  config: CastingPoolConfig = ACTIVE_CASTING_POOL,
): RankedCastingCandidate<T>[] {
  const ranked = rankCandidatesByCommercialScore(candidates);
  if (config.mode === "generate_all_visible") {
    return ranked;
  }
  return ranked.slice(0, Math.max(1, config.displayCount));
}

/**
 * Resolve how many candidates to ask the provider for.
 * Always returns ACTIVE_CASTING_POOL.generateCount unless an explicit
 * future config is passed (tests / future activation only).
 */
export function resolveCastingGenerateCount(
  projectCandidateCount: number,
  config: CastingPoolConfig = ACTIVE_CASTING_POOL,
): number {
  if (config.mode === "generate_pool_show_top") {
    return config.generateCount;
  }
  return projectCandidateCount > 0 ? projectCandidateCount : config.generateCount;
}
