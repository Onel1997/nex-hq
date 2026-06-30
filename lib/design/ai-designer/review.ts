import type { DesignConcept, DesignConceptReview } from "@/lib/design/ai-designer/types";

const REQUIRED_STRING_FIELDS: (keyof DesignConcept)[] = [
  "title",
  "collection",
  "designStory",
];

function isNonEmpty(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length >= 10;
}

/** Self-review blueprint completeness before Image Studio handoff. */
export function reviewDesignConcept(concept: DesignConcept): DesignConceptReview {
  const strengths: string[] = [];
  const gaps: string[] = [];
  let score = 50;

  for (const field of REQUIRED_STRING_FIELDS) {
    const value = concept[field];
    if (typeof value === "string" && isNonEmpty(value)) {
      score += 6;
    } else {
      gaps.push(`missing or thin ${field}`);
    }
  }

  if (isNonEmpty(concept.imagePrompt.primary)) {
    score += 12;
    strengths.push("premium image prompt ready for Image Studio");
  } else {
    gaps.push("image prompt not generated");
  }

  if (isNonEmpty(concept.mockupPrompt.primary)) {
    score += 10;
    strengths.push("mockup prompt ready for product visualization");
  } else {
    gaps.push("mockup prompt not generated");
  }

  if (concept.typographyLanguage.concepts.length >= 2) {
    score += 8;
    strengths.push("typography language defined with editorial concepts");
  }

  if (concept.heroFocus.scrollStopHook.length >= 20) {
    score += 8;
    strengths.push("hero focus includes scroll-stop hook");
  } else {
    gaps.push("hero focus / scroll-stop hook underdeveloped");
  }

  if (concept.fashionLanguage.principles.length >= 3) {
    score += 6;
    strengths.push("fashion principles anchored to design knowledge");
  }

  if (concept.compositionLanguage.focalStrategy.includes("dominant")) {
    score += 6;
    strengths.push("single dominant focal strategy");
  }

  if (concept.productionNotes.qualityGates.length >= 2) {
    score += 4;
  }

  if (concept.confidence >= 72) {
    score += 6;
    strengths.push(`high synthesis confidence (${concept.confidence})`);
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  const passed = score >= 75 && gaps.length <= 2;
  const readyForImageStudio =
    passed && isNonEmpty(concept.imagePrompt.primary) && isNonEmpty(concept.mockupPrompt.primary);
  const readyForCommercialReview =
    readyForImageStudio && concept.commercialIntention.wouldBuySignals.length >= 3;

  return {
    passed,
    score,
    strengths,
    gaps,
    readyForImageStudio,
    readyForCommercialReview,
  };
}
