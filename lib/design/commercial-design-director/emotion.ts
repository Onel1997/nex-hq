import type { DesignStudioBrief } from "@/agents/design/studio-brief";
import type { LibraryArtworkSpec } from "@/lib/design/design-library/types";
import type { CommercialScoreBreakdown } from "@/lib/design/commercial-design-director/commercial-score";
import type { BuyerPsychologyProfile } from "@/lib/design/commercial-design-director/buyer-psychology";
import { evaluateEmotionCompositionMatch } from "@/lib/design/design-knowledge/emotional-language";

export interface EmotionalAssessment {
  score: number;
  mood: string;
  tension: number;
  intimacy: number;
  confidence: number;
  compositionMatch: number;
  emotionAligned: boolean;
  notes: string[];
}

const MOOD_KEYWORDS: Array<{ mood: string; patterns: string[] }> = [
  { mood: "reflection", patterns: ["reflect", "quiet", "between", "silence", "wound"] },
  { mood: "confidence", patterns: ["power", "only", "bold", "statement", "dominant"] },
  { mood: "intimacy", patterns: ["between", "us", "private", "inner", "close"] },
  { mood: "urban", patterns: ["city", "street", "concrete", "night", "metro"] },
  { mood: "faith", patterns: ["faith", "sacred", "spirit", "halo", "cross"] },
  { mood: "luxury", patterns: ["luxury", "premium", "calm", "editorial", "museum"] },
];

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function detectMood(text: string): string {
  const lower = text.toLowerCase();
  let best = { mood: "editorial", hits: 0 };
  for (const entry of MOOD_KEYWORDS) {
    const hits = entry.patterns.filter((p) => lower.includes(p)).length;
    if (hits > best.hits) best = { mood: entry.mood, hits };
  }
  return best.mood;
}

/** Emotional value — would someone feel something wearing this? */
export function evaluateEmotionalImpact(
  brief: DesignStudioBrief,
  spec: LibraryArtworkSpec,
  commercialScore: CommercialScoreBreakdown,
  psychology: BuyerPsychologyProfile,
): EmotionalAssessment {
  const notes: string[] = [];
  const corpus = `${brief.title} ${brief.visualConcept} ${brief.designDescription}`;
  const mood = spec.emotionalDirection?.primary ?? detectMood(corpus);
  const compositionMatch = evaluateEmotionCompositionMatch(spec);

  let score = commercialScore.emotionalImpact * 0.5 + psychology.emotion * 0.35 + compositionMatch.score * 0.15;

  const titleWords = brief.title.split(/\s+/).filter(Boolean);
  const intimacy =
    titleWords.length >= 2 && titleWords.length <= 4
      ? clamp(68 + titleWords.length * 6)
      : 58;
  const confidence = brief.role.toLowerCase().includes("hero")
    ? clamp(72 + commercialScore.premiumFeeling * 0.2)
    : clamp(60 + commercialScore.streetwearAppeal * 0.15);
  const tension = clamp(
    commercialScore.compositionQuality * 0.4 +
      commercialScore.typographyQuality * 0.35 +
      (spec.symbols.length >= 2 ? 10 : 0),
  );

  if (psychology.emotion >= 78) notes.push("emotional hook is strong enough to justify premium price");
  else notes.push("emotional value is underdeveloped for €44.90–64.90 positioning");

  if (mood === "reflection" || mood === "intimacy") {
    score += 8;
    notes.push(`"${mood}" mood aligns with Milaene storytelling`);
  }

  if (brief.title.length <= 3) {
    notes.push("very short title may lack emotional narrative depth");
    score -= 6;
  }

  if (compositionMatch.aligned) {
    score += 6;
    notes.push(`composition expresses ${mood} emotional narrative`);
  } else if (compositionMatch.mismatches.length > 0) {
    notes.push(`emotion mismatch: ${compositionMatch.mismatches[0]}`);
    score -= 4;
  }

  if (spec.emotionalDirection && spec.emotionalDirection.confidence >= 70) {
    score += 4;
    notes.push(
      `${spec.emotionalDirection.primary} + ${spec.emotionalDirection.secondary} story direction locked`,
    );
  }

  return {
    score: clamp(score),
    mood,
    tension,
    intimacy,
    confidence,
    compositionMatch: compositionMatch.score,
    emotionAligned: compositionMatch.aligned,
    notes,
  };
}
