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
import type { Locale } from "../config";
import { getDictionary } from "../get-dictionary";
import type { ResearchRunPhase } from "@/components/research/v3/types";

export interface QuickMissionDefinition {
  id: string;
  labelKey: keyof typeof import("../locales/de/research-studio").researchStudio.missions;
  prompt: string;
  icon: LucideIcon;
  accent: string;
}

const QUICK_MISSION_DEFINITIONS: QuickMissionDefinition[] = [
  {
    id: "trend-discovery",
    labelKey: "trendDiscovery",
    prompt:
      "Identify the top 5 streetwear trends for the next season with DNA fit scores and product implications for Milaene.",
    icon: TrendingUp,
    accent: "violet",
  },
  {
    id: "collection-research",
    labelKey: "collectionResearch",
    prompt:
      "Research a connected 5–8 piece capsule collection with hero piece, supporting designs, drop strategy, and Milaene brand DNA alignment.",
    icon: Layers,
    accent: "indigo",
  },
  {
    id: "competitor-intelligence",
    labelKey: "competitorIntelligence",
    prompt:
      "Analyze Represent and Cole Buxton — positioning, pricing, product categories, strengths, weaknesses, and opportunities for Milaene.",
    icon: Swords,
    accent: "rose",
  },
  {
    id: "pinterest-intelligence",
    labelKey: "pinterestIntelligence",
    prompt:
      "Research Pinterest color palettes, aesthetics, and capsule trends for premium streetwear over the next 30 days.",
    icon: Eye,
    accent: "coral",
  },
  {
    id: "tiktok-scanner",
    labelKey: "tiktokScanner",
    prompt:
      "Find viral TikTok streetwear trends — silhouettes, hashtags, and graphics with commercial potential for Milaene.",
    icon: ScanSearch,
    accent: "cyan",
  },
  {
    id: "amazon-fashion",
    labelKey: "amazonFashion",
    prompt:
      "Research Amazon bestsellers in oversized hoodies and premium streetwear — demand signals, price bands, and white-space opportunities.",
    icon: ShoppingBag,
    accent: "amber",
  },
  {
    id: "etsy-bestseller",
    labelKey: "etsyBestseller",
    prompt:
      "Analyze Etsy print trends, keywords, and bestseller patterns relevant to Milaene POD products.",
    icon: Store,
    accent: "orange",
  },
  {
    id: "luxury-typography",
    labelKey: "luxuryTypography",
    prompt:
      "Research luxury typography trends for streetwear — editorial type treatments, placement, and 5 distinct design concepts.",
    icon: Type,
    accent: "pearl",
  },
  {
    id: "color-intelligence",
    labelKey: "colorIntelligence",
    prompt:
      "Research emerging color trends for SS26 streetwear — earth tones, muted palettes, and catalog-ready color directions.",
    icon: Palette,
    accent: "emerald",
  },
  {
    id: "streetwear-graphics",
    labelKey: "streetwearGraphics",
    prompt:
      "Find 5 winning oversized t-shirt graphic directions with precise art direction, print placement, and Milaene DNA fit.",
    icon: Sparkles,
    accent: "fuchsia",
  },
  {
    id: "season-forecast",
    labelKey: "seasonForecast",
    prompt:
      "Forecast streetwear demand for the upcoming season — silhouettes, materials, categories, and prioritized launch recommendations.",
    icon: Sun,
    accent: "gold",
  },
  {
    id: "audience-discovery",
    labelKey: "audienceDiscovery",
    prompt:
      "Research Milaene target audience segments — purchase behavior, aesthetic preferences, and content implications.",
    icon: Users,
    accent: "sky",
  },
];

export function getQuickMissions(locale: Locale) {
  const missions = getDictionary(locale).research.studio.missions;
  return QUICK_MISSION_DEFINITIONS.map((mission) => ({
    id: mission.id,
    label: missions[mission.labelKey],
    prompt: mission.prompt,
    icon: mission.icon,
    accent: mission.accent,
  }));
}

export function getPromptPlaceholders(locale: Locale): string[] {
  return [...getDictionary(locale).research.studio.placeholders];
}

const RUN_STEP_IDS = [
  "engine",
  "syncing",
  "normalizing",
  "fusing",
  "scoring",
  "recommendations",
  "building",
] as const satisfies readonly ResearchRunPhase[];

export function getResearchRunSteps(locale: Locale) {
  const steps = getDictionary(locale).research.studio.steps;
  return RUN_STEP_IDS.map((id) => ({ id, label: steps[id] }));
}

export function getStudioErrorMessages(locale: Locale) {
  return getDictionary(locale).research.studio.error;
}
