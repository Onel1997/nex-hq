import type { DesignStudioBrief } from "@/agents/design/studio-brief";
import { hashString, pick } from "@/lib/design/vector-engine/hash";
import type { DesignStyleDefinition, DesignStyleId } from "@/lib/design/design-library/types";
import type { EmotionalCompositionWeights } from "@/lib/design/design-knowledge/emotional-language";
import { applyEmotionStyleScore } from "@/lib/design/design-knowledge/emotional-language";
import { ALL_STYLE_IDS, getStyle } from "@/lib/design/design-library/styles/registry";

function briefText(brief: DesignStudioBrief): string {
  return [
    brief.visualConcept,
    brief.designDescription,
    brief.typography,
    brief.geometry,
    brief.role,
    brief.materialEffects,
    brief.placement,
  ]
    .join(" ")
    .toLowerCase();
}

const STYLE_KEYWORDS: Record<DesignStyleId, string[]> = {
  "minimal-luxury": ["minimal", "luxury", "premium", "clean", "refined"],
  "silent-luxury": ["silent", "quiet", "subtle", "whisper", "understated"],
  "editorial-fashion": ["editorial", "fashion", "runway", "magazine", "poster"],
  architectural: ["architect", "structural", "frame", "grid", "blueprint"],
  faith: ["faith", "spiritual", "sacred", "devotional"],
  "vintage-washed": ["vintage", "washed", "distressed", "archive", "faded"],
  "modern-gothic": ["gothic", "dark", "noir", "dramatic"],
  "japanese-minimal": ["japanese", "wabi", "zen", "ma ", "negative space"],
  "technical-streetwear": ["technical", "utility", "schematic", "streetwear", "workwear"],
  "swiss-typography": ["swiss", "helvetica", "grid type", "international"],
  "scandinavian-minimal": ["scandinavian", "nordic", "hygge", "calm"],
  "monochrome-luxury": ["monochrome", "single color", "tone on tone", "black on black"],
};

export function detectStyleFromBrief(
  brief: DesignStudioBrief,
  seed: number,
  emotionWeights?: EmotionalCompositionWeights,
): DesignStyleId {
  const text = briefText(brief);
  let best: DesignStyleId = "minimal-luxury";
  let bestScore = -1;

  for (const id of ALL_STYLE_IDS) {
    const keywords = STYLE_KEYWORDS[id];
    let score = keywords.reduce((sum, kw) => sum + (text.includes(kw) ? 1 : 0), 0);
    if (emotionWeights) {
      score = applyEmotionStyleScore(score, id, emotionWeights);
    }
    if (score > bestScore) {
      bestScore = score;
      best = id;
    }
  }

  if (bestScore === 0) {
    const fallbacks: DesignStyleId[] = [
      "minimal-luxury",
      "silent-luxury",
      "editorial-fashion",
      "architectural",
      "monochrome-luxury",
    ];
    return pick(seed, 0, fallbacks);
  }

  return best;
}

export function selectStyle(
  brief: DesignStudioBrief,
  emotionWeights?: EmotionalCompositionWeights,
): DesignStyleDefinition {
  const seed = hashString([brief.designId, brief.geometry, brief.placement].join("|"));
  const styleId = detectStyleFromBrief(brief, seed, emotionWeights);
  return getStyle(styleId);
}
