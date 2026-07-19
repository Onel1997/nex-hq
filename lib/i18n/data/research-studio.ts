import type { LucideIcon } from "lucide-react";
import {
  Layers,
  Palette,
  Sparkles,
  Type,
  Wand2,
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
    id: "weekly-ideas",
    labelKey: "weeklyIdeas",
    prompt: "Erstelle 4 Wochenideen für Milaene — originale Sprüche und konkrete visuelle Designideen.",
    icon: Sparkles,
    accent: "violet",
  },
  {
    id: "single-idea",
    labelKey: "singleIdea",
    prompt: "Erstelle eine einzelne Designidee mit Spruch, Typografie und Platzierung für Milaene.",
    icon: Wand2,
    accent: "indigo",
  },
  {
    id: "plan-collection",
    labelKey: "planCollection",
    prompt:
      "Kollektion planen: Quiet Continuum — 8 zusammenhängende, aber unterscheidbare Designideen für die Saison.",
    icon: Layers,
    accent: "pearl",
  },
  {
    id: "typography-direction",
    labelKey: "luxuryTypography",
    prompt:
      "4 Wochenideen mit Fokus auf editorialer Typografie und ruhiger Platzierung für Oversized Tees.",
    icon: Type,
    accent: "coral",
  },
  {
    id: "color-direction",
    labelKey: "colorIntelligence",
    prompt:
      "4 Wochenideen mit erdiger Farbwelt (Black, Stone, Cream) und konkreten Artwork-Farben.",
    icon: Palette,
    accent: "emerald",
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
