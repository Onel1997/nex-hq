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

export const CEO_FINAL_REPORT_TYPE = "ceo-final-report" as const;
export type CeoFinalReportType = typeof CEO_FINAL_REPORT_TYPE;

export const DESIGN_REPORT_TYPE = "design-report" as const;
export type DesignReportType = typeof DESIGN_REPORT_TYPE;

export const MARKETING_REPORT_TYPE = "marketing-report" as const;
export type MarketingReportType = typeof MARKETING_REPORT_TYPE;

export const SHOPIFY_REPORT_TYPE = "shopify-report" as const;
export type ShopifyReportType = typeof SHOPIFY_REPORT_TYPE;

export const CONTENT_REPORT_TYPE = "content-report" as const;
export type ContentReportType = typeof CONTENT_REPORT_TYPE;

export const IMAGE_PROJECT_TYPE = "image-project" as const;
export type ImageProjectType = typeof IMAGE_PROJECT_TYPE;

/** @deprecated Use IMAGE_PROJECT_TYPE */
export const IMAGE_REPORT_TYPE = IMAGE_PROJECT_TYPE;
/** @deprecated Use ImageProjectType */
export type ImageReportType = ImageProjectType;

export type ReportType =
  | ResearchReportType
  | CeoReportType
  | CeoFinalReportType
  | DesignReportType
  | MarketingReportType
  | ShopifyReportType
  | ContentReportType
  | ImageProjectType
  | "image-report";

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

/** Product SKU in a design collection lineup (V1 legacy). */
export interface BrainDesignProduct {
  name: string;
  category: string;
  description: string;
}

/** Full product spec in a design collection (Designer Agent V2). */
export interface BrainDesignProductV2 {
  name: string;
  category: string;
  fit: string;
  material: string;
  color: string;
  details: string;
  pricePosition: string;
  priority: "hero" | "core" | "support";
  /** Legacy narrative — optional on V2 records */
  description?: string;
}

/** Hero product highlight in a design collection concept (V1 legacy). */
export interface BrainDesignHeroProduct {
  name: string;
  description: string;
  rationale: string;
}

/** Structured design collection concept sections (Designer Agent). */
export interface BrainDesignSections {
  schemaVersion?: "2.0" | "1.0";
  collectionName: string;
  /** V2 — season label e.g. SS26 */
  season?: string;
  /** V2 — creative theme */
  theme?: string;
  /** V2 — collection narrative */
  story?: string;
  /** V2 — primary audience */
  targetAudience?: string;
  colorPalette: BrainDesignColor[];
  materials: string[];
  silhouettes: string[];
  /** V2 — structured product lineup */
  products?: BrainDesignProductV2[];
  /** V2 — styling and art direction */
  stylingDirection?: string;
  /** V2 — moodboard keywords */
  visualKeywords?: string[];
  /** V2 — mockup / image generation ideas */
  mockupIdeas?: string[];
  /** V2 — campaign creative references */
  campaignIdeas?: string[];
  /** V2 — photography direction */
  photographyStyle?: string;
  /** V2 — image generation prompts for Image Agent */
  imagePrompts?: string[];
  /** V2 — mood description */
  moodDescription?: string;
  /** V2 — fit descriptions */
  fits?: string[];
  /** Legacy V1 */
  collectionStory: string;
  productLineup: BrainDesignProduct[];
  heroProducts: BrainDesignHeroProduct[];
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

export type BrainImageProductionPriority = "high" | "medium" | "low";

/** AI image prompts for a single visual asset (Image Agent). */
export interface BrainImageAiPrompts {
  midjourney: string;
  openai: string;
  flux: string;
}

/** Moodboard creative direction (Image Agent). */
export interface BrainImageMoodboardSection {
  visualDirection: string;
  aestheticKeywords: string[];
  colorSystem: string[];
  materialReferences: string[];
  photographyStyle: string;
}

/** Product mockup concept (Image Agent). */
export interface BrainImageProductMockup {
  name: string;
  conceptType: "hero_product" | "flat_lay" | "studio" | "lifestyle";
  description: string;
  prompts: BrainImageAiPrompts;
  dimensions: string;
}

/** Campaign visual concept (Image Agent). */
export interface BrainImageCampaignVisual {
  name: string;
  conceptType:
    | "launch_campaign"
    | "social_creative"
    | "instagram_carousel"
    | "ad_concept";
  description: string;
  platform: string;
  prompts: BrainImageAiPrompts;
  dimensions: string;
}

/** Landing page visual asset (Image Agent). */
export interface BrainImageLandingPageAsset {
  name: string;
  conceptType: "hero_banner" | "collection_header" | "product_section";
  description: string;
  prompts: BrainImageAiPrompts;
  dimensions: string;
}

/** Production checklist entry (Image Agent). */
export interface BrainImageProductionChecklistItem {
  assetName: string;
  priority: BrainImageProductionPriority;
  platform: string;
  purpose: string;
}

/** Brand color palette with HEX values (Image Agent). */
export interface BrainImagePalette {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  text: string;
}

/** Hero banner concept for landing pages (Image Agent). */
export interface BrainImageHeroBanner {
  headline: string;
  subheadline: string;
  visualDirection: string;
  openaiPrompt: string;
  fluxPrompt: string;
  midjourneyPrompt: string;
}

/** Landing page visual section (Image Agent). */
export interface BrainImageLandingSection {
  sectionTitle: string;
  sectionType:
    | "hero"
    | "collection_showcase"
    | "product_grid"
    | "brand_story"
    | "cta_section";
  purpose: string;
  visualDirection: string;
  prompt: string;
}

/** Instagram grid post concept (Image Agent). */
export interface BrainImageInstagramGridItem {
  name: string;
  conceptType:
    | "product_hero"
    | "lifestyle_scene"
    | "detail_closeup"
    | "brand_mood"
    | "community_style"
    | "launch_teaser";
  description: string;
  visualDirection: string;
  prompts: BrainImageAiPrompts;
}

/** Instagram Reels concept (Image Agent). */
export interface BrainImageReelsConcept {
  name: string;
  conceptType:
    | "unboxing_reel"
    | "styling_tips"
    | "behind_the_scenes"
    | "product_reveal"
    | "day_in_life"
    | "trend_hook";
  hook: string;
  description: string;
  visualDirection: string;
  prompts: BrainImageAiPrompts;
}

/** TikTok concept (Image Agent). */
export interface BrainImageTiktokConcept {
  name: string;
  conceptType:
    | "hook_opener"
    | "outfit_transition"
    | "cap_styling"
    | "drop_countdown"
    | "street_culture"
    | "ugc_style";
  hook: string;
  description: string;
  visualDirection: string;
  prompts: BrainImageAiPrompts;
}

/** Generated image asset stored in Supabase Storage (Image Agent). */
export interface BrainImageGeneratedAsset {
  assetKey: string;
  section: string;
  assetIndex: number;
  assetName: string;
  provider: "openai" | "flux";
  prompt: string;
  dimensions: string;
  status: "pending" | "generating" | "completed" | "failed";
  storagePath?: string;
  url?: string;
  createdAt: string;
  message?: string;
}

/** Campaign photography shot (Image Agent). */
export interface BrainImageCampaignShot {
  shotName: string;
  shotType: string;
  location: string;
  styling: string;
  purpose: string;
}

/** V3 creative studio production asset (Image Agent). */
export interface BrainImageStudioAsset {
  id: string;
  assetType: string;
  outputCategory: string;
  productName: string;
  collection: string;
  color: string;
  material: string;
  location: string;
  lighting: string;
  photographyStyle: string;
  cameraStyle: string;
  prompt: BrainImageAiPrompts;
  priority: "hero" | "core" | "support";
  status: "ready" | "generating" | "completed" | "failed" | "pending";
  title?: string;
  platform?: string;
  dimensions?: string;
  imageUrl?: string;
}

/** V3 lookbook shot plan. */
export interface BrainImageLookbookShot {
  shotName: string;
  models: string;
  location: string;
  outfitProducts: string[];
  styling: string;
  purpose: string;
}

/** Normalized image asset (Image Agent V2). */
export interface BrainNormalizedImageAsset {
  id: string;
  title: string;
  type:
    | "hero_banner"
    | "product_mockup"
    | "campaign_key_visual"
    | "instagram_carousel"
    | "reels_concept"
    | "tiktok_concept"
    | "landing_section"
    | "instagram_grid"
    | "campaign_visual"
    | "social_concept"
    | "extra_mockup"
    | "community_concept"
    | "launch_teaser"
    | "email_asset"
    | string;
  package: "core" | "advanced";
  dimensions: string;
  platform?: string;
  purpose?: string;
  variant?: string;
  prompt: BrainImageAiPrompts;
  provider?: "openai" | "flux" | "replicate" | "midjourney";
  status: "ready" | "generating" | "completed" | "failed";
  imageUrl?: string;
  storagePath?: string;
  createdAt?: string;
  message?: string;
}

/** Structured visual production project (Image Agent). */
export interface BrainImageSections {
  schemaVersion?: "3.0" | "2.0" | "1.0";
  projectName: string;
  collectionName?: string;
  visualDirection?: string;
  moodboard: BrainImageMoodboardSection;
  palette?: BrainImagePalette;
  /** V3 creative studio assets. */
  productionAssets?: BrainImageStudioAsset[];
  lookbookShots?: BrainImageLookbookShot[];
  /** V2 packages — legacy, migrated on read. */
  corePackage?: BrainNormalizedImageAsset[];
  advancedPackage?: BrainNormalizedImageAsset[];
  campaignShots?: BrainImageCampaignShot[];
  sourceReportTitles?: string[];
  /** Legacy V1 — migrated on read */
  heroBanner?: BrainImageHeroBanner;
  productMockups?: BrainImageProductMockup[];
  campaignVisuals?: BrainImageCampaignVisual[];
  landingPageAssets?: BrainImageLandingPageAsset[];
  landingAssets?: BrainImageLandingSection[];
  instagramGrid?: BrainImageInstagramGridItem[];
  reelsConcepts?: BrainImageReelsConcept[];
  tiktokConcepts?: BrainImageTiktokConcept[];
  generatedAssets?: BrainImageGeneratedAsset[];
  productionChecklist?: BrainImageProductionChecklistItem[];
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

/** Reference to a source report used in CEO final synthesis. */
export interface BrainCeoFinalReportRef {
  reportId: string;
  brainRecordId: string;
  title: string;
  taskId: string;
  agentId: AgentId;
}

/** Structured CEO final executive synthesis sections. */
export interface BrainCeoFinalSections {
  executiveSummary: string;
  keyFindings: string[];
  opportunities: string[];
  risks: string[];
  recommendedActions: BrainCeoNextStep[];
  launchStrategy: string;
  nextMilestones: string[];
  ceoVerdict: string;
  founderGoal: string;
  completionScore: number;
  parentGoalTaskId: string;
  sourceTaskIds: string[];
  researchReports: BrainCeoFinalReportRef[];
  designReports: BrainCeoFinalReportRef[];
  marketingReports: BrainCeoFinalReportRef[];
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
  /** Research HQ → Design Studio handoff payload. */
  designBrief?: {
    collectionIdea: string;
    productSuggestions: string[];
    targetAudience: string;
    colorPalette: BrainDesignColor[];
    styleDirection: string;
    silhouettes: string[];
    trendScore: number;
    socialScore?: number;
    demandScore?: number;
    competitorScore: number;
    confidence: number;
    connectorScores?: {
      socialScore?: number;
      demandScore?: number;
      trendScore?: number;
      confidence?: number;
    };
    intelligenceMode?: "live" | "simulated";
    rationale: string;
    opportunityId?: string;
    generatedAt: string;
  };
}

/** Snapshot of an agent report stored in Brain for long-term context. */
export interface BrainReportContent {
  kind: "reports";
  reportId: string;
  taskId: string;
  /** Real Brain task ID when report was generated from a task queue item. */
  originTaskId?: string;
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
  /** CEO Agent — final executive synthesis payload. */
  ceoFinalSections?: BrainCeoFinalSections;
  /** Designer Agent — structured collection concept payload. */
  designSections?: BrainDesignSections;
  /** Marketing Agent — structured campaign plan payload. */
  marketingSections?: BrainMarketingSections;
  /** Shopify Agent — structured storefront draft payload. */
  shopifySections?: BrainShopifySections;
  /** Content Agent — structured publish-ready copy payload. */
  contentSections?: BrainContentSections;
  /** Image Agent — structured image-generation project payload. */
  imageSections?: BrainImageSections;
}
