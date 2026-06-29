import { createAsset, stroke, tickCross, type AssetSeedConfig } from "@/lib/design/svg-assets/families/_shared";
import { circle, line, path } from "@/lib/design/vector-engine/xml";
import { fmt } from "@/lib/design/vector-engine/tokens";
import type { SvgAssetDefinition, SvgAssetRenderContext } from "@/lib/design/svg-assets/types";

const BASE: Omit<AssetSeedConfig, "complexity" | "visualWeight" | "qualityScore" | "variants"> = {
  styleTags: ["cross", "faith", "minimal"],
  recommendedStyles: ["faith", "modern-gothic", "minimal-luxury"],
  recommendedTemplates: ["faith-collection", "silent-collection", "modern-minimal"],
  recommendedPlacements: ["center-chest", "oversized-front"],
  printMethods: ["screen", "dtg", "embroidery"],
  renderMode: "stroke",
};

const SPECS: Array<{ slug: string; name: string; complexity: number; visualWeight: number; qualityScore: number; variants: string[]; render: (ctx: SvgAssetRenderContext) => string }> = [
  { slug: "equal-arm", name: "Equal Arm Cross", complexity: 2, visualWeight: 0.38, qualityScore: 82, variants: ["default"], render: (ctx) => tickCross(ctx, ctx.scale * 0.1) },
  { slug: "latin-thin", name: "Latin Thin Cross", complexity: 3, visualWeight: 0.42, qualityScore: 84, variants: ["default"], render: (ctx) => {
    const w = ctx.scale * 0.06;
    const h = ctx.scale * 0.14;
    const s = stroke(ctx.color, ctx.strokeWidth * 0.38, ctx.opacity);
    return [line(ctx.cx - w, ctx.cy, ctx.cx + w, ctx.cy, s), line(ctx.cx, ctx.cy - h, ctx.cx, ctx.cy + h * 0.4, s)].join("");
  }},
  { slug: "offset-cross", name: "Offset Cross", complexity: 4, visualWeight: 0.4, qualityScore: 85, variants: ["default"], render: (ctx) => {
    const arm = ctx.scale * 0.09;
    const off = ctx.scale * 0.02;
    const s = stroke(ctx.color, ctx.strokeWidth * 0.36, ctx.opacity * 0.75);
    return [line(ctx.cx - arm + off, ctx.cy, ctx.cx + arm + off, ctx.cy, s), line(ctx.cx + off, ctx.cy - arm, ctx.cx + off, ctx.cy + arm, s)].join("");
  }},
  { slug: "circle-cross", name: "Circle Cross", complexity: 5, visualWeight: 0.48, qualityScore: 87, variants: ["default"], render: (ctx) => {
    const r = ctx.scale * 0.12;
    return [
      circle(ctx.cx, ctx.cy, r, stroke(ctx.secondaryColor, ctx.strokeWidth * 0.32, ctx.opacity * 0.55)),
      tickCross(ctx, r * 0.65, 0.4),
    ].join("");
  }},
  { slug: "broken-cross", name: "Broken Cross", complexity: 5, visualWeight: 0.44, qualityScore: 86, variants: ["default"], render: (ctx) => {
    const arm = ctx.scale * 0.1;
    const gap = ctx.scale * 0.025;
    const s = stroke(ctx.color, ctx.strokeWidth * 0.36, ctx.opacity * 0.72);
    return [
      line(ctx.cx - arm, ctx.cy, ctx.cx - gap, ctx.cy, s),
      line(ctx.cx + gap, ctx.cy, ctx.cx + arm, ctx.cy, s),
      line(ctx.cx, ctx.cy - arm, ctx.cx, ctx.cy - gap, s),
      line(ctx.cx, ctx.cy + gap, ctx.cx, ctx.cy + arm, s),
    ].join("");
  }},
  { slug: "diamond-cross", name: "Diamond Cross", complexity: 5, visualWeight: 0.46, qualityScore: 87, variants: ["default"], render: (ctx) => {
    const s = ctx.scale * 0.1;
    const { cx, cy } = ctx;
    const st = stroke(ctx.accentColor, ctx.strokeWidth * 0.34, ctx.opacity * 0.7);
    return [
      line(cx, cy - s, cx + s * 0.55, cy, st),
      line(cx + s * 0.55, cy, cx, cy + s, st),
      line(cx, cy + s, cx - s * 0.55, cy, st),
      line(cx - s * 0.55, cy, cx, cy - s, st),
    ].join("");
  }},
  { slug: "corner-cross", name: "Corner Cross", complexity: 4, visualWeight: 0.36, qualityScore: 84, variants: ["default"], render: (ctx) => {
    const arm = ctx.scale * 0.08;
    const s = stroke(ctx.color, ctx.strokeWidth * 0.34, ctx.opacity * 0.68);
    return [
      line(ctx.cx, ctx.cy - arm, ctx.cx, ctx.cy, s),
      line(ctx.cx - arm * 0.6, ctx.cy, ctx.cx, ctx.cy, s),
    ].join("");
  }},
  { slug: "void-cross", name: "Void Cross", complexity: 6, visualWeight: 0.5, qualityScore: 88, variants: ["default"], render: (ctx) => {
    const arm = ctx.scale * 0.11;
    const voidR = ctx.scale * 0.025;
    const s = stroke(ctx.color, ctx.strokeWidth * 0.36, ctx.opacity * 0.72);
    return [
      line(ctx.cx - arm, ctx.cy, ctx.cx - voidR, ctx.cy, s),
      line(ctx.cx + voidR, ctx.cy, ctx.cx + arm, ctx.cy, s),
      line(ctx.cx, ctx.cy - arm, ctx.cx, ctx.cy - voidR, s),
      line(ctx.cx, ctx.cy + voidR, ctx.cx, ctx.cy + arm, s),
      circle(ctx.cx, ctx.cy, voidR * 0.8, stroke(ctx.secondaryColor, ctx.strokeWidth * 0.22, ctx.opacity * 0.4)),
    ].join("");
  }},
  { slug: "extended-cross", name: "Extended Cross", complexity: 4, visualWeight: 0.43, qualityScore: 85, variants: ["default", "tall"], render: (ctx) => {
    const w = ctx.scale * 0.07;
    const h = ctx.scale * 0.16;
    const s = stroke(ctx.color, ctx.strokeWidth * 0.35, ctx.opacity * 0.75);
    return [line(ctx.cx - w, ctx.cy - h * 0.15, ctx.cx + w, ctx.cy - h * 0.15, s), line(ctx.cx, ctx.cy - h, ctx.cx, ctx.cy + h * 0.35, s)].join("");
  }},
  { slug: "outline-cross", name: "Outline Cross", complexity: 5, visualWeight: 0.45, qualityScore: 86, variants: ["default"], render: (ctx) => {
    const arm = ctx.scale * 0.1;
    const inset = ctx.scale * 0.025;
    const { cx, cy } = ctx;
    const st = stroke(ctx.color, ctx.strokeWidth * 0.3, ctx.opacity * 0.65);
    return path(
      `M ${fmt(cx - arm)} ${fmt(cy - inset)} L ${fmt(cx - inset)} ${fmt(cy - inset)} L ${fmt(cx - inset)} ${fmt(cy - arm)} L ${fmt(cx + inset)} ${fmt(cy - arm)} L ${fmt(cx + inset)} ${fmt(cy - inset)} L ${fmt(cx + arm)} ${fmt(cy - inset)} L ${fmt(cx + arm)} ${fmt(cy + inset)} L ${fmt(cx + inset)} ${fmt(cy + inset)} L ${fmt(cx + inset)} ${fmt(cy + arm)} L ${fmt(cx - inset)} ${fmt(cy + arm)} L ${fmt(cx - inset)} ${fmt(cy + inset)} L ${fmt(cx - arm)} ${fmt(cy + inset)} Z`,
      st,
    );
  }},
];

export const CROSS_ASSETS: SvgAssetDefinition[] = SPECS.map((spec) =>
  createAsset("cross", spec.slug, spec.name, { ...BASE, complexity: spec.complexity, visualWeight: spec.visualWeight, qualityScore: spec.qualityScore, variants: spec.variants }, spec.render),
);
