import type { GoogleTrendsData } from "@/services/connectors/google-trends";
import type { ProviderNormalizer } from "../normalization/interfaces";
import { asProviderSourceKey } from "../types";
import {
  buildSignal,
  directionFromChange,
  entity,
  finalizeBundle,
  mentionClusters,
  normalizeFromEnvelope,
  signalId,
} from "./shared";

const SOURCE = asProviderSourceKey("google_trends");

function normalizeGoogleTrends(
  data: GoogleTrendsData,
  provenance: import("../types/provider-source").ProviderProvenance,
) {
  const keywordSignals = data.keywords.map((keyword) =>
    buildSignal({
      id: signalId(SOURCE, keyword.keyword),
      category: "trend",
      label: keyword.keyword,
      headline: `${keyword.keyword} · demand ${keyword.demand} · ${keyword.change >= 0 ? "+" : ""}${keyword.change}%`,
      detail: `${keyword.seasonality} · ${keyword.region}`,
      value: String(keyword.demand),
      direction: directionFromChange(keyword.change),
      entities: [
        entity("keyword", keyword.keyword, String(keyword.demand)),
        entity("topic", keyword.region),
      ],
      tags: ["keyword", keyword.seasonality, keyword.region],
      provenance,
    }),
  );

  const relatedQuerySignals = data.relatedQueries.map((query) =>
    buildSignal({
      id: signalId(SOURCE, `related-${query}`),
      category: "trend",
      label: query,
      headline: `Related query · ${query}`,
      detail: "Rising or top related search query from Google Trends",
      value: String(Math.max(35, data.demandScore - 5)),
      direction: data.trendDirection,
      entities: [entity("keyword", query)],
      tags: ["related-query", "rising"],
      provenance,
    }),
  );

  const aggregateSignals = [
    buildSignal({
      id: signalId(SOURCE, "demand-score"),
      category: "trend",
      label: "Search demand score",
      headline: `Demand score ${data.demandScore}/100`,
      detail: "Average regional search demand across tracked keywords",
      value: String(data.demandScore),
      direction: data.trendDirection,
      tags: ["demand-score", "aggregate"],
      provenance,
    }),
    buildSignal({
      id: signalId(SOURCE, "seasonality"),
      category: "trend",
      label: "Seasonality",
      headline: data.seasonalityNote,
      detail: "Seasonal movement across tracked keywords",
      value: String(data.demandScore),
      direction: data.trendDirection,
      tags: ["seasonality"],
      provenance,
    }),
    buildSignal({
      id: signalId(SOURCE, "trend-direction"),
      category: "trend",
      label: "Trend direction",
      headline: `Overall direction: ${data.trendDirection}`,
      detail: "Net keyword momentum across tracked queries",
      value: String(data.demandScore),
      direction: data.trendDirection,
      tags: ["trend-direction"],
      provenance,
    }),
  ];

  const signals = [...keywordSignals, ...relatedQuerySignals, ...aggregateSignals];

  const risingKeywords = data.keywords.filter((keyword) => keyword.change > 0);
  const decliningKeywords = data.keywords.filter((keyword) => keyword.change < 0);

  const risingClusters = mentionClusters(
    risingKeywords.map((keyword) => ({ term: keyword.keyword, count: keyword.demand })),
    "keyword",
    provenance,
    SOURCE,
    "seasonal",
  );

  const trends = {
    rising: risingClusters,
    stable: mentionClusters(
      data.keywords
        .filter(
          (keyword) => keyword.seasonality === "stable" || keyword.seasonality === "peak",
        )
        .map((keyword) => ({ term: keyword.keyword, count: keyword.demand })),
      "keyword",
      provenance,
      SOURCE,
      "seasonal",
    ),
    declining: mentionClusters(
      decliningKeywords.map((keyword) => ({ term: keyword.keyword, count: keyword.demand })),
      "keyword",
      provenance,
      SOURCE,
      "seasonal",
    ),
    emerging: mentionClusters(
      [...data.topRising, ...data.relatedQueries].map((term) => ({ term, count: 1 })),
      "keyword",
      provenance,
      SOURCE,
      "immediate",
    ),
    opportunities: [...new Set([...data.topRising, ...data.relatedQueries])],
  };

  const market = {
    segments: [],
    movements: [],
    priceBands: [],
    demandNarratives: [
      data.seasonalityNote,
      `Demand score ${data.demandScore}/100`,
      `Trend direction ${data.trendDirection}`,
    ].filter(Boolean),
  };

  return finalizeBundle(
    provenance,
    signals,
    trends,
    market,
    {
      products: [],
      demandIndicators: [],
      opportunities: [],
      inventoryNarratives: [],
    },
    { mentions: [], momentum: [], designers: [], culturalSignals: [] },
  );
}

export const googleTrendsNormalizer: ProviderNormalizer = {
  sourceKey: SOURCE,
  normalize(envelope, _context) {
    return normalizeFromEnvelope<GoogleTrendsData>(envelope, normalizeGoogleTrends);
  },
};
