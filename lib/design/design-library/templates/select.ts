import type { DesignStudioBrief } from "@/agents/design/studio-brief";
import type {
  DesignStyleDefinition,
  LayoutDefinition,
  TemplateDefinition,
  TemplateId,
} from "@/lib/design/design-library/types";
import type { EmotionalCompositionWeights } from "@/lib/design/design-knowledge/emotional-language";
import { applyEmotionTemplateScore } from "@/lib/design/design-knowledge/emotional-language";
import type { WearabilityCompositionWeights } from "@/lib/design/design-knowledge/wearability";
import { applyWearabilityTemplateScore } from "@/lib/design/design-knowledge/wearability";
import { ALL_TEMPLATE_IDS, getTemplate, TEMPLATE_REGISTRY } from "@/lib/design/design-library/templates/registry";
import { hashString } from "@/lib/design/vector-engine/hash";

function scoreTemplate(
  template: TemplateDefinition,
  brief: DesignStudioBrief,
  style: DesignStyleDefinition,
  layout: LayoutDefinition,
): number {
  let score = 0;
  if (template.styleId === style.id) score += 3;
  if (template.layoutId === layout.id) score += 3;
  if (template.hierarchy === style.hierarchy) score += 1;

  const text = `${brief.visualConcept} ${brief.role} ${brief.geometry}`.toLowerCase();
  const keywords: Record<TemplateId, string[]> = {
    "luxury-wordmark": ["wordmark", "luxury", "minimal"],
    "editorial-poster": ["editorial", "poster", "oversized"],
    "faith-collection": ["faith", "spiritual", "sacred"],
    "minimal-emblem": ["emblem", "micro", "silent"],
    "technical-blueprint": ["technical", "blueprint", "schematic"],
    "gallery-composition": ["gallery", "archive", "vintage"],
    "silent-collection": ["quiet", "silent", "subtle"],
    "micro-graphic": ["micro", "small", "minimal"],
    "oversized-graphic": ["oversized", "statement", "bold"],
    "monochrome-symbol": ["monochrome", "symbol", "single color"],
  };

  score += (keywords[template.id] ?? []).reduce((s, kw) => s + (text.includes(kw) ? 1 : 0), 0);
  return score;
}

export function selectTemplate(
  brief: DesignStudioBrief,
  style: DesignStyleDefinition,
  layout: LayoutDefinition,
  seed: number,
  emotionWeights?: EmotionalCompositionWeights,
  wearabilityWeights?: WearabilityCompositionWeights,
): TemplateDefinition {
  const scored = ALL_TEMPLATE_IDS.map((id) => {
    let score = scoreTemplate(TEMPLATE_REGISTRY[id], brief, style, layout);
    if (emotionWeights) {
      score = applyEmotionTemplateScore(score, id, emotionWeights);
    }
    if (wearabilityWeights) {
      score = applyWearabilityTemplateScore(score, id, wearabilityWeights);
    }
    return { template: TEMPLATE_REGISTRY[id], score };
  }).sort((a, b) => b.score - a.score);

  const top = scored[0]?.score ?? 0;
  const tied = scored.filter((e) => e.score === top);
  const picked = tied[seed % tied.length]?.template ?? getTemplate("luxury-wordmark");

  console.log(`[DESIGN LIBRARY] Template selected: ${picked.name}`);

  return picked;
}

export function selectTemplateSeed(brief: DesignStudioBrief): number {
  return hashString([brief.designId, brief.geometry, brief.placement, ...brief.visualElements].join("|"));
}
