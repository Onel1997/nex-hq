import { SHOPIFY_REPORT_TYPE } from "@/brain/domains/reports";
import { z } from "zod";

export const SHOPIFY_REPORT_TYPE_VALUE = SHOPIFY_REPORT_TYPE;

const detailedString = (min: number) => z.string().min(min);
const bulletList = (min: number, max: number) =>
  z.array(z.string().min(12)).min(min).max(max);

export const shopifyProductVariantSchema = z.object({
  optionName: z.string().min(1),
  optionValues: z.array(z.string().min(1)).min(1),
  sku: z.string().optional(),
  price: z.string().optional(),
});

export const shopifyProductSchema = z.object({
  productName: z.string().min(1),
  productType: z.string().min(1),
  category: z.string().min(1),
  description: detailedString(40),
  shortDescription: z.string().min(20).max(300),
  materials: z.string().min(10),
  tags: z.array(z.string().min(1)).min(2).max(20),
  seoTitle: z.string().min(10).max(70),
  seoDescription: z.string().min(50).max(320),
  suggestedPrice: z.string().min(1),
  compareAtPrice: z.string().optional(),
  variants: z.array(shopifyProductVariantSchema).min(1).max(12),
  inventoryRecommendation: detailedString(20),
});

export const shopifyOutputSchema = z.object({
  title: z.string().min(1),
  reportType: z.literal(SHOPIFY_REPORT_TYPE),
  collectionName: z.string().min(1),
  collectionDescription: detailedString(80),
  collectionSeoTitle: z.string().min(10).max(70),
  collectionSeoDescription: z.string().min(50).max(320),
  products: z.array(shopifyProductSchema).min(1).max(24),
  collectionsToCreate: bulletList(1, 8),
  navigationRecommendations: bulletList(2, 10),
  homepageRecommendations: bulletList(2, 10),
  launchChecklist: bulletList(4, 16),
  storefrontWarnings: bulletList(1, 8),
  confidence: z.number().min(0).max(1),
  sourceReportTitles: z.array(z.string()).min(1),
  fullDraft: z.string().min(800),
});

export type ShopifyProductVariant = z.infer<typeof shopifyProductVariantSchema>;
export type ShopifyProduct = z.infer<typeof shopifyProductSchema>;
export type ShopifyOutput = z.infer<typeof shopifyOutputSchema>;

export interface ShopifyRunInput {
  brief: string;
  workspaceId: string;
  workspaceName: string;
}

export interface ShopifyRunResult {
  reportId: string;
  reportRecordId: string;
  title: string;
  collectionName: string;
  collectionDescription: string;
  collectionSeoTitle: string;
  collectionSeoDescription: string;
  products: ShopifyProduct[];
  collectionsToCreate: string[];
  navigationRecommendations: string[];
  homepageRecommendations: string[];
  launchChecklist: string[];
  storefrontWarnings: string[];
  confidence: number;
  sourceReportTitles: string[];
  contextRecordCount: number;
}
