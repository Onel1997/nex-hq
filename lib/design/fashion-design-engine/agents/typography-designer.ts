import type { DesignStudioBrief } from "@/agents/design/studio-brief";
import type { DesignConcept } from "@/lib/design/ai-designer/types";
import { decideHeroTypographyDirection } from "@/lib/design/design-knowledge/hero-typography";
import { decideWearabilityDirection } from "@/lib/design/design-knowledge/wearability";
import { hashString } from "@/lib/design/vector-engine/hash";
import { resolveMasterArtworkVisibleText } from "@/lib/design/master-artwork-prompt";
import type { CreativeDesignBrief, LayoutSpec, TypographySpec } from "../types";

export interface TypographyDesignerAgentInput {
  brief: DesignStudioBrief;
  concept: DesignConcept;
  creativeBrief: CreativeDesignBrief;
  layoutSpec: LayoutSpec;
}

/**
 * Typography Designer Agent — structured specs for vector/SVG rendering.
 * NEVER relies on AI-generated image text.
 */
export function runTypographyDesignerAgent(
  input: TypographyDesignerAgentInput,
): TypographySpec {
  const { brief, concept, layoutSpec } = input;
  const seed = hashString(brief.designId) % 10000;
  const wearability = decideWearabilityDirection(brief, seed);
  const typographyDirection = decideHeroTypographyDirection(brief, seed, wearability);
  const visible = resolveMasterArtworkVisibleText(brief, concept);

  const heroContent = visible.visibleText.toUpperCase();
  const hasSecondary = visible.secondaryText.length > 0;

  const blocks: TypographySpec["blocks"] = [
    {
      id: "hero-headline",
      role: "hero",
      content: heroContent,
      fontFamily: resolveFontFamily(typographyDirection.direction),
      fontWeight: 400,
      fontSizeMm: resolveHeroSizeMm(layoutSpec),
      letterSpacingMm: resolveTrackingMm(typographyDirection.direction),
      lineHeight: 1.1,
      textTransform: "uppercase",
      alignment: layoutSpec.printArea === "left-chest" ? "left" : "center",
      opacity: 1,
    },
  ];

  if (hasSecondary) {
    for (const [index, line] of visible.secondaryText.slice(0, 2).entries()) {
      blocks.push({
        id: `secondary-${index + 1}`,
        role: index === 0 ? "secondary" : "micro",
        content: line.toUpperCase(),
        fontFamily: "Helvetica Neue, Arial, sans-serif",
        fontWeight: 300,
        fontSizeMm: resolveHeroSizeMm(layoutSpec) * 0.45,
        letterSpacingMm: resolveTrackingMm(typographyDirection.direction) * 1.2,
        lineHeight: 1.2,
        textTransform: "uppercase",
        alignment: "center",
        opacity: index === 0 ? 0.85 : 0.6,
      });
    }
  }

  return {
    blocks,
    fontRecommendations: buildFontRecommendations(typographyDirection.direction),
    hierarchy: {
      primary: heroContent,
      secondary: visible.secondaryText[0],
      tertiary: visible.secondaryText[1],
      visualWeightDistribution: concept.typographyLanguage.compositionShare,
    },
    tracking: {
      hero: `+${Math.round(resolveTrackingMm(typographyDirection.direction) * 10)}`,
      secondary: "+350–450",
      micro: "+500",
      rationale: "Extreme editorial tracking signals luxury streetwear — anti-merch-label spacing",
    },
    kerning: {
      headlinePairs: ["AV", "WA", "LT", "RY"],
      globalAdjustment: "-2% to +1% optical per pair",
      opticalBalance: typographyDirection.reason || "Widen outer letterforms for oversized garment scale",
    },
    luxuryRules: [
      "Maximum 1–2 text blocks visible at garment scale",
      "Uppercase editorial treatment for hero lines",
      "No distressed rave typography — flat premium plastisol",
      "Typography rendered via vector/SVG only — never AI image text",
      concept.typographyLanguage.behaviors.slice(0, 2).join("; "),
    ],
    renderMode: "vector-only",
  };
}

function resolveFontFamily(direction: string): string {
  if (direction.includes("silent") || direction.includes("luxury")) {
    return "Cormorant Garamond, Georgia, serif";
  }
  if (direction.includes("statement")) {
    return "Helvetica Neue Condensed, Arial Narrow, sans-serif";
  }
  if (direction.includes("hero") || direction.includes("faith")) {
    return "Helvetica Neue, Inter, sans-serif";
  }
  return "Helvetica Neue, Arial, sans-serif";
}

function resolveHeroSizeMm(layoutSpec: LayoutSpec): number {
  const height = layoutSpec.frontLayout?.boundingBoxMm.height
    ?? layoutSpec.backLayout?.boundingBoxMm.height
    ?? 120;
  return Math.max(6, Math.min(14, height * 0.12));
}

function resolveTrackingMm(direction: string): number {
  if (direction.includes("silent") || direction.includes("hero")) return 3.5;
  if (direction.includes("core")) return 2;
  return 2.8;
}

function buildFontRecommendations(
  direction: string,
): TypographySpec["fontRecommendations"] {
  const recommendations: TypographySpec["fontRecommendations"] = [
    {
      family: "Cormorant Garamond",
      category: "editorial-serif",
      usage: "Hero headlines — luxury editorial streetwear",
      luxurySignal: "Fashion-week editorial serif with garment-scale presence",
    },
    {
      family: "Helvetica Neue",
      category: "minimal-sans",
      usage: "Secondary lines and micro branding",
      luxurySignal: "Swiss minimal discipline — quiet confidence",
    },
  ];

  if (direction.includes("statement")) {
    recommendations.push({
      family: "Helvetica Neue Condensed",
      category: "condensed-grotesk",
      usage: "Stacked headline variants",
      luxurySignal: "Architectural vertical compression",
    });
  }

  return recommendations;
}
