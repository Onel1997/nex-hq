import { FORBIDDEN_ARTWORK_TEXT } from "@/lib/design/master-artwork-prompt";
import { getAllowedTypographyTexts, sanitizeTypographyContent } from "@/lib/design/vector-artwork-renderer/typography";
import type { TypographySpec } from "@/lib/design/fashion-design-engine/types";
import type { DesignQualityLayerInput } from "../types";

const BRAND_TOKEN = "MILAENE";
const MAX_VISIBLE_TEXT_BLOCKS = 5;
const MIN_VISIBLE_TEXT_BLOCKS = 1;

export interface DesignRuleViolation {
  rule: string;
  severity: "error" | "warning";
  message: string;
}

export function validateDesignRules(input: DesignQualityLayerInput): DesignRuleViolation[] {
  const violations: DesignRuleViolation[] = [];
  const { typographySpec, graphicSpec, layoutSpec } = input.engine;
  const allowedTexts = getAllowedTypographyTexts(typographySpec);

  if (typographySpec.blocks.length > MAX_VISIBLE_TEXT_BLOCKS) {
    violations.push({
      rule: "max-text-blocks",
      severity: "error",
      message: `Exceeds maximum ${MAX_VISIBLE_TEXT_BLOCKS} visible text blocks`,
    });
  }

  if (typographySpec.blocks.length < MIN_VISIBLE_TEXT_BLOCKS) {
    violations.push({
      rule: "min-text-blocks",
      severity: "error",
      message: "Composition requires at least one typography block",
    });
  }

  for (const block of typographySpec.blocks) {
    const content = sanitizeTypographyContent(block);
    if (!content) {
      violations.push({
        rule: "no-empty-text",
        severity: "error",
        message: `Typography block "${block.id}" is empty`,
      });
      continue;
    }

    if (!allowedTexts.includes(content)) {
      violations.push({
        rule: "typography-spec-only",
        severity: "error",
        message: `Text "${content}" is not from TypographySpec allowed set`,
      });
    }

    for (const forbidden of FORBIDDEN_ARTWORK_TEXT) {
      if (content.toLowerCase().includes(forbidden.toLowerCase())) {
        violations.push({
          rule: "no-fake-words",
          severity: "error",
          message: `Forbidden label "${forbidden}" in text block`,
        });
      }
    }

    if (/milaene/i.test(content) && content.toUpperCase() !== BRAND_TOKEN) {
      violations.push({
        rule: "milaene-spelling",
        severity: "error",
        message: "MILAENE spelling must be exact",
      });
    }
  }

  const graphicCount =
    graphicSpec.symbols.length +
    graphicSpec.lineSystems.length +
    graphicSpec.abstractElements.length;

  if (graphicCount < 2) {
    violations.push({
      rule: "premium-composition",
      severity: "warning",
      message: "Composition lacks graphic systems — risks plain text-only output",
    });
  }

  const heroBlocks = typographySpec.blocks.filter((b) => b.role === "hero");
  if (heroBlocks.length > 0) {
    const hero = heroBlocks[0]!;
    if (hero.letterSpacingMm < 1.5) {
      violations.push({
        rule: "premium-spacing",
        severity: "warning",
        message: "Hero tracking too tight for luxury streetwear hierarchy",
      });
    }
  }

  const ratioMatch = layoutSpec.negativeSpace.targetRatio.match(/(\d+)/);
  const negativeSpace = ratioMatch ? parseInt(ratioMatch[1]!, 10) : 50;
  if (negativeSpace < 45) {
    violations.push({
      rule: "negative-space",
      severity: "warning",
      message: "Negative space below premium threshold — risks cheap poster density",
    });
  }

  if (graphicSpec.symbols.length > 5) {
    violations.push({
      rule: "visual-balance",
      severity: "warning",
      message: "Too many symbols — composition may feel cluttered",
    });
  }

  return violations;
}

export function hasBlockingViolations(violations: DesignRuleViolation[]): boolean {
  return violations.some((v) => v.severity === "error");
}
