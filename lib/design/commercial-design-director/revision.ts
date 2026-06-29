import type { DesignStudioBrief } from "@/agents/design/studio-brief";
import type { CompositionOverrides } from "@/lib/design/design-library/types";
import type { DesignCritique } from "@/lib/design/commercial-design-director/critique";
import type { CommercialScoreBreakdown } from "@/lib/design/commercial-design-director/commercial-score";
import type { CommercialScoreDimension } from "@/lib/design/commercial-design-director/commercial-score";
import type { LibraryArtworkSpec } from "@/lib/design/design-library/types";
import {
  emotionRevisionOverrides,
  evaluateEmotionCompositionMatch,
} from "@/lib/design/design-knowledge/emotional-language";

export const MAX_COMMERCIAL_REVISION_ITERATIONS = 5;

export type RevisionTarget =
  | "design-studio"
  | "premium-template-engine"
  | "image-studio"
  | "typography"
  | "composition"
  | "brand-dna";

export interface RevisionTask {
  id: string;
  target: RevisionTarget;
  priority: "critical" | "high" | "medium";
  dimension: CommercialScoreDimension | "buyer-psychology" | "brand-dna";
  issue: string;
  action: string;
  overrides?: CompositionOverrides;
}

const REVISION_CHAINS: CompositionOverrides[] = [
  { templateId: "editorial-poster", layoutId: "oversized-front", forceRich: true, variantIndex: 1 },
  { templateId: "oversized-graphic", layoutId: "oversized-front", forceRich: true, variantIndex: 2 },
  { templateId: "faith-collection", layoutId: "symbol-above-type", forceRich: true, variantIndex: 3 },
  { templateId: "gallery-composition", layoutId: "gallery-layout", styleId: "editorial-fashion", forceRich: true, variantIndex: 4 },
  { templateId: "monochrome-symbol", layoutId: "gallery-layout", styleId: "architectural", forceRich: true, variantIndex: 5 },
];

function taskId(iteration: number, index: number): string {
  return `commercial-revision-${iteration}-${index}`;
}

/** Generate specific improvement tasks from critique — not vague feedback. */
export function buildRevisionTasks(
  critique: DesignCritique,
  score: CommercialScoreBreakdown,
  iteration: number,
  spec?: LibraryArtworkSpec,
): RevisionTask[] {
  const tasks: RevisionTask[] = [];
  let index = 0;

  const push = (
    target: RevisionTarget,
    priority: RevisionTask["priority"],
    dimension: RevisionTask["dimension"],
    issue: string,
    action: string,
    overrides?: CompositionOverrides,
  ) => {
    tasks.push({
      id: taskId(iteration, index++),
      target,
      priority,
      dimension,
      issue,
      action,
      overrides,
    });
  };

  if (score.typographyQuality < 85) {
    push(
      "typography",
      "critical",
      "typographyQuality",
      critique.weaknesses.find((w) => w.includes("typography")) ?? "typography too weak",
      "Rebuild hero typography as layered fashion artwork — dominant, ghost, micro, cropped, offset layers",
      REVISION_CHAINS[iteration % REVISION_CHAINS.length],
    );
  }

  if (score.compositionQuality < 80) {
    push(
      "composition",
      "high",
      "compositionQuality",
      "composition too static",
      "Increase editorial tension — asymmetric layout, type-frame overlap, stronger focal hierarchy",
      REVISION_CHAINS[(iteration + 1) % REVISION_CHAINS.length],
    );
  }

  if (score.luxury < 78 || score.premiumFeeling < 78) {
    push(
      "premium-template-engine",
      "high",
      "premiumFeeling",
      "luxury feeling missing",
      "Add breathing room, reduce geometry density, elevate negative space and material restraint",
      { templateId: "editorial-poster", layoutId: "oversized-front", forceRich: true, variantIndex: iteration + 10 },
    );
  }

  if (!critique.wouldStopScrolling) {
    push(
      "design-studio",
      "high",
      "shareability",
      "would not stop scrolling",
      "Strengthen visual hook — oversized type, asymmetric crop, or frame-breaking composition",
      REVISION_CHAINS[(iteration + 2) % REVISION_CHAINS.length],
    );
  }

  if (score.streetwearAppeal < 78) {
    push(
      "premium-template-engine",
      "high",
      "streetwearAppeal",
      "does not read as premium streetwear",
      "Shift to oversized garment-scale editorial graphic — avoid logo-mark templates",
      { templateId: "oversized-graphic", layoutId: "oversized-front", forceRich: true, variantIndex: iteration + 20 },
    );
  }

  if (score.emotionalImpact < 75) {
    push(
      "design-studio",
      "medium",
      "emotionalImpact",
      "not enough emotional value",
      "Deepen concept narrative in visualConcept and designDescription for wear-story",
    );
  }

  if (spec?.emotionalDirection) {
    const match = evaluateEmotionCompositionMatch(spec);
    if (!match.aligned) {
      const overrides = emotionRevisionOverrides(spec.emotionalDirection);
      push(
        "composition",
        "high",
        "emotionalImpact",
        `emotion ${spec.emotionalDirection.primary} not expressed in composition`,
        `Re-compose for ${spec.emotionalDirection.primary}/${spec.emotionalDirection.secondary} — ${match.mismatches[0] ?? "align template, symbols, and typography to story"}`,
        {
          ...overrides,
          forceRich: true,
          variantIndex: iteration + 40,
        },
      );
    }
  }

  if (score.collectionConsistency < 75) {
    push(
      "brand-dna",
      "medium",
      "collectionConsistency",
      "weak collection fit",
      "Align palette, mood, and scale with Milaene drop narrative and role hierarchy",
    );
  }

  if (score.wearability < 80) {
    push(
      "premium-template-engine",
      "critical",
      "wearability",
      "wearability below premium bar",
      "Reduce poster-scale density — optimize for oversized tee chest at garment scale",
      { templateId: "editorial-poster", layoutId: "oversized-front", forceRich: true, variantIndex: iteration + 30 },
    );
  }

  if (!critique.feelsOriginal) {
    push(
      "composition",
      "medium",
      "originality",
      "lacks originality",
      "Avoid primitive circle+text or logo-mark patterns — push editorial composition",
      REVISION_CHAINS[(iteration + 3) % REVISION_CHAINS.length],
    );
  }

  if (tasks.length === 0 && !critique.approved) {
    push(
      "premium-template-engine",
      "high",
      "commercialPotential",
      `commercial score ${score.overall} below 90`,
      "Re-compose with richer editorial template and stronger type hierarchy",
      REVISION_CHAINS[iteration % REVISION_CHAINS.length],
    );
  }

  return tasks;
}

export function selectRevisionOverrides(
  tasks: RevisionTask[],
  iteration: number,
): CompositionOverrides {
  const withOverrides = tasks.find((t) => t.overrides);
  if (withOverrides?.overrides) return withOverrides.overrides;
  return REVISION_CHAINS[iteration % REVISION_CHAINS.length]!;
}

/** Apply revision guidance back into the brief for next iteration. */
export function applyRevisionTasks(
  brief: DesignStudioBrief,
  tasks: RevisionTask[],
): DesignStudioBrief {
  const instructions = tasks.map((t) => `[${t.priority.toUpperCase()}] ${t.action}`);
  const existing = brief.designerInstructions ?? [];

  const visualConceptAdditions: string[] = [];
  if (tasks.some((t) => t.dimension === "typographyQuality")) {
    visualConceptAdditions.push("layered editorial typography as primary artwork system");
  }
  if (tasks.some((t) => t.dimension === "compositionQuality")) {
    visualConceptAdditions.push("asymmetric composition with type-frame interaction");
  }
  if (tasks.some((t) => t.dimension === "premiumFeeling")) {
    visualConceptAdditions.push("calm luxury negative space with premium restraint");
  }
  if (tasks.some((t) => t.dimension === "emotionalImpact")) {
    visualConceptAdditions.push("wearable emotional storytelling through symbol and typography language");
  }

  const visualConcept =
    visualConceptAdditions.length > 0
      ? `${brief.visualConcept}. ${visualConceptAdditions.join(". ")}.`
      : brief.visualConcept;

  return {
    ...brief,
    visualConcept,
    designerInstructions: [...existing, ...instructions].slice(-12),
    printReadinessScore: Math.min(100, brief.printReadinessScore + 2),
  };
}

export function buildImageStudioRevisionBrief(
  brief: DesignStudioBrief,
  critique: DesignCritique,
  tasks: RevisionTask[],
): string {
  const lines = [
    `DESIGN: ${brief.title}`,
    `PRODUCT: ${brief.product} · ${brief.color}`,
    `ROLE: ${brief.role}`,
    "",
    "COMMERCIAL DIRECTOR BRIEF — premium apparel visualization required.",
    `Score: ${critique.overallScore}/100 · Approved: ${critique.approved ? "yes" : "no"}`,
    "",
    "STRENGTHS:",
    ...critique.strengths.map((s) => `• ${s}`),
    "",
    "IMPROVE:",
    ...critique.weaknesses.slice(0, 6).map((w) => `• ${w}`),
    "",
    "IMAGE STUDIO TASKS:",
    ...tasks
      .filter((t) => t.target === "image-studio" || t.target === "design-studio")
      .map((t) => `• ${t.action}`),
    "",
    brief.imagePrompt,
  ];
  return lines.join("\n");
}
