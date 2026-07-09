import {
  fetchLiveGrailed,
  isGrailedLiveConfigured,
} from "./clients/grailed-client";
import {
  aggregateConnectorScores,
  computeConfidence,
  normalizeSignals,
} from "./signal-utils";
import type { ConnectorInput, IntelligenceSignal, SourceIntelligence } from "./types";

export interface GrailedListing {
  listingId: string;
  title: string;
  brand: string | null;
  designer: string | null;
  category: string;
  price: number;
  currency: string;
  size: string | null;
  condition: string | null;
  colors: string[];
  materials: string[];
  productType: string | null;
  status: string;
  location: string | null;
  publishedAt: string | null;
  /** Days since listing was published (freshness proxy). */
  freshnessDays: number | null;
  /** Demand proxy when the API exposes it (watchers, offers, etc.). */
  demandProxy: string | null;
}

export interface GrailedMention {
  term: string;
  count: number;
}

export interface GrailedPriceBand {
  category: string;
  min: number;
  max: number;
  sweet: number;
  currency: string;
}

export interface GrailedIntelligenceData {
  listings: GrailedListing[];
  risingDesigners: GrailedMention[];
  archiveFashionSignals: GrailedMention[];
  luxuryStreetwearSignals: GrailedMention[];
  designerPriceBands: GrailedPriceBand[];
  colorTrends: GrailedMention[];
  silhouetteTrends: GrailedMention[];
  materialTrends: GrailedMention[];
  repeatedTitlePatterns: string[];
  resaleDemandProxies: string[];
}

export const EMPTY_GRAILED_DATA: GrailedIntelligenceData = {
  listings: [],
  risingDesigners: [],
  archiveFashionSignals: [],
  luxuryStreetwearSignals: [],
  designerPriceBands: [],
  colorTrends: [],
  silhouetteTrends: [],
  materialTrends: [],
  repeatedTitlePatterns: [],
  resaleDemandProxies: [],
};

function toSignals(data: GrailedIntelligenceData): IntelligenceSignal[] {
  const listingSignals = data.listings.slice(0, 6).map((listing, index) => ({
    id: `grailed-${listing.listingId}`,
    category: "commerce" as const,
    source: "grailed" as const,
    label: listing.designer ?? listing.brand ?? listing.category,
    message: formatListingMessage(listing),
    score: 72 - index * 3,
    direction: "up" as const,
    tags: ["resale", "designer", listing.category, listing.productType ?? "listing"].filter(
      Boolean,
    ) as string[],
  }));

  const designerSignals = data.risingDesigners.slice(0, 3).map((mention, index) => ({
    id: `grailed-designer-${index}`,
    category: "competitor" as const,
    source: "grailed" as const,
    label: "Rising Designer",
    message: `${mention.term} (${mention.count} listings)`,
    score: 66 + index * 4,
    direction: "up" as const,
    tags: ["designer", "resale"],
  }));

  const archiveSignals = data.archiveFashionSignals.slice(0, 2).map((mention, index) => ({
    id: `grailed-archive-${index}`,
    category: "trend" as const,
    source: "grailed" as const,
    label: "Archive Signal",
    message: `${mention.term} (${mention.count} hits)`,
    score: 64 + index * 4,
    direction: "up" as const,
    tags: ["archive", "fashion"],
  }));

  const luxurySignals = data.luxuryStreetwearSignals.slice(0, 2).map((mention, index) => ({
    id: `grailed-luxury-${index}`,
    category: "trend" as const,
    source: "grailed" as const,
    label: "Luxury Streetwear",
    message: `${mention.term} (${mention.count} hits)`,
    score: 68 + index * 4,
    direction: "up" as const,
    tags: ["luxury", "streetwear"],
  }));

  const demandSignals = data.resaleDemandProxies
    .slice(0, 2)
    .map((signal, index) => ({
      id: `grailed-demand-${index}`,
      category: "consumer" as const,
      source: "grailed" as const,
      label: "Resale Signal",
      message: signal,
      score: 62 + index * 4,
      direction: "up" as const,
      tags: ["demand", "resale"],
    }));

  return [
    ...listingSignals,
    ...designerSignals,
    ...archiveSignals,
    ...luxurySignals,
    ...demandSignals,
  ];
}

function formatListingMessage(listing: GrailedListing): string {
  const parts = [listing.title, `${listing.currency}${listing.price}`];
  if (listing.condition) parts.push(listing.condition);
  if (listing.demandProxy) parts.push(listing.demandProxy);
  return parts.join(" · ");
}

function buildResult(
  data: GrailedIntelligenceData,
  mode: "live" | "simulated",
  simulatedReason?: string,
): SourceIntelligence<GrailedIntelligenceData> {
  const rawSignals = toSignals(data);
  const sampleSize =
    data.listings.length +
    data.risingDesigners.length +
    data.archiveFashionSignals.length;
  const confidence = computeConfidence({
    mode,
    sampleSize,
    freshness: mode === "live" ? 0.84 : 0.4,
    dataQuality: mode === "live" ? 0.8 : 0.4,
  });
  const signals = normalizeSignals(rawSignals, confidence);
  const scores = aggregateConnectorScores(
    signals,
    { demand: 0.55, trend: 0.45 },
    confidence,
  );

  return {
    source: "grailed",
    mode,
    loadedAt: new Date().toISOString(),
    signals,
    data,
    simulatedReason,
    scores,
  };
}

/** Scan Grailed partner inventory for designer fashion / resale intelligence. */
export async function scanGrailed(
  _input: ConnectorInput = {},
): Promise<SourceIntelligence<GrailedIntelligenceData>> {
  if (isGrailedLiveConfigured()) {
    try {
      const data = await fetchLiveGrailed();
      return buildResult(data, "live");
    } catch (error) {
      const reason =
        error instanceof Error
          ? `Grailed API failed (${error.message}) — no data fabricated`
          : "Grailed API failed — no data fabricated";
      return buildResult(EMPTY_GRAILED_DATA, "simulated", reason);
    }
  }

  return buildResult(
    EMPTY_GRAILED_DATA,
    "simulated",
    "Grailed has no open public API — partner credentials (GRAILED_API_KEY + GRAILED_API_BASE_URL) required; no marketplace data is fabricated",
  );
}
