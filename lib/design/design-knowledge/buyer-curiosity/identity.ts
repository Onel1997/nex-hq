import type { DesignStudioBrief } from "@/agents/design/studio-brief";
import type { LibraryArtworkSpec } from "@/lib/design/design-library/types";

/** Would someone say "I need this hoodie" instead of "nice graphic"? */
export function evaluateIdentityPull(
  brief: DesignStudioBrief,
  spec: LibraryArtworkSpec,
): { score: number; notes: string[] } {
  const notes: string[] = [];
  let score = 48;
  const corpus = `${brief.title} ${brief.visualConcept} ${brief.designDescription}`.toLowerCase();
  const typeLayers = spec.typography.filter((t) => t.layer === "typography").length;
  const hasStatementTitle = brief.title.split(/\s+/).length >= 2;

  if (hasStatementTitle) {
    score += 14;
    notes.push("title carries identity signal");
  }
  if (corpus.includes("between") || corpus.includes("only") || corpus.includes("intimate")) {
    score += 12;
    notes.push("intimate narrative drives identity pull");
  }
  if (typeLayers >= 2 && spec.typography.some((t) => t.variant === "ghost" || t.variant === "cropped")) {
    score += 14;
    notes.push("editorial type reads as personal statement");
  }
  if (spec.template.hierarchy === "type-first" && typeLayers >= 2) {
    score += 10;
  }
  if (spec.symbols.length >= 2 && spec.ornaments.length >= 3) {
    score += 8;
  }
  if (brief.role.toLowerCase().includes("hero") || brief.role.toLowerCase().includes("statement")) {
    score += 8;
  }

  const logoMarkRisk =
    spec.layout.id.includes("micro-chest") &&
    spec.symbols.length <= 1 &&
    typeLayers <= 1 &&
    !spec.typography.some((t) => t.variant === "ghost");
  if (logoMarkRisk) {
    score -= 14;
    notes.push("reads as nice graphic, not identity piece");
  }

  return { score: Math.max(0, Math.min(100, Math.round(score))), notes };
}
