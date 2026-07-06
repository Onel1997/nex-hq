import { FORBIDDEN_ARTWORK_TEXT } from "@/lib/design/master-artwork-prompt";
import { validatePrintArtworkSvg } from "@/lib/design/sanitize-print-artwork";
import type { TypographySpec } from "@/lib/design/fashion-design-engine/types";
import type { TypographyValidationResult, VectorArtworkValidationResult } from "./types";
import { getAllowedTypographyTexts, validateTypographyAgainstSpec } from "./typography";

function extractSvgTextContent(svg: string): string[] {
  const texts: string[] = [];
  const textTagPattern = /<text\b[^>]*>([\s\S]*?)<\/text>/gi;
  let match: RegExpExecArray | null;
  while ((match = textTagPattern.exec(svg)) !== null) {
    const raw = match[1]!
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (raw) texts.push(raw);
  }
  return texts;
}

function extractTspanContent(svg: string): string[] {
  const texts: string[] = [];
  const tspanPattern = /<tspan\b[^>]*>([\s\S]*?)<\/tspan>/gi;
  let match: RegExpExecArray | null;
  while ((match = tspanPattern.exec(svg)) !== null) {
    const raw = match[1]!.replace(/\s+/g, " ").trim();
    if (raw) texts.push(raw);
  }
  return texts;
}

/** Validate vector artwork — typography safety, no image text, no forbidden labels. */
export function validateVectorArtwork(
  svgString: string,
  typographySpec: TypographySpec,
  renderedTexts: string[],
): VectorArtworkValidationResult {
  const issues: string[] = [];

  if (!svgString.trim().startsWith("<?xml") && !svgString.trim().startsWith("<svg")) {
    issues.push("Invalid SVG document — missing root <svg> element");
  }

  const printValidation = validatePrintArtworkSvg(svgString);
  if (!printValidation.valid) {
    issues.push(printValidation.reason ?? "Print artwork SVG validation failed");
  }

  if (/<image\b/i.test(svgString)) {
    issues.push("Vector artwork must not contain <image> elements — typography must be SVG text only");
  }

  const svgTexts = [...extractSvgTextContent(svgString), ...extractTspanContent(svgString)];
  const uniqueSvgTexts = [...new Set(svgTexts)];

  if (uniqueSvgTexts.length === 0 && typographySpec.blocks.length > 0) {
    issues.push("SVG contains no <text> elements — vector typography rendering failed");
  }

  for (const text of uniqueSvgTexts) {
    for (const forbidden of FORBIDDEN_ARTWORK_TEXT) {
      if (text.toLowerCase().includes(forbidden.toLowerCase())) {
        issues.push(`Forbidden label "${forbidden}" found in SVG text`);
      }
    }
    if (/milaene/i.test(text) && text !== "MILAENE") {
      issues.push(`Brand text must be exactly MILAENE, received "${text}"`);
    }
  }

  const typoCheck = validateTypographyAgainstSpec(typographySpec, renderedTexts);
  const expectedTexts = getAllowedTypographyTexts(typographySpec);

  const typographyValidation: TypographyValidationResult = {
    valid: typoCheck.valid && issues.length === 0,
    textSafe: typoCheck.valid && !/<image\b/i.test(svgString),
    blockCount: typographySpec.blocks.length,
    renderedTexts,
    expectedTexts,
    issues: [
      ...typoCheck.issues,
      ...issues.map((message) => ({
        code: "forbidden-text" as const,
        message,
      })),
    ],
  };

  return {
    valid: typographyValidation.valid && issues.length === 0,
    typography: typographyValidation,
    issues,
  };
}
