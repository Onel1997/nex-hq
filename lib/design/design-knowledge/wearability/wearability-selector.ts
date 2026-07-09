import type { DesignStudioBrief } from "@/agents/design/studio-brief";
import type { WearabilityPrincipleId } from "@/lib/design/design-knowledge/wearability/wearability-library";
import {
  getWearabilityPrinciple,
  principlesForPlacement,
  WEARABILITY_PRINCIPLES,
} from "@/lib/design/design-knowledge/wearability/wearability-library";
import {
  resolvePlacementProfile,
  type GarmentPlacement,
  type PlacementProfile,
} from "@/lib/design/design-knowledge/wearability/placement";
import { hashString } from "@/lib/design/vector-engine/hash";

export interface WearabilityDirectorDecision {
  primary: WearabilityPrincipleId;
  secondary: WearabilityPrincipleId;
  placement: PlacementProfile;
  confidence: number;
  reason: string;
  /** Apparel designer intent — garment-first, not graphic-first. */
  apparelLens: "daily-essential" | "statement-garment" | "hero-artwork" | "premium-mark";
}

interface ScoredPrinciple {
  id: WearabilityPrincipleId;
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
    brief.negativeSpaceRules,
    ...(brief.designerInstructions ?? []),
  ]
    .join(" ")
    .toLowerCase();
}

function scorePrinciples(text: string, seed: number, placement: GarmentPlacement): ScoredPrinciple[] {
  const placementBoost = new Set(principlesForPlacement(placement));

  return WEARABILITY_PRINCIPLES.map((principle) => {
    let score = 0;
    const hits: string[] = [];

    for (const keyword of principle.keywords) {
      if (text.includes(keyword)) {
        score += keyword.length >= 7 ? 3 : 2;
        hits.push(keyword);
      }
    }

    if (placementBoost.has(principle.id)) score += 8;

    for (const avoid of principle.templateAvoid) {
      if (text.includes(avoid.replace(/-/g, " "))) score -= 4;
    }

    // Role-specific apparel lens
    if (text.includes("core essential") || text.includes("daily")) {
      if (principle.id === "daily-rotation") score += 16;
      if (principle.id === "minimal-confidence") score += 12;
      if (principle.id === "print-density") score += 10;
    }
    if (text.includes("statement") || text.includes("scroll-stop")) {
      if (principle.id === "distance-readability") score += 14;
      if (principle.id === "garment-balance") score += 10;
    }
    if (text.includes("hero")) {
      if (principle.id === "garment-balance") score += 12;
      if (principle.id === "timelessness") score += 8;
    }
    if (text.includes("micro") || text.includes("emblem")) {
      if (principle.id === "minimal-confidence") score += 14;
      if (principle.id === "luxury-restraint") score += 10;
    }
    if (text.includes("luxury") || text.includes("premium") || text.includes("restraint")) {
      if (principle.id === "luxury-restraint") score += 12;
    }

    score += (hashString(`${principle.id}:${seed}`) % 5) * 0.01;

    return { id: principle.id, score, hits };
  }).sort((a, b) => b.score - a.score);
}

function resolveApparelLens(
  brief: DesignStudioBrief,
  placement: GarmentPlacement,
): WearabilityDirectorDecision["apparelLens"] {
  const role = brief.role.toLowerCase();
  if (role.includes("core essential") || placement === "micro-emblem" || placement === "left-chest") {
    return "daily-essential";
  }
  if (role.includes("statement")) return "statement-garment";
  if (role.includes("hero")) return "hero-artwork";
  if (placement === "center-chest") return "premium-mark";
  return "statement-garment";
}

function buildReason(primary: ScoredPrinciple, secondary: ScoredPrinciple, placement: GarmentPlacement): string {
  const p = getWearabilityPrinciple(primary.id);
  const s = getWearabilityPrinciple(secondary.id);
  const hitSummary =
    primary.hits.length > 0
      ? `signals: ${primary.hits.slice(0, 3).join(", ")}`
      : "inferred from placement and role";
  return `${placement} placement → ${p?.name ?? primary.id} with ${s?.name ?? secondary.id} — ${hitSummary}`;
}

function confidenceFromScores(primary: ScoredPrinciple, secondary: ScoredPrinciple): number {
  if (primary.score <= 0) return 40;
  const gap = primary.score - secondary.score;
  return Math.round(Math.max(38, Math.min(96, 50 + primary.score * 2.5 + gap * 2)));
}

/**
 * Apparel Designer pass — deterministic wearability direction from brief and placement.
 */
export function decideWearabilityDirection(
  brief: DesignStudioBrief,
  seed: number,
): WearabilityDirectorDecision {
  const placement = resolvePlacementProfile(brief);
  const corpus = briefCorpus(brief);
  const scored = scorePrinciples(corpus, seed, placement.id);
  const primary = scored[0] ?? { id: "daily-rotation" as WearabilityPrincipleId, score: 0, hits: [] };
  const secondary =
    scored.find((p) => p.id !== primary.id) ??
    ({ id: "luxury-restraint" as WearabilityPrincipleId, score: 0, hits: [] } as ScoredPrinciple);

  const decision: WearabilityDirectorDecision = {
    primary: primary.id,
    secondary: secondary.id,
    placement,
    confidence: confidenceFromScores(primary, secondary),
    reason: buildReason(primary, secondary, placement.id),
    apparelLens: resolveApparelLens(brief, placement.id),
  };

  console.log(
    `[WEARABILITY DIRECTOR] ${decision.primary} + ${decision.secondary} @ ${placement.id} (confidence ${decision.confidence}) — ${decision.reason}`,
  );

  return decision;
}
