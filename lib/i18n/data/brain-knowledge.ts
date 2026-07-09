import {
  Eye,
  Megaphone,
  Palette,
  PenLine,
  Target,
  Users,
} from "lucide-react";
import type {
  BrainSection,
  BrainSectionId,
} from "@/lib/mock/brain-knowledge";
import type { Locale } from "../config";
import { getDictionary } from "../get-dictionary";
function interpolateWorkspace(text: string, workspaceName: string): string {
  return text.replace(/\{workspace\}/g, workspaceName);
}

const SECTION_META: Record<
  BrainSectionId,
  { icon: BrainSection["icon"]; lastUpdated: string; status: "synced" | "draft" }
> = {
  brand_vision: { icon: Eye, lastUpdated: "2026-06-01", status: "synced" },
  target_audience: { icon: Users, lastUpdated: "2026-05-20", status: "synced" },
  design_rules: { icon: Palette, lastUpdated: "2026-06-05", status: "synced" },
  competitors: { icon: Target, lastUpdated: "2026-06-07", status: "draft" },
  content_strategy: { icon: PenLine, lastUpdated: "2026-05-28", status: "synced" },
  marketing_strategy: { icon: Megaphone, lastUpdated: "2026-06-03", status: "synced" },
};

function getSectionEntries(
  locale: Locale,
  sectionId: BrainSectionId,
  workspaceName: string,
): Array<{ label: string; value: string; tags?: string[] }> {
  const sections = getDictionary(locale).brain.sections;
  const section = sections[sectionId];

  const entryKeys: Record<BrainSectionId, string[]> = {
    brand_vision: ["mission", "positioning", "pillars", "voiceTone"],
    target_audience: ["primary", "psychographics", "geography", "purchase"],
    design_rules: ["palette", "typography", "silhouettes", "graphics"],
    competitors: ["tier1", "tier2", "edge", "watch"],
    content_strategy: ["channels", "narrative", "pillars", "copyRules"],
    marketing_strategy: ["acquisition", "vip", "calendar", "kpis"],
  };

  const tagMap: Record<string, string[]> = {
    mission: ["core"],
    positioning: ["positioning"],
    pillars: ["pillars"],
    voiceTone: ["voice"],
    primary: ["primary"],
    psychographics: ["psychographics"],
    geography: ["geo"],
    purchase: ["commerce"],
    palette: ["color"],
    typography: ["type"],
    silhouettes: ["product"],
    graphics: ["graphics"],
    tier1: ["direct"],
    tier2: ["aspirational"],
    edge: ["differentiation"],
    watch: ["monitor"],
    channels: ["channels"],
    narrative: ["cadence"],
    copyRules: ["rules"],
    acquisition: ["acquisition"],
    vip: ["retention"],
    calendar: ["calendar"],
    kpis: ["metrics"],
  };

  return entryKeys[sectionId].map((key) => {
    const entry = section.entries[key as keyof typeof section.entries] as {
      label: string;
      value: string;
    };
    return {
      label: entry.label,
      value: interpolateWorkspace(entry.value, workspaceName),
      tags: tagMap[key],
    };
  });
}

export function getBrainSections(
  locale: Locale,
  workspaceName: string,
): BrainSection[] {
  const sections = getDictionary(locale).brain.sections;
  const sectionIds = Object.keys(SECTION_META) as BrainSectionId[];

  return sectionIds.map((id) => {
    const meta = SECTION_META[id];
    const content = sections[id];
    return {
      id,
      title: content.title,
      subtitle: content.subtitle,
      icon: meta.icon,
      lastUpdated: meta.lastUpdated,
      status: meta.status,
      entries: getSectionEntries(locale, id, workspaceName),
    };
  });
}

export function getBrainSystemStats(locale: Locale, workspaceName: string) {
  const sections = getBrainSections(locale, workspaceName);
  return {
    sections: sections.length,
    entries: sections.reduce((sum, s) => sum + s.entries.length, 0),
    synced: sections.filter((s) => s.status === "synced").length,
    draft: sections.filter((s) => s.status === "draft").length,
  };
}
