import type { DesignStudioBrief } from "@/agents/design/studio-brief";
import type { LibraryArtworkSpec } from "@/lib/design/design-library/types";

/** Recognizability — would someone remember this design after scrolling? */
export function evaluateRecognizability(
  brief: DesignStudioBrief,
  spec: LibraryArtworkSpec,
): { score: number; notes: string[] } {
  const notes: string[] = [];
  let score = 50;
  const titleDistinct = brief.title.split(/\s+/).length >= 2;
  const hasGhost = spec.typography.some((t) => t.variant === "ghost");
  const hasCropped = spec.typography.some((t) => t.variant === "cropped" || t.clipPathId);
  const structuralSymbol = spec.symbols.some(
    (s) => !["broken-circle", "interrupted-arc", "half-circle", "orbit", "halo"].includes(s.symbolId),
  );

  if (titleDistinct) {
    score += 12;
    notes.push("distinct title aids recognition");
  }
  if (hasCropped) {
    score += 14;
    notes.push("cropped hero word is instantly recognizable");
  }
  if (hasGhost) {
    score += 10;
  }
  if (structuralSymbol) {
    score += 10;
    notes.push("structural symbol creates brand recall");
  }
  if (spec.template.id.includes("oversized") || spec.template.id.includes("editorial")) {
    score += 8;
  }
  if (spec.typography.some((t) => t.id.startsWith("hero-type-"))) {
    score += 8;
    notes.push("hero typography system aids recall");
  }

  const genericGraphic =
    spec.symbols.length <= 1 &&
    spec.typography.filter((t) => t.layer === "typography").length <= 1 &&
    !hasCropped &&
    !hasGhost;
  if (genericGraphic) {
    score -= 14;
    notes.push("generic graphic — low recognizability");
  }

  return { score: Math.max(0, Math.min(100, Math.round(score))), notes };
}
