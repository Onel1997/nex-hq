/**
 * Legacy report adapter — keeps older fusion reports readable.
 */

import { emptyResearchStudioReport } from "./types";
import type { ResearchStudioReport } from "./types";
import {
  RESEARCH_STUDIO_REPORT_LEGACY_VERSION,
  RESEARCH_STUDIO_REPORT_VERSION,
} from "./types";

export function isLegacyTrendReport(report: ResearchStudioReport): boolean {
  if (report.researchMode === "trend_intelligence") return true;
  if (!report.creativeResearch) {
    const version = report.version ?? "";
    return version.startsWith("5.") || version.startsWith("6.") || version === RESEARCH_STUDIO_REPORT_LEGACY_VERSION;
  }
  return false;
}

export function isCreativeResearchReport(report: ResearchStudioReport): boolean {
  return (
    report.researchMode === "weekly_design_ideas" ||
    report.researchMode === "collection_creator"
  );
}

/**
 * Normalize unknown/partial persisted reports into the current schema.
 * Older reports without researchMode are treated as trend_intelligence.
 */
export function adaptLegacyResearchStudioReport(
  raw: Partial<ResearchStudioReport> | null | undefined,
): ResearchStudioReport {
  const base = emptyResearchStudioReport(
    typeof raw?.generatedAt === "string" ? raw.generatedAt : new Date().toISOString(),
  );

  if (!raw || typeof raw !== "object") return base;

  const researchMode =
    raw.researchMode === "weekly_design_ideas" ||
    raw.researchMode === "collection_creator" ||
    raw.researchMode === "trend_intelligence"
      ? raw.researchMode
      : raw.creativeResearch
        ? "weekly_design_ideas"
        : "trend_intelligence";

  const providerMode =
    raw.providerMode === "creative_only" ||
    raw.providerMode === "shopify_assisted" ||
    raw.providerMode === "full_intelligence"
      ? raw.providerMode
      : researchMode === "trend_intelligence"
        ? "full_intelligence"
        : "creative_only";

  return {
    ...base,
    ...raw,
    version: typeof raw.version === "string" ? raw.version : RESEARCH_STUDIO_REPORT_VERSION,
    researchMode,
    providerMode,
    prioritizedOpportunities: raw.prioritizedOpportunities ?? [],
    sourceTrust: raw.sourceTrust ?? [],
    keyInsights: raw.keyInsights ?? [],
    topOpportunities: raw.topOpportunities ?? [],
    designDirections: raw.designDirections ?? [],
    recommendedProducts: raw.recommendedProducts ?? [],
    colorPalettes: raw.colorPalettes ?? [],
    riskWarnings: raw.riskWarnings ?? [],
    suggestedNextActions: raw.suggestedNextActions ?? [],
    brandLearning: raw.brandLearning ?? [],
    caveats: raw.caveats ?? [],
    creativeResearch: raw.creativeResearch ?? null,
    creativeBrief: raw.creativeBrief ?? null,
    brandIntelligence: raw.brandIntelligence ?? null,
    patternIntelligence: raw.patternIntelligence ?? null,
  };
}
