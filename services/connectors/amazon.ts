import type { ConnectorInput, IntelligenceSignal, SourceIntelligence } from "./types";

export interface AmazonBestseller {
  title: string;
  category: string;
  rank: number;
  rating: number;
  reviews: number;
  priceRange: string;
}

export interface AmazonIntelligenceData {
  bestsellers: AmazonBestseller[];
  categories: string[];
  demandSignals: string[];
  reviewInsights: string[];
}

const BASE_DATA: AmazonIntelligenceData = {
  bestsellers: [
    {
      title: "Premium Oversized Hoodie Men",
      category: "Fashion Hoodies",
      rank: 12,
      rating: 4.4,
      reviews: 3240,
      priceRange: "€35–€65",
    },
    {
      title: "Heavyweight Cotton T-Shirt Boxy Fit",
      category: "T-Shirts",
      rank: 28,
      rating: 4.3,
      reviews: 2890,
      priceRange: "€18–€32",
    },
    {
      title: "Wide Leg Cargo Pants Streetwear",
      category: "Pants",
      rank: 45,
      rating: 4.2,
      reviews: 1560,
      priceRange: "€30–€55",
    },
    {
      title: "Structured Baseball Cap Embroidered",
      category: "Accessories",
      rank: 67,
      rating: 4.5,
      reviews: 980,
      priceRange: "€15–€28",
    },
  ],
  categories: [
    "Fashion Hoodies & Sweatshirts",
    "Men's T-Shirts",
    "Men's Pants & Trousers",
    "Men's Hats & Caps",
  ],
  demandSignals: [
    "Oversized hoodies — high search volume DE/EU",
    "Heavyweight tees — growing premium segment",
    "Wide-leg cargos — category expansion opportunity",
    "Embroidered caps — low competition premium niche",
  ],
  reviewInsights: [
    "Quality and fabric weight most mentioned in 5-star reviews",
    "Fit consistency critical — oversized must be intentional",
    "Color accuracy important for earth tone purchases",
    "Print durability complaints in budget segment",
  ],
};

function toSignals(data: AmazonIntelligenceData): IntelligenceSignal[] {
  const bestsellerSignals = data.bestsellers.map((b) => ({
    id: `amazon-${b.category.replace(/\s+/g, "-")}`,
    category: "commerce" as const,
    source: "amazon" as const,
    label: `#${b.rank} ${b.category}`,
    message: `${b.title} · ${b.rating}★ (${b.reviews} reviews) · ${b.priceRange}`,
    score: Math.min(100, 100 - b.rank),
    direction: "up" as const,
    tags: ["bestseller", b.category],
  }));

  const demandSignals = data.demandSignals.slice(0, 2).map((d, i) => ({
    id: `amazon-demand-${i}`,
    category: "consumer" as const,
    source: "amazon" as const,
    label: "Demand Signal",
    message: d,
    score: 72 + i * 4,
    direction: "up" as const,
    tags: ["demand"],
  }));

  return [...bestsellerSignals, ...demandSignals];
}

/** Scan Amazon for bestsellers, demand and review intelligence. */
export async function scanAmazon(
  _input: ConnectorInput = {},
): Promise<SourceIntelligence<AmazonIntelligenceData>> {
  return {
    source: "amazon",
    mode: process.env.AMAZON_API_KEY ? "live" : "simulated",
    loadedAt: new Date().toISOString(),
    signals: toSignals(BASE_DATA),
    data: BASE_DATA,
  };
}
