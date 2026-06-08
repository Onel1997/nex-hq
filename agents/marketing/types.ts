import { MARKETING_REPORT_TYPE } from "@/brain/domains/reports";
import { z } from "zod";

export const MARKETING_REPORT_TYPE_VALUE = MARKETING_REPORT_TYPE;

const detailedString = (min: number) => z.string().min(min);
const ideaList = (count: number) =>
  z.array(z.string().min(20)).length(count);
const bulletList = (min: number, max: number) =>
  z.array(z.string().min(12)).min(min).max(max);

export const marketingCalendarEntrySchema = z.object({
  day: z.number().int().min(1).max(30),
  title: z.string().min(1),
  channel: z.string().min(1),
  format: z.string().min(1),
  description: detailedString(20),
});

export const marketingKpiSchema = z.object({
  metric: z.string().min(1),
  target: z.string().min(1),
  rationale: detailedString(15),
});

export const marketingBudgetItemSchema = z.object({
  category: z.string().min(1),
  allocation: z.string().min(1),
  rationale: detailedString(15),
});

export const marketingEmailPhaseSchema = z.object({
  phase: z.string().min(1),
  subject: z.string().min(1),
  objective: z.string().min(1),
  content: detailedString(30),
});

export const marketingOutputSchema = z.object({
  title: z.string().min(1),
  reportType: z.literal(MARKETING_REPORT_TYPE),
  launchStrategy: detailedString(100),
  contentPillars: bulletList(3, 8),
  tiktokIdeas: ideaList(20),
  instagramIdeas: ideaList(20),
  influencerStrategy: detailedString(80),
  emailCampaignPlan: z.array(marketingEmailPhaseSchema).min(3).max(8),
  communityBuildingPlan: detailedString(80),
  contentCalendar30Day: z.array(marketingCalendarEntrySchema).length(30),
  launchKpis: z.array(marketingKpiSchema).min(4).max(12),
  budgetAllocation: z.array(marketingBudgetItemSchema).min(4).max(10),
  confidence: z.number().min(0).max(1),
  sourceReportTitles: z.array(z.string()).min(1),
  fullPlan: z.string().min(800),
});

export type MarketingOutput = z.infer<typeof marketingOutputSchema>;
export type MarketingCalendarEntry = z.infer<typeof marketingCalendarEntrySchema>;
export type MarketingKpi = z.infer<typeof marketingKpiSchema>;
export type MarketingBudgetItem = z.infer<typeof marketingBudgetItemSchema>;
export type MarketingEmailPhase = z.infer<typeof marketingEmailPhaseSchema>;

export interface MarketingRunInput {
  brief: string;
  workspaceId: string;
  workspaceName: string;
}

export interface MarketingRunResult {
  reportId: string;
  reportRecordId: string;
  title: string;
  launchStrategy: string;
  contentPillars: string[];
  tiktokIdeas: string[];
  instagramIdeas: string[];
  influencerStrategy: string;
  emailCampaignPlan: MarketingEmailPhase[];
  communityBuildingPlan: string;
  contentCalendar30Day: MarketingCalendarEntry[];
  launchKpis: MarketingKpi[];
  budgetAllocation: MarketingBudgetItem[];
  confidence: number;
  sourceReportTitles: string[];
  contextRecordCount: number;
}
