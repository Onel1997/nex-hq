import type { LibraryArtworkSpec } from "@/lib/design/design-library/types";
import type { VisualHookPattern } from "@/lib/design/design-knowledge/buyer-curiosity/types";
import { evaluateHeroTypographyMatch } from "@/lib/design/design-knowledge/hero-typography";

function elementDensity(spec: LibraryArtworkSpec): number {
  return spec.symbols.length + spec.ornaments.length + spec.typography.length;
}

function hasDominantHeadline(spec: LibraryArtworkSpec): boolean {
  const headline = spec.typography.find(
    (t) => t.role === "headline" || t.role === "stacked-headline",
  );
  if (!headline) return false;
  const others = spec.typography.filter(
    (t) => t !== headline && t.layer === "typography" && t.size >= headline.size * 0.65,
  );
  return others.length <= 1;
}

/** Evaluate visual hook — would someone stop scrolling? */
export function evaluateVisualHook(spec: LibraryArtworkSpec): {
  score: number;
  hits: VisualHookPattern[];
  penalties: string[];
} {
  const hits: VisualHookPattern[] = [];
  const penalties: string[] = [];
  let score = 42;

  const heroMatch = evaluateHeroTypographyMatch(spec);
  const hasCropped = spec.typography.some((t) => t.variant === "cropped" || t.clipPathId);
  const hasGhost = spec.typography.some((t) => t.variant === "ghost");
  const hasOffset = spec.typography.some((t) => t.variant === "offset" || t.variant === "stretched");
  const hasOverlap = hasGhost || hasOffset || heroMatch.conceptHits.includes("typography-depth");
  const density = elementDensity(spec);
  const negSpace = spec.style.negativeSpace;
  const symmetricSafe =
    spec.layout.balance === "symmetric" &&
    !hasCropped &&
    !hasGhost &&
    spec.typography.filter((t) => t.layer === "typography").length <= 1;

  if (hasCropped || heroMatch.conceptHits.includes("cropped-typography")) {
    hits.push("cropped-hero-word");
    score += 16;
  }
  if (hasCropped || hasGhost || heroMatch.conceptHits.includes("cropped-typography")) {
    hits.push("partial-typography");
    score += 12;
  }
  if (hasOverlap) {
    hits.push("unexpected-overlap");
    score += 14;
  }
  if (hasDominantHeadline(spec) && heroMatch.compositionShare >= 0.4) {
    hits.push("dominant-focal-point");
    score += 18;
  }
  if (negSpace >= 0.35 && density <= 10) {
    hits.push("dramatic-whitespace");
    score += 12;
  }
  if (
    spec.layout.balance === "asymmetric" ||
    hasOverlap ||
    spec.ornaments.some((o) => ["flank-strikes", "vertical-rules"].includes(o.ornamentId))
  ) {
    hits.push("premium-tension");
    score += 10;
  }

  if (symmetricSafe) {
    penalties.push("large centered text — safe layout");
    score -= 18;
  }
  if (spec.typography.filter((t) => t.layer === "typography" && t.size >= 40).length >= 3) {
    penalties.push("multiple competing heroes");
    score -= 16;
  }
  if (density >= 14) {
    penalties.push("visual noise reduces scroll-stop");
    score -= 12;
  }

  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    hits,
    penalties,
  };
}
