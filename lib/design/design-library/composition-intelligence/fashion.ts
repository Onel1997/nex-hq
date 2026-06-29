import type { DesignStyleId } from "@/lib/design/design-library/types";

export type FashionHouse =
  | "fear-of-god"
  | "represent"
  | "rhude"
  | "gallery-dept"
  | "cole-buxton"
  | "aime-leon-dore"
  | "editorial-streetwear";

export interface FashionProfile {
  house: FashionHouse;
  luxuryBias: number;
  editorialBias: number;
  minimalism: number;
  typographyDominance: number;
  geometrySubtlety: number;
  score: number;
}

const STYLE_HOUSE: Partial<Record<DesignStyleId, FashionHouse>> = {
  "minimal-luxury": "fear-of-god",
  "silent-luxury": "cole-buxton",
  "editorial-fashion": "aime-leon-dore",
  architectural: "represent",
  faith: "gallery-dept",
  "technical-streetwear": "rhude",
  "monochrome-luxury": "fear-of-god",
  "scandinavian-minimal": "cole-buxton",
  "modern-gothic": "gallery-dept",
  "vintage-washed": "gallery-dept",
  "japanese-minimal": "aime-leon-dore",
  "swiss-typography": "represent",
};

const HOUSE_TRAITS: Record<FashionHouse, Omit<FashionProfile, "house" | "score">> = {
  "fear-of-god": { luxuryBias: 0.92, editorialBias: 0.78, minimalism: 0.85, typographyDominance: 0.72, geometrySubtlety: 0.68 },
  represent: { luxuryBias: 0.82, editorialBias: 0.88, minimalism: 0.62, typographyDominance: 0.58, geometrySubtlety: 0.75 },
  rhude: { luxuryBias: 0.75, editorialBias: 0.82, minimalism: 0.45, typographyDominance: 0.65, geometrySubtlety: 0.55 },
  "gallery-dept": { luxuryBias: 0.7, editorialBias: 0.72, minimalism: 0.38, typographyDominance: 0.55, geometrySubtlety: 0.48 },
  "cole-buxton": { luxuryBias: 0.88, editorialBias: 0.7, minimalism: 0.9, typographyDominance: 0.48, geometrySubtlety: 0.82 },
  "aime-leon-dore": { luxuryBias: 0.86, editorialBias: 0.92, minimalism: 0.72, typographyDominance: 0.78, geometrySubtlety: 0.65 },
  "editorial-streetwear": { luxuryBias: 0.8, editorialBias: 0.85, minimalism: 0.55, typographyDominance: 0.62, geometrySubtlety: 0.6 },
};

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function resolveFashionProfile(styleId: DesignStyleId, visualConcept: string): FashionProfile {
  const text = visualConcept.toLowerCase();
  let house = STYLE_HOUSE[styleId] ?? "editorial-streetwear";

  if (text.includes("gallery")) house = "gallery-dept";
  if (text.includes("represent") || text.includes("architect")) house = "represent";
  if (text.includes("rhude") || text.includes("vintage")) house = "rhude";
  if (text.includes("fear") || text.includes("minimal luxury")) house = "fear-of-god";
  if (text.includes("aime") || text.includes("leon")) house = "aime-leon-dore";

  const traits = HOUSE_TRAITS[house];
  const score = clamp(
    traits.luxuryBias * 35 +
      traits.editorialBias * 30 +
      traits.minimalism * 15 +
      traits.typographyDominance * 10 +
      traits.geometrySubtlety * 10,
  );

  return { house, ...traits, score };
}

export function fashionLuxuryScore(profile: FashionProfile): number {
  return clamp(profile.luxuryBias * 55 + profile.editorialBias * 35 + profile.minimalism * 10);
}

export function fashionEditorialScore(profile: FashionProfile): number {
  return clamp(profile.editorialBias * 60 + profile.typographyDominance * 25 + profile.geometrySubtlety * 15);
}
