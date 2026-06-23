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
  trendScore: z.number().min(0).max(100),
  competitorScore: z.number().min(0).max(100),
  confidence: z.number().min(0).max(100),
  rationale: z.string().min(40),
  opportunityId: z.string().optional(),
  sourceReportId: z.string().optional(),
  generatedAt: z.string(),
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
    designBrief: designBriefSchema.optional(),
  });

export type ResearchOutput = z.infer<typeof researchOutputSchema>;
export type CompetitorReportSections = z.infer<typeof competitorReportSchema>;
export type TrendReportSections = z.infer<typeof trendReportSchema>;

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
  executiveSummary: string;
  keyFindings: string[];
  opportunities: string[];
  risks: string[];
  recommendations: string[];
  confidence: number;
  reportType: ResearchType;
  savedDomains: string[];
  designBrief: ResearchDesignBriefOutput;
}
