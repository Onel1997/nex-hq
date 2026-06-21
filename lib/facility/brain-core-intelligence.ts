import "server-only";

import type { AgentId } from "@/lib/constants/agents";
import { buildCommerceLabPayload } from "@/lib/commerce/commerce-lab-intelligence";
import { loadHistoricalIntelligence } from "@/lib/commerce/historical-intelligence";
import type { FacilitySnapshot, LabOpsState } from "@/lib/facility/types";
import type {
  BrainCoreAgentNode,
  BrainCoreCoreState,
  BrainCoreDecision,
  BrainCoreDecisionPriority,
  BrainCoreFeedItem,
  BrainCoreKnowledgeStream,
  BrainCoreMetrics,
  BrainCoreNodeStatus,
  BrainCorePayload,
} from "@/lib/facility/brain-core-types";
import { MOCK_REPORTS, type ReportListItem } from "@/lib/mock/reports";
import { AGENT_STUDIO_NAMES } from "@/lib/workspace/agent-routes";
import { loadCommerceIntelligenceSafe } from "@/lib/shopify/commerce-intelligence";
import { fetchShopifyKnowledge } from "@/lib/shopify/knowledge";
import type { TaskListItem } from "@/tasks/types";

const NODE_LAYOUT: Array<{ id: AgentId | "commerce"; label: string; angle: number }> = [
  { id: "ceo", label: AGENT_STUDIO_NAMES.ceo, angle: 0 },
  { id: "research", label: AGENT_STUDIO_NAMES.research, angle: 45 },
  { id: "commerce", label: "Commerce Lab", angle: 90 },
  { id: "designer", label: AGENT_STUDIO_NAMES.designer, angle: 135 },
  { id: "marketing", label: AGENT_STUDIO_NAMES.marketing, angle: 180 },
  { id: "content", label: AGENT_STUDIO_NAMES.content, angle: 225 },
  { id: "image", label: AGENT_STUDIO_NAMES.image, angle: 270 },
  { id: "shopify", label: AGENT_STUDIO_NAMES.shopify, angle: 315 },
];

const KNOWLEDGE_STREAM_DEFS: Array<Omit<BrainCoreKnowledgeStream, "active" | "signalCount">> = [
  { id: "stream-research-commerce", from: "Research HQ", to: "Commerce Lab" },
  { id: "stream-commerce-ceo", from: "Commerce Lab", to: "CEO Command" },
  { id: "stream-research-design", from: "Research HQ", to: "Design Studio" },
  { id: "stream-design-marketing", from: "Design Studio", to: "Marketing Center" },
  { id: "stream-marketing-ceo", from: "Marketing Center", to: "CEO Command" },
];

function mapOpsToNodeStatus(state: LabOpsState): BrainCoreNodeStatus {
  switch (state) {
    case "executing":
    case "review":
      return "processing";
    case "error":
      return "alert";
    case "queued":
    case "approved":
      return "online";
    default:
      return "idle";
  }
}

function buildNodes(snapshot: FacilitySnapshot): BrainCoreAgentNode[] {
  return NODE_LAYOUT.map((node) => {
    if (node.id === "commerce") {
      const commerceActive = snapshot.labs.shopify.opsState !== "idle";
      return {
        id: node.id,
        label: node.label,
        angle: node.angle,
        status: commerceActive ? "online" : "idle",
        activity: commerceActive ? "Analyzing revenue patterns" : null,
      };
    }

    const lab = snapshot.labs[node.id];
    return {
      id: node.id,
      label: node.label,
      angle: node.angle,
      status: mapOpsToNodeStatus(lab.opsState),
      activity:
        lab.presence.currentActivity !== "Awaiting deployment"
          ? lab.presence.currentActivity
          : lab.activeTask?.title ?? null,
    };
  });
}

function averageConfidence(reports: ReportListItem[]): number {
  if (reports.length === 0) return 0.87;
  const sum = reports.reduce((acc, r) => acc + r.confidence, 0);
  return Math.round((sum / reports.length) * 100);
}

function buildMetrics(
  snapshot: FacilitySnapshot,
  reports: ReportListItem[],
  decisions: BrainCoreDecision[],
): BrainCoreMetrics {
  const connectedAgents = buildNodes(snapshot).filter(
    (n) => n.status !== "idle",
  ).length;

  const neuralActivity = Math.min(
    100,
    snapshot.telemetry.activeExecutions * 18 +
      snapshot.events.length * 4 +
      connectedAgents * 6,
  );

  return {
    neuralActivity,
    connectedAgents,
    knowledgeSignals: reports.length + snapshot.events.length,
    activeDecisions: decisions.length,
    intelligenceLevel: snapshot.brain.completionPct || 72,
    confidenceScore: averageConfidence(reports),
  };
}

function deriveCoreState(
  snapshot: FacilitySnapshot,
  metrics: BrainCoreMetrics,
): BrainCoreCoreState {
  if (snapshot.ceo.opsState === "review" || snapshot.reviewQueue.length > 2) {
    return "synthesizing";
  }
  if (metrics.activeDecisions >= 3 || snapshot.telemetry.pendingReview > 0) {
    return "decision";
  }
  if (snapshot.telemetry.activeExecutions > 0) {
    return "processing";
  }
  if (metrics.knowledgeSignals > 5) {
    return "learning";
  }
  return "idle";
}

function buildFeed(
  snapshot: FacilitySnapshot,
  reports: ReportListItem[],
): BrainCoreFeedItem[] {
  const items: BrainCoreFeedItem[] = [];

  for (const event of snapshot.events.slice(0, 8)) {
    items.push({
      id: event.id,
      message: feedMessage(event.summary),
      timestamp: event.timestamp,
      kind: inferFeedKind(event.summary, event.actorId),
    });
  }

  for (const report of reports.slice(0, 4)) {
    items.push({
      id: `feed-report-${report.id}`,
      message: feedMessageForReport(report),
      timestamp: report.createdAt,
      kind: feedKindForCategory(report.category, report.agentId),
    });
  }

  const fallback: BrainCoreFeedItem[] = [
    {
      id: "feed-research",
      message: "Research signal detected.",
      timestamp: snapshot.refreshedAt,
      kind: "research",
    },
    {
      id: "feed-commerce",
      message: "Commerce anomaly detected.",
      timestamp: snapshot.refreshedAt,
      kind: "commerce",
    },
    {
      id: "feed-seasonal",
      message: "Seasonal opportunity identified.",
      timestamp: snapshot.refreshedAt,
      kind: "commerce",
    },
    {
      id: "feed-design",
      message: "Design recommendation generated.",
      timestamp: snapshot.refreshedAt,
      kind: "design",
    },
    {
      id: "feed-marketing",
      message: "Marketing strategy approved.",
      timestamp: snapshot.refreshedAt,
      kind: "marketing",
    },
    {
      id: "feed-ceo",
      message: "CEO decision issued.",
      timestamp: snapshot.refreshedAt,
      kind: "ceo",
    },
  ];

  const merged = [...items, ...fallback];
  const seen = new Set<string>();

  return merged
    .filter((item) => {
      if (seen.has(item.message)) return false;
      seen.add(item.message);
      return true;
    })
    .sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    )
    .slice(0, 12);
}

function feedMessage(summary: string): string {
  if (/research|trend|signal/i.test(summary)) return "Research signal detected.";
  if (/commerce|revenue|anomaly|shopify/i.test(summary)) {
    return "Commerce anomaly detected.";
  }
  if (/season|summer|winter|opportunity/i.test(summary)) {
    return "Seasonal opportunity identified.";
  }
  if (/design|mood|collection|concept/i.test(summary)) {
    return "Design recommendation generated.";
  }
  if (/marketing|campaign|strategy/i.test(summary)) {
    return "Marketing strategy approved.";
  }
  if (/ceo|decision|executive/i.test(summary)) return "CEO decision issued.";
  return summary.length > 60 ? `${summary.slice(0, 57)}…` : summary;
}

function feedMessageForReport(report: ReportListItem): string {
  switch (report.category) {
    case "research":
      return "Research signal detected.";
    case "commerce":
      return "Commerce anomaly detected.";
    case "design":
    case "image":
      return report.status === "approved"
        ? "Design recommendation generated."
        : "Design concept in review.";
    case "marketing":
    case "content":
      return report.status === "approved"
        ? "Marketing strategy approved."
        : "Marketing draft submitted.";
    default:
      return report.agentId === "ceo"
        ? "CEO decision issued."
        : "Intelligence packet received.";
  }
}

function inferFeedKind(
  summary: string,
  actorId: string,
): BrainCoreFeedItem["kind"] {
  if (/commerce|revenue/i.test(summary)) return "commerce";
  if (/design/i.test(summary)) return "design";
  if (/marketing/i.test(summary)) return "marketing";
  if (/research|trend/i.test(summary)) return "research";
  if (actorId === "ceo") return "ceo";
  return "system";
}

function feedKindForCategory(
  category: ReportListItem["category"],
  agentId: AgentId,
): BrainCoreFeedItem["kind"] {
  if (agentId === "ceo") return "ceo";
  if (category === "research") return "research";
  if (category === "commerce") return "commerce";
  if (category === "design" || category === "image") return "design";
  if (category === "marketing" || category === "content") return "marketing";
  return "system";
}

async function buildDecisions(
  snapshot: FacilitySnapshot,
  reports: ReportListItem[],
): Promise<BrainCoreDecision[]> {
  const decisions: BrainCoreDecision[] = [];
  let id = 0;

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

    if (lab.seasonal.strongestSeason && lab.seasonal.weakestSeason) {
      const strong = lab.seasonal.strongestSeason.season;
      const weak = lab.seasonal.weakestSeason.season;
      decisions.push({
        id: `decision-${++id}`,
        priority: "HIGH",
        message: `${strong} products outperform ${weak} products.`,
        confidence: 0.91,
        sourceAgents: ["Commerce Intelligence", AGENT_STUDIO_NAMES.ceo],
        reasoning: `${strong} generated ${Math.round(lab.seasonal.strongestSeason.revenue).toLocaleString()} revenue vs ${weak} at ${Math.round(lab.seasonal.weakestSeason.revenue).toLocaleString()}.`,
      });
    }

    const weakCategory = lab.categories.revenueByCategory.at(-1);
    if (weakCategory && weakCategory.sharePercent < 15) {
      decisions.push({
        id: `decision-${++id}`,
        priority: "MEDIUM",
        message: "Reduce underperforming categories.",
        confidence: 0.84,
        sourceAgents: ["Commerce Intelligence", AGENT_STUDIO_NAMES.research],
        reasoning: `${weakCategory.category} contributes only ${weakCategory.sharePercent}% revenue share across ${weakCategory.productCount} SKUs.`,
      });
    }

    const topProduct = lab.products.bestsellers[0];
    if (topProduct && /oversized|hoodie|cargo|wide/i.test(topProduct.title)) {
      decisions.push({
        id: `decision-${++id}`,
        priority: "HIGH",
        message: "Increase oversized inventory.",
        confidence: 0.88,
        sourceAgents: ["Commerce Intelligence", AGENT_STUDIO_NAMES.designer],
        reasoning: `${topProduct.title} leads with ${topProduct.unitsSold} units — oversized silhouettes remain dominant.`,
      });
    }

    if (lab.seasonal.suggestedDropWindows.length > 0) {
      decisions.push({
        id: `decision-${++id}`,
        priority: "MEDIUM",
        message: "Launch campaign during May–August.",
        confidence: 0.86,
        sourceAgents: [
          AGENT_STUDIO_NAMES.marketing,
          "Commerce Intelligence",
          AGENT_STUDIO_NAMES.ceo,
        ],
        reasoning: lab.seasonal.suggestedDropWindows[0] ?? "Peak revenue window identified from seasonal analysis.",
      });
    }
  } catch {
    // Fall through to defaults
  }

  const researchReport = reports.find((r) => r.category === "research");
  if (researchReport && decisions.length < 2) {
    decisions.push({
      id: `decision-${++id}`,
      priority: "HIGH",
      message: "Prioritize scarcity-driven drop mechanics.",
      confidence: researchReport.confidence,
      sourceAgents: [AGENT_STUDIO_NAMES.research, AGENT_STUDIO_NAMES.ceo],
      reasoning: researchReport.summary,
    });
  }

  const fallback: BrainCoreDecision[] = [
    {
      id: "decision-fallback-1",
      priority: "HIGH",
      message: "Summer products outperform winter products.",
      confidence: 0.9,
      sourceAgents: ["Commerce Intelligence", AGENT_STUDIO_NAMES.ceo],
      reasoning: "Seasonal revenue analysis indicates summer peak — align inventory and campaigns.",
    },
    {
      id: "decision-fallback-2",
      priority: "MEDIUM",
      message: "Reduce underperforming categories.",
      confidence: 0.82,
      sourceAgents: ["Commerce Intelligence", AGENT_STUDIO_NAMES.research],
      reasoning: "Category mix review recommends trimming low-share segments.",
    },
    {
      id: "decision-fallback-3",
      priority: "HIGH",
      message: "Increase oversized inventory.",
      confidence: 0.87,
      sourceAgents: [AGENT_STUDIO_NAMES.designer, "Commerce Intelligence"],
      reasoning: "Bestseller data confirms oversized silhouettes drive repeat purchase.",
    },
    {
      id: "decision-fallback-4",
      priority: "MEDIUM",
      message: "Launch campaign during May–August.",
      confidence: 0.85,
      sourceAgents: [AGENT_STUDIO_NAMES.marketing, AGENT_STUDIO_NAMES.ceo],
      reasoning: "Marketing calendar aligned to seasonal revenue peak window.",
    },
  ];

  if (decisions.length === 0) return fallback;

  const seen = new Set(decisions.map((d) => d.message));
  for (const item of fallback) {
    if (decisions.length >= 4) break;
    if (!seen.has(item.message)) {
      decisions.push(item);
      seen.add(item.message);
    }
  }

  return decisions.slice(0, 5);
}

function buildKnowledgeStreams(
  snapshot: FacilitySnapshot,
  reports: ReportListItem[],
): BrainCoreKnowledgeStream[] {
  const hasResearch = reports.some((r) => r.category === "research");
  const hasCommerce = reports.some(
    (r) => r.category === "commerce" || r.agentId === "shopify",
  );
  const hasDesign = reports.some(
    (r) => r.category === "design" || r.category === "image",
  );
  const hasMarketing = reports.some(
    (r) => r.category === "marketing" || r.category === "content",
  );
  const ceoActive = snapshot.labs.ceo.opsState !== "idle";

  const streamActivity: Record<string, { active: boolean; count: number }> = {
    "stream-research-commerce": {
      active: hasResearch && (hasCommerce || snapshot.labs.shopify.opsState !== "idle"),
      count: reports.filter((r) => r.category === "research").length,
    },
    "stream-commerce-ceo": {
      active: hasCommerce || ceoActive,
      count: Math.max(1, snapshot.brain.knowledge.reports),
    },
    "stream-research-design": {
      active: hasResearch && (hasDesign || snapshot.labs.designer.opsState !== "idle"),
      count: reports.filter((r) => r.category === "research" || r.category === "design").length,
    },
    "stream-design-marketing": {
      active: hasDesign && (hasMarketing || snapshot.labs.marketing.opsState !== "idle"),
      count: reports.filter((r) => r.category === "design" || r.category === "marketing").length,
    },
    "stream-marketing-ceo": {
      active: hasMarketing || ceoActive,
      count: reports.filter((r) => r.category === "marketing").length + (ceoActive ? 1 : 0),
    },
  };

  return KNOWLEDGE_STREAM_DEFS.map((stream) => ({
    ...stream,
    active: streamActivity[stream.id]?.active ?? true,
    signalCount: streamActivity[stream.id]?.count ?? 1,
  }));
}

function seedReports(reports: ReportListItem[]): ReportListItem[] {
  return reports.length > 0 ? reports : MOCK_REPORTS;
}

export async function buildBrainCorePayload(
  snapshot: FacilitySnapshot,
  reports: ReportListItem[],
  _tasks: TaskListItem[],
): Promise<BrainCorePayload> {
  const sourceReports = seedReports(reports);
  const decisions = await buildDecisions(snapshot, sourceReports);
  const metrics = buildMetrics(snapshot, sourceReports, decisions);
  const nodes = buildNodes(snapshot);

  return {
    metrics,
    coreState: deriveCoreState(snapshot, metrics),
    nodes,
    feed: buildFeed(snapshot, sourceReports),
    decisions,
    knowledgeStreams: buildKnowledgeStreams(snapshot, sourceReports),
    futureModules: [
      "Autonomous Agents",
      "Cross-Agent Workflows",
      "Memory Network",
      "Predictive Intelligence",
      "Self-Learning System",
    ],
    loadedAt: new Date().toISOString(),
  };
}
