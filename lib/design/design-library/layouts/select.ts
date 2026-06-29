import type { DesignStudioBrief } from "@/agents/design/studio-brief";
import type { DesignStyleDefinition, LayoutDefinition, LayoutId } from "@/lib/design/design-library/types";
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

export function selectLayout(brief: DesignStudioBrief, style: DesignStyleDefinition): LayoutDefinition {
  const seed = hashString([brief.designId, brief.placement, brief.printArea].join("|"));
  const detected = detectLayoutId(brief, style);

  if (style.preferredLayouts.includes(detected)) {
    return getLayout(detected);
  }

  const preferred = style.preferredLayouts.find((id) => LAYOUT_REGISTRY[id]);
  if (preferred) return getLayout(preferred);

  const fallbacks: LayoutId[] = style.preferredLayouts.length ? style.preferredLayouts : ["center-chest"];
  const fallback = pick(seed, 1, fallbacks) as LayoutId;
  return getLayout(fallback);
}
