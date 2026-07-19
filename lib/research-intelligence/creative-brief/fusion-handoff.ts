"use client";

import type { DesignStudioBrief } from "@/agents/design/studio-brief";
import {
  buildDesignMissionFromHandoff,
  saveDesignMission,
} from "@/lib/design/design-mission-store";
import { DESIGN_STUDIO_MISSION } from "@/lib/research-intelligence/pattern-intelligence/types";
import type { ReportCreativeBrief } from "@/lib/research-intelligence/report";
import type { CreativeBriefHandoffPayload } from "./handoff-store";

const COLOR_HEX: Record<string, string> = {
  black: "#1a1a1a",
  schwarz: "#1a1a1a",
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

type HandoffBrief = CreativeBriefHandoffPayload | ReportCreativeBrief;

export function buildDesignStudioBriefFromFusion(
  brief: HandoffBrief,
): DesignStudioBrief {
  const designId = `fusion-${brief.conceptName.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 32)}`;
  const language = brief.designLanguage;
  const placement = language.placement[0] ?? brief.recommendedPlacement[0] ?? "Center chest, 8 cm below collar";
  const typography = language.typography.join(" · ") || brief.typographyDirection.join(" · ") || "Minimal Sans";
  const graphic = language.graphicStyle.join(" · ") || brief.graphicDirection.join(" · ") || "Minimal emblem";
  const printMethod = language.printTechnique[0] ?? brief.printTechnique[0] ?? "Screen Print";
  const material = language.material.join(", ") || brief.materialRecommendation.join(", ") || "280 GSM Cotton";
  const palette = language.colorWorld.length > 0
    ? language.colorWorld
    : brief.colorPalette.length > 0
      ? brief.colorPalette
      : ["Black", "Cream", "Stone"];
  const silhouette = brief.recommendedProduct;

  return {
    designId,
    title: brief.conceptName,
    role: "hero",
    product: silhouette,
    color: palette[0] ?? "Black",
    printArea: placement,
    placement,
    dimensions: "28 cm × 22 cm chest graphic zone",
    visualConcept: brief.executiveSummary,
    designDescription: [
      brief.missionStatement ?? DESIGN_STUDIO_MISSION,
      brief.businessCase,
      language.patternSummary ? `Pattern Summary: ${language.patternSummary}` : "",
    ]
      .filter(Boolean)
      .join("\n\n"),
    geometry: "Editorial negative space with single focal mark",
    visualElements: language.graphicStyle.length > 0
      ? language.graphicStyle
      : brief.graphicDirection.length > 0
        ? brief.graphicDirection
        : ["minimal mark"],
    typography,
    colorPalette: palette.map((name) => ({
      name,
      usage: "Garment or ink tone",
      hex: colorHex(name),
    })),
    productionMethod: printMethod,
    materialEffects: material,
    negativeSpaceRules: language.risks.length > 0
      ? language.risks.join(" · ")
      : brief.avoid.length > 0
        ? `Vermeiden: ${brief.avoid.join(", ")}`
        : "Mindestens 40 % negativer Raum um die Hauptmarke",
    designerInstructions: [
      brief.missionStatement ?? DESIGN_STUDIO_MISSION,
      `Design Language: ${language.patternSummary || graphic}`,
      `Typografie: ${typography}`,
      `Platzierung: ${language.placement.join(", ")}`,
      `Grafikstil: ${graphic}`,
      `Material: ${material}`,
      `Druck: ${printMethod}`,
      ...language.guardrails.map((rule) => `Guardrail: ${rule}`),
      ...brief.researchEvidence.slice(0, 3).map((source) => `Research-Beleg: ${source}`),
      `Verbote: ${language.prohibitions.slice(0, 5).join(", ") || brief.avoid.slice(0, 4).join(", ") || "Keine Kopie bestehender Milaene-Produkte"}`,
    ],
    svgPrompt: `${brief.conceptName}, ${graphic}, ${typography}, Milaene premium streetwear, ${palette.join(" ")} palette, editorial negative space, print-ready vector, original design inspired by successful patterns only`,
    mockupPrompt: `Flat-lay ${silhouette}, ${palette[0]} base, ${placement}, luxury minimal styling, no existing product recreation`,
    imagePrompt: `Milaene ${silhouette}, ${graphic}, ${brief.conceptName}, calm luxury streetwear, original artwork`,
    printReadinessScore: Math.min(95, Math.round((brief.scores.brandFit + brief.scores.trendScore) / 2)),
    dnaScore: brief.scores.brandFit,
    commercialScore: brief.scores.commercialPotential,
    campaignPotential:
      brief.scores.commercialPotential >= 70 ? "Starkes Kapsel-Potenzial" : "Beobachten",
  };
}

export function activateFusionHandoffInDesignStudio(
  brief: HandoffBrief,
  generatedAt: string,
): void {
  const studioBrief = buildDesignStudioBriefFromFusion(brief);
  const reportId = `fusion-${generatedAt}`;
  const language = brief.designLanguage;

  const mission = buildDesignMissionFromHandoff({
    reportId,
    reportTitle: brief.conceptName,
    collectionName: brief.conceptName,
    intelligenceContext: {
      sourceType: "research-studio-fusion",
      sourceReportId: reportId,
      reportTitle: brief.conceptName,
      executiveSummary: brief.executiveSummary,
      keyFindings: [
        ...brief.researchEvidence,
        language.patternSummary,
      ].filter(Boolean),
      recommendations: [
        brief.missionStatement ?? DESIGN_STUDIO_MISSION,
        ...language.typography,
        ...language.graphicStyle,
        ...language.placement,
      ],
      connectedDepartments: ["research", "design"],
      productName: brief.recommendedProduct,
      collectionName: brief.conceptName,
    },
    brief: studioBrief,
  });

  saveDesignMission(mission);
}
