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

export function brainReportRecordToListItem(
  record: BrainRecord<"reports">,
): ReportListItem {
  const content = record.content as BrainReportContent;

  return {
    id: content.reportId,
    title: record.title,
    summary: content.summary,
    category: mapAgentToCategory(content.agentId),
    agentId: content.agentId,
    status: mapBrainStatusToUi(record.status, content.status),
    confidence: content.confidence,
    createdAt: record.createdAt,
    highlights: content.keyFindings,
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
