import {
  arcSeg,
  brokenArc,
  createAsset,
  stroke,
  type AssetSeedConfig,
} from "@/lib/design/svg-assets/families/_shared";
import { circle, path } from "@/lib/design/vector-engine/xml";
import type { SvgAssetDefinition } from "@/lib/design/svg-assets/types";

const BASE: Omit<AssetSeedConfig, "complexity" | "visualWeight" | "qualityScore" | "variants"> = {
  styleTags: ["broken", "orbital", "editorial"],
  recommendedStyles: ["silent-luxury", "minimal-luxury", "monochrome-luxury"],
  recommendedTemplates: ["silent-collection", "luxury-editorial", "modern-minimal"],
  recommendedPlacements: ["center-chest", "oversized-front"],
  printMethods: ["screen", "dtg", "embroidery"],
  renderMode: "stroke",
};

const SPECS: Array<{ slug: string; name: string; complexity: number; visualWeight: number; qualityScore: number; variants: string[]; render: (ctx: import("@/lib/design/svg-assets/types").SvgAssetRenderContext) => string }> = [
  {
    slug: "tri-segment",
    name: "Tri-Segment Halo",
    complexity: 4,
    visualWeight: 0.62,
    qualityScore: 88,
    variants: ["default", "tight-gap"],
    render: (ctx) =>
      brokenArc(ctx, ctx.scale * 0.4, [
        { start: -130, sweep: 75 },
        { start: 10, sweep: 75 },
        { start: 150, sweep: 75 },
      ]),
  },
  {
    slug: "dual-orbit",
    name: "Dual Orbit Halo",
    complexity: 5,
    visualWeight: 0.58,
    qualityScore: 90,
    variants: ["default", "nested"],
    render: (ctx) => {
      const r = ctx.scale * 0.38;
      const inner = r * 0.68;
      return [
        brokenArc(ctx, r, [
          { start: -120, sweep: 70 },
          { start: 60, sweep: 70 },
        ]),
        brokenArc(ctx, inner, [
          { start: -100, sweep: 55 },
          { start: 80, sweep: 55 },
        ], 0.55, 0.6),
      ].join("");
    },
  },
  {
    slug: "eclipse-gap",
    name: "Eclipse Gap Halo",
    complexity: 6,
    visualWeight: 0.7,
    qualityScore: 91,
    variants: ["default", "wide-gap"],
    render: (ctx) => {
      const r = ctx.scale * 0.42;
      return [
        brokenArc(ctx, r, [{ start: -150, sweep: 95 }]),
        brokenArc(ctx, r, [{ start: 70, sweep: 95 }], 1, 0.85),
        circle(ctx.cx, ctx.cy, r * 0.14, stroke(ctx.secondaryColor, ctx.strokeWidth * 0.35, ctx.opacity * 0.5)),
      ].join("");
    },
  },
  {
    slug: "quarter-void",
    name: "Quarter Void Halo",
    complexity: 5,
    visualWeight: 0.55,
    qualityScore: 87,
    variants: ["default"],
    render: (ctx) =>
      brokenArc(ctx, ctx.scale * 0.36, [
        { start: -45, sweep: 80 },
        { start: 90, sweep: 80 },
        { start: 225, sweep: 50 },
      ]),
  },
  {
    slug: "offset-ring",
    name: "Offset Ring Halo",
    complexity: 7,
    visualWeight: 0.64,
    qualityScore: 92,
    variants: ["default", "offset-a", "offset-b"],
    render: (ctx) => {
      const r = ctx.scale * 0.35;
      const ox = ctx.scale * 0.04;
      return [
        path(arcSeg(ctx.cx - ox, ctx.cy, r, ctx.rotation - 140, ctx.rotation - 20), stroke(ctx.color, ctx.strokeWidth, ctx.opacity)),
        path(arcSeg(ctx.cx + ox, ctx.cy, r * 0.82, ctx.rotation + 30, ctx.rotation + 150), stroke(ctx.secondaryColor, ctx.strokeWidth * 0.6, ctx.opacity * 0.65)),
      ].join("");
    },
  },
  {
    slug: "broken-crown",
    name: "Broken Crown Halo",
    complexity: 6,
    visualWeight: 0.68,
    qualityScore: 89,
    variants: ["default"],
    render: (ctx) => {
      const r = ctx.scale * 0.4;
      return [
        brokenArc(ctx, r, [{ start: -160, sweep: 55 }]),
        brokenArc(ctx, r, [{ start: -70, sweep: 40 }]),
        brokenArc(ctx, r, [{ start: 50, sweep: 55 }]),
        brokenArc(ctx, r, [{ start: 140, sweep: 40 }]),
      ].join("");
    },
  },
  {
    slug: "thin-arc-pair",
    name: "Thin Arc Pair",
    complexity: 3,
    visualWeight: 0.42,
    qualityScore: 85,
    variants: ["default", "hairline"],
    render: (ctx) =>
      brokenArc(ctx, ctx.scale * 0.44, [
        { start: -90, sweep: 55 },
        { start: 90, sweep: 55 },
      ], 0.35, 0.75),
  },
  {
    slug: "segmented-orbit",
    name: "Segmented Orbit",
    complexity: 7,
    visualWeight: 0.72,
    qualityScore: 93,
    variants: ["default", "dense"],
    render: (ctx) => {
      const r = ctx.scale * 0.39;
      const segs = [-150, -90, -30, 30, 90, 150];
      return segs.map((start) => brokenArc(ctx, r, [{ start, sweep: 35 }], 0.7, 0.8)).join("");
    },
  },
  {
    slug: "halo-bracket",
    name: "Halo Bracket",
    complexity: 5,
    visualWeight: 0.6,
    qualityScore: 88,
    variants: ["default"],
    render: (ctx) => {
      const r = ctx.scale * 0.37;
      return [
        brokenArc(ctx, r, [{ start: -120, sweep: 65 }]),
        brokenArc(ctx, r, [{ start: 55, sweep: 65 }]),
        brokenArc(ctx, r * 0.55, [{ start: -60, sweep: 120 }], 0.45, 0.5),
      ].join("");
    },
  },
  {
    slug: "asymmetric-arc",
    name: "Asymmetric Arc Halo",
    complexity: 6,
    visualWeight: 0.66,
    qualityScore: 90,
    variants: ["default", "mirror"],
    render: (ctx) =>
      brokenArc(ctx, ctx.scale * 0.41, [
        { start: -170, sweep: 110 },
        { start: 20, sweep: 45 },
        { start: 120, sweep: 70 },
      ]),
  },
];

export const HALO_ASSETS: SvgAssetDefinition[] = SPECS.map((spec) =>
  createAsset("halo", spec.slug, spec.name, { ...BASE, complexity: spec.complexity, visualWeight: spec.visualWeight, qualityScore: spec.qualityScore, variants: spec.variants }, spec.render),
);
