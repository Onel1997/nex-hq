import type { DesignStudioBrief, IntelligenceHandoffContext } from "@/agents/design/studio-brief";
import type { DesignConcept } from "@/lib/design/ai-designer/types";
import type { FashionDesignEngineInput } from "./types";

export interface ResearchHandoffContext {
  reportTitle?: string;
  executiveSummary?: string;
  keyFindings: string[];
  recommendations: string[];
  collectionName?: string;
  emotionalThemes: string[];
  productName: string;
}

/** Normalize research intelligence into engine-ready context. */
export function buildResearchHandoffContext(
  input: FashionDesignEngineInput,
): ResearchHandoffContext {
  const { brief, concept, intelligenceContext } = input;

  const emotionalThemes = extractEmotionalThemes(brief, concept, intelligenceContext);

  return {
    reportTitle: intelligenceContext?.reportTitle,
    executiveSummary: intelligenceContext?.executiveSummary,
    keyFindings: intelligenceContext?.keyFindings ?? [],
    recommendations: intelligenceContext?.recommendations ?? [],
    collectionName: intelligenceContext?.collectionName ?? concept.collection,
    emotionalThemes,
    productName: intelligenceContext?.productName ?? brief.product,
  };
}

function extractEmotionalThemes(
  brief: DesignStudioBrief,
  concept: DesignConcept,
  intelligence?: IntelligenceHandoffContext,
): string[] {
  const themes = new Set<string>();

  themes.add(concept.creativeDirection.emotion);
  themes.add(concept.creativeDirection.mood);

  for (const finding of intelligence?.keyFindings ?? []) {
    const lower = finding.toLowerCase();
    if (lower.includes("trust") || lower.includes("loyalty")) themes.add("silent loyalty");
    if (lower.includes("peace") || lower.includes("calm") || lower.includes("chaos")) {
      themes.add("inner peace vs outside chaos");
    }
    if (lower.includes("growth") || lower.includes("pain")) themes.add("pain into growth");
    if (lower.includes("alone") || lower.includes("stronger")) themes.add("alone but stronger");
    if (lower.includes("outsider") || lower.includes("trust")) themes.add("trust and boundaries");
  }

  const corpus = `${brief.visualConcept} ${brief.designDescription}`.toLowerCase();
  if (corpus.includes("perimeter") || corpus.includes("boundary")) themes.add("trust boundaries");
  if (corpus.includes("spine") || corpus.includes("vertical")) themes.add("vertical strength");
  if (corpus.includes("negative space") || corpus.includes("restraint")) themes.add("editorial restraint");

  return [...themes].filter(Boolean);
}
