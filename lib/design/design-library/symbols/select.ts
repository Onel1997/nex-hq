import type { DesignStudioBrief } from "@/agents/design/studio-brief";
import type {
  DesignStyleDefinition,
  LayoutDefinition,
  LayoutZones,
  SymbolId,
  SymbolPlacement,
  TemplateDefinition,
} from "@/lib/design/design-library/types";
import { getSymbol } from "@/lib/design/design-library/symbols/registry";
import { range } from "@/lib/design/vector-engine/hash";
import { snap } from "@/lib/design/vector-engine/tokens";

function matchSymbolFromBrief(brief: DesignStudioBrief): SymbolId[] {
  const text = `${brief.geometry} ${brief.visualElements.join(" ")}`.toLowerCase();
  const matched: SymbolId[] = [];
  if (text.includes("broken") || text.includes("segment")) matched.push("broken-circle", "split-circle");
  if (text.includes("arc") || text.includes("interrupted") || text.includes("orbital")) matched.push("interrupted-arc", "orbit");
  if (text.includes("halo") || text.includes("ring")) matched.push("halo");
  if (text.includes("cross")) matched.push("cross");
  if (text.includes("frame") || text.includes("border")) matched.push("frame");
  if (text.includes("grid") || text.includes("matrix")) matched.push("grid");
  if (text.includes("sacred") || text.includes("geometry")) matched.push("sacred-geometry");
  if (text.includes("compass")) matched.push("compass");
  if (text.includes("diamond")) matched.push("diamond");
  if (text.includes("eye")) matched.push("minimal-eye");
  return matched;
}

export function selectSymbols(
  brief: DesignStudioBrief,
  style: DesignStyleDefinition,
  layout: LayoutDefinition,
  zones: LayoutZones,
  template: TemplateDefinition,
  seed: number,
): SymbolPlacement[] {
  const placements: SymbolPlacement[] = [];
  const heroScale = zones.heroZone.width * layout.scaling.heroScale * style.geometryScale;
  const symbolAnchor = zones.anchors.symbol;

  const primaryId = template.primarySymbol;
  placements.push({
    id: "symbol-primary",
    symbolId: primaryId,
    zone: "hero",
    cx: symbolAnchor.x,
    cy: symbolAnchor.y,
    scale: heroScale,
    rotation: range(seed, 7, -5, 5),
    opacity: 0.92,
  });

  const briefMatches = matchSymbolFromBrief(brief);
  const secondaryIds = [
    ...new Set([...template.secondarySymbols, ...briefMatches.filter((id) => id !== primaryId)]),
  ].slice(0, 3);

  secondaryIds.forEach((symbolId, index) => {
    const def = getSymbol(symbolId);
    if (!def.recommendedStyles.includes(style.id) && !briefMatches.includes(symbolId)) return;
    const anchor = zones.anchors.secondary ?? symbolAnchor;
    placements.push({
      id: `symbol-secondary-${index}`,
      symbolId,
      zone: "secondary",
      cx: snap(anchor.x + range(seed, index + 10, -zones.safeZone.width * 0.06, zones.safeZone.width * 0.06)),
      cy: snap(anchor.y + zones.safeZone.height * (0.14 + index * 0.08)),
      scale: heroScale * range(seed, index + 5, 0.22, 0.38),
      rotation: range(seed, index + 12, -10, 10),
      opacity: range(seed, index + 13, 0.45, 0.75),
    });
  });

  if (layout.balance === "asymmetric") {
    placements.push({
      id: "symbol-accent",
      symbolId: style.preferredSymbols[0] ?? "minimal-star",
      zone: "accent",
      cx: snap(zones.safeZone.x + zones.safeZone.width * 0.72),
      cy: snap(symbolAnchor.y + heroScale * 0.15),
      scale: heroScale * 0.2,
      rotation: range(seed, 99, -8, 8),
      opacity: 0.55,
    });
  }

  return placements;
}
