import type { DesignStudioBrief } from "@/agents/design/studio-brief";
import type { DesignConcept } from "@/lib/design/ai-designer/types";
import { buildBrandDnaProfile } from "@/lib/design/ai-designer/brand-dna";
import {
  decideFromKnowledge,
  queryFromBrief,
} from "@/lib/design/design-knowledge/art-direction/creative-director";
import { hashString } from "@/lib/design/vector-engine/hash";
import type { CreativeDesignBrief } from "../types";
import type { ResearchHandoffContext } from "../research-handoff";

const FORBIDDEN_CLICHES = [
  "skull graphics",
  "wolf imagery",
  "lion imagery",
  "angel wings",
  "generic hustle slogans",
  "Supreme-style box logos",
  "neon color bursts",
  "anime graphics",
];

export interface CreativeDirectorAgentInput {
  brief: DesignStudioBrief;
  concept: DesignConcept;
  designDirection?: string;
  research: ResearchHandoffContext;
}

/**
 * Creative Director Agent — emotional core, story, philosophy, originality, brand DNA.
 * Internal agent — not a separate UI page.
 */
export function runCreativeDirectorAgent(
  input: CreativeDirectorAgentInput,
): CreativeDesignBrief {
  const { brief, concept, designDirection, research } = input;
  const seed = hashString(brief.designId) % 10000;
  const creativeDirector = decideFromKnowledge(queryFromBrief(brief, seed));
  const brandDna = buildBrandDnaProfile(brief, creativeDirector);

  const direction =
    designDirection?.trim() ||
    concept.creativeDirection.summary ||
    brief.visualConcept;

  const emotionalCore = resolveEmotionalCore(concept, research);
  const story = buildStory(brief, concept, research, direction);
  const designPhilosophy = buildPhilosophy(concept, brandDna);
  const originalityAnalysis = analyzeOriginality(brief, concept, direction);
  const brandDnaValidation = validateBrandDna(brief, brandDna, concept);

  return {
    emotionalCore,
    story,
    designPhilosophy,
    originalityAnalysis,
    brandDnaValidation,
    moodKeywords: [
      concept.creativeDirection.mood,
      concept.fashionLanguage.mood,
      ...research.emotionalThemes.slice(0, 3),
    ].filter(Boolean),
    antiPatterns: [
      ...FORBIDDEN_CLICHES,
      ...concept.fashionLanguage.antiPatterns.slice(0, 4),
    ],
    collectionRole: brief.role || concept.creativeDirection.collectionRole,
    targetEmotion: concept.creativeDirection.emotion,
  };
}

function resolveEmotionalCore(
  concept: DesignConcept,
  research: ResearchHandoffContext,
): string {
  const themes = research.emotionalThemes.slice(0, 2).join(" and ");
  if (themes) {
    return `${concept.creativeDirection.emotion} — expressed through ${themes} without figurative clichés`;
  }
  return `${concept.creativeDirection.emotion} — ${concept.creativeDirection.visualIntent}`;
}

function buildStory(
  brief: DesignStudioBrief,
  concept: DesignConcept,
  research: ResearchHandoffContext,
  direction: string,
): string {
  const collection = research.collectionName ?? concept.collection;
  return [
    `${collection} tells a chapter of ${concept.creativeDirection.emotion.toLowerCase()}.`,
    direction,
    brief.designDescription,
    `Designed for ${brief.product} in ${brief.color} — a garment-scale statement, not a logo mark.`,
  ]
    .filter(Boolean)
    .join(" ");
}

function buildPhilosophy(
  concept: DesignConcept,
  brandDna: ReturnType<typeof buildBrandDnaProfile>,
): string {
  return [
    "Meaning over hype — calm luxury streetwear for urban creatives.",
    concept.fashionLanguage.principles.slice(0, 2).join(". "),
    brandDna.philosophy.slice(0, 2).join(". "),
    "Editorial restraint with layered symbolic meaning.",
  ]
    .filter(Boolean)
    .join(" ");
}

function analyzeOriginality(
  brief: DesignStudioBrief,
  concept: DesignConcept,
  direction: string,
): CreativeDesignBrief["originalityAnalysis"] {
  const corpus = `${brief.title} ${direction} ${brief.geometry}`.toLowerCase();
  let score = 62;

  const uniqueElements: string[] = [];
  const competitorRisks: string[] = [];

  if (corpus.includes("spine") || corpus.includes("vertical")) {
    score += 10;
    uniqueElements.push("spine-back editorial placement differentiation");
  }
  if (corpus.includes("perimeter") || corpus.includes("boundary") || corpus.includes("loop")) {
    score += 8;
    uniqueElements.push("boundary symbolism without figurative trust imagery");
  }
  if (concept.typographyLanguage.behaviors.some((b) => b.includes("track"))) {
    score += 6;
    uniqueElements.push("extreme editorial tracking — anti-hype typography");
  }
  if (concept.symbolLanguage.restraint.includes("minimal")) {
    score += 5;
    uniqueElements.push("symbolic restraint vs competitor graphic noise");
  }

  if (corpus.includes("skull") || corpus.includes("wolf") || corpus.includes("lion")) {
    score -= 25;
    competitorRisks.push("figurative animal/skull territory — oversaturated");
  }
  if (direction.toLowerCase().includes("supreme") || direction.toLowerCase().includes("bape")) {
    score -= 20;
    competitorRisks.push("borrowed hype-brand aesthetic");
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    uniqueElements: uniqueElements.length > 0 ? uniqueElements : ["editorial minimal streetwear direction"],
    competitorRisks,
    differentiation:
      "Milaene-specific calm luxury with garment-scale artwork and negative space dominance — not merch-label graphics.",
  };
}

function validateBrandDna(
  brief: DesignStudioBrief,
  brandDna: ReturnType<typeof buildBrandDnaProfile>,
  concept: DesignConcept,
): CreativeDesignBrief["brandDnaValidation"] {
  const matches: string[] = [...brandDna.signatureElements.slice(0, 3)];
  const conflicts: string[] = [];

  const corpus = `${brief.visualConcept} ${brief.designDescription}`.toLowerCase();

  for (const forbidden of brandDna.forbiddenPatterns) {
    const key = forbidden.split(" ")[0]!.toLowerCase();
    if (corpus.includes(key)) conflicts.push(forbidden);
  }

  if (brief.dnaScore !== undefined && brief.dnaScore >= 70) {
    matches.push(`research DNA score ${brief.dnaScore}%`);
  }
  if (concept.negativeSpaceProfile.targetRatio.includes("60") || concept.negativeSpaceProfile.targetRatio.includes("70")) {
    matches.push("negative space dominance");
  }

  const score = Math.round(
    (brandDna.score + (brief.dnaScore ?? 70) + (conflicts.length === 0 ? 15 : 0)) / 2.2,
  );

  return {
    score: Math.max(0, Math.min(100, score)),
    matches,
    conflicts,
    passed: score >= 65 && conflicts.length === 0,
  };
}
