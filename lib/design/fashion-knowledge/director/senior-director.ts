import type { DesignStudioBrief } from "@/agents/design/studio-brief";
import type { DesignConcept } from "@/lib/design/ai-designer/types";
import type { FashionDesignEngineResult } from "@/lib/design/fashion-design-engine/types";
import { hashString } from "@/lib/design/vector-engine/hash";
import { getLayoutSystem } from "../knowledge/layout-systems";
import { getGraphicSystem } from "../knowledge/graphic-systems";
import { TYPOGRAPHY_KNOWLEDGE } from "../knowledge/typography";
import { FASHION_PSYCHOLOGY } from "../knowledge/fashion-psychology";
import { COMMERCIAL_FASHION_RULES } from "../knowledge/commercial-rules";
import { applyPatternLayoutToEngine } from "../apply-pattern-layout";
import { selectDesignPattern, selectDesignPatternVariant } from "../design-library";
import type { DesignPatternTemplate, FashionKnowledgeDecision, FashionKnowledgeQuery } from "../types";

/**
 * Senior Streetwear Creative Director — consults fashion knowledge before spec generation.
 */
export function decideFromFashionKnowledge(
  query: FashionKnowledgeQuery,
): FashionKnowledgeDecision {
  const pattern = selectDesignPattern(query);
  const layoutSystem = getLayoutSystem(pattern.layoutSystemId);

  const typographyPrinciples = TYPOGRAPHY_KNOWLEDGE.filter((t) =>
    pattern.typographyHierarchy.some((h: string) => h.includes(t.id.split("-")[0]!) || t.id.includes("hierarchy")),
  ).slice(0, 4);

  if (typographyPrinciples.length < 3) {
    typographyPrinciples.push(
      TYPOGRAPHY_KNOWLEDGE.find((t) => t.id === "hierarchy")!,
      TYPOGRAPHY_KNOWLEDGE.find((t) => t.id === "luxury-typography")!,
      TYPOGRAPHY_KNOWLEDGE.find((t) => t.id === "print-typography")!,
    );
  }

  const graphicSystems = pattern.graphicSystems
    .map((id: DesignPatternTemplate["graphicSystems"][number]) => getGraphicSystem(id))
    .filter(Boolean);

  const psychology = FASHION_PSYCHOLOGY.slice(0, 4);
  const commercialRules = COMMERCIAL_FASHION_RULES;

  const creativeBrief = [
    `Layout: ${layoutSystem.title} — ${layoutSystem.principle}`,
    `Pattern: ${pattern.name} — ${pattern.description}`,
    `Negative space target: ${pattern.negativeSpace}`,
    `Commercial score baseline: ${pattern.commercialScore}`,
    ...layoutSystem.placementRules.slice(0, 2),
    ...typographyPrinciples.map((t) => t.principle),
  ];

  const antiPatterns = [
    ...layoutSystem.antiPatterns,
    ...pattern.tags.flatMap(() => []),
    "random-composition",
    "text-only-poster",
    "fake-words",
    "brand-imitation",
  ];

  return {
    layoutSystem,
    pattern,
    typographyPrinciples: [...new Map(typographyPrinciples.map((t) => [t.id, t])).values()],
    graphicSystems,
    psychology,
    commercialRules,
    creativeBrief,
    antiPatterns: [...new Set(antiPatterns)],
  };
}

export function buildFashionKnowledgeQuery(
  brief: DesignStudioBrief,
  concept: DesignConcept,
  designDirection?: string,
): FashionKnowledgeQuery {
  const seed = hashString(brief.designId) % 10000;
  return { brief, concept, seed, designDirection };
}

/**
 * Apply fashion knowledge decisions to engine specs — enriches without inventing text.
 */
export function applyFashionKnowledgeToEngine(
  engine: FashionDesignEngineResult,
  decision: FashionKnowledgeDecision,
): FashionDesignEngineResult {
  const applied = structuredClone(engine);
  const { layoutSystem, pattern } = decision;

  applied.layoutSpec.negativeSpace.targetRatio = layoutSystem.negativeSpaceTarget;
  applied.compositionSpec.proportions.negativeSpaceShare = parseInt(
    pattern.negativeSpace.replace("%", ""),
    10,
  ) || 55;

  applied.compositionSpec.recommendations = [
    `Fashion knowledge: ${pattern.name}`,
    layoutSystem.visualBalance,
    ...decision.creativeBrief.slice(0, 2),
    ...applied.compositionSpec.recommendations,
  ].slice(0, 5);

  applied.creativeBrief.designPhilosophy = [
    applied.creativeBrief.designPhilosophy,
    `Knowledge pattern: ${pattern.name}`,
    layoutSystem.commercialUseCase,
  ].join(" ");

  applied.creativeBrief.antiPatterns = [
    ...new Set([...applied.creativeBrief.antiPatterns, ...decision.antiPatterns]),
  ].slice(0, 10);

  if (applied.graphicSpec.lineSystems.length < 2) {
    applied.graphicSpec.lineSystems.push({
      id: "knowledge-perimeter",
      type: "perimeter",
      count: 1,
      strokeWidthMm: 0.8,
      spacingMm: 0,
      opacity: 0.55,
    });
  }

  applied.compositionSpec.score = Math.min(
    100,
    applied.compositionSpec.score + Math.round((pattern.commercialScore - 85) * 0.3),
  );

  return applyPatternLayoutToEngine(applied, pattern);
}

export function getPatternForIteration(
  query: FashionKnowledgeQuery,
  iteration: number,
): DesignPatternTemplate {
  return selectDesignPatternVariant(query, iteration);
}
