import type { DesignStudioBrief } from "@/agents/design/studio-brief";
import type {
  DesignStyleDefinition,
  DesignStyleId,
  LayoutDefinition,
  LayoutId,
  LibraryArtworkSpec,
  OrnamentId,
  SymbolId,
  TemplateDefinition,
  TemplateId,
  TypographyPlacement,
} from "@/lib/design/design-library/types";
import type {
  EmotionalCompositionWeights,
  EmotionalDirectorDecision,
  EmotionalLanguageId,
  NegativeSpaceProfile,
} from "@/lib/design/design-knowledge/emotional-language/types";
import {
  getEmotionalLanguage,
} from "@/lib/design/design-knowledge/emotional-language/emotion-library";
import { DESIGN_TOKENS, snap } from "@/lib/design/vector-engine/tokens";

const NEGATIVE_SPACE_MULTIPLIER: Record<NegativeSpaceProfile, number> = {
  high: 1.22,
  elevated: 1.12,
  balanced: 1.0,
  tight: 0.88,
};

const ORNAMENT_DENSITY_CAP: Record<string, number> = {
  bare: 3,
  sparse: 4,
  moderate: 6,
  rich: 7,
};

function weightMapFromBias<T extends string>(bias: T[], baseWeight: number): Partial<Record<T, number>> {
  const map: Partial<Record<T, number>> = {};
  bias.forEach((id, index) => {
    map[id] = baseWeight - index;
  });
  return map;
}

/** Build deterministic scoring weights from emotional director decision. */
export function buildEmotionalWeights(decision: EmotionalDirectorDecision): EmotionalCompositionWeights {
  const primary = getEmotionalLanguage(decision.primary)!;
  const secondary = getEmotionalLanguage(decision.secondary)!;
  const { translation } = decision;

  const templates = {
    ...weightMapFromBias(primary.templateBias, 5),
    ...weightMapFromBias(secondary.templateBias, 3),
    ...weightMapFromBias(translation.templateHints, 4),
  };

  const layouts = {
    ...weightMapFromBias(primary.layoutBias, 5),
    ...weightMapFromBias(secondary.layoutBias, 3),
    ...weightMapFromBias(translation.layoutHints, 4),
  };

  const styles = {
    ...weightMapFromBias(primary.styleBias, 4),
    ...weightMapFromBias(secondary.styleBias, 2),
  };

  const symbols = weightMapFromBias(translation.symbols, 4);
  const ornaments = weightMapFromBias(translation.ornaments, 3);

  const density = primary.ornamentDensity;
  const ornamentCountCap = ORNAMENT_DENSITY_CAP[density] ?? 5;

  return {
    templates,
    layouts,
    styles,
    symbols,
    ornaments,
    negativeSpaceMultiplier: NEGATIVE_SPACE_MULTIPLIER[translation.negativeSpace],
    ornamentCountCap,
    movement: translation.movement,
  };
}

export function applyEmotionTemplateScore(
  baseScore: number,
  templateId: TemplateId,
  weights: EmotionalCompositionWeights,
): number {
  return baseScore + (weights.templates[templateId] ?? 0);
}

export function applyEmotionLayoutScore(
  baseScore: number,
  layoutId: LayoutId,
  weights: EmotionalCompositionWeights,
): number {
  return baseScore + (weights.layouts[layoutId] ?? 0);
}

export function applyEmotionStyleScore(
  baseScore: number,
  styleId: DesignStyleId,
  weights: EmotionalCompositionWeights,
): number {
  return baseScore + (weights.styles[styleId] ?? 0);
}

export function rankEmotionSymbols(
  symbolIds: SymbolId[],
  weights: EmotionalCompositionWeights,
): SymbolId[] {
  return [...symbolIds].sort(
    (a, b) => (weights.symbols[b] ?? 0) - (weights.symbols[a] ?? 0),
  );
}

export function rankEmotionOrnaments(
  ornamentIds: OrnamentId[],
  weights: EmotionalCompositionWeights,
): OrnamentId[] {
  return [...ornamentIds].sort(
    (a, b) => (weights.ornaments[b] ?? 0) - (weights.ornaments[a] ?? 0),
  );
}

export function effectiveNegativeSpace(
  style: DesignStyleDefinition,
  weights: EmotionalCompositionWeights,
): number {
  return Math.min(0.72, style.negativeSpace * weights.negativeSpaceMultiplier);
}

/** Apply emotional typography behaviors — ghost layer, soft oversized, museum captions. */
export function applyEmotionalTypography(
  placements: TypographyPlacement[],
  brief: DesignStudioBrief,
  decision: EmotionalDirectorDecision,
  seed: number,
): TypographyPlacement[] {
  const result = [...placements];
  const behaviors = decision.translation.typography;
  const headline = result.find((p) => p.role === "headline" || p.role === "stacked-headline");
  if (!headline) return result;

  if (behaviors.includes("soft-oversized")) {
    const idx = result.indexOf(headline);
    result[idx] = {
      ...headline,
      size: headline.size * 1.08,
      weight: Math.min(600, headline.weight + 30),
      opacity: Math.min(0.98, headline.opacity + 0.04),
    };
  }

  if (behaviors.includes("ghost-layer") && !result.some((p) => p.variant === "ghost")) {
    result.push({
      id: "emotion-ghost-headline",
      role: "stacked-headline",
      text: headline.text,
      x: snap(headline.x + 6),
      y: snap(headline.y + headline.size * 0.06),
      size: headline.size * 1.02,
      tracking: headline.tracking + 0.04,
      lineHeight: headline.lineHeight,
      weight: headline.weight - 50,
      align: headline.align,
      rotation: 0,
      opacity: 0.18,
      layer: "typography",
      variant: "ghost",
    });
  }

  if (behaviors.includes("museum-caption") && !result.some((p) => p.role === "collection-code")) {
    result.push({
      id: "emotion-museum-caption",
      role: "collection-code",
      text: `${brief.title.toUpperCase()} · ${decision.primary.toUpperCase()}`,
      x: snap(headline.x),
      y: snap(headline.y + headline.size * 1.35),
      size: DESIGN_TOKENS.typography.caption.size,
      tracking: 0.22,
      lineHeight: 1.2,
      weight: 400,
      align: headline.align,
      rotation: 0,
      opacity: 0.42,
      layer: "decorative",
    });
  }

  if (behaviors.includes("cropped-stack") && headline.text.includes(" ")) {
    const words = headline.text.split(/\s+/);
    if (words.length >= 2) {
      const idx = result.indexOf(headline);
      result[idx] = { ...headline, text: words[0]! };
      result.push({
        id: "emotion-cropped-line",
        role: "subheadline",
        text: words.slice(1).join(" "),
        x: snap(headline.x + headline.size * 0.04),
        y: snap(headline.y + headline.size * 0.92),
        size: headline.size * 0.72,
        tracking: headline.tracking + 0.06,
        lineHeight: 1.05,
        weight: 400,
        align: headline.align,
        rotation: -2,
        opacity: 0.78,
        layer: "typography",
      });
    }
  }

  if (behaviors.includes("whisper-scale")) {
    for (let i = 0; i < result.length; i++) {
      const p = result[i]!;
      if (p.role === "subheadline" || p.role === "collection-code") {
        result[i] = { ...p, opacity: Math.max(0.28, p.opacity * 0.85), size: p.size * 0.92 };
      }
    }
  }

  void seed;
  return result;
}

export interface EmotionCompositionMatch {
  score: number;
  aligned: boolean;
  mismatches: string[];
}

/** Commercial review — does generated composition express the selected emotion? */
export function evaluateEmotionCompositionMatch(
  spec: LibraryArtworkSpec,
): EmotionCompositionMatch {
  const emotion = spec.emotionalDirection;
  if (!emotion) {
    return { score: 50, aligned: false, mismatches: ["no emotional direction on spec"] };
  }

  const primary = getEmotionalLanguage(emotion.primary);
  const secondary = getEmotionalLanguage(emotion.secondary);
  const mismatches: string[] = [];
  let score = 52;

  if (primary?.templateBias.includes(spec.template.id)) score += 14;
  else mismatches.push(`template ${spec.template.id} not in ${emotion.primary} bias`);

  if (primary?.layoutBias.includes(spec.layout.id) || secondary?.layoutBias.includes(spec.layout.id)) {
    score += 12;
  } else {
    mismatches.push(`layout ${spec.layout.id} weak for ${emotion.primary}/${emotion.secondary}`);
  }

  if (primary?.styleBias.includes(spec.style.id) || secondary?.styleBias.includes(spec.style.id)) {
    score += 10;
  }

  const symbolIds = new Set(spec.symbols.map((s) => s.symbolId));
  const symbolHits = emotion.translation.symbols.filter((id) => symbolIds.has(id)).length;
  score += symbolHits * 6;
  if (symbolHits === 0) mismatches.push("no preferred emotional symbols present");

  const ornamentIds = new Set(spec.ornaments.map((o) => o.ornamentId));
  const ornamentHits = emotion.translation.ornaments.filter((id) => ornamentIds.has(id)).length;
  score += ornamentHits * 4;
  if (ornamentHits < 2) mismatches.push("emotional ornament language underrepresented");

  const hasGhost = spec.typography.some((t) => t.variant === "ghost");
  if (emotion.translation.typography.includes("ghost-layer") && hasGhost) score += 8;
  else if (emotion.translation.typography.includes("ghost-layer")) {
    mismatches.push("ghost typography layer missing for emotional narrative");
  }

  const typeLayers = spec.typography.filter((t) =>
    ["headline", "stacked-headline", "subheadline"].includes(t.role),
  ).length;
  if (emotion.translation.typography.includes("statement-dominant") && typeLayers >= 2) score += 6;

  score = Math.max(0, Math.min(100, Math.round(score)));
  return {
    score,
    aligned: score >= 68 && mismatches.length <= 2,
    mismatches,
  };
}

export function emotionRevisionOverrides(
  decision: EmotionalDirectorDecision,
): { templateId?: TemplateId; layoutId?: LayoutId; styleId?: DesignStyleId } {
  const primary = getEmotionalLanguage(decision.primary)!;
  return {
    templateId: primary.templateBias[0],
    layoutId: primary.layoutBias[0],
    styleId: primary.styleBias[0],
  };
}
