import type { LucideIcon } from "lucide-react";
import {
  Eye,
  Megaphone,
  Palette,
  PenLine,
  Target,
  Users,
} from "lucide-react";

export type BrainSectionId =
  | "brand_vision"
  | "target_audience"
  | "design_rules"
  | "competitors"
  | "content_strategy"
  | "marketing_strategy";

export interface BrainSection {
  id: BrainSectionId;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  lastUpdated: string;
  status: "synced" | "draft";
  entries: BrainKnowledgeEntry[];
}

export interface BrainKnowledgeEntry {
  label: string;
  value: string;
  tags?: string[];
}

export const BRAIN_SECTIONS: BrainSection[] = [
  {
    id: "brand_vision",
    title: "Brand Vision",
    subtitle: "North star, positioning, and cultural identity",
    icon: Eye,
    lastUpdated: "2026-06-01",
    status: "synced",
    entries: [
      {
        label: "Mission",
        value:
          "{workspace} is a streetwear brand for urban creatives who move between culture, art, and the city — built on scarcity, story, and visual identity.",
        tags: ["core"],
      },
      {
        label: "Positioning",
        value:
          "Premium-accessible streetwear. Limited drops, not fast fashion. Every piece tells a chapter.",
        tags: ["positioning"],
      },
      {
        label: "Brand Pillars",
        value:
          "Culture-first · Drop cadence · Visual coherence · Community scarcity",
        tags: ["pillars"],
      },
      {
        label: "Voice Tone",
        value:
          "Confident, minimal, culturally fluent. Never try-hard. Speak like an insider, not a marketer.",
        tags: ["voice"],
      },
    ],
  },
  {
    id: "target_audience",
    title: "Target Audience",
    subtitle: "Who we build for and how they move",
    icon: Users,
    lastUpdated: "2026-05-20",
    status: "synced",
    entries: [
      {
        label: "Primary Segment",
        value:
          "Urban creatives aged 18–30 — photographers, musicians, designers, and culture-forward students in major cities.",
        tags: ["primary"],
      },
      {
        label: "Psychographics",
        value:
          "Values authenticity over hype. Follows underground before mainstream. Buys drops, not catalogs.",
        tags: ["psychographics"],
      },
      {
        label: "Geography",
        value: "NYC, LA, London, Tokyo — with secondary reach via Instagram and TikTok culture.",
        tags: ["geo"],
      },
      {
        label: "Purchase Behavior",
        value:
          "Mobile-first. Responds to scarcity and story. Average cart: $120–$280. Repeat buyers within 2 drops.",
        tags: ["commerce"],
      },
    ],
  },
  {
    id: "design_rules",
    title: "Design Rules",
    subtitle: "Visual system and product guardrails",
    icon: Palette,
    lastUpdated: "2026-06-05",
    status: "synced",
    entries: [
      {
        label: "Color Palette",
        value:
          "Core: obsidian black, off-white, concrete grey. Accent: signal green (drops only). No neon overload.",
        tags: ["color"],
      },
      {
        label: "Typography",
        value:
          "Headlines: bold grotesk. Body: clean sans. Logo lockup never stretched or recolored outside brand sheet.",
        tags: ["type"],
      },
      {
        label: "Product Silhouettes",
        value:
          "Oversized hoodies, boxy tees, wide-leg cargos, structured caps. No skinny fits.",
        tags: ["product"],
      },
      {
        label: "Graphic Treatment",
        value:
          "Minimal wordmarks, abstract city textures, limited edition numbering on capsule pieces.",
        tags: ["graphics"],
      },
    ],
  },
  {
    id: "competitors",
    title: "Competitors",
    subtitle: "Market landscape and differentiation",
    icon: Target,
    lastUpdated: "2026-06-07",
    status: "draft",
    entries: [
      {
        label: "Tier 1 — Direct",
        value:
          "Corteiz, Represent, Fear of God Essentials (streetwear lane), Palace — drop-led, culture-native brands.",
        tags: ["direct"],
      },
      {
        label: "Tier 2 — Aspirational",
        value:
          "Off-White (legacy), Stüssy, Aime Leon Dore — reference points for quality and storytelling.",
        tags: ["aspirational"],
      },
      {
        label: "Competitive Edge",
        value:
          "Tighter drops, stronger visual narrative per capsule, AI-accelerated ops without losing human creative control.",
        tags: ["differentiation"],
      },
      {
        label: "Watch List",
        value:
          "Syna World, No Faith Studios, Denim Tears — monitor drop cadence and community engagement.",
        tags: ["monitor"],
      },
    ],
  },
  {
    id: "content_strategy",
    title: "Content Strategy",
    subtitle: "Channels, formats, and narrative arc",
    icon: PenLine,
    lastUpdated: "2026-05-28",
    status: "synced",
    entries: [
      {
        label: "Primary Channels",
        value: "Instagram (hero), TikTok (culture), Email (VIP list), Site (canonical)",
        tags: ["channels"],
      },
      {
        label: "Drop Narrative Arc",
        value:
          "Tease (7 days) → Reveal (3 days) → Countdown (48 hrs) → Drop → Sell-through story (24 hrs post)",
        tags: ["cadence"],
      },
      {
        label: "Content Pillars",
        value:
          "Behind-the-design · City culture · Product detail · Community spotlight",
        tags: ["pillars"],
      },
      {
        label: "Copy Rules",
        value:
          "Short sentences. No exclamation spam. Product names always capitalized. Drop dates in local time.",
        tags: ["rules"],
      },
    ],
  },
  {
    id: "marketing_strategy",
    title: "Marketing Strategy",
    subtitle: "Growth, campaigns, and acquisition",
    icon: Megaphone,
    lastUpdated: "2026-06-03",
    status: "synced",
    entries: [
      {
        label: "Acquisition",
        value:
          "Organic-first via IG/TikTok. Paid retargeting only on warm audiences post-drop tease.",
        tags: ["acquisition"],
      },
      {
        label: "VIP List",
        value:
          "Early access 2 hours before public drop. Target 15% of revenue from repeat VIP buyers.",
        tags: ["retention"],
      },
      {
        label: "Campaign Calendar",
        value:
          "4 major drops/year · 2 capsule releases/quarter · 1 collaboration slot reserved",
        tags: ["calendar"],
      },
      {
        label: "KPIs",
        value:
          "Sell-through rate >85% · Email open >40% · IG save rate >5% on drop posts",
        tags: ["metrics"],
      },
    ],
  },
];

export const BRAIN_SYSTEM_STATS = {
  sections: BRAIN_SECTIONS.length,
  entries: BRAIN_SECTIONS.reduce((sum, s) => sum + s.entries.length, 0),
  synced: BRAIN_SECTIONS.filter((s) => s.status === "synced").length,
  draft: BRAIN_SECTIONS.filter((s) => s.status === "draft").length,
};
