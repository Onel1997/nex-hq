import {
  cornerBracket,
  createAsset,
  stroke,
  type AssetSeedConfig,
} from "@/lib/design/svg-assets/families/_shared";
import { circle, line } from "@/lib/design/vector-engine/xml";
import type { SvgAssetDefinition, SvgAssetRenderContext } from "@/lib/design/svg-assets/types";

const GALLERY_BASE: Omit<AssetSeedConfig, "complexity" | "visualWeight" | "qualityScore" | "variants"> = {
  styleTags: ["gallery", "registration", "exhibition"],
  recommendedStyles: ["editorial-fashion", "minimal-luxury", "monochrome-luxury"],
  recommendedTemplates: ["gallery-poster", "museum-label", "luxury-editorial"],
  recommendedPlacements: ["center-chest", "corner"],
  printMethods: ["screen", "dtg"],
  renderMode: "stroke",
};

const DIRECTIONAL_BASE: Omit<AssetSeedConfig, "complexity" | "visualWeight" | "qualityScore" | "variants"> = {
  styleTags: ["directional", "technical", "navigation"],
  recommendedStyles: ["technical-streetwear", "architectural", "swiss-typography"],
  recommendedTemplates: ["technical-luxury", "architectural-frame", "fashion-campaign"],
  recommendedPlacements: ["sleeve", "dual-print", "corner"],
  printMethods: ["screen", "vinyl", "embroidery"],
  renderMode: "mixed",
};

const GALLERY_SPECS: Array<{ slug: string; name: string; complexity: number; visualWeight: number; qualityScore: number; variants: string[]; render: (ctx: SvgAssetRenderContext) => string }> = [
  { slug: "corner-l", name: "Corner L Marker", complexity: 3, visualWeight: 0.32, qualityScore: 83, variants: ["default"], render: (ctx) => cornerBracket(ctx.cx, ctx.cy, ctx.scale * 0.14, 1, 1, ctx.color, ctx.strokeWidth * 0.42, ctx.opacity) },
  { slug: "crosshair", name: "Crosshair Marker", complexity: 4, visualWeight: 0.34, qualityScore: 84, variants: ["default"], render: (ctx) => {
    const arm = ctx.scale * 0.1;
    const s = stroke(ctx.color, ctx.strokeWidth * 0.35, ctx.opacity * 0.7);
    return [
      line(ctx.cx - arm, ctx.cy, ctx.cx + arm, ctx.cy, s),
      line(ctx.cx, ctx.cy - arm, ctx.cx, ctx.cy + arm, s),
      circle(ctx.cx, ctx.cy, ctx.strokeWidth * 0.35, { fill: ctx.accentColor, opacity: ctx.opacity * 0.5 }),
    ].join("");
  }},
  { slug: "registration", name: "Registration Marker", complexity: 4, visualWeight: 0.36, qualityScore: 85, variants: ["default"], render: (ctx) => {
    const r = ctx.scale * 0.08;
    return [
      circle(ctx.cx, ctx.cy, r, stroke(ctx.color, ctx.strokeWidth * 0.38, ctx.opacity * 0.65)),
      circle(ctx.cx, ctx.cy, r * 0.35, { fill: ctx.accentColor, opacity: ctx.opacity * 0.55 }),
    ].join("");
  }},
  { slug: "plumb-tick", name: "Plumb Tick Marker", complexity: 3, visualWeight: 0.3, qualityScore: 82, variants: ["default"], render: (ctx) => {
    const h = ctx.scale * 0.16;
    const s = stroke(ctx.color, ctx.strokeWidth * 0.34, ctx.opacity * 0.65);
    return [line(ctx.cx, ctx.cy - h / 2, ctx.cx, ctx.cy + h / 2, s), line(ctx.cx - ctx.scale * 0.04, ctx.cy + h / 2, ctx.cx + ctx.scale * 0.04, ctx.cy + h / 2, s)].join("");
  }},
  { slug: "frame-tick", name: "Frame Tick Marker", complexity: 4, visualWeight: 0.33, qualityScore: 84, variants: ["default"], render: (ctx) => {
    const arm = ctx.scale * 0.11;
    const c = ctx.color;
    const sw = ctx.strokeWidth * 0.36;
    const op = ctx.opacity * 0.68;
    return [
      cornerBracket(ctx.cx - arm, ctx.cy - arm, arm * 0.6, 1, 1, c, sw, op),
      cornerBracket(ctx.cx + arm, ctx.cy + arm, arm * 0.6, -1, -1, c, sw, op),
    ].join("");
  }},
  { slug: "dot-grid", name: "Dot Grid Marker", complexity: 5, visualWeight: 0.38, qualityScore: 86, variants: ["default"], render: (ctx) => {
    const parts: string[] = [];
    const spread = ctx.scale * 0.08;
    for (const [dx, dy] of [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
      parts.push(circle(ctx.cx + spread * dx, ctx.cy + spread * dy, ctx.strokeWidth * 0.32, { fill: ctx.secondaryColor, opacity: ctx.opacity * (dx === 0 && dy === 0 ? 0.7 : 0.4) }));
    }
    return parts.join("");
  }},
  { slug: "sight-line", name: "Sight Line Marker", complexity: 4, visualWeight: 0.35, qualityScore: 85, variants: ["default"], render: (ctx) => {
    const w = ctx.scale * 0.2;
    const s = stroke(ctx.color, ctx.strokeWidth * 0.3, ctx.opacity * 0.6);
    return [
      line(ctx.cx - w, ctx.cy, ctx.cx - ctx.scale * 0.03, ctx.cy, s),
      line(ctx.cx + ctx.scale * 0.03, ctx.cy, ctx.cx + w, ctx.cy, s),
      line(ctx.cx, ctx.cy - w * 0.5, ctx.cx, ctx.cy + w * 0.5, stroke(ctx.secondaryColor, ctx.strokeWidth * 0.24, ctx.opacity * 0.45)),
    ].join("");
  }},
  { slug: "anchor-plus", name: "Anchor Plus Marker", complexity: 4, visualWeight: 0.37, qualityScore: 85, variants: ["default"], render: (ctx) => {
    const arm = ctx.scale * 0.09;
    const s = stroke(ctx.accentColor, ctx.strokeWidth * 0.32, ctx.opacity * 0.65);
    return [
      line(ctx.cx - arm, ctx.cy, ctx.cx + arm, ctx.cy, s),
      line(ctx.cx, ctx.cy - arm, ctx.cx, ctx.cy + arm, s),
      circle(ctx.cx, ctx.cy, arm * 0.55, stroke(ctx.color, ctx.strokeWidth * 0.28, ctx.opacity * 0.5)),
    ].join("");
  }},
  { slug: "exhibit-notch", name: "Exhibit Notch Marker", complexity: 5, visualWeight: 0.4, qualityScore: 87, variants: ["default"], render: (ctx) => {
    const w = ctx.scale * 0.14;
    const s = stroke(ctx.color, ctx.strokeWidth * 0.34, ctx.opacity * 0.68);
    return [
      line(ctx.cx - w, ctx.cy, ctx.cx, ctx.cy - w * 0.4, s),
      line(ctx.cx, ctx.cy - w * 0.4, ctx.cx + w, ctx.cy, s),
      line(ctx.cx, ctx.cy, ctx.cx, ctx.cy + w * 0.5, stroke(ctx.secondaryColor, ctx.strokeWidth * 0.26, ctx.opacity * 0.5)),
    ].join("");
  }},
  { slug: "mat-corner", name: "Mat Corner Marker", complexity: 4, visualWeight: 0.34, qualityScore: 84, variants: ["default", "mirror"], render: (ctx) => {
    const arm = ctx.scale * 0.12;
    return [
      cornerBracket(ctx.cx, ctx.cy, arm, 1, 1, ctx.color, ctx.strokeWidth * 0.38, ctx.opacity * 0.7),
      line(ctx.cx + arm * 0.3, ctx.cy + arm * 0.3, ctx.cx + arm * 0.7, ctx.cy + arm * 0.3, stroke(ctx.secondaryColor, ctx.strokeWidth * 0.24, ctx.opacity * 0.45)),
    ].join("");
  }},
];

const DIRECTIONAL_SPECS: Array<{ slug: string; name: string; complexity: number; visualWeight: number; qualityScore: number; variants: string[]; render: (ctx: SvgAssetRenderContext) => string }> = [
  { slug: "arrow-east", name: "East Arrow", complexity: 3, visualWeight: 0.38, qualityScore: 84, variants: ["default"], render: (ctx) => {
    const len = ctx.scale * 0.22;
    const head = ctx.scale * 0.06;
    const s = stroke(ctx.color, ctx.strokeWidth * 0.38, ctx.opacity);
    return [
      line(ctx.cx - len / 2, ctx.cy, ctx.cx + len / 2 - head, ctx.cy, s),
      line(ctx.cx + len / 2 - head, ctx.cy - head, ctx.cx + len / 2, ctx.cy, s),
      line(ctx.cx + len / 2 - head, ctx.cy + head, ctx.cx + len / 2, ctx.cy, s),
    ].join("");
  }},
  { slug: "chevron-up", name: "Chevron Up", complexity: 3, visualWeight: 0.36, qualityScore: 83, variants: ["default"], render: (ctx) => {
    const w = ctx.scale * 0.1;
    const h = ctx.scale * 0.08;
    const s = stroke(ctx.accentColor, ctx.strokeWidth * 0.36, ctx.opacity);
    return line(ctx.cx - w, ctx.cy + h / 2, ctx.cx, ctx.cy - h / 2, s) + line(ctx.cx, ctx.cy - h / 2, ctx.cx + w, ctx.cy + h / 2, s);
  }},
  { slug: "north-tick", name: "North Tick", complexity: 4, visualWeight: 0.4, qualityScore: 85, variants: ["default"], render: (ctx) => {
    const h = ctx.scale * 0.18;
    const s = stroke(ctx.color, ctx.strokeWidth * 0.35, ctx.opacity * 0.75);
    return [
      line(ctx.cx, ctx.cy + h / 2, ctx.cx, ctx.cy - h / 2, s),
      line(ctx.cx - ctx.scale * 0.04, ctx.cy - h / 2 + ctx.scale * 0.05, ctx.cx, ctx.cy - h / 2, s),
      line(ctx.cx + ctx.scale * 0.04, ctx.cy - h / 2 + ctx.scale * 0.05, ctx.cx, ctx.cy - h / 2, s),
    ].join("");
  }},
  { slug: "diagonal-slash", name: "Diagonal Slash", complexity: 3, visualWeight: 0.34, qualityScore: 82, variants: ["default", "mirror"], render: (ctx) => {
    const d = ctx.scale * 0.14;
    return line(ctx.cx - d, ctx.cy + d, ctx.cx + d, ctx.cy - d, stroke(ctx.color, ctx.strokeWidth * 0.38, ctx.opacity * 0.7));
  }},
  { slug: "pointer-dot", name: "Pointer Dot", complexity: 4, visualWeight: 0.42, qualityScore: 86, variants: ["default"], render: (ctx) => {
    const len = ctx.scale * 0.16;
    const s = stroke(ctx.color, ctx.strokeWidth * 0.34, ctx.opacity * 0.65);
    return [
      line(ctx.cx - len, ctx.cy, ctx.cx, ctx.cy, s),
      circle(ctx.cx + ctx.scale * 0.02, ctx.cy, ctx.strokeWidth * 0.45, { fill: ctx.accentColor, opacity: ctx.opacity * 0.7 }),
    ].join("");
  }},
  { slug: "axis-bracket", name: "Axis Bracket", complexity: 5, visualWeight: 0.44, qualityScore: 87, variants: ["default"], render: (ctx) => {
    const w = ctx.scale * 0.12;
    const s = stroke(ctx.color, ctx.strokeWidth * 0.32, ctx.opacity * 0.65);
    return [
      line(ctx.cx - w, ctx.cy, ctx.cx + w, ctx.cy, s),
      line(ctx.cx - w, ctx.cy - w * 0.4, ctx.cx - w, ctx.cy + w * 0.4, s),
      line(ctx.cx + w, ctx.cy - w * 0.4, ctx.cx + w, ctx.cy + w * 0.4, s),
    ].join("");
  }},
  { slug: "flow-curve", name: "Flow Curve", complexity: 5, visualWeight: 0.46, qualityScore: 88, variants: ["default"], render: (ctx) => {
    const w = ctx.scale * 0.18;
    const { cx, cy } = ctx;
    const s = stroke(ctx.secondaryColor, ctx.strokeWidth * 0.3, ctx.opacity * 0.6);
    return [
      line(cx - w, cy, cx - w * 0.2, cy, s),
      line(cx - w * 0.2, cy, cx, cy - w * 0.35, s),
      line(cx, cy - w * 0.35, cx + w * 0.5, cy - w * 0.35, s),
    ].join("");
  }},
  { slug: "bearing-tri", name: "Bearing Triangle", complexity: 4, visualWeight: 0.4, qualityScore: 85, variants: ["default"], render: (ctx) => {
    const h = ctx.scale * 0.12;
    const w = h * 0.8;
    const { cx, cy } = ctx;
    const s = stroke(ctx.accentColor, ctx.strokeWidth * 0.34, ctx.opacity * 0.7);
    return [
      line(cx, cy - h / 2, cx - w / 2, cy + h / 2, s),
      line(cx - w / 2, cy + h / 2, cx + w / 2, cy + h / 2, s),
      line(cx + w / 2, cy + h / 2, cx, cy - h / 2, s),
    ].join("");
  }},
  { slug: "lane-mark", name: "Lane Mark", complexity: 4, visualWeight: 0.38, qualityScore: 84, variants: ["default"], render: (ctx) => {
    const len = ctx.scale * 0.2;
    const s = stroke(ctx.color, ctx.strokeWidth * 0.36, ctx.opacity * 0.68);
    return [
      line(ctx.cx - len / 2, ctx.cy - ctx.scale * 0.03, ctx.cx + len / 2, ctx.cy - ctx.scale * 0.03, s),
      line(ctx.cx - len / 2, ctx.cy + ctx.scale * 0.03, ctx.cx + len / 2, ctx.cy + ctx.scale * 0.03, stroke(ctx.secondaryColor, ctx.strokeWidth * 0.26, ctx.opacity * 0.5)),
    ].join("");
  }},
  { slug: "vector-notch", name: "Vector Notch", complexity: 5, visualWeight: 0.43, qualityScore: 86, variants: ["default", "bold"], render: (ctx) => {
    const len = ctx.scale * 0.18;
    const notch = ctx.scale * 0.05;
    const s = stroke(ctx.color, ctx.strokeWidth * 0.38, ctx.opacity);
    return [
      line(ctx.cx - len / 2, ctx.cy, ctx.cx + len / 2, ctx.cy, s),
      line(ctx.cx + len / 2 - notch, ctx.cy - notch, ctx.cx + len / 2, ctx.cy, s),
      line(ctx.cx + len / 2 - notch, ctx.cy + notch, ctx.cx + len / 2, ctx.cy, s),
      line(ctx.cx - len / 2, ctx.cy - notch * 0.6, ctx.cx - len / 2, ctx.cy + notch * 0.6, stroke(ctx.secondaryColor, ctx.strokeWidth * 0.28, ctx.opacity * 0.5)),
    ].join("");
  }},
];

export const GALLERY_MARKER_ASSETS: SvgAssetDefinition[] = GALLERY_SPECS.map((spec) =>
  createAsset("gallery-marker", spec.slug, spec.name, { ...GALLERY_BASE, complexity: spec.complexity, visualWeight: spec.visualWeight, qualityScore: spec.qualityScore, variants: spec.variants }, spec.render),
);

export const DIRECTIONAL_MARKER_ASSETS: SvgAssetDefinition[] = DIRECTIONAL_SPECS.map((spec) =>
  createAsset("directional-marker", spec.slug, spec.name, { ...DIRECTIONAL_BASE, complexity: spec.complexity, visualWeight: spec.visualWeight, qualityScore: spec.qualityScore, variants: spec.variants }, spec.render),
);

export const MARKER_ASSETS: SvgAssetDefinition[] = [...GALLERY_MARKER_ASSETS, ...DIRECTIONAL_MARKER_ASSETS];
