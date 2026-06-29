import type { ColorScheme } from "@/lib/design/vector-engine/types";
import type { LibraryArtworkSpec, SymbolId } from "@/lib/design/design-library/types";
import type { HierarchyPlan } from "@/lib/design/design-library/composition/premium/hierarchy";
import type { PremiumTypographyPlan } from "@/lib/design/design-library/composition/premium/typography-layout";
import type { CompositionType } from "@/lib/design/design-library/composition/premium/apparel-composer";
import {
  renderArchitecturalFrame,
  renderBrokenCircle,
  renderDualInterruptedArc,
  renderEditorialLines,
  renderMissingCenterVoid,
  renderSacredGeometry,
  type AssetRenderContext,
} from "@/lib/design/engine/assets/library";
import { range } from "@/lib/design/vector-engine/hash";
import { fmt, snap } from "@/lib/design/vector-engine/tokens";
import { circle, group, line, rect } from "@/lib/design/vector-engine/xml";

export type SymbolInteraction =
  | "overlap"
  | "crop"
  | "cut-through"
  | "frame-break"
  | "depth-front"
  | "depth-back";

export interface PlacedSymbol {
  id: string;
  symbolId: SymbolId;
  cx: number;
  cy: number;
  scale: number;
  rotation: number;
  opacity: number;
  interaction: SymbolInteraction;
  clipId?: string;
}

export interface SymbolLayoutPlan {
  symbols: PlacedSymbol[];
  clipDefs: string;
}

function primarySymbolForType(type: CompositionType): SymbolId {
  const map: Record<CompositionType, SymbolId> = {
    "luxury-editorial": "frame",
    "gallery-poster": "broken-circle",
    "museum-label": "diamond",
    architectural: "architectural-line",
    "faith-collection": "sacred-geometry",
    "modern-minimal": "interrupted-arc",
    "fashion-campaign": "broken-circle",
    "technical-luxury": "grid",
    "silent-collection": "missing-center-void",
    "oversized-graphic": "frame",
  };
  return map[type];
}

function secondarySymbolForType(type: CompositionType): SymbolId {
  const map: Record<CompositionType, SymbolId> = {
    "luxury-editorial": "interrupted-arc",
    "gallery-poster": "orbit",
    "museum-label": "frame",
    architectural: "broken-circle",
    "faith-collection": "cross",
    "modern-minimal": "missing-center-void",
    "fashion-campaign": "interrupted-arc",
    "technical-luxury": "compass",
    "silent-collection": "halo",
    "oversized-graphic": "architectural-line",
  };
  return map[type];
}

export function buildSymbolLayout(
  spec: LibraryArtworkSpec,
  plan: HierarchyPlan,
  typography: PremiumTypographyPlan,
  compositionType: CompositionType,
): SymbolLayoutPlan {
  const seed = spec.seed;
  const band = typography.intersectionBand;
  const clipId = `premium-symbol-cut-${spec.brief.designId.replace(/[^a-z0-9]/gi, "")}`;

  const symbols: PlacedSymbol[] = [
    {
      id: "premium-symbol-primary",
      symbolId: primarySymbolForType(compositionType),
      cx: plan.primary.x,
      cy: snap(plan.primary.y - plan.primary.scale * 0.04),
      scale: plan.primary.scale,
      rotation: plan.primary.rotation,
      opacity: plan.primary.opacity,
      interaction: "depth-back",
    },
    {
      id: "premium-symbol-secondary",
      symbolId: secondarySymbolForType(compositionType),
      cx: plan.secondary.x,
      cy: plan.secondary.y,
      scale: plan.secondary.scale,
      rotation: plan.secondary.rotation,
      opacity: plan.secondary.opacity,
      interaction: "frame-break",
    },
    {
      id: "premium-symbol-cut",
      symbolId: "interrupted-arc",
      cx: plan.primary.x + range(seed, 501, -12, 12),
      cy: snap(band.y + band.height * 0.45),
      scale: plan.primary.scale * 0.88,
      rotation: plan.primary.rotation + range(seed, 502, -8, 8),
      opacity: 0.78,
      interaction: "cut-through",
      clipId,
    },
  ];

  plan.supporting.forEach((anchor, i) => {
    symbols.push({
      id: `premium-symbol-support-${i}`,
      symbolId: i % 2 === 0 ? "minimal-star" : "directional-marker",
      cx: anchor.x,
      cy: anchor.y,
      scale: anchor.scale,
      rotation: anchor.rotation,
      opacity: anchor.opacity,
      interaction: "overlap",
    });
  });

  if (!symbols.some((s) => ["frame", "diamond", "cross", "sacred-geometry", "architectural-line", "grid"].includes(s.symbolId))) {
    symbols.push({
      id: "premium-symbol-frame",
      symbolId: "frame",
      cx: snap(plan.primary.x + plan.primary.scale * 0.08),
      cy: snap(plan.primary.y - plan.primary.scale * 0.12),
      scale: plan.primary.scale * 0.95,
      rotation: plan.primary.rotation + 4,
      opacity: 0.38,
      interaction: "frame-break",
    });
  }

  const clipDefs = [
    `<clipPath id="${clipId}">`,
    `<rect x="${fmt(spec.layoutZones.safeZone.x)}" y="${fmt(band.y)}" width="${fmt(spec.layoutZones.safeZone.width * 0.92)}" height="${fmt(band.height * 0.55)}" />`,
    `</clipPath>`,
  ].join("");

  return { symbols, clipDefs };
}

function assetCtx(
  placed: PlacedSymbol,
  colors: ColorScheme,
  strokeWidth: number,
  seed: number,
  safeZone: LibraryArtworkSpec["layoutZones"]["safeZone"],
): AssetRenderContext {
  return {
    cx: placed.cx,
    cy: placed.cy,
    scale: placed.scale,
    rotation: placed.rotation,
    opacity: placed.opacity,
    colors,
    strokeWidth,
    seed,
    safeZone,
  };
}

const SYMBOL_RENDER: Partial<Record<SymbolId, (ctx: AssetRenderContext) => string>> = {
  "broken-circle": renderBrokenCircle,
  "interrupted-arc": renderDualInterruptedArc,
  frame: renderArchitecturalFrame,
  "architectural-line": renderEditorialLines,
  "sacred-geometry": renderSacredGeometry,
  "missing-center-void": renderMissingCenterVoid,
  cross: (ctx) => {
    const arm = ctx.scale * 0.1;
    const c = ctx.colors.accent;
    const sw = ctx.strokeWidth;
    const s = { fill: "none" as const, stroke: c, "stroke-width": sw * 0.45, opacity: ctx.opacity };
    return [
      line(ctx.cx - arm, ctx.cy, ctx.cx + arm, ctx.cy, s),
      line(ctx.cx, ctx.cy - arm, ctx.cx, ctx.cy + arm, s),
    ].join("");
  },
  diamond: (ctx) => {
    const s = ctx.scale * 0.14;
    const { cx, cy } = ctx;
    const c = ctx.colors.primary;
    const sw = ctx.strokeWidth;
    return `<path d="M ${fmt(cx)} ${fmt(cy - s)} L ${fmt(cx + s * 0.6)} ${fmt(cy)} L ${fmt(cx)} ${fmt(cy + s)} L ${fmt(cx - s * 0.6)} ${fmt(cy)} Z" fill="none" stroke="${c}" stroke-width="${sw}" opacity="${ctx.opacity}"/>`;
  },
  grid: (ctx) => renderEditorialLines({ ...ctx, opacity: ctx.opacity * 0.5 }),
  halo: (ctx) =>
    circle(ctx.cx, ctx.cy, ctx.scale * 0.36, {
      fill: "none",
      stroke: ctx.colors.primary,
      "stroke-width": ctx.strokeWidth,
      opacity: ctx.opacity * 0.7,
    }),
  orbit: renderDualInterruptedArc,
  "minimal-star": (ctx) => {
    const arm = ctx.scale * 0.1;
    const c = ctx.colors.accent;
    const sw = ctx.strokeWidth;
    const s = { stroke: c, "stroke-width": sw * 0.45, opacity: ctx.opacity, "stroke-linecap": "round" as const };
    return [
      line(ctx.cx, ctx.cy - arm, ctx.cx, ctx.cy + arm, s),
      line(ctx.cx - arm * 0.7, ctx.cy, ctx.cx + arm * 0.7, ctx.cy, s),
    ].join("");
  },
  "directional-marker": (ctx) => {
    const len = ctx.scale * 0.12;
    const c = ctx.colors.accent;
    const sw = ctx.strokeWidth;
    const s = { stroke: c, "stroke-width": sw * 0.45, opacity: ctx.opacity, "stroke-linecap": "round" as const };
    return line(ctx.cx - len / 2, ctx.cy, ctx.cx + len / 2, ctx.cy, s);
  },
};

export function renderSymbolLayout(
  layout: SymbolLayoutPlan,
  colors: ColorScheme,
  strokeWidth: number,
  seed: number,
  safeZone: LibraryArtworkSpec["layoutZones"]["safeZone"],
): { primaryFocal: string; secondaryFocal: string; supporting: string } {
  const primaryParts: string[] = [];
  const secondaryParts: string[] = [];
  const supportingParts: string[] = [];

  for (const placed of layout.symbols) {
    const renderer = SYMBOL_RENDER[placed.symbolId];
    if (!renderer) continue;
    const ctx = assetCtx(placed, colors, strokeWidth, seed, safeZone);
    const content = renderer(ctx);
    const wrapped =
      placed.clipId && placed.interaction === "cut-through"
        ? group(placed.id, `<g clip-path="url(#${placed.clipId})">${content}</g>`)
        : group(placed.id, content);

    if (placed.id.includes("primary") || placed.interaction === "depth-back") {
      primaryParts.push(wrapped);
    } else if (placed.id.includes("secondary") || placed.interaction === "frame-break") {
      secondaryParts.push(wrapped);
    } else {
      supportingParts.push(wrapped);
    }
  }

  return {
    primaryFocal: group("hero-primary-symbol", primaryParts.join("")),
    secondaryFocal: group("premium-symbol-secondary-layer", secondaryParts.join("")),
    supporting: group("premium-symbol-supporting", supportingParts.join("")),
  };
}
