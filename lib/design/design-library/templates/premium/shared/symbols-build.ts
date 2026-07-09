import type { SymbolId } from "@/lib/design/design-library/types";
import type { PremiumRenderContext } from "@/lib/design/design-library/templates/premium/types";
import {
  renderArchitecturalFrame,
  renderBrokenCircle,
  renderDualInterruptedArc,
  renderEditorialLines,
  renderFlankStrikes,
  renderMissingCenterVoid,
  renderSacredGeometry,
  type AssetRenderContext,
} from "@/lib/design/engine/assets/library";
import { range } from "@/lib/design/vector-engine/hash";
import { fmt, snap } from "@/lib/design/vector-engine/tokens";
import { circle, group, line, path } from "@/lib/design/vector-engine/xml";

export interface SymbolLayerBuild {
  primaryFocal: string;
  symbolLayer: string;
  secondaryGeometry: string;
  depthLayer: string;
  defs: string;
  groupCount: number;
}

export interface SymbolRecipe {
  primary: SymbolId;
  secondary: SymbolId;
  nested: SymbolId[];
  includeHalo: boolean;
  includeDirectional: boolean;
}

function ctxAt(
  c: PremiumRenderContext,
  cx: number,
  cy: number,
  scale: number,
  rotation: number,
  opacity: number,
): AssetRenderContext {
  return { cx, cy, scale, rotation, opacity, colors: c.colors, strokeWidth: c.strokeWidth, seed: c.seed, safeZone: c.safeZone };
}

const RENDER: Partial<Record<SymbolId, (ctx: AssetRenderContext) => string>> = {
  "broken-circle": renderBrokenCircle,
  "interrupted-arc": renderDualInterruptedArc,
  frame: renderArchitecturalFrame,
  "architectural-line": renderEditorialLines,
  "sacred-geometry": renderSacredGeometry,
  "missing-center-void": renderMissingCenterVoid,
  halo: (ctx) => circle(ctx.cx, ctx.cy, ctx.scale * 0.36, { fill: "none", stroke: ctx.colors.primary, "stroke-width": ctx.strokeWidth, opacity: ctx.opacity * 0.75 }),
  cross: (ctx) => {
    const arm = ctx.scale * 0.1;
    const s = { fill: "none" as const, stroke: ctx.colors.accent, "stroke-width": ctx.strokeWidth * 0.45, opacity: ctx.opacity };
    return [line(ctx.cx - arm, ctx.cy, ctx.cx + arm, ctx.cy, s), line(ctx.cx, ctx.cy - arm, ctx.cx, ctx.cy + arm, s)].join("");
  },
  diamond: (ctx) => {
    const s = ctx.scale * 0.14;
    const { cx, cy } = ctx;
    const c = ctx.colors.primary;
    return path(`M ${fmt(cx)} ${fmt(cy - s)} L ${fmt(cx + s * 0.6)} ${fmt(cy)} L ${fmt(cx)} ${fmt(cy + s)} L ${fmt(cx - s * 0.6)} ${fmt(cy)} Z`, { fill: "none", stroke: c, "stroke-width": ctx.strokeWidth, opacity: ctx.opacity });
  },
  grid: (ctx) => renderEditorialLines({ ...ctx, opacity: ctx.opacity * 0.45 }),
  orbit: renderDualInterruptedArc,
  "minimal-star": (ctx) => {
    const arm = ctx.scale * 0.1;
    const s = { stroke: ctx.colors.accent, "stroke-width": ctx.strokeWidth * 0.45, opacity: ctx.opacity, "stroke-linecap": "round" as const };
    return [line(ctx.cx, ctx.cy - arm, ctx.cx, ctx.cy + arm, s), line(ctx.cx - arm * 0.7, ctx.cy, ctx.cx + arm * 0.7, ctx.cy, s)].join("");
  },
  "directional-marker": (ctx) => {
    const len = ctx.scale * 0.12;
    const s = { stroke: ctx.colors.accent, "stroke-width": ctx.strokeWidth * 0.45, opacity: ctx.opacity, "stroke-linecap": "round" as const };
    return line(ctx.cx - len / 2, ctx.cy, ctx.cx + len / 2, ctx.cy, s);
  },
};

export function buildSymbolLayers(c: PremiumRenderContext, recipe: SymbolRecipe): SymbolLayerBuild {
  const { focal, heroScale, seed } = c;
  const scale = heroScale * c.spec.style.geometryScale;
  const rot = range(seed, 7, -5, 5);
  const clipId = `premium-symbol-mask-${c.spec.brief.designId.replace(/\W/g, "").slice(0, 12)}`;

  const primaryRenderer = RENDER[recipe.primary] ?? renderArchitecturalFrame;
  const secondaryRenderer = RENDER[recipe.secondary] ?? renderBrokenCircle;

  const primaryContent = primaryRenderer(ctxAt(c, focal.x, focal.y - scale * 0.03, scale, rot, 0.92));
  const nestedParts: string[] = [];
  recipe.nested.forEach((id, i) => {
    const renderer = RENDER[id];
    if (!renderer) return;
    const nested = renderer(
      ctxAt(
        c,
        focal.x + range(seed, 100 + i, -scale * 0.06, scale * 0.06),
        focal.y + range(seed, 110 + i, -scale * 0.04, scale * 0.08),
        scale * range(seed, 120 + i, 0.55, 0.78),
        rot + range(seed, 130 + i, -10, 10),
        0.72 - i * 0.08,
      ),
    );
    nestedParts.push(group(`premium-symbol-nested-${i}`, nested));
  });

  const cutThrough = renderDualInterruptedArc(
    ctxAt(c, focal.x, focal.y + scale * 0.12, scale * 0.88, rot + 8, 0.68),
  );

  const secondaryGeo = secondaryRenderer(
    ctxAt(
      c,
      snap(focal.x + c.safeZone.width * 0.14),
      snap(focal.y - scale * 0.2),
      scale * 0.42,
      rot + 14,
      0.58,
    ),
  );

  const halo = recipe.includeHalo
    ? (RENDER.halo?.(ctxAt(c, focal.x, focal.y, scale * 1.05, 0, 0.35)) ?? "")
    : "";

  const directional: string[] = [];
  if (recipe.includeDirectional) {
    for (let i = 0; i < 3; i++) {
      directional.push(
        group(
          `premium-symbol-directional-${i}`,
          RENDER["directional-marker"]!(
            ctxAt(
              c,
              focal.x + range(seed, 140 + i, -scale * 0.35, scale * 0.35),
              focal.y + scale * 0.28 + i * 8,
              scale * 0.18,
              range(seed, 150 + i, -15, 15),
              0.42,
            ),
          ),
        ),
      );
    }
  }

  const depthGhost = circle(focal.x, focal.y, scale * 0.44, {
    fill: "none",
    stroke: c.colors.secondary,
    "stroke-width": c.strokeWidth * 0.25,
    opacity: 0.12,
    "stroke-dasharray": "3 6",
  });

  const defs = [
    `<clipPath id="${clipId}">`,
    `<rect x="${fmt(c.safeZone.x)}" y="${fmt(focal.y - scale * 0.05)}" width="${fmt(c.safeZone.width * 0.92)}" height="${fmt(scale * 0.5)}" />`,
    `</clipPath>`,
  ].join("");

  const primaryFocal = group(
    "hero-primary-symbol",
    [
      group("premium-symbol-group-primary", primaryContent),
      group("premium-symbol-group-nested", nestedParts.join("")),
      group("premium-symbol-group-cut", `<g clip-path="url(#${clipId})">${cutThrough}</g>`),
    ].join(""),
  );

  const symbolLayer = group(
    "premium-symbol-layer",
    [
      group("premium-symbol-group-frame", renderArchitecturalFrame(ctxAt(c, focal.x, focal.y - scale * 0.08, scale * 1.1, rot, 0.4))),
      group("premium-symbol-group-halo", halo),
      ...directional,
    ].join(""),
  );

  const secondaryGeometry = group(
    "premium-symbol-secondary-geometry",
    [
      group("premium-symbol-group-secondary", secondaryGeo),
      group("premium-symbol-group-flank", renderFlankStrikes(ctxAt(c, focal.x - scale * 0.5, focal.y, scale, 0, 0.38))),
    ].join(""),
  );

  const depthLayer = group("premium-depth-layer", depthGhost);

  return {
    primaryFocal,
    symbolLayer,
    secondaryGeometry,
    depthLayer,
    defs,
    groupCount: 6 + nestedParts.length + directional.length,
  };
}
