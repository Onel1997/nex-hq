import { z } from "zod";

export const designStudioColorSchema = z.object({
  name: z.string().min(1),
  usage: z.string().min(2),
  hex: z.string().optional(),
});

export const designStudioBriefSchema = z.object({
  designId: z.string().min(1),
  title: z.string().min(1),
  role: z.string().min(1),
  product: z.string().min(1),
  color: z.string().min(1),
  printArea: z.string().min(1),
  placement: z.string().min(5),
  dimensions: z.string().min(3),
  visualConcept: z.string().min(10),
  designDescription: z.string().min(10),
  geometry: z.string().min(3),
  visualElements: z.array(z.string().min(2)).min(1),
  typography: z.string().min(1),
  colorPalette: z.array(designStudioColorSchema).min(1),
  productionMethod: z.string().min(5),
  materialEffects: z.string().min(3),
  negativeSpaceRules: z.string().min(5),
  designerInstructions: z.array(z.string().min(10)).min(1),
  svgPrompt: z.string().min(40),
  mockupPrompt: z.string().min(40),
  imagePrompt: z.string().min(20),
  printReadinessScore: z.number().min(0).max(100),
  dnaScore: z.number().min(0).max(100).optional(),
  commercialScore: z.number().min(0).max(100).optional(),
  campaignPotential: z.string().optional(),
});

export type DesignStudioColor = z.infer<typeof designStudioColorSchema>;
export type DesignStudioBrief = z.infer<typeof designStudioBriefSchema>;

export interface ResearchHandoffResult {
  reportId: string;
  brainRecordId: string;
  reportTitle: string;
  collectionName?: string;
  briefs: DesignStudioBrief[];
}
