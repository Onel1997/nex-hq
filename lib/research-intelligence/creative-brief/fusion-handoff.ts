"use client";

import type { DesignStudioBrief } from "@/agents/design/studio-brief";
import {
  buildDesignMissionFromHandoff,
  saveDesignMission,
} from "@/lib/design/design-mission-store";
import type { ReportCreativeBrief } from "@/lib/research-intelligence/report";
import type { CreativeBriefHandoffPayload } from "./handoff-store";

const COLOR_HEX: Record<string, string> = {
  black: "#1a1a1a",
  cream: "#f5f0e8",
  stone: "#8a8278",
  grey: "#6b6b6b",
  gray: "#6b6b6b",
  white: "#f8f8f8",
};

function colorHex(name: string): string | undefined {
  const key = name.toLowerCase().split(/\s+/)[0];
  return COLOR_HEX[key];
}

export function buildDesignStudioBriefFromFusion(
  brief: CreativeBriefHandoffPayload | ReportCreativeBrief,
): DesignStudioBrief {
  const designId = `fusion-${brief.conceptName.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 32)}`;
  const placement = brief.recommendedPlacement[0] ?? "Center chest, 8 cm below collar";
  const typography = brief.typographyDirection.join(" · ") || "Minimal Sans";
  const graphic = brief.graphicDirection.join(" · ") || "Minimal emblem";
  const printMethod = brief.printTechnique[0] ?? "Screen Print";
  const material = brief.materialRecommendation.join(", ") || "280 GSM Cotton";
  const palette = brief.colorPalette.length > 0
    ? brief.colorPalette
    : ["Black", "Cream", "Stone"];

  return {
    designId,
    title: brief.conceptName,
    role: "hero",
    product: brief.recommendedProduct,
    color: palette[0] ?? "Black",
    printArea: placement,
    placement,
    dimensions: "28 cm × 22 cm chest graphic zone",
    visualConcept: brief.executiveSummary,
    designDescription: brief.businessCase,
    geometry: "Editorial negative space with single focal mark",
    visualElements: brief.graphicDirection.length > 0 ? brief.graphicDirection : ["minimal mark"],
    typography,
    colorPalette: palette.map((name) => ({
      name,
      usage: "Garment or ink tone",
      hex: colorHex(name),
    })),
    productionMethod: printMethod,
    materialEffects: material,
    negativeSpaceRules: brief.avoid.length > 0
      ? `Vermeiden: ${brief.avoid.join(", ")}`
      : "Mindestens 40 % negativer Raum um die Hauptmarke",
    designerInstructions: [
      brief.nextStep,
      ...brief.researchEvidence.slice(0, 3).map((source) => `Research-Beleg: ${source}`),
      `Brand Guardrails: ${brief.avoid.slice(0, 4).join(", ") || "Quiet luxury restraint"}`,
    ],
    svgPrompt: `${brief.conceptName}, ${graphic}, ${typography}, Milaene premium streetwear, ${palette.join(" ")} palette, editorial negative space, print-ready vector`,
    mockupPrompt: `Flat-lay ${brief.recommendedProduct}, ${palette[0]} base, ${placement}, luxury minimal styling`,
    imagePrompt: `Milaene ${brief.recommendedProduct}, ${graphic}, ${brief.conceptName}, calm luxury streetwear`,
    printReadinessScore: Math.min(95, Math.round((brief.scores.brandFit + brief.scores.trendScore) / 2)),
    dnaScore: brief.scores.brandFit,
    commercialScore: brief.scores.commercialPotential,
    campaignPotential:
      brief.scores.commercialPotential >= 70 ? "Starkes Kapsel-Potenzial" : "Beobachten",
  };
}

export function activateFusionHandoffInDesignStudio(
  brief: CreativeBriefHandoffPayload | ReportCreativeBrief,
  generatedAt: string,
): void {
  const studioBrief = buildDesignStudioBriefFromFusion(brief);
  const reportId = `fusion-${generatedAt}`;

  const mission = buildDesignMissionFromHandoff({
    reportId,
    reportTitle: brief.conceptName,
    collectionName: brief.conceptName,
    intelligenceContext: {
      sourceType: "research-studio-fusion",
      sourceReportId: reportId,
      reportTitle: brief.conceptName,
      executiveSummary: brief.executiveSummary,
      keyFindings: brief.researchEvidence,
      recommendations: [
        brief.nextStep,
        ...brief.typographyDirection,
        ...brief.graphicDirection,
      ],
      connectedDepartments: ["research", "design"],
      productName: brief.recommendedProduct,
      collectionName: brief.conceptName,
    },
    brief: studioBrief,
  });

  saveDesignMission(mission);
}
