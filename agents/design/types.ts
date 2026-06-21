import { DESIGN_REPORT_TYPE } from "@/brain/domains/reports";
import { z } from "zod";

export const DESIGN_REPORT_TYPE_VALUE = DESIGN_REPORT_TYPE;

const detailedString = (min: number) => z.string().min(min);
const bulletList = (min: number, max: number) =>
  z.array(z.string().min(8)).min(min).max(max);

export const designColorSchema = z.object({
  name: z.string().min(1),
  hex: z.string().optional(),
  role: z.string().min(8),
});

export const designProductV2Schema = z.object({
  name: z.string().min(1),
  category: z.string().min(1),
  fit: z.string().min(8),
  material: z.string().min(8),
  color: z.string().min(3),
  details: z.string().min(20),
  pricePosition: z.string().min(8),
  priority: z.enum(["hero", "core", "support"]),
  description: z.string().min(30).optional(),
});

export const designOutputSchema = z.object({
  title: z.string().min(1),
  reportType: z.literal(DESIGN_REPORT_TYPE),
  collectionName: z.string().min(1),
  season: z.string().min(2),
  theme: z.string().min(8),
  story: detailedString(120),
  targetAudience: detailedString(40),
  colorPalette: z.array(designColorSchema).min(3).max(8),
  materials: bulletList(3, 10),
  silhouettes: bulletList(3, 10),
  fits: bulletList(2, 8),
  products: z.array(designProductV2Schema).min(4).max(14),
  stylingDirection: detailedString(100),
  visualKeywords: bulletList(3, 12),
  mockupIdeas: bulletList(3, 10),
  campaignIdeas: bulletList(3, 8),
  photographyStyle: detailedString(40),
  imagePrompts: z.array(z.string().min(40)).min(2).max(8),
  moodDescription: detailedString(60),
  confidence: z.number().min(0).max(1),
  sourceReportTitles: z.array(z.string()).min(1),
  fullConcept: z.string().min(800),
});

export type DesignOutput = z.infer<typeof designOutputSchema>;
export type DesignColor = z.infer<typeof designColorSchema>;
export type DesignProductV2 = z.infer<typeof designProductV2Schema>;

/** @deprecated Use DesignProductV2 */
export type DesignProduct = DesignProductV2;
/** @deprecated Hero products are products with priority hero */
export type DesignHeroProduct = {
  name: string;
  description: string;
  rationale: string;
};

export interface DesignRunInput {
  brief: string;
  workspaceId: string;
  workspaceName: string;
  originTaskId?: string;
}

export interface DesignRunResult {
  reportId: string;
  reportRecordId: string;
  title: string;
  collectionName: string;
  season: string;
  theme: string;
  story: string;
  targetAudience: string;
  colorPalette: DesignColor[];
  silhouettes: string[];
  products: DesignProductV2[];
  materials: string[];
  stylingDirection: string;
  visualKeywords: string[];
  mockupIdeas: string[];
  campaignIdeas: string[];
  photographyStyle: string;
  moodDescription: string;
  confidence: number;
  sourceReportTitles: string[];
  contextRecordCount: number;
}
