/**
 * Research Creative Brief — Phase 3 deterministic design strategy document.
 * Handoff layer between Brand Intelligence and Design Studio.
 * Does not generate artwork, images, mockups, or image-model prompts.
 */

export const CREATIVE_BRIEF_VERSION = "3.0.0";
export const CREATIVE_BRIEF_NEXT_STEP = "In Design Studio öffnen";

export interface CreativeBriefScores {
  trendScore: number;
  brandFit: number;
  commercialPotential: number;
  competition: number;
  longevity: number;
  originality: number;
  confidence: number;
}

export interface ResearchCreativeBrief {
  version: typeof CREATIVE_BRIEF_VERSION;
  generatedAt: string;
  approved: boolean;
  conceptName: string;
  executiveSummary: string;
  businessCase: string;
  scores: CreativeBriefScores;
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
  nextStep: typeof CREATIVE_BRIEF_NEXT_STEP;
  anchorOpportunityId: string | null;
  anchorOpportunityTitle: string | null;
  missionStatement: string;
  designLanguage: {
    typography: string[];
    placement: string[];
    colorWorld: string[];
    graphicStyle: string[];
    symbolism: string[];
    material: string[];
    printTechnique: string[];
    guardrails: string[];
    risks: string[];
    prohibitions: string[];
    patternSummary: string;
  };
  patternSummary: string;
}

export interface CreativeBriefEngineInput {
  intelligence: import("../types/unified").UnifiedResearchIntelligence;
  reasoning: import("../types/reasoning").ResearchReasoningIntelligence;
  brandIntelligence: import("../brand-intelligence/types").BrandIntelligenceSection;
  patternIntelligence?: import("../pattern-intelligence/types").PatternIntelligenceSection | null;
  generatedAt?: string;
  userRequest?: string;
}

export interface CreativeBriefEngineResult {
  creativeBrief: ResearchCreativeBrief | null;
}
