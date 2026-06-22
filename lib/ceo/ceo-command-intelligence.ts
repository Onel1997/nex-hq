import "server-only";

import type { AgentId } from "@/lib/constants/agents";
import { buildCommerceLabPayload } from "@/lib/commerce/commerce-lab-intelligence";
import { loadMilaeneCommerceBaseline } from "@/lib/commerce/milaene-commerce-baseline";
import { loadHistoricalIntelligence } from "@/lib/commerce/historical-intelligence";
import { AGENT_STUDIO_NAMES } from "@/lib/workspace/agent-routes";
import { formatPrice } from "@/lib/shopify/operations";
import type { TaskListItem, TaskStatus } from "@/tasks/types";

export type CeoAgentOperationalStatus =
  | "active"
  | "waiting"
  | "running"
  | "completed";

export interface CeoOverviewMetrics {
  historicalRevenue: string;
  historicalRevenueRaw: number;
  historicalOrders: number;
  bestSeller: string | null;
  topCategory: string | null;
  productsActive: number;
  currency: string;
}

export interface CeoStrategicRecommendation {
  id: string;
  message: string;
  priority: "high" | "medium" | "low";
}

export interface CeoAgentStatusEntry {
  agentId: AgentId;
  department: string;
  status: CeoAgentOperationalStatus;
  activeTask: string | null;
}

export interface CeoCompanySignal {
  id: string;
  message: string;
}

export interface CeoDecisionTask {
  id: string;
  title: string;
  status: TaskStatus;
  createdAt: string;
}

export interface CeoMarketPrintIntelligence {
  premiumProducts: Array<{ title: string; suitability: number }>;
  campaignProducts: Array<{ title: string; suitability: number }>;
  embroideryOpportunities: Array<{ title: string; material: string }>;
  highPerformingCategories: string[];
  productionLimitations: string[];
  summary: {
    premiumCount: number;
    campaignCount: number;
    embroideryCount: number;
    averageSuitability: number;
  };
}

export interface CeoCommandIntelligence {
  overview: CeoOverviewMetrics;
  recommendations: CeoStrategicRecommendation[];
  agentStatus: CeoAgentStatusEntry[];
  companySignals: CeoCompanySignal[];
  recentDecisions: CeoDecisionTask[];
  marketPrint: CeoMarketPrintIntelligence;
  loadedAt: string;
}

const CEO_AGENT_IDS: AgentId[] = [
  "research",
  "designer",
  "marketing",
  "content",
  "image",
  "shopify",
];

function deriveAgentStatus(
  tasks: TaskListItem[],
): CeoAgentOperationalStatus {
  if (tasks.some((t) => t.status === "in_progress")) return "running";
  if (tasks.some((t) => t.status === "assigned" || t.status === "review")) {
    return "active";
  }
  if (tasks.some((t) => t.status === "pending")) return "waiting";
  if (tasks.some((t) => t.status === "completed")) return "completed";
  return "waiting";
}

function activeTaskTitle(tasks: TaskListItem[]): string | null {
  const priority: TaskStatus[] = [
    "in_progress",
    "review",
    "assigned",
    "pending",
  ];
  for (const status of priority) {
    const match = tasks.find((t) => t.status === status);
    if (match) return match.title;
  }
  return null;
}

function buildStrategicRecommendations(
  baseline: Awaited<ReturnType<typeof loadMilaeneCommerceBaseline>>,
  commerceLab: ReturnType<typeof buildCommerceLabPayload>,
): CeoStrategicRecommendation[] {
  const seen = new Set<string>();
  const results: CeoStrategicRecommendation[] = [];

  const add = (
    id: string,
    message: string,
    priority: CeoStrategicRecommendation["priority"],
  ) => {
    const key = message.toLowerCase().slice(0, 80);
    if (seen.has(key)) return;
    seen.add(key);
    results.push({ id, message, priority });
  };

  for (const insight of commerceLab.ceoInsights) {
    add(insight.id, insight.message, insight.priority);
  }

  for (const rec of commerceLab.recommendations) {
    add(rec.id, rec.message, rec.priority);
  }

  for (const gap of baseline.productKnowledge.categoryGaps.slice(0, 3)) {
    add(
      `gap-${gap}`,
      `Expand ${gap} category — underrepresented in catalog vs demand signals.`,
      "medium",
    );
  }

  for (const insight of baseline.insights) {
    if (
      insight.kind === "ceo" ||
      insight.kind === "expansion" ||
      insight.kind === "category" ||
      insight.kind === "marketprint"
    ) {
      add(insight.id, insight.message, insight.priority);
    }
  }

  const bestseller =
    baseline.commerceIntelligence.allTimeBestseller?.title ??
    baseline.productKnowledge.bestsellerCandidates[0]?.title;
  if (bestseller) {
    add(
      "bestseller-anchor",
      `${bestseller} remains strongest product — protect inventory and feature in campaigns.`,
      "high",
    );
  }

  const accessoriesGap = baseline.productKnowledge.categoryGaps.find((g) =>
    /accessor|beanie|cap|hat|bag/i.test(g),
  );
  if (accessoriesGap) {
    add(
      "accessories-gap",
      `${accessoriesGap} underdeveloped — accessories line shows expansion potential.`,
      "medium",
    );
  }

  const seasons = commerceLab.seasonal.strongestSeason;
  if (seasons) {
    add(
      "seasonal-opportunity",
      `${seasons.season} collection opportunity — peak revenue window ${seasons.months.join("–")}.`,
      "high",
    );
  }

  const heavyweight = (baseline.knowledge.products ?? []).filter((p) =>
    /hoodie|fleece|heavyweight|gsm/i.test(`${p.title} ${p.productType}`),
  );
  if (heavyweight.length >= 2) {
    add(
      "heavyweight-potential",
      "Heavyweight products show high potential — fleece and hoodies sustain demand.",
      "medium",
    );
  }

  if (results.length === 0) {
    add(
      "connect-data",
      "Connect historical order data to unlock strategic recommendations.",
      "low",
    );
  }

  return results.slice(0, 8);
}

function buildCompanySignals(
  baseline: Awaited<ReturnType<typeof loadMilaeneCommerceBaseline>>,
  commerceLab: ReturnType<typeof buildCommerceLabPayload>,
): CeoCompanySignal[] {
  const signals: CeoCompanySignal[] = [];
  let id = 0;

  const push = (message: string) => {
    signals.push({ id: `signal-${++id}`, message });
  };

  const growth = commerceLab.revenue.revenueGrowthLabel;
  if (commerceLab.hasHistoricalData && growth) {
    push(
      growth.includes("+") || growth.includes("accelerating")
        ? "Historical sales growing."
        : `Historical sales trend: ${growth}.`,
    );
  } else if (commerceLab.revenue.totalOrders > 0) {
    push("Historical sales data connected.");
  }

  const bestseller = baseline.commerceIntelligence.allTimeBestseller;
  if (bestseller) {
    push(`Top product stable — ${bestseller.title} leads with ${bestseller.unitsSold} units.`);
  }

  if (commerceLab.marketingInsights.length > 0) {
    push("Campaign opportunity detected.");
  }

  if (baseline.marketPrintIntelligence.summary.premiumCount > 0) {
    push("MarketPrint premium products available.");
  }

  if (bestseller) {
    push(`Best seller unchanged — ${bestseller.title}.`);
  }

  for (const event of baseline.activity.slice(0, 3)) {
    push(event.label);
  }

  for (const insight of baseline.insights
    .filter((i) => i.kind === "bestseller" || i.kind === "ceo")
    .slice(0, 2)) {
    push(insight.message);
  }

  return signals.slice(0, 8);
}

function buildMarketPrintSection(
  baseline: Awaited<ReturnType<typeof loadMilaeneCommerceBaseline>>,
): CeoMarketPrintIntelligence {
  const mp = baseline.marketPrintIntelligence;
  const topCategories =
    baseline.commerceIntelligence.topCategories
      .slice(0, 4)
      .map((c) => c.category) ??
    baseline.productKnowledge.availableCategories.slice(0, 4);

  const limitations: string[] = [];
  if (mp.externalSupplierRecommended.length > 0) {
    limitations.push(
      `${mp.externalSupplierRecommended.length} SKUs may need external supplier — outside core MarketPrint fit.`,
    );
  }
  if (mp.summary.averageSuitability < 70) {
    limitations.push(
      `Average production fit ${mp.summary.averageSuitability}% — review low-fit SKUs before scaling.`,
    );
  }
  for (const example of mp.commerceExamples.slice(0, 2)) {
    limitations.push(example.message);
  }
  if (limitations.length === 0) {
    limitations.push("Standard MarketPrint POD constraints apply — verify embroidery on heavy fleece.");
  }

  return {
    premiumProducts: mp.premiumProducts
      .slice(0, 5)
      .map((p) => ({ title: p.title, suitability: p.match.suitability })),
    campaignProducts: mp.campaignProducts
      .slice(0, 5)
      .map((p) => ({ title: p.title, suitability: p.match.suitability })),
    embroideryOpportunities: mp.embroideryProducts
      .slice(0, 5)
      .map((p) => ({
        title: p.title,
        material: p.match.capability.material,
      })),
    highPerformingCategories: topCategories,
    productionLimitations: limitations.slice(0, 5),
    summary: {
      premiumCount: mp.summary.premiumCount,
      campaignCount: mp.summary.campaignCount,
      embroideryCount: mp.summary.embroideryCount,
      averageSuitability: mp.summary.averageSuitability,
    },
  };
}

/** Aggregate commerce, MarketPrint, and task intelligence for CEO Command V2. */
export async function loadCeoCommandIntelligence(options?: {
  byAgent?: Record<AgentId, TaskListItem[]>;
  ceoTasks?: TaskListItem[];
}): Promise<CeoCommandIntelligence> {
  const baseline = await loadMilaeneCommerceBaseline();
  const historical = await loadHistoricalIntelligence(baseline.knowledge);
  const commerceLab = buildCommerceLabPayload(
    baseline.commerceIntelligence,
    historical,
  );

  const summary = baseline.commerceIntelligence.summary;
  const historicalSummary = historical?.summary;
  const currency = historicalSummary?.currency ?? summary.currency;
  const totalRevenue =
    historicalSummary?.totalRevenue ?? summary.totalRevenue;
  const totalOrders =
    historicalSummary?.totalOrders ?? summary.totalOrders;

  const bestseller =
    historical?.allTimeBestseller?.title ??
    baseline.commerceIntelligence.allTimeBestseller?.title ??
    baseline.productKnowledge.bestsellerCandidates[0]?.title ??
    null;

  const topCategory =
    historical?.topCategories[0]?.category ??
    baseline.commerceIntelligence.topCategories[0]?.category ??
    baseline.productKnowledge.availableCategories[0] ??
    null;

  const byAgent = options?.byAgent ?? ({} as Record<AgentId, TaskListItem[]>);
  const agentStatus: CeoAgentStatusEntry[] = CEO_AGENT_IDS.map((agentId) => {
    const tasks = byAgent[agentId] ?? [];
    return {
      agentId,
      department: AGENT_STUDIO_NAMES[agentId],
      status: deriveAgentStatus(tasks),
      activeTask: activeTaskTitle(tasks),
    };
  });

  const ceoTasks = options?.ceoTasks ?? [];
  const recentDecisions: CeoDecisionTask[] = [...ceoTasks]
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    .filter((t) => !t.parentTaskId)
    .slice(0, 8)
    .map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      createdAt: t.createdAt,
    }));

  return {
    overview: {
      historicalRevenue: formatPrice(totalRevenue, currency),
      historicalRevenueRaw: totalRevenue,
      historicalOrders: totalOrders,
      bestSeller: bestseller,
      topCategory,
      productsActive: baseline.kpis.activeProducts,
      currency,
    },
    recommendations: buildStrategicRecommendations(baseline, commerceLab),
    agentStatus,
    companySignals: buildCompanySignals(baseline, commerceLab),
    recentDecisions,
    marketPrint: buildMarketPrintSection(baseline),
    loadedAt: new Date().toISOString(),
  };
}
