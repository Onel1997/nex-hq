import { CEO_REPORT_TYPE } from "@/brain/domains/reports";
import { z } from "zod";

export const CEO_REPORT_TYPE_VALUE = CEO_REPORT_TYPE;

const detailedString = (min: number) => z.string().min(min);
const bulletList = (min: number, max: number) =>
  z.array(z.string().min(20)).min(min).max(max);

export const ceoNextStepSchema = z.object({
  action: detailedString(20),
  priority: z.enum(["high", "medium", "low"]),
  rationale: z.string().min(20).optional(),
});

export const ceoOutputSchema = z.object({
  title: z.string().min(1),
  reportType: z.literal(CEO_REPORT_TYPE),
  executiveSummary: detailedString(80),
  keyInsights: bulletList(3, 10),
  strategicOpportunities: bulletList(2, 8),
  risks: bulletList(2, 8),
  nextSteps: z.array(ceoNextStepSchema).min(3).max(10),
  confidence: z.number().min(0).max(1),
  sourceReportTitles: z.array(z.string()).min(1),
  fullBriefing: z.string().min(600),
});

export type CeoOutput = z.infer<typeof ceoOutputSchema>;
export type CeoNextStep = z.infer<typeof ceoNextStepSchema>;

export interface CeoRunInput {
  question: string;
  workspaceId: string;
  workspaceName: string;
}

export interface CeoRunResult {
  reportId: string;
  reportRecordId: string;
  title: string;
  executiveSummary: string;
  keyInsights: string[];
  strategicOpportunities: string[];
  risks: string[];
  nextSteps: CeoNextStep[];
  confidence: number;
  sourceReportTitles: string[];
  contextRecordCount: number;
}
