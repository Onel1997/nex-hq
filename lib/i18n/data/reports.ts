import type {
  ReportCategory,
  ReportListItem,
  ReportReviewStatus,
} from "@/lib/mock/reports";
import type { Locale } from "../config";
import { getDictionary } from "../get-dictionary";

export function getReportCategoryLabels(
  locale: Locale,
): Record<ReportCategory, string> {
  const { common } = getDictionary(locale);
  return {
    research: common.reportCategory.research,
    design: common.reportCategory.design,
    marketing: common.reportCategory.marketing,
    operations: common.reportCategory.operations,
  };
}

export function getReportStatusLabel(
  locale: Locale,
  status: ReportReviewStatus,
): string {
  return getDictionary(locale).common.reportStatus[status];
}

export function getMockReports(locale: Locale): ReportListItem[] {
  const { reports } = getDictionary(locale);

  return [
    {
      id: "rpt-001",
      title: reports.items.rpt001.title,
      summary: reports.items.rpt001.summary,
      category: "research",
      agentId: "research",
      status: "submitted",
      confidence: 0.89,
      createdAt: "2026-06-07T14:00:00Z",
      drop: "SS26 Capsule",
      highlights: [...reports.items.rpt001.highlights],
    },
    {
      id: "rpt-002",
      title: reports.items.rpt002.title,
      summary: reports.items.rpt002.summary,
      category: "research",
      agentId: "research",
      status: "approved",
      confidence: 0.84,
      createdAt: "2026-06-05T11:30:00Z",
      drop: "SS26 Capsule",
      highlights: [...reports.items.rpt002.highlights],
    },
    {
      id: "rpt-003",
      title: reports.items.rpt003.title,
      summary: reports.items.rpt003.summary,
      category: "design",
      agentId: "designer",
      status: "submitted",
      confidence: 0.91,
      createdAt: "2026-06-06T16:45:00Z",
      drop: "SS26 Capsule",
      highlights: [...reports.items.rpt003.highlights],
    },
    {
      id: "rpt-004",
      title: reports.items.rpt004.title,
      summary: reports.items.rpt004.summary,
      category: "design",
      agentId: "designer",
      status: "draft",
      confidence: 0.78,
      createdAt: "2026-06-08T09:00:00Z",
      drop: "SS26 Capsule",
      highlights: [...reports.items.rpt004.highlights],
    },
    {
      id: "rpt-005",
      title: reports.items.rpt005.title,
      summary: reports.items.rpt005.summary,
      category: "marketing",
      agentId: "marketing",
      status: "approved",
      confidence: 0.93,
      createdAt: "2026-06-04T10:00:00Z",
      drop: "SS26 Capsule",
      highlights: [...reports.items.rpt005.highlights],
    },
    {
      id: "rpt-006",
      title: reports.items.rpt006.title,
      summary: reports.items.rpt006.summary,
      category: "marketing",
      agentId: "marketing",
      status: "submitted",
      confidence: 0.86,
      createdAt: "2026-06-07T08:30:00Z",
      drop: "SS26 Capsule",
      highlights: [...reports.items.rpt006.highlights],
    },
    {
      id: "rpt-007",
      title: reports.items.rpt007.title,
      summary: reports.items.rpt007.summary,
      category: "operations",
      agentId: "ceo",
      status: "approved",
      confidence: 0.95,
      createdAt: "2026-06-08T08:00:00Z",
      drop: "SS26 Capsule",
      highlights: [...reports.items.rpt007.highlights],
    },
  ];
}
