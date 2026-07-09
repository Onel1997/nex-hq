import type { LibraryArtworkSpec } from "@/lib/design/design-library/types";
import { evaluateHeroTypographyMatch } from "@/lib/design/design-knowledge/hero-typography";

/** Reward one unforgettable focal relationship; penalize generic editorial layouts. */
export function evaluateMemorability(spec: LibraryArtworkSpec): {
  score: number;
  notes: string[];
  penalties: string[];
} {
  const notes: string[] = [];
  const penalties: string[] = [];
  let score = 50;
  const heroMatch = evaluateHeroTypographyMatch(spec);
  const uniqueOrnaments = new Set(spec.ornaments.map((o) => o.ornamentId)).size;
  const uniqueSymbols = new Set(spec.symbols.map((s) => s.symbolId)).size;

  if (heroMatch.conceptHits.length >= 3) {
    score += 16;
    notes.push("multi-concept typography creates memorable focal");
  }
  if (heroMatch.compositionShare >= 0.55) {
    score += 12;
    notes.push("typography dominates — unforgettable focal relationship");
  }
  if (uniqueSymbols >= 2 && uniqueOrnaments >= 3) {
    score += 10;
  }
  if (spec.typography.some((t) => t.variant === "cropped" || t.variant === "ghost")) {
    score += 10;
    notes.push("cropped/ghost type is memorable in feed");
  }
  if (spec.layout.balance === "asymmetric") {
    score += 8;
  }

  const genericEditorial =
    spec.template.id === "editorial-poster" &&
    spec.layout.balance === "symmetric" &&
    heroMatch.conceptHits.length < 2;
  if (genericEditorial) {
    penalties.push("generic editorial layout — not unforgettable");
    score -= 16;
  }
  if (heroMatch.penalties.some((p) => p.includes("centered") || p.includes("flat"))) {
    penalties.push("flat centered type lacks memorability");
    score -= 12;
  }

  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    notes,
    penalties,
  };
}
