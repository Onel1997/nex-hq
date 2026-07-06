import { FORBIDDEN_ARTWORK_TEXT } from "@/lib/design/master-artwork-prompt";
import { escapeXml, group } from "@/lib/design/vector-engine/xml";
import type { TypographyBlock, TypographySpec } from "@/lib/design/fashion-design-engine/types";
import type { PanelLayout } from "@/lib/design/fashion-design-engine/types";

const BRAND_TOKEN = "MILAENE";

/** Normalize and enforce brand spelling — MILAENE must be exact. */
export function sanitizeTypographyContent(block: TypographyBlock): string {
  let content = block.content.trim();
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

function renderTextBlock(
  block: TypographyBlock,
  x: number,
  y: number,
  panel: PanelLayout,
): string {
  const content = sanitizeTypographyContent(block);
  if (!content) {
    throw new Error(`Typography block "${block.id}" is empty — cannot render vector text`);
  }

  const anchor =
    block.alignment === "left"
      ? "start"
      : block.alignment === "right"
        ? "end"
        : "middle";

  let textX = block.positionMm?.x ?? x;
  let textY = block.positionMm?.y ?? y;

  if (!block.positionMm) {
    if (block.alignment === "left") {
      textX = panel.offsetFromCenterMm < 0
        ? panel.safeMarginMm + 10
        : panel.safeMarginMm;
    } else if (block.alignment === "right") {
      textX = panel.boundingBoxMm.width - panel.safeMarginMm;
    }
  }

  const opacity = block.opacity;
  const transform =
    block.rotationDeg != null && block.rotationDeg !== 0
      ? `transform="rotate(${block.rotationDeg} ${textX} ${textY})"`
      : "";

  const attrs = [
    `id="${escapeXml(block.id)}"`,
    `x="${textX}"`,
    `y="${textY}"`,
    `font-family="${escapeXml(block.fontFamily)}"`,
    `font-weight="${block.fontWeight}"`,
    `font-size="${block.fontSizeMm}mm"`,
    `letter-spacing="${block.letterSpacingMm}mm"`,
    `text-anchor="${anchor}"`,
    `fill="#ECEAE4"`,
    opacity < 1 ? `opacity="${opacity}"` : "",
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

  const centerX = panel.boundingBoxMm.width / 2 + panel.offsetFromCenterMm;
  let cursorY = panel.offsetFromCollarMm;
  const renderedTexts: string[] = [];
  const elements: string[] = [];

  for (const block of spec.blocks) {
    const content = sanitizeTypographyContent(block);
    if (!content) {
      throw new Error(`Typography block "${block.id}" resolved to empty content`);
    }

    for (const forbidden of FORBIDDEN_ARTWORK_TEXT) {
      if (content.toLowerCase().includes(forbidden.toLowerCase())) {
        throw new Error(
          `Typography block "${block.id}" contains forbidden text "${forbidden}" — use design concept copy only`,
        );
      }
    }

    if (!block.positionMm) {
      cursorY += block.fontSizeMm;
    }
    const blockY = block.positionMm?.y ?? cursorY;
    elements.push(renderTextBlock(block, centerX, blockY, panel));
    renderedTexts.push(content);
    if (!block.positionMm) {
      cursorY += block.fontSizeMm * (block.lineHeight - 1) + 2;
    }
  }

  return {
    markup: group("vector-typography", elements.join(""), { "data-text-safe": "true" }),
    renderedTexts,
  };
}

export function validateTypographyAgainstSpec(
  spec: TypographySpec,
  renderedTexts: string[],
): { valid: boolean; issues: import("./types").TypographyValidationIssue[] } {
  const expected = getAllowedTypographyTexts(spec);
  const issues: import("./types").TypographyValidationIssue[] = [];

  if (renderedTexts.length !== expected.length) {
    issues.push({
      code: "missing-text",
      message: `Expected ${expected.length} text blocks, rendered ${renderedTexts.length}`,
      expected: expected.join(" | "),
      received: renderedTexts.join(" | "),
    });
  }

  for (let i = 0; i < expected.length; i += 1) {
    const exp = expected[i]!;
    const got = renderedTexts[i];
    if (!got) {
      issues.push({
        code: "missing-text",
        message: `Missing rendered text for block ${i + 1}`,
        expected: exp,
      });
      continue;
    }
    if (got !== exp) {
      issues.push({
        code: "spelling-mismatch",
        message: `Text block ${i + 1} spelling mismatch`,
        expected: exp,
        received: got,
      });
    }
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
    for (const text of renderedTexts) {
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
