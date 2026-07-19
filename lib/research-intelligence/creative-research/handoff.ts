"use client";

/**
 * Creative Research → Design Studio handoff.
 * Upload-based only — never requests design generation.
 */

import type { DesignStudioBrief } from "@/agents/design/studio-brief";
import {
  buildDesignMissionFromHandoff,
  saveDesignMission,
} from "@/lib/design/design-mission-store";
import type { CreativeDirectionHandoff, DesignIdea } from "./types";
import { CREATIVE_DIRECTION_HANDOFF_MISSION } from "./types";
import { buildCreativeDirectionHandoff } from "./engine";

const COLOR_HEX: Record<string, string> = {
  black: "#1a1a1a",
  schwarz: "#1a1a1a",
  cream: "#f5f0e8",
  stone: "#8a8278",
  grey: "#6b6b6b",
  gray: "#6b6b6b",
  white: "#f8f8f8",
  bone: "#e8e0d4",
  charcoal: "#2f2f2f",
  ivory: "#fffff0",
};

function colorHex(name: string): string | undefined {
  const key = name.toLowerCase().split(/\s+/)[0];
  return COLOR_HEX[key];
}

const STORAGE_KEY = "nexhq-creative-direction-handoff";

export interface StoredCreativeDirectionHandoff {
  handoff: CreativeDirectionHandoff;
  idea: DesignIdea;
  savedAt: string;
  source: "research-studio-creative";
}

export function saveCreativeDirectionHandoff(
  idea: DesignIdea,
  sourceResearchRunId: string,
): CreativeDirectionHandoff {
  const handoff = buildCreativeDirectionHandoff(idea, sourceResearchRunId);
  const payload: StoredCreativeDirectionHandoff = {
    handoff,
    idea,
    savedAt: new Date().toISOString(),
    source: "research-studio-creative",
  };
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  return handoff;
}

export function loadCreativeDirectionHandoff(): StoredCreativeDirectionHandoff | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredCreativeDirectionHandoff;
  } catch {
    return null;
  }
}

export function clearCreativeDirectionHandoff(): void {
  sessionStorage.removeItem(STORAGE_KEY);
}

export function buildDesignStudioBriefFromCreativeIdea(
  idea: DesignIdea,
  handoff: CreativeDirectionHandoff,
): DesignStudioBrief {
  const palette = [
    ...idea.artworkColors,
    ...idea.recommendedGarmentColors,
  ];

  return {
    designId: idea.id,
    title: idea.designTitle,
    role: "hero",
    product: idea.recommendedProductType,
    color: idea.recommendedGarmentColors[0] ?? "Black",
    printArea: idea.placement,
    placement: idea.placement,
    dimensions: "Print area per placement notes",
    visualConcept: idea.designConcept,
    designDescription: [
      CREATIVE_DIRECTION_HANDOFF_MISSION,
      `Spruch: ${idea.primaryPhrase}`,
      idea.meaning,
      idea.designConcept,
      `Status: ${handoff.status}`,
    ].join("\n\n"),
    geometry: "User-supplied artwork — upload placeholder",
    visualElements: idea.graphicElements,
    typography: idea.typographyDirection,
    colorPalette: palette.map((name) => ({
      name,
      usage: "Artwork or garment tone",
      hex: colorHex(name),
    })),
    productionMethod: idea.printTechniqueSuggestion,
    materialEffects: "Per garment selection after artwork upload",
    negativeSpaceRules: "Viel Leerraum beibehalten — keine Überladung",
    designerInstructions: [
      CREATIVE_DIRECTION_HANDOFF_MISSION,
      `Selected idea: ${idea.designTitle}`,
      `Phrase: ${idea.primaryPhrase}`,
      `Concept: ${idea.designConcept}`,
      `Typography: ${idea.typographyDirection}`,
      `Placement: ${idea.placement}`,
      ...handoff.guardrails.map((rule) => `Guardrail: ${rule}`),
      `Verbote: ${handoff.forbiddenElements.join(", ")}`,
      "Keine KI-Designgenerierung — Artwork-Upload abwarten",
    ],
    svgPrompt: "",
    mockupPrompt: "",
    imagePrompt: "",
    printReadinessScore: 0,
    dnaScore: idea.brandFitScore,
    commercialScore: idea.commercialClarityScore,
    campaignPotential: "Awaiting artwork upload",
  };
}

/**
 * Prepares Design Studio for artwork upload — does not trigger generation.
 */
export function activateCreativeHandoffInDesignStudio(
  idea: DesignIdea,
  sourceResearchRunId: string,
): CreativeDirectionHandoff {
  const handoff = saveCreativeDirectionHandoff(idea, sourceResearchRunId);
  const studioBrief = buildDesignStudioBriefFromCreativeIdea(idea, handoff);

  const mission = buildDesignMissionFromHandoff({
    reportId: sourceResearchRunId,
    reportTitle: idea.designTitle,
    collectionName: idea.designTitle,
    intelligenceContext: {
      sourceType: "research-studio-creative",
      sourceReportId: sourceResearchRunId,
      reportTitle: idea.designTitle,
      executiveSummary: idea.designConcept,
      keyFindings: [
        idea.primaryPhrase,
        idea.typographyDirection,
        idea.placement,
        ...handoff.guardrails,
      ],
      recommendations: [
        CREATIVE_DIRECTION_HANDOFF_MISSION,
        `Status: awaiting_artwork_upload`,
        `Phrase: ${idea.primaryPhrase}`,
      ],
      connectedDepartments: ["research", "design"],
      productName: idea.recommendedProductType,
      collectionName: idea.designTitle,
    },
    brief: studioBrief,
    pipelineStage: "awaiting_artwork_upload",
    timelineStage: "design",
    versionLabel: `Creative Direction — ${idea.designTitle} (awaiting artwork upload)`,
    versionType: "draft",
  });

  saveDesignMission(mission);
  return handoff;
}

/** Ensures handoff payload never asks Design Studio to generate designs. */
export function assertNoDesignGenerationMission(missionText: string): boolean {
  const banned = [
    /entwickle ein neues originales design/i,
    /generate (a |an |the )?new (original )?design/i,
    /designgenerierung/i,
  ];
  return !banned.some((pattern) => pattern.test(missionText));
}
