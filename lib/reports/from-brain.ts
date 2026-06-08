import type { BrainReportContent } from "@/brain/domains/reports";
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
  const types = ["competitor", "trend", "design", "pricing", "audience"] as const;
  return types.find((type) => tags.includes(type));
}

export function brainReportRecordToListItem(
  record: BrainRecord<"reports">,
): ReportListItem {
  const content = record.content as BrainReportContent;
  const sections = content.researchSections;
  const reportType =
    content.reportType ?? inferReportTypeFromTags(record.tags);

  return {
    id: content.reportId,
    title: record.title,
    summary: sections?.executiveSummary ?? content.summary,
    category: mapAgentToCategory(content.agentId),
    agentId: content.agentId,
    status: mapBrainStatusToUi(record.status, content.status),
    confidence: content.confidence,
    createdAt: record.createdAt,
    highlights: sections?.keyFindings ?? content.keyFindings,
    reportType,
    executiveSummary: sections?.executiveSummary ?? content.summary,
    recommendations: sections?.recommendations,
    opportunities: sections?.opportunities,
    risks: sections?.risks,
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
