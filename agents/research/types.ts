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

/** Lightweight design-idea output for Design Studio requests. */
export const designResearchOutputSchema = z.object({
  title: z.string().min(1),
  designs: z.array(z.string().min(5)).min(1).max(12),
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
  designs?: string[];
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
