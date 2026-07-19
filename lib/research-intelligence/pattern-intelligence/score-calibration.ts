import { clampScore } from "../confidence/scoring-utils";

export interface ScoreCapContext {
  sourceKeyCount: number;
  hasStrongShopifyEvidence?: boolean;
  highBrandFit?: boolean;
  hasConflicts?: boolean;
  isCatalogOverlap?: boolean;
}

export function capScoreBySourceAgreement(
  score: number,
  context: ScoreCapContext,
): number {
  const { sourceKeyCount } = context;
  let cap = 74;
  if (sourceKeyCount >= 2) cap = 86;
  if (sourceKeyCount >= 3) cap = 94;

  const elite =
    sourceKeyCount >= 3 &&
    context.hasStrongShopifyEvidence &&
    context.highBrandFit &&
    !context.hasConflicts;

  if (elite) cap = 98;
  else if (sourceKeyCount >= 3 && context.hasStrongShopifyEvidence && context.highBrandFit) {
    cap = 94;
  }

  let adjusted = Math.min(score, cap);
  if (context.isCatalogOverlap) {
    adjusted = Math.min(adjusted, 78);
  }
  return clampScore(adjusted);
}

export function uniqueSourceCount(sourceKeys: string[]): number {
  return new Set(sourceKeys.map((key) => key.toLowerCase())).size;
}
