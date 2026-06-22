import "server-only";

import { MILAENE_PROFILE } from "@/lib/business/business-profile";
import { loadMilaeneCommerceBaseline } from "@/lib/commerce/milaene-commerce-baseline";
import { buildDesignIntelligenceDashboard } from "@/lib/design/product-intelligence";
import type { MilaeneCommerceBaseline } from "@/lib/commerce/milaene-commerce-baseline";

export interface ResearchBrandBrain {
  style: string;
  audience: string;
  colors: string[];
  positioning: string;
}

export interface ResearchMarketBrain {
  trends: string[];
  demand: string[];
  colors: string[];
  categories: string[];
  sources: string[];
}

export interface ResearchCompetitorBrain {
  name: string;
  status: "watching" | "tracked" | "analyzing" | "stable";
  trendChange: string;
  signal: string;
}

export interface ResearchProductBrain {
  bestsellers: string[];
  weakProducts: string[];
  opportunities: string[];
  categories: string[];
}

export interface ResearchPodBrain {
  primarySupplier: string;
  secondarySuppliers: string[];
  availableProducts: number;
  newProducts: string[];
  marketPrintMatches: number;
  embroideryReady: number;
}

export interface ResearchOpportunity {
  id: string;
  title: string;
  productCount: number;
  themes: string[];
  highlights: string[];
  confidence: number;
  featured?: boolean;
}

export interface ResearchBrainSnapshot {
  loadedAt: string;
  commerceConnected: boolean;
  brand: ResearchBrandBrain;
  market: ResearchMarketBrain;
  competitors: ResearchCompetitorBrain[];
  products: ResearchProductBrain;
  pod: ResearchPodBrain;
  opportunities: ResearchOpportunity[];
}

const DEFAULT_COMPETITORS: ResearchCompetitorBrain[] = [
  {
    name: "Corteiz",
    status: "watching",
    trendChange: "+18% oversized demand",
    signal: "2 neue Drops",
  },
  {
    name: "Represent",
    status: "tracked",
    trendChange: "+12% premium positioning",
    signal: "Neue Kollektion erkannt",
  },
  {
    name: "Fear of God",
    status: "analyzing",
    trendChange: "Luxury segment shift",
    signal: "Preisanpassung beobachtet",
  },
  {
    name: "Essentials",
    status: "stable",
    trendChange: "Stable market share",
    signal: "Volume konstant",
  },
  {
    name: "Cole Buxton",
    status: "watching",
    trendChange: "+9% UK streetwear growth",
    signal: "Capsule drop frequency rising",
  },
];

const DEFAULT_OPPORTUNITIES: ResearchOpportunity[] = [
  {
    id: "urban-earth-capsule",
    title: "Urban Earth Capsule",
    productCount: 4,
    themes: ["Earth Tones", "Oversized Fits"],
    highlights: ["Premium Hoodie", "Embroidery"],
    confidence: 89,
    featured: true,
  },
  {
    id: "signal-green-drop",
    title: "Signal Green Micro-Drop",
    productCount: 3,
    themes: ["Accent Color", "Scarcity"],
    highlights: ["Boxy Tee", "Structured Cap"],
    confidence: 82,
  },
  {
    id: "premium-embroidery-line",
    title: "Premium Embroidery Line",
    productCount: 5,
    themes: ["MarketPrint", "Hero Products"],
    highlights: ["Hoodie", "Crewneck", "Cap"],
    confidence: 76,
  },
];

function buildFromBaseline(baseline: MilaeneCommerceBaseline): ResearchBrainSnapshot {
  const { productKnowledge, commerceIntelligence, marketPrintIntelligence, knowledge } =
    baseline;

  const designIntel = buildDesignIntelligenceDashboard(
    knowledge.products,
    undefined,
    commerceIntelligence,
  );

  const bestsellers =
    commerceIntelligence.topUnits.length > 0
      ? commerceIntelligence.topUnits.slice(0, 5).map((p) => p.title)
      : productKnowledge.bestsellerCandidates.slice(0, 5).map((p) => p.title);

  const weakProducts = designIntel.lowestPerforming
    .slice(0, 4)
    .map((p) => p.title);

  const opportunities = [
    ...productKnowledge.categoryGaps.slice(0, 3).map((g) => `${g} expansion`),
    ...baseline.insights
      .filter((i) => i.kind === "expansion" || i.kind === "marketprint")
      .slice(0, 2)
      .map((i) => i.message),
  ].slice(0, 5);

  const categories =
    productKnowledge.availableCategories.length > 0
      ? productKnowledge.availableCategories.slice(0, 6)
      : ["Hoodies", "Tees", "Cargos", "Caps"];

  const marketColors =
    productKnowledge.availableColors.length > 0
      ? productKnowledge.availableColors.slice(0, 5)
      : ["Obsidian Black", "Off-White", "Concrete Grey", "Earth Brown", "Signal Green"];

  const trendInsights = baseline.insights
    .filter((i) => /trend|season|streetwear|oversized|earth/i.test(i.message))
    .slice(0, 4)
    .map((i) => i.message);

  const demandSignals = [
    commerceIntelligence.allTimeBestseller
      ? `${commerceIntelligence.allTimeBestseller.title} — top demand`
      : "Oversized hoodies — rising demand",
    ...baseline.insights
      .filter((i) => i.kind === "bestseller" || i.kind === "category")
      .slice(0, 3)
      .map((i) => i.message),
  ].slice(0, 4);

  const newPodProducts = marketPrintIntelligence.catalogMatches
    .filter((m) => m.match.suitability >= 75)
    .slice(0, 4)
    .map((m) => m.title);

  return {
    loadedAt: new Date().toISOString(),
    commerceConnected: true,
    brand: {
      style: "Premium minimalist streetwear — oversized silhouettes, editorial drops",
      audience: MILAENE_PROFILE.targetAudience,
      colors: ["Obsidian Black", "Off-White", "Concrete Grey", "Signal Green"],
      positioning: MILAENE_PROFILE.positioning,
    },
    market: {
      trends:
        trendInsights.length > 0
          ? trendInsights
          : [
              "Oversized silhouettes accelerating",
              "Earth tones gaining SS26 momentum",
              "Premium streetwear segment expanding",
              "Embroidery as differentiation signal",
            ],
      demand: demandSignals,
      colors: marketColors,
      categories,
      sources: ["Reddit", "TikTok", "Pinterest", "Google Trends"],
    },
    competitors: DEFAULT_COMPETITORS,
    products: {
      bestsellers,
      weakProducts:
        weakProducts.length > 0
          ? weakProducts
          : ["Low-inventory basics", "Legacy tee variants"],
      opportunities:
        opportunities.length > 0
          ? opportunities
          : ["Wide-leg cargo expansion", "Premium hoodie embroidery", "Earth tone capsule"],
      categories,
    },
    pod: {
      primarySupplier: baseline.businessMeta.primarySupplier,
      secondarySuppliers: MILAENE_PROFILE.secondarySuppliers,
      availableProducts: productKnowledge.productCount,
      newProducts:
        newPodProducts.length > 0
          ? newPodProducts
          : ["Premium Hoodie", "Oversized Tee", "Structured Cap"],
      marketPrintMatches: marketPrintIntelligence.summary.matchedProducts,
      embroideryReady: marketPrintIntelligence.summary.embroideryCount,
    },
    opportunities: DEFAULT_OPPORTUNITIES,
  };
}

function buildFallbackSnapshot(): ResearchBrainSnapshot {
  return {
    loadedAt: new Date().toISOString(),
    commerceConnected: false,
    brand: {
      style: "Premium minimalist streetwear — oversized silhouettes, editorial drops",
      audience:
        "18–30 urban creatives — authenticity over hype, underground before mainstream",
      colors: ["Obsidian Black", "Off-White", "Concrete Grey", "Signal Green"],
      positioning: MILAENE_PROFILE.positioning,
    },
    market: {
      trends: [
        "Oversized silhouettes accelerating",
        "Earth tones gaining SS26 momentum",
        "Premium streetwear segment expanding",
        "Embroidery as differentiation signal",
      ],
      demand: [
        "Oversized hoodies — +18% demand signal",
        "Earth tone palette — rising search volume",
        "Premium segment — expanding AOV",
        "Wide-leg cargos — category gap opportunity",
      ],
      colors: ["Obsidian Black", "Off-White", "Earth Brown", "Sage", "Signal Green"],
      categories: ["Hoodies", "Tees", "Cargos", "Caps", "Outerwear"],
      sources: ["Reddit", "TikTok", "Pinterest", "Google Trends"],
    },
    competitors: DEFAULT_COMPETITORS,
    products: {
      bestsellers: [
        "Premium Oversized Hoodie",
        "Boxy Logo Tee",
        "Wide-Leg Cargo",
        "Structured Cap",
      ],
      weakProducts: ["Basic Tee Legacy", "Low-conversion sweatpants"],
      opportunities: [
        "Earth tone capsule",
        "Embroidery hero hoodie",
        "SS26 wide-leg expansion",
      ],
      categories: ["Hoodies", "Tees", "Cargos", "Caps"],
    },
    pod: {
      primarySupplier: MILAENE_PROFILE.primarySupplier,
      secondarySuppliers: MILAENE_PROFILE.secondarySuppliers,
      availableProducts: 0,
      newProducts: ["Premium Hoodie", "Oversized Tee", "Embroidery Crewneck"],
      marketPrintMatches: 0,
      embroideryReady: 0,
    },
    opportunities: DEFAULT_OPPORTUNITIES,
  };
}

/** Aggregate Milaene brand, commerce, POD and market intelligence for Research HQ. */
export async function loadResearchBrainIntelligence(): Promise<ResearchBrainSnapshot> {
  try {
    const baseline = await loadMilaeneCommerceBaseline();
    return buildFromBaseline(baseline);
  } catch (error) {
    console.warn("[Research Brain] Commerce baseline unavailable, using fallback", error);
    return buildFallbackSnapshot();
  }
}
