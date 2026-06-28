import type { DesignStudioBrief, DesignStudioColor } from "@/agents/design/studio-brief";

const ARTBOARD_W = 800;
const ARTBOARD_H = 1000;
const CM_TO_UNITS = 36;

const NAMED_COLORS: Record<string, string> = {
  black: "#111111",
  obsidian: "#111111",
  white: "#f5f5f0",
  cream: "#f0ebe3",
  ivory: "#fffff0",
  grey: "#888888",
  gray: "#888888",
  charcoal: "#2a2a2a",
  green: "#6fbf73",
  red: "#8b2635",
  gold: "#c9a962",
  navy: "#1e2a3a",
};

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function resolveHex(color: DesignStudioColor, fallback: string): string {
  const raw = color.hex?.trim();
  if (raw && /^#[0-9a-fA-F]{3,8}$/.test(raw)) return raw.toLowerCase();

  const nameKey = color.name.toLowerCase();
  for (const [key, hex] of Object.entries(NAMED_COLORS)) {
    if (nameKey.includes(key)) return hex;
  }

  return fallback;
}

function parsePrintSizeCm(dimensions: string): { width: number; height: number } {
  const numbers = dimensions.match(/(\d+(?:\.\d+)?)/g)?.map(Number) ?? [];
  if (numbers.length >= 2) {
    return {
      width: Math.max(2, numbers[0]),
      height: Math.max(2, numbers[1]),
    };
  }
  if (numbers.length === 1) {
    return { width: numbers[0], height: numbers[0] * 1.15 };
  }
  return { width: 8, height: 10 };
}

function geometryMarkup(
  geometry: string,
  cx: number,
  cy: number,
  width: number,
  height: number,
  stroke: string,
  fill: string,
): string {
  const text = geometry.toLowerCase();

  if (text.includes("circle") || text.includes("dot") || text.includes("orb")) {
    const r = Math.min(width, height) * 0.22;
    return `<circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="${r.toFixed(2)}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`;
  }

  if (text.includes("line") || text.includes("stroke") || text.includes("bar")) {
    const half = width * 0.28;
    return `<line x1="${(cx - half).toFixed(2)}" y1="${cy.toFixed(2)}" x2="${(cx + half).toFixed(2)}" y2="${cy.toFixed(2)}" stroke="${stroke}" stroke-width="3" stroke-linecap="round"/>`;
  }

  if (text.includes("arc") || text.includes("curve") || text.includes("crescent")) {
    const r = Math.min(width, height) * 0.24;
    return `<path d="M ${(cx - r).toFixed(2)} ${cy.toFixed(2)} A ${r.toFixed(2)} ${r.toFixed(2)} 0 1 1 ${(cx + r).toFixed(2)} ${cy.toFixed(2)}" fill="none" stroke="${stroke}" stroke-width="2.5" stroke-linecap="round"/>`;
  }

  if (text.includes("cross") || text.includes("plus")) {
    const arm = Math.min(width, height) * 0.18;
    return [
      `<line x1="${(cx - arm).toFixed(2)}" y1="${cy.toFixed(2)}" x2="${(cx + arm).toFixed(2)}" y2="${cy.toFixed(2)}" stroke="${stroke}" stroke-width="2.5" stroke-linecap="round"/>`,
      `<line x1="${cx.toFixed(2)}" y1="${(cy - arm).toFixed(2)}" x2="${cx.toFixed(2)}" y2="${(cy + arm).toFixed(2)}" stroke="${stroke}" stroke-width="2.5" stroke-linecap="round"/>`,
    ].join("");
  }

  const rectW = width * 0.42;
  const rectH = height * 0.16;
  return `<rect x="${(cx - rectW / 2).toFixed(2)}" y="${(cy - rectH / 2).toFixed(2)}" width="${rectW.toFixed(2)}" height="${rectH.toFixed(2)}" rx="4" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`;
}

function elementMarkup(
  label: string,
  index: number,
  printX: number,
  printY: number,
  printW: number,
  printH: number,
  color: string,
): string {
  const cols = 2;
  const row = Math.floor(index / cols);
  const col = index % cols;
  const cellW = printW / cols;
  const cellH = printH / 4;
  const x = printX + col * cellW + cellW * 0.12;
  const y = printY + printH * 0.58 + row * cellH;
  const safeLabel = escapeXml(label.slice(0, 42));

  return [
    `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${(cellW * 0.22).toFixed(2)}" height="${(cellH * 0.22).toFixed(2)}" rx="2" fill="${color}"/>`,
    `<text x="${(x + cellW * 0.3).toFixed(2)}" y="${(y + cellH * 0.16).toFixed(2)}" fill="#1a1a1a" font-family="Helvetica, Arial, sans-serif" font-size="11">${safeLabel}</text>`,
  ].join("");
}

/** Deterministic print-ready SVG from an active DesignStudioBrief. */
export function generateDesignSvg(brief: DesignStudioBrief): string {
  const printCm = parsePrintSizeCm(brief.dimensions);
  const printW = printCm.width * CM_TO_UNITS;
  const printH = printCm.height * CM_TO_UNITS;
  const printX = (ARTBOARD_W - printW) / 2;
  const printY = 170;

  const palette = brief.colorPalette.slice(0, 4);
  const primary = resolveHex(palette[0] ?? { name: brief.color, usage: "primary" }, "#111111");
  const secondary = resolveHex(
    palette[1] ?? palette[0] ?? { name: "secondary", usage: "support" },
    "#888888",
  );
  const accent = resolveHex(
    palette[2] ?? palette[1] ?? palette[0] ?? { name: "accent", usage: "accent" },
    secondary,
  );

  const centerX = printX + printW / 2;
  const centerY = printY + printH * 0.38;
  const geometry = geometryMarkup(
    brief.geometry,
    centerX,
    centerY,
    printW,
    printH,
    primary,
    accent === primary ? "none" : accent,
  );

  const elements = brief.visualElements
    .slice(0, 4)
    .map((label, index) =>
      elementMarkup(label, index, printX, printY, printW, printH, secondary),
    )
    .join("");

  const swatches = palette
    .map((entry, index) => {
      const hex = resolveHex(entry, primary);
      const x = printX + index * 56;
      const y = printY + printH + 28;
      return [
        `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="40" height="14" rx="2" fill="${hex}"/>`,
        `<text x="${x.toFixed(2)}" y="${(y + 28).toFixed(2)}" fill="#555" font-family="Helvetica, Arial, sans-serif" font-size="9">${escapeXml(entry.name)}</text>`,
      ].join("");
    })
    .join("");

  const title = escapeXml(brief.title);
  const placement = escapeXml(`${brief.placement} · ${brief.printArea}`);
  const production = escapeXml(brief.productionMethod);
  const dimensions = escapeXml(brief.dimensions);

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ARTBOARD_W} ${ARTBOARD_H}" width="${ARTBOARD_W}" height="${ARTBOARD_H}" role="img" aria-label="${title}">`,
    `<title>${title}</title>`,
    `<desc>Print-ready vector artwork for ${escapeXml(brief.product)} — ${production}</desc>`,
    `<rect width="100%" height="100%" fill="#ffffff"/>`,
    `<text x="48" y="56" fill="#111111" font-family="Helvetica, Arial, sans-serif" font-size="22" font-weight="600">${title}</text>`,
    `<text x="48" y="82" fill="#666666" font-family="Helvetica, Arial, sans-serif" font-size="12">${placement}</text>`,
    `<text x="48" y="102" fill="#666666" font-family="Helvetica, Arial, sans-serif" font-size="12">${dimensions} · ${production}</text>`,
    `<g id="print-area">`,
    `<rect x="${printX.toFixed(2)}" y="${printY.toFixed(2)}" width="${printW.toFixed(2)}" height="${printH.toFixed(2)}" fill="#fafafa" stroke="#cccccc" stroke-width="1" stroke-dasharray="6 4"/>`,
    `<text x="${printX.toFixed(2)}" y="${(printY - 8).toFixed(2)}" fill="#888888" font-family="Helvetica, Arial, sans-serif" font-size="10">Print area</text>`,
    `<g id="artwork">`,
    geometry,
    elements,
    `</g>`,
    `</g>`,
    `<g id="palette">${swatches}</g>`,
    `<text x="48" y="${(ARTBOARD_H - 36).toFixed(2)}" fill="#999999" font-family="Helvetica, Arial, sans-serif" font-size="10">${escapeXml(brief.negativeSpaceRules.slice(0, 120))}</text>`,
    `</svg>`,
  ].join("");
}
