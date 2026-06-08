import { z } from "zod";

export const RESEARCH_TYPES = [
  "competitor",
  "trend",
  "design",
  "pricing",
  "general",
] as const;

export type ResearchType = (typeof RESEARCH_TYPES)[number];

const competitorProfileSchema = z.object({
  name: z.string(),
  tier: z.enum(["direct", "aspirational", "emerging", "watchlist"]),
  positioning: z.string().optional(),
  strengths: z.array(z.string()).optional(),
  weaknesses: z.array(z.string()).optional(),
  dropCadence: z.string().optional(),
});

export const researchOutputSchema = z.object({
  title: z.string().min(1),
  summary: z.string().min(1),
  reportType: z.enum(RESEARCH_TYPES),
  keyFindings: z.array(z.string()).min(1).max(8),
  confidence: z.number().min(0).max(1),
  fullAnalysis: z.string().min(1),
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
});

export type ResearchOutput = z.infer<typeof researchOutputSchema>;

export interface ResearchRunInput {
  request: string;
  workspaceId: string;
  workspaceName: string;
}

export interface ResearchRunResult {
  reportId: string;
  reportRecordId: string;
  title: string;
  summary: string;
  keyFindings: string[];
  confidence: number;
  reportType: ResearchType;
  savedDomains: string[];
}
