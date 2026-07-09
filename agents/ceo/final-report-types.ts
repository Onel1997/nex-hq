import { CEO_FINAL_REPORT_TYPE } from "@/brain/domains/reports";
import type { SynthesisReportSnapshot } from "@/lib/reports/goal-synthesis";
import { z } from "zod";
import { ceoNextStepSchema } from "./types";

const detailedString = (min: number) => z.string().min(min);
const bulletList = (min: number, max: number) =>
  z.array(z.string().min(15)).min(min).max(max);

export const ceoFinalOutputSchema = z.object({
  title: z.string().min(1),
  reportType: z.literal(CEO_FINAL_REPORT_TYPE),
  executiveSummary: detailedString(120),
  keyFindings: bulletList(3, 12),
  opportunities: bulletList(2, 10),
  risks: bulletList(2, 10),
  recommendedActions: z.array(ceoNextStepSchema).min(3).max(12),
  launchStrategy: detailedString(80),
  nextMilestones: bulletList(2, 8),
  ceoVerdict: detailedString(60),
  confidence: z.number().min(0).max(1),
  fullBriefing: z.string().min(800),
});

export type CeoFinalOutput = z.infer<typeof ceoFinalOutputSchema>;

export interface CeoFinalReportInput {
  workspaceId: string;
  workspaceName: string;
  parentGoalTaskId: string;
  founderGoal: string;
  childTaskIds: string[];
  researchReports: SynthesisReportSnapshot[];
  designReports: SynthesisReportSnapshot[];
  marketingReports: SynthesisReportSnapshot[];
}

export interface CeoFinalReportResult {
  reportId: string;
  reportRecordId: string;
  title: string;
  executiveSummary: string;
  completionScore: number;
  parentGoalTaskId: string;
}
