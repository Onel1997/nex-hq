import type { DesignStudioBrief } from "@/agents/design/studio-brief";
import type { DesignStyleDefinition, EffectDefinition, EffectId } from "@/lib/design/design-library/types";

export const EFFECT_REGISTRY: Record<EffectId, EffectDefinition> = {
  "vintage-distress": { id: "vintage-distress", name: "Vintage Distress", vectorOnly: true, opacityRange: [0.1, 0.25], recommendedStyles: ["vintage-washed"] },
  "screen-print-noise": { id: "screen-print-noise", name: "Screen Print Noise", vectorOnly: true, opacityRange: [0.08, 0.2], recommendedStyles: ["technical-streetwear", "vintage-washed"] },
  halftone: { id: "halftone", name: "Halftone", vectorOnly: true, opacityRange: [0.12, 0.28], recommendedStyles: ["editorial-fashion", "swiss-typography"] },
  fade: { id: "fade", name: "Fade", vectorOnly: true, opacityRange: [0.4, 0.75], recommendedStyles: ["silent-luxury", "japanese-minimal"] },
  outline: { id: "outline", name: "Outline", vectorOnly: true, opacityRange: [0.8, 1], recommendedStyles: ["minimal-luxury", "architectural"] },
  "outline-fill": { id: "outline-fill", name: "Outline + Fill", vectorOnly: true, opacityRange: [0.85, 1], recommendedStyles: ["architectural", "faith"] },
  embroidery: { id: "embroidery", name: "Embroidery", vectorOnly: true, opacityRange: [0.9, 1], recommendedStyles: ["faith"] },
  "heavy-ink": { id: "heavy-ink", name: "Heavy Ink", vectorOnly: true, opacityRange: [0.95, 1], recommendedStyles: ["modern-gothic", "technical-streetwear"] },
  washed: { id: "washed", name: "Washed", vectorOnly: true, opacityRange: [0.5, 0.8], recommendedStyles: ["vintage-washed", "scandinavian-minimal"] },
  "texture-mask": { id: "texture-mask", name: "Texture Mask", vectorOnly: true, opacityRange: [0.15, 0.35], recommendedStyles: ["modern-gothic", "vintage-washed"] },
  grain: { id: "grain", name: "Grain", vectorOnly: true, opacityRange: [0.1, 0.22], recommendedStyles: ["vintage-washed", "technical-streetwear"] },
  filled: { id: "filled", name: "Filled", vectorOnly: true, opacityRange: [0.9, 1], recommendedStyles: ["minimal-luxury", "editorial-fashion"] },
};

export function resolveEffects(brief: DesignStudioBrief, style: DesignStyleDefinition): EffectDefinition[] {
  const text = `${brief.materialEffects} ${brief.productionMethod}`.toLowerCase();
  const resolved: EffectId[] = ["filled"];

  if (text.includes("distress") || text.includes("worn")) resolved.push("vintage-distress");
  if (text.includes("grain") || text.includes("noise")) resolved.push("grain", "screen-print-noise");
  if (text.includes("halftone")) resolved.push("halftone");
  if (text.includes("fade") || text.includes("washed")) resolved.push("washed", "fade");
  if (text.includes("outline")) resolved.push("outline");
  if (text.includes("embroid")) resolved.push("embroidery");
  if (text.includes("heavy") || text.includes("bold ink")) resolved.push("heavy-ink");
  if (text.includes("mask") || text.includes("texture")) resolved.push("texture-mask");

  const allowed = new Set(style.allowedEffects);
  return [...new Set(resolved)]
    .filter((id) => allowed.has(id) || id === "filled")
    .map((id) => EFFECT_REGISTRY[id])
    .filter(Boolean);
}
