import type { DesignStudioBrief } from "@/agents/design/studio-brief";
import type { DesignStyleDefinition, LayoutDefinition, LayoutId } from "@/lib/design/design-library/types";
import type { EmotionalCompositionWeights } from "@/lib/design/design-knowledge/emotional-language";
import { applyEmotionLayoutScore } from "@/lib/design/design-knowledge/emotional-language";
import { getLayout, LAYOUT_REGISTRY } from "@/lib/design/design-library/layouts/registry";
import { hashString, pick } from "@/lib/design/vector-engine/hash";

function detectLayoutId(brief: DesignStudioBrief, style: DesignStyleDefinition): LayoutId {
  const text = `${brief.placement} ${brief.printArea} ${brief.role}`.toLowerCase();

  if (text.includes("dual") || text.includes("two placement")) return "dual-print";
  if (text.includes("corner")) return "corner-print";
  if (text.includes("wrap")) return "wrap-composition";
  if (text.includes("editorial") || text.includes("magazine")) return "editorial-layout";
  if (text.includes("gallery")) return "gallery-layout";
  if (text.includes("diagonal") || text.includes("slant")) return "diagonal-layout";
  if (text.includes("floating") || text.includes("drift")) return "floating-composition";
  if (text.includes("vertical") || text.includes("column")) return "vertical-print";
  if (text.includes("split") || text.includes("asym")) return "split-layout";
  if (text.includes("micro") || text.includes("small mark")) return "micro-chest";
  if (text.includes("symbol above") || text.includes("mark above type")) return "symbol-above-type";
  if (text.includes("type above") || text.includes("headline above")) return "type-above-symbol";
  if (text.includes("oversized") && text.includes("back")) return "oversized-back";
  if (text.includes("oversized") || text.includes("statement")) return "oversized-front";
  if (text.includes("back")) return "oversized-back";

  if (style.preferredLayouts.length > 0) {
    return style.preferredLayouts[0]!;
  }

  return "center-chest";
}

export function selectLayout(
  brief: DesignStudioBrief,
  style: DesignStyleDefinition,
  emotionWeights?: EmotionalCompositionWeights,
): LayoutDefinition {
  const seed = hashString([brief.designId, brief.placement, brief.printArea].join("|"));
  const detected = detectLayoutId(brief, style);

  if (emotionWeights) {
    const candidates = style.preferredLayouts.includes(detected)
      ? [detected, ...style.preferredLayouts.filter((id) => id !== detected)]
      : [detected, ...style.preferredLayouts];

    const uniqueCandidates = [...new Set(candidates)].filter((id) => LAYOUT_REGISTRY[id]);
    if (uniqueCandidates.length > 0) {
      const scored = uniqueCandidates.map((id) => ({
        id,
        score: applyEmotionLayoutScore(0, id, emotionWeights) + (id === detected ? 2 : 0),
      }));
      scored.sort((a, b) => b.score - a.score);
      const best = scored[0]!;
      if (best.score > 0) return getLayout(best.id);
    }
  }

  if (style.preferredLayouts.includes(detected)) {
    return getLayout(detected);
  }

  const preferred = style.preferredLayouts.find((id) => LAYOUT_REGISTRY[id]);
  if (preferred) return getLayout(preferred);

  const fallbacks: LayoutId[] = style.preferredLayouts.length ? style.preferredLayouts : ["center-chest"];
  const fallback = pick(seed, 1, fallbacks) as LayoutId;
  return getLayout(fallback);
}
