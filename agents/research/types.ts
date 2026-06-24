import {
  RESEARCH_REPORT_TYPES,
  type ResearchReportType,
} from "@/brain/domains/reports";
import { z } from "zod";

export const RESEARCH_TYPES = RESEARCH_REPORT_TYPES;
export type ResearchType = ResearchReportType;

const detailedString = (min: number) => z.string().min(min);
const bulletList = (min: number, max: number) =>
  z.array(z.string().min(20)).min(min).max(max);

const intelligenceScore = z.number().min(0).max(100);

export const connectorScoresSchema = z.object({
  socialScore: intelligenceScore.optional(),
  demandScore: intelligenceScore.optional(),
  trendScore: intelligenceScore.optional(),
  confidence: intelligenceScore.optional(),
});

export type ConnectorScoresOutput = z.infer<typeof connectorScoresSchema>;

export const connectorStatusSchema = z.object({
  id: z.string(),
  label: z.string().optional(),
  mode: z.enum(["live", "simulated"]).optional(),
  socialScore: intelligenceScore.optional(),
  demandScore: intelligenceScore.optional(),
  trendScore: intelligenceScore.optional(),
  confidence: intelligenceScore.optional(),
});

export const connectorIntelligenceSchema = z.object({
  scores: connectorScoresSchema.optional(),
  connectors: z.array(connectorStatusSchema).optional(),
  mode: z.enum(["live", "simulated"]).optional(),
});

export type ConnectorIntelligenceOutput = z.infer<
  typeof connectorIntelligenceSchema
>;

const designColorSchema = z.object({
  name: z.string(),
  hex: z.string().optional(),
  role: z.string(),
});

export const designBriefSchema = z.object({
  collectionIdea: z.string().min(3),
  productSuggestions: z.array(z.string()).min(1).max(8),
  targetAudience: z.string().min(10),
  colorPalette: z.array(designColorSchema).min(2).max(8),
  styleDirection: z.string().min(20),
  silhouettes: z.array(z.string()).min(1).max(6),
  trendScore: intelligenceScore,
  competitorScore: intelligenceScore,
  socialScore: intelligenceScore.optional(),
  demandScore: intelligenceScore.optional(),
  confidence: intelligenceScore,
  rationale: z.string().min(20),
  opportunityId: z.string().optional(),
  sourceReportId: z.string().optional(),
  generatedAt: z.string().optional(),
  connectorScores: connectorScoresSchema.optional(),
  intelligenceMode: z.enum(["live", "simulated"]).optional(),
  designs: z.array(z.string()).optional(),
  priority: z.string().optional(),
});

export type ResearchDesignBriefOutput = z.infer<typeof designBriefSchema>;

const competitorProfileSchema = z.object({
  name: z.string(),
  tier: z.enum(["direct", "aspirational", "emerging", "watchlist"]),
  positioning: z.string().optional(),
  strengths: z.array(z.string()).optional(),
  weaknesses: z.array(z.string()).optional(),
  dropCadence: z.string().optional(),
});

export const competitorReportSchema = z.object({
  positioning: detailedString(80),
  targetAudience: detailedString(60),
  pricing: detailedString(60),
  productCategories: bulletList(3, 12),
  marketingStrategy: detailedString(100),
  communityStrategy: detailedString(80),
  strengths: bulletList(3, 8),
  weaknesses: bulletList(3, 8),
  brandOpportunities: bulletList(3, 8),
});

export const trendReportSchema = z.object({
  trendDescription: detailedString(120),
  whyItMatters: detailedString(80),
  adoptionLevel: z.enum(["nascent", "emerging", "mainstream", "declining"]),
  relevanceForBrand: detailedString(80),
  designImplications: bulletList(3, 8),
  contentImplications: bulletList(3, 8),
});

export const researchOutputSchema = z
  .object({
    title: z.string().min(1),
    executiveSummary: z.string().min(80),
    reportType: z.enum(RESEARCH_TYPES),
    keyFindings: bulletList(5, 12),
    opportunities: bulletList(3, 10),
    risks: bulletList(3, 8),
    recommendations: bulletList(4, 10),
    confidence: z.number().min(0).max(1),
    fullAnalysis: z.string().min(800),
    competitorReport: competitorReportSchema.optional(),
    trendReport: trendReportSchema.optional(),
    competitorIntelligence: z
      .object({
        competitors: z.array(competitorProfileSchema).min(1),
        competitiveEdge: z.string().optional(),
        marketSignals: z
          .array(
            z.object({
              signal: z.string(),
              relevance: z.enum(["high", "medium", "low"]),
            }),
          )
          .optional(),
        analysisSummary: z.string().optional(),
        recommendedActions: z.array(z.string()).optional(),
      })
      .optional(),
    marketingMemory: z
      .object({
        name: z.string(),
        objective: z.string().optional(),
        notes: z.string().optional(),
        launchSequence: z.array(z.string()).optional(),
      })
      .optional(),
    designMemory: z
      .object({
        silhouettes: z.array(z.string()).optional(),
        moodKeywords: z.array(z.string()).optional(),
        graphicTreatment: z.string().optional(),
        dropVisualDirection: z.string().optional(),
      })
      .optional(),
    /** Optional LLM echo — regenerated server-side when missing or invalid. */
    designBrief: designBriefSchema.optional(),
    /** Live connector intelligence snapshot (optional). */
    connectorIntelligence: connectorIntelligenceSchema.optional(),
    /** Alias some models use for connector intelligence. */
    intelligenceSignals: connectorIntelligenceSchema.optional(),
    connectorScores: connectorScoresSchema.optional(),
  });

export type ResearchOutput = z.infer<typeof researchOutputSchema>;
export type CompetitorReportSections = z.infer<typeof competitorReportSchema>;
export type TrendReportSections = z.infer<typeof trendReportSchema>;

const conceptText = (min: number) => z.string().min(min);

export const CREATIVE_APPROACHES = [
  "Typography Design",
  "Symbolic Illustration",
  "Abstract Graphic",
  "Minimal Back Print",
  "Photography Style",
  "Japanese Editorial",
  "Vintage Archive",
  "Luxury Minimalism",
] as const;

export type CreativeApproach = (typeof CREATIVE_APPROACHES)[number];

export const PRODUCTION_DIFFICULTY_LEVELS = ["Low", "Medium", "High"] as const;

export const CONTRAST_LEVELS = ["Low", "Medium", "High"] as const;
export const VISUAL_WEIGHTS = ["Heavy", "Balanced", "Light"] as const;
export const BALANCE_TYPES = ["Symmetrical", "Asymmetrical"] as const;

export type ContrastLevel = (typeof CONTRAST_LEVELS)[number];
export type VisualWeight = (typeof VISUAL_WEIGHTS)[number];
export type BalanceType = (typeof BALANCE_TYPES)[number];

export const colorBreakdownEntrySchema = z.object({
  color: z.string().min(2),
  usage: z.string().min(2),
});

export type ColorBreakdownEntry = z.infer<typeof colorBreakdownEntrySchema>;

export const brandDnaSchema = z.object({
  philosophy: z.array(z.string().min(2)).min(1),
  forbiddenStyles: z.array(z.string().min(2)).min(1),
  preferredSilhouettes: z.array(z.string().min(2)).min(1),
  preferredPlacements: z.array(z.string().min(2)).min(1),
  signatureElements: z.array(z.string().min(2)).min(1),
  emotionalGoals: z.array(z.string().min(2)).min(1),
  materialLanguage: z.array(z.string().min(2)).min(1),
  typographyRules: z.array(z.string().min(2)).min(1),
});

export type BrandDna = z.infer<typeof brandDnaSchema>;

export const COLLECTION_ROLES = [
  "Hero Piece",
  "Core Essential",
  "Statement Piece",
  "Supporting Piece",
  "Limited Piece",
] as const;

export const COLLECTION_TYPES = [
  "Editorial Capsule",
  "Quiet Luxury Capsule",
  "Seasonal Drop",
  "Minimal Essentials",
  "Nature Collection",
  "Symbolic Collection",
  "Limited Capsule",
] as const;

export const REPEATABILITY_SCORES = ["Low", "Medium", "High"] as const;

export const COLLECTION_ARC = [
  "Introduction",
  "Reflection",
  "Tension",
  "Resolution",
  "Closure",
] as const;

export type CollectionRole = (typeof COLLECTION_ROLES)[number];
export type CollectionType = (typeof COLLECTION_TYPES)[number];
export type RepeatabilityScore = (typeof REPEATABILITY_SCORES)[number];
export type StoryPosition = (typeof COLLECTION_ARC)[number];

export const CAMPAIGN_POTENTIAL_LEVELS = ["low", "medium", "high"] as const;
export type CampaignPotential = (typeof CAMPAIGN_POTENTIAL_LEVELS)[number];

export const heroProductSchema = z.object({
  product: z.string().min(1),
  estimatedRetailPrice: z.string().min(2),
  productionComplexity: z.enum(PRODUCTION_DIFFICULTY_LEVELS),
  commercialConfidence: z.number().min(0).max(100),
});

export type HeroProduct = z.infer<typeof heroProductSchema>;

export const launchApprovalSchema = z.object({
  approved: z.boolean(),
  emotionalImpact: z.string().min(10),
  commercialStrength: z.string().min(10),
  adPerformanceExpectations: z.string().min(10),
});

export type LaunchApproval = z.infer<typeof launchApprovalSchema>;

export const ceoAnalysisSchema = z.object({
  strongestProduct: z.string().min(1),
  weakestProduct: z.string().min(1),
  recommendedLaunchOrder: z.array(z.string().min(1)).min(1),
  productionRisk: z.string().min(10),
  commercialConfidence: z.number().min(0).max(100),
  adPotential: z.string().min(10),
  launchApproval: launchApprovalSchema.optional(),
});

export type CeoAnalysis = z.infer<typeof ceoAnalysisSchema>;

export const heroAnalysisSchema = z.object({
  heroScore: z.number().min(0).max(100),
  commercialScore: z.number().min(0).max(100),
  campaignPotential: z.enum(CAMPAIGN_POTENTIAL_LEVELS),
  whyHero: z.string().min(10),
  visualStrength: z.string().min(10),
  emotionalStrength: z.string().min(10),
  adPotential: z.string().min(10),
});

export type HeroAnalysis = z.infer<typeof heroAnalysisSchema>;

export const researchCollectionSchema = z.object({
  name: z.string().min(3),
  type: z.enum(COLLECTION_TYPES),
  story: z.string().min(20),
  mood: z.string().min(5),
  philosophy: z.string().min(10),
  heroDesignId: z.string().min(1),
  supportingDesignIds: z.array(z.string().min(1)).min(1),
  colorDirection: z.array(z.string().min(2)).min(2).max(6),
  targetAudience: z.string().min(10),
  dropStrategy: z.string().min(20),
  collectionScore: z.number().min(0).max(100),
  ceoRecommendation: z.string().min(5),
  collectionImagePrompt: conceptText(20),
  campaignTheme: z.string().min(3),
  heroProduct: heroProductSchema,
  collectionArc: z.array(z.enum(COLLECTION_ARC)).length(5).optional(),
  emotionalNarrative: z.string().min(20).optional(),
  ceoAnalysis: ceoAnalysisSchema.optional(),
  heroAnalysis: heroAnalysisSchema.optional(),
});

export type ResearchCollection = z.infer<typeof researchCollectionSchema>;

export const designConceptSchema = z.object({
  designId: z.string().min(1),
  title: conceptText(3),
  creativeApproach: z.enum(CREATIVE_APPROACHES),
  product: conceptText(1),
  color: conceptText(1),
  printArea: conceptText(1),
  styleDirection: conceptText(5),
  emotion: conceptText(2),
  targetAudience: conceptText(10),
  visualConcept: conceptText(10),
  designDescription: conceptText(10),
  symbolism: conceptText(5),
  typography: conceptText(5),
  message: conceptText(3),
  rationale: conceptText(10),
  printTechnique: conceptText(5),
  printSize: conceptText(3),
  placementDimensions: conceptText(5),
  garmentInspiration: conceptText(5),
  brandInspiration: conceptText(5),
  productionDifficulty: z.enum(PRODUCTION_DIFFICULTY_LEVELS),
  visualReferences: conceptText(10),
  exactComposition: conceptText(20),
  graphicElements: z.array(z.string().min(3)).min(1).max(12),
  elementCount: conceptText(3),
  layoutDescription: conceptText(20),
  visualHierarchy: conceptText(15),
  colorBreakdown: z.array(colorBreakdownEntrySchema).min(2).max(6),
  materialEffects: conceptText(10),
  negativeSpaceUsage: conceptText(10),
  designInstructions: z.array(z.string().min(10)).min(3).max(10),
  mockupDescription: conceptText(20),
  geometry: conceptText(5),
  dimensions: conceptText(5),
  coordinates: conceptText(5),
  rotation: conceptText(3),
  spacing: conceptText(3),
  strokeWidth: conceptText(3),
  opacity: conceptText(3),
  layerOrder: conceptText(5),
  contrastLevel: z.enum(CONTRAST_LEVELS),
  textureIntensity: conceptText(3),
  visualWeight: z.enum(VISUAL_WEIGHTS),
  balance: z.enum(BALANCE_TYPES),
  alignment: conceptText(3),
  focalPoint: conceptText(5),
  edgeTreatment: conceptText(5),
  dnaScore: z.number().min(0).max(100),
  dnaMatches: z.array(z.string().min(3)).min(1).max(8),
  dnaConflicts: z.array(z.string().min(3)).max(6),
  whyFitsMilaene: z.array(z.string().min(10)).min(2).max(8),
  collectionRole: z.enum(COLLECTION_ROLES),
  repeatabilityScore: z.enum(REPEATABILITY_SCORES),
  imagePromptCore: conceptText(20),
  supportsDesignId: z.string().optional(),
  emotionalNarrative: conceptText(10).optional(),
  emotionalKeyword: z.string().min(2).optional(),
  emotionalPositionInCollection: z.string().min(5).optional(),
  storyPosition: z.enum(COLLECTION_ARC).optional(),
  relationshipReason: conceptText(10).optional(),
  commercialScore: z.number().min(0).max(100).optional(),
  campaignPotential: z.enum(CAMPAIGN_POTENTIAL_LEVELS).optional(),
  heroScore: z.number().min(0).max(100).optional(),
});

export type DesignConcept = z.infer<typeof designConceptSchema>;

/** Lightweight design-idea output for Design Studio requests. */
export const designResearchOutputSchema = z.object({
  title: z.string().min(1),
  designs: z.array(designConceptSchema).min(5).max(8),
  collection: researchCollectionSchema,
  brandDNA: brandDnaSchema.optional(),
  products: z.array(z.string()).optional(),
  colors: z.array(z.string()).optional(),
  materials: z.array(z.string()).optional(),
  printAreas: z.array(z.string()).optional(),
  collectionIdea: z.string().optional(),
  rationale: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
  designBrief: designBriefSchema.optional(),
});

export type DesignResearchOutput = z.infer<typeof designResearchOutputSchema>;

/** LLM may return collection metadata without designs[] — parser synthesizes concepts. */
export const relationshipGraphNodeSchema = z.object({
  designId: z.string().optional(),
  id: z.string().optional(),
  title: z.string().optional(),
  name: z.string().optional(),
  role: z.string().optional(),
  collectionRole: z.string().optional(),
  supportsDesignId: z.string().optional(),
  supports: z.string().optional(),
  relationshipReason: z.string().optional(),
  emotion: z.string().optional(),
  product: z.string().optional(),
  color: z.string().optional(),
  visualConcept: z.string().optional(),
});

export type RelationshipGraphNode = z.infer<typeof relationshipGraphNodeSchema>;

export const collectionOnlyResearchInputSchema = z.object({
  title: z.string().min(1),
  collection: z.record(z.string(), z.unknown()),
  relationshipGraph: z.array(relationshipGraphNodeSchema).optional(),
  heroAnalysis: heroAnalysisSchema.optional(),
  commercialScore: z.number().min(0).max(100).optional(),
  campaignPotential: z.enum(CAMPAIGN_POTENTIAL_LEVELS).optional(),
  products: z.array(z.string()).optional(),
  colors: z.array(z.string()).optional(),
  materials: z.array(z.string()).optional(),
  printAreas: z.array(z.string()).optional(),
  collectionIdea: z.string().optional(),
  rationale: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
});

export type CollectionOnlyResearchInput = z.infer<
  typeof collectionOnlyResearchInputSchema
>;

export type ParsedResearchOutput =
  | { kind: "research"; output: ResearchOutput }
  | { kind: "design"; output: DesignResearchOutput };

export function isDesignResearchOutput(
  value: ResearchOutput | DesignResearchOutput,
): value is DesignResearchOutput {
  return "designs" in value && Array.isArray(value.designs);
}

export interface ResearchRunInput {
  request: string;
  workspaceId: string;
  workspaceName: string;
  originTaskId?: string;
}

export interface ResearchRunResult {
  reportId: string;
  reportRecordId: string;
  title: string;
  outputKind: "research" | "design";
  designs?: DesignConcept[];
  collection?: ResearchCollection;
  products?: string[];
  colors?: string[];
  materials?: string[];
  printAreas?: string[];
  rationale?: string;
  executiveSummary?: string;
  keyFindings?: string[];
  opportunities?: string[];
  risks?: string[];
  recommendations?: string[];
  confidence?: number;
  reportType?: ResearchType;
  savedDomains: string[];
  designBrief: ResearchDesignBriefOutput;
}
