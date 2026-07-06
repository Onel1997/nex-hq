import type { DesignStudioBrief } from "@/agents/design/studio-brief";
import type { DesignConcept } from "@/lib/design/ai-designer/types";
import { hashString } from "@/lib/design/vector-engine/hash";
import type { DesignPatternTemplate, FashionKnowledgeQuery } from "../types";
import { DESIGN_PATTERN_CATALOG } from "./patterns/catalog";

function normalizePrintArea(brief: DesignStudioBrief): string {
  return brief.printArea.toLowerCase();
}

function scorePatternMatch(
  pattern: DesignPatternTemplate,
  query: FashionKnowledgeQuery,
): number {
  const { brief, concept, seed } = query;
  let score = pattern.commercialScore * 0.4;

  const printArea = normalizePrintArea(brief);
  if (pattern.printAreas.some((a: DesignPatternTemplate["printAreas"][number]) => printArea.includes(a.replace("-", "")) || printArea.includes(a))) {
    score += 25;
  }

  const product = brief.product.toLowerCase();
  if (product.includes("hoodie") && pattern.garmentCompatibility.includes("hoodie")) score += 8;
  if (product.includes("tee") && pattern.garmentCompatibility.includes("oversized-tee")) score += 8;

  for (const tag of pattern.tags) {
    const corpus = `${brief.geometry} ${brief.visualConcept} ${concept.fashionLanguage.mood} ${brief.role}`.toLowerCase();
    if (corpus.includes(tag)) score += 6;
  }

  if (brief.role?.toLowerCase().includes("hero") && pattern.commercialScore >= 90) score += 10;
  if (concept.negativeSpaceProfile.targetRatio.includes("70") && pattern.negativeSpace.includes("7")) score += 8;

  const variant = (hashString(`${brief.designId}-${pattern.id}`) + seed) % 7;
  score += variant;

  return score;
}

export function selectDesignPattern(query: FashionKnowledgeQuery): DesignPatternTemplate {
  const ranked = [...DESIGN_PATTERN_CATALOG]
    .map((pattern) => ({ pattern, score: scorePatternMatch(pattern, query) }))
    .sort((a, b) => b.score - a.score);

  return ranked[0]?.pattern ?? DESIGN_PATTERN_CATALOG[0]!;
}

export function selectDesignPatternVariant(
  query: FashionKnowledgeQuery,
  iteration: number,
): DesignPatternTemplate {
  const ranked = [...DESIGN_PATTERN_CATALOG]
    .map((pattern) => ({
      pattern,
      score: scorePatternMatch(pattern, { ...query, seed: query.seed + iteration * 137 }),
    }))
    .sort((a, b) => b.score - a.score);

  const index = Math.min(iteration - 1, ranked.length - 1);
  return ranked[index]?.pattern ?? ranked[0]!.pattern;
}

export function listDesignPatterns(): DesignPatternTemplate[] {
  return [...DESIGN_PATTERN_CATALOG];
}
