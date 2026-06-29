import type { TypographyPlacement } from "@/lib/design/design-library/types";
import { escapeXml } from "@/lib/design/vector-engine/xml";

function letterSpacingPx(size: number, tracking: number): number {
  return size * tracking;
}

export function renderTypographySvg(
  placements: TypographyPlacement[],
  ink: string,
  fontFamily: string,
): { svg: string; groupCount: number; defs: string } {
  const defs: string[] = [];
  const groups: string[] = [];

  for (const el of placements) {
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
      groups.push(
        `<g id="${el.id}"><text fill="${ink}" font-family="${fontFamily}" font-size="${el.size}" font-weight="${el.weight}" letter-spacing="${ls}" opacity="${el.opacity}">${tspans}</text></g>`,
      );
      continue;
    }

    const transform = el.rotation !== 0 ? ` transform="rotate(${el.rotation} ${el.x} ${el.y})"` : "";
    groups.push(
      `<g id="${el.id}"><text x="${el.x}" y="${el.y}" fill="${ink}" font-family="${fontFamily}" font-size="${el.size}" font-weight="${el.weight}" letter-spacing="${ls}" text-anchor="${anchor}" opacity="${el.opacity}" dominant-baseline="alphabetic"${transform}>${escapeXml(el.text.toUpperCase())}</text></g>`,
    );
  }

  return {
    svg: groups.join(""),
    groupCount: groups.length,
    defs: defs.join(""),
  };
}
