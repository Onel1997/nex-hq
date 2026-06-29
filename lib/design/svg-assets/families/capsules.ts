import {
  capsuleOutline,
  createAsset,
  stroke,
  type AssetSeedConfig,
} from "@/lib/design/svg-assets/families/_shared";
import { line } from "@/lib/design/vector-engine/xml";
import type { SvgAssetDefinition, SvgAssetRenderContext } from "@/lib/design/svg-assets/types";

const BASE: Omit<AssetSeedConfig, "complexity" | "visualWeight" | "qualityScore" | "variants"> = {
  styleTags: ["capsule", "label", "code"],
  recommendedStyles: ["technical-streetwear", "minimal-luxury", "editorial-fashion"],
  recommendedTemplates: ["technical-luxury", "fashion-campaign", "modern-minimal"],
  recommendedPlacements: ["center-chest", "sleeve", "corner"],
  printMethods: ["screen", "dtg", "vinyl"],
  renderMode: "stroke",
};

function capsuleWithTicks(ctx: SvgAssetRenderContext, w: number, h: number, ticks: number): string {
  const parts = [capsuleOutline(ctx, w, h)];
  const s = stroke(ctx.secondaryColor, ctx.strokeWidth * 0.22, ctx.opacity * 0.45);
  for (let i = 0; i < ticks; i++) {
    const t = (i + 1) / (ticks + 1);
    const x = ctx.cx - w / 2 + w * t;
    parts.push(line(x, ctx.cy - h * 0.22, x, ctx.cy + h * 0.22, s));
  }
  return parts.join("");
}

const SPECS: Array<{ slug: string; name: string; complexity: number; visualWeight: number; qualityScore: number; variants: string[]; render: (ctx: SvgAssetRenderContext) => string }> = [
  { slug: "mono", name: "Mono Capsule", complexity: 3, visualWeight: 0.32, qualityScore: 83, variants: ["default"], render: (ctx) => capsuleOutline(ctx, ctx.scale * 0.48, ctx.scale * 0.14) },
  { slug: "dual-line", name: "Dual Line Capsule", complexity: 4, visualWeight: 0.35, qualityScore: 84, variants: ["default"], render: (ctx) => {
    const w = ctx.scale * 0.5;
    const h = ctx.scale * 0.13;
    return [
      capsuleOutline(ctx, w, h),
      line(ctx.cx - w * 0.32, ctx.cy, ctx.cx + w * 0.32, ctx.cy, stroke(ctx.secondaryColor, ctx.strokeWidth * 0.22, ctx.opacity * 0.45)),
    ].join("");
  }},
  { slug: "segmented", name: "Segmented Capsule", complexity: 5, visualWeight: 0.38, qualityScore: 86, variants: ["default"], render: (ctx) => capsuleWithTicks(ctx, ctx.scale * 0.52, ctx.scale * 0.14, 3) },
  { slug: "wide-code", name: "Wide Code Capsule", complexity: 4, visualWeight: 0.36, qualityScore: 85, variants: ["default", "wide"], render: (ctx) => capsuleOutline(ctx, ctx.scale * 0.62, ctx.scale * 0.12, 0.35) },
  { slug: "stacked-pair", name: "Stacked Pair Capsule", complexity: 5, visualWeight: 0.4, qualityScore: 87, variants: ["default"], render: (ctx) => {
    const w = ctx.scale * 0.44;
    const h = ctx.scale * 0.1;
    const gap = ctx.scale * 0.04;
    return [
      capsuleOutline({ ...ctx, cy: ctx.cy - gap }, w, h, 0.36),
      capsuleOutline({ ...ctx, cy: ctx.cy + gap }, w * 0.78, h * 0.85, 0.32),
    ].join("");
  }},
  { slug: "notch-capsule", name: "Notch Capsule", complexity: 5, visualWeight: 0.37, qualityScore: 86, variants: ["default"], render: (ctx) => {
    const w = ctx.scale * 0.48;
    const h = ctx.scale * 0.13;
    const notch = ctx.scale * 0.03;
    return [
      capsuleOutline(ctx, w, h),
      line(ctx.cx - notch, ctx.cy - h / 2, ctx.cx, ctx.cy - h / 2 - notch, stroke(ctx.accentColor, ctx.strokeWidth * 0.28, ctx.opacity * 0.55)),
      line(ctx.cx, ctx.cy - h / 2 - notch, ctx.cx + notch, ctx.cy - h / 2, stroke(ctx.accentColor, ctx.strokeWidth * 0.28, ctx.opacity * 0.55)),
    ].join("");
  }},
  { slug: "rail-capsule", name: "Rail Capsule", complexity: 4, visualWeight: 0.34, qualityScore: 84, variants: ["default"], render: (ctx) => {
    const w = ctx.scale * 0.5;
    const h = ctx.scale * 0.12;
    return [
      line(ctx.cx - w * 0.6, ctx.cy, ctx.cx - w / 2, ctx.cy, stroke(ctx.secondaryColor, ctx.strokeWidth * 0.24, ctx.opacity * 0.4)),
      capsuleOutline(ctx, w, h),
      line(ctx.cx + w / 2, ctx.cy, ctx.cx + w * 0.6, ctx.cy, stroke(ctx.secondaryColor, ctx.strokeWidth * 0.24, ctx.opacity * 0.4)),
    ].join("");
  }},
  { slug: "micro-capsule", name: "Micro Capsule", complexity: 3, visualWeight: 0.28, qualityScore: 82, variants: ["default", "micro"], render: (ctx) => capsuleOutline(ctx, ctx.scale * 0.32, ctx.scale * 0.09, 0.38) },
  { slug: "split-capsule", name: "Split Capsule", complexity: 5, visualWeight: 0.39, qualityScore: 87, variants: ["default"], render: (ctx) => {
    const w = ctx.scale * 0.5;
    const h = ctx.scale * 0.13;
    return [
      capsuleOutline(ctx, w, h),
      line(ctx.cx, ctx.cy - h * 0.35, ctx.cx, ctx.cy + h * 0.35, stroke(ctx.accentColor, ctx.strokeWidth * 0.2, ctx.opacity * 0.4)),
      line(ctx.cx - w * 0.2, ctx.cy, ctx.cx + w * 0.2, ctx.cy, stroke(ctx.secondaryColor, ctx.strokeWidth * 0.2, ctx.opacity * 0.35)),
    ].join("");
  }},
  { slug: "index-capsule", name: "Index Capsule", complexity: 6, visualWeight: 0.42, qualityScore: 88, variants: ["default"], render: (ctx) => capsuleWithTicks(ctx, ctx.scale * 0.55, ctx.scale * 0.14, 5) },
];

export const CAPSULE_ASSETS: SvgAssetDefinition[] = SPECS.map((spec) =>
  createAsset("capsule", spec.slug, spec.name, { ...BASE, complexity: spec.complexity, visualWeight: spec.visualWeight, qualityScore: spec.qualityScore, variants: spec.variants }, spec.render),
);
