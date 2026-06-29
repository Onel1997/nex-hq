import {
  cornerBracket,
  createAsset,
  stroke,
  type AssetSeedConfig,
} from "@/lib/design/svg-assets/families/_shared";
import { line, rect } from "@/lib/design/vector-engine/xml";
import type { SvgAssetDefinition, SvgAssetRenderContext } from "@/lib/design/svg-assets/types";

const BASE: Omit<AssetSeedConfig, "complexity" | "visualWeight" | "qualityScore" | "variants"> = {
  styleTags: ["architectural", "frame", "structure"],
  recommendedStyles: ["architectural", "editorial-fashion", "minimal-luxury"],
  recommendedTemplates: ["architectural-frame", "gallery-poster", "luxury-editorial"],
  recommendedPlacements: ["center-chest", "oversized-front", "oversized-back"],
  printMethods: ["screen", "dtg", "vinyl"],
  renderMode: "stroke",
};

function frameRect(ctx: SvgAssetRenderContext, inset: number, swMul: number, opMul: number): string {
  const sz = ctx.scale * (1 - inset);
  const x = ctx.cx - sz / 2;
  const y = ctx.cy - sz / 2;
  return rect(x, y, sz, sz * 0.72, stroke(ctx.color, ctx.strokeWidth * swMul, ctx.opacity * opMul));
}

function cornerFrame(ctx: SvgAssetRenderContext, arm: number, inset: number): string {
  const w = ctx.scale * (1 - inset);
  const h = w * 0.72;
  const x0 = ctx.cx - w / 2;
  const y0 = ctx.cy - h / 2;
  const x1 = x0 + w;
  const y1 = y0 + h;
  const c = ctx.color;
  const sw = ctx.strokeWidth * 0.42;
  const op = ctx.opacity;
  return [
    cornerBracket(x0, y0, arm, 1, 1, c, sw, op),
    cornerBracket(x1, y0, arm, -1, 1, c, sw, op),
    cornerBracket(x0, y1, arm, 1, -1, c, sw, op),
    cornerBracket(x1, y1, arm, -1, -1, c, sw, op),
  ].join("");
}

const SPECS: Array<{ slug: string; name: string; complexity: number; visualWeight: number; qualityScore: number; variants: string[]; render: (ctx: SvgAssetRenderContext) => string }> = [
  { slug: "full-rect", name: "Full Rect Frame", complexity: 3, visualWeight: 0.5, qualityScore: 84, variants: ["default"], render: (ctx) => frameRect(ctx, 0.08, 0.38, 0.75) },
  { slug: "corner-only", name: "Corner Only Frame", complexity: 4, visualWeight: 0.48, qualityScore: 86, variants: ["default", "tight"], render: (ctx) => cornerFrame(ctx, ctx.scale * 0.12, 0.1) },
  { slug: "double-inset", name: "Double Inset Frame", complexity: 5, visualWeight: 0.58, qualityScore: 88, variants: ["default"], render: (ctx) => [frameRect(ctx, 0.06, 0.35, 0.7), frameRect(ctx, 0.14, 0.28, 0.45)].join("") },
  { slug: "portal", name: "Portal Frame", complexity: 6, visualWeight: 0.65, qualityScore: 90, variants: ["default", "tall"], render: (ctx) => {
    const w = ctx.scale * 0.82;
    const h = w * 0.55;
    const x = ctx.cx - w / 2;
    const y = ctx.cy - h / 2;
    const s = stroke(ctx.color, ctx.strokeWidth * 0.4, ctx.opacity);
    return [
      rect(x, y, w, h, s),
      line(x + w * 0.15, y, x + w * 0.15, y + h, stroke(ctx.secondaryColor, ctx.strokeWidth * 0.25, ctx.opacity * 0.5)),
      line(x + w * 0.85, y, x + w * 0.85, y + h, stroke(ctx.secondaryColor, ctx.strokeWidth * 0.25, ctx.opacity * 0.5)),
    ].join("");
  }},
  { slug: "column-frame", name: "Column Frame", complexity: 6, visualWeight: 0.62, qualityScore: 89, variants: ["default"], render: (ctx) => {
    const w = ctx.scale * 0.78;
    const h = w * 0.68;
    const x = ctx.cx - w / 2;
    const y = ctx.cy - h / 2;
    const s = stroke(ctx.color, ctx.strokeWidth * 0.36, ctx.opacity);
    return [
      line(x, y, x, y + h, s),
      line(x + w, y, x + w, y + h, s),
      line(x, y, x + w, y, s),
      line(x, y + h, x + w, y + h, s),
      line(x + w * 0.33, y + h * 0.2, x + w * 0.33, y + h * 0.8, stroke(ctx.secondaryColor, ctx.strokeWidth * 0.22, ctx.opacity * 0.45)),
      line(x + w * 0.66, y + h * 0.2, x + w * 0.66, y + h * 0.8, stroke(ctx.secondaryColor, ctx.strokeWidth * 0.22, ctx.opacity * 0.45)),
    ].join("");
  }},
  { slug: "broken-border", name: "Broken Border Frame", complexity: 5, visualWeight: 0.56, qualityScore: 87, variants: ["default"], render: (ctx) => {
    const w = ctx.scale * 0.8;
    const h = w * 0.7;
    const x = ctx.cx - w / 2;
    const y = ctx.cy - h / 2;
    const s = stroke(ctx.color, ctx.strokeWidth * 0.38, ctx.opacity);
    return [
      line(x, y, x + w * 0.35, y, s),
      line(x + w * 0.65, y, x + w, y, s),
      line(x, y + h, x + w * 0.3, y + h, s),
      line(x + w * 0.7, y + h, x + w, y + h, s),
      line(x, y, x, y + h * 0.4, s),
      line(x, y + h * 0.6, x, y + h, s),
      line(x + w, y, x + w, y + h * 0.35, s),
      line(x + w, y + h * 0.65, x + w, y + h, s),
    ].join("");
  }},
  { slug: "lintel", name: "Lintel Frame", complexity: 5, visualWeight: 0.54, qualityScore: 86, variants: ["default"], render: (ctx) => {
    const w = ctx.scale * 0.84;
    const x = ctx.cx - w / 2;
    const y = ctx.cy - ctx.scale * 0.28;
    const h = ctx.scale * 0.56;
    const s = stroke(ctx.color, ctx.strokeWidth * 0.4, ctx.opacity);
    return [
      line(x, y, x + w, y, s),
      line(x + w * 0.08, y, x + w * 0.08, y + h, stroke(ctx.secondaryColor, ctx.strokeWidth * 0.3, ctx.opacity * 0.55)),
      line(x + w * 0.92, y, x + w * 0.92, y + h, stroke(ctx.secondaryColor, ctx.strokeWidth * 0.3, ctx.opacity * 0.55)),
      line(x + w * 0.08, y + h, x + w * 0.92, y + h, stroke(ctx.secondaryColor, ctx.strokeWidth * 0.28, ctx.opacity * 0.5)),
    ].join("");
  }},
  { slug: "step-frame", name: "Step Frame", complexity: 7, visualWeight: 0.68, qualityScore: 91, variants: ["default", "deep"], render: (ctx) => {
    const s = ctx.scale * 0.38;
    const c = ctx.color;
    const sw = ctx.strokeWidth * 0.35;
    const op = ctx.opacity;
    const { cx, cy } = ctx;
    return [
      line(cx - s, cy - s * 0.7, cx + s, cy - s * 0.7, stroke(c, sw, op)),
      line(cx - s, cy + s * 0.7, cx + s, cy + s * 0.7, stroke(c, sw, op)),
      line(cx - s, cy - s * 0.7, cx - s, cy - s * 0.35, stroke(c, sw, op)),
      line(cx - s, cy + s * 0.35, cx - s, cy + s * 0.7, stroke(c, sw, op)),
      line(cx + s, cy - s * 0.7, cx + s, cy - s * 0.35, stroke(c, sw, op)),
      line(cx + s, cy + s * 0.35, cx + s, cy + s * 0.7, stroke(c, sw, op)),
      line(cx - s * 0.55, cy - s * 0.35, cx + s * 0.55, cy - s * 0.35, stroke(ctx.secondaryColor, sw * 0.7, op * 0.5)),
      line(cx - s * 0.55, cy + s * 0.35, cx + s * 0.55, cy + s * 0.35, stroke(ctx.secondaryColor, sw * 0.7, op * 0.5)),
    ].join("");
  }},
  { slug: "architectural-t", name: "Architectural T Frame", complexity: 6, visualWeight: 0.6, qualityScore: 88, variants: ["default"], render: (ctx) => {
    const w = ctx.scale * 0.75;
    const x = ctx.cx;
    const y = ctx.cy;
    const s = stroke(ctx.color, ctx.strokeWidth * 0.38, ctx.opacity);
    return [
      line(x - w / 2, y - ctx.scale * 0.3, x + w / 2, y - ctx.scale * 0.3, s),
      line(x, y - ctx.scale * 0.3, x, y + ctx.scale * 0.32, s),
      line(x - w * 0.2, y + ctx.scale * 0.32, x + w * 0.2, y + ctx.scale * 0.32, stroke(ctx.secondaryColor, ctx.strokeWidth * 0.3, ctx.opacity * 0.55)),
    ].join("");
  }},
  { slug: "gallery-mat", name: "Gallery Mat Frame", complexity: 5, visualWeight: 0.52, qualityScore: 87, variants: ["default", "wide"], render: (ctx) => {
    const outer = ctx.scale * 0.86;
    const inner = outer * 0.72;
    return [
      rect(ctx.cx - outer / 2, ctx.cy - outer * 0.36, outer, outer * 0.72, stroke(ctx.color, ctx.strokeWidth * 0.32, ctx.opacity * 0.65)),
      rect(ctx.cx - inner / 2, ctx.cy - inner * 0.36, inner, inner * 0.72, stroke(ctx.secondaryColor, ctx.strokeWidth * 0.24, ctx.opacity * 0.45)),
    ].join("");
  }},
];

export const FRAME_ASSETS: SvgAssetDefinition[] = SPECS.map((spec) =>
  createAsset("frame", spec.slug, spec.name, { ...BASE, complexity: spec.complexity, visualWeight: spec.visualWeight, qualityScore: spec.qualityScore, variants: spec.variants }, spec.render),
);
