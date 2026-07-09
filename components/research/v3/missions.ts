import type { LucideIcon } from "lucide-react";
import {
  Eye,
  Layers,
  Palette,
  ScanSearch,
  ShoppingBag,
  Sparkles,
  Store,
  Sun,
  Swords,
  TrendingUp,
  Type,
  Users,
} from "lucide-react";

export interface QuickMission {
  id: string;
  label: string;
  prompt: string;
  icon: LucideIcon;
  accent: string;
}

export const QUICK_MISSIONS: QuickMission[] = [
  {
    id: "trend-discovery",
    label: "Trend Discovery",
    prompt:
      "Identify the top 5 streetwear trends for the next season with DNA fit scores and product implications for Milaene.",
    icon: TrendingUp,
    accent: "violet",
  },
  {
    id: "collection-research",
    label: "Collection Research",
    prompt:
      "Research a connected 5–8 piece capsule collection with hero piece, supporting designs, drop strategy, and Milaene brand DNA alignment.",
    icon: Layers,
    accent: "indigo",
  },
  {
    id: "competitor-intelligence",
    label: "Competitor Intelligence",
    prompt:
      "Analyze Represent and Cole Buxton — positioning, pricing, product categories, strengths, weaknesses, and opportunities for Milaene.",
    icon: Swords,
    accent: "rose",
  },
  {
    id: "pinterest-intelligence",
    label: "Pinterest Intelligence",
    prompt:
      "Research Pinterest color palettes, aesthetics, and capsule trends for premium streetwear over the next 30 days.",
    icon: Eye,
    accent: "coral",
  },
  {
    id: "tiktok-scanner",
    label: "TikTok Trend Scanner",
    prompt:
      "Find viral TikTok streetwear trends — silhouettes, hashtags, and graphics with commercial potential for Milaene.",
    icon: ScanSearch,
    accent: "cyan",
  },
  {
    id: "amazon-fashion",
    label: "Amazon Fashion Research",
    prompt:
      "Research Amazon bestsellers in oversized hoodies and premium streetwear — demand signals, price bands, and white-space opportunities.",
    icon: ShoppingBag,
    accent: "amber",
  },
  {
    id: "etsy-bestseller",
    label: "Etsy Bestseller Scan",
    prompt:
      "Analyze Etsy print trends, keywords, and bestseller patterns relevant to Milaene POD products.",
    icon: Store,
    accent: "orange",
  },
  {
    id: "luxury-typography",
    label: "Luxury Typography",
    prompt:
      "Research luxury typography trends for streetwear — editorial type treatments, placement, and 5 distinct design concepts.",
    icon: Type,
    accent: "pearl",
  },
  {
    id: "color-intelligence",
    label: "Color Intelligence",
    prompt:
      "Research emerging color trends for SS26 streetwear — earth tones, muted palettes, and catalog-ready color directions.",
    icon: Palette,
    accent: "emerald",
  },
  {
    id: "streetwear-graphics",
    label: "Streetwear Graphics",
    prompt:
      "Find 5 winning oversized t-shirt graphic directions with precise art direction, print placement, and Milaene DNA fit.",
    icon: Sparkles,
    accent: "fuchsia",
  },
  {
    id: "season-forecast",
    label: "Season Forecast",
    prompt:
      "Forecast streetwear demand for the upcoming season — silhouettes, materials, categories, and prioritized launch recommendations.",
    icon: Sun,
    accent: "gold",
  },
  {
    id: "audience-discovery",
    label: "Audience Discovery",
    prompt:
      "Research Milaene target audience segments — purchase behavior, aesthetic preferences, and content implications.",
    icon: Users,
    accent: "sky",
  },
];

export const PROMPT_PLACEHOLDERS = [
  "Find 5 winning oversized t-shirt ideas…",
  "Research luxury typography trends…",
  "Discover Pinterest aesthetics for next month…",
  "Scan TikTok for rising streetwear graphics…",
  "Analyze competitor positioning in premium streetwear…",
];
