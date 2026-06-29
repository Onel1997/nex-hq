import type { DesignStudioBrief } from "@/agents/design/studio-brief";
import { buildColorScheme } from "@/lib/design/vector-engine/color";
import { resolveEffects } from "@/lib/design/design-library/effects";
import { selectGrid } from "@/lib/design/design-library/grids";
import { getLayout, parseArtboard, selectLayout } from "@/lib/design/design-library/layouts";
import { selectOrnaments } from "@/lib/design/design-library/ornaments";
import { getStyle, selectStyle } from "@/lib/design/design-library/styles";
import { selectSymbols } from "@/lib/design/design-library/symbols";
import { getTemplate, selectTemplate, selectTemplateSeed } from "@/lib/design/design-library/templates";
import {
  buildTypographyPlacements,
  getTypographySystem,
  selectTypographySystem,
} from "@/lib/design/design-library/typography";
import type { CompositionOverrides, LibraryArtworkSpec, OrnamentId, SymbolId } from "@/lib/design/design-library/types";
import { range } from "@/lib/design/vector-engine/hash";
import { snap } from "@/lib/design/vector-engine/tokens";

/**
 * Design Library composition engine.
 * Brief → Style → Layout → Typography → Symbol → Decoration → Assembly
 */
export function composeFromBrief(
  brief: DesignStudioBrief,
  overrides: CompositionOverrides = {},
): LibraryArtworkSpec {
  const baseSeed = selectTemplateSeed(brief);
  const seed = baseSeed + (overrides.variantIndex ?? 0) * 97;

  const style = overrides.styleId ? getStyle(overrides.styleId) : selectStyle(brief);
  if (!overrides.styleId && !overrides.templateId) {
    console.log(`[DESIGN LIBRARY] Style selected: ${style.name}`);
  }

  const layout = overrides.layoutId
    ? getLayout(overrides.layoutId)
    : selectLayout(brief, style);
  if (!overrides.layoutId && !overrides.templateId) {
    console.log(`[DESIGN LIBRARY] Layout selected: ${layout.name}`);
  }

  const template = overrides.templateId
    ? getTemplate(overrides.templateId)
    : selectTemplate(brief, style, layout, seed);
  if (!overrides.templateId) {
    console.log(`[DESIGN LIBRARY] Template selected: ${template.name}`);
  }

  const artboard = parseArtboard(brief.dimensions);
  const layoutZones = layout.resolveZones(artboard, style.negativeSpace);

  const typographySystem =
    getTypographySystem(template.typographySystemId) ?? selectTypographySystem(style);

  const typography = buildTypographyPlacements(
    brief,
    style,
    layout,
    layoutZones,
    template,
    typographySystem,
    seed,
  );

  let symbols = selectSymbols(brief, style, layout, layoutZones, template, seed);
  let ornaments = selectOrnaments(style, layout, layoutZones, template, seed);

  if (overrides.forceRich) {
    symbols = enrichSymbols(symbols, template, layoutZones, seed);
    ornaments = enrichOrnaments(ornaments, template, layoutZones, seed);
  }

  const effects = resolveEffects(brief, style);
  const grid = selectGrid(style.id);
  const colors = buildColorScheme(brief.colorPalette, brief.color, brief.materialEffects, seed);

  const spec: LibraryArtworkSpec = {
    brief,
    seed,
    style,
    layout,
    layoutZones,
    typographySystem,
    typography,
    symbols,
    ornaments,
    effects,
    template,
    grid,
    colors,
    artboard,
  };

  return overrides.forceRich ? enrichArtworkSpec(spec) : spec;
}

function enrichSymbols(
  symbols: LibraryArtworkSpec["symbols"],
  template: LibraryArtworkSpec["template"],
  zones: LibraryArtworkSpec["layoutZones"],
  seed: number,
): LibraryArtworkSpec["symbols"] {
  const enriched = [...symbols];
  const existing = new Set(enriched.map((s) => s.symbolId));
  const extras: SymbolId[] = [
    template.primarySymbol,
    ...template.secondarySymbols,
    "interrupted-arc",
    "missing-center-void",
    "frame",
  ];

  for (const symbolId of extras) {
    if (enriched.length >= 4) break;
    if (existing.has(symbolId)) continue;
    existing.add(symbolId);
    enriched.push({
      id: `enriched-symbol-${enriched.length}`,
      symbolId,
      zone: enriched.length % 2 === 0 ? "secondary" : "accent",
      cx: snap(zones.anchors.symbol.x + range(seed, enriched.length, -zones.safeZone.width * 0.08, zones.safeZone.width * 0.08)),
      cy: snap(zones.anchors.symbol.y + range(seed, enriched.length + 5, 0, zones.safeZone.height * 0.12)),
      scale: zones.heroZone.width * 0.22,
      rotation: range(seed, enriched.length + 12, -8, 8),
      opacity: 0.65,
    });
  }

  return enriched;
}

function enrichOrnaments(
  ornaments: LibraryArtworkSpec["ornaments"],
  template: LibraryArtworkSpec["template"],
  zones: LibraryArtworkSpec["layoutZones"],
  seed: number,
): LibraryArtworkSpec["ornaments"] {
  const enriched = [...ornaments];
  const existing = new Set(enriched.map((o) => o.ornamentId));
  const extras: OrnamentId[] = [
    ...template.ornaments,
    "rule-lines",
    "micro-lines",
    "roman-ids",
    "tiny-capsules",
    "vertical-rules",
    "flank-strikes",
  ];

  for (const ornamentId of extras) {
    if (enriched.length >= 6) break;
    if (existing.has(ornamentId)) continue;
    existing.add(ornamentId);
    enriched.push({
      id: `enriched-ornament-${enriched.length}`,
      ornamentId,
      cx: snap(zones.anchors.focal.x),
      cy: snap(zones.anchors.type.y + enriched.length * 8),
      scale: zones.heroZone.width * 0.3,
      rotation: 0,
      opacity: 0.5,
    });
  }

  return enriched;
}

/** Ensures minimum richness for quality-gate fallbacks. */
export function enrichArtworkSpec(spec: LibraryArtworkSpec): LibraryArtworkSpec {
  const symbols = enrichSymbols(spec.symbols, spec.template, spec.layoutZones, spec.seed);
  const ornaments = enrichOrnaments(spec.ornaments, spec.template, spec.layoutZones, spec.seed);

  const typography = [...spec.typography];
  const hasSub = typography.some((t) => t.role === "subheadline" || t.role === "collection-code");
  if (!hasSub && typography.length > 0) {
    const headline = typography.find((t) => t.role === "headline" || t.role === "stacked-headline");
    if (headline) {
      typography.push({
        id: "enriched-subheadline",
        role: "subheadline",
        text: `${spec.brief.product.split(" ")[0]?.toUpperCase() ?? "STUDIO"} · ${String(2020 + (spec.seed % 6))}`,
        x: headline.x,
        y: snap(headline.y + headline.size * 1.15),
        size: headline.size * 0.38,
        tracking: headline.tracking + 0.08,
        lineHeight: 1.2,
        weight: 400,
        align: headline.align,
        rotation: 0,
        opacity: 0.52,
        layer: "typography",
      });
    }
  }

  if (!typography.some((t) => t.role === "roman-numeral")) {
    typography.push({
      id: "enriched-roman",
      role: "roman-numeral",
      text: ["I", "II", "III", "IV", "V", "VI"][spec.seed % 6]!,
      x: snap(spec.layoutZones.safeZone.x + spec.layoutZones.safeZone.width * 0.08),
      y: snap(spec.layoutZones.safeZone.y + spec.layoutZones.safeZone.height * 0.11),
      size: 9,
      tracking: 0.3,
      lineHeight: 1.1,
      weight: 400,
      align: "start",
      rotation: 0,
      opacity: 0.38,
      layer: "decorative",
    });
  }

  return { ...spec, symbols, ornaments, typography };
}
