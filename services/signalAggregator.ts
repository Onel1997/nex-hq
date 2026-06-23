import type { MilaeneCommerceBaseline } from "@/lib/commerce/milaene-commerce-baseline";
import type { CompetitorIntel } from "@/services/competitorScanner";
import {
  flattenExternalSignals,
  scanExternalSources,
  type ExternalIntelligence,
  type IntelligenceSignal,
} from "@/services/connectors";
import type { ProductIntelligence } from "@/services/productAnalyzer";
import type { TrendScore } from "@/services/trendScanner";

export interface SignalLayer {
  category: IntelligenceSignal["category"];
  label: string;
  signals: IntelligenceSignal[];
  avgScore: number;
}

export interface AggregatedSignals {
  loadedAt: string;
  social: SignalLayer;
  trend: SignalLayer;
  commerce: SignalLayer;
  competitor: SignalLayer;
  consumer: SignalLayer;
  all: IntelligenceSignal[];
  external: ExternalIntelligence;
}

function buildLayer(
  category: IntelligenceSignal["category"],
  label: string,
  signals: IntelligenceSignal[],
): SignalLayer {
  const avgScore =
    signals.length > 0
      ? Math.round(signals.reduce((s, sig) => s + sig.score, 0) / signals.length)
      : 0;
  return { category, label, signals, avgScore };
}

function buildCommerceSignals(
  products: ProductIntelligence,
  baseline: MilaeneCommerceBaseline | null,
): IntelligenceSignal[] {
  const signals: IntelligenceSignal[] = [];

  for (const [i, title] of products.bestsellers.slice(0, 3).entries()) {
    signals.push({
      id: `commerce-bestseller-${i}`,
      category: "commerce",
      source: "shopify",
      label: "Bestseller",
      message: `${title} — top performer`,
      score: 85 - i * 5,
      direction: "up",
      tags: ["bestseller"],
    });
  }

  for (const weak of products.weakProducts.slice(0, 2)) {
    signals.push({
      id: `commerce-weak-${weak.replace(/\s+/g, "-")}`,
      category: "commerce",
      source: "shopify",
      label: "Weak SKU",
      message: `${weak} — below target conversion`,
      score: 35,
      direction: "down",
      tags: ["weak"],
    });
  }

  if (baseline?.insights) {
    for (const [i, insight] of baseline.insights.slice(0, 3).entries()) {
      signals.push({
        id: `commerce-insight-${i}`,
        category: "commerce",
        source: "own_sales",
        label: insight.kind,
        message: insight.message,
        score: insight.priority === "high" ? 80 : 65,
        direction: "up",
        tags: [insight.kind],
      });
    }
  }

  return signals;
}

function buildCompetitorSignals(
  competitors: CompetitorIntel[],
): IntelligenceSignal[] {
  return competitors.map((c) => ({
    id: `competitor-${c.name}`,
    category: "competitor",
    source: "shopify",
    label: c.name,
    message: `${c.positioning} · ${c.newCollections}`,
    score:
      c.status === "watching" ? 70 : c.status === "analyzing" ? 75 : 55,
    direction: "up" as const,
    tags: [c.status],
  }));
}

function buildTrendSignals(trends: TrendScore[]): IntelligenceSignal[] {
  return trends.map((t) => ({
    id: `trend-${t.id}`,
    category: "trend",
    source: "google_trends",
    label: t.label,
    message: `${t.label} ${t.change >= 0 ? "+" : ""}${t.change}%`,
    score: t.dnaMatch,
    direction: t.direction,
    tags: [t.source],
  }));
}

export interface AggregateSignalsInput {
  products: ProductIntelligence;
  trends: TrendScore[];
  competitors: CompetitorIntel[];
  baseline?: MilaeneCommerceBaseline | null;
  region?: string;
}

/** Aggregate social, trend, commerce, competitor and consumer signals. */
export async function aggregateSignals(
  input: AggregateSignalsInput,
): Promise<AggregatedSignals> {
  const external = await scanExternalSources({
    baseline: input.baseline,
    region: input.region,
  });

  const externalSignals = flattenExternalSignals(external);
  const commerceSignals = buildCommerceSignals(
    input.products,
    input.baseline ?? null,
  );
  const competitorSignals = buildCompetitorSignals(input.competitors);
  const trendSignals = [
    ...buildTrendSignals(input.trends),
    ...externalSignals.filter((s) => s.category === "trend"),
  ];

  const socialSignals = externalSignals.filter((s) => s.category === "social");
  const consumerSignals = [
    ...externalSignals.filter((s) => s.category === "consumer"),
    ...externalSignals.filter(
      (s) => s.source === "reddit" && s.tags?.includes("trend"),
    ),
  ];

  const all = [
    ...socialSignals,
    ...trendSignals,
    ...commerceSignals,
    ...competitorSignals,
    ...consumerSignals,
    ...externalSignals.filter(
      (s) => s.category === "commerce" && s.source !== "shopify",
    ),
  ];

  const deduped = all.filter(
    (s, i, arr) => arr.findIndex((x) => x.id === s.id) === i,
  );

  return {
    loadedAt: new Date().toISOString(),
    social: buildLayer("social", "Social Signals", socialSignals),
    trend: buildLayer("trend", "Trend Signals", trendSignals),
    commerce: buildLayer("commerce", "Commerce Signals", [
      ...commerceSignals,
      ...externalSignals.filter(
        (s) => s.category === "commerce" && s.source !== "shopify",
      ),
    ]),
    competitor: buildLayer("competitor", "Competitor Signals", competitorSignals),
    consumer: buildLayer("consumer", "Consumer Signals", consumerSignals),
    all: deduped,
    external,
  };
}
