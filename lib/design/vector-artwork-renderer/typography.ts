import { FORBIDDEN_ARTWORK_TEXT } from "@/lib/design/master-artwork-prompt";
import { escapeXml, group } from "@/lib/design/vector-engine/xml";
import type { TypographyBlock, TypographySpec } from "@/lib/design/fashion-design-engine/types";
import type { PanelLayout } from "@/lib/design/fashion-design-engine/types";

const BRAND_TOKEN = "MILAENE";
const MIN_LINE_GAP_MM = 3;

/** Normalize and enforce brand spelling — MILAENE must be exact. */
export function sanitizeTypographyContent(block: TypographyBlock): string {
  const content = block.content.trim();
  if (!content) return content;

  if (block.role === "micro" || block.role === "collection") {
    if (/milaene/i.test(content)) {
      return BRAND_TOKEN;
    }
  }

  if (content.toUpperCase() === BRAND_TOKEN) {
    return BRAND_TOKEN;
  }

  switch (block.textTransform) {
    case "uppercase":
      return content.toUpperCase();
    case "lowercase":
      return content.toLowerCase();
    default:
      return content;
  }
}

export function getAllowedTypographyTexts(spec: TypographySpec): string[] {
  return spec.blocks
    .map(sanitizeTypographyContent)
    .filter((text) => text.length > 0);
}

function estimateTextWidthMm(text: string, fontSizeMm: number, letterSpacingMm: number): number {
  const chars = [...text];
  if (chars.length === 0) return 0;
  const charWidth = fontSizeMm * 0.55;
  return chars.length * charWidth + Math.max(0, chars.length - 1) * letterSpacingMm;
}

function safeBounds(panel: PanelLayout) {
  const top = panel.offsetFromCollarMm + panel.safeMarginMm;
  const bottom = panel.offsetFromCollarMm + panel.boundingBoxMm.height - panel.safeMarginMm;
  const left = panel.safeMarginMm;
  const right = panel.boundingBoxMm.width - panel.safeMarginMm;
  return { top, bottom, left, right, width: right - left, height: bottom - top };
}

function centerX(panel: PanelLayout): number {
  return panel.boundingBoxMm.width / 2 + panel.offsetFromCenterMm;
}

/** Wrap at word boundaries — never random mid-word breaks. */
function wrapTextToLines(
  text: string,
  block: TypographyBlock,
  maxWidthMm: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (estimateTextWidthMm(candidate, block.fontSizeMm, block.letterSpacingMm) <= maxWidthMm) {
      current = candidate;
      continue;
    }
    if (current) lines.push(current);
    current = word;
  }
  if (current) lines.push(current);

  return lines.length > 0 ? lines : [text];
}

interface LaidOutLine {
  block: TypographyBlock;
  content: string;
  x: number;
  y: number;
}

function layoutTypographyInPanel(
  spec: TypographySpec,
  panel: PanelLayout,
): LaidOutLine[] {
  const bounds = safeBounds(panel);
  const cx = centerX(panel);
  const stack: Array<{ block: TypographyBlock; lines: string[]; height: number }> = [];

  for (const block of spec.blocks) {
    const content = sanitizeTypographyContent(block);
    if (!content) continue;

    if (block.positionMm) {
      stack.push({
        block,
        lines: [content],
        height: block.fontSizeMm * block.lineHeight,
      });
      continue;
    }

    const lines = wrapTextToLines(content, block, bounds.width * 0.92);
    const height =
      lines.length * block.fontSizeMm * block.lineHeight +
      Math.max(0, lines.length - 1) * MIN_LINE_GAP_MM;
    stack.push({ block, lines, height });
  }

  const totalHeight = stack.reduce(
    (sum, item, index) => sum + item.height + (index > 0 ? MIN_LINE_GAP_MM * 2 : 0),
    0,
  );
  let cursorY = bounds.top + Math.max(0, (bounds.height - totalHeight) / 2);
  const result: LaidOutLine[] = [];

  for (const item of stack) {
    if (item.block.positionMm) {
      result.push({
        block: item.block,
        content: item.lines[0]!,
        x: item.block.positionMm.x,
        y: item.block.positionMm.y,
      });
      continue;
    }

    const anchorX =
      item.block.alignment === "left"
        ? bounds.left
        : item.block.alignment === "right"
          ? bounds.right
          : cx;

    for (const line of item.lines) {
      result.push({
        block: item.block,
        content: line,
        x: anchorX,
        y: cursorY,
      });
      cursorY += item.block.fontSizeMm * item.block.lineHeight + MIN_LINE_GAP_MM;
    }
    cursorY += MIN_LINE_GAP_MM;
  }

  for (const line of result) {
    line.y = Math.min(bounds.bottom - line.block.fontSizeMm, Math.max(bounds.top, line.y));
    line.x = Math.min(bounds.right, Math.max(bounds.left, line.x));
  }

  return result;
}

function renderTextLine(line: LaidOutLine, panel: PanelLayout): string {
  const { block, content, x, y } = line;
  const anchor =
    block.alignment === "left" ? "start" : block.alignment === "right" ? "end" : "middle";

  const transform =
    block.rotationDeg != null && block.rotationDeg !== 0
      ? `transform="rotate(${block.rotationDeg} ${x} ${y})"`
      : "";

  const attrs = [
    `id="${escapeXml(block.id)}"`,
    `x="${x}"`,
    `y="${y}"`,
    `font-family="${escapeXml(block.fontFamily)}"`,
    `font-weight="${block.fontWeight}"`,
    `font-size="${block.fontSizeMm}mm"`,
    `letter-spacing="${block.letterSpacingMm}mm"`,
    `text-anchor="${anchor}"`,
    `fill="#ECEAE4"`,
    block.opacity < 1 ? `opacity="${block.opacity}"` : "",
    transform,
    `data-role="${block.role}"`,
    `data-vector-text="true"`,
  ]
    .filter(Boolean)
    .join(" ");

  return `<text ${attrs}>${escapeXml(content)}</text>`;
}

/**
 * Render all typography as real SVG <text> elements from TypographySpec only.
 * Centered in print safe area with professional hierarchy and spacing.
 */
export function renderTypographyBlocks(
  spec: TypographySpec,
  panel: PanelLayout,
): { markup: string; renderedTexts: string[] } {
  if (spec.renderMode !== "vector-only") {
    throw new Error("TypographySpec must use renderMode vector-only — image text is forbidden");
  }

  if (spec.blocks.length === 0) {
    throw new Error("TypographySpec contains no text blocks — cannot render vector artwork");
  }

  const laidOut = layoutTypographyInPanel(spec, panel);
  const renderedTexts: string[] = [];
  const elements: string[] = [];

  for (const line of laidOut) {
    for (const forbidden of FORBIDDEN_ARTWORK_TEXT) {
      if (line.content.toLowerCase().includes(forbidden.toLowerCase())) {
        throw new Error(
          `Typography block "${line.block.id}" contains forbidden text "${forbidden}" — use design concept copy only`,
        );
      }
    }

    elements.push(renderTextLine(line, panel));
    if (!renderedTexts.includes(line.content)) {
      renderedTexts.push(line.content);
    }
  }

  const bounds = safeBounds(panel);
  const offsetX = panel.offsetFromCenterMm;
  const offsetY = 0;

  return {
    markup: group(
      "vector-typography",
      group(
        "vector-typography-centered",
        elements.join(""),
        {
          transform: `translate(${offsetX}, ${offsetY})`,
          "data-print-safe": `${bounds.left},${bounds.top},${bounds.width},${bounds.height}`,
        },
      ),
      { "data-text-safe": "true" },
    ),
    renderedTexts,
  };
}

export function validateTypographyAgainstSpec(
  spec: TypographySpec,
  renderedTexts: string[],
): { valid: boolean; issues: import("./types").TypographyValidationIssue[] } {
  const expected = getAllowedTypographyTexts(spec);
  const issues: import("./types").TypographyValidationIssue[] = [];

  const normalizedRendered = renderedTexts.map((t) => t.trim()).filter(Boolean);
  const normalizedExpected = expected.map((t) => t.trim()).filter(Boolean);

  for (const exp of normalizedExpected) {
    const found = normalizedRendered.some(
      (got) => got === exp || exp.includes(got) || got.includes(exp),
    );
    if (!found) {
      issues.push({
        code: "missing-text",
        message: `Missing rendered text for expected block`,
        expected: exp,
      });
    }
  }

  for (const got of normalizedRendered) {
    if (/milaene/i.test(got) && got !== BRAND_TOKEN) {
      issues.push({
        code: "brand-mismatch",
        message: "Brand text must be exactly MILAENE",
        expected: BRAND_TOKEN,
        received: got,
      });
    }
  }

  for (const forbidden of FORBIDDEN_ARTWORK_TEXT) {
    for (const text of normalizedRendered) {
      if (text.toLowerCase().includes(forbidden.toLowerCase())) {
        issues.push({
          code: "forbidden-text",
          message: `Forbidden label "${forbidden}" found in rendered text`,
          received: text,
        });
      }
    }
  }

  return { valid: issues.length === 0, issues };
}
