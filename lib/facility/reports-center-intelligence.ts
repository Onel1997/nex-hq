import "server-only";

import { AGENT_CATALOG } from "@/lib/constants/agents";
import type { AgentId } from "@/lib/constants/agents";
import { buildCommerceLabPayload } from "@/lib/commerce/commerce-lab-intelligence";
import { loadHistoricalIntelligence } from "@/lib/commerce/historical-intelligence";
import type { FacilitySnapshot } from "@/lib/facility/types";
import type {
  ReportsCenterActivityItem,
  ReportsCenterCommandBar,
  ReportsCenterLinkedMission,
  ReportsCenterPayload,
  ReportsCenterPreview,
  ReportsCenterReport,
  ReportsCenterStatus,
  ReportsCenterType,
  ReportsCenterTypeFilter,
} from "@/lib/facility/reports-center-types";
import { MOCK_REPORTS, type ReportListItem } from "@/lib/mock/reports";
import { AGENT_STUDIO_NAMES } from "@/lib/workspace/agent-routes";
import { loadCommerceIntelligenceSafe } from "@/lib/shopify/commerce-intelligence";
import { fetchShopifyKnowledge } from "@/lib/shopify/knowledge";
import type { TaskListItem } from "@/tasks/types";

const TYPE_LABELS: Record<ReportsCenterType, string> = {
  commerce: "Commerce Reports",
  research: "Research Reports",
  design: "Design Reports",
  marketing: "Marketing Reports",
  ceo_briefing: "CEO Briefings",
  mission_summary: "Mission Summaries",
};

const CEO_BRIEFING_TEMPLATES = [
  {
    id: "ceo-brief-summer",
    title: "Summer Collection Brief",
    tags: ["collection", "seasonal", "executive"],
  },
  {
    id: "ceo-brief-commerce",
    title: "Commerce Analysis",
    tags: ["revenue", "commerce", "executive"],
  },
  {
    id: "ceo-brief-trend",
    title: "Trend Opportunity Report",
    tags: ["trends", "market", "executive"],
  },
  {
    id: "ceo-brief-seasonal",
    title: "Seasonal Strategy",
    tags: ["seasonal", "strategy", "executive"],
  },
] as const;

function agentName(agentId: AgentId): string {
  return AGENT_CATALOG[agentId]?.name ?? agentId;
}

function mapStatus(status: ReportListItem["status"]): ReportsCenterStatus {
  switch (status) {
    case "approved":
      return "approved";
    case "pending_review":
    case "revision_requested":
      return "pending_review";
    case "archived":
      return "archived";
    case "rejected":
      return "classified";
    default:
      return "draft";
  }
}

function reportType(report: ReportListItem): ReportsCenterType {
  if (report.agentId === "ceo" || report.ceoFinalReport) return "ceo_briefing";
  if (report.agentId === "shopify" || report.category === "commerce") return "commerce";
  if (report.category === "research") return "research";
  if (report.category === "design" || report.category === "image") return "design";
  if (report.category === "marketing" || report.category === "content") return "marketing";
  if (report.category === "operations") return "ceo_briefing";
  return "research";
}

function departmentForReport(report: ReportListItem): string {
  if (report.category === "commerce" || report.agentId === "shopify") {
    return "Commerce Lab";
  }
  if (report.agentId === "ceo") return AGENT_STUDIO_NAMES.ceo;
  return AGENT_STUDIO_NAMES[report.agentId] ?? report.category;
}

function connectedDepartments(
  type: ReportsCenterType,
  report: ReportListItem,
): string[] {
  const base = [departmentForReport(report)];

  switch (type) {
    case "commerce":
      return [...base, AGENT_STUDIO_NAMES.ceo, AGENT_STUDIO_NAMES.shopify];
    case "research":
      return [...base, AGENT_STUDIO_NAMES.designer, AGENT_STUDIO_NAMES.ceo];
    case "design":
      return [...base, AGENT_STUDIO_NAMES.image, AGENT_STUDIO_NAMES.marketing];
    case "marketing":
      return [...base, AGENT_STUDIO_NAMES.content, AGENT_STUDIO_NAMES.ceo];
    case "ceo_briefing":
      return [
        AGENT_STUDIO_NAMES.ceo,
        AGENT_STUDIO_NAMES.research,
        AGENT_STUDIO_NAMES.designer,
        AGENT_STUDIO_NAMES.marketing,
      ];
    case "mission_summary":
      return [...base, AGENT_STUDIO_NAMES.ceo];
    default:
      return base;
  }
}

function buildTags(report: ReportListItem): string[] {
  const tags = new Set<string>();
  if (report.drop) tags.add(report.drop);
  if (report.category) tags.add(report.category);
  report.highlights?.slice(0, 2).forEach((h) => {
    const word = h.split(" ")[0]?.toLowerCase();
    if (word && word.length > 3) tags.add(word);
  });
  if (report.status === "approved") tags.add("approved");
  return [...tags].slice(0, 5);
}

function buildPreview(
  report: ReportListItem,
  type: ReportsCenterType,
  tasks: TaskListItem[],
): ReportsCenterPreview {
  const linkedMissions: ReportsCenterLinkedMission[] = [];

  if (report.originTaskId) {
    const task = tasks.find((t) => t.id === report.originTaskId);
    linkedMissions.push({
      id: report.originTaskId,
      title: task?.title ?? "Linked mission",
    });
  }

  if (report.ceoFinalReport?.sourceTaskIds?.length) {
    for (const taskId of report.ceoFinalReport.sourceTaskIds.slice(0, 4)) {
      const task = tasks.find((t) => t.id === taskId);
      if (task) linkedMissions.push({ id: task.id, title: task.title });
    }
  }

  const keyFindings =
    report.ceoFinalReport?.keyFindings ??
    report.highlights ??
    report.opportunities ??
    (report.summary ? [report.summary] : []);

  const marketingLaunch = report.marketingReport?.launchStrategy;

  const recommendations =
    report.recommendations ??
    report.nextSteps?.map((step) => step.action) ??
    report.ceoFinalReport?.recommendedActions?.map((action) => action.action) ??
    report.designReport?.launchRecommendations ??
    (marketingLaunch ? [marketingLaunch] : []);

  return {
    executiveSummary:
      report.executiveSummary ??
      report.ceoFinalReport?.executiveSummary ??
      report.summary,
    keyFindings: keyFindings.slice(0, 6),
    recommendations: recommendations.slice(0, 6),
    linkedMissions,
    connectedDepartments: connectedDepartments(type, report),
  };
}

function reportToCenterReport(
  report: ReportListItem,
  tasks: TaskListItem[],
): ReportsCenterReport {
  const type = reportType(report);
  return {
    id: report.id,
    title: report.title,
    department: departmentForReport(report),
    agent: agentName(report.agentId),
    date: report.createdAt,
    status: mapStatus(report.status),
    confidence: report.confidence,
    tags: buildTags(report),
    type,
    isCeoBriefing: type === "ceo_briefing",
    preview: buildPreview(report, type, tasks),
  };
}

function taskToMissionSummary(
  task: TaskListItem,
): ReportsCenterReport | null {
  if (task.status !== "completed" && task.status !== "review") return null;

  const agentId = task.assigneeAgentId ?? "ceo";

  return {
    id: `mission-${task.id}`,
    title: `Mission Summary — ${task.title}`,
    department:
      agentId !== "ceo" ? AGENT_STUDIO_NAMES[agentId] : AGENT_STUDIO_NAMES.ceo,
    agent: agentName(agentId),
    date: task.completedAt ?? task.updatedAt,
    status: task.status === "completed" ? "approved" : "pending_review",
    confidence: task.status === "completed" ? 0.92 : 0.75,
    tags: ["mission", task.status === "completed" ? "complete" : "review"],
    type: "mission_summary",
    preview: {
      executiveSummary: task.description ?? `Mission ${task.title} execution summary.`,
      keyFindings: task.description ? [task.description] : ["Mission deliverables archived."],
      recommendations: ["Review outputs in Knowledge Vault", "Assign follow-up mission if needed"],
      linkedMissions: [{ id: task.id, title: task.title }],
      connectedDepartments: [
        agentId !== "ceo" ? AGENT_STUDIO_NAMES[agentId] : AGENT_STUDIO_NAMES.ceo,
        AGENT_STUDIO_NAMES.ceo,
      ],
    },
  };
}

async function buildCommerceReports(): Promise<ReportsCenterReport[]> {
  try {
    const knowledge = await fetchShopifyKnowledge();
    const [commerce, historical] = await Promise.all([
      loadCommerceIntelligenceSafe(knowledge),
      loadHistoricalIntelligence(knowledge).catch(() => null),
    ]);
    const lab = buildCommerceLabPayload(
      commerce,
      historical?.summary.totalOrders ? historical : commerce.import,
    );

    if (lab.revenue.totalRevenue <= 0) return [];

    const now = lab.loadedAt;
    const reports: ReportsCenterReport[] = [
      {
        id: "commerce-report-revenue",
        title: "Commerce Revenue Analysis",
        department: "Commerce Lab",
        agent: "Commerce Intelligence",
        date: now,
        status: "approved",
        confidence: 0.94,
        tags: ["revenue", "commerce", "live data"],
        type: "commerce",
        preview: {
          executiveSummary: `${lab.revenue.currency} ${Math.round(lab.revenue.totalRevenue).toLocaleString()} total revenue across ${lab.revenue.totalOrders} orders. ${lab.revenue.revenueGrowthLabel}.`,
          keyFindings: [
            `Average order value: ${Math.round(lab.revenue.averageOrderValue).toLocaleString()} ${lab.revenue.currency}`,
            `Total units sold: ${lab.revenue.totalUnits.toLocaleString()}`,
            lab.revenue.revenueGrowthLabel,
          ],
          recommendations: lab.recommendations.slice(0, 3).map((r) => r.message),
          linkedMissions: [],
          connectedDepartments: [
            "Commerce Lab",
            AGENT_STUDIO_NAMES.ceo,
            AGENT_STUDIO_NAMES.shopify,
          ],
        },
      },
    ];

    const topProduct = lab.products.bestsellers[0];
    if (topProduct) {
      reports.push({
        id: "commerce-report-product",
        title: `Product Performance — ${topProduct.title}`,
        department: "Commerce Lab",
        agent: "Commerce Intelligence",
        date: now,
        status: "approved",
        confidence: 0.9,
        tags: ["product", "bestseller"],
        type: "commerce",
        preview: {
          executiveSummary: `${topProduct.title} leads performance with ${topProduct.unitsSold} units and ${Math.round(topProduct.revenue).toLocaleString()} revenue.`,
          keyFindings: [
            `Bestseller rank #${topProduct.bestsellerRank}`,
            `Category: ${topProduct.category}`,
            `Historical score: ${topProduct.historicalScore}`,
          ],
          recommendations: lab.ceoInsights.slice(0, 2).map((i) => i.message),
          linkedMissions: [],
          connectedDepartments: [
            "Commerce Lab",
            AGENT_STUDIO_NAMES.designer,
            AGENT_STUDIO_NAMES.marketing,
          ],
        },
      });
    }

    return reports;
  } catch {
    return [];
  }
}

function buildCeoBriefings(
  reports: ReportsCenterReport[],
  snapshot: FacilitySnapshot,
): ReportsCenterReport[] {
  const research = reports.filter((r) => r.type === "research");
  const design = reports.filter((r) => r.type === "design");
  const marketing = reports.filter((r) => r.type === "marketing");
  const commerce = reports.filter((r) => r.type === "commerce");
  const now = snapshot.refreshedAt;

  return CEO_BRIEFING_TEMPLATES.map((template) => {
    let preview: ReportsCenterPreview;
    let confidence = 0.88;

    switch (template.id) {
      case "ceo-brief-summer":
        preview = {
          executiveSummary:
            design[0]?.preview.executiveSummary ??
            marketing[0]?.preview.executiveSummary ??
            "Summer collection direction synthesized from design and marketing intelligence.",
          keyFindings: [
            ...(design[0]?.preview.keyFindings.slice(0, 2) ?? ["Collection concepts in review"]),
            ...(marketing[0]?.preview.keyFindings.slice(0, 1) ?? ["Campaign window identified"]),
          ],
          recommendations: [
            "Approve hero SKU direction before asset production",
            "Align drop timing with seasonal peak",
            "Brief Image Studio for lookbook capture",
          ],
          linkedMissions: [
            ...design[0]?.preview.linkedMissions ?? [],
            ...marketing[0]?.preview.linkedMissions ?? [],
          ].slice(0, 3),
          connectedDepartments: [
            AGENT_STUDIO_NAMES.ceo,
            AGENT_STUDIO_NAMES.designer,
            AGENT_STUDIO_NAMES.marketing,
            AGENT_STUDIO_NAMES.image,
          ],
        };
        confidence = 0.91;
        break;
      case "ceo-brief-commerce":
        preview = commerce[0]?.preview ?? {
          executiveSummary:
            "Commerce analysis pending live data sync. Historical patterns suggest Q2–Q3 peak window.",
          keyFindings: ["Connect Shopify for live revenue intelligence"],
          recommendations: ["Activate Commerce Lab sync", "Review category mix"],
          linkedMissions: [],
          connectedDepartments: [
            AGENT_STUDIO_NAMES.ceo,
            "Commerce Lab",
            AGENT_STUDIO_NAMES.shopify,
          ],
        };
        confidence = commerce[0]?.confidence ?? 0.85;
        break;
      case "ceo-brief-trend":
        preview = {
          executiveSummary:
            research[0]?.preview.executiveSummary ??
            "Trend opportunity scan across streetwear signals and competitor drops.",
          keyFindings:
            research.slice(0, 3).flatMap((r) => r.preview.keyFindings.slice(0, 1)).length > 0
              ? research.slice(0, 3).flatMap((r) => r.preview.keyFindings.slice(0, 1))
              : ["Streetwear drop windows compressing to 48 hours", "Signal colors gaining EU traction"],
          recommendations: [
            "Prioritize scarcity-driven drop mechanics",
            "Brief Design Studio on trend-aligned palette",
          ],
          linkedMissions: research.flatMap((r) => r.preview.linkedMissions).slice(0, 3),
          connectedDepartments: [
            AGENT_STUDIO_NAMES.ceo,
            AGENT_STUDIO_NAMES.research,
            AGENT_STUDIO_NAMES.designer,
          ],
        };
        confidence = research[0]?.confidence ?? 0.87;
        break;
      case "ceo-brief-seasonal":
      default:
        preview = {
          executiveSummary:
            commerce[0]?.preview.executiveSummary ??
            "Seasonal strategy aligned to revenue peaks and campaign readiness windows.",
          keyFindings: [
            commerce[0]?.preview.keyFindings[0] ?? "Peak season analysis in progress",
            marketing[0]?.preview.keyFindings[0] ?? "Campaign tease window: 7 days pre-drop",
          ],
          recommendations: [
            "Schedule drop during strongest revenue month",
            "Pre-build VIP email sequence 2 weeks ahead",
            "Reserve paid budget for retargeting only",
          ],
          linkedMissions: [
            ...(commerce[0]?.preview.linkedMissions ?? []),
            ...(marketing[0]?.preview.linkedMissions ?? []),
          ].slice(0, 3),
          connectedDepartments: [
            AGENT_STUDIO_NAMES.ceo,
            "Commerce Lab",
            AGENT_STUDIO_NAMES.marketing,
          ],
        };
        confidence = 0.9;
        break;
    }

    return {
      id: template.id,
      title: template.title,
      department: AGENT_STUDIO_NAMES.ceo,
      agent: agentName("ceo"),
      date: now,
      status: "approved",
      confidence,
      tags: [...template.tags],
      type: "ceo_briefing",
      isCeoBriefing: true,
      preview,
    };
  });
}

function buildActivityFeed(
  snapshot: FacilitySnapshot,
  reports: ReportsCenterReport[],
): ReportsCenterActivityItem[] {
  const fromEvents: ReportsCenterActivityItem[] = snapshot.events
    .slice(0, 6)
    .map((event) => ({
      id: event.id,
      message: activityMessage(event.summary),
      department:
        event.actorType === "agent"
          ? AGENT_STUDIO_NAMES[event.actorId as AgentId] ?? event.actorId
          : "HQ Command",
      timestamp: event.timestamp,
      kind: inferActivityKind(event.summary),
    }));

  for (const report of reports.filter((r) => r.status === "approved").slice(0, 4)) {
    fromEvents.push({
      id: `activity-${report.id}`,
      message: activityMessageForReport(report),
      department: report.department,
      timestamp: report.date,
      kind: report.type,
    });
  }

  const fallback: ReportsCenterActivityItem[] = [
    {
      id: "activity-research",
      message: "Research completed.",
      department: AGENT_STUDIO_NAMES.research,
      timestamp: snapshot.refreshedAt,
      kind: "research",
    },
    {
      id: "activity-commerce",
      message: "Commerce analysis generated.",
      department: "Commerce Lab",
      timestamp: snapshot.refreshedAt,
      kind: "commerce",
    },
    {
      id: "activity-design",
      message: "Design report approved.",
      department: AGENT_STUDIO_NAMES.designer,
      timestamp: snapshot.refreshedAt,
      kind: "design",
    },
  ];

  const merged = [...fromEvents, ...fallback];
  const seen = new Set<string>();

  return merged
    .filter((item) => {
      const key = item.message;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    )
    .slice(0, 10);
}

function activityMessage(summary: string): string {
  if (/research|trend/i.test(summary)) return "Research completed.";
  if (/commerce|revenue|shopify/i.test(summary)) return "Commerce analysis generated.";
  if (/design|mood|collection/i.test(summary)) return "Design report approved.";
  if (/marketing|campaign/i.test(summary)) return "Marketing strategy filed.";
  return summary;
}

function activityMessageForReport(report: ReportsCenterReport): string {
  switch (report.type) {
    case "research":
      return "Research completed.";
    case "commerce":
      return "Commerce analysis generated.";
    case "design":
      return report.status === "approved"
        ? "Design report approved."
        : "Design report submitted.";
    case "marketing":
      return "Marketing strategy filed.";
    case "mission_summary":
      return "Mission summary archived.";
    default:
      return `${report.title} published.`;
  }
}

function inferActivityKind(summary: string): ReportsCenterActivityItem["kind"] {
  if (/commerce|revenue/i.test(summary)) return "commerce";
  if (/design|mood/i.test(summary)) return "design";
  if (/marketing|campaign/i.test(summary)) return "marketing";
  if (/mission|task/i.test(summary)) return "mission";
  return "research";
}

function buildTypeFilters(reports: ReportsCenterReport[]): ReportsCenterTypeFilter[] {
  const types: ReportsCenterType[] = [
    "commerce",
    "research",
    "design",
    "marketing",
    "ceo_briefing",
    "mission_summary",
  ];

  return [
    { id: "all", label: "All Reports", count: reports.length },
    ...types.map((id) => ({
      id,
      label: TYPE_LABELS[id],
      count: reports.filter((r) => r.type === id).length,
    })),
  ];
}

function buildCommandBar(
  reports: ReportsCenterReport[],
  ceoBriefings: ReportsCenterReport[],
  snapshot: FacilitySnapshot,
): ReportsCenterCommandBar {
  return {
    totalReports: reports.length,
    approved: reports.filter((r) => r.status === "approved").length,
    pendingReview: reports.filter((r) => r.status === "pending_review").length,
    ceoBriefings: ceoBriefings.length,
    lastSync: snapshot.refreshedAt,
  };
}

function seedReportsIfEmpty(reports: ReportListItem[]): ReportListItem[] {
  if (reports.length > 0) return reports;
  return MOCK_REPORTS;
}

export async function buildReportsCenterPayload(
  snapshot: FacilitySnapshot,
  tasks: TaskListItem[],
  brainReports: ReportListItem[],
): Promise<ReportsCenterPayload> {
  const sourceReports = seedReportsIfEmpty(brainReports);
  const reportCards = sourceReports.map((r) => reportToCenterReport(r, tasks));
  const missionSummaries = tasks
    .map(taskToMissionSummary)
    .filter((r): r is ReportsCenterReport => r != null);
  const commerceReports = await buildCommerceReports();

  const reports = [...commerceReports, ...reportCards, ...missionSummaries].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

  const ceoBriefings = buildCeoBriefings(reports, snapshot);
  const allReports = [...ceoBriefings, ...reports];

  return {
    commandBar: buildCommandBar(allReports, ceoBriefings, snapshot),
    types: buildTypeFilters(allReports),
    reports: allReports,
    ceoBriefings,
    activityFeed: buildActivityFeed(snapshot, allReports),
    exportModules: ["PDF", "Share", "Archive"],
    loadedAt: new Date().toISOString(),
  };
}
