export type SvgRendererType = "legacy-vector-engine" | "design-library" | "design-library-hero";

export interface ValidateSvgOptions {
  includeProductionGuides?: boolean;
}

export interface SvgValidationResult {
  valid: boolean;
  renderer: SvgRendererType;
  error?: string;
}

const FORBIDDEN_MARKERS = [
  "Print area",
  "placeholder",
  "geometry note",
  "missing geometry",
  "debug",
  "palette",
  "Quick Spec",
];

const LEGACY_PRIMARY_LAYER = "layer-base-geometry";

const DESIGN_LIBRARY_PRIMARY_LAYERS = [
  "layer-base-geometry",
  "hero-primary-symbol",
  "hero-architectural-frame",
  "hero-composition-root",
] as const;

const HERO_PRIMARY_LAYERS = [
  "hero-composition-root",
  "hero-primary-symbol",
  "hero-architectural-frame",
] as const;

const TYPOGRAPHY_LAYER = "layer-typography";
const PRODUCTION_LAYER = "print-area";

function hasLayerId(svg: string, layerId: string): boolean {
  return svg.includes(`id="${layerId}"`);
}

function hasAnyLayerId(svg: string, layerIds: readonly string[]): string | undefined {
  return layerIds.find((id) => hasLayerId(svg, id));
}

function missingLayerMessage(renderer: SvgRendererType, layer: string): string {
  switch (renderer) {
    case "legacy-vector-engine":
      return `SVG generation missing ${layer} (legacy vector engine requires ${LEGACY_PRIMARY_LAYER})`;
    case "design-library-hero":
      return `SVG generation missing ${layer} (hero renderer requires ${HERO_PRIMARY_LAYERS.join(", ")})`;
    case "design-library":
      return `SVG generation missing ${layer} (design library requires one of: ${DESIGN_LIBRARY_PRIMARY_LAYERS.join(", ")})`;
  }
}

export function detectSvgRenderer(svg: string): SvgRendererType {
  const isDesignLibrary = svg.includes("DESIGN_LIBRARY_PHASE_3");
  const hasHeroCompositionRoot = hasLayerId(svg, "hero-composition-root");
  const hasHeroArchitecturalFrame = hasLayerId(svg, "hero-architectural-frame");
  const hasHeroPrimarySymbol = hasLayerId(svg, "hero-primary-symbol");
  const hasLegacyBase = hasLayerId(svg, LEGACY_PRIMARY_LAYER);

  if (
    isDesignLibrary &&
    (hasHeroCompositionRoot ||
      hasHeroPrimarySymbol ||
      (hasHeroArchitecturalFrame && !hasLegacyBase))
  ) {
    return "design-library-hero";
  }

  if (isDesignLibrary) {
    return "design-library";
  }

  return "legacy-vector-engine";
}

/** Validates composed SVG markup for legacy Vector Engine and Design Library render paths. */
export function validateGeneratedSvg(
  svg: string,
  options: ValidateSvgOptions = {},
): SvgValidationResult {
  const includeProductionGuides = options.includeProductionGuides ?? true;
  const trimmed = svg.trimStart();
  const renderer = detectSvgRenderer(svg);

  if (!trimmed.startsWith("<?xml") && !trimmed.startsWith("<svg")) {
    return { valid: false, renderer, error: "SVG generation produced invalid markup (missing XML/SVG root)" };
  }

  const svgOpen = trimmed.match(/<svg\b[^>]*>/i)?.[0] ?? "";
  if (!/viewBox\s*=\s*"/i.test(svgOpen)) {
    return { valid: false, renderer, error: "SVG generation missing viewBox attribute" };
  }
  if (!/\bwidth\s*=\s*"/i.test(svgOpen)) {
    return { valid: false, renderer, error: "SVG generation missing width attribute" };
  }
  if (!/\bheight\s*=\s*"/i.test(svgOpen)) {
    return { valid: false, renderer, error: "SVG generation missing height attribute" };
  }

  if (!svg.includes("<title>")) {
    return { valid: false, renderer, error: "SVG generation missing title element" };
  }

  let primaryLayer: string | undefined;
  if (renderer === "legacy-vector-engine") {
    primaryLayer = hasLayerId(svg, LEGACY_PRIMARY_LAYER) ? LEGACY_PRIMARY_LAYER : undefined;
  } else if (renderer === "design-library-hero") {
    primaryLayer = hasAnyLayerId(svg, HERO_PRIMARY_LAYERS);
  } else {
    primaryLayer = hasAnyLayerId(svg, DESIGN_LIBRARY_PRIMARY_LAYERS);
  }

  if (!primaryLayer) {
    return {
      valid: false,
      renderer,
      error: missingLayerMessage(
        renderer,
        renderer === "legacy-vector-engine" ? LEGACY_PRIMARY_LAYER : "primary composition layer",
      ),
    };
  }

  if (!hasLayerId(svg, TYPOGRAPHY_LAYER)) {
    return {
      valid: false,
      renderer,
      error: `SVG generation missing ${TYPOGRAPHY_LAYER} (${renderer.replace(/-/g, " ")} requires typography layer)`,
    };
  }

  if (includeProductionGuides && !hasLayerId(svg, PRODUCTION_LAYER)) {
    return {
      valid: false,
      renderer,
      error: `SVG generation missing ${PRODUCTION_LAYER} guide (${renderer.replace(/-/g, " ")} requires production layer)`,
    };
  }

  const lower = svg.toLowerCase();
  for (const marker of FORBIDDEN_MARKERS) {
    if (lower.includes(marker.toLowerCase())) {
      return { valid: false, renderer, error: `SVG generation contains forbidden marker: ${marker}` };
    }
  }

  return { valid: true, renderer };
}
