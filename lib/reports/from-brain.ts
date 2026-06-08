import type {
  BrainCeoNextStep,
  BrainContentSections,
  BrainDesignSections,
  BrainImageSections,
  BrainMarketingSections,
  BrainReportContent,
  BrainShopifySections,
  CeoReportType,
  ContentReportType,
  DesignReportType,
  ImageProjectType,
  MarketingReportType,
  ResearchReportType,
  ShopifyReportType,
} from "@/brain/domains/reports";
import type { BrainRecord } from "@/brain/types";
import type { ReportCategory, ReportListItem } from "@/lib/mock/reports";
import { toImageProjectView } from "@/lib/reports/image-project";
import type { AgentId } from "@/lib/constants/agents";

function mapAgentToCategory(agentId: AgentId): ReportCategory {
  switch (agentId) {
    case "research":
      return "research";
    case "designer":
      return "design";
    case "marketing":
      return "marketing";
    case "shopify":
      return "commerce";
    case "content":
      return "content";
    case "image":
      return "image";
    case "ceo":
      return "operations";
    default:
      return "research";
  }
}

function mapBrainStatusToUi(
  recordStatus: BrainRecord["status"],
  contentStatus: BrainReportContent["status"],
): ReportListItem["status"] {
  if (recordStatus === "archived") return "archived";
  if (recordStatus === "approved") return "approved";
  if (contentStatus === "draft" || recordStatus === "draft") return "draft";
  return "submitted";
}

function inferReportTypeFromTags(
  tags: string[] | undefined,
): BrainReportContent["reportType"] | undefined {
  if (!tags) return undefined;
  if (tags.includes("ceo-report") || tags.includes("ceo")) {
    return "ceo-report";
  }
  if (tags.includes("design-report") || tags.includes("designer")) {
    return "design-report";
  }
  if (tags.includes("marketing-report") || tags.includes("marketing")) {
    return "marketing-report";
  }
  if (tags.includes("shopify-report") || tags.includes("shopify")) {
    return "shopify-report";
  }
  if (tags.includes("content-report") || tags.includes("content")) {
    return "content-report";
  }
  if (
    tags.includes("image-project") ||
    tags.includes("image-agent") ||
    tags.includes("image-report") ||
    tags.includes("image")
  ) {
    return "image-project";
  }
  const types = ["competitor", "trend", "design", "pricing", "audience"] as const;
  return types.find((type) => tags.includes(type));
}

function mapCeoNextSteps(
  steps: BrainCeoNextStep[] | undefined,
): ReportListItem["nextSteps"] {
  if (!steps?.length) return undefined;
  return steps.map((s) => ({
    action: s.action,
    priority: s.priority,
    rationale: s.rationale,
  }));
}

function mapMarketingSections(
  sections: BrainMarketingSections | undefined,
): ReportListItem["marketingReport"] {
  if (!sections) return undefined;
  return {
    launchStrategy: sections.launchStrategy,
    contentPillars: sections.contentPillars,
    tiktokIdeas: sections.tiktokIdeas,
    instagramIdeas: sections.instagramIdeas,
    influencerStrategy: sections.influencerStrategy,
    emailCampaignPlan: sections.emailCampaignPlan,
    communityBuildingPlan: sections.communityBuildingPlan,
    contentCalendar30Day: sections.contentCalendar30Day,
    launchKpis: sections.launchKpis,
    budgetAllocation: sections.budgetAllocation,
    sourceReportTitles: sections.sourceReportTitles,
  };
}

function mapDesignSections(
  sections: BrainDesignSections | undefined,
): ReportListItem["designReport"] {
  if (!sections) return undefined;
  return {
    collectionName: sections.collectionName,
    collectionStory: sections.collectionStory,
    colorPalette: sections.colorPalette,
    silhouettes: sections.silhouettes,
    productLineup: sections.productLineup,
    heroProducts: sections.heroProducts,
    materials: sections.materials,
    designDirection: sections.designDirection,
    launchRecommendations: sections.launchRecommendations,
    sourceReportTitles: sections.sourceReportTitles,
  };
}

function mapShopifySections(
  sections: BrainShopifySections | undefined,
): ReportListItem["shopifyReport"] {
  if (!sections) return undefined;
  return {
    collectionName: sections.collectionName,
    collectionDescription: sections.collectionDescription,
    collectionSeoTitle: sections.collectionSeoTitle,
    collectionSeoDescription: sections.collectionSeoDescription,
    products: sections.products,
    collectionsToCreate: sections.collectionsToCreate,
    navigationRecommendations: sections.navigationRecommendations,
    homepageRecommendations: sections.homepageRecommendations,
    launchChecklist: sections.launchChecklist,
    storefrontWarnings: sections.storefrontWarnings,
    sourceReportTitles: sections.sourceReportTitles,
  };
}

function mapContentSections(
  sections: BrainContentSections | undefined,
): ReportListItem["contentReport"] {
  if (!sections) return undefined;
  return {
    brandNarrative: sections.brandNarrative,
    landingPageCopy: sections.landingPageCopy,
    productCopy: sections.productCopy,
    emailSequence: sections.emailSequence,
    socialContent: sections.socialContent,
    smsCampaign: sections.smsCampaign,
    sourceReportTitles: sections.sourceReportTitles,
  };
}

function mapImageSections(
  sections: BrainImageSections | undefined,
): ReportListItem["imageProject"] {
  return toImageProjectView(sections);
}

export function brainReportRecordToListItem(
  record: BrainRecord<"reports">,
): ReportListItem {
  const content = record.content as BrainReportContent;
  const researchSections = content.researchSections;
  const ceoSections = content.ceoSections;
  const designSections = content.designSections;
  const marketingSections = content.marketingSections;
  const shopifySections = content.shopifySections;
  const contentSections = content.contentSections;
  const imageSections = content.imageSections;
  const reportType:
    | ResearchReportType
    | CeoReportType
    | DesignReportType
    | MarketingReportType
    | ShopifyReportType
    | ContentReportType
    | ImageProjectType
    | "image-report"
    | undefined = content.reportType ?? inferReportTypeFromTags(record.tags);

  const isCeoReport = reportType === "ceo-report" || content.agentId === "ceo";
  const isDesignReport =
    reportType === "design-report" || content.agentId === "designer";
  const isMarketingReport =
    reportType === "marketing-report" || content.agentId === "marketing";
  const isShopifyReport =
    reportType === "shopify-report" || content.agentId === "shopify";
  const isContentReport =
    reportType === "content-report" || content.agentId === "content";
  const isImageReport =
    reportType === "image-project" ||
    reportType === "image-report" ||
    content.agentId === "image";

  return {
    id: content.reportId,
    brainRecordId: record.id,
    title: record.title,
    summary: isImageReport
      ? imageSections?.moodboard?.visualDirection ?? content.summary
      : isContentReport
      ? contentSections?.brandNarrative ?? content.summary
      : isShopifyReport
        ? shopifySections?.collectionDescription ?? content.summary
        : isMarketingReport
          ? marketingSections?.launchStrategy ?? content.summary
          : isDesignReport
            ? designSections?.collectionStory ?? content.summary
            : ceoSections?.executiveSummary ??
              researchSections?.executiveSummary ??
              content.summary,
    category: mapAgentToCategory(content.agentId),
    agentId: content.agentId,
    status: mapBrainStatusToUi(record.status, content.status),
    confidence: content.confidence,
    createdAt: record.createdAt,
    highlights: isImageReport
      ? toImageProjectView(imageSections)?.corePackage.map((item) => item.title)
      : isContentReport
      ? contentSections?.socialContent.launchPosts
      : isShopifyReport
        ? shopifySections?.launchChecklist
        : isMarketingReport
          ? marketingSections?.contentPillars
          : isDesignReport
            ? designSections?.silhouettes
            : isCeoReport
              ? ceoSections?.keyInsights
              : researchSections?.keyFindings ?? content.keyFindings,
    reportType: isImageReport
      ? "image-project"
      : isContentReport
      ? "content-report"
      : isShopifyReport
        ? "shopify-report"
        : isMarketingReport
          ? "marketing-report"
          : isDesignReport
            ? "design-report"
            : isCeoReport
              ? "ceo-report"
              : reportType,
    executiveSummary: isImageReport
      ? imageSections?.moodboard?.visualDirection ?? content.summary
      : isContentReport
      ? contentSections?.brandNarrative ?? content.summary
      : isShopifyReport
        ? shopifySections?.collectionDescription ?? content.summary
        : isMarketingReport
          ? marketingSections?.launchStrategy ?? content.summary
          : isDesignReport
            ? designSections?.collectionStory ?? content.summary
            : ceoSections?.executiveSummary ??
              researchSections?.executiveSummary ??
              content.summary,
    recommendations: isImageReport
      ? toImageProjectView(imageSections)?.campaignShots.map((item) => item.purpose)
      : isContentReport
      ? contentSections?.socialContent.storyIdeas
      : isShopifyReport
        ? shopifySections?.navigationRecommendations
        : isMarketingReport
          ? marketingSections?.contentPillars
          : isCeoReport || isDesignReport
            ? isDesignReport
              ? designSections?.launchRecommendations
              : undefined
            : researchSections?.recommendations,
    opportunities: isCeoReport
      ? ceoSections?.strategicOpportunities
      : researchSections?.opportunities,
    risks: isShopifyReport
      ? shopifySections?.storefrontWarnings
      : isCeoReport
        ? ceoSections?.risks
        : researchSections?.risks,
    nextSteps: isCeoReport ? mapCeoNextSteps(ceoSections?.nextSteps) : undefined,
    sourceReportTitles: isImageReport
      ? imageSections?.sourceReportTitles
      : isContentReport
      ? contentSections?.sourceReportTitles
      : isShopifyReport
        ? shopifySections?.sourceReportTitles
        : isMarketingReport
          ? marketingSections?.sourceReportTitles
          : isDesignReport
            ? designSections?.sourceReportTitles
            : ceoSections?.sourceReportTitles,
    designReport: isDesignReport ? mapDesignSections(designSections) : undefined,
    marketingReport: isMarketingReport
      ? mapMarketingSections(marketingSections)
      : undefined,
    shopifyReport: isShopifyReport
      ? mapShopifySections(shopifySections)
      : undefined,
    contentReport: isContentReport
      ? mapContentSections(contentSections)
      : undefined,
    imageProject: isImageReport
      ? mapImageSections(imageSections)
      : undefined,
  };
}

export function brainReportRecordsToListItems(
  records: BrainRecord[],
): ReportListItem[] {
  return records
    .filter((r): r is BrainRecord<"reports"> => r.domain === "reports")
    .map(brainReportRecordToListItem)
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
}
