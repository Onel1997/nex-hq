import type { ColorScheme, LayoutZones } from "@/lib/design/engine/types";
import { range } from "@/lib/design/vector-engine/hash";
import { DESIGN_TOKENS, fmt, snap } from "@/lib/design/vector-engine/tokens";
import { circle, escapeXml, group, line, path, rect } from "@/lib/design/vector-engine/xml";

export interface AssetRenderContext {
  cx: number;
  cy: number;
  scale: number;
  rotation: number;
  opacity: number;
  colors: ColorScheme;
  strokeWidth: number;
  seed: number;
  safeZone: LayoutZones["safeZone"];
}

function rotatePoint(x: number, y: number, cx: number, cy: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  const dx = x - cx;
  const dy = y - cy;
  return {
    x: cx + dx * Math.cos(rad) - dy * Math.sin(rad),
    y: cy + dx * Math.sin(rad) + dy * Math.cos(rad),
  };
}

function arcSeg(cx: number, cy: number, r: number, start: number, end: number): string {
  const s = rotatePoint(cx + r, cy, cx, cy, start);
  const e = rotatePoint(cx + r, cy, cx, cy, end);
  const sweep = end - start;
  return `M ${fmt(s.x)} ${fmt(s.y)} A ${fmt(r)} ${fmt(r)} 0 ${sweep > 180 ? 1 : 0} 1 ${fmt(e.x)} ${fmt(e.y)}`;
}

function stroke(stroke: string, sw: number, op: number) {
  return { fill: "none", stroke, "stroke-width": sw, opacity: op, "stroke-linecap": "round" as const };
}

export function renderDualInterruptedArc(ctx: AssetRenderContext): string {
  const r = ctx.scale * 0.4;
  const gap = 32;
  const rot = ctx.rotation;
  const c = ctx.colors.primary;
  const sw = ctx.strokeWidth;
  const op = ctx.opacity;
  const inner = r * 0.72;
  return [
    path(arcSeg(ctx.cx, ctx.cy, r, rot - 140 + gap / 2, rot - 40 - gap / 2), stroke(c, sw, op)),
    path(arcSeg(ctx.cx, ctx.cy, r, rot + 40 + gap / 2, rot + 140 - gap / 2), stroke(c, sw, op)),
    path(arcSeg(ctx.cx, ctx.cy, inner, rot - 135 + gap / 2, rot - 45 - gap / 2), stroke(c, sw * 0.55, op * 0.55)),
    path(arcSeg(ctx.cx, ctx.cy, inner, rot + 45 + gap / 2, rot + 135 - gap / 2), stroke(c, sw * 0.55, op * 0.55)),
  ].join("");
}

export function renderMissingCenterVoid(ctx: AssetRenderContext): string {
  const r = ctx.scale * 0.4;
  const voidR = r * 0.2;
  const bracket = r * 0.14;
  const arm = bracket * 0.55;
  const c = ctx.colors.primary;
  const sw = ctx.strokeWidth;
  const parts: string[] = [
    circle(ctx.cx, ctx.cy, voidR, { ...stroke(c, sw * 0.45, ctx.opacity * 0.65) }),
  ];
  for (const [x, y, dx, dy] of [
    [ctx.cx - bracket, ctx.cy - bracket, arm, 0],
    [ctx.cx + bracket - arm, ctx.cy - bracket, arm, 0],
    [ctx.cx - bracket, ctx.cy + bracket, 0, -arm],
    [ctx.cx + bracket - arm, ctx.cy + bracket, 0, -arm],
  ] as const) {
    parts.push(
      line(x, y, x + dx, y, stroke(c, sw * 0.5, ctx.opacity * 0.7)),
      line(x, y, x, y + dy, stroke(c, sw * 0.5, ctx.opacity * 0.7)),
    );
  }
  const tick = r * 0.08;
  for (const deg of [0, 90, 180, 270]) {
    const p1 = rotatePoint(ctx.cx, ctx.cy - voidR - tick, ctx.cx, ctx.cy, deg);
    const p2 = rotatePoint(ctx.cx, ctx.cy - voidR + tick * 0.3, ctx.cx, ctx.cy, deg);
    parts.push(line(p1.x, p1.y, p2.x, p2.y, stroke(c, sw * 0.35, ctx.opacity * 0.5)));
  }
  return parts.join("");
}

export function renderBrokenCircle(ctx: AssetRenderContext): string {
  const r = ctx.scale * 0.38;
  const gap = 28;
  const rot = ctx.rotation;
  const c = ctx.colors.primary;
  const sw = ctx.strokeWidth;
  const seg = (start: number, sweep: number) => {
    const s = rotatePoint(ctx.cx + r, ctx.cy, ctx.cx, ctx.cy, start);
    const e = rotatePoint(ctx.cx + r, ctx.cy, ctx.cx, ctx.cy, start + sweep);
    return `M ${fmt(s.x)} ${fmt(s.y)} A ${fmt(r)} ${fmt(r)} 0 0 1 ${fmt(e.x)} ${fmt(e.y)}`;
  };
  return [
    path(seg(rot, 85), stroke(c, sw, ctx.opacity)),
    path(seg(rot + 120 + gap, 85), stroke(c, sw, ctx.opacity)),
    path(seg(rot + 240 + gap, 85), stroke(c, sw * 0.7, ctx.opacity * 0.7)),
  ].join("");
}

export function renderArchitecturalFrame(ctx: AssetRenderContext): string {
  const w = ctx.scale * 0.55;
  const h = ctx.scale * 0.68;
  const inset = ctx.strokeWidth * 2.5;
  const c = ctx.colors.secondary;
  const sw = ctx.strokeWidth;
  return [
    rect(ctx.cx - w / 2, ctx.cy - h / 2, w, h, stroke(c, sw, ctx.opacity * 0.7)),
    rect(ctx.cx - w / 2 + inset, ctx.cy - h / 2 + inset, w - inset * 2, h - inset * 2, stroke(c, sw * 0.55, ctx.opacity * 0.4)),
  ].join("");
}

export function renderEditorialLines(ctx: AssetRenderContext): string {
  const widths = [0.48, 0.3, 0.58, 0.22];
  const c = ctx.colors.secondary;
  const sw = ctx.strokeWidth;
  const startY = ctx.cy + ctx.scale * 0.05;
  return widths
    .map((ratio, i) => {
      const w = ctx.scale * ratio;
      const y = startY + i * sw * 3;
      return line(ctx.cx - w / 2, y, ctx.cx + w / 2, y, stroke(c, sw * (i === 1 ? 0.35 : 0.5), 0.25 + range(ctx.seed, i, 0, 0.2)));
    })
    .join("");
}

export function renderFlankStrikes(ctx: AssetRenderContext): string {
  const r = ctx.scale * 0.4;
  const c = ctx.colors.secondary;
  const sw = ctx.strokeWidth;
  return [
    line(ctx.cx - r * 1.15, ctx.cy, ctx.cx - r * 0.6, ctx.cy, stroke(c, sw * 0.35, 0.3)),
    line(ctx.cx + r * 0.6, ctx.cy, ctx.cx + r * 1.15, ctx.cy, stroke(c, sw * 0.35, 0.3)),
  ].join("");
}

export function renderMinimalCross(ctx: AssetRenderContext): string {
  const arm = ctx.scale * 0.1;
  const c = ctx.colors.accent;
  const sw = ctx.strokeWidth;
  return [
    line(ctx.cx - arm, ctx.cy, ctx.cx + arm, ctx.cy, stroke(c, sw * 0.45, ctx.opacity * 0.55)),
    line(ctx.cx, ctx.cy - arm, ctx.cx, ctx.cy + arm, stroke(c, sw * 0.45, ctx.opacity * 0.55)),
  ].join("");
}

export function renderLuxuryDivider(ctx: AssetRenderContext): string {
  const w = ctx.scale * 0.35;
  const c = ctx.colors.secondary;
  return [
    line(ctx.cx - w / 2, ctx.cy, ctx.cx + w / 2, ctx.cy, stroke(c, ctx.strokeWidth * 0.35, 0.25)),
    circle(ctx.cx, ctx.cy, ctx.strokeWidth * 0.5, { fill: c, opacity: 0.35 }),
  ].join("");
}

export function renderCoordinateMarks(ctx: AssetRenderContext): string {
  const sz = ctx.safeZone;
  const inset = sz.width * 0.06;
  const arm = ctx.strokeWidth * 2;
  const c = ctx.colors.secondary;
  const anchors = [
    { x: sz.x + inset, y: sz.y + inset },
    { x: sz.x + sz.width - inset, y: sz.y + inset },
    { x: sz.x + inset, y: sz.y + sz.height - inset },
    { x: sz.x + sz.width - inset, y: sz.y + sz.height - inset },
  ].slice(0, 2 + (ctx.seed % 3));

  return anchors
    .map((p, i) => {
      const op = 0.3 + range(ctx.seed, i, 0, 0.15);
      return [
        line(p.x - arm, p.y, p.x + arm, p.y, stroke(c, ctx.strokeWidth * 0.4, op)),
        line(p.x, p.y - arm, p.x, p.y + arm, stroke(c, ctx.strokeWidth * 0.4, op)),
        circle(p.x, p.y, ctx.strokeWidth * 0.35, { fill: c, opacity: op }),
      ].join("");
    })
    .join("");
}

export function renderCapsuleCode(ctx: AssetRenderContext, text: string): string {
  const padX = 14;
  const w = text.length * 5.2 + padX * 2;
  const h = 22;
  const x = ctx.cx - w / 2;
  const y = ctx.cy - h / 2;
  const c = ctx.colors.secondary;
  return [
    rect(x, y, w, h, { fill: "none", stroke: c, "stroke-width": ctx.strokeWidth * 0.45, rx: h / 2, opacity: 0.5 }),
    `<text x="${fmt(ctx.cx)}" y="${fmt(ctx.cy + 3.5)}" fill="${ctx.colors.ink}" font-family="${DESIGN_TOKENS.fonts.display}" font-size="6.5" font-weight="400" letter-spacing="2.8" text-anchor="middle" opacity="0.62">${escapeXml(text)}</text>`,
  ].join("");
}

export function renderSacredGeometry(ctx: AssetRenderContext): string {
  const r = ctx.scale * 0.32;
  const c = ctx.colors.primary;
  const sw = ctx.strokeWidth;
  const parts = [circle(ctx.cx, ctx.cy, r, stroke(c, sw * 0.5, ctx.opacity * 0.5))];
  for (let i = 0; i < 6; i++) {
    const angle = ctx.rotation + i * 60;
    const p = rotatePoint(ctx.cx, ctx.cy - r, ctx.cx, ctx.cy, angle);
    parts.push(circle(p.x, p.y, r * 0.18, stroke(c, sw * 0.35, ctx.opacity * 0.35)));
  }
  return parts.join("");
}

export function renderGridSystem(ctx: AssetRenderContext): string {
  const span = ctx.scale * 0.35;
  const step = span / 4;
  const x0 = ctx.cx - span / 2;
  const y0 = ctx.cy - span / 2;
  const c = ctx.colors.secondary;
  const lines: string[] = [];
  for (let i = 0; i <= 4; i++) {
    lines.push(line(x0 + i * step, y0, x0 + i * step, y0 + span, stroke(c, ctx.strokeWidth * 0.3, 0.18)));
    lines.push(line(x0, y0 + i * step, x0 + span, y0 + i * step, stroke(c, ctx.strokeWidth * 0.3, 0.18)));
  }
  return lines.join("");
}

export function renderNoiseMask(ctx: AssetRenderContext): string {
  const dots: string[] = [];
  for (let i = 0; i < 24; i++) {
    const x = ctx.cx + range(ctx.seed, i * 2, -ctx.scale * 0.35, ctx.scale * 0.35);
    const y = ctx.cy + range(ctx.seed, i * 2 + 1, -ctx.scale * 0.35, ctx.scale * 0.35);
    dots.push(circle(x, y, range(ctx.seed, i, 0.2, 0.8), { fill: ctx.colors.primary, opacity: range(ctx.seed, i + 40, 0.06, 0.2) }));
  }
  return dots.join("");
}

export function renderHalftoneField(ctx: AssetRenderContext): string {
  const dots: string[] = [];
  const cols = 6;
  const gap = ctx.scale * 0.07;
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < cols; c++) {
      const x = ctx.cx + (c - (cols - 1) / 2) * gap;
      const y = ctx.cy + (r - 1.5) * gap;
      dots.push(circle(x, y, ctx.strokeWidth * 0.45, { fill: ctx.colors.primary, opacity: 0.12 + range(ctx.seed, r * cols + c, 0, 0.15) }));
    }
  }
  return dots.join("");
}

export function renderVintageDistress(ctx: AssetRenderContext): string {
  const scratches: string[] = [];
  for (let i = 0; i < 5; i++) {
    const x1 = ctx.cx + range(ctx.seed, i, -ctx.scale * 0.3, ctx.scale * 0.3);
    const y1 = ctx.cy + range(ctx.seed, i + 20, -ctx.scale * 0.3, ctx.scale * 0.3);
    scratches.push(line(x1, y1, x1 + range(ctx.seed, i + 40, -6, 6), y1 + range(ctx.seed, i + 60, -6, 6), stroke(ctx.colors.primary, ctx.strokeWidth * 0.3, 0.15)));
  }
  return scratches.join("");
}

export function renderTexturedFrame(ctx: AssetRenderContext): string {
  return renderArchitecturalFrame(ctx) + renderNoiseMask({ ...ctx, scale: ctx.scale * 0.9, opacity: 0.3 });
}

export function renderMinimalSymbol(ctx: AssetRenderContext): string {
  const bar = ctx.scale * 0.18;
  const gap = ctx.scale * 0.05;
  const c = ctx.colors.accent;
  return [
    rect(ctx.cx - bar / 2, ctx.cy - gap, bar, ctx.strokeWidth * 1.4, { fill: c, opacity: ctx.opacity }),
    rect(ctx.cx - ctx.strokeWidth * 0.7, ctx.cy + gap, ctx.strokeWidth * 1.4, bar * 0.5, { fill: c, opacity: ctx.opacity * 0.75 }),
  ].join("");
}

export function renderTechnicalSchematic(ctx: AssetRenderContext): string {
  const w = ctx.scale * 0.4;
  const c = ctx.colors.secondary;
  return [
    rect(ctx.cx - w / 2, ctx.cy - w / 4, w, w / 2, stroke(c, ctx.strokeWidth * 0.4, 0.35)),
    line(ctx.cx - w / 2, ctx.cy, ctx.cx + w / 2, ctx.cy, stroke(c, ctx.strokeWidth * 0.35, 0.3)),
    line(ctx.cx, ctx.cy - w / 4, ctx.cx, ctx.cy + w / 4, stroke(c, ctx.strokeWidth * 0.35, 0.3)),
    circle(ctx.cx, ctx.cy, ctx.strokeWidth * 0.6, { fill: c, opacity: 0.4 }),
  ].join("");
}

export function renderVerticalRules(ctx: AssetRenderContext): string {
  const sz = ctx.safeZone;
  const c = ctx.colors.secondary;
  const sw = ctx.strokeWidth;
  return [
    line(sz.x + sz.width * 0.11, sz.y + sz.height * 0.16, sz.x + sz.width * 0.11, sz.y + sz.height * 0.3, stroke(c, sw * 0.3, 0.2)),
    line(sz.x + sz.width * 0.89, sz.y + sz.height * 0.68, sz.x + sz.width * 0.89, sz.y + sz.height * 0.82, stroke(c, sw * 0.3, 0.2)),
  ].join("");
}

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];

export function capsuleText(seed: number): string {
  return `${ROMAN[seed % ROMAN.length]} · ${String(2020 + (seed % 6)).slice(-2)}`;
}
