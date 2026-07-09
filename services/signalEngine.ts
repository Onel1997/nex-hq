import type { MilaeneCommerceBaseline } from "@/lib/commerce/milaene-commerce-baseline";
import type { AggregatedSignals } from "@/services/signalAggregator";
import type { CompetitorIntel } from "@/services/competitorScanner";
import type { ResearchOpportunity } from "@/services/opportunityEngine";
import type { ProductIntelligence } from "@/services/productAnalyzer";
import type { TrendScore } from "@/services/trendScanner";

export type SignalCategory =
  | "trend"
  | "competitor"
  | "opportunity"
  | "product"
  | "social"
  | "consumer";

export interface LiveSignal {
  id: string;
  time: string;
  category: SignalCategory;
  message: string;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildTrendSignals(trends: TrendScore[]): LiveSignal[] {
  return trends
    .filter((t) => t.direction === "up")
    .slice(0, 3)
    .map((t, i) => ({
      id: `trend-${t.id}`,
      time: formatTime(new Date(Date.now() - (i + 1) * 12 * 60_000)),
      category: "trend" as const,
      message: `${t.label} ${t.change >= 0 ? "rising" : "declining"}.`,
    }));
}

function buildSocialSignals(aggregated?: AggregatedSignals): LiveSignal[] {
  if (!aggregated) return [];
  return aggregated.social.signals.slice(0, 3).map((s, i) => ({
    id: s.id,
    time: formatTime(new Date(Date.now() - (i + 2) * 9 * 60_000)),
    category: "social" as const,
    message: s.message,
  }));
}

function buildConsumerSignals(aggregated?: AggregatedSignals): LiveSignal[] {
  if (!aggregated) return [];
  return aggregated.consumer.signals.slice(0, 2).map((s, i) => ({
    id: s.id,
    time: formatTime(new Date(Date.now() - (i + 5) * 11 * 60_000)),
    category: "consumer" as const,
    message: s.message,
  }));
}

function buildCompetitorSignals(competitors: CompetitorIntel[]): LiveSignal[] {
  return competitors.slice(0, 2).map((c, i) => ({
    id: `competitor-${c.name}`,
    time: formatTime(new Date(Date.now() - (i + 4) * 15 * 60_000)),
    category: "competitor" as const,
    message: `${c.name} ${c.newCollections.toLowerCase().includes("launched") ? c.newCollections : `— ${c.signal}`}.`,
  }));
}

function buildOpportunitySignals(opportunities: ResearchOpportunity[]): LiveSignal[] {
  return opportunities.slice(0, 2).map((o, i) => ({
    id: `opportunity-${o.id}`,
    time: formatTime(new Date(Date.now() - (i + 6) * 18 * 60_000)),
    category: "opportunity" as const,
    message: `${o.title} — ${o.scores.estimatedPotential}% potential.`,
  }));
}

function buildProductSignals(
  products: ProductIntelligence,
  baseline?: MilaeneCommerceBaseline | null,
): LiveSignal[] {
  const signals: LiveSignal[] = [];

  const topSeller = products.bestsellers[0];
  if (topSeller) {
    const units =
      baseline?.commerceIntelligence.topUnits[0]?.unitsSold ??
      baseline?.commerceIntelligence.allTimeBestseller?.unitsSold ??
      8;
    signals.push({
      id: "product-bestseller",
      time: formatTime(new Date(Date.now() - 8 * 60_000)),
      category: "product",
      message: `${topSeller} sold ${units} units.`,
    });
  }

  const weak = products.weakProducts[0];
  if (weak) {
    signals.push({
      id: "product-weak",
      time: formatTime(new Date(Date.now() - 22 * 60_000)),
      category: "product",
      message: `${weak} — conversion below target.`,
    });
  }

  return signals;
}

export interface SignalEngineInput {
  trends: TrendScore[];
  competitors: CompetitorIntel[];
  opportunities: ResearchOpportunity[];
  products: ProductIntelligence;
  baseline?: MilaeneCommerceBaseline | null;
  aggregated?: AggregatedSignals;
  commerceActivity?: Array<{ message: string; time?: string }>;
}

/** Generate live intelligence feed signals from all research engines. */
export function generateLiveSignals(input: SignalEngineInput): LiveSignal[] {
  const fromEngines = [
    ...buildSocialSignals(input.aggregated),
    ...buildTrendSignals(input.trends),
    ...buildConsumerSignals(input.aggregated),
    ...buildCompetitorSignals(input.competitors),
    ...buildOpportunitySignals(input.opportunities),
    ...buildProductSignals(input.products, input.baseline),
  ];

  const fromActivity =
    input.commerceActivity?.slice(0, 3).map((event, i) => ({
      id: `commerce-${i}`,
      time: event.time ?? formatTime(new Date(Date.now() - (i + 10) * 10 * 60_000)),
      category: "product" as SignalCategory,
      message: event.message,
    })) ?? [];

  const merged = [...fromEngines, ...fromActivity];
  const seen = new Set<string>();

  return merged
    .filter((s) => {
      if (seen.has(s.message)) return false;
      seen.add(s.message);
      return true;
    })
    .slice(0, 14);
}

export const SIGNAL_CATEGORY_LABELS: Record<SignalCategory, string> = {
  trend: "Trend",
  competitor: "Competitor",
  opportunity: "Opportunity",
  product: "Product",
  social: "Social",
  consumer: "Consumer",
};
