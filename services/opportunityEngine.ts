import { MILAENE_DNA, scoreDnaAlignment } from "@/services/milaene-dna";
import type { CompetitorIntel } from "@/services/competitorScanner";
import type { AggregatedSignals } from "@/services/signalAggregator";
import type { ProductIntelligence } from "@/services/productAnalyzer";
import type { TrendScore } from "@/services/trendScanner";

export type OpportunityPriority = "critical" | "high" | "medium" | "low";

export interface OpportunityScores {
  demandScore: number;
  competitionScore: number;
  socialScore: number;
  trendScore: number;
  dnaMatch: number;
  estimatedPotential: number;
}

export interface OpportunityDecisions {
  products: string[];
  colors: string[];
  targetAudience: string;
  collection: string;
  designs: string[];
  priority: OpportunityPriority;
}

export interface ResearchOpportunity {
  id: string;
  title: string;
  confidence: number;
  products: string[];
  colors: string[];
  targetAudience: string;
  marketPotential: string;
  competitorStrength: string;
  rationale: string;
  productCount: number;
  themes: string[];
  highlights: string[];
  featured?: boolean;
  scores: OpportunityScores;
  decisions: OpportunityDecisions;
}

export interface AiRecommendation {
  nextCollection: string;
  fitScore: number;
  demandChange: number;
  recommendedProducts: string[];
  rationale: string;
  priority: OpportunityPriority;
  estimatedPotential: number;
}

interface OpportunityTemplate {
  id: string;
  title: string;
  products: string[];
  colors: string[];
  targetAudience: string;
  marketPotential: string;
  competitorStrength: string;
  rationale: string;
  themes: string[];
  highlights: string[];
  designs: string[];
  featured?: boolean;
  demandKeywords: string[];
  socialKeywords: string[];
}

const TEMPLATES: OpportunityTemplate[] = [
  {
    id: "urban-earth-capsule",
    title: "Urban Earth Capsule",
    products: ["Heavy Tee", "Hoodie", "Cap"],
    colors: ["Earth Brown", "Sage Green"],
    targetAudience: MILAENE_DNA.audience,
    marketPotential: "Hoch — Earth Tones +22% across Google, TikTok, Pinterest",
    competitorStrength: "Gering — wenig direkte Premium-POD Konkurrenz",
    rationale:
      "Trend steigt auf allen Kanälen, Konkurrenz gering, passt zu Milaene DNA und POD-Katalog",
    themes: ["Earth Tones", "Oversized Fits"],
    highlights: ["Premium Hoodie", "Embroidery"],
    designs: ["Minimal chest embroidery", "Earth tone color blocking", "Boxy oversized fit"],
    featured: true,
    demandKeywords: ["earth tone", "oversized", "hoodie", "capsule"],
    socialKeywords: ["earthtones", "oversizedstreetwear", "quietluxury"],
  },
  {
    id: "signal-green-drop",
    title: "Signal Green Micro-Drop",
    products: ["Boxy Tee", "Structured Cap", "Heavy Hoodie"],
    colors: ["Signal Green", "Obsidian Black"],
    targetAudience: "18-28 urban creatives",
    marketPotential: "Mittel-Hoch — Accent Color Scarcity, starke Marken-DNA",
    competitorStrength: "Mittel — Essentials dominiert Basics-Segment",
    rationale: "Signal Green ist Markenfarbe — Scarcity-Drop mit maximaler DNA-Passung",
    themes: ["Accent Color", "Scarcity"],
    highlights: ["Boxy Tee", "Structured Cap"],
    designs: ["Signal green accent panel", "Tone-on-tone logo", "Limited drop numbering"],
    demandKeywords: ["signal green", "boxy tee", "cap"],
    socialKeywords: ["streetwearcapsule", "minimal"],
  },
  {
    id: "premium-embroidery-line",
    title: "Premium Embroidery Line",
    products: ["Hoodie", "Crewneck", "Cap"],
    colors: ["Obsidian Black", "Off White"],
    targetAudience: MILAENE_DNA.audience,
    marketPotential: "Hoch — Differentiation via Craft, Reddit + Etsy demand",
    competitorStrength: "Niedrig — wenig POD-Embroidery im Premium-Segment",
    rationale: "MarketPrint embroidery-ready, schwache Shorts ausgleichen, hohe Social-Differenzierung",
    themes: ["MarketPrint", "Hero Products"],
    highlights: ["Hoodie", "Crewneck", "Cap"],
    designs: ["Chest embroidery", "Back neck detail", "Premium heavyweight blank"],
    demandKeywords: ["embroidery", "premium hoodie", "heavyweight"],
    socialKeywords: ["embroidered", "quietluxury"],
  },
  {
    id: "heavy-outerwear-capsule",
    title: "Heavy Outerwear Capsule",
    products: ["Heavy Hoodie", "Oversized Jacket", "Cap"],
    colors: ["Concrete Grey", "Earth Brown"],
    targetAudience: "18-35 premium streetwear",
    marketPotential: "Steigend — Outerwear Gap, Amazon + Etsy Bestseller-Signal",
    competitorStrength: "Mittel — Represent, Cole Buxton aktiv",
    rationale: "Kategorie-Lücke im Katalog, saisonale Nachfrage, Premium-Positionierung",
    themes: ["Outerwear", "Premium Layering"],
    highlights: ["Heavy Hoodie", "Structured Outerwear"],
    designs: ["Layering-focused silhouettes", "Heavy fleece interior", "Structured shoulders"],
    demandKeywords: ["outerwear", "heavy hoodie", "layering"],
    socialKeywords: ["oversized", "premiumstreetwear"],
  },
];

export interface OpportunityEngineInput {
  products: ProductIntelligence;
  trends: TrendScore[];
  competitors: CompetitorIntel[];
  signals?: AggregatedSignals;
}

function matchSignalScore(
  signals: AggregatedSignals | undefined,
  keywords: string[],
  category?: keyof Pick<
    AggregatedSignals,
    "social" | "trend" | "commerce" | "competitor" | "consumer"
  >,
): number {
  if (!signals) return 60;

  const pool = category ? signals[category].signals : signals.all;

  const matches = pool.filter((s) =>
    keywords.some(
      (kw) =>
        s.label.toLowerCase().includes(kw) ||
        s.message.toLowerCase().includes(kw) ||
        s.tags?.some((t) => t.includes(kw)),
    ),
  );

  if (matches.length === 0) return 55;
  return Math.round(
    matches.reduce((sum, m) => sum + m.score, 0) / matches.length,
  );
}

function scoreTemplate(
  template: OpportunityTemplate,
  input: OpportunityEngineInput,
): OpportunityScores {
  const { products, trends, competitors, signals } = input;

  const trendBoost = trends
    .filter((t) => t.direction === "up")
    .reduce((sum, t) => sum + t.change, 0);

  const dnaMatch = scoreDnaAlignment({
    styleMatch: /premium|editorial/.test(template.title) ? 95 : 80,
    colorMatch: template.colors.some((c) =>
      MILAENE_DNA.colors.some((d) =>
        c.toLowerCase().includes(d.split(" ")[0]),
      ),
    )
      ? 92
      : 72,
    silhouetteMatch: template.themes.some((t) =>
      /oversized|boxy|relaxed/i.test(t),
    )
      ? 90
      : 75,
    qualityMatch: /premium|embroidery|heavy/i.test(template.title) ? 88 : 72,
  });

  const demandScore = Math.min(
    98,
    Math.round(
      (matchSignalScore(signals, template.demandKeywords, "trend") +
        matchSignalScore(signals, template.demandKeywords, "commerce") +
        matchSignalScore(signals, template.demandKeywords, "consumer")) /
        3,
    ) + Math.min(12, trendBoost / 8),
  );

  const socialScore = Math.min(
    98,
    matchSignalScore(signals, template.socialKeywords, "social"),
  );

  const rising = trends.filter((t) => t.direction === "up");
  const trendScore = Math.min(
    98,
    rising.length > 0
      ? Math.round(
          rising.slice(0, 4).reduce((s, t) => s + t.dnaMatch, 0) /
            Math.min(4, rising.length),
        )
      : 70,
  );

  const competitorThreat = competitors.filter((c) =>
    ["watching", "analyzing", "tracked"].includes(c.status),
  ).length;
  const competitionScore = Math.max(
    20,
    Math.min(90, 85 - competitorThreat * 8),
  );

  const productGapBoost = template.products.some((p) =>
    products.opportunities.some((o) =>
      o.toLowerCase().includes(p.toLowerCase().split(" ")[0]),
    ),
  )
    ? 6
    : 0;

  const estimatedPotential = Math.min(
    98,
    Math.round(
      demandScore * 0.3 +
        socialScore * 0.2 +
        trendScore * 0.2 +
        dnaMatch * 0.2 +
        competitionScore * 0.1 +
        productGapBoost,
    ),
  );

  return {
    demandScore,
    competitionScore,
    socialScore,
    trendScore,
    dnaMatch,
    estimatedPotential,
  };
}

function toPriority(potential: number): OpportunityPriority {
  if (potential >= 88) return "critical";
  if (potential >= 78) return "high";
  if (potential >= 65) return "medium";
  return "low";
}

/** Generate design-ready opportunities with multi-source scoring. */
export function generateOpportunities(
  input: OpportunityEngineInput,
): ResearchOpportunity[] {
  return TEMPLATES.map((template) => {
    const scores = scoreTemplate(template, input);
    const priority = toPriority(scores.estimatedPotential);

    return {
      id: template.id,
      title: template.title,
      confidence: scores.estimatedPotential,
      products: template.products,
      colors: template.colors,
      targetAudience: template.targetAudience,
      marketPotential: template.marketPotential,
      competitorStrength: template.competitorStrength,
      rationale: template.rationale,
      productCount: template.products.length,
      themes: template.themes,
      highlights: template.highlights,
      featured: template.featured,
      scores,
      decisions: {
        products: template.products,
        colors: template.colors,
        targetAudience: template.targetAudience,
        collection: template.title,
        designs: template.designs,
        priority,
      },
    };
  }).sort((a, b) => b.scores.estimatedPotential - a.scores.estimatedPotential);
}

/** AI strategic advice with priority and potential scoring. */
export function generateAiRecommendation(
  opportunities: ResearchOpportunity[],
  trends: TrendScore[],
): AiRecommendation {
  const featured =
    opportunities.find((o) => o.featured) ?? opportunities[0] ?? null;

  const topTrend = trends
    .filter((t) => t.direction === "up")
    .sort((a, b) => b.change - a.change)[0];

  if (!featured) {
    return {
      nextCollection: "Urban Earth Capsule",
      fitScore: 85,
      demandChange: topTrend?.change ?? 18,
      recommendedProducts: ["Heavy Tee", "Hoodie", "Cap"],
      rationale: "Default recommendation from trend intelligence",
      priority: "high",
      estimatedPotential: 85,
    };
  }

  return {
    nextCollection: featured.title,
    fitScore: featured.scores.dnaMatch,
    demandChange: topTrend?.change ?? Math.round(featured.scores.demandScore / 5),
    recommendedProducts: featured.products,
    rationale: featured.rationale,
    priority: featured.decisions.priority,
    estimatedPotential: featured.scores.estimatedPotential,
  };
}
