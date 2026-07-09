import {
  arcSeg,
  cornerBracket,
  createAsset,
  stroke,
  type AssetSeedConfig,
} from "@/lib/design/svg-assets/families/_shared";
import { circle, line, path } from "@/lib/design/vector-engine/xml";
import type { SvgAssetDefinition, SvgAssetRenderContext } from "@/lib/design/svg-assets/types";

const BASE: Omit<AssetSeedConfig, "complexity" | "visualWeight" | "qualityScore" | "variants"> = {
  styleTags: ["ornament", "decorative", "system"],
  recommendedStyles: ["editorial-fashion", "minimal-luxury", "vintage-washed"],
  recommendedTemplates: ["luxury-editorial", "gallery-poster", "fashion-campaign"],
  recommendedPlacements: ["center-chest", "oversized-front"],
  printMethods: ["screen", "dtg", "embroidery"],
  renderMode: "mixed",
};

const SPECS: Array<{ slug: string; name: string; complexity: number; visualWeight: number; qualityScore: number; variants: string[]; render: (ctx: SvgAssetRenderContext) => string }> = [
  { slug: "flourish-pair", name: "Flourish Pair", complexity: 5, visualWeight: 0.42, qualityScore: 86, variants: ["default"], render: (ctx) => {
    const w = ctx.scale * 0.2;
    const s = stroke(ctx.color, ctx.strokeWidth * 0.3, ctx.opacity * 0.6);
    return [
      path(`M ${ctx.cx - w} ${ctx.cy} Q ${ctx.cx - w * 0.4} ${ctx.cy - w * 0.3} ${ctx.cx} ${ctx.cy}`, s),
      path(`M ${ctx.cx} ${ctx.cy} Q ${ctx.cx + w * 0.4} ${ctx.cy + w * 0.3} ${ctx.cx + w} ${ctx.cy}`, s),
    ].join("");
  }},
  { slug: "corner-ornament", name: "Corner Ornament", complexity: 5, visualWeight: 0.4, qualityScore: 85, variants: ["default"], render: (ctx) => {
    const arm = ctx.scale * 0.14;
    return [
      cornerBracket(ctx.cx, ctx.cy, arm, 1, 1, ctx.color, ctx.strokeWidth * 0.34, ctx.opacity * 0.65),
      path(arcSeg(ctx.cx + arm * 0.3, ctx.cy + arm * 0.3, arm * 0.4, 180, 270), stroke(ctx.secondaryColor, ctx.strokeWidth * 0.24, ctx.opacity * 0.45)),
    ].join("");
  }},
  { slug: "vine-line", name: "Vine Line", complexity: 6, visualWeight: 0.44, qualityScore: 87, variants: ["default"], render: (ctx) => {
    const w = ctx.scale * 0.24;
    const s = stroke(ctx.color, ctx.strokeWidth * 0.28, ctx.opacity * 0.55);
    const { cx, cy } = ctx;
    return [
      path(`M ${cx - w} ${cy} C ${cx - w * 0.3} ${cy - w * 0.2} ${cx + w * 0.3} ${cy + w * 0.2} ${cx + w} ${cy}`, s),
      circle(cx - w * 0.5, cy - w * 0.08, ctx.strokeWidth * 0.25, { fill: ctx.accentColor, opacity: ctx.opacity * 0.4 }),
      circle(cx + w * 0.5, cy + w * 0.08, ctx.strokeWidth * 0.25, { fill: ctx.accentColor, opacity: ctx.opacity * 0.4 }),
    ].join("");
  }},
  { slug: "bracket-system", name: "Bracket System", complexity: 5, visualWeight: 0.38, qualityScore: 85, variants: ["default"], render: (ctx) => {
    const arm = ctx.scale * 0.1;
    const gap = ctx.scale * 0.18;
    const c = ctx.color;
    const sw = ctx.strokeWidth * 0.32;
    const op = ctx.opacity * 0.62;
    return [
      cornerBracket(ctx.cx - gap, ctx.cy - gap, arm, 1, 1, c, sw, op),
      cornerBracket(ctx.cx + gap, ctx.cy - gap, arm, -1, 1, c, sw, op),
      cornerBracket(ctx.cx - gap, ctx.cy + gap, arm, 1, -1, c, sw, op),
      cornerBracket(ctx.cx + gap, ctx.cy + gap, arm, -1, -1, c, sw, op),
    ].join("");
  }},
  { slug: "radial-ticks", name: "Radial Tick Ornament", complexity: 6, visualWeight: 0.46, qualityScore: 88, variants: ["default"], render: (ctx) => {
    const r = ctx.scale * 0.16;
    const parts: string[] = [];
    for (let i = 0; i < 12; i++) {
      const deg = i * 30;
      const rad = (deg * Math.PI) / 180;
      const x1 = ctx.cx + Math.cos(rad) * r * 0.7;
      const y1 = ctx.cy + Math.sin(rad) * r * 0.7;
      const x2 = ctx.cx + Math.cos(rad) * r;
      const y2 = ctx.cy + Math.sin(rad) * r;
      parts.push(line(x1, y1, x2, y2, stroke(ctx.secondaryColor, ctx.strokeWidth * 0.22, ctx.opacity * 0.42)));
    }
    return parts.join("");
  }},
  { slug: "scroll-accent", name: "Scroll Accent", complexity: 6, visualWeight: 0.48, qualityScore: 89, variants: ["default"], render: (ctx) => {
    const w = ctx.scale * 0.18;
    const s = stroke(ctx.color, ctx.strokeWidth * 0.28, ctx.opacity * 0.58);
    const { cx, cy } = ctx;
    return path(`M ${cx - w} ${cy} Q ${cx - w * 0.2} ${cy - w * 0.35} ${cx} ${cy} Q ${cx + w * 0.2} ${cy + w * 0.35} ${cx + w} ${cy}`, s);
  }},
  { slug: "diamond-ornament", name: "Diamond Ornament", complexity: 5, visualWeight: 0.4, qualityScore: 85, variants: ["default"], render: (ctx) => {
    const s = ctx.scale * 0.08;
    const { cx, cy } = ctx;
    const st = stroke(ctx.accentColor, ctx.strokeWidth * 0.3, ctx.opacity * 0.62);
    return [
      line(cx, cy - s, cx + s * 0.6, cy, st),
      line(cx + s * 0.6, cy, cx, cy + s, st),
      line(cx, cy + s, cx - s * 0.6, cy, st),
      line(cx - s * 0.6, cy, cx, cy - s, st),
      line(cx - s * 1.2, cy, cx + s * 1.2, cy, stroke(ctx.secondaryColor, ctx.strokeWidth * 0.2, ctx.opacity * 0.35)),
    ].join("");
  }},
  { slug: "laurel-minimal", name: "Laurel Minimal", complexity: 7, visualWeight: 0.5, qualityScore: 90, variants: ["default"], render: (ctx) => {
    const w = ctx.scale * 0.2;
    const s = stroke(ctx.color, ctx.strokeWidth * 0.26, ctx.opacity * 0.55);
    const parts: string[] = [];
    for (let i = -3; i <= 3; i++) {
      const t = i / 3;
      const x = ctx.cx + t * w;
      const y = ctx.cy + Math.cos(t * Math.PI) * w * 0.15;
      parts.push(path(`M ${x} ${y} q ${w * 0.04} ${-w * 0.06} ${w * 0.06} 0`, s));
    }
    return parts.join("");
  }},
  { slug: "frame-ornament", name: "Frame Ornament", complexity: 6, visualWeight: 0.44, qualityScore: 87, variants: ["default"], render: (ctx) => {
    const w = ctx.scale * 0.22;
    const h = w * 0.7;
    const x = ctx.cx - w / 2;
    const y = ctx.cy - h / 2;
    const s = stroke(ctx.color, ctx.strokeWidth * 0.28, ctx.opacity * 0.55);
    return [
      line(x, y, x + w, y, s),
      line(x, y + h, x + w, y + h, s),
      path(arcSeg(x, y + h / 2, h * 0.2, 90, 180), stroke(ctx.secondaryColor, ctx.strokeWidth * 0.22, ctx.opacity * 0.4)),
      path(arcSeg(x + w, y + h / 2, h * 0.2, 270, 360), stroke(ctx.secondaryColor, ctx.strokeWidth * 0.22, ctx.opacity * 0.4)),
    ].join("");
  }},
  { slug: "knot-line", name: "Knot Line Ornament", complexity: 7, visualWeight: 0.52, qualityScore: 91, variants: ["default", "mirror"], render: (ctx) => {
    const w = ctx.scale * 0.16;
    const s = stroke(ctx.color, ctx.strokeWidth * 0.28, ctx.opacity * 0.58);
    const { cx, cy } = ctx;
    return [
      path(`M ${cx - w} ${cy} C ${cx - w * 0.3} ${cy - w * 0.4} ${cx + w * 0.3} ${cy + w * 0.4} ${cx + w} ${cy}`, s),
      path(`M ${cx - w} ${cy} C ${cx - w * 0.3} ${cy + w * 0.4} ${cx + w * 0.3} ${cy - w * 0.4} ${cx + w} ${cy}`, stroke(ctx.secondaryColor, ctx.strokeWidth * 0.2, ctx.opacity * 0.38)),
    ].join("");
  }},
];

export const ORNAMENT_ASSETS: SvgAssetDefinition[] = SPECS.map((spec) =>
  createAsset("ornament", spec.slug, spec.name, { ...BASE, complexity: spec.complexity, visualWeight: spec.visualWeight, qualityScore: spec.qualityScore, variants: spec.variants }, spec.render),
);
