import type { TypographyBlock } from "@/lib/design/vector-engine/types";
import { DESIGN_TOKENS } from "@/lib/design/vector-engine/tokens";
import { escapeXml, group } from "@/lib/design/vector-engine/xml";

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];

function letterSpacingPx(size: number, tracking: number): number {
  return size * tracking;
}

function anchor(align: TypographyBlock["align"]): string {
  if (align === "middle") return "middle";
  if (align === "end") return "end";
  return "start";
}

function renderStraightText(block: TypographyBlock, color: string): string {
  const spaced = block.text.toUpperCase();
  const ls = letterSpacingPx(block.size, block.tracking);
  const anchorVal = anchor(block.align);
  const transform =
    block.rotation !== 0
      ? ` transform="rotate(${block.rotation} ${block.x} ${block.y})"`
      : "";

  return `<text x="${block.x}" y="${block.y}" fill="${color}" font-family="${DESIGN_TOKENS.fonts.display}" font-size="${block.size}" font-weight="${block.weight}" letter-spacing="${ls.toFixed(2)}" text-anchor="${anchorVal}" opacity="${block.opacity}" dominant-baseline="alphabetic"${transform}>${escapeXml(spaced)}</text>`;
}

function renderVerticalText(block: TypographyBlock, color: string): string {
  const chars = block.text.toUpperCase().split("");
  const ls = block.size * block.lineHeight;
  const lines = chars
    .map(
      (ch, i) =>
        `<tspan x="${block.x}" dy="${i === 0 ? 0 : ls}">${escapeXml(ch)}</tspan>`,
    )
    .join("");
  return `<text fill="${color}" font-family="${DESIGN_TOKENS.fonts.display}" font-size="${block.size}" font-weight="${block.weight}" letter-spacing="${letterSpacingPx(block.size, block.tracking).toFixed(2)}" opacity="${block.opacity}">${lines}</text>`;
}

function renderCurvedText(block: TypographyBlock, color: string): string {
  const radius = block.curveRadius ?? 80;
  const pathId = `type-curve-${block.role}`;
  const pathD = `M ${block.x - radius} ${block.y} A ${radius} ${radius} 0 0 1 ${block.x + radius} ${block.y}`;
  const ls = letterSpacingPx(block.size, block.tracking);
  return [
    `<defs><path id="${pathId}" d="${pathD}"/></defs>`,
    `<text fill="${color}" font-family="${DESIGN_TOKENS.fonts.display}" font-size="${block.size}" font-weight="${block.weight}" letter-spacing="${ls.toFixed(2)}" opacity="${block.opacity}">`,
    `<textPath href="#${pathId}" startOffset="50%" text-anchor="middle">${escapeXml(block.text.toUpperCase())}</textPath>`,
    `</text>`,
  ].join("");
}

export function renderTypographyBlock(block: TypographyBlock, color: string): string {
  if (block.curved) return renderCurvedText(block, color);
  if (block.role === "vertical") return renderVerticalText(block, color);
  return renderStraightText(block, color);
}

export function renderTypographyLayer(blocks: TypographyBlock[], color: string): string {
  return blocks
    .map((block) => group(`type-${block.role}`, renderTypographyBlock(block, color)))
    .join("");
}

export function toRomanNumeral(seed: number): string {
  return ROMAN[seed % ROMAN.length]!;
}

export function formatCoordinates(seed: number): string {
  const lat = (34 + (seed % 12) + (seed % 100) / 100).toFixed(2);
  const lng = (-118 - (seed % 8) - (seed % 100) / 100).toFixed(2);
  return `${lat}° N  ${Math.abs(Number(lng))}° W`;
}

export function extractHeadline(title: string): string {
  const words = title.trim().split(/\s+/);
  if (words.length <= 3) return title;
  return words.slice(0, 3).join(" ");
}

export function extractSubHeadline(title: string, role: string): string {
  const words = title.trim().split(/\s+/);
  if (words.length > 3) return words.slice(3).join(" ");
  return role.replace(/-/g, " ");
}
