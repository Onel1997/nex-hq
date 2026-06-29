import type { DesignStudioBrief } from "@/agents/design/studio-brief";
import type {
  EmotionalDirectorDecision,
  EmotionalLanguageId,
} from "@/lib/design/design-knowledge/emotional-language/types";
import {
  EMOTIONAL_LANGUAGES,
  getEmotionalLanguage,
} from "@/lib/design/design-knowledge/emotional-language/emotion-library";
import { translateEmotions } from "@/lib/design/design-knowledge/emotional-language/emotion-translation";
import { hashString } from "@/lib/design/vector-engine/hash";

interface ScoredEmotion {
  id: EmotionalLanguageId;
  score: number;
  hits: string[];
}

function briefCorpus(brief: DesignStudioBrief): string {
  return [
    brief.title,
    brief.visualConcept,
    brief.designDescription,
    brief.typography,
    brief.geometry,
    brief.role,
    brief.placement,
    ...(brief.designerInstructions ?? []),
    ...brief.visualElements,
  ]
    .join(" ")
    .toLowerCase();
}

function scoreEmotion(text: string, seed: number): ScoredEmotion[] {
  return EMOTIONAL_LANGUAGES.map((emotion) => {
    let score = 0;
    const hits: string[] = [];

    for (const keyword of emotion.keywords) {
      if (text.includes(keyword)) {
        score += keyword.length >= 6 ? 3 : 2;
        hits.push(keyword);
      }
    }

    for (const tag of emotion.mood.split(/[,\s]+/)) {
      if (tag.length >= 5 && text.includes(tag)) {
        score += 1;
        hits.push(tag);
      }
    }

    // Phrase-level story hooks (outrank isolated keywords)
    if (text.includes("between us") || text.includes("only between")) {
      if (emotion.id === "connection") score += 18;
      if (emotion.id === "reflection") score += 10;
      if (emotion.id === "silence") score += 6;
      if (emotion.id === "strength" && text.includes("only between")) score -= 8;
      hits.push("between-us-phrase");
    }
    if (emotion.id === "silence" && text.includes("silent axis")) {
      score += 10;
      hits.push("silent-axis");
    }
    if (emotion.id === "reflection" && text.includes("quiet daily")) {
      score += 8;
      hits.push("quiet-daily");
    }
    if (emotion.id === "connection" && text.includes("intimate")) {
      score += 8;
      hits.push("intimate");
    }

    // Title-specific emotional hooks (legacy single-token)
    if (emotion.id === "connection" && text.includes("between us")) {
      score += 4;
      hits.push("between-us");
    }

    // Deterministic tie-breaker from seed
    score += (hashString(`${emotion.id}:${seed}`) % 7) * 0.01;

    return { id: emotion.id, score, hits };
  }).sort((a, b) => b.score - a.score);
}

function buildReason(primary: ScoredEmotion, secondary: ScoredEmotion, corpus: string): string {
  const primaryLang = getEmotionalLanguage(primary.id);
  const secondaryLang = getEmotionalLanguage(secondary.id);
  const titleHook = corpus.split(/\s+/).slice(0, 4).join(" ");
  const hitSummary =
    primary.hits.length > 0
      ? `signals: ${primary.hits.slice(0, 3).join(", ")}`
      : "structural mood inference from role and placement";

  return (
    `"${titleHook}" reads as ${primaryLang?.name ?? primary.id} with ${secondaryLang?.name ?? secondary.id} undertone — ${hitSummary}`
  );
}

function confidenceFromScores(primary: ScoredEmotion, secondary: ScoredEmotion): number {
  if (primary.score <= 0) return 42;
  const gap = primary.score - secondary.score;
  const base = Math.min(96, 48 + primary.score * 4 + gap * 3);
  return Math.round(Math.max(35, Math.min(98, base)));
}

/**
 * Creative Director emotional pass — deterministic primary/secondary emotion from brief story.
 */
export function decideEmotionalDirection(
  brief: DesignStudioBrief,
  seed: number,
): EmotionalDirectorDecision {
  const corpus = briefCorpus(brief);
  const scored = scoreEmotion(corpus, seed);
  const primary = scored[0] ?? { id: "reflection" as EmotionalLanguageId, score: 0, hits: [] };
  const secondary =
    scored.find((e) => e.id !== primary.id) ??
    ({ id: "silence" as EmotionalLanguageId, score: 0, hits: [] } as ScoredEmotion);

  const confidence = confidenceFromScores(primary, secondary);
  const translation = translateEmotions(primary.id, secondary.id);

  const decision: EmotionalDirectorDecision = {
    primary: primary.id,
    secondary: secondary.id,
    confidence,
    reason: buildReason(primary, secondary, corpus),
    translation,
  };

  console.log(
    `[EMOTIONAL DIRECTOR] ${decision.primary} + ${decision.secondary} (confidence ${decision.confidence}) — ${decision.reason}`,
  );

  return decision;
}

export function selectEmotionsFromBrief(
  brief: DesignStudioBrief,
  seed: number,
): Pick<EmotionalDirectorDecision, "primary" | "secondary"> {
  const { primary, secondary } = decideEmotionalDirection(brief, seed);
  return { primary, secondary };
}
