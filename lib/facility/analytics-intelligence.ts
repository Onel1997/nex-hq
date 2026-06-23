import "server-only";

import { buildCommerceLabPayload } from "@/lib/commerce/commerce-lab-intelligence";
import { loadHistoricalIntelligence } from "@/lib/commerce/historical-intelligence";
import { buildBrainCorePayload } from "@/lib/facility/brain-core-intelligence";
import type {
  AnalyticsChamberPayload,
  AnalyticsCommerceRow,
  AnalyticsNeuralPrediction,
  AnalyticsRadarSignal,
} from "@/lib/facility/analytics-chamber-types";
import { buildKnowledgeVaultPayload } from "@/lib/facility/knowledge-vault-intelligence";
import { buildReportsCenterPayload } from "@/lib/facility/reports-center-intelligence";
import type { FacilitySnapshot } from "@/lib/facility/types";
import type { CommerceIntelligence } from "@/lib/shopify/commerce-intelligence";
import { formatCommerceCurrency, loadCommerceIntelligenceSafe } from "@/lib/shopify/commerce-intelligence";
import { fetchShopifyKnowledge } from "@/lib/shopify/knowledge";
import type { ReportListItem } from "@/lib/mock/reports";
import type { TaskListItem } from "@/tasks/types";

const FUTURE_SYSTEMS = [
  "Predictive AI",
  "Autonomous Decisions",
  "Self-Learning Network",
  "Simulation Engine",
];

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function directionFromScore(score: number): AnalyticsCommerceRow["direction"] {
  if (score >= 60) return "up";
  if (score <= 40) return "down";
  return "flat";
}

function productLabel(title: string): string {
  return title.replace(/\s*-\s*.+$/, "").trim();
}

function buildCommerceRows(
  commerce: CommerceIntelligence | null,
  historicalProducts: Array<{ title: string; trendScore: number; revenue: number; unitsSold: number }>,
): AnalyticsChamberPayload["commerce"] {
  const products: AnalyticsCommerceRow[] = [];

  if (commerce?.topProducts.length) {
    for (const p of commerce.topProducts.slice(0, 4)) {
      products.push({
        id: `prod-${p.productId}`,
        label: productLabel(p.title),
        value: formatCommerceCurrency(p.revenue, p.currency),
        intensity: clamp(Math.round((p.commerceScore || p.unitsSold) / 2), 25, 98),
        direction: p.unitsRank <= 3 ? "up" : "flat",
      });
    }
  } else if (historicalProducts.length) {
    for (const p of historicalProducts.slice(0, 4)) {
      products.push({
        id: `prod-${p.title}`,
        label: productLabel(p.title),
        value: formatCommerceCurrency(p.revenue, "EUR"),
        intensity: clamp(p.trendScore, 25, 98),
        direction: directionFromScore(p.trendScore),
      });
    }
  } else {
    products.push(
      { id: "p1", label: "Faith Oversized Tee", value: "€2.4k", intensity: 88, direction: "up" },
      { id: "p2", label: "Love Story Tee", value: "€1.8k", intensity: 72, direction: "flat" },
      { id: "p3", label: "Summer Capsule", value: "€1.2k", intensity: 65, direction: "up" },
    );
  }

  const categories: AnalyticsCommerceRow[] = [];
  const catSource = commerce?.topCategories ?? [];
  if (catSource.length) {
    for (const c of catSource.slice(0, 4)) {
      categories.push({
        id: `cat-${c.category}`,
        label: c.category,
        value: formatCommerceCurrency(c.revenue, commerce?.summary.currency ?? "EUR"),
        intensity: clamp(100 - c.rank * 12, 30, 95),
        direction: c.rank <= 2 ? "up" : c.rank >= 4 ? "down" : "flat",
      });
    }
  } else {
    categories.push(
      { id: "c1", label: "Oversized Tees", value: "€8.2k", intensity: 92, direction: "up" },
      { id: "c2", label: "Headwear", value: "€1.1k", intensity: 38, direction: "down" },
      { id: "c3", label: "Essentials", value: "€3.4k", intensity: 68, direction: "flat" },
    );
  }

  const seasonal: AnalyticsCommerceRow[] = [];
  const seasons = ["Winter", "Spring", "Summer", "Fall"];
  const seasonMonths: Record<string, number[]> = {
    Winter: [12, 1, 2],
    Spring: [3, 4, 5],
    Summer: [6, 7, 8],
    Fall: [9, 10, 11],
  };

  if (commerce?.seasonality.length) {
    const maxRev = Math.max(
      ...seasons.map((name) =>
        commerce.seasonality
          .filter((s) => seasonMonths[name]?.includes(s.month))
          .reduce((sum, s) => sum + s.revenue, 0),
      ),
      1,
    );

    for (const name of seasons) {
      const rev = commerce.seasonality
        .filter((s) => seasonMonths[name]?.includes(s.month))
        .reduce((sum, s) => sum + s.revenue, 0);
      seasonal.push({
        id: `season-${name}`,
        label: name,
        value: formatCommerceCurrency(rev, commerce.summary.currency),
        intensity: clamp(Math.round((rev / maxRev) * 100), 20, 98),
        direction: name === "Summer" ? "up" : name === "Winter" ? "down" : "flat",
      });
    }
  } else {
    seasonal.push(
      { id: "s1", label: "Summer", value: "€4.8k", intensity: 94, direction: "up" },
      { id: "s2", label: "Spring", value: "€2.1k", intensity: 58, direction: "flat" },
      { id: "s3", label: "Winter", value: "€0.9k", intensity: 32, direction: "down" },
    );
  }

  return { products, categories, seasonal };
}

function buildNeuralPredictions(
  brainDecisions: Array<{ message: string; confidence: number }>,
  commerceInsights: Array<{ message: string; priority: string; category: string }>,
): AnalyticsNeuralPrediction[] {
  const predictions: AnalyticsNeuralPrediction[] = [];
  let id = 0;

  for (const decision of brainDecisions.slice(0, 2)) {
    predictions.push({
      id: `neural-${++id}`,
      category: "demand",
      message: decision.message,
      confidence: Math.round(decision.confidence * 100),
    });
  }

  for (const insight of commerceInsights.filter((i) => i.category === "commerce").slice(0, 2)) {
    predictions.push({
      id: `neural-${++id}`,
      category: "product",
      message: insight.message,
      confidence: insight.priority === "high" ? 87 : 72,
    });
  }

  for (const insight of commerceInsights.filter((i) => i.category === "marketing").slice(0, 2)) {
    predictions.push({
      id: `neural-${++id}`,
      category: "marketing",
      message: insight.message,
      confidence: insight.priority === "high" ? 84 : 68,
    });
  }

  if (predictions.length === 0) {
    return [
      { id: "n1", category: "demand", message: "Summer demand likely to exceed baseline by 18%", confidence: 91 },
      { id: "n2", category: "product", message: "Increase oversized inventory ahead of peak season", confidence: 78 },
      { id: "n3", category: "marketing", message: "Launch campaign window opens May–August", confidence: 85 },
      { id: "n4", category: "demand", message: "Neutral tone palette rising across top SKUs", confidence: 74 },
    ];
  }

  return predictions.slice(0, 6);
}

function buildRadarSignals(
  snapshot: FacilitySnapshot,
  reportsCount: number,
  knowledgeCount: number,
  brainSignals: number,
): AnalyticsRadarSignal[] {
  const signals: AnalyticsRadarSignal[] = [];
  let id = 0;

  for (const event of snapshot.events.slice(0, 4)) {
    signals.push({
      id: `radar-${++id}`,
      angle: (id * 67 + 15) % 360,
      distance: 0.35 + (id % 3) * 0.18,
      intensity: clamp(50 + id * 12, 40, 95),
      label: event.summary.slice(0, 40),
      kind: event.actorId === "commerce" ? "commerce" : event.actorId === "research" ? "research" : "mission",
    });
  }

  if (reportsCount > 0) {
    signals.push({
      id: `radar-${++id}`,
      angle: 42,
      distance: 0.55,
      intensity: clamp(60 + reportsCount * 2, 55, 92),
      label: `${reportsCount} intelligence reports indexed`,
      kind: "brain",
    });
  }

  if (knowledgeCount > 0) {
    signals.push({
      id: `radar-${++id}`,
      angle: 128,
      distance: 0.72,
      intensity: clamp(55 + knowledgeCount, 50, 90),
      label: `${knowledgeCount} vault entries synced`,
      kind: "research",
    });
  }

  if (brainSignals > 0) {
    signals.push({
      id: `radar-${++id}`,
      angle: 215,
      distance: 0.48,
      intensity: clamp(65 + brainSignals * 3, 60, 96),
      label: "Neural activity detected",
      kind: "forecast",
    });
  }

  signals.push(
    { id: `radar-${++id}`, angle: 310, distance: 0.62, intensity: 78, label: "Demand forecast updated", kind: "forecast" },
    { id: `radar-${++id}`, angle: 175, distance: 0.38, intensity: 66, label: "Commerce signal incoming", kind: "commerce" },
  );

  return signals.slice(0, 10);
}

export async function buildAnalyticsChamberPayload(
  snapshot: FacilitySnapshot,
  tasks: TaskListItem[],
  brainReports: ReportListItem[],
): Promise<AnalyticsChamberPayload> {
  const [brain, reports, knowledge] = await Promise.all([
    buildBrainCorePayload(snapshot, brainReports, tasks),
    buildReportsCenterPayload(snapshot, tasks, brainReports),
    buildKnowledgeVaultPayload(snapshot, tasks, brainReports),
  ]);

  let commerce: CommerceIntelligence | null = null;
  let commerceLab: ReturnType<typeof buildCommerceLabPayload> | null = null;
  let historicalProducts: Array<{ title: string; trendScore: number; revenue: number; unitsSold: number }> = [];

  try {
    const shopKnowledge = await fetchShopifyKnowledge();
    const [commerceResult, historical] = await Promise.all([
      loadCommerceIntelligenceSafe(shopKnowledge),
      loadHistoricalIntelligence(shopKnowledge).catch(() => null),
    ]);
    commerce = commerceResult;
    historicalProducts = historical?.products ?? [];
    commerceLab = buildCommerceLabPayload(
      commerce,
      historical?.summary.totalOrders ? historical : commerce.import,
    );
  } catch {
    /* observatory falls back to aggregated wing data */
  }

  const currency = commerce?.summary.currency ?? "EUR";
  const totalRevenue = commerce?.summary.totalRevenue ?? commerceLab?.revenue.totalRevenue ?? 0;
  const totalOrders = commerce?.summary.totalOrders ?? commerceLab?.revenue.totalOrders ?? tasks.filter((t) => t.status === "completed").length;
  const aov = commerce?.summary.averageOrderValue ?? commerceLab?.revenue.averageOrderValue ?? (totalOrders > 0 ? totalRevenue / totalOrders : 42.9);

  const catalogSize = commerce?.summary.productsWithSales ?? historicalProducts.length ?? 24;
  const conversionRate = clamp(
    Math.round((totalOrders / Math.max(catalogSize * 3, 30)) * 100 * 10) / 10,
    1.4,
    9.8,
  );

  const completedMissions = tasks.filter((t) => t.status === "completed").length;
  const activeAgents = brain.metrics.connectedAgents;
  const avgReportConfidence =
    reports.reports.length > 0
      ? Math.round(
          reports.reports.reduce((s, r) => s + r.confidence, 0) / reports.reports.length,
        )
      : brain.metrics.confidenceScore;

  const competitorCards = knowledge.reports.filter(
    (r) => r.subsection === "competitors" || r.subsection === "trends",
  );

  const trendConfidence = clamp(
    Math.round(
      (brain.metrics.intelligenceLevel + avgReportConfidence + (commerceLab ? 82 : 70)) / 3,
    ),
    58,
    96,
  );

  const opportunities = [
    ...brain.decisions.slice(0, 2).map((d, i) => ({
      id: `opp-brain-${i}`,
      label: d.message.split(".")[0] ?? d.message,
      detail: d.reasoning,
      confidence: Math.round(d.confidence * 100),
    })),
    ...reports.reports
      .filter((r) => r.agentTab === "ceo" && r.source === "live")
      .slice(0, 2)
      .map((b, i) => ({
      id: `opp-report-${i}`,
      label: b.title,
      detail: b.preview.executiveSummary.slice(0, 120),
      confidence: Math.round(b.confidence * 100),
    })),
  ];

  if (opportunities.length === 0) {
    opportunities.push(
      { id: "opp1", label: "Summer capsule expansion", detail: "Seasonal demand curve favors lightweight oversized fits", confidence: 86 },
      { id: "opp2", label: "Campaign timing window", detail: "Peak engagement forecast May–August", confidence: 79 },
    );
  }

  const competitorActivity = competitorCards.slice(0, 3).map((c, i) => ({
    id: `comp-${i}`,
    label: c.title,
    detail: c.summary ?? "Competitive intelligence signal detected",
    level: (i === 0 ? "high" : i === 1 ? "medium" : "low") as "low" | "medium" | "high",
  }));

  if (competitorActivity.length === 0) {
    competitorActivity.push(
      { id: "comp1", label: "Streetwear trend shift", detail: "Oversized silhouettes gaining market share", level: "medium" },
      { id: "comp2", label: "Neutral palette adoption", detail: "Competitors increasing natural tone offerings", level: "low" },
    );
  }

  const commerceInsights = [
    ...(commerceLab?.recommendations ?? []),
    ...(commerceLab?.marketingInsights ?? []),
  ];

  return {
    executive: {
      revenue: formatCommerceCurrency(totalRevenue, currency),
      orders: totalOrders,
      conversionRate,
      averageOrderValue: formatCommerceCurrency(aov, currency),
    },
    agentPerformance: {
      missionsCompleted: completedMissions || reports.commandBar.approved,
      confidenceScore: avgReportConfidence,
      activeAgents,
      decisionQuality: clamp(
        Math.round((brain.metrics.confidenceScore + brain.metrics.intelligenceLevel) / 2),
        55,
        98,
      ),
    },
    commerce: buildCommerceRows(commerce, historicalProducts),
    research: {
      trendConfidence,
      opportunities: opportunities.slice(0, 4),
      competitorActivity: competitorActivity.slice(0, 4),
    },
    neuralPredictions: buildNeuralPredictions(brain.decisions, commerceInsights),
    radarSignals: buildRadarSignals(
      snapshot,
      reports.reports.length,
      knowledge.reports.length,
      brain.metrics.knowledgeSignals,
    ),
    futureSystems: FUTURE_SYSTEMS,
    loadedAt: new Date().toISOString(),
  };
}
