import { range, seeded } from "@/lib/design/vector-engine/hash";
import type { Point, PrintEffect } from "@/lib/design/vector-engine/types";
import { DESIGN_TOKENS, fmt } from "@/lib/design/vector-engine/tokens";
import { circle, group, line, path, rect } from "@/lib/design/vector-engine/xml";

export interface PrimitiveContext {
  cx: number;
  cy: number;
  size: number;
  stroke: string;
  fill: string;
  strokeWidth: number;
  opacity: number;
  rotation: number;
  seed: number;
  fillMode: "filled" | "outline" | "both";
}

function rotatePoint(x: number, y: number, cx: number, cy: number, deg: number): Point {
  const rad = (deg * Math.PI) / 180;
  const dx = x - cx;
  const dy = y - cy;
  return {
    x: cx + dx * Math.cos(rad) - dy * Math.sin(rad),
    y: cy + dx * Math.sin(rad) + dy * Math.cos(rad),
  };
}

function attrs(ctx: PrimitiveContext): Record<string, string | number> {
  const a: Record<string, string | number> = {
    opacity: ctx.opacity,
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
  };
  if (ctx.fillMode !== "outline") a.fill = ctx.fill;
  else a.fill = "none";
  if (ctx.fillMode !== "filled") {
    a.stroke = ctx.stroke;
    a["stroke-width"] = ctx.strokeWidth;
  }
  return a;
}

export function renderCircle(ctx: PrimitiveContext): string {
  return circle(ctx.cx, ctx.cy, ctx.size * 0.38, attrs(ctx));
}

export function renderRing(ctx: PrimitiveContext): string {
  const r = ctx.size * 0.36;
  return circle(ctx.cx, ctx.cy, r, {
    ...attrs({ ...ctx, fillMode: "outline" }),
    fill: "none",
    stroke: ctx.stroke,
    "stroke-width": ctx.strokeWidth,
  });
}

export function renderArc(ctx: PrimitiveContext): string {
  const r = ctx.size * 0.34;
  const start = rotatePoint(ctx.cx - r, ctx.cy, ctx.cx, ctx.cy, ctx.rotation);
  const end = rotatePoint(ctx.cx + r, ctx.cy, ctx.cx, ctx.cy, ctx.rotation + 28);
  const d = `M ${fmt(start.x)} ${fmt(start.y)} A ${fmt(r)} ${fmt(r)} 0 1 1 ${fmt(end.x)} ${fmt(end.y)}`;
  return path(d, { ...attrs({ ...ctx, fillMode: "outline" }), fill: "none", stroke: ctx.stroke, "stroke-width": ctx.strokeWidth });
}

export function renderHalfCircle(ctx: PrimitiveContext): string {
  const r = ctx.size * 0.34;
  const d = `M ${fmt(ctx.cx - r)} ${fmt(ctx.cy)} A ${fmt(r)} ${fmt(r)} 0 0 1 ${fmt(ctx.cx + r)} ${fmt(ctx.cy)} Z`;
  return path(d, attrs(ctx));
}

export function renderBrokenCircle(ctx: PrimitiveContext): string {
  const r = ctx.size * 0.34;
  const gap = 24 + seeded(ctx.seed, 3) * 18;
  const a1 = ctx.rotation;
  const a2 = a1 + 120 - gap;
  const a3 = a1 + 240 + gap;
  const seg = (start: number, sweep: number) => {
    const s = rotatePoint(ctx.cx + r, ctx.cy, ctx.cx, ctx.cy, start);
    const e = rotatePoint(ctx.cx + r, ctx.cy, ctx.cx, ctx.cy, start + sweep);
    return `M ${fmt(s.x)} ${fmt(s.y)} A ${fmt(r)} ${fmt(r)} 0 0 1 ${fmt(e.x)} ${fmt(e.y)}`;
  };
  const d = [seg(a1, 80), seg(a3, 80)].join(" ");
  return path(d, { ...attrs({ ...ctx, fillMode: "outline" }), fill: "none", stroke: ctx.stroke, "stroke-width": ctx.strokeWidth });
}

export function renderParallelLines(ctx: PrimitiveContext): string {
  const count = 3;
  const gap = ctx.size * 0.08;
  const len = ctx.size * 0.55;
  const lines: string[] = [];
  for (let i = 0; i < count; i++) {
    const offset = (i - (count - 1) / 2) * gap;
    const p1 = rotatePoint(ctx.cx - len / 2, ctx.cy + offset, ctx.cx, ctx.cy, ctx.rotation);
    const p2 = rotatePoint(ctx.cx + len / 2, ctx.cy + offset, ctx.cx, ctx.cy, ctx.rotation);
    lines.push(line(p1.x, p1.y, p2.x, p2.y, { stroke: ctx.stroke, "stroke-width": ctx.strokeWidth, opacity: ctx.opacity, "stroke-linecap": "round" }));
  }
  return lines.join("");
}

export function renderRadialLines(ctx: PrimitiveContext): string {
  const spokes = 8;
  const inner = ctx.size * 0.08;
  const outer = ctx.size * 0.38;
  const lines: string[] = [];
  for (let i = 0; i < spokes; i++) {
    const angle = ctx.rotation + (360 / spokes) * i;
    const p1 = rotatePoint(ctx.cx, ctx.cy - inner, ctx.cx, ctx.cy, angle);
    const p2 = rotatePoint(ctx.cx, ctx.cy - outer, ctx.cx, ctx.cy, angle);
    lines.push(line(p1.x, p1.y, p2.x, p2.y, { stroke: ctx.stroke, "stroke-width": ctx.strokeWidth * 0.85, opacity: ctx.opacity * 0.85, "stroke-linecap": "round" }));
  }
  return lines.join("");
}

export function renderCross(ctx: PrimitiveContext): string {
  const arm = ctx.size * 0.28;
  const h1 = rotatePoint(ctx.cx - arm, ctx.cy, ctx.cx, ctx.cy, ctx.rotation);
  const h2 = rotatePoint(ctx.cx + arm, ctx.cy, ctx.cx, ctx.cy, ctx.rotation);
  const v1 = rotatePoint(ctx.cx, ctx.cy - arm, ctx.cx, ctx.cy, ctx.rotation);
  const v2 = rotatePoint(ctx.cx, ctx.cy + arm, ctx.cx, ctx.cy, ctx.rotation);
  return [
    line(h1.x, h1.y, h2.x, h2.y, { stroke: ctx.stroke, "stroke-width": ctx.strokeWidth, opacity: ctx.opacity, "stroke-linecap": "round" }),
    line(v1.x, v1.y, v2.x, v2.y, { stroke: ctx.stroke, "stroke-width": ctx.strokeWidth, opacity: ctx.opacity, "stroke-linecap": "round" }),
  ].join("");
}

export function renderGrid(ctx: PrimitiveContext): string {
  const span = ctx.size * 0.36;
  const step = span / 3;
  const x0 = ctx.cx - span / 2;
  const y0 = ctx.cy - span / 2;
  const lines: string[] = [];
  for (let i = 0; i <= 3; i++) {
    lines.push(line(x0 + i * step, y0, x0 + i * step, y0 + span, { stroke: ctx.stroke, "stroke-width": ctx.strokeWidth * 0.7, opacity: ctx.opacity * 0.55 }));
    lines.push(line(x0, y0 + i * step, x0 + span, y0 + i * step, { stroke: ctx.stroke, "stroke-width": ctx.strokeWidth * 0.7, opacity: ctx.opacity * 0.55 }));
  }
  return lines.join("");
}

export function renderDots(ctx: PrimitiveContext): string {
  const dots: string[] = [];
  const cols = 5;
  const gap = ctx.size * 0.09;
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < cols; c++) {
      const x = ctx.cx + (c - (cols - 1) / 2) * gap;
      const y = ctx.cy + (r - 1) * gap;
      const rad = ctx.strokeWidth * 0.55;
      dots.push(circle(x, y, rad, { fill: ctx.stroke, opacity: ctx.opacity * (0.5 + seeded(ctx.seed, r * cols + c) * 0.5) }));
    }
  }
  return dots.join("");
}

export function renderOrganicBlob(ctx: PrimitiveContext): string {
  const s = ctx.size * 0.32;
  const wobble = (i: number) => range(ctx.seed, i, -0.12, 0.12) * s;
  const d = [
    `M ${fmt(ctx.cx)} ${fmt(ctx.cy - s + wobble(0))}`,
    `C ${fmt(ctx.cx + s * 0.9)} ${fmt(ctx.cy - s * 0.4)} ${fmt(ctx.cx + s * 0.7 + wobble(1))} ${fmt(ctx.cy + s * 0.5)} ${fmt(ctx.cx)} ${fmt(ctx.cy + s)}`,
    `C ${fmt(ctx.cx - s * 0.7 + wobble(2))} ${fmt(ctx.cy + s * 0.5)} ${fmt(ctx.cx - s * 0.9)} ${fmt(ctx.cy - s * 0.4)} ${fmt(ctx.cx)} ${fmt(ctx.cy - s + wobble(3))}`,
    "Z",
  ].join(" ");
  return path(d, attrs(ctx));
}

export function renderBezierCurve(ctx: PrimitiveContext): string {
  const len = ctx.size * 0.42;
  const lift = ctx.size * 0.18;
  const d = `M ${fmt(ctx.cx - len / 2)} ${fmt(ctx.cy)} Q ${fmt(ctx.cx)} ${fmt(ctx.cy - lift)} ${fmt(ctx.cx + len / 2)} ${fmt(ctx.cy)}`;
  return path(d, { ...attrs({ ...ctx, fillMode: "outline" }), fill: "none", stroke: ctx.stroke, "stroke-width": ctx.strokeWidth });
}

export function renderNoisePattern(ctx: PrimitiveContext): string {
  const dots: string[] = [];
  const count = 28;
  for (let i = 0; i < count; i++) {
    const x = ctx.cx + range(ctx.seed, i * 2, -ctx.size * 0.38, ctx.size * 0.38);
    const y = ctx.cy + range(ctx.seed, i * 2 + 1, -ctx.size * 0.38, ctx.size * 0.38);
    const r = range(ctx.seed, i + 40, 0.25, 0.9);
    dots.push(circle(x, y, r, { fill: ctx.stroke, opacity: range(ctx.seed, i + 80, 0.08, 0.35) }));
  }
  return dots.join("");
}

export function renderFrame(ctx: PrimitiveContext): string {
  const w = ctx.size * 0.62;
  const h = ctx.size * 0.78;
  const inset = ctx.strokeWidth * 2.5;
  return [
    rect(ctx.cx - w / 2, ctx.cy - h / 2, w, h, { ...attrs({ ...ctx, fillMode: "outline" }), fill: "none", stroke: ctx.stroke, "stroke-width": ctx.strokeWidth }),
    rect(ctx.cx - w / 2 + inset, ctx.cy - h / 2 + inset, w - inset * 2, h - inset * 2, { ...attrs({ ...ctx, fillMode: "outline" }), fill: "none", stroke: ctx.stroke, "stroke-width": ctx.strokeWidth * 0.6, opacity: ctx.opacity * 0.45 }),
  ].join("");
}

export function renderRectangle(ctx: PrimitiveContext): string {
  const w = ctx.size * 0.52;
  const h = ctx.size * 0.14;
  return rect(ctx.cx - w / 2, ctx.cy - h / 2, w, h, attrs(ctx));
}

export function renderRoundedRectangle(ctx: PrimitiveContext): string {
  const w = ctx.size * 0.48;
  const h = ctx.size * 0.12;
  return rect(ctx.cx - w / 2, ctx.cy - h / 2, w, h, { ...attrs(ctx), rx: DESIGN_TOKENS.radius.md });
}

export function renderDiamond(ctx: PrimitiveContext): string {
  const r = ctx.size * 0.3;
  const p1 = rotatePoint(ctx.cx, ctx.cy - r, ctx.cx, ctx.cy, ctx.rotation);
  const p2 = rotatePoint(ctx.cx + r, ctx.cy, ctx.cx, ctx.cy, ctx.rotation);
  const p3 = rotatePoint(ctx.cx, ctx.cy + r, ctx.cx, ctx.cy, ctx.rotation);
  const p4 = rotatePoint(ctx.cx - r, ctx.cy, ctx.cx, ctx.cy, ctx.rotation);
  const d = `M ${fmt(p1.x)} ${fmt(p1.y)} L ${fmt(p2.x)} ${fmt(p2.y)} L ${fmt(p3.x)} ${fmt(p3.y)} L ${fmt(p4.x)} ${fmt(p4.y)} Z`;
  return path(d, attrs(ctx));
}

export function renderStar(ctx: PrimitiveContext): string {
  const outer = ctx.size * 0.34;
  const inner = outer * 0.42;
  const points: string[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const angle = ctx.rotation - 90 + i * 36;
    const p = rotatePoint(ctx.cx, ctx.cy - r, ctx.cx, ctx.cy, angle);
    points.push(`${i === 0 ? "M" : "L"} ${fmt(p.x)} ${fmt(p.y)}`);
  }
  return path(`${points.join(" ")} Z`, attrs(ctx));
}

export function renderMinimalSymbol(ctx: PrimitiveContext): string {
  const bar = ctx.size * 0.22;
  const gap = ctx.size * 0.06;
  return [
    rect(ctx.cx - bar / 2, ctx.cy - gap - ctx.strokeWidth, bar, ctx.strokeWidth * 1.6, { fill: ctx.stroke, opacity: ctx.opacity }),
    rect(ctx.cx - ctx.strokeWidth * 0.8, ctx.cy + gap, ctx.strokeWidth * 1.6, bar * 0.55, { fill: ctx.stroke, opacity: ctx.opacity * 0.75 }),
  ].join("");
}

const RENDERERS: Record<string, (ctx: PrimitiveContext) => string> = {
  circle: renderCircle,
  ring: renderRing,
  arc: renderArc,
  "half-circle": renderHalfCircle,
  "broken-circle": renderBrokenCircle,
  "parallel-lines": renderParallelLines,
  "radial-lines": renderRadialLines,
  cross: renderCross,
  grid: renderGrid,
  dots: renderDots,
  "organic-blob": renderOrganicBlob,
  "bezier-curve": renderBezierCurve,
  "noise-pattern": renderNoisePattern,
  frame: renderFrame,
  rectangle: renderRectangle,
  "rounded-rectangle": renderRoundedRectangle,
  diamond: renderDiamond,
  star: renderStar,
  "minimal-symbol": renderMinimalSymbol,
};

export function renderPrimitive(kind: string, ctx: PrimitiveContext): string {
  const fn = RENDERERS[kind] ?? renderRing;
  return fn(ctx);
}

export function applyPrintEffects(
  content: string,
  effects: PrintEffect[],
  id: string,
  colors: { stroke: string; fill: string },
  seed: number,
  bounds: { cx: number; cy: number; size: number },
): { defs: string; content: string } {
  let defs = "";
  let wrapped = content;
  const has = (e: PrintEffect) => effects.includes(e);

  if (has("halftone")) {
    const pid = `${id}-halftone`;
    defs += `<pattern id="${pid}" width="6" height="6" patternUnits="userSpaceOnUse"><circle cx="1.5" cy="1.5" r="0.8" fill="${colors.stroke}" opacity="0.35"/></pattern>`;
    wrapped = group(`${id}-halftone-layer`, rect(bounds.cx - bounds.size / 2, bounds.cy - bounds.size / 2, bounds.size, bounds.size, { fill: `url(#${pid})`, opacity: 0.22 }));
  }

  if (has("grain") || has("texture-mask")) {
    const grain = renderNoisePattern({
      cx: bounds.cx,
      cy: bounds.cy,
      size: bounds.size,
      stroke: colors.stroke,
      fill: "none",
      strokeWidth: 0.5,
      opacity: 0.18,
      rotation: 0,
      seed,
      fillMode: "outline",
    });
    wrapped += group(`${id}-grain`, grain);
  }

  if (has("faded")) {
    const gid = `${id}-fade`;
    defs += `<linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${colors.stroke}" stop-opacity="0.9"/><stop offset="100%" stop-color="${colors.stroke}" stop-opacity="0.35"/></linearGradient>`;
    wrapped = group(`${id}-faded`, wrapped, { opacity: "0.85" });
  }

  if (has("distressed")) {
    const maskId = `${id}-distress`;
    const scratches: string[] = [];
    for (let i = 0; i < 6; i++) {
      const x1 = bounds.cx + range(seed, i, -bounds.size * 0.4, bounds.size * 0.4);
      const y1 = bounds.cy + range(seed, i + 20, -bounds.size * 0.4, bounds.size * 0.4);
      scratches.push(line(x1, y1, x1 + range(seed, i + 40, -8, 8), y1 + range(seed, i + 60, -8, 8), { stroke: "#fff", "stroke-width": range(seed, i + 80, 0.4, 1.2), opacity: 0.65 }));
    }
    defs += `<mask id="${maskId}"><rect width="100%" height="100%" fill="#fff"/>${scratches.join("")}</mask>`;
    wrapped = group(`${id}-distressed`, wrapped, { mask: `url(#${maskId})` });
  }

  if (has("split-lines")) {
    const split = renderParallelLines({
      cx: bounds.cx,
      cy: bounds.cy + bounds.size * 0.22,
      size: bounds.size * 0.5,
      stroke: colors.stroke,
      fill: "none",
      strokeWidth: 0.5,
      opacity: 0.35,
      rotation: 0,
      seed,
      fillMode: "outline",
    });
    wrapped += group(`${id}-split`, split);
  }

  return { defs, content: wrapped };
}
