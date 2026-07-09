import type { DesignStudioBrief } from "@/agents/design/studio-brief";
import type { WearabilityDirectorDecision } from "@/lib/design/design-knowledge/wearability";
import {
  getAllHeroTypographyDirections,
  getHeroTypographyDirection,
} from "@/lib/design/design-knowledge/hero-typography/hero-library";
import type {
  HeroTypographyDirectorDecision,
  HeroTypographyDirectionId,
} from "@/lib/design/design-knowledge/hero-typography/types";
import { hashString } from "@/lib/design/vector-engine/hash";

interface ScoredDirection {
  id: HeroTypographyDirectionId;
  score: number;
  hits: string[];
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
    ...(brief.designerInstructions ?? []),
  ]
    .join(" ")
    .toLowerCase();
}

function scoreDirections(
  text: string,
  seed: number,
  apparelLens: WearabilityDirectorDecision["apparelLens"],
  placementId: string,
): ScoredDirection[] {
  return getAllHeroTypographyDirections().map((direction) => {
    let score = 0;
    const hits: string[] = [];

    for (const keyword of direction.keywords) {
      if (text.includes(keyword)) {
        score += keyword.length >= 8 ? 4 : 3;
        hits.push(keyword);
      }
    }

    if (text.includes("hero piece") || text.includes("hero artwork")) {
      if (direction.id === "hero-back-print") score += 14;
    }
    if (text.includes("statement piece") || text.includes("statement")) {
      if (direction.id === "statement-piece") score += 16;
    }
    if (text.includes("core essential")) {
      if (direction.id === "core-essential") score += 18;
    }
    if (text.includes("faith")) {
      if (direction.id === "faith") score += 20;
    }
    if (text.includes("silent") || text.includes("quiet luxury")) {
      if (direction.id === "silent-luxury") score += 14;
    }

    if (placementId.includes("back") && direction.id === "hero-back-print") score += 10;
    if (placementId.includes("micro") || placementId.includes("chest")) {
      if (direction.id === "core-essential") score += 12;
    }

    if (apparelLens === "daily-essential" && direction.id === "core-essential") score += 14;
    if (apparelLens === "statement-garment" && direction.id === "statement-piece") score += 12;
    if (apparelLens === "hero-artwork" && direction.id === "hero-back-print") score += 14;

    score += (hashString(`${direction.id}:${seed}`) % 7) * 0.01;

    return { id: direction.id, score, hits };
  }).sort((a, b) => b.score - a.score);
}

function confidenceFromScores(primary: ScoredDirection, secondary: ScoredDirection): number {
  if (primary.score <= 0) return 42;
  const gap = primary.score - secondary.score;
  return Math.round(Math.max(40, Math.min(96, 48 + primary.score * 1.8 + gap * 2.2)));
}

/**
 * Choose ONE hero typography direction per artwork — deterministic from brief.
 */
export function decideHeroTypographyDirection(
  brief: DesignStudioBrief,
  seed: number,
  wearability?: WearabilityDirectorDecision,
): HeroTypographyDirectorDecision {
  const corpus = briefCorpus(brief);
  const apparelLens = wearability?.apparelLens ?? "statement-garment";
  const placementId = wearability?.placement.id ?? brief.placement.toLowerCase();
  const scored = scoreDirections(corpus, seed, apparelLens, placementId);
  const primary = scored[0] ?? { id: "hero-back-print" as HeroTypographyDirectionId, score: 0, hits: [] };
  const secondary = scored[1] ?? primary;
  const direction = getHeroTypographyDirection(primary.id);
  const shareMid = (direction.compositionShare[0] + direction.compositionShare[1]) / 2;

  const decision: HeroTypographyDirectorDecision = {
    direction: primary.id,
    concepts: direction.concepts,
    compositionShareTarget: shareMid,
    confidence: confidenceFromScores(primary, secondary),
    reason:
      primary.hits.length > 0
        ? `${direction.name} — signals: ${primary.hits.slice(0, 3).join(", ")}`
        : `${direction.name} — inferred from ${apparelLens} / ${placementId}`,
    apparelLens,
  };

  console.log(
    `[HERO TYPOGRAPHY] ${decision.direction} (${Math.round(decision.compositionShareTarget * 100)}% target) — confidence ${decision.confidence}`,
  );

  return decision;
}
