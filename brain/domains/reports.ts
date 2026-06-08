/**
 * Reports — agent report archive linked to tasks.
 * Bridges Brain memory to the reports module.
 */

import type { AgentId } from "@/lib/constants/agents";
import type { ReportArtifact, ReportStatus } from "@/reports/types";

export const RESEARCH_REPORT_TYPES = [
  "competitor",
  "trend",
  "design",
  "pricing",
  "audience",
] as const;

export type ResearchReportType = (typeof RESEARCH_REPORT_TYPES)[number];

export const CEO_REPORT_TYPE = "ceo-report" as const;
export type CeoReportType = typeof CEO_REPORT_TYPE;

export const DESIGN_REPORT_TYPE = "design-report" as const;
export type DesignReportType = typeof DESIGN_REPORT_TYPE;

export const MARKETING_REPORT_TYPE = "marketing-report" as const;
export type MarketingReportType = typeof MARKETING_REPORT_TYPE;

export const SHOPIFY_REPORT_TYPE = "shopify-report" as const;
export type ShopifyReportType = typeof SHOPIFY_REPORT_TYPE;

export const CONTENT_REPORT_TYPE = "content-report" as const;
export type ContentReportType = typeof CONTENT_REPORT_TYPE;

export type ReportType =
  | ResearchReportType
  | CeoReportType
  | DesignReportType
  | MarketingReportType
  | ShopifyReportType
  | ContentReportType;

export type CeoStepPriority = "high" | "medium" | "low";

/** Prioritized action item from CEO strategic briefing. */
export interface BrainCeoNextStep {
  action: string;
  priority: CeoStepPriority;
  rationale?: string;
}

/** Color entry in a design collection concept. */
export interface BrainDesignColor {
  name: string;
  hex?: string;
  role: string;
}

/** Product SKU in a design collection lineup. */
export interface BrainDesignProduct {
  name: string;
  category: string;
  description: string;
}

/** Hero product highlight in a design collection concept. */
export interface BrainDesignHeroProduct {
  name: string;
  description: string;
  rationale: string;
}

/** Structured design collection concept sections (Designer Agent). */
export interface BrainDesignSections {
  collectionName: string;
  collectionStory: string;
  colorPalette: BrainDesignColor[];
  silhouettes: string[];
  productLineup: BrainDesignProduct[];
  heroProducts: BrainDesignHeroProduct[];
  materials: string[];
  designDirection: string;
  launchRecommendations: string[];
  /** Report titles cited as knowledge sources. */
  sourceReportTitles?: string[];
}

/** Single day in a 30-day content calendar. */
export interface BrainMarketingCalendarEntry {
  day: number;
  title: string;
  channel: string;
  format: string;
  description: string;
}

/** Launch KPI target. */
export interface BrainMarketingKpi {
  metric: string;
  target: string;
  rationale: string;
}

/** Budget allocation line item. */
export interface BrainMarketingBudgetItem {
  category: string;
  allocation: string;
  rationale: string;
}

/** Email campaign phase. */
export interface BrainMarketingEmailPhase {
  phase: string;
  subject: string;
  objective: string;
  content: string;
}

/** Product variant draft for Shopify storefront. */
export interface BrainShopifyProductVariant {
  optionName: string;
  optionValues: string[];
  sku?: string;
  price?: string;
}

/** Product listing draft for Shopify storefront. */
export interface BrainShopifyProduct {
  productName: string;
  productType: string;
  category: string;
  description: string;
  shortDescription: string;
  materials: string;
  tags: string[];
  seoTitle: string;
  seoDescription: string;
  suggestedPrice: string;
  compareAtPrice?: string;
  variants: BrainShopifyProductVariant[];
  inventoryRecommendation: string;
}

/** Structured Shopify storefront draft sections (Shopify Agent). */
export interface BrainShopifySections {
  collectionName: string;
  collectionDescription: string;
  collectionSeoTitle: string;
  collectionSeoDescription: string;
  products: BrainShopifyProduct[];
  collectionsToCreate: string[];
  navigationRecommendations: string[];
  homepageRecommendations: string[];
  launchChecklist: string[];
  storefrontWarnings: string[];
  /** Report titles cited as knowledge sources. */
  sourceReportTitles?: string[];
}

/** Landing page copy block (Content Agent). */
export interface BrainContentLandingPageCopy {
  heroHeadline: string;
  heroSubheadline: string;
  brandStory: string;
  collectionIntroduction: string;
  cta: string;
}

/** Product copy block (Content Agent). */
export interface BrainContentProductCopy {
  productName: string;
  shortDescription: string;
  longDescription: string;
  featureBullets: string[];
  seoCopy: string;
}

/** Email launch sequence (Content Agent). */
export interface BrainContentEmailSequence {
  teaserEmail: string;
  revealEmail: string;
  countdownEmail: string;
  launchEmail: string;
}

/** Social content package (Content Agent). */
export interface BrainContentSocialContent {
  instagramCaptions: string[];
  tiktokHooks: string[];
  storyIdeas: string[];
  launchPosts: string[];
}

/** SMS campaign messages (Content Agent). */
export interface BrainContentSmsCampaign {
  teaserSms: string;
  countdownSms: string;
  launchSms: string;
}

/** Structured publish-ready content sections (Content Agent). */
export interface BrainContentSections {
  brandNarrative: string;
  landingPageCopy: BrainContentLandingPageCopy;
  productCopy: BrainContentProductCopy[];
  emailSequence: BrainContentEmailSequence;
  socialContent: BrainContentSocialContent;
  smsCampaign: BrainContentSmsCampaign;
  /** Report titles cited as knowledge sources. */
  sourceReportTitles?: string[];
}

/** Structured marketing campaign plan sections (Marketing Agent). */
export interface BrainMarketingSections {
  launchStrategy: string;
  contentPillars: string[];
  tiktokIdeas: string[];
  instagramIdeas: string[];
  influencerStrategy: string;
  emailCampaignPlan: BrainMarketingEmailPhase[];
  communityBuildingPlan: string;
  contentCalendar30Day: BrainMarketingCalendarEntry[];
  launchKpis: BrainMarketingKpi[];
  budgetAllocation: BrainMarketingBudgetItem[];
  sourceReportTitles?: string[];
}

/** Structured CEO strategic briefing sections. */
export interface BrainCeoSections {
  executiveSummary: string;
  keyInsights: string[];
  strategicOpportunities: string[];
  risks: string[];
  nextSteps: BrainCeoNextStep[];
  /** Report titles cited as knowledge sources. */
  sourceReportTitles?: string[];
}

/** Structured competitor analysis sections (Research Agent V2). */
export interface BrainCompetitorReportSections {
  positioning: string;
  targetAudience: string;
  pricing: string;
  productCategories: string[];
  marketingStrategy: string;
  communityStrategy: string;
  strengths: string[];
  weaknesses: string[];
  brandOpportunities: string[];
}

/** Structured trend analysis sections (Research Agent V2). */
export interface BrainTrendReportSections {
  trendDescription: string;
  whyItMatters: string;
  adoptionLevel: "nascent" | "emerging" | "mainstream" | "declining";
  relevanceForBrand: string;
  designImplications: string[];
  contentImplications: string[];
}

/** Core research report sections stored separately for retrieval and UI. */
export interface BrainResearchSections {
  executiveSummary: string;
  keyFindings: string[];
  opportunities: string[];
  risks: string[];
  recommendations: string[];
  competitorReport?: BrainCompetitorReportSections;
  trendReport?: BrainTrendReportSections;
}

/** Snapshot of an agent report stored in Brain for long-term context. */
export interface BrainReportContent {
  kind: "reports";
  reportId: string;
  taskId: string;
  agentId: AgentId;
  status: ReportStatus;
  summary: string;
  artifacts: ReportArtifact[];
  confidence: number;
  notes?: string;
  /** Key takeaways indexed for fast agent retrieval. */
  keyFindings?: string[];
  /** Report classification — research types or ceo-report. */
  reportType?: ReportType;
  /** Research Agent V2 — structured section payload. */
  researchSections?: BrainResearchSections;
  /** CEO Agent — structured strategic briefing payload. */
  ceoSections?: BrainCeoSections;
  /** Designer Agent — structured collection concept payload. */
  designSections?: BrainDesignSections;
  /** Marketing Agent — structured campaign plan payload. */
  marketingSections?: BrainMarketingSections;
  /** Shopify Agent — structured storefront draft payload. */
  shopifySections?: BrainShopifySections;
  /** Content Agent — structured publish-ready copy payload. */
  contentSections?: BrainContentSections;
}
