import type {
  BrainContentEmailSequence,
  BrainContentLandingPageCopy,
  BrainContentProductCopy,
  BrainContentSmsCampaign,
  BrainContentSocialContent,
  BrainDesignColor,
  BrainDesignHeroProduct,
  BrainDesignProduct,
  BrainMarketingBudgetItem,
  BrainMarketingCalendarEntry,
  BrainMarketingEmailPhase,
  BrainMarketingKpi,
  BrainShopifyProduct,
  CeoReportType,
  CeoStepPriority,
  BrainImageCampaignVisual,
  BrainImageLandingPageAsset,
  BrainImageMoodboardSection,
  BrainImageProductMockup,
  BrainImageProductionChecklistItem,
  BrainImageSections,
  ContentReportType,
  DesignReportType,
  ImageProjectType,
  MarketingReportType,
  ResearchReportType,
  ShopifyReportType,
} from "@/brain/domains/reports";
import type { AgentId } from "@/lib/constants/agents";

export interface ReportNextStep {
  action: string;
  priority: CeoStepPriority;
  rationale?: string;
}

export type ReportCategory =
  | "research"
  | "design"
  | "marketing"
  | "commerce"
  | "content"
  | "image"
  | "operations";

export type ReportReviewStatus = "draft" | "submitted" | "approved" | "archived";

export interface ReportListItem {
  id: string;
  title: string;
  summary: string;
  category: ReportCategory;
  agentId: AgentId;
  status: ReportReviewStatus;
  confidence: number;
  createdAt: string;
  drop?: string;
  highlights?: string[];
  reportType?:
    | ResearchReportType
    | CeoReportType
    | DesignReportType
    | MarketingReportType
    | ShopifyReportType
    | ContentReportType
    | ImageProjectType
    | "image-report";
  executiveSummary?: string;
  recommendations?: string[];
  opportunities?: string[];
  risks?: string[];
  nextSteps?: ReportNextStep[];
  sourceReportTitles?: string[];
  designReport?: {
    collectionName: string;
    collectionStory: string;
    colorPalette: BrainDesignColor[];
    silhouettes: string[];
    productLineup: BrainDesignProduct[];
    heroProducts: BrainDesignHeroProduct[];
    materials: string[];
    designDirection: string;
    launchRecommendations: string[];
    sourceReportTitles?: string[];
  };
  marketingReport?: {
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
  };
  shopifyReport?: {
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
    sourceReportTitles?: string[];
  };
  contentReport?: {
    brandNarrative: string;
    landingPageCopy: BrainContentLandingPageCopy;
    productCopy: BrainContentProductCopy[];
    emailSequence: BrainContentEmailSequence;
    socialContent: BrainContentSocialContent;
    smsCampaign: BrainContentSmsCampaign;
    sourceReportTitles?: string[];
  };
  imageReport?: {
    projectName: string;
    moodboard: BrainImageMoodboardSection;
    productMockups: BrainImageProductMockup[];
    campaignVisuals: BrainImageCampaignVisual[];
    landingPageAssets: BrainImageLandingPageAsset[];
    productionChecklist: BrainImageProductionChecklistItem[];
    sourceReportTitles?: string[];
  };
}

export const REPORT_CATEGORY_LABELS: Record<ReportCategory, string> = {
  research: "Research",
  design: "Design",
  marketing: "Marketing",
  commerce: "Commerce",
  content: "Content",
  image: "Image",
  operations: "Operations",
};

export const MOCK_REPORTS: ReportListItem[] = [
  {
    id: "rpt-001",
    title: "Q2 Streetwear Drop Landscape",
    summary:
      "Competitive analysis of 12 major drops in Q2. Corteiz led with scarcity-driven sell-through; average drop window compressed to 48 hours.",
    category: "research",
    agentId: "research",
    status: "submitted",
    confidence: 0.89,
    createdAt: "2026-06-07T14:00:00Z",
    drop: "SS26 Capsule",
    highlights: [
      "48hr drop windows trending across tier-1 brands",
      "Signal green accent colors gaining traction in EU streetwear",
      "Oversized silhouettes remain dominant in top sellers",
    ],
  },
  {
    id: "rpt-002",
    title: "Y2K Revival Positioning Brief",
    summary:
      "Y2K aesthetics resurging in TikTok culture. Recommend subtle nod via graphic texture, not full retro pastiche.",
    category: "research",
    agentId: "research",
    status: "approved",
    confidence: 0.84,
    createdAt: "2026-06-05T11:30:00Z",
    drop: "SS26 Capsule",
    highlights: [
      "TikTok #y2kstreetwear up 34% QoQ",
      "Risk: over-saturation if executed literally",
      "Opportunity: abstract city textures as Y2K nod",
    ],
  },
  {
    id: "rpt-003",
    title: "SS26 Hoodie — Mood Board Direction A",
    summary:
      "Concept A: obsidian base, signal green wordmark, concrete texture overlay. Aligns with design rules.",
    category: "design",
    agentId: "designer",
    status: "submitted",
    confidence: 0.91,
    createdAt: "2026-06-06T16:45:00Z",
    drop: "SS26 Capsule",
    highlights: [
      "Palette within brand guardrails",
      "Graphic scale appropriate for oversized hoodie",
      "Numbered edition treatment recommended",
    ],
  },
  {
    id: "rpt-004",
    title: "Wide-Leg Cargo — Colorway Exploration",
    summary:
      "Three colorway directions: concrete grey, washed black, olive drab. Grey recommended as lead SKU.",
    category: "design",
    agentId: "designer",
    status: "draft",
    confidence: 0.78,
    createdAt: "2026-06-08T09:00:00Z",
    drop: "SS26 Capsule",
    highlights: [
      "Grey aligns with existing FW25 best-seller data",
      "Olive adds seasonal variety without palette drift",
    ],
  },
  {
    id: "rpt-005",
    title: "Summer Drop — 3-Week Campaign Plan",
    summary:
      "Organic-first launch: 7-day tease, 3-day reveal, 48hr countdown. VIP early access 2hrs before public.",
    category: "marketing",
    agentId: "marketing",
    status: "approved",
    confidence: 0.93,
    createdAt: "2026-06-04T10:00:00Z",
    drop: "SS26 Capsule",
    highlights: [
      "Paid retargeting budget: warm audiences only",
      "VIP list target: 2,400 subscribers",
      "IG carousel + TikTok culture clip on reveal day",
    ],
  },
  {
    id: "rpt-006",
    title: "VIP Email Sequence — Drop Countdown",
    summary:
      "4-email VIP sequence drafted. Open rate target 40%+. Copy follows brand voice rules from Brain.",
    category: "marketing",
    agentId: "marketing",
    status: "submitted",
    confidence: 0.86,
    createdAt: "2026-06-07T08:30:00Z",
    drop: "SS26 Capsule",
    highlights: [
      "Tease email: minimal, no product reveal",
      "Countdown email: size chart + early access link",
      "Post-drop: sell-through story within 24hrs",
    ],
  },
  {
    id: "rpt-007",
    title: "Drop Readiness Assessment",
    summary:
      "CEO synthesis: Brain context sufficient for planning. Specialist agents required before execution phase.",
    category: "operations",
    agentId: "ceo",
    status: "approved",
    confidence: 0.95,
    createdAt: "2026-06-08T08:00:00Z",
    drop: "SS26 Capsule",
    highlights: [
      "6 Brain sections synced",
      "8 tasks in queue, 2 awaiting review",
      "Shopify integration pending agent activation",
    ],
  },
];
