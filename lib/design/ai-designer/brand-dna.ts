import type { DesignStudioBrief } from "@/agents/design/studio-brief";
import type { CreativeDirectorDecision } from "@/lib/design/design-knowledge/art-direction/creative-director";

export interface BrandDnaProfile {
  philosophy: string[];
  signatureElements: string[];
  forbiddenPatterns: string[];
  paletteGuidance: string[];
  silhouetteGuidance: string[];
  emotionalGoals: string[];
  score: number;
}

const MILAENE_PHILOSOPHY = [
  "calm luxury streetwear",
  "editorial restraint over loud branding",
  "negative space as a luxury signal",
  "garment-scale artwork, not logo marks",
];

const MILAENE_SIGNATURE = [
  "obsidian / stone / off-white palette",
  "oversized silhouettes",
  "micro editorial metadata",
  "cropped hero typography",
  "architectural symbol systems",
];

const MILAENE_FORBIDDEN = [
  "neon color bursts",
  "fast-fashion trend graphics",
  "centered merch-label typography",
  "competing hero elements",
  "blueprint wireframe aesthetics",
];

/** Build brand DNA profile from brief and creative director context. */
export function buildBrandDnaProfile(
  brief: DesignStudioBrief,
  creativeDirector: CreativeDirectorDecision,
): BrandDnaProfile {
  const signals: string[] = [];
  let score = 55;

  const corpus = `${brief.visualConcept} ${brief.designDescription} ${brief.negativeSpaceRules}`.toLowerCase();

  for (const el of MILAENE_SIGNATURE) {
    if (corpus.includes(el.split(" ")[0]!)) signals.push(el);
  }

  if (brief.dnaScore !== undefined) {
    score += brief.dnaScore * 0.25;
  }
  if (creativeDirector.artDirection.feelsLuxury) {
    score += 12;
    signals.push("creative direction reads luxury");
  }
  if (creativeDirector.collection.tags.some((t) => corpus.includes(t))) {
    score += 10;
  }
  if (brief.colorPalette.length >= 2) {
    score += 8;
  }

  const paletteGuidance = brief.colorPalette.map(
    (c) => `${c.name}${c.hex ? ` (${c.hex})` : ""} — ${c.usage}`,
  );

  return {
    philosophy: MILAENE_PHILOSOPHY,
    signatureElements: [...MILAENE_SIGNATURE, ...signals.slice(0, 3)],
    forbiddenPatterns: MILAENE_FORBIDDEN,
    paletteGuidance,
    silhouetteGuidance: [
      brief.product,
      "oversized premium fleece / combed cotton",
      "vintage washed hand feel where specified",
    ],
    emotionalGoals: [
      creativeDirector.collection.name,
      brief.visualConcept.split(".")[0] ?? brief.visualConcept,
    ],
    score: Math.max(0, Math.min(100, Math.round(score))),
  };
}
