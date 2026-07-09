export interface QuickMission {
  id: string;
  label: string;
  prompt: string;
  category: string;
}

export const QUICK_MISSIONS: QuickMission[] = [
  {
    id: "trend-discovery",
    label: "Trend Discovery",
    category: "Trends",
    prompt:
      "Identify the top 5 streetwear trends for the next season with DNA fit scores and product implications for Milaene.",
  },
  {
    id: "collection-research",
    label: "Collection Research",
    category: "Collection",
    prompt:
      "Research a connected 5–8 piece capsule collection with hero piece, supporting designs, drop strategy, and Milaene brand DNA alignment.",
  },
  {
    id: "competitor-analysis",
    label: "Competitor Analysis",
    category: "Competitors",
    prompt:
      "Analyze Represent and Cole Buxton — positioning, pricing, product categories, strengths, weaknesses, and opportunities for Milaene.",
  },
  {
    id: "pinterest-trends",
    label: "Pinterest Trends",
    category: "Social",
    prompt:
      "Research Pinterest color palettes, aesthetics, and capsule trends for premium streetwear over the next 30 days.",
  },
  {
    id: "tiktok-trends",
    label: "TikTok Trends",
    category: "Social",
    prompt:
      "Find viral TikTok streetwear trends — silhouettes, hashtags, and graphics with commercial potential for Milaene.",
  },
  {
    id: "amazon-research",
    label: "Amazon Research",
    category: "Commerce",
    prompt:
      "Research Amazon bestsellers in oversized hoodies and premium streetwear — demand signals, price bands, and white-space opportunities.",
  },
  {
    id: "etsy-research",
    label: "Etsy Research",
    category: "Commerce",
    prompt:
      "Analyze Etsy print trends, keywords, and bestseller patterns relevant to Milaene POD products.",
  },
  {
    id: "luxury-typography",
    label: "Luxury Typography",
    category: "Design",
    prompt:
      "Research luxury typography trends for streetwear — editorial type treatments, placement, and 5 distinct design concepts.",
  },
  {
    id: "color-trends",
    label: "Color Trends",
    category: "Trends",
    prompt:
      "Research emerging color trends for SS26 streetwear — earth tones, muted palettes, and catalog-ready color directions.",
  },
  {
    id: "streetwear-graphics",
    label: "Streetwear Graphics",
    category: "Design",
    prompt:
      "Find 5 winning oversized t-shirt graphic directions with precise art direction, print placement, and Milaene DNA fit.",
  },
  {
    id: "season-forecast",
    label: "Season Forecast",
    category: "Trends",
    prompt:
      "Forecast streetwear demand for the upcoming season — silhouettes, materials, categories, and prioritized launch recommendations.",
  },
  {
    id: "audience-research",
    label: "Audience Research",
    category: "Audience",
    prompt:
      "Research Milaene target audience segments — purchase behavior, aesthetic preferences, and content implications.",
  },
];

export const PROMPT_PLACEHOLDERS = [
  "Find 5 winning oversized t-shirt ideas.",
  "Research luxury typography trends.",
  "Find Pinterest trends for next month.",
  "Research oversized hoodie trends.",
  "Analyze Represent and Cole Buxton.",
];
