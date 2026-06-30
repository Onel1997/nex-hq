import type { DesignStudioBrief } from "@/agents/design/studio-brief";
import {
  getAllBuyerCuriosityPatterns,
  getBuyerCuriosityPattern,
} from "@/lib/design/design-knowledge/buyer-curiosity/curiosity-library";
import type {
  BuyerCuriosityDirectorDecision,
  CuriosityPatternId,
  VisualHookPattern,
} from "@/lib/design/design-knowledge/buyer-curiosity/types";
import { hashString } from "@/lib/design/vector-engine/hash";

interface ScoredPattern {
  id: CuriosityPatternId;
  score: number;
  hits: string[];
  hooks: VisualHookPattern[];
}

function briefCorpus(brief: DesignStudioBrief): string {
  return [
    brief.title,
    brief.visualConcept,
    brief.designDescription,
    brief.role,
    brief.placement,
    brief.printArea,
    brief.typography,
    brief.campaignPotential ?? "",
    ...(brief.designerInstructions ?? []),
  ]
    .join(" ")
    .toLowerCase();
}

function scorePatterns(text: string, seed: number, role: string): ScoredPattern[] {
  return getAllBuyerCuriosityPatterns()
    .map((pattern) => {
      let score = 0;
      const hits: string[] = [];
      const hooks: VisualHookPattern[] = [...pattern.visualHooks];

      for (const keyword of pattern.keywords) {
        if (text.includes(keyword)) {
          score += keyword.length >= 8 ? 4 : 3;
          hits.push(keyword);
        }
      }

      if (role.includes("hero") && pattern.id === "scroll-stop-hook") score += 14;
      if (role.includes("statement") && pattern.id === "identity-pull") score += 16;
      if (role.includes("statement") && pattern.id === "scroll-stop-hook") score += 12;
      if (role.includes("core essential") && pattern.id === "premium-restraint") score += 18;
      if (text.includes("between") || text.includes("only")) {
        if (pattern.id === "identity-pull") score += 14;
        if (pattern.id === "mystery-gap") score += 10;
      }
      if (text.includes("silent") || text.includes("architectural")) {
        if (pattern.id === "mystery-gap") score += 12;
      }
      if (text.includes("cropped") || text.includes("editorial")) {
        if (pattern.id === "unforgettable-focal") score += 10;
      }

      score += (hashString(`${pattern.id}:${seed}`) % 5) * 0.01;

      return { id: pattern.id, score, hits, hooks };
    })
    .sort((a, b) => b.score - a.score);
}

function confidenceFromScores(primary: ScoredPattern, secondary: ScoredPattern): number {
  if (primary.score <= 0) return 44;
  const gap = primary.score - secondary.score;
  return Math.round(Math.max(42, Math.min(96, 50 + primary.score * 1.6 + gap * 2)));
}

/** Choose buyer curiosity pattern — scroll-stop lens, not technical balance. */
export function decideBuyerCuriosityDirection(
  brief: DesignStudioBrief,
  seed: number,
): BuyerCuriosityDirectorDecision {
  const corpus = briefCorpus(brief);
  const role = brief.role.toLowerCase();
  const scored = scorePatterns(corpus, seed, role);
  const primary = scored[0] ?? {
    id: "scroll-stop-hook" as CuriosityPatternId,
    score: 0,
    hits: [],
    hooks: ["dominant-focal-point"] as VisualHookPattern[],
  };
  const secondary = scored[1] ?? primary;
  const pattern = getBuyerCuriosityPattern(primary.id);

  const decision: BuyerCuriosityDirectorDecision = {
    pattern: primary.id,
    visualHooks: primary.hooks.length > 0 ? primary.hooks : pattern.visualHooks,
    confidence: confidenceFromScores(primary, secondary),
    reason:
      primary.hits.length > 0
        ? `${pattern.name} — signals: ${primary.hits.slice(0, 3).join(", ")}`
        : `${pattern.name} — inferred from ${brief.role}`,
  };

  console.log(
    `[BUYER CURIOSITY] ${decision.pattern} — confidence ${decision.confidence}`,
  );

  return decision;
}
