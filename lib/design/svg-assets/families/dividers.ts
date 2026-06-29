import { createAsset, stroke, type AssetSeedConfig } from "@/lib/design/svg-assets/families/_shared";
import { circle, line } from "@/lib/design/vector-engine/xml";
import type { SvgAssetDefinition, SvgAssetRenderContext } from "@/lib/design/svg-assets/types";

const BASE: Omit<AssetSeedConfig, "complexity" | "visualWeight" | "qualityScore" | "variants"> = {
  styleTags: ["editorial", "divider", "rhythm"],
  recommendedStyles: ["editorial-fashion", "swiss-typography", "minimal-luxury"],
  recommendedTemplates: ["luxury-editorial", "gallery-poster", "museum-label"],
  recommendedPlacements: ["center-chest", "oversized-front"],
  printMethods: ["screen", "dtg"],
  renderMode: "stroke",
};

function horizRule(ctx: SvgAssetRenderContext, w: number, swMul: number, opMul: number, yOff = 0): string {
  return line(ctx.cx - w / 2, ctx.cy + yOff, ctx.cx + w / 2, ctx.cy + yOff, stroke(ctx.color, ctx.strokeWidth * swMul, ctx.opacity * opMul));
}

const SPECS: Array<{ slug: string; name: string; complexity: number; visualWeight: number; qualityScore: number; variants: string[]; render: (ctx: SvgAssetRenderContext) => string }> = [
  { slug: "center-dot", name: "Center Dot Divider", complexity: 3, visualWeight: 0.35, qualityScore: 84, variants: ["default"], render: (ctx) => {
    const w = ctx.scale * 0.62;
    return [
      horizRule(ctx, w * 0.38, 0.32, 0.7, 0),
      circle(ctx.cx, ctx.cy, ctx.strokeWidth * 0.55, { fill: ctx.accentColor, opacity: ctx.opacity * 0.65 }),
      horizRule(ctx, w * 0.38, 0.32, 0.7, 0),
    ].join("");
  }},
  { slug: "flank-dots", name: "Flank Dots Divider", complexity: 4, visualWeight: 0.38, qualityScore: 85, variants: ["default"], render: (ctx) => {
    const w = ctx.scale * 0.58;
    const dot = ctx.strokeWidth * 0.4;
    return [
      horizRule(ctx, w, 0.3, 0.65),
      circle(ctx.cx - w * 0.22, ctx.cy, dot, { fill: ctx.secondaryColor, opacity: ctx.opacity * 0.55 }),
      circle(ctx.cx + w * 0.22, ctx.cy, dot, { fill: ctx.secondaryColor, opacity: ctx.opacity * 0.55 }),
    ].join("");
  }},
  { slug: "triple-rule", name: "Triple Rule Divider", complexity: 4, visualWeight: 0.42, qualityScore: 86, variants: ["default", "tight"], render: (ctx) => {
    const w = ctx.scale * 0.64;
  const gap = ctx.scale * 0.04;
    return [
      horizRule(ctx, w, 0.34, 0.6, -gap),
      horizRule(ctx, w * 0.72, 0.28, 0.5),
      horizRule(ctx, w, 0.34, 0.6, gap),
    ].join("");
  }},
  { slug: "broken-rule", name: "Broken Rule Divider", complexity: 5, visualWeight: 0.45, qualityScore: 87, variants: ["default"], render: (ctx) => {
    const w = ctx.scale * 0.6;
    const s = stroke(ctx.color, ctx.strokeWidth * 0.32, ctx.opacity * 0.7);
    return [
      line(ctx.cx - w / 2, ctx.cy, ctx.cx - w * 0.08, ctx.cy, s),
      line(ctx.cx + w * 0.08, ctx.cy, ctx.cx + w / 2, ctx.cy, s),
      line(ctx.cx - w * 0.04, ctx.cy - ctx.scale * 0.03, ctx.cx + w * 0.04, ctx.cy + ctx.scale * 0.03, stroke(ctx.accentColor, ctx.strokeWidth * 0.25, ctx.opacity * 0.5)),
    ].join("");
  }},
  { slug: "diamond-center", name: "Diamond Center Divider", complexity: 5, visualWeight: 0.48, qualityScore: 88, variants: ["default"], render: (ctx) => {
    const w = ctx.scale * 0.58;
    const d = ctx.scale * 0.04;
    const { cx, cy } = ctx;
    const s = stroke(ctx.accentColor, ctx.strokeWidth * 0.3, ctx.opacity * 0.6);
    return [
      horizRule(ctx, w * 0.4, 0.3, 0.65, 0),
      line(cx, cy - d, cx + d * 0.7, cy, s),
      line(cx + d * 0.7, cy, cx, cy + d, s),
      line(cx, cy + d, cx - d * 0.7, cy, s),
      line(cx - d * 0.7, cy, cx, cy - d, s),
      horizRule(ctx, w * 0.4, 0.3, 0.65, 0),
    ].join("");
  }},
  { slug: "offset-rule", name: "Offset Rule Divider", complexity: 4, visualWeight: 0.4, qualityScore: 85, variants: ["default", "mirror"], render: (ctx) => {
    const w = ctx.scale * 0.55;
    return [
      horizRule(ctx, w, 0.3, 0.55, -ctx.scale * 0.025),
      horizRule(ctx, w * 0.7, 0.26, 0.45, ctx.scale * 0.025),
    ].join("");
  }},
  { slug: "tick-divider", name: "Tick Divider", complexity: 5, visualWeight: 0.44, qualityScore: 86, variants: ["default"], render: (ctx) => {
    const w = ctx.scale * 0.6;
    const tick = ctx.scale * 0.05;
    const s = stroke(ctx.color, ctx.strokeWidth * 0.3, ctx.opacity * 0.65);
    const parts = [horizRule(ctx, w, 0.32, 0.6)];
    for (const off of [-0.3, -0.15, 0, 0.15, 0.3]) {
      const x = ctx.cx + w * off;
      parts.push(line(x, ctx.cy - tick, x, ctx.cy + tick, s));
    }
    return parts.join("");
  }},
  { slug: "luxury-span", name: "Luxury Span Divider", complexity: 6, visualWeight: 0.5, qualityScore: 89, variants: ["default"], render: (ctx) => {
    const w = ctx.scale * 0.68;
    return [
      horizRule(ctx, w, 0.28, 0.55),
      horizRule(ctx, w * 0.45, 0.22, 0.4, -ctx.scale * 0.035),
      horizRule(ctx, w * 0.45, 0.22, 0.4, ctx.scale * 0.035),
      circle(ctx.cx, ctx.cy, ctx.strokeWidth * 0.35, { fill: "none", stroke: ctx.secondaryColor, "stroke-width": ctx.strokeWidth * 0.22, opacity: ctx.opacity * 0.45 }),
    ].join("");
  }},
  { slug: "editorial-gap", name: "Editorial Gap Divider", complexity: 5, visualWeight: 0.46, qualityScore: 87, variants: ["default"], render: (ctx) => {
    const w = ctx.scale * 0.62;
    const gap = ctx.scale * 0.06;
    const s = stroke(ctx.color, ctx.strokeWidth * 0.34, ctx.opacity * 0.68);
    return [
      line(ctx.cx - w / 2, ctx.cy, ctx.cx - gap, ctx.cy, s),
      line(ctx.cx + gap, ctx.cy, ctx.cx + w / 2, ctx.cy, s),
    ].join("");
  }},
  { slug: "micro-dash", name: "Micro Dash Divider", complexity: 4, visualWeight: 0.36, qualityScore: 84, variants: ["default", "sparse"], render: (ctx) => {
    const w = ctx.scale * 0.56;
    const s = stroke(ctx.secondaryColor, ctx.strokeWidth * 0.28, ctx.opacity * 0.55);
    const parts: string[] = [];
    for (let i = -4; i <= 4; i++) {
      const x = ctx.cx + (w / 8) * i;
      parts.push(line(x - ctx.scale * 0.015, ctx.cy, x + ctx.scale * 0.015, ctx.cy, s));
    }
    return parts.join("");
  }},
];

export const DIVIDER_ASSETS: SvgAssetDefinition[] = SPECS.map((spec) =>
  createAsset("divider", spec.slug, spec.name, { ...BASE, complexity: spec.complexity, visualWeight: spec.visualWeight, qualityScore: spec.qualityScore, variants: spec.variants }, spec.render),
);
