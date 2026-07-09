import type { FashionNewsIntelligenceData } from "@/services/connectors/fashion-news";
import type { ProviderNormalizer } from "../normalization/interfaces";
import { asProviderSourceKey } from "../types";
import {
  buildSignal,
  entity,
  finalizeBundle,
  mapBrandMentions,
  mentionClusters,
  normalizeFromEnvelope,
  signalId,
} from "./shared";

const SOURCE = asProviderSourceKey("fashion_news");

function normalizeFashionNews(
  data: FashionNewsIntelligenceData,
  provenance: import("../types/provider-source").ProviderProvenance,
) {
  const signals = [
    ...data.articles.slice(0, 12).map((article, index) =>
      buildSignal({
        id: signalId(SOURCE, `article-${index}`),
        category: "editorial",
        label: article.title,
        headline: `${article.source} · ${article.title}`,
        direction: "stable",
        entities: [
          entity("article", article.title, article.link),
          entity("topic", article.source),
        ],
        tags: ["editorial", ...article.categories.slice(0, 3)],
        provenance,
        observedAt: article.publishedAt ?? provenance.syncedAt,
        rawReference: article.link,
      }),
    ),
    ...data.headlines.slice(0, 6).map((headline, index) =>
      buildSignal({
        id: signalId(SOURCE, `headline-${index}`),
        category: "editorial",
        label: headline,
        headline,
        direction: "emerging",
        entities: [entity("topic", headline)],
        tags: ["headline"],
        provenance,
      }),
    ),
  ];

  const trends = {
    rising: mentionClusters(data.keywords, "keyword", provenance, SOURCE, "structural"),
    stable: mentionClusters(data.categories, "category", provenance, SOURCE, "structural"),
    declining: [],
    emerging: mentionClusters(
      data.emergingThemes.map((term) => ({ term, count: 1 })),
      "topic",
      provenance,
      SOURCE,
      "immediate",
    ),
    opportunities: data.repeatedTopics,
  };

  const market = {
    segments: data.sources.map((source, index) => ({
      id: signalId(SOURCE, `source-${index}`),
      label: source,
      channel: "editorial" as const,
      categories: [source],
      provenance,
    })),
    movements: [],
    priceBands: [],
    demandNarratives: data.repeatedTopics,
  };

  const brand = {
    mentions: mapBrandMentions(data.brandMentions, provenance, SOURCE, "mention"),
    momentum: data.emergingThemes.map((theme, index) => ({
      id: signalId(SOURCE, `theme-${index}`),
      name: theme,
      narrative: theme,
      signalType: "mention" as const,
      provenance,
    })),
    designers: [],
    culturalSignals: [
      ...data.colorSignals.map((m) => m.term),
      ...data.materialSignals.map((m) => m.term),
      ...data.silhouetteSignals.map((m) => m.term),
    ],
  };

  return finalizeBundle(
    provenance,
    signals,
    trends,
    market,
    { products: [], demandIndicators: [], opportunities: [], inventoryNarratives: [] },
    brand,
  );
}

export const fashionNewsNormalizer: ProviderNormalizer = {
  sourceKey: SOURCE,
  normalize(envelope, _context) {
    return normalizeFromEnvelope<FashionNewsIntelligenceData>(
      envelope,
      normalizeFashionNews,
    );
  },
};
