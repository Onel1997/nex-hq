import type { ImageStudioHandoff } from "@/lib/image/image-handoff-store";
import type { DesignConcept } from "@/lib/design/ai-designer/types";

/** Full creative blueprint resolved from Design Studio handoff — display only. */
export interface ImportedCreativeBlueprint {
  designName: string;
  collection: string;
  garment: string;
  colorway: string;
  version: string;
  classification: string;
  creativeDirection: string;
  designStory: string;
  fashionLanguage: string;
  typographyRules: string;
  symbols: string;
  ornaments: string;
  commercialIntent: string;
  imagePrompt: string;
  mockupPrompt: string;
  blueprintReview: string;
  commercialScore: number | null;
  commercialApproved: boolean;
  imported: boolean;
}

function summarizeLanguage(concept: DesignConcept, key: "fashion" | "typography" | "symbol" | "ornament"): string {
  switch (key) {
    case "fashion":
      return [concept.fashionLanguage.mood, concept.fashionLanguage.garmentScale, ...concept.fashionLanguage.principles.slice(0, 2)]
        .filter(Boolean)
        .join(" · ") || "—";
    case "typography":
      return [concept.typographyLanguage.direction, concept.typographyLanguage.headlineTreatment]
        .filter(Boolean)
        .join(" · ") || "—";
    case "symbol":
      return concept.symbolLanguage.primarySymbols.slice(0, 2).join(" · ") || concept.symbolLanguage.system || "—";
    case "ornament":
      return [concept.ornamentLanguage.system, concept.ornamentLanguage.density].filter(Boolean).join(" · ") || "—";
  }
}

function resolveClassification(concept: DesignConcept): string {
  const role = concept.commercialIntention.role?.trim();
  if (role) {
    if (/hero|statement|flagship/i.test(role)) return "Hero Piece";
    if (/essential|core/i.test(role)) return "Core Essential";
    return role;
  }
  return "Statement Piece";
}

function resolveReviewSummary(handoff: ImageStudioHandoff): string {
  const review = handoff.review;
  if (!review) return handoff.commercialApproved ? "Commercial approved" : "Pending commercial review";
  if (review.passed) {
    const strength = review.strengths[0];
    return strength ? `Passed · ${strength}` : `Passed · Score ${review.score}%`;
  }
  const gap = review.gaps[0];
  return gap ? `Revision requested · ${gap}` : `Score ${review.score}% · Needs refinement`;
}

export function resolveImportedBlueprint(
  handoff: ImageStudioHandoff | null,
  projectName?: string,
): ImportedCreativeBlueprint | null {
  if (!handoff) return null;

  const concept = handoff.concept;
  const mission = handoff.mission;
  const imported = Boolean(
    mission ||
      concept ||
      handoff.imagePromptPrimary ||
      handoff.commercialBlueprint ||
      handoff.brief?.trim(),
  );

  if (!imported) return null;

  return {
    designName:
      concept?.title ?? mission?.title ?? handoff.sourceTitle ?? projectName ?? "Design Mission",
    collection: concept?.collection ?? mission?.collection ?? "—",
    garment: concept?.product ?? mission?.garment ?? "—",
    colorway: concept?.color ?? mission?.colorway ?? "—",
    version: mission?.version ?? "V1",
    classification: concept ? resolveClassification(concept) : "—",
    creativeDirection: concept?.creativeDirection?.summary ?? handoff.commercialBlueprint?.slice(0, 200) ?? "—",
    designStory: concept?.designStory ?? "—",
    fashionLanguage: concept ? summarizeLanguage(concept, "fashion") : "—",
    typographyRules: concept ? summarizeLanguage(concept, "typography") : "—",
    symbols: concept ? summarizeLanguage(concept, "symbol") : "—",
    ornaments: concept ? summarizeLanguage(concept, "ornament") : "—",
    commercialIntent: concept
      ? [concept.commercialIntention.role, concept.commercialIntention.buyerHook].filter(Boolean).join(" · ")
      : "—",
    imagePrompt: handoff.imagePromptPrimary ?? handoff.brief ?? "—",
    mockupPrompt: handoff.mockupPromptPrimary ?? "—",
    blueprintReview: resolveReviewSummary(handoff),
    commercialScore: handoff.commercialScore ?? null,
    commercialApproved: Boolean(handoff.commercialApproved),
    imported: true,
  };
}

export function resolveCommercialStatus(blueprint: ImportedCreativeBlueprint | null): string {
  if (!blueprint) return "—";
  if (blueprint.commercialApproved) return "Approved";
  if (blueprint.commercialScore != null) return `Scored ${blueprint.commercialScore}%`;
  return "Pending";
}

export function resolveGenerationStatus(input: {
  isLoading: boolean;
  hasResults: boolean;
  hasBlueprint: boolean;
  pipelineActive?: boolean;
  allAssetsComplete?: boolean;
  preparingAssetId?: string | null;
  generatingAssetId?: string | null;
}): string {
  if (input.generatingAssetId || input.pipelineActive || input.isLoading) return "In Production";
  if (input.preparingAssetId) return "Preparing";
  if (input.allAssetsComplete) return "Production Complete";
  if (input.hasResults) return "Assets Staged";
  if (input.hasBlueprint) return "Ready to Generate";
  return "Standby";
}
