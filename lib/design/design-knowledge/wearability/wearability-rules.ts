import type { DesignStudioBrief } from "@/agents/design/studio-brief";
import type {
  DesignStyleDefinition,
  DesignStyleId,
  LayoutId,
  LibraryArtworkSpec,
  OrnamentId,
  SymbolId,
  TemplateId,
} from "@/lib/design/design-library/types";
import type { WearabilityDirectorDecision } from "@/lib/design/design-knowledge/wearability/wearability-selector";
import { evaluateDailyRotation } from "@/lib/design/design-knowledge/wearability/daily-rotation";
import { evaluateDistanceReadability } from "@/lib/design/design-knowledge/wearability/distance-readability";
import {
  applyLuxuryRestraint,
  evaluateLuxuryRestraint,
} from "@/lib/design/design-knowledge/wearability/luxury-restraint";
import { evaluatePrintDensity } from "@/lib/design/design-knowledge/wearability/print-density";
import {
  getWearabilityPrinciple,
} from "@/lib/design/design-knowledge/wearability/wearability-library";

export interface WearabilityCompositionWeights {
  templates: Partial<Record<TemplateId, number>>;
  layouts: Partial<Record<LayoutId, number>>;
  styles: Partial<Record<DesignStyleId, number>>;
  symbols: Partial<Record<SymbolId, number>>;
  ornaments: Partial<Record<OrnamentId, number>>;
  negativeSpaceMultiplier: number;
  ornamentCountCap: number;
  symbolCountCap: number;
  templatePenalties: Partial<Record<TemplateId, number>>;
}

const APPAREL_LENS_MULTIPLIER: Record<WearabilityDirectorDecision["apparelLens"], number> = {
  "daily-essential": 1.18,
  "premium-mark": 1.1,
  "statement-garment": 1.0,
  "hero-artwork": 0.95,
};

const POSTER_TEMPLATES: TemplateId[] = ["editorial-poster", "technical-blueprint"];

function weightMapFromBias<T extends string>(bias: T[], baseWeight: number): Partial<Record<T, number>> {
  const map: Partial<Record<T, number>> = {};
  bias.forEach((id, index) => {
    map[id] = baseWeight - index;
  });
  return map;
}

/** Build deterministic scoring weights from wearability director decision. */
export function buildWearabilityWeights(
  decision: WearabilityDirectorDecision,
  brief: DesignStudioBrief,
): WearabilityCompositionWeights {
  const primary = getWearabilityPrinciple(decision.primary)!;
  const secondary = getWearabilityPrinciple(decision.secondary)!;
  const placement = decision.placement;
  const lensMultiplier = APPAREL_LENS_MULTIPLIER[decision.apparelLens];

  const templates = {
    ...weightMapFromBias(primary.templateBias, 6),
    ...weightMapFromBias(secondary.templateBias, 3),
  };

  // Placement-driven template bias
  if (placement.densityAllowance < 0.45) {
    templates["minimal-emblem"] = (templates["minimal-emblem"] ?? 0) + 8;
    templates["micro-graphic"] = (templates["micro-graphic"] ?? 0) + 7;
    templates["silent-collection"] = (templates["silent-collection"] ?? 0) + 6;
  } else if (placement.densityAllowance >= 0.7) {
    templates["oversized-graphic"] = (templates["oversized-graphic"] ?? 0) + 7;
    templates["editorial-poster"] = (templates["editorial-poster"] ?? 0) + 5;
    templates["gallery-composition"] = (templates["gallery-composition"] ?? 0) + 4;
  }

  const layouts = {
    ...weightMapFromBias(primary.layoutBias, 5),
    ...weightMapFromBias(secondary.layoutBias, 3),
    ...weightMapFromBias(placement.layoutBias, 6),
  };

  const styles = {
    ...weightMapFromBias(primary.styleBias, 4),
    ...weightMapFromBias(secondary.styleBias, 2),
  };

  const symbols = weightMapFromBias(
    [...primary.symbolPreferences, ...secondary.symbolPreferences],
    3,
  );
  const ornaments = weightMapFromBias(
    [...primary.ornamentPreferences, ...secondary.ornamentPreferences],
    2,
  );

  const templatePenalties: Partial<Record<TemplateId, number>> = {};
  for (const avoid of [...primary.templateAvoid, ...secondary.templateAvoid]) {
    templatePenalties[avoid] = -12;
  }
  if (decision.apparelLens === "daily-essential") {
    for (const t of POSTER_TEMPLATES) templatePenalties[t] = -18;
    templatePenalties["oversized-graphic"] = -10;
  }

  const role = brief.role.toLowerCase();
  let ornamentCap = placement.ornamentCap;
  if (role.includes("core essential")) ornamentCap = Math.min(ornamentCap, 3);
  if (role.includes("hero")) ornamentCap = Math.max(ornamentCap, 4);

  return {
    templates,
    layouts,
    styles,
    symbols,
    ornaments,
    negativeSpaceMultiplier: (1 + placement.negativeSpaceTarget * 0.35) * lensMultiplier,
    ornamentCountCap: ornamentCap,
    symbolCountCap: placement.symbolCap,
    templatePenalties,
  };
}

export function applyWearabilityTemplateScore(
  baseScore: number,
  templateId: TemplateId,
  weights: WearabilityCompositionWeights,
): number {
  return baseScore + (weights.templates[templateId] ?? 0) + (weights.templatePenalties[templateId] ?? 0);
}

export function applyWearabilityLayoutScore(
  baseScore: number,
  layoutId: LayoutId,
  weights: WearabilityCompositionWeights,
): number {
  return baseScore + (weights.layouts[layoutId] ?? 0);
}

export function applyWearabilityStyleScore(
  baseScore: number,
  styleId: DesignStyleId,
  weights: WearabilityCompositionWeights,
): number {
  return baseScore + (weights.styles[styleId] ?? 0);
}

export function rankWearabilitySymbols(
  symbolIds: SymbolId[],
  weights: WearabilityCompositionWeights,
): SymbolId[] {
  return [...symbolIds].sort(
    (a, b) => (weights.symbols[b] ?? 0) - (weights.symbols[a] ?? 0),
  );
}

export function rankWearabilityOrnaments(
  ornamentIds: OrnamentId[],
  weights: WearabilityCompositionWeights,
): OrnamentId[] {
  return [...ornamentIds].sort(
    (a, b) => (weights.ornaments[b] ?? 0) - (weights.ornaments[a] ?? 0),
  );
}

export function effectiveWearabilityNegativeSpace(
  style: DesignStyleDefinition,
  emotionMultiplier: number,
  wearabilityMultiplier: number,
): number {
  return Math.min(0.78, style.negativeSpace * emotionMultiplier * wearabilityMultiplier);
}

export interface WearabilityCompositionMatch {
  score: number;
  aligned: boolean;
  weeklyWearable: boolean;
  feelsPremium: boolean;
  agesWell: boolean;
  mismatches: string[];
}

/** Commercial review — does composition read as premium apparel, not editorial graphic? */
export function evaluateWearabilityCompositionMatch(
  spec: LibraryArtworkSpec,
): WearabilityCompositionMatch {
  const direction = spec.wearabilityDirection;
  if (!direction) {
    return {
      score: 50,
      aligned: false,
      weeklyWearable: false,
      feelsPremium: false,
      agesWell: false,
      mismatches: ["no wearability direction on spec"],
    };
  }

  const primary = getWearabilityPrinciple(direction.primary);
  const placement = direction.placement;
  const density = evaluatePrintDensity(spec, placement);
  const restraint = evaluateLuxuryRestraint(spec, placement);
  const distance = evaluateDistanceReadability(spec, placement);
  const rotation = evaluateDailyRotation(spec.brief, spec);
  const mismatches: string[] = [];
  let score = 50;

  if (primary?.templateBias.includes(spec.template.id)) score += 14;
  else mismatches.push(`template ${spec.template.id} weak for ${direction.primary}`);

  if (primary?.layoutBias.includes(spec.layout.id) || placement.layoutBias.includes(spec.layout.id)) {
    score += 12;
  } else {
    mismatches.push(`layout ${spec.layout.id} not optimal for ${placement.id}`);
  }

  if (primary?.styleBias.includes(spec.style.id)) score += 8;

  score += Math.round(density.score * 0.12);
  score += Math.round(restraint.score * 0.1);
  score += Math.round(distance.score * 0.08);
  score += Math.round(rotation.score * 0.1);

  if (density.isPosterLike) {
    score -= 16;
    mismatches.push("reads as poster composition, not garment artwork");
  }
  if (density.hasClutter) mismatches.push("visual clutter reduces wearability");
  if (!distance.readableAtDistance) mismatches.push("weak distance readability on fabric");
  if (rotation.dominatesOutfit) mismatches.push("print dominates outfit pairing");

  score = Math.max(0, Math.min(100, Math.round(score)));

  const weeklyWearable = rotation.weeklyWearable && density.score >= 62;
  const feelsPremium = restraint.feelsExpensive && restraint.score >= 65;
  const agesWell = spec.template.id !== "technical-blueprint" && restraint.score >= 60;

  return {
    score,
    aligned: score >= 68 && mismatches.length <= 2,
    weeklyWearable,
    feelsPremium,
    agesWell,
    mismatches,
  };
}

export function wearabilityRevisionOverrides(
  decision: WearabilityDirectorDecision,
): { templateId?: TemplateId; layoutId?: LayoutId; styleId?: DesignStyleId } {
  const primary = getWearabilityPrinciple(decision.primary)!;
  const placement = decision.placement;

  if (decision.apparelLens === "daily-essential") {
    return {
      templateId: "minimal-emblem",
      layoutId: placement.layoutBias[0] ?? "micro-chest",
      styleId: "silent-luxury",
    };
  }

  if (placement.densityAllowance >= 0.7) {
    return {
      templateId: primary.templateBias[0] ?? "oversized-graphic",
      layoutId: placement.layoutBias[0] ?? "oversized-back",
      styleId: primary.styleBias[0] ?? "editorial-fashion",
    };
  }

  return {
    templateId: primary.templateBias[0],
    layoutId: placement.layoutBias[0],
    styleId: primary.styleBias[0],
  };
}

/** Post-compose apparel calibration — trim density, apply luxury restraint. */
export function applyWearabilityComposition(
  spec: LibraryArtworkSpec,
  decision: WearabilityDirectorDecision,
): LibraryArtworkSpec {
  let calibrated = applyLuxuryRestraint(spec, decision.placement);

  if (decision.apparelLens === "daily-essential" && calibrated.ornaments.length > 3) {
    calibrated = {
      ...calibrated,
      ornaments: calibrated.ornaments.slice(0, 3),
    };
  }

  return calibrated;
}
