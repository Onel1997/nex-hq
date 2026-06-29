import { fmt } from "@/lib/design/vector-engine/tokens";
import { circle, line, path, rect } from "@/lib/design/vector-engine/xml";
import type {
  DesignStyleId,
} from "@/lib/design/design-library/types";
import type { PremiumTemplateId } from "@/lib/design/design-library/templates/premium/types";
import type { ApparelPlacement } from "@/lib/design/design-library/templates/premium/types";
import type {
  SvgAssetDefinition,
  SvgAssetFamily,
  SvgAssetRenderContext,
  SvgAssetRenderMode,
  SvgPrintMethod,
} from "@/lib/design/svg-assets/types";

export function stroke(c: string, sw: number, op: number) {
  return {
    fill: "none" as const,
    stroke: c,
    "stroke-width": sw,
    opacity: op,
    "stroke-linecap": "round" as const,
    "stroke-linejoin": "round" as const,
  };
}

export function fill(c: string, op: number) {
  return { fill: c, opacity: op };
}

export function rotatePoint(x: number, y: number, cx: number, cy: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  const dx = x - cx;
  const dy = y - cy;
  return {
    x: cx + dx * Math.cos(rad) - dy * Math.sin(rad),
    y: cy + dx * Math.sin(rad) + dy * Math.cos(rad),
  };
}

export function arcSeg(cx: number, cy: number, r: number, start: number, end: number): string {
  const s = rotatePoint(cx + r, cy, cx, cy, start);
  const e = rotatePoint(cx + r, cy, cx, cy, end);
  const sweep = end - start;
  return `M ${fmt(s.x)} ${fmt(s.y)} A ${fmt(r)} ${fmt(r)} 0 ${sweep > 180 ? 1 : 0} 1 ${fmt(e.x)} ${fmt(e.y)}`;
}

export function brokenArc(
  ctx: SvgAssetRenderContext,
  r: number,
  segments: Array<{ start: number; sweep: number }>,
  swMul = 1,
  opMul = 1,
): string {
  const c = ctx.color;
  const sw = ctx.strokeWidth * swMul;
  const op = ctx.opacity * opMul;
  const rot = ctx.rotation;
  return segments
    .map((seg) => path(arcSeg(ctx.cx, ctx.cy, r, rot + seg.start, rot + seg.start + seg.sweep), stroke(c, sw, op)))
    .join("");
}

export function tickCross(ctx: SvgAssetRenderContext, arm: number, swMul = 0.45): string {
  const s = stroke(ctx.accentColor, ctx.strokeWidth * swMul, ctx.opacity);
  return [
    line(ctx.cx - arm, ctx.cy, ctx.cx + arm, ctx.cy, s),
    line(ctx.cx, ctx.cy - arm, ctx.cx, ctx.cy + arm, s),
  ].join("");
}

export interface AssetSeedConfig {
  styleTags: string[];
  recommendedStyles: DesignStyleId[];
  recommendedTemplates: PremiumTemplateId[];
  recommendedPlacements: ApparelPlacement[];
  complexity: number;
  visualWeight: number;
  printMethods: SvgPrintMethod[];
  renderMode: SvgAssetRenderMode;
  variants: string[];
  qualityScore: number;
}

export function createAsset(
  family: SvgAssetFamily,
  slug: string,
  name: string,
  config: AssetSeedConfig,
  renderFn: (ctx: SvgAssetRenderContext) => string,
): SvgAssetDefinition {
  return {
    id: `${family}-${slug}`,
    family,
    name,
    ...config,
    render: renderFn,
  };
}

export function localGrid(
  ctx: SvgAssetRenderContext,
  cols: number,
  rows: number,
  spread: number,
  opMul = 0.35,
): string {
  const w = ctx.scale * spread;
  const h = ctx.scale * spread * 0.7;
  const x0 = ctx.cx - w / 2;
  const y0 = ctx.cy - h / 2;
  const parts: string[] = [];
  const s = stroke(ctx.secondaryColor, ctx.strokeWidth * 0.28, ctx.opacity * opMul);
  for (let c = 0; c <= cols; c++) {
    const x = x0 + (w / cols) * c;
    parts.push(line(x, y0, x, y0 + h, s));
  }
  for (let r = 0; r <= rows; r++) {
    const y = y0 + (h / rows) * r;
    parts.push(line(x0, y, x0 + w, y, s));
  }
  return parts.join("");
}

export function cornerBracket(
  x: number,
  y: number,
  arm: number,
  flipX: number,
  flipY: number,
  c: string,
  sw: number,
  op: number,
): string {
  const hx = arm * flipX;
  const hy = arm * flipY;
  const s = stroke(c, sw, op);
  return [line(x, y, x + hx, y, s), line(x, y, x, y + hy, s)].join("");
}

export function capsuleOutline(ctx: SvgAssetRenderContext, w: number, h: number, swMul = 0.4): string {
  const rx = h / 2;
  const x = ctx.cx - w / 2;
  const y = ctx.cy - h / 2;
  return rect(x, y, w, h, {
    ...stroke(ctx.color, ctx.strokeWidth * swMul, ctx.opacity),
    rx,
    ry: rx,
  });
}
