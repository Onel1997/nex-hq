import type { TypographyPlacement } from "@/lib/design/design-library/types";
import { fmt } from "@/lib/design/vector-engine/tokens";
import { escapeXml } from "@/lib/design/vector-engine/xml";

function letterSpacingPx(size: number, tracking: number): number {
  return size * tracking;
}

function buildClipDefs(placements: TypographyPlacement[]): string {
  const clips: string[] = [];
  for (const el of placements) {
    if (!el.clipPathId || !el.clipRect) continue;
    const { x, y, width, height } = el.clipRect;
    clips.push(
      `<clipPath id="${el.clipPathId}"><rect x="${fmt(x)}" y="${fmt(y)}" width="${fmt(width)}" height="${fmt(height)}"/></clipPath>`,
    );
  }
  return clips.join("");
}

function buildMaskDefs(placements: TypographyPlacement[]): string {
  const masks: string[] = [];
  for (const el of placements) {
    if (!el.maskId || !el.maskCircle) continue;
    const { cx, cy, r } = el.maskCircle;
    masks.push(
      `<mask id="${el.maskId}"><rect width="100%" height="100%" fill="white"/><circle cx="${fmt(cx)}" cy="${fmt(cy)}" r="${fmt(r)}" fill="black"/></mask>`,
    );
  }
  return masks.join("");
}

function renderTextElement(
  el: TypographyPlacement,
  ink: string,
  fontFamily: string,
): string {
  const ls = letterSpacingPx(el.size, el.tracking).toFixed(2);
  const anchor = el.align === "middle" ? "middle" : el.align === "end" ? "end" : "start";
  const transform = el.rotation !== 0 ? ` transform="rotate(${el.rotation} ${el.x} ${el.y})"` : "";
  const clip = el.clipPathId ? ` clip-path="url(#${el.clipPathId})"` : "";
  const mask = el.maskId ? ` mask="url(#${el.maskId})"` : "";
  const textLength = el.textLength ? ` textLength="${fmt(el.textLength)}" lengthAdjust="spacingAndGlyphs"` : "";
  const fill =
    el.variant === "ghost" ? ink : ink;

  return `<text x="${el.x}" y="${el.y}" fill="${fill}" font-family="${fontFamily}" font-size="${el.size}" font-weight="${el.weight}" letter-spacing="${ls}" text-anchor="${anchor}" opacity="${el.opacity}" dominant-baseline="alphabetic"${transform}${clip}${mask}${textLength}>${escapeXml(el.text.toUpperCase())}</text>`;
}

export function renderTypographySvg(
  placements: TypographyPlacement[],
  ink: string,
  fontFamily: string,
): { svg: string; groupCount: number; defs: string } {
  const sorted = [...placements].sort((a, b) => (a.zOrder ?? 10) - (b.zOrder ?? 10));
  const defs: string[] = [];
  const groups: string[] = [];

  defs.push(buildClipDefs(sorted));
  defs.push(buildMaskDefs(sorted));

  for (const el of sorted) {
    const ls = letterSpacingPx(el.size, el.tracking).toFixed(2);
    const anchor = el.align === "middle" ? "middle" : el.align === "end" ? "end" : "start";

    if (el.curved && el.curveRadius) {
      const pathId = `premium-curve-${el.id}`;
      const pathD = `M ${el.x - el.curveRadius} ${el.y} A ${el.curveRadius} ${el.curveRadius} 0 0 1 ${el.x + el.curveRadius} ${el.y}`;
      defs.push(`<path id="${pathId}" d="${pathD}"/>`);
      groups.push(
        `<g id="${el.id}"><text fill="${ink}" font-family="${fontFamily}" font-size="${el.size}" font-weight="${el.weight}" letter-spacing="${ls}" opacity="${el.opacity}"><textPath href="#${pathId}" startOffset="50%" text-anchor="middle">${escapeXml(el.text.toUpperCase())}</textPath></text></g>`,
      );
      continue;
    }

    if (el.role === "vertical-text") {
      const chars = el.text.toUpperCase().split("");
      const dy = el.size * el.lineHeight;
      const tspans = chars
        .map((ch, i) => `<tspan x="${el.x}" dy="${i === 0 ? 0 : dy}">${escapeXml(ch)}</tspan>`)
        .join("");
      const transform = el.rotation !== 0 ? ` transform="rotate(${el.rotation} ${el.x} ${el.y})"` : "";
      groups.push(
        `<g id="${el.id}"><text fill="${ink}" font-family="${fontFamily}" font-size="${el.size}" font-weight="${el.weight}" letter-spacing="${ls}" opacity="${el.opacity}"${transform}>${tspans}</text></g>`,
      );
      continue;
    }

    groups.push(`<g id="${el.id}">${renderTextElement(el, ink, fontFamily)}</g>`);
  }

  return {
    svg: groups.join(""),
    groupCount: groups.length,
    defs: defs.filter(Boolean).join(""),
  };
}
