import "server-only";

import { AGENT_CATALOG } from "@/lib/constants/agents";
import type { AgentId } from "@/lib/constants/agents";
import { buildCommerceLabPayload } from "@/lib/commerce/commerce-lab-intelligence";
import { loadHistoricalIntelligence } from "@/lib/commerce/historical-intelligence";
import type { FacilitySnapshot } from "@/lib/facility/types";
import type {
  KnowledgeVaultCommandBar,
  KnowledgeVaultPayload,
  KnowledgeVaultReportCard,
  KnowledgeVaultReportStatus,
  KnowledgeVaultSection,
  KnowledgeVaultSectionId,
  KnowledgeVaultSubsection,
  KnowledgeVaultTimelineEvent,
} from "@/lib/facility/knowledge-vault-types";
import { MOCK_REPORTS, type ReportListItem } from "@/lib/mock/reports";
import { AGENT_STUDIO_NAMES } from "@/lib/workspace/agent-routes";
import { loadCommerceIntelligenceSafe } from "@/lib/shopify/commerce-intelligence";
import { fetchShopifyKnowledge } from "@/lib/shopify/knowledge";
import type { TaskListItem } from "@/tasks/types";

const SECTION_DEFINITIONS: Array<
  Omit<KnowledgeVaultSection, "count"> & { categories: string[] }
> = [
  {
    id: "commerce",
    label: "Commerce Intelligence",
    categories: ["commerce", "shopify", "operations"],
    subsections: [
      { id: "revenue", label: "Revenue Reports" },
      { id: "product_performance", label: "Product Performance" },
      { id: "seasonal", label: "Seasonal Insights" },
      { id: "category", label: "Category Analysis" },
    ],
  },
  {
    id: "research",
    label: "Research Intelligence",
    categories: ["research"],
    subsections: [
      { id: "trends", label: "Trend Reports" },
      { id: "competitors", label: "Competitor Reports" },
      { id: "market", label: "Market Analysis" },
    ],
  },
  {
    id: "design",
    label: "Design Archive",
    categories: ["design", "image"],
    subsections: [
      { id: "collections", label: "Collection Concepts" },
      { id: "moodboards", label: "Moodboards" },
      { id: "color", label: "Color Directions" },
    ],
  },
  {
    id: "marketing",
    label: "Marketing Intelligence",
    categories: ["marketing", "content"],
    subsections: [
      { id: "campaigns", label: "Campaign Ideas" },
      { id: "hooks", label: "Hooks" },
      { id: "copy", label: "Copy Systems" },
    ],
  },
  {
    id: "agents",
    label: "Agent Reports",
    categories: ["ceo"],
    subsections: [
      { id: "missions", label: "Completed Missions" },
      { id: "outputs", label: "Generated Outputs" },
      { id: "decisions", label: "Decisions" },
    ],
  },
];

const SUBSECTION_PATTERNS: Array<{
  subsection: KnowledgeVaultSubsection;
  pattern: RegExp;
}> = [
  { subsection: "revenue", pattern: /revenue|sales|financial|readiness|commerce analysis/i },
  { subsection: "product_performance", pattern: /product|sku|bestseller|performance|catalog/i },
  { subsection: "seasonal", pattern: /season|quarter|drop window|summer|winter|spring|fall/i },
  { subsection: "category", pattern: /category|segment|breakdown/i },
  { subsection: "trends", pattern: /trend|landscape|signal|revival|radar/i },
  { subsection: "competitors", pattern: /competitor|competitive|rival/i },
  { subsection: "market", pattern: /market|positioning|brief|analysis/i },
  { subsection: "collections", pattern: /collection|capsule|line sheet|drop/i },
  { subsection: "moodboards", pattern: /mood|board|direction|concept/i },
  { subsection: "color", pattern: /color|palette|colorway/i },
  { subsection: "campaigns", pattern: /campaign|launch plan|launch/i },
  { subsection: "hooks", pattern: /hook|tiktok|reels|social/i },
  { subsection: "copy", pattern: /copy|email|sequence|content|sms/i },
  { subsection: "missions", pattern: /mission|task|execution/i },
  { subsection: "outputs", pattern: /output|deliverable|generated|package/i },
  { subsection: "decisions", pattern: /decision|ceo|synthesis|assessment|verdict/i },
];

function agentName(agentId: AgentId): string {
  return AGENT_CATALOG[agentId]?.name ?? agentId;
}

function mapStatus(status: ReportListItem["status"]): KnowledgeVaultReportStatus {
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

function sectionForReport(report: ReportListItem): KnowledgeVaultSectionId {
  if (report.agentId === "shopify") return "commerce";

  switch (report.category) {
    case "commerce":
      return "commerce";
    case "research":
      return "research";
    case "design":
    case "image":
      return "design";
    case "marketing":
    case "content":
      return "marketing";
    case "operations":
      return report.agentId === "ceo" ? "agents" : "commerce";
    default:
      return report.agentId === "ceo" ? "agents" : "research";
  }
}

function departmentForReport(report: ReportListItem): string {
  if (report.category === "commerce" || report.agentId === "shopify") {
    return "Commerce Lab";
  }
  if (report.agentId === "ceo") return AGENT_STUDIO_NAMES.ceo;
  return AGENT_STUDIO_NAMES[report.agentId] ?? report.category;
}

function inferSubsection(
  report: ReportListItem,
  sectionId: KnowledgeVaultSectionId,
): KnowledgeVaultSubsection {
  const haystack = `${report.title} ${report.summary}`;
  const sectionDef = SECTION_DEFINITIONS.find((s) => s.id === sectionId);
  const allowed = new Set(sectionDef?.subsections.map((s) => s.id));

  for (const { subsection, pattern } of SUBSECTION_PATTERNS) {
    if (allowed.has(subsection) && pattern.test(haystack)) {
      return subsection;
    }
  }

  return sectionDef?.subsections[0]?.id ?? "outputs";
}

function reportToCard(report: ReportListItem): KnowledgeVaultReportCard {
  const sectionId = sectionForReport(report);
  return {
    id: report.id,
    title: report.title,
    department: departmentForReport(report),
    date: report.createdAt,
    authorAgent: agentName(report.agentId),
    status: mapStatus(report.status),
    sectionId,
    subsection: inferSubsection(report, sectionId),
    summary: report.summary,
    tags: report.highlights?.slice(0, 3),
  };
}

function taskToAgentCard(task: TaskListItem): KnowledgeVaultReportCard | null {
  if (task.status !== "completed" && task.status !== "review") return null;

  const agentId = task.assigneeAgentId ?? "ceo";
  const subsection: KnowledgeVaultSubsection =
    task.status === "completed" ? "missions" : "outputs";

  return {
    id: `task-${task.id}`,
    title: task.title,
    department:
      agentId !== "ceo" ? AGENT_STUDIO_NAMES[agentId] : AGENT_STUDIO_NAMES.ceo,
    date: task.completedAt ?? task.updatedAt,
    authorAgent: agentName(agentId),
    status: task.status === "completed" ? "approved" : "pending_review",
    sectionId: "agents",
    subsection,
    summary: task.description ?? undefined,
    tags: task.status === "completed" ? ["mission complete"] : ["awaiting review"],
  };
}

async function buildCommerceCards(): Promise<KnowledgeVaultReportCard[]> {
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

    const cards: KnowledgeVaultReportCard[] = [];
    const now = lab.loadedAt;

    if (lab.revenue.totalRevenue > 0) {
      cards.push({
        id: "commerce-revenue",
        title: "Revenue Intelligence Summary",
        department: "Commerce Lab",
        date: now,
        authorAgent: "Commerce Intelligence",
        status: "approved",
        sectionId: "commerce",
        subsection: "revenue",
        summary: `${lab.revenue.currency} ${Math.round(lab.revenue.totalRevenue).toLocaleString()} total · ${lab.revenue.totalOrders} orders · ${lab.revenue.revenueGrowthLabel}`,
        tags: ["live data", "revenue"],
      });
    }

    const topProduct = lab.products.bestsellers[0];
    if (topProduct) {
      cards.push({
        id: "commerce-product-top",
        title: `Product Performance — ${topProduct.title}`,
        department: "Commerce Lab",
        date: now,
        authorAgent: "Commerce Intelligence",
        status: "approved",
        sectionId: "commerce",
        subsection: "product_performance",
        summary: `${topProduct.unitsSold} units · ${Math.round(topProduct.revenue).toLocaleString()} revenue · rank #${topProduct.bestsellerRank}`,
        tags: ["bestseller"],
      });
    }

    if (lab.seasonal.strongestSeason) {
      cards.push({
        id: "commerce-seasonal",
        title: `Seasonal Pattern — ${lab.seasonal.strongestSeason.season}`,
        department: "Commerce Lab",
        date: now,
        authorAgent: "Commerce Intelligence",
        status: "approved",
        sectionId: "commerce",
        subsection: "seasonal",
        summary: `Peak season ${lab.seasonal.strongestSeason.season} · ${Math.round(lab.seasonal.strongestSeason.revenue).toLocaleString()} revenue`,
        tags: lab.seasonal.suggestedDropWindows.slice(0, 2),
      });
    }

    const topCategory = lab.categories.revenueByCategory[0];
    if (topCategory) {
      cards.push({
        id: "commerce-category",
        title: `Category Analysis — ${topCategory.category}`,
        department: "Commerce Lab",
        date: now,
        authorAgent: "Commerce Intelligence",
        status: "approved",
        sectionId: "commerce",
        subsection: "category",
        summary: `${topCategory.sharePercent}% revenue share · ${topCategory.productCount} SKUs · ${topCategory.unitsSold} units`,
        tags: ["category intel"],
      });
    }

    return cards;
  } catch {
    return [];
  }
}

function buildTimeline(
  snapshot: FacilitySnapshot,
  reports: KnowledgeVaultReportCard[],
  tasks: TaskListItem[],
): KnowledgeVaultTimelineEvent[] {
  const events: KnowledgeVaultTimelineEvent[] = [];

  for (const event of snapshot.events.slice(0, 8)) {
    const kind = inferTimelineKind(event.summary, event.actorId);
    events.push({
      id: event.id,
      message: event.summary,
      department:
        event.actorType === "agent"
          ? AGENT_STUDIO_NAMES[event.actorId as AgentId] ?? event.actorId
          : "HQ Command",
      timestamp: event.timestamp,
      kind,
    });
  }

  for (const report of reports.filter((r) => r.status === "approved").slice(0, 6)) {
    events.push({
      id: `timeline-${report.id}`,
      message: timelineMessageForReport(report),
      department: report.department,
      timestamp: report.date,
      kind: timelineKindForSection(report.sectionId),
    });
  }

  for (const task of tasks.filter((t) => t.status === "completed").slice(0, 4)) {
    events.push({
      id: `timeline-task-${task.id}`,
      message: `Mission completed — ${task.title}`,
      department:
        task.assigneeAgentId != null
          ? AGENT_STUDIO_NAMES[task.assigneeAgentId]
          : AGENT_STUDIO_NAMES.ceo,
      timestamp: task.completedAt ?? task.updatedAt,
      kind: "mission",
    });
  }

  const fallback: KnowledgeVaultTimelineEvent[] = [
    {
      id: "fallback-research",
      message: "Research delivered.",
      department: AGENT_STUDIO_NAMES.research,
      timestamp: snapshot.refreshedAt,
      kind: "research",
    },
    {
      id: "fallback-commerce",
      message: "Commerce report generated.",
      department: "Commerce Lab",
      timestamp: snapshot.refreshedAt,
      kind: "commerce",
    },
    {
      id: "fallback-design",
      message: "Design concept approved.",
      department: AGENT_STUDIO_NAMES.designer,
      timestamp: snapshot.refreshedAt,
      kind: "design",
    },
  ];

  const merged = [...events, ...fallback];
  const seen = new Set<string>();

  return merged
    .filter((item) => {
      const key = `${item.message}-${item.timestamp}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    )
    .slice(0, 12);
}

function inferTimelineKind(
  summary: string,
  actorId: string,
): KnowledgeVaultTimelineEvent["kind"] {
  if (/commerce|revenue|shopify|product/i.test(summary)) return "commerce";
  if (/design|mood|collection|color/i.test(summary)) return "design";
  if (/marketing|campaign|copy/i.test(summary)) return "marketing";
  if (/research|trend|competitor|market/i.test(summary)) return "research";
  if (/mission|task|ceo|decision/i.test(summary)) return "mission";
  if (actorId === "ceo") return "agent";
  return "agent";
}

function timelineKindForSection(
  sectionId: KnowledgeVaultSectionId,
): KnowledgeVaultTimelineEvent["kind"] {
  switch (sectionId) {
    case "commerce":
      return "commerce";
    case "design":
      return "design";
    case "marketing":
      return "marketing";
    case "research":
      return "research";
    default:
      return "agent";
  }
}

function timelineMessageForReport(report: KnowledgeVaultReportCard): string {
  switch (report.sectionId) {
    case "research":
      return `Research delivered — ${report.title}`;
    case "commerce":
      return `Commerce report generated — ${report.title}`;
    case "design":
      return report.status === "approved"
        ? `Design concept approved — ${report.title}`
        : `Design archive updated — ${report.title}`;
    case "marketing":
      return `Marketing intelligence filed — ${report.title}`;
    default:
      return `Agent output archived — ${report.title}`;
  }
}

function buildSections(reports: KnowledgeVaultReportCard[]): KnowledgeVaultSection[] {
  return SECTION_DEFINITIONS.map(({ categories: _categories, ...section }) => ({
    ...section,
    count: reports.filter((r) => r.sectionId === section.id).length,
  }));
}

function buildCommandBar(
  reports: KnowledgeVaultReportCard[],
  snapshot: FacilitySnapshot,
): KnowledgeVaultCommandBar {
  const agents = new Set(reports.map((r) => r.authorAgent));
  return {
    totalEntries: reports.length,
    sectionsIndexed: SECTION_DEFINITIONS.filter((s) =>
      reports.some((r) => r.sectionId === s.id),
    ).length,
    agentsContributing: agents.size,
    lastSync: snapshot.refreshedAt,
  };
}

function seedReportsIfEmpty(reports: ReportListItem[]): ReportListItem[] {
  if (reports.length > 0) return reports;
  return MOCK_REPORTS;
}

export async function buildKnowledgeVaultPayload(
  snapshot: FacilitySnapshot,
  tasks: TaskListItem[],
  brainReports: ReportListItem[],
): Promise<KnowledgeVaultPayload> {
  const sourceReports = seedReportsIfEmpty(brainReports);
  const reportCards = sourceReports.map(reportToCard);
  const taskCards = tasks
    .map(taskToAgentCard)
    .filter((card): card is KnowledgeVaultReportCard => card != null);
  const commerceCards = await buildCommerceCards();

  const reports = [...commerceCards, ...reportCards, ...taskCards].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

  return {
    commandBar: buildCommandBar(reports, snapshot),
    sections: buildSections(reports),
    reports,
    timeline: buildTimeline(snapshot, reports, tasks),
    futureModules: [
      "Vector Memory",
      "AI Search",
      "Semantic Knowledge Graph",
      "Shared Agent Memory",
    ],
    loadedAt: new Date().toISOString(),
  };
}
