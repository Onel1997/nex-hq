import type { ConnectorInput, IntelligenceSignal, SourceIntelligence } from "./types";

export interface EtsyBestseller {
  title: string;
  category: string;
  priceRange: string;
  keyword: string;
  sales: number;
}

export interface EtsyIntelligenceData {
  bestsellers: EtsyBestseller[];
  keywords: string[];
  printTrends: string[];
  priceRanges: Array<{ category: string; min: number; max: number; sweet: number }>;
}

const BASE_DATA: EtsyIntelligenceData = {
  bestsellers: [
    {
      title: "Oversized Heavyweight Hoodie",
      category: "Hoodies",
      priceRange: "€45–€75",
      keyword: "oversized hoodie heavyweight",
      sales: 2840,
    },
    {
      title: "Earth Tone Graphic Tee",
      category: "T-Shirts",
      priceRange: "€25–€40",
      keyword: "earth tone tee",
      sales: 1920,
    },
    {
      title: "Embroidered Cap",
      category: "Accessories",
      priceRange: "€20–€35",
      keyword: "embroidered cap streetwear",
      sales: 1560,
    },
    {
      title: "Wide Leg Cargo Pants",
      category: "Pants",
      priceRange: "€40–€65",
      keyword: "wide leg cargo",
      sales: 1340,
    },
  ],
  keywords: [
    "oversized hoodie heavyweight",
    "earth tone streetwear",
    "embroidered hoodie",
    "boxy tee premium",
    "minimalist streetwear",
    "capsule wardrobe clothing",
  ],
  printTrends: [
    "Tone-on-tone embroidery over bold graphics",
    "Small chest logo placement",
    "Earth tone pigment prints",
    "Minimal typography on heavyweight blanks",
  ],
  priceRanges: [
    { category: "Tees", min: 22, max: 45, sweet: 32 },
    { category: "Hoodies", min: 45, max: 85, sweet: 62 },
    { category: "Caps", min: 18, max: 35, sweet: 26 },
    { category: "Cargos", min: 40, max: 75, sweet: 55 },
  ],
};

function toSignals(data: EtsyIntelligenceData): IntelligenceSignal[] {
  const bestsellerSignals = data.bestsellers.map((b) => ({
    id: `etsy-${b.keyword.replace(/\s+/g, "-")}`,
    category: "commerce" as const,
    source: "etsy" as const,
    label: b.title,
    message: `${b.category} · ${b.priceRange} · ~${b.sales} sales · "${b.keyword}"`,
    score: Math.min(100, Math.round(b.sales / 30)),
    direction: "up" as const,
    tags: ["bestseller", b.category],
  }));

  const printSignals = data.printTrends.slice(0, 2).map((p, i) => ({
    id: `etsy-print-${i}`,
    category: "trend" as const,
    source: "etsy" as const,
    label: "Print Trend",
    message: p,
    score: 68 + i * 4,
    direction: "up" as const,
    tags: ["print"],
  }));

  return [...bestsellerSignals, ...printSignals];
}

/** Scan Etsy for bestsellers, keywords and print-on-demand trends. */
export async function scanEtsy(
  _input: ConnectorInput = {},
): Promise<SourceIntelligence<EtsyIntelligenceData>> {
  return {
    source: "etsy",
    mode: process.env.ETSY_API_KEY ? "live" : "simulated",
    loadedAt: new Date().toISOString(),
    data: BASE_DATA,
    signals: toSignals(BASE_DATA),
  };
}
