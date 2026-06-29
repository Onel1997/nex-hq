import type { DesignStudioBrief } from "@/agents/design/studio-brief";
import type { LibraryArtworkSpec } from "@/lib/design/design-library/types";

export interface StreetwearAssessment {
  score: number;
  oversizedGraphicRead: boolean;
  editorialTypeRead: boolean;
  logoMarkRisk: boolean;
  belongsOnOversizedTee: boolean;
  notes: string[];
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

const LOGO_MARK_TEMPLATES = new Set(["luxury-wordmark", "minimal-emblem", "micro-graphic"]);

/** Premium streetwear viability — not logo merch. */
export function evaluateStreetwearAppeal(
  brief: DesignStudioBrief,
  spec: LibraryArtworkSpec,
): StreetwearAssessment {
  const notes: string[] = [];
  let score = 50;

  const oversizedProduct = brief.product.toLowerCase().includes("oversized");
  const oversizedLayout =
    spec.layout.id.includes("oversized") ||
    spec.layout.id === "gallery-layout" ||
    spec.layout.id === "editorial-layout";
  const oversizedGraphicRead = oversizedProduct || oversizedLayout || brief.printArea.toLowerCase().includes("oversized");

  if (oversizedGraphicRead) {
    score += 16;
    notes.push("scale reads as oversized streetwear graphic");
  }

  const typeLayers = spec.typography.filter((t) => t.layer === "typography").length;
  const editorialTypeRead = typeLayers >= 2 || spec.template.id.includes("editorial") || spec.template.id.includes("oversized");
  if (editorialTypeRead) {
    score += 14;
    notes.push("typography carries editorial streetwear energy");
  } else {
    notes.push("typography may read as basic merch label");
    score -= 10;
  }

  const logoMarkRisk = LOGO_MARK_TEMPLATES.has(spec.template.id);
  if (logoMarkRisk) {
    score -= 18;
    notes.push("logo-mark template risks basic merch, not fashion graphic");
  }

  if (spec.style.id.includes("street") || spec.style.id.includes("editorial") || spec.style.id.includes("vintage")) {
    score += 8;
  }

  if (brief.role.toLowerCase().includes("hero")) {
    score += 6;
  }

  const belongsOnOversizedTee =
    oversizedGraphicRead && !logoMarkRisk && score >= 68 && editorialTypeRead;

  return {
    score: clamp(score),
    oversizedGraphicRead,
    editorialTypeRead,
    logoMarkRisk,
    belongsOnOversizedTee,
    notes,
  };
}
