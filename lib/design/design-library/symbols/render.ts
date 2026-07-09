import type { ColorScheme } from "@/lib/design/vector-engine/types";
import type { LayoutZones, SymbolId, SymbolPlacement } from "@/lib/design/design-library/types";
import {
  renderArchitecturalFrame,
  renderBrokenCircle,
  renderCoordinateMarks,
  renderDualInterruptedArc,
  renderEditorialLines,
  renderFlankStrikes,
  renderGridSystem,
  renderMinimalCross,
  renderMinimalSymbol,
  renderMissingCenterVoid,
  renderSacredGeometry,
  renderTechnicalSchematic,
  type AssetRenderContext,
} from "@/lib/design/engine/assets/library";
import { range } from "@/lib/design/vector-engine/hash";
import { DESIGN_TOKENS, fmt, snap } from "@/lib/design/vector-engine/tokens";
import { circle, group, line, path } from "@/lib/design/vector-engine/xml";

export interface SymbolRenderContext {
  placement: SymbolPlacement;
  colors: ColorScheme;
  strokeWidth: number;
  seed: number;
  safeZone: LayoutZones["safeZone"];
}

function baseCtx(ctx: SymbolRenderContext): AssetRenderContext {
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

function rotatePoint(x: number, y: number, cx: number, cy: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  const dx = x - cx;
  const dy = y - cy;
  return { x: cx + dx * Math.cos(rad) - dy * Math.sin(rad), y: cy + dx * Math.sin(rad) + dy * Math.cos(rad) };
}

function stroke(c: string, sw: number, op: number) {
  return { fill: "none" as const, stroke: c, "stroke-width": sw, opacity: op, "stroke-linecap": "round" as const };
}

function renderHalo(ctx: AssetRenderContext): string {
  const r = ctx.scale * 0.36;
  return circle(ctx.cx, ctx.cy, r, stroke(ctx.colors.primary, ctx.strokeWidth, ctx.opacity * 0.85));
}

function renderHalfCircle(ctx: AssetRenderContext): string {
  const r = ctx.scale * 0.34;
  const s = rotatePoint(ctx.cx + r, ctx.cy, ctx.cx, ctx.cy, ctx.rotation - 90);
  const e = rotatePoint(ctx.cx + r, ctx.cy, ctx.cx, ctx.cy, ctx.rotation + 90);
  return path(`M ${fmt(s.x)} ${fmt(s.y)} A ${fmt(r)} ${fmt(r)} 0 0 1 ${fmt(e.x)} ${fmt(e.y)}`, stroke(ctx.colors.primary, ctx.strokeWidth, ctx.opacity));
}

function renderDiamond(ctx: AssetRenderContext): string {
  const s = ctx.scale * 0.14;
  const c = ctx.colors.primary;
  const { cx, cy } = ctx;
  return path(`M ${fmt(cx)} ${fmt(cy - s)} L ${fmt(cx + s * 0.6)} ${fmt(cy)} L ${fmt(cx)} ${fmt(cy + s)} L ${fmt(cx - s * 0.6)} ${fmt(cy)} Z`, stroke(c, ctx.strokeWidth, ctx.opacity));
}

function renderMinimalStar(ctx: AssetRenderContext): string {
  const arm = ctx.scale * 0.12;
  const c = ctx.colors.accent;
  const { cx, cy } = ctx;
  return [
    line(cx, cy - arm, cx, cy + arm, stroke(c, ctx.strokeWidth * 0.5, ctx.opacity)),
    line(cx - arm * 0.7, cy - arm * 0.3, cx + arm * 0.7, cy + arm * 0.3, stroke(c, ctx.strokeWidth * 0.5, ctx.opacity * 0.8)),
    line(cx - arm * 0.7, cy + arm * 0.3, cx + arm * 0.7, cy - arm * 0.3, stroke(c, ctx.strokeWidth * 0.5, ctx.opacity * 0.8)),
  ].join("");
}

function renderCompass(ctx: AssetRenderContext): string {
  const r = ctx.scale * 0.28;
  const c = ctx.colors.secondary;
  const { cx, cy } = ctx;
  return [
    circle(cx, cy, r, stroke(c, ctx.strokeWidth * 0.5, ctx.opacity * 0.6)),
    line(cx, cy - r, cx, cy + r, stroke(c, ctx.strokeWidth * 0.4, ctx.opacity * 0.5)),
    line(cx - r, cy, cx + r, cy, stroke(c, ctx.strokeWidth * 0.4, ctx.opacity * 0.5)),
    circle(cx, cy, ctx.strokeWidth * 0.5, { fill: c, opacity: ctx.opacity * 0.7 }),
  ].join("");
}

function renderOrbit(ctx: AssetRenderContext): string {
  return renderDualInterruptedArc(ctx) + renderHalo({ ...ctx, scale: ctx.scale * 1.08, opacity: ctx.opacity * 0.45 });
}

function renderMinimalEye(ctx: AssetRenderContext): string {
  const w = ctx.scale * 0.2;
  const h = ctx.scale * 0.1;
  const c = ctx.colors.primary;
  const { cx, cy } = ctx;
  return [
    path(`M ${fmt(cx - w)} ${fmt(cy)} Q ${fmt(cx)} ${fmt(cy - h)} ${fmt(cx + w)} ${fmt(cy)} Q ${fmt(cx)} ${fmt(cy + h)} ${fmt(cx - w)} ${fmt(cy)}`, stroke(c, ctx.strokeWidth * 0.5, ctx.opacity)),
    circle(cx, cy, ctx.strokeWidth * 0.6, { fill: c, opacity: ctx.opacity * 0.8 }),
  ].join("");
}

function renderDirectionalMarker(ctx: AssetRenderContext): string {
  const len = ctx.scale * 0.14;
  const c = ctx.colors.accent;
  const { cx, cy } = ctx;
  return [
    line(cx - len / 2, cy, cx + len / 2, cy, stroke(c, ctx.strokeWidth * 0.5, ctx.opacity)),
    line(cx + len * 0.2, cy, cx + len * 0.35, cy - len * 0.15, stroke(c, ctx.strokeWidth * 0.5, ctx.opacity)),
    line(cx + len * 0.2, cy, cx + len * 0.35, cy + len * 0.15, stroke(c, ctx.strokeWidth * 0.5, ctx.opacity)),
  ].join("");
}

function renderSplitCircle(ctx: AssetRenderContext): string {
  return renderBrokenCircle(ctx);
}

const RENDERERS: Record<SymbolId, (ctx: AssetRenderContext) => string> = {
  "broken-circle": renderBrokenCircle,
  "interrupted-arc": renderDualInterruptedArc,
  halo: renderHalo,
  cross: renderMinimalCross,
  compass: renderCompass,
  frame: renderArchitecturalFrame,
  "minimal-star": renderMinimalStar,
  diamond: renderDiamond,
  "architectural-line": renderEditorialLines,
  "sacred-geometry": renderSacredGeometry,
  grid: renderGridSystem,
  "half-circle": renderHalfCircle,
  "split-circle": renderSplitCircle,
  orbit: renderOrbit,
  "minimal-eye": renderMinimalEye,
  "directional-marker": renderDirectionalMarker,
  "missing-center-void": renderMissingCenterVoid,
};

export function renderSymbol(ctx: SymbolRenderContext): string {
  const renderer = RENDERERS[ctx.placement.symbolId];
  if (!renderer) return "";
  return group(`symbol-${ctx.placement.id}`, renderer(baseCtx(ctx)));
}

export function renderSymbolAccent(ctx: SymbolRenderContext, index: number): string {
  const p = ctx.placement;
  const offsetX = (index % 2 === 0 ? -1 : 1) * p.scale * 0.15;
  const x = snap(p.cx + offsetX);
  const y = snap(p.cy + p.scale * 0.08 * index);
  const c = ctx.colors.accent;
  const sw = ctx.strokeWidth;
  const op = 0.4 + range(ctx.seed, index + 50, 0, 0.25);

  if (index % 3 === 0) return renderMinimalCross({ ...baseCtx(ctx), cx: x, cy: y, scale: p.scale * 0.2, opacity: op });
  if (index % 3 === 1) return circle(x, y, sw * 0.7, { fill: c, opacity: op });
  return line(x - p.scale * 0.05, y, x + p.scale * 0.05, y, stroke(c, sw * 0.4, op));
}
