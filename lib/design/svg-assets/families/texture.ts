import { createAsset, stroke, type AssetSeedConfig } from "@/lib/design/svg-assets/families/_shared";
import { circle, line, rect } from "@/lib/design/vector-engine/xml";
import { range } from "@/lib/design/vector-engine/hash";
import type { SvgAssetDefinition, SvgAssetRenderContext } from "@/lib/design/svg-assets/types";

const BASE: Omit<AssetSeedConfig, "complexity" | "visualWeight" | "qualityScore" | "variants"> = {
  styleTags: ["texture", "noise", "grain"],
  recommendedStyles: ["vintage-washed", "editorial-fashion", "technical-streetwear"],
  recommendedTemplates: ["oversized-graphic", "fashion-campaign", "luxury-editorial"],
  recommendedPlacements: ["oversized-front", "oversized-back"],
  printMethods: ["screen", "dtg"],
  renderMode: "pattern",
};

function scatterDots(ctx: SvgAssetRenderContext, count: number, spread: number, opBase: number): string {
  const parts: string[] = [];
  const seed = ctx.variant.charCodeAt(0) + count;
  for (let i = 0; i < count; i++) {
    const x = ctx.cx + range(seed, i * 7, -spread, spread);
    const y = ctx.cy + range(seed, i * 7 + 1, -spread * 0.7, spread * 0.7);
    const r = ctx.strokeWidth * range(seed, i * 7 + 2, 0.15, 0.38);
    parts.push(circle(x, y, r, { fill: ctx.secondaryColor, opacity: opBase + range(seed, i, 0, 0.2) }));
  }
  return parts.join("");
}

function hatchField(ctx: SvgAssetRenderContext, angle: number, spacing: number, count: number): string {
  const parts: string[] = [];
  const rad = (angle * Math.PI) / 180;
  const len = ctx.scale * 0.28;
  const s = stroke(ctx.secondaryColor, ctx.strokeWidth * 0.18, ctx.opacity * 0.28);
  for (let i = -count; i <= count; i++) {
    const off = i * spacing;
    const x1 = ctx.cx + Math.cos(rad) * off - Math.sin(rad) * len;
    const y1 = ctx.cy + Math.sin(rad) * off + Math.cos(rad) * len;
    const x2 = ctx.cx + Math.cos(rad) * off + Math.sin(rad) * len;
    const y2 = ctx.cy + Math.sin(rad) * off - Math.cos(rad) * len;
    parts.push(line(x1, y1, x2, y2, s));
  }
  return parts.join("");
}

const SPECS: Array<{ slug: string; name: string; complexity: number; visualWeight: number; qualityScore: number; variants: string[]; render: (ctx: SvgAssetRenderContext) => string }> = [
  { slug: "fine-grain", name: "Fine Grain", complexity: 4, visualWeight: 0.28, qualityScore: 84, variants: ["default", "light"], render: (ctx) => scatterDots(ctx, 24, ctx.scale * 0.22, 0.18) },
  { slug: "speckle", name: "Speckle Texture", complexity: 5, visualWeight: 0.3, qualityScore: 85, variants: ["default", "dense"], render: (ctx) => scatterDots(ctx, 36, ctx.scale * 0.26, 0.22) },
  { slug: "diagonal-hatch", name: "Diagonal Hatch", complexity: 4, visualWeight: 0.32, qualityScore: 84, variants: ["default"], render: (ctx) => hatchField(ctx, 45, ctx.scale * 0.04, 5) },
  { slug: "cross-hatch", name: "Cross Hatch", complexity: 5, visualWeight: 0.34, qualityScore: 86, variants: ["default"], render: (ctx) => hatchField(ctx, 45, ctx.scale * 0.05, 4) + hatchField(ctx, -45, ctx.scale * 0.05, 4) },
  { slug: "stipple-band", name: "Stipple Band", complexity: 5, visualWeight: 0.3, qualityScore: 85, variants: ["default"], render: (ctx) => {
    const w = ctx.scale * 0.5;
    const h = ctx.scale * 0.12;
    const x = ctx.cx - w / 2;
    const y = ctx.cy - h / 2;
    return [
      rect(x, y, w, h, stroke(ctx.color, ctx.strokeWidth * 0.22, ctx.opacity * 0.35)),
      scatterDots({ ...ctx, cy: ctx.cy, scale: ctx.scale * 0.4 }, 18, w * 0.4, 0.2),
    ].join("");
  }},
  { slug: "halftone-field", name: "Halftone Field", complexity: 6, visualWeight: 0.36, qualityScore: 87, variants: ["default"], render: (ctx) => {
    const parts: string[] = [];
    for (let row = -2; row <= 2; row++) {
      for (let col = -3; col <= 3; col++) {
        const dist = Math.sqrt(row * row + col * col);
        const r = ctx.strokeWidth * (0.2 + dist * 0.06);
        parts.push(circle(ctx.cx + col * ctx.scale * 0.06, ctx.cy + row * ctx.scale * 0.06, r, { fill: ctx.secondaryColor, opacity: ctx.opacity * (0.15 + dist * 0.04) }));
      }
    }
    return parts.join("");
  }},
  { slug: "noise-lines", name: "Noise Lines", complexity: 5, visualWeight: 0.32, qualityScore: 85, variants: ["default"], render: (ctx) => {
    const parts: string[] = [];
    const seed = 42;
    for (let i = 0; i < 14; i++) {
      const x1 = ctx.cx + range(seed, i, -ctx.scale * 0.24, ctx.scale * 0.24);
      const y1 = ctx.cy + range(seed, i + 20, -ctx.scale * 0.16, ctx.scale * 0.16);
      const x2 = x1 + range(seed, i + 40, -ctx.scale * 0.04, ctx.scale * 0.04);
      const y2 = y1 + range(seed, i + 60, -ctx.scale * 0.03, ctx.scale * 0.03);
      parts.push(line(x1, y1, x2, y2, stroke(ctx.secondaryColor, ctx.strokeWidth * 0.16, ctx.opacity * 0.25)));
    }
    return parts.join("");
  }},
  { slug: "distress-edge", name: "Distress Edge", complexity: 6, visualWeight: 0.38, qualityScore: 88, variants: ["default"], render: (ctx) => {
    const w = ctx.scale * 0.48;
    const parts: string[] = [];
    const s = stroke(ctx.color, ctx.strokeWidth * 0.24, ctx.opacity * 0.4);
    for (let i = 0; i < 8; i++) {
      const t = i / 7;
      const x = ctx.cx - w / 2 + w * t;
      const jag = range(17, i, -ctx.scale * 0.02, ctx.scale * 0.02);
      parts.push(line(x, ctx.cy - ctx.scale * 0.08 + jag, x + ctx.scale * 0.02, ctx.cy - ctx.scale * 0.08, s));
    }
    return parts.join("") + scatterDots(ctx, 12, ctx.scale * 0.2, 0.15);
  }},
  { slug: "woven-grid", name: "Woven Grid Texture", complexity: 6, visualWeight: 0.35, qualityScore: 87, variants: ["default"], render: (ctx) => hatchField(ctx, 0, ctx.scale * 0.035, 6) + hatchField(ctx, 90, ctx.scale * 0.035, 4) },
  { slug: "fade-dots", name: "Fade Dot Texture", complexity: 5, visualWeight: 0.33, qualityScore: 86, variants: ["default", "radial"], render: (ctx) => {
    const parts: string[] = [];
    for (let ring = 1; ring <= 4; ring++) {
      const r = ctx.scale * 0.05 * ring;
      const dots = ring * 6;
      for (let i = 0; i < dots; i++) {
        const angle = (Math.PI * 2 * i) / dots;
        parts.push(circle(ctx.cx + Math.cos(angle) * r, ctx.cy + Math.sin(angle) * r, ctx.strokeWidth * 0.2, { fill: ctx.secondaryColor, opacity: ctx.opacity * (0.35 - ring * 0.06) }));
      }
    }
    return parts.join("");
  }},
];

export const TEXTURE_ASSETS: SvgAssetDefinition[] = SPECS.map((spec) =>
  createAsset("texture", spec.slug, spec.name, { ...BASE, complexity: spec.complexity, visualWeight: spec.visualWeight, qualityScore: spec.qualityScore, variants: spec.variants }, spec.render),
);
