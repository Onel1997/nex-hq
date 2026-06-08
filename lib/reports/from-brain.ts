import type {
  BrainCeoNextStep,
  BrainDesignSections,
  BrainMarketingSections,
  BrainReportContent,
  CeoReportType,
  DesignReportType,
  MarketingReportType,
  ResearchReportType,
} from "@/brain/domains/reports";
import type { BrainRecord } from "@/brain/types";
import type { ReportCategory, ReportListItem } from "@/lib/mock/reports";
import type { AgentId } from "@/lib/constants/agents";

function mapAgentToCategory(agentId: AgentId): ReportCategory {
  switch (agentId) {
    case "research":
      return "research";
    case "designer":
      return "design";
    case "marketing":
      return "marketing";
    case "ceo":
    case "shopify":
    case "content":
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

export function brainReportRecordToListItem(
  record: BrainRecord<"reports">,
): ReportListItem {
  const content = record.content as BrainReportContent;
  const researchSections = content.researchSections;
  const ceoSections = content.ceoSections;
  const designSections = content.designSections;
  const marketingSections = content.marketingSections;
  const reportType:
    | ResearchReportType
    | CeoReportType
    | DesignReportType
    | MarketingReportType
    | undefined = content.reportType ?? inferReportTypeFromTags(record.tags);

  const isCeoReport = reportType === "ceo-report" || content.agentId === "ceo";
  const isDesignReport =
    reportType === "design-report" || content.agentId === "designer";
  const isMarketingReport =
    reportType === "marketing-report" || content.agentId === "marketing";

  return {
    id: content.reportId,
    title: record.title,
    summary: isMarketingReport
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
    highlights: isMarketingReport
      ? marketingSections?.contentPillars
      : isDesignReport
        ? designSections?.silhouettes
        : isCeoReport
          ? ceoSections?.keyInsights
          : researchSections?.keyFindings ?? content.keyFindings,
    reportType: isMarketingReport
      ? "marketing-report"
      : isDesignReport
        ? "design-report"
        : isCeoReport
          ? "ceo-report"
          : reportType,
    executiveSummary: isMarketingReport
      ? marketingSections?.launchStrategy ?? content.summary
      : isDesignReport
        ? designSections?.collectionStory ?? content.summary
        : ceoSections?.executiveSummary ??
          researchSections?.executiveSummary ??
          content.summary,
    recommendations: isMarketingReport
      ? marketingSections?.contentPillars
      : isCeoReport || isDesignReport
        ? isDesignReport
          ? designSections?.launchRecommendations
          : undefined
        : researchSections?.recommendations,
    opportunities: isCeoReport
      ? ceoSections?.strategicOpportunities
      : researchSections?.opportunities,
    risks: isCeoReport ? ceoSections?.risks : researchSections?.risks,
    nextSteps: isCeoReport ? mapCeoNextSteps(ceoSections?.nextSteps) : undefined,
    sourceReportTitles: isMarketingReport
      ? marketingSections?.sourceReportTitles
      : isDesignReport
        ? designSections?.sourceReportTitles
        : ceoSections?.sourceReportTitles,
    designReport: isDesignReport ? mapDesignSections(designSections) : undefined,
    marketingReport: isMarketingReport
      ? mapMarketingSections(marketingSections)
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
