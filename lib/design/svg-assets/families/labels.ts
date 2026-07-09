import {
  capsuleOutline,
  createAsset,
  stroke,
  type AssetSeedConfig,
} from "@/lib/design/svg-assets/families/_shared";
import { line, rect } from "@/lib/design/vector-engine/xml";
import type { SvgAssetDefinition, SvgAssetRenderContext } from "@/lib/design/svg-assets/types";

const BASE: Omit<AssetSeedConfig, "complexity" | "visualWeight" | "qualityScore" | "variants"> = {
  styleTags: ["museum", "placard", "exhibition"],
  recommendedStyles: ["minimal-luxury", "monochrome-luxury", "editorial-fashion"],
  recommendedTemplates: ["museum-label", "gallery-poster", "silent-collection"],
  recommendedPlacements: ["center-chest", "corner", "sleeve"],
  printMethods: ["screen", "dtg", "embroidery"],
  renderMode: "stroke",
};

function placard(ctx: SvgAssetRenderContext, w: number, h: number, swMul: number): string {
  const x = ctx.cx - w / 2;
  const y = ctx.cy - h / 2;
  return rect(x, y, w, h, stroke(ctx.color, ctx.strokeWidth * swMul, ctx.opacity * 0.72));
}

const SPECS: Array<{ slug: string; name: string; complexity: number; visualWeight: number; qualityScore: number; variants: string[]; render: (ctx: SvgAssetRenderContext) => string }> = [
  { slug: "rect-placard", name: "Rect Placard", complexity: 3, visualWeight: 0.34, qualityScore: 83, variants: ["default"], render: (ctx) => placard(ctx, ctx.scale * 0.42, ctx.scale * 0.16, 0.34) },
  { slug: "caption-rail", name: "Caption Rail", complexity: 4, visualWeight: 0.36, qualityScore: 84, variants: ["default"], render: (ctx) => {
    const w = ctx.scale * 0.5;
    const h = ctx.scale * 0.1;
    return [
      placard(ctx, w, h, 0.32),
      line(ctx.cx - w * 0.38, ctx.cy, ctx.cx + w * 0.38, ctx.cy, stroke(ctx.secondaryColor, ctx.strokeWidth * 0.2, ctx.opacity * 0.4)),
    ].join("");
  }},
  { slug: "double-rail", name: "Double Rail Label", complexity: 5, visualWeight: 0.4, qualityScore: 86, variants: ["default"], render: (ctx) => {
    const w = ctx.scale * 0.48;
    const h = ctx.scale * 0.14;
    const gap = h * 0.22;
    return [
      placard(ctx, w, h, 0.32),
      line(ctx.cx - w * 0.4, ctx.cy - gap, ctx.cx + w * 0.4, ctx.cy - gap, stroke(ctx.secondaryColor, ctx.strokeWidth * 0.18, ctx.opacity * 0.38)),
      line(ctx.cx - w * 0.4, ctx.cy + gap, ctx.cx + w * 0.4, ctx.cy + gap, stroke(ctx.secondaryColor, ctx.strokeWidth * 0.18, ctx.opacity * 0.38)),
    ].join("");
  }},
  { slug: "index-tab", name: "Index Tab Label", complexity: 5, visualWeight: 0.38, qualityScore: 85, variants: ["default"], render: (ctx) => {
    const w = ctx.scale * 0.44;
    const h = ctx.scale * 0.12;
    const tab = ctx.scale * 0.04;
    return [
      placard(ctx, w, h, 0.3),
      line(ctx.cx - w / 2, ctx.cy - h / 2, ctx.cx - w / 2 + tab, ctx.cy - h / 2 - tab, stroke(ctx.accentColor, ctx.strokeWidth * 0.26, ctx.opacity * 0.5)),
      line(ctx.cx - w / 2 + tab, ctx.cy - h / 2 - tab, ctx.cx - w / 2 + tab * 2.2, ctx.cy - h / 2 - tab, stroke(ctx.accentColor, ctx.strokeWidth * 0.26, ctx.opacity * 0.5)),
    ].join("");
  }},
  { slug: "catalog-card", name: "Catalog Card", complexity: 5, visualWeight: 0.42, qualityScore: 87, variants: ["default"], render: (ctx) => {
    const w = ctx.scale * 0.46;
    const h = ctx.scale * 0.18;
    const x = ctx.cx - w / 2;
    const y = ctx.cy - h / 2;
    return [
      rect(x, y, w, h, stroke(ctx.color, ctx.strokeWidth * 0.3, ctx.opacity * 0.68)),
      line(x, y + h * 0.35, x + w, y + h * 0.35, stroke(ctx.secondaryColor, ctx.strokeWidth * 0.2, ctx.opacity * 0.4)),
      line(x + w * 0.65, y + h * 0.35, x + w * 0.65, y + h, stroke(ctx.secondaryColor, ctx.strokeWidth * 0.18, ctx.opacity * 0.35)),
    ].join("");
  }},
  { slug: "folio-mark", name: "Folio Mark", complexity: 4, visualWeight: 0.35, qualityScore: 84, variants: ["default"], render: (ctx) => {
    const w = ctx.scale * 0.38;
    const h = ctx.scale * 0.11;
    return [
      placard(ctx, w, h, 0.32),
      line(ctx.cx + w / 2, ctx.cy - h * 0.15, ctx.cx + w / 2 + ctx.scale * 0.04, ctx.cy, stroke(ctx.accentColor, ctx.strokeWidth * 0.24, ctx.opacity * 0.45)),
    ].join("");
  }},
  { slug: "archive-stamp", name: "Archive Stamp", complexity: 6, visualWeight: 0.44, qualityScore: 88, variants: ["default"], render: (ctx) => {
    const w = ctx.scale * 0.4;
    const h = ctx.scale * 0.14;
    return [
      rect(ctx.cx - w / 2, ctx.cy - h / 2, w, h, { ...stroke(ctx.color, ctx.strokeWidth * 0.28, ctx.opacity * 0.6), "stroke-dasharray": "3 2" }),
      line(ctx.cx - w * 0.3, ctx.cy, ctx.cx + w * 0.3, ctx.cy, stroke(ctx.secondaryColor, ctx.strokeWidth * 0.18, ctx.opacity * 0.38)),
    ].join("");
  }},
  { slug: "specimen-tag", name: "Specimen Tag", complexity: 5, visualWeight: 0.37, qualityScore: 85, variants: ["default", "tall"], render: (ctx) => capsuleOutline(ctx, ctx.scale * 0.36, ctx.scale * 0.2, 0.32) },
  { slug: "wall-label", name: "Wall Label", complexity: 4, visualWeight: 0.36, qualityScore: 84, variants: ["default"], render: (ctx) => {
    const w = ctx.scale * 0.52;
    const h = ctx.scale * 0.09;
    return [
      placard(ctx, w, h, 0.28),
      line(ctx.cx, ctx.cy + h / 2, ctx.cx, ctx.cy + h / 2 + ctx.scale * 0.05, stroke(ctx.accentColor, ctx.strokeWidth * 0.22, ctx.opacity * 0.42)),
    ].join("");
  }},
  { slug: "edition-plate", name: "Edition Plate", complexity: 6, visualWeight: 0.45, qualityScore: 89, variants: ["default"], render: (ctx) => {
    const w = ctx.scale * 0.5;
    const h = ctx.scale * 0.15;
    const inset = ctx.scale * 0.025;
    return [
      placard(ctx, w, h, 0.3),
      rect(ctx.cx - w / 2 + inset, ctx.cy - h / 2 + inset, w - inset * 2, h - inset * 2, stroke(ctx.secondaryColor, ctx.strokeWidth * 0.18, ctx.opacity * 0.35)),
      line(ctx.cx - w * 0.25, ctx.cy, ctx.cx + w * 0.25, ctx.cy, stroke(ctx.accentColor, ctx.strokeWidth * 0.16, ctx.opacity * 0.32)),
    ].join("");
  }},
];

export const LABEL_ASSETS: SvgAssetDefinition[] = SPECS.map((spec) =>
  createAsset("museum-label", spec.slug, spec.name, { ...BASE, complexity: spec.complexity, visualWeight: spec.visualWeight, qualityScore: spec.qualityScore, variants: spec.variants }, spec.render),
);
