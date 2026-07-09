import type { PremiumRenderContext } from "@/lib/design/design-library/templates/premium/types";
import type { PremiumTemplateLayoutConfig } from "@/lib/design/design-library/templates/premium/types";
import type { SymbolRecipe } from "@/lib/design/design-library/templates/premium/shared/symbols-build";
import type { OrnamentId } from "@/lib/design/design-library/types";
import type { TypographyPlacement } from "@/lib/design/design-library/types";
import {
  decideFromKnowledge,
  queryFromBrief,
  type CreativeDirectorDecision,
} from "@/lib/design/design-knowledge/art-direction";
import { logKnowledgeScore, passesKnowledgeGate, scoreKnowledgeDecision } from "@/lib/design/design-knowledge/knowledge-score";
import { DESIGN_TOKENS, snap } from "@/lib/design/vector-engine/tokens";

export interface KnowledgeAppliedRecipe {
  layout: PremiumTemplateLayoutConfig;
  symbols: SymbolRecipe;
  ornaments: OrnamentId[][];
  decision: CreativeDirectorDecision;
  knowledgeScore: ReturnType<typeof scoreKnowledgeDecision>;
}

const TYPOGRAPHY_MODE_MAP: Record<string, PremiumTemplateLayoutConfig["typographyMode"]> = {
  "luxury-serif": "stacked-headline",
  "modern-grotesk": "split-typography",
  "editorial-sans": "oversized-headline",
  "fashion-condensed": "oversized-headline",
  "museum-label": "museum-label",
  "broken-type": "broken-typography",
  "vertical-type": "vertical-typography",
  "oversized-type": "oversized-headline",
  "split-type": "split-typography",
  "offset-type": "offset-typography",
  "ghost-type": "stacked-headline",
  "multi-scale": "stacked-headline",
};

function typographyModeFromKnowledge(family: string): PremiumTemplateLayoutConfig["typographyMode"] {
  return TYPOGRAPHY_MODE_MAP[family] ?? "stacked-headline";
}

/** Converts knowledge-base decision into a renderable premium recipe. */
export function applyKnowledgeToRecipe(
  ctx: PremiumRenderContext,
  templateId: PremiumTemplateLayoutConfig["id"],
): KnowledgeAppliedRecipe {
  const query = queryFromBrief(ctx.spec.brief, ctx.seed);
  const decision = decideFromKnowledge(query);
  const knowledgeScore = scoreKnowledgeDecision(decision);
  logKnowledgeScore(knowledgeScore);

  const { layout, typography, symbol, ornament, collection, composition } = decision;

  const premiumLayout: PremiumTemplateLayoutConfig = {
    id: templateId,
    typographyMode: typographyModeFromKnowledge(typography.family),
    apparelBias: layout.meta.garmentFit,
    focalShift: {
      x: (layout.anchors.focal.rx - 0.5) * 0.2,
      y: (layout.anchors.focal.ry - 0.5) * 0.2,
    },
    scaleMultiplier: 0.95 + layout.tension * 0.2,
    asymmetry: composition.asymmetryMin,
    negativeSpaceBias: layout.negativeSpace,
    depthOpacity: 0.08 + composition.depthLayers * 0.015,
    preferOversized: layout.meta.garmentFit.includes("oversized-front"),
  };

  const symbols: SymbolRecipe = {
    primary: symbol.primary,
    secondary: symbol.secondary,
    nested: symbol.nested,
    includeHalo: symbol.nested.includes("halo") || symbol.primary === "halo",
    includeDirectional: symbol.nested.includes("directional-marker") || symbol.secondary === "directional-marker",
  };

  const ornaments: OrnamentId[][] = [
    ornament.primary,
    ornament.secondary,
  ];

  return { layout: premiumLayout, symbols, ornaments, decision, knowledgeScore };
}

/** Applies knowledge-base typography tuning to placements. */
export function applyKnowledgeTypography(
  placements: TypographyPlacement[],
  decision: CreativeDirectorDecision,
): TypographyPlacement[] {
  const { typography, collection } = decision;
  const tokens = DESIGN_TOKENS.typography;

  return placements.map((p) => {
    const scale =
      p.role === "headline" || p.role === "stacked-headline"
        ? typography.headlineScale
        : p.role === "subheadline"
          ? typography.subheadScale
          : typography.decorScale;

    const weight =
      p.role === "headline" || p.role === "stacked-headline"
        ? typography.headlineWeight
        : p.role === "subheadline"
          ? typography.subheadWeight
          : typography.decorWeight;

    const tracking =
      p.role === "headline" || p.role === "stacked-headline"
        ? typography.trackingWide
        : typography.trackingTight;

    return {
      ...p,
      size: snap(p.size * scale * (tokens.headline.size / 32)),
      weight,
      tracking: tracking * 0.85 + 0.12,
      lineHeight: typography.lineHeight,
      opacity: p.opacity * (typography.layerPriority / 90),
    };
  });
}

export function passesKnowledgeGateForDecision(
  decision: CreativeDirectorDecision,
  knowledgeScore: ReturnType<typeof scoreKnowledgeDecision>,
  isHero: boolean,
  printArea: string,
): { passed: boolean; reason?: string } {
  if (!passesKnowledgeGate(knowledgeScore, isHero)) {
    return { passed: false, reason: `knowledge score ${knowledgeScore.overall} below gate` };
  }
  if (isHero && decision.artDirection.feelsTooBusy) {
    return { passed: false, reason: "art direction: too busy for hero" };
  }
  if (isHero && !decision.artDirection.belongsOnOversizedTee && !printArea.toLowerCase().includes("micro")) {
    return { passed: false, reason: "art direction: not garment scale" };
  }
  return { passed: true };
}

export function evaluateKnowledgeGate(ctx: PremiumRenderContext, templateId: PremiumTemplateLayoutConfig["id"]): {
  passed: boolean;
  reason?: string;
  score: ReturnType<typeof scoreKnowledgeDecision>;
  applied: KnowledgeAppliedRecipe;
} {
  const isHero = ctx.spec.brief.role.toLowerCase().includes("hero");
  const applied = applyKnowledgeToRecipe(ctx, templateId);
  const gate = passesKnowledgeGateForDecision(
    applied.decision,
    applied.knowledgeScore,
    isHero,
    ctx.spec.brief.printArea,
  );
  return { ...gate, score: applied.knowledgeScore, applied };
}
