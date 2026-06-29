import type { ColorScheme } from "@/lib/design/vector-engine/types";
import type { LayoutZones, OrnamentId, OrnamentPlacement } from "@/lib/design/design-library/types";
import {
  capsuleText,
  renderCapsuleCode,
  renderCoordinateMarks,
  renderEditorialLines,
  renderFlankStrikes,
  renderLuxuryDivider,
  renderNoiseMask,
  renderVerticalRules,
  type AssetRenderContext,
} from "@/lib/design/engine/assets/library";
import { range } from "@/lib/design/vector-engine/hash";
import { DESIGN_TOKENS, snap } from "@/lib/design/vector-engine/tokens";
import { circle, group, line, rect } from "@/lib/design/vector-engine/xml";

export interface OrnamentRenderContext {
  placement: OrnamentPlacement;
  colors: ColorScheme;
  strokeWidth: number;
  seed: number;
  safeZone: LayoutZones["safeZone"];
}

function baseCtx(ctx: OrnamentRenderContext): AssetRenderContext {
  const p = ctx.placement;
  return {
    cx: p.cx,
    cy: p.cy,
    scale: p.scale,
    rotation: p.rotation,
    opacity: p.opacity,
    colors: ctx.colors,
    strokeWidth: ctx.strokeWidth,
    seed: ctx.seed,
    safeZone: ctx.safeZone,
  };
}

function stroke(c: string, sw: number, op: number) {
  return { fill: "none" as const, stroke: c, "stroke-width": sw, opacity: op, "stroke-linecap": "round" as const };
}

function renderRuleLines(ctx: AssetRenderContext): string {
  const w = ctx.scale * 0.56;
  const y = ctx.cy;
  return line(ctx.cx - w / 2, y, ctx.cx + w / 2, y, stroke(ctx.colors.secondary, ctx.strokeWidth * 0.35, 0.22));
}

function renderMicroDots(ctx: AssetRenderContext): string {
  const dots: string[] = [];
  for (let i = 0; i < 8; i++) {
    const x = ctx.cx + range(ctx.seed, i * 3, -ctx.scale * 0.2, ctx.scale * 0.2);
    const y = ctx.cy + range(ctx.seed, i * 3 + 1, -ctx.scale * 0.08, ctx.scale * 0.08);
    dots.push(circle(x, y, ctx.strokeWidth * 0.35, { fill: ctx.colors.secondary, opacity: 0.25 + range(ctx.seed, i, 0, 0.2) }));
  }
  return dots.join("");
}

function renderLuxuryBorder(ctx: AssetRenderContext): string {
  const sz = ctx.safeZone;
  const inset = sz.width * 0.04;
  const c = ctx.colors.secondary;
  const sw = ctx.strokeWidth * 0.35;
  return rect(sz.x + inset, sz.y + inset, sz.width - inset * 2, sz.height - inset * 2, stroke(c, sw, 0.18));
}

function renderCornerMarks(ctx: AssetRenderContext): string {
  const sz = ctx.safeZone;
  const arm = ctx.strokeWidth * 3;
  const inset = sz.width * 0.05;
  const c = ctx.colors.secondary;
  const corners = [
    [sz.x + inset, sz.y + inset, arm, 0],
    [sz.x + sz.width - inset, sz.y + inset, -arm, 0],
    [sz.x + inset, sz.y + sz.height - inset, arm, 0],
    [sz.x + sz.width - inset, sz.y + sz.height - inset, -arm, 0],
  ] as const;
  return corners
    .map(([x, y, dx, dy]) => [
      line(x, y, x + dx, y, stroke(c, ctx.strokeWidth * 0.4, 0.3)),
      line(x, y, x, y + (dy || arm), stroke(c, ctx.strokeWidth * 0.4, 0.3)),
    ].join(""))
    .join("");
}

function renderRegistrationMarks(ctx: AssetRenderContext): string {
  return renderCoordinateMarks(ctx);
}

function renderAlignmentGuides(ctx: AssetRenderContext): string {
  const sz = ctx.safeZone;
  const c = ctx.colors.secondary;
  const x = sz.x + sz.width * 0.5;
  return line(x, sz.y + sz.height * 0.1, x, sz.y + sz.height * 0.9, stroke(c, ctx.strokeWidth * 0.25, 0.12));
}

const RENDERERS: Partial<Record<OrnamentId, (ctx: AssetRenderContext, text?: string) => string>> = {
  "rule-lines": renderRuleLines,
  "micro-dots": renderMicroDots,
  "editorial-dividers": renderEditorialLines,
  coordinates: renderCoordinateMarks,
  "registration-marks": renderRegistrationMarks,
  "luxury-borders": renderLuxuryBorder,
  "corner-marks": renderCornerMarks,
  "alignment-guides": renderAlignmentGuides,
  "tiny-capsules": (ctx) => renderCapsuleCode(ctx, capsuleText(ctx.seed)),
  "flank-strikes": renderFlankStrikes,
  "vertical-rules": renderVerticalRules,
  "micro-lines": renderEditorialLines,
  "roman-ids": () => "",
  "minimal-labels": () => "",
  "collection-numbers": () => "",
};

export function renderOrnament(ctx: OrnamentRenderContext): string {
  const renderer = RENDERERS[ctx.placement.ornamentId];
  if (!renderer) return "";
  const svg = renderer(baseCtx(ctx), ctx.placement.text);
  if (!svg) return "";
  return group(`ornament-${ctx.placement.id}`, svg);
}

export function renderEditorialRules(
  safeZone: LayoutZones["safeZone"],
  focalY: number,
  colors: ColorScheme,
  includeOversized: boolean,
): string {
  const sw = DESIGN_TOKENS.stroke.hairline;
  const parts: string[] = [];
  const ruleY = snap(focalY + safeZone.width * 0.22);
  parts.push(
    line(safeZone.x + safeZone.width * 0.2, ruleY, safeZone.x + safeZone.width * 0.8, ruleY, {
      stroke: colors.secondary,
      "stroke-width": sw,
      opacity: 0.2,
      "stroke-linecap": "round",
    }),
  );
  if (includeOversized) {
    const topRule = snap(safeZone.y + safeZone.height * 0.14);
    parts.push(
      rect(safeZone.x + safeZone.width * 0.36, topRule, safeZone.width * 0.28, 0.3, {
        fill: colors.secondary,
        opacity: 0.16,
      }),
    );
  }
  return parts.join("");
}
