import type { PremiumTemplateStats } from "@/lib/design/design-library/templates/premium/types";

export interface QualityGateResult {
  passed: boolean;
  reason?: string;
  stats: PremiumTemplateStats;
}

function countMatches(svg: string, pattern: RegExp): number {
  return (svg.match(pattern) ?? []).length;
}

export function analyzePremiumSvg(svg: string): PremiumTemplateStats {
  const elementCount =
    countMatches(svg, /<path\b/g) +
    countMatches(svg, /<line\b/g) +
    countMatches(svg, /<circle\b/g) +
    countMatches(svg, /<rect\b/g) +
    countMatches(svg, /<text\b/g) +
    countMatches(svg, /<ellipse\b/g);

  const layerCount = countMatches(svg, /<g id="/g);
  const typographyGroups = countMatches(svg, /<g id="premium-type-/g);
  const ornamentGroups =
    countMatches(svg, /<g id="premium-ornament-/g) + countMatches(svg, /<g id="premium-orn-group-/g);
  const symbolGroups =
    countMatches(svg, /<g id="premium-symbol-/g) +
    countMatches(svg, /<g id="hero-primary-symbol"/g) +
    countMatches(svg, /<g id="premium-symbol-group-/g);

  return { elementCount, layerCount, typographyGroups, ornamentGroups, symbolGroups };
}

function isPrimitivePattern(svg: string, stats: PremiumTemplateStats): string | undefined {
  const circles = countMatches(svg, /<circle\b/g);
  const rects = countMatches(svg, /<rect\b/g);
  const arcs = countMatches(svg, /<path\b[^>]*\sA\s/g);
  const texts = countMatches(svg, /<text\b/g);

  if (stats.symbolGroups < 2 && circles <= 2 && texts <= 3) {
    return "logo mark composition";
  }
  if (circles <= 1 && texts <= 2 && stats.elementCount < 20) {
    return "circle + text pattern";
  }
  if (rects <= 2 && texts <= 2 && stats.symbolGroups < 2 && stats.ornamentGroups < 2) {
    return "rectangle + text pattern";
  }
  if (arcs <= 2 && circles <= 1 && texts <= 2 && stats.ornamentGroups < 2) {
    return "arc + text pattern";
  }
  if (svg.includes('id="premium-grid-wire"') && stats.ornamentGroups < 3) {
    return "blueprint/wireframe appearance";
  }
  return undefined;
}

export function validatePremiumTemplateOutput(svg: string): QualityGateResult {
  const stats = analyzePremiumSvg(svg);

  if (stats.elementCount < 30) {
    return { passed: false, reason: `fewer than 30 SVG elements (${stats.elementCount})`, stats };
  }
  if (stats.layerCount < 6) {
    return { passed: false, reason: `fewer than 6 grouped layers (${stats.layerCount})`, stats };
  }
  if (stats.typographyGroups < 3) {
    return { passed: false, reason: `fewer than 3 typography groups (${stats.typographyGroups})`, stats };
  }
  if (stats.ornamentGroups < 2) {
    return { passed: false, reason: `fewer than 2 ornament groups (${stats.ornamentGroups})`, stats };
  }
  if (stats.symbolGroups < 2) {
    return { passed: false, reason: `fewer than 2 symbol groups (${stats.symbolGroups})`, stats };
  }

  const primitive = isPrimitivePattern(svg, stats);
  if (primitive) {
    return { passed: false, reason: primitive, stats };
  }

  return { passed: true, stats };
}
