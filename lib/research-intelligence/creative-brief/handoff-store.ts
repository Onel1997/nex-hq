"use client";

export interface CreativeBriefHandoffPayload {
  conceptName: string;
  executiveSummary: string;
  businessCase: string;
  scores: {
    trendScore: number;
    brandFit: number;
    commercialPotential: number;
    competition: number;
    longevity: number;
    originality: number;
  };
  targetAudience: string[];
  recommendedProduct: string;
  alternativeProducts: string[];
  recommendedPlacement: string[];
  typographyDirection: string[];
  graphicDirection: string[];
  colorPalette: string[];
  materialRecommendation: string[];
  printTechnique: string[];
  productionNotes: string;
  avoid: string[];
  researchEvidence: string[];
  nextStep: string;
  anchorOpportunityTitle: string | null;
  generatedAt: string;
}

const STORAGE_KEY = "nexhq-fusion-creative-brief-handoff";

export interface FusionCreativeBriefHandoff {
  brief: CreativeBriefHandoffPayload;
  savedAt: string;
  source: "research-studio-fusion";
}

export function saveFusionCreativeBriefHandoff(
  brief: Omit<CreativeBriefHandoffPayload, "generatedAt">,
  generatedAt: string,
): void {
  const payload: FusionCreativeBriefHandoff = {
    brief: { ...brief, generatedAt },
    savedAt: new Date().toISOString(),
    source: "research-studio-fusion",
  };
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export function loadFusionCreativeBriefHandoff(): FusionCreativeBriefHandoff | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as FusionCreativeBriefHandoff;
  } catch {
    return null;
  }
}

export function clearFusionCreativeBriefHandoff(): void {
  sessionStorage.removeItem(STORAGE_KEY);
}
