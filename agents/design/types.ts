import { DESIGN_REPORT_TYPE } from "@/brain/domains/reports";
import { z } from "zod";

export const DESIGN_REPORT_TYPE_VALUE = DESIGN_REPORT_TYPE;

const detailedString = (min: number) => z.string().min(min);
const bulletList = (min: number, max: number) =>
  z.array(z.string().min(12)).min(min).max(max);

export const designColorSchema = z.object({
  name: z.string().min(1),
  hex: z.string().optional(),
  role: z.string().min(8),
});

export const designProductSchema = z.object({
  name: z.string().min(1),
  category: z.string().min(1),
  description: detailedString(30),
});

export const designHeroProductSchema = z.object({
  name: z.string().min(1),
  description: detailedString(40),
  rationale: detailedString(30),
});

export const designOutputSchema = z.object({
  title: z.string().min(1),
  reportType: z.literal(DESIGN_REPORT_TYPE),
  collectionName: z.string().min(1),
  collectionStory: detailedString(120),
  colorPalette: z.array(designColorSchema).min(3).max(8),
  silhouettes: bulletList(3, 10),
  productLineup: z.array(designProductSchema).min(4).max(14),
  heroProducts: z.array(designHeroProductSchema).min(2).max(6),
  materials: bulletList(3, 10),
  designDirection: detailedString(100),
  launchRecommendations: bulletList(3, 8),
  confidence: z.number().min(0).max(1),
  sourceReportTitles: z.array(z.string()).min(1),
  fullConcept: z.string().min(800),
});

export type DesignOutput = z.infer<typeof designOutputSchema>;
export type DesignColor = z.infer<typeof designColorSchema>;
export type DesignProduct = z.infer<typeof designProductSchema>;
export type DesignHeroProduct = z.infer<typeof designHeroProductSchema>;

export interface DesignRunInput {
  brief: string;
  workspaceId: string;
  workspaceName: string;
}

export interface DesignRunResult {
  reportId: string;
  reportRecordId: string;
  title: string;
  collectionName: string;
  collectionStory: string;
  colorPalette: DesignColor[];
  silhouettes: string[];
  productLineup: DesignProduct[];
  heroProducts: DesignHeroProduct[];
  materials: string[];
  designDirection: string;
  launchRecommendations: string[];
  confidence: number;
  sourceReportTitles: string[];
  contextRecordCount: number;
}
