import type { DesignStudioBrief } from "@/agents/design/studio-brief";
import type { LibraryArtworkSpec } from "@/lib/design/design-library/types";

export interface CollectionFitAssessment {
  score: number;
  roleAligned: boolean;
  narrativeCohesion: boolean;
  paletteCohesion: boolean;
  scaleCohesion: boolean;
  notes: string[];
}

const ROLE_SCALE: Record<string, number> = {
  hero: 100,
  "core essential": 82,
  statement: 88,
  supporting: 72,
  limited: 90,
  essential: 80,
};

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function roleWeight(role: string): number {
  const lower = role.toLowerCase();
  for (const [key, weight] of Object.entries(ROLE_SCALE)) {
    if (lower.includes(key)) return weight;
  }
  return 78;
}

/** Does this piece belong in the drop — not a one-off? */
export function evaluateCollectionFit(
  brief: DesignStudioBrief,
  spec: LibraryArtworkSpec,
): CollectionFitAssessment {
  const notes: string[] = [];
  let score = 55;

  const roleAligned = brief.role.length > 0;
  if (roleAligned) {
    score += 8;
    notes.push(`role "${brief.role}" gives collection hierarchy context`);
  }

  const narrativeCohesion =
    brief.visualConcept.length >= 20 &&
    brief.designDescription.length >= 30 &&
    (brief.campaignPotential?.length ?? 0) > 10;
  if (narrativeCohesion) {
    score += 14;
    notes.push("visual narrative is developed enough for collection storytelling");
  } else {
    notes.push("collection narrative is thin — piece may feel isolated");
    score -= 6;
  }

  const paletteCohesion = brief.colorPalette.length >= 2;
  if (paletteCohesion) {
    score += 8;
    notes.push("defined palette supports drop cohesion");
  }

  const expectedScale = roleWeight(brief.role);
  const actualScale =
    spec.layout.id.includes("oversized") || spec.style.preferredPrintScale === "oversized"
      ? 95
      : spec.style.preferredPrintScale === "micro"
        ? 55
        : 78;
  const scaleCohesion = Math.abs(expectedScale - actualScale) <= 22;
  if (scaleCohesion) {
    score += 10;
  } else {
    notes.push("graphic scale may not match collection role expectations");
    score -= 8;
  }

  if ((brief.dnaScore ?? 0) >= 72) {
    score += 10;
    notes.push("DNA score indicates collection alignment");
  }

  if (brief.visualElements.length >= 3) {
    score += 6;
  }

  return {
    score: clamp(score),
    roleAligned,
    narrativeCohesion,
    paletteCohesion,
    scaleCohesion,
    notes,
  };
}
