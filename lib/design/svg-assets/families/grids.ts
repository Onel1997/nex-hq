import { createAsset, localGrid, stroke, type AssetSeedConfig } from "@/lib/design/svg-assets/families/_shared";
import { circle, line } from "@/lib/design/vector-engine/xml";
import type { SvgAssetDefinition, SvgAssetRenderContext } from "@/lib/design/svg-assets/types";

const BASE: Omit<AssetSeedConfig, "complexity" | "visualWeight" | "qualityScore" | "variants"> = {
  styleTags: ["grid", "matrix", "structure"],
  recommendedStyles: ["swiss-typography", "architectural", "technical-streetwear"],
  recommendedTemplates: ["technical-luxury", "architectural-frame", "gallery-poster"],
  recommendedPlacements: ["oversized-front", "center-chest", "oversized-back"],
  printMethods: ["screen", "dtg"],
  renderMode: "stroke",
};

const SPECS: Array<{ slug: string; name: string; complexity: number; visualWeight: number; qualityScore: number; variants: string[]; render: (ctx: SvgAssetRenderContext) => string }> = [
  { slug: "quad", name: "Quad Grid", complexity: 3, visualWeight: 0.35, qualityScore: 83, variants: ["default"], render: (ctx) => localGrid(ctx, 4, 3, 0.55) },
  { slug: "fine-mesh", name: "Fine Mesh Grid", complexity: 4, visualWeight: 0.32, qualityScore: 84, variants: ["default", "dense"], render: (ctx) => localGrid(ctx, 6, 5, 0.58, 0.28) },
  { slug: "baseline", name: "Baseline Grid", complexity: 4, visualWeight: 0.38, qualityScore: 85, variants: ["default"], render: (ctx) => {
    const w = ctx.scale * 0.55;
    const h = ctx.scale * 0.38;
    const x0 = ctx.cx - w / 2;
    const y0 = ctx.cy - h / 2;
    const s = stroke(ctx.secondaryColor, ctx.strokeWidth * 0.22, ctx.opacity * 0.4);
    const parts: string[] = [];
    for (let i = 0; i <= 5; i++) {
      const y = y0 + (h / 5) * i;
      parts.push(line(x0, y, x0 + w, y, s));
    }
    parts.push(line(x0, y0, x0, y0 + h, stroke(ctx.color, ctx.strokeWidth * 0.28, ctx.opacity * 0.5)));
    return parts.join("");
  }},
  { slug: "column-grid", name: "Column Grid", complexity: 5, visualWeight: 0.4, qualityScore: 86, variants: ["default"], render: (ctx) => {
    const w = ctx.scale * 0.52;
    const h = ctx.scale * 0.42;
    const x0 = ctx.cx - w / 2;
    const y0 = ctx.cy - h / 2;
    const s = stroke(ctx.color, ctx.strokeWidth * 0.26, ctx.opacity * 0.45);
    const parts: string[] = [line(x0, y0, x0, y0 + h, s), line(x0 + w, y0, x0 + w, y0 + h, s)];
    for (let c = 1; c < 4; c++) {
      const x = x0 + (w / 4) * c;
      parts.push(line(x, y0, x, y0 + h, stroke(ctx.secondaryColor, ctx.strokeWidth * 0.2, ctx.opacity * 0.35)));
    }
    return parts.join("");
  }},
  { slug: "dot-matrix", name: "Dot Matrix Grid", complexity: 5, visualWeight: 0.36, qualityScore: 85, variants: ["default"], render: (ctx) => {
    const spread = ctx.scale * 0.22;
    const parts: string[] = [];
    for (let row = -2; row <= 2; row++) {
      for (let col = -2; col <= 2; col++) {
        parts.push(circle(ctx.cx + col * spread * 0.35, ctx.cy + row * spread * 0.35, ctx.strokeWidth * 0.28, { fill: ctx.secondaryColor, opacity: ctx.opacity * (row === 0 && col === 0 ? 0.55 : 0.28) }));
      }
    }
    return parts.join("");
  }},
  { slug: "modular", name: "Modular Grid", complexity: 6, visualWeight: 0.44, qualityScore: 87, variants: ["default"], render: (ctx) => {
    const inner = localGrid(ctx, 3, 2, 0.38, 0.45);
    const outer = localGrid(ctx, 5, 4, 0.58, 0.25);
    return inner + outer;
  }},
  { slug: "cross-grid", name: "Cross Grid", complexity: 5, visualWeight: 0.42, qualityScore: 86, variants: ["default"], render: (ctx) => {
    const w = ctx.scale * 0.5;
    const s = stroke(ctx.color, ctx.strokeWidth * 0.28, ctx.opacity * 0.48);
    return [
      line(ctx.cx - w / 2, ctx.cy, ctx.cx + w / 2, ctx.cy, s),
      line(ctx.cx, ctx.cy - w * 0.35, ctx.cx, ctx.cy + w * 0.35, s),
      localGrid(ctx, 4, 4, 0.5, 0.22),
    ].join("");
  }},
  { slug: "iso-grid", name: "Iso Grid", complexity: 6, visualWeight: 0.46, qualityScore: 88, variants: ["default"], render: (ctx) => {
    const step = ctx.scale * 0.08;
    const s = stroke(ctx.secondaryColor, ctx.strokeWidth * 0.22, ctx.opacity * 0.38);
    const parts: string[] = [];
    for (let i = -3; i <= 3; i++) {
      parts.push(line(ctx.cx + i * step, ctx.cy - step * 2, ctx.cx + i * step + step * 2, ctx.cy + step * 2, s));
      parts.push(line(ctx.cx - i * step, ctx.cy - step * 2, ctx.cx - i * step - step * 2, ctx.cy + step * 2, s));
    }
    return parts.join("");
  }},
  { slug: "registration-grid", name: "Registration Grid", complexity: 5, visualWeight: 0.4, qualityScore: 86, variants: ["default"], render: (ctx) => {
    const w = ctx.scale * 0.48;
    const parts = [localGrid(ctx, 3, 3, 0.45, 0.35)];
    const s = stroke(ctx.accentColor, ctx.strokeWidth * 0.24, ctx.opacity * 0.45);
    parts.push(
      line(ctx.cx - w / 2, ctx.cy, ctx.cx + w / 2, ctx.cy, s),
      line(ctx.cx, ctx.cy - w * 0.35, ctx.cx, ctx.cy + w * 0.35, s),
      circle(ctx.cx, ctx.cy, ctx.strokeWidth * 0.35, { fill: ctx.accentColor, opacity: ctx.opacity * 0.4 }),
    );
    return parts.join("");
  }},
  { slug: "sparse-field", name: "Sparse Field Grid", complexity: 4, visualWeight: 0.34, qualityScore: 84, variants: ["default", "sparse"], render: (ctx) => localGrid(ctx, 5, 4, 0.6, 0.2) },
];

export const GRID_ASSETS: SvgAssetDefinition[] = SPECS.map((spec) =>
  createAsset("grid", spec.slug, spec.name, { ...BASE, complexity: spec.complexity, visualWeight: spec.visualWeight, qualityScore: spec.qualityScore, variants: spec.variants }, spec.render),
);
