import { createAsset, stroke, type AssetSeedConfig } from "@/lib/design/svg-assets/families/_shared";
import { circle, line, path } from "@/lib/design/vector-engine/xml";
import { fmt } from "@/lib/design/vector-engine/tokens";
import type { SvgAssetDefinition, SvgAssetRenderContext } from "@/lib/design/svg-assets/types";

const BASE: Omit<AssetSeedConfig, "complexity" | "visualWeight" | "qualityScore" | "variants"> = {
  styleTags: ["star", "celestial", "accent"],
  recommendedStyles: ["minimal-luxury", "scandinavian-minimal", "modern-gothic"],
  recommendedTemplates: ["modern-minimal", "silent-collection", "luxury-editorial"],
  recommendedPlacements: ["center-chest", "corner", "sleeve"],
  printMethods: ["screen", "dtg", "embroidery"],
  renderMode: "stroke",
};

function fourPointStar(ctx: SvgAssetRenderContext, arm: number, inset: number): string {
  const { cx, cy } = ctx;
  const s = stroke(ctx.color, ctx.strokeWidth * 0.36, ctx.opacity);
  return [
    line(cx, cy - arm, cx, cy - inset, s),
    line(cx, cy + inset, cx, cy + arm, s),
    line(cx - arm * 0.7, cy, cx - inset * 0.7, cy, s),
    line(cx + inset * 0.7, cy, cx + arm * 0.7, cy, s),
  ].join("");
}

function starPath(cx: number, cy: number, outer: number, inner: number, points: number): string {
  const coords: string[] = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const angle = (Math.PI / points) * i - Math.PI / 2;
    coords.push(`${i === 0 ? "M" : "L"} ${fmt(cx + Math.cos(angle) * r)} ${fmt(cy + Math.sin(angle) * r)}`);
  }
  return `${coords.join(" ")} Z`;
}

const SPECS: Array<{ slug: string; name: string; complexity: number; visualWeight: number; qualityScore: number; variants: string[]; render: (ctx: SvgAssetRenderContext) => string }> = [
  { slug: "minimal-four", name: "Minimal Four Point", complexity: 3, visualWeight: 0.34, qualityScore: 83, variants: ["default"], render: (ctx) => fourPointStar(ctx, ctx.scale * 0.1, ctx.scale * 0.02) },
  { slug: "spark", name: "Spark Star", complexity: 4, visualWeight: 0.38, qualityScore: 85, variants: ["default"], render: (ctx) => {
    const arm = ctx.scale * 0.09;
    const s = stroke(ctx.accentColor, ctx.strokeWidth * 0.34, ctx.opacity * 0.75);
    const { cx, cy } = ctx;
    return [
      line(cx, cy - arm, cx, cy + arm, s),
      line(cx - arm * 0.7, cy, cx + arm * 0.7, cy, s),
      line(cx - arm * 0.45, cy - arm * 0.45, cx + arm * 0.45, cy + arm * 0.45, stroke(ctx.secondaryColor, ctx.strokeWidth * 0.24, ctx.opacity * 0.45)),
      line(cx - arm * 0.45, cy + arm * 0.45, cx + arm * 0.45, cy - arm * 0.45, stroke(ctx.secondaryColor, ctx.strokeWidth * 0.24, ctx.opacity * 0.45)),
    ].join("");
  }},
  { slug: "five-point", name: "Five Point Star", complexity: 5, visualWeight: 0.46, qualityScore: 87, variants: ["default"], render: (ctx) => path(starPath(ctx.cx, ctx.cy, ctx.scale * 0.11, ctx.scale * 0.045, 5), stroke(ctx.color, ctx.strokeWidth * 0.34, ctx.opacity * 0.72)) },
  { slug: "hollow-star", name: "Hollow Star", complexity: 5, visualWeight: 0.44, qualityScore: 86, variants: ["default"], render: (ctx) => {
    const outer = ctx.scale * 0.1;
    const inner = ctx.scale * 0.05;
    return [
      path(starPath(ctx.cx, ctx.cy, outer, inner, 5), stroke(ctx.color, ctx.strokeWidth * 0.32, ctx.opacity * 0.65)),
      circle(ctx.cx, ctx.cy, inner * 0.5, stroke(ctx.secondaryColor, ctx.strokeWidth * 0.22, ctx.opacity * 0.4)),
    ].join("");
  }},
  { slug: "asterisk", name: "Asterisk Star", complexity: 4, visualWeight: 0.4, qualityScore: 84, variants: ["default"], render: (ctx) => {
    const arm = ctx.scale * 0.1;
    const s = stroke(ctx.color, ctx.strokeWidth * 0.3, ctx.opacity * 0.68);
    const { cx, cy } = ctx;
    const parts = [line(cx, cy - arm, cx, cy + arm, s), line(cx - arm * 0.7, cy, cx + arm * 0.7, cy, s)];
    for (const deg of [45, 135]) {
      const rad = (deg * Math.PI) / 180;
      parts.push(line(cx - Math.cos(rad) * arm * 0.6, cy - Math.sin(rad) * arm * 0.6, cx + Math.cos(rad) * arm * 0.6, cy + Math.sin(rad) * arm * 0.6, stroke(ctx.secondaryColor, ctx.strokeWidth * 0.22, ctx.opacity * 0.42)));
    }
    return parts.join("");
  }},
  { slug: "compass-star", name: "Compass Star", complexity: 6, visualWeight: 0.5, qualityScore: 88, variants: ["default"], render: (ctx) => {
    const r = ctx.scale * 0.11;
    return [
      circle(ctx.cx, ctx.cy, r, stroke(ctx.secondaryColor, ctx.strokeWidth * 0.28, ctx.opacity * 0.5)),
      fourPointStar(ctx, r * 0.85, r * 0.15),
      line(ctx.cx, ctx.cy - r * 0.3, ctx.cx, ctx.cy + r * 0.3, stroke(ctx.accentColor, ctx.strokeWidth * 0.24, ctx.opacity * 0.45)),
    ].join("");
  }},
  { slug: "burst", name: "Burst Star", complexity: 5, visualWeight: 0.48, qualityScore: 87, variants: ["default", "dense"], render: (ctx) => {
    const arm = ctx.scale * 0.1;
    const parts: string[] = [];
    for (let i = 0; i < 8; i++) {
      const rad = (Math.PI / 4) * i;
      const x2 = ctx.cx + Math.cos(rad) * arm;
      const y2 = ctx.cy + Math.sin(rad) * arm;
      parts.push(line(ctx.cx, ctx.cy, x2, y2, stroke(ctx.color, ctx.strokeWidth * 0.26, ctx.opacity * 0.55)));
    }
    return parts.join("");
  }},
  { slug: "offset-star", name: "Offset Star", complexity: 5, visualWeight: 0.42, qualityScore: 85, variants: ["default"], render: (ctx) => {
    const off = ctx.scale * 0.015;
    return fourPointStar({ ...ctx, cx: ctx.cx + off, cy: ctx.cy - off }, ctx.scale * 0.09, ctx.scale * 0.018);
  }},
  { slug: "thin-star", name: "Thin Star", complexity: 3, visualWeight: 0.32, qualityScore: 82, variants: ["default", "hairline"], render: (ctx) => fourPointStar(ctx, ctx.scale * 0.11, ctx.scale * 0.035) },
  { slug: "nested-star", name: "Nested Star", complexity: 7, visualWeight: 0.52, qualityScore: 90, variants: ["default"], render: (ctx) => {
    const outer = ctx.scale * 0.11;
    const mid = outer * 0.68;
    return [
      path(starPath(ctx.cx, ctx.cy, outer, outer * 0.42, 5), stroke(ctx.color, ctx.strokeWidth * 0.32, ctx.opacity * 0.65)),
      path(starPath(ctx.cx, ctx.cy, mid, mid * 0.4, 5), stroke(ctx.secondaryColor, ctx.strokeWidth * 0.24, ctx.opacity * 0.45)),
    ].join("");
  }},
];

export const STAR_ASSETS: SvgAssetDefinition[] = SPECS.map((spec) =>
  createAsset("star", spec.slug, spec.name, { ...BASE, complexity: spec.complexity, visualWeight: spec.visualWeight, qualityScore: spec.qualityScore, variants: spec.variants }, spec.render),
);
