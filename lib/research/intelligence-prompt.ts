import type { ResearchIntelligenceBundle } from "@/services/researchEngine";
import { formatTrendChange } from "@/services/trendScanner";
import { formatMilaeneDnaForPrompt } from "@/services/milaene-dna";
import { getReadySourceLabels } from "@/services/data-sources";

/** Format live intelligence bundle for Research Agent system prompt. */
export function formatResearchIntelligencePrompt(
  bundle: ResearchIntelligenceBundle,
): string {
  const topOpp = bundle.opportunities[0];
  const { signalLayers, external } = bundle;

  const lines = [
    "## LIVE MILAENE INTELLIGENCE — Fashion Intelligence Platform",
    "",
    "### Brand DNA (Pflicht-Kontext)",
    formatMilaeneDnaForPrompt(),
    "",
    `Commerce: ${bundle.commerceConnected ? "verbunden" : "offline"} · Store: ${bundle.storeDomain || "—"}`,
    `Datenquellen: ${getReadySourceLabels().join(", ")}`,
    "",
    "### Signal Layers",
    `Social (${signalLayers.social.avgScore}/100): ${signalLayers.social.signals.slice(0, 3).map((s) => s.message).join(" · ")}`,
    `Trend (${signalLayers.trend.avgScore}/100): ${signalLayers.trend.signals.slice(0, 3).map((s) => s.label).join(", ")}`,
    `Commerce (${signalLayers.commerce.avgScore}/100): ${bundle.products.bestsellers.slice(0, 2).join(", ")}`,
    `Competitor (${signalLayers.competitor.avgScore}/100): ${bundle.competitors.slice(0, 2).map((c) => c.name).join(", ")}`,
    `Consumer (${signalLayers.consumer.avgScore}/100): ${signalLayers.consumer.signals.slice(0, 2).map((s) => s.message).join(" · ")}`,
    "",
    "### Google Trends",
    `Top Rising: ${external.googleTrends.data.topRising.join(", ")}`,
    `Saisonalität: ${external.googleTrends.data.seasonalityNote}`,
    ...external.googleTrends.data.keywords
      .slice(0, 4)
      .map((k) => `- ${k.keyword}: Nachfrage ${k.demand}/100, ${k.change >= 0 ? "+" : ""}${k.change}%`),
    "",
    "### Reddit Intelligence",
    `Subreddits: ${external.reddit.data.subreddits.join(", ")}`,
    `Kaufverhalten: ${external.reddit.data.purchaseBehavior[0]}`,
    `Wünsche: ${external.reddit.data.wishes[0]}`,
    `Probleme: ${external.reddit.data.problems[0]}`,
  ];

  lines.push(
    "",
    "### Pinterest Intelligence",
    `Farbwelten: ${external.pinterest.data.colorWorlds.join(", ")}`,
    `Ästhetik: ${external.pinterest.data.aesthetics[0]}`,
    `Capsule: ${external.pinterest.data.capsuleTrends[0]}`,
    "",
    "### TikTok Signals",
    ...external.tiktok.data.viralTrends
      .slice(0, 3)
      .map((t) => `- ${t.hashtag}: ${t.insight}`),
    "",
    "### Etsy + Amazon",
    `Etsy Top: ${external.etsy.data.bestsellers[0]?.title} (${external.etsy.data.bestsellers[0]?.priceRange})`,
    `Amazon Top: ${external.amazon.data.bestsellers[0]?.title} · ${external.amazon.data.bestsellers[0]?.rating}★`,
    "",
    "### Produkt-Intelligence",
    `Bestseller: ${bundle.products.bestsellers.join(", ")}`,
    `Schwache Produkte: ${bundle.products.weakProducts.join(", ")}`,
    `Chancen: ${bundle.products.opportunities.join(", ")}`,
    "",
    "### Top Opportunity (Design-Ready)",
  );

  if (topOpp) {
    lines.push(
      `${topOpp.title} — ${topOpp.scores.estimatedPotential}% Potential [${topOpp.decisions.priority.toUpperCase()}]`,
      `Produkte: ${topOpp.decisions.products.join(", ")}`,
      `Farben: ${topOpp.decisions.colors.join(", ")}`,
      `Designs: ${topOpp.decisions.designs.join(", ")}`,
      `Scores — Demand: ${topOpp.scores.demandScore}% · Social: ${topOpp.scores.socialScore}% · Trend: ${topOpp.scores.trendScore}% · DNA: ${topOpp.scores.dnaMatch}% · Competition: ${topOpp.scores.competitionScore}%`,
      `Begründung: ${topOpp.rationale}`,
    );
  }

  lines.push(
    "",
    "### AI-Entscheidung",
    `Nächste Kollektion: ${bundle.recommendation.nextCollection}`,
    `Priorität: ${bundle.recommendation.priority} · Potential: ${bundle.recommendation.estimatedPotential}%`,
    `Produkte: ${bundle.recommendation.recommendedProducts.join(", ")}`,
    "",
    "### Trend Scores",
    ...bundle.trends
      .slice(0, 6)
      .map((t) => `- ${t.label}: ${formatTrendChange(t)} (DNA ${t.dnaMatch}%)`),
  );

  return lines.join("\n");
}
