import type { DesignStudioBrief } from "@/agents/design/studio-brief";
import type { DesignConcept } from "@/lib/design/ai-designer/types";
import type { FashionDesignEngineResult } from "@/lib/design/fashion-design-engine/types";

export const FASHION_KNOWLEDGE_VERSION = "1.0.0";
export const COMMERCIAL_EXPORT_THRESHOLD = 90;
export const MAX_CREATIVE_ITERATIONS = 20;

export type GarmentType =
  | "oversized-tee"
  | "hoodie"
  | "crewneck"
  | "long-sleeve"
  | "tank"
  | "any";

export type PrintArea =
  | "front"
  | "back"
  | "spine-back"
  | "left-chest"
  | "upper-back"
  | "sleeve";

export type LayoutSystemId =
  | "spine-layout"
  | "editorial-layout"
  | "oversized-center"
  | "corner-composition"
  | "luxury-badge"
  | "bottom-label"
  | "top-heavy"
  | "diagonal-composition"
  | "negative-space-layout"
  | "split-composition"
  | "grid-composition"
  | "floating-composition";

export type GraphicSystemId =
  | "line-systems"
  | "boundary-systems"
  | "abstract-geometry"
  | "editorial-grids"
  | "technical-markings"
  | "premium-labels"
  | "registration-marks"
  | "coordinate-systems"
  | "minimal-symbols"
  | "grain-systems"
  | "distressed-systems";

export type TypographyKnowledgeId =
  | "hierarchy"
  | "spacing"
  | "tracking"
  | "kerning"
  | "oversized-typography"
  | "editorial-typography"
  | "luxury-typography"
  | "minimal-typography"
  | "print-typography";

export interface KnowledgeRule {
  id: string;
  title: string;
  principle: string;
  whenToUse: string;
  whenNotToUse: string;
  signals: string[];
  antiPatterns: string[];
}

export interface LayoutSystemKnowledge extends KnowledgeRule {
  id: LayoutSystemId;
  placementRules: string[];
  spacingRules: string[];
  visualBalance: string;
  recommendedGarments: GarmentType[];
  commercialUseCase: string;
  negativeSpaceTarget: string;
}

export interface GraphicSystemKnowledge extends KnowledgeRule {
  id: GraphicSystemId;
  whyItWorks: string;
}

export interface TypographyKnowledge extends KnowledgeRule {
  id: TypographyKnowledgeId;
  luxuryWeight: number;
  garmentScaleNotes: string;
}

export interface FashionPsychologyPrinciple extends KnowledgeRule {
  emotionalLever: string;
  designApplication: string;
}

export interface CommercialFashionRule extends KnowledgeRule {
  buyerQuestion: string;
  passCriteria: string;
  failCriteria: string;
}

export type PatternDifficulty = "beginner" | "intermediate" | "advanced" | "expert";

export interface DesignPatternTemplate {
  id: string;
  name: string;
  description: string;
  layoutSystemId: LayoutSystemId;
  typographyHierarchy: string[];
  graphicBalance: string;
  negativeSpace: string;
  recommendedPrintSizeMm: { width: number; height: number };
  garmentCompatibility: GarmentType[];
  printAreas: PrintArea[];
  difficulty: PatternDifficulty;
  commercialScore: number;
  graphicSystems: GraphicSystemId[];
  tags: string[];
}

export interface CreativeThinkingVerdict {
  beautiful: boolean;
  wearable: boolean;
  premium: boolean;
  fitsMilaene: boolean;
  worthPremiumPrice: boolean;
  passed: boolean;
  reasoning: string[];
}

export interface CommercialDesignRanking {
  typography: number;
  composition: number;
  fashion: number;
  originality: number;
  luxury: number;
  printability: number;
  commercial: number;
  brandDna: number;
  overall: number;
  exportApproved: boolean;
  explanations: string[];
}

export interface FashionKnowledgeQuery {
  brief: DesignStudioBrief;
  concept: DesignConcept;
  seed: number;
  designDirection?: string;
}

export interface FashionKnowledgeDecision {
  layoutSystem: LayoutSystemKnowledge;
  pattern: DesignPatternTemplate;
  typographyPrinciples: TypographyKnowledge[];
  graphicSystems: GraphicSystemKnowledge[];
  psychology: FashionPsychologyPrinciple[];
  commercialRules: CommercialFashionRule[];
  creativeBrief: string[];
  antiPatterns: string[];
}

export interface FashionKnowledgePipelineInput {
  brief: DesignStudioBrief;
  concept: DesignConcept;
  engine: FashionDesignEngineResult;
  designDirection?: string;
  maxIterations?: number;
}

export interface FashionKnowledgeCandidate {
  iteration: number;
  seed: number;
  pattern: DesignPatternTemplate;
  engine: FashionDesignEngineResult;
  creativeVerdict: CreativeThinkingVerdict;
  ranking: CommercialDesignRanking;
}

export interface FashionKnowledgePipelineResult {
  engine: FashionDesignEngineResult;
  decision: FashionKnowledgeDecision;
  creativeVerdict: CreativeThinkingVerdict;
  ranking: CommercialDesignRanking;
  candidatesEvaluated: number;
  exportApproved: boolean;
  selectedPattern: DesignPatternTemplate;
}
