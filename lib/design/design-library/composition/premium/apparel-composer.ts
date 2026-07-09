import type { LibraryArtworkSpec, TypographyPlacement } from "@/lib/design/design-library/types";
import {
  type ApparelPlacement,
  buildHierarchyPlan,
} from "@/lib/design/design-library/composition/premium/hierarchy";
import { buildNegativeSpaceField } from "@/lib/design/design-library/composition/premium/negative-space";
import { buildRhythmGrid } from "@/lib/design/design-library/composition/premium/rhythm";
import { buildPremiumTypography } from "@/lib/design/design-library/composition/premium/typography-layout";
import { buildSymbolLayout, renderSymbolLayout } from "@/lib/design/design-library/composition/premium/symbol-layout";
import { buildOrnamentLayout } from "@/lib/design/design-library/composition/premium/ornament-layout";
import { renderOrnament } from "@/lib/design/design-library/ornaments/render";
import {
  capsuleText,
  renderArchitecturalFrame,
  renderCapsuleCode,
  renderCoordinateMarks,
  renderVerticalRules,
  type AssetRenderContext,
} from "@/lib/design/engine/assets/library";
import { range } from "@/lib/design/vector-engine/hash";
import { DESIGN_TOKENS, fmt } from "@/lib/design/vector-engine/tokens";
import { escapeXml, group, line } from "@/lib/design/vector-engine/xml";

export type CompositionType =
  | "luxury-editorial"
  | "gallery-poster"
  | "museum-label"
  | "architectural"
  | "faith-collection"
  | "modern-minimal"
  | "fashion-campaign"
  | "technical-luxury"
  | "silent-collection"
  | "oversized-graphic";

export type { ApparelPlacement };

const COMPOSITION_FALLBACK: CompositionType[] = [
  "luxury-editorial",
  "gallery-poster",
  "oversized-graphic",
  "fashion-campaign",
  "architectural",
  "faith-collection",
  "museum-label",
  "modern-minimal",
  "silent-collection",
];

const TEMPLATE_COMPOSITION: Partial<Record<string, CompositionType>> = {
  "editorial-poster": "luxury-editorial",
  "gallery-composition": "gallery-poster",
  "faith-collection": "faith-collection",
  "monochrome-symbol": "architectural",
  "oversized-graphic": "oversized-graphic",
  "silent-collection": "silent-collection",
  "minimal-emblem": "modern-minimal",
  "luxury-wordmark": "museum-label",
  "micro-graphic": "silent-collection",
  "technical-blueprint": "technical-luxury",
};

export interface PremiumRenderResult {
  baseGeometry: string;
  secondaryShapes: string;
  decorativeDetails: string;
  typography: string;
  defs: string;
  compositionType: CompositionType;
}

export interface PremiumCompositionDraft {
  compositionType: CompositionType;
  symbolCount: number;
  typeBlockCount: number;
  ornamentCount: number;
  hasStructuralSymbol: boolean;
  isWireframe: boolean;
}

export function detectApparelPlacement(spec: LibraryArtworkSpec): ApparelPlacement {
  const text = `${spec.brief.placement} ${spec.brief.printArea} ${spec.layout.id}`.toLowerCase();
  if (text.includes("sleeve")) return "sleeve";
  if (text.includes("pocket")) return "pocket";
  if (text.includes("neck")) return "neck";
  if (text.includes("back")) return "oversized-back";
  if (text.includes("oversized") || spec.layout.id.includes("oversized")) return "oversized-front";
  return "center-chest";
}

export function selectCompositionType(spec: LibraryArtworkSpec): CompositionType {
  const fromTemplate = TEMPLATE_COMPOSITION[spec.template.id];
  if (fromTemplate) return fromTemplate;

  const text = `${spec.brief.visualConcept} ${spec.style.id}`.toLowerCase();
  if (text.includes("faith")) return "faith-collection";
  if (text.includes("architect")) return "architectural";
  if (text.includes("gallery")) return "gallery-poster";
  if (text.includes("campaign")) return "fashion-campaign";
  if (text.includes("oversized")) return "oversized-graphic";
  if (text.includes("silent")) return "silent-collection";
  if (text.includes("technical")) return "technical-luxury";
  if (text.includes("museum")) return "museum-label";
  return "luxury-editorial";
}

/** Rejects logo studies, wireframes, and single-symbol compositions. */
export function evaluateCompositionQuality(draft: PremiumCompositionDraft): {
  passed: boolean;
  reason?: string;
} {
  if (draft.symbolCount < 2) {
    return { passed: false, reason: "single symbol composition" };
  }
  if (draft.typeBlockCount < 2) {
    return { passed: false, reason: "circle + text / logo mark" };
  }
  if (!draft.hasStructuralSymbol) {
    return { passed: false, reason: "logo + circle geometry study" };
  }
  if (draft.isWireframe) {
    return { passed: false, reason: "wireframe / technical blueprint" };
  }
  if (draft.ornamentCount < 2 && draft.typeBlockCount < 3) {
    return { passed: false, reason: "simple geometric study" };
  }
  return { passed: true };
}

function letterSpacingPx(size: number, tracking: number): number {
  return size * tracking;
}

function renderTypographyPlacement(el: TypographyPlacement, ink: string, fontFamily: string): string {
  const ls = letterSpacingPx(el.size, el.tracking).toFixed(2);
  const anchor = el.align === "middle" ? "middle" : el.align === "end" ? "end" : "start";

  if (el.role === "vertical-text") {
    const chars = el.text.toUpperCase().split("");
    const dy = el.size * el.lineHeight;
    const tspans = chars
      .map((ch, i) => `<tspan x="${el.x}" dy="${i === 0 ? 0 : dy}">${escapeXml(ch)}</tspan>`)
      .join("");
    return `<text fill="${ink}" font-family="${fontFamily}" font-size="${el.size}" font-weight="${el.weight}" letter-spacing="${ls}" opacity="${el.opacity}">${tspans}</text>`;
  }

  const transform = el.rotation !== 0 ? ` transform="rotate(${el.rotation} ${el.x} ${el.y})"` : "";
  return `<text x="${el.x}" y="${el.y}" fill="${ink}" font-family="${fontFamily}" font-size="${el.size}" font-weight="${el.weight}" letter-spacing="${ls}" text-anchor="${anchor}" opacity="${el.opacity}" dominant-baseline="alphabetic"${transform}>${escapeXml(el.text.toUpperCase())}</text>`;
}

function buildDraft(
  compositionType: CompositionType,
  symbolLayout: ReturnType<typeof buildSymbolLayout>,
  typography: ReturnType<typeof buildPremiumTypography>,
  ornaments: ReturnType<typeof buildOrnamentLayout>,
): PremiumCompositionDraft {
  const structural = new Set(["frame", "diamond", "cross", "sacred-geometry", "architectural-line", "grid"]);
  return {
    compositionType,
    symbolCount: symbolLayout.symbols.length,
    typeBlockCount: typography.placements.filter((t) => t.layer === "typography").length,
    ornamentCount: ornaments.ornaments.length,
    hasStructuralSymbol: symbolLayout.symbols.some((s) => structural.has(s.symbolId)),
    isWireframe: compositionType === "technical-luxury" && symbolLayout.symbols.every((s) => s.symbolId === "grid"),
  };
}

function composeDraft(
  spec: LibraryArtworkSpec,
  compositionType: CompositionType,
  placement: ApparelPlacement,
) {
  const typeFirst = spec.template.hierarchy === "type-first" || planTypeFirst(compositionType);
  const plan = buildHierarchyPlan(spec, placement, typeFirst);
  const rhythm = buildRhythmGrid(spec.layoutZones.safeZone, spec.seed);
  const space = buildNegativeSpaceField(
    spec.layoutZones.safeZone,
    plan,
    spec.seed,
    spec.style.negativeSpace,
  );
  const typography = buildPremiumTypography(spec, plan, rhythm, space, compositionType);
  const symbolLayout = buildSymbolLayout(spec, plan, typography, compositionType);
  const ornaments = buildOrnamentLayout(spec, plan, rhythm, space, compositionType);
  return { plan, rhythm, space, typography, symbolLayout, ornaments, compositionType };
}

function planTypeFirst(type: CompositionType): boolean {
  return ["luxury-editorial", "gallery-poster", "fashion-campaign", "oversized-graphic", "museum-label"].includes(
    type,
  );
}

function renderDraft(
  spec: LibraryArtworkSpec,
  strokeWidth: number,
  draft: ReturnType<typeof composeDraft>,
): PremiumRenderResult {
  const { colors, layoutZones, seed } = spec;
  const { safeZone } = layoutZones;
  const { plan, typography, symbolLayout, ornaments, compositionType } = draft;

  const symbolLayers = renderSymbolLayout(
    symbolLayout,
    colors,
    strokeWidth,
    seed,
    safeZone,
  );

  const ornamentCtx = {
    colors,
    strokeWidth,
    seed,
    safeZone,
  };

  const ornamentSvg = ornaments.ornaments
    .map((placement) => renderOrnament({ ...ornamentCtx, placement }))
    .join("");

  const assetCtx = (scale: number, opacity: number): AssetRenderContext => ({
    cx: plan.primary.x,
    cy: plan.primary.y + plan.primary.scale * 0.35,
    scale,
    rotation: 0,
    opacity,
    colors,
    strokeWidth,
    seed,
    safeZone,
  });

  const decorParts = [
    group("hero-coordinate-marks", renderCoordinateMarks(assetCtx(plan.primary.scale * 0.85, 0.42))),
    group(
      "hero-capsule-code",
      renderCapsuleCode(
        { ...assetCtx(plan.primary.scale * 0.32, 0.58), cy: plan.primary.y + plan.primary.scale * 0.42 },
        capsuleText(seed),
      ),
    ),
    group("hero-vertical-rules", renderVerticalRules(assetCtx(plan.primary.scale, 0.34))),
    group("premium-ornaments", ornamentSvg),
  ];

  const headline = typography.placements.find(
    (t) => t.role === "headline" || t.role === "stacked-headline",
  );
  if (headline) {
    decorParts.push(
      group(
        "hero-title-ghost",
        `<text x="${fmt(headline.x)}" y="${fmt(headline.y - headline.size * 0.75)}" fill="${colors.secondary}" font-family="${DESIGN_TOKENS.fonts.display}" font-size="${fmt(headline.size * 0.18)}" font-weight="400" letter-spacing="5" text-anchor="middle" opacity="0.12">${escapeXml(headline.text.toUpperCase())}</text>`,
      ),
    );
  }

  if (compositionType === "oversized-graphic" || placementIsOversized(spec)) {
    decorParts.push(
      group(
        "hero-back-print-rule",
        line(
          safeZone.x + safeZone.width * 0.07,
          safeZone.y + safeZone.height * 0.15,
          safeZone.x + safeZone.width * 0.93,
          safeZone.y + safeZone.height * 0.15,
          {
            stroke: colors.secondary,
            "stroke-width": strokeWidth * 0.26,
            opacity: 0.18,
            "stroke-linecap": "round",
          },
        ),
      ),
    );
  }

  plan.micro.forEach((anchor, i) => {
    decorParts.push(
      group(
        `premium-micro-${i}`,
        line(
          anchor.x - anchor.scale * 0.04,
          anchor.y,
          anchor.x + anchor.scale * 0.04,
          anchor.y,
          {
            stroke: colors.accent,
            "stroke-width": strokeWidth * 0.35,
            opacity: anchor.opacity,
            "stroke-linecap": "round",
          },
        ),
      ),
    );
  });

  const fontFamily = spec.typographySystem.fontFamily;
  const typeBlocks = typography.placements.filter((t) => t.layer === "typography");
  const decorType = typography.placements.filter((t) => t.layer === "decorative");

  const typographySvg = group(
    "layer-typography",
    typeBlocks
      .map((t) => group(t.id, renderTypographyPlacement(t, colors.ink, fontFamily)))
      .join(""),
  );

  const decorativeType = decorType
    .map((t) => group(t.id, renderTypographyPlacement(t, colors.ink, fontFamily)))
    .join("");

  const baseParts = [
    symbolLayers.primaryFocal,
    group(
      "hero-architectural-frame",
      renderArchitecturalFrame({
        cx: plan.primary.x,
        cy: plan.primary.y,
        scale: plan.primary.scale * 1.08,
        rotation: plan.primary.rotation,
        opacity: 0.42,
        colors,
        strokeWidth,
        seed,
        safeZone,
      }),
    ),
  ];

  return {
    baseGeometry: group("hero-composition-root", baseParts.join("")),
    secondaryShapes: group(
      "layer-secondary-shapes",
      [symbolLayers.secondaryFocal, symbolLayers.supporting].join(""),
    ),
    decorativeDetails: group("hero-rich-decor", [...decorParts, decorativeType].join("")),
    typography: typographySvg,
    defs: symbolLayout.clipDefs,
    compositionType,
  };
}

function placementIsOversized(spec: LibraryArtworkSpec): boolean {
  return spec.layout.id.includes("oversized") || spec.layout.id === "gallery-layout";
}

/** Assembles a Hero Piece using professional apparel composition rules. */
export function composePremiumApparel(
  spec: LibraryArtworkSpec,
  strokeWidth: number,
): PremiumRenderResult {
  const placement = detectApparelPlacement(spec);
  const preferred = selectCompositionType(spec);
  const candidates = [preferred, ...COMPOSITION_FALLBACK.filter((t) => t !== preferred)];

  for (const compositionType of candidates) {
    const draft = composeDraft(spec, compositionType, placement);
    const quality = evaluateCompositionQuality(
      buildDraft(compositionType, draft.symbolLayout, draft.typography, draft.ornaments),
    );

    if (quality.passed) {
      console.log(`[PREMIUM COMPOSER] Composition: ${compositionType}`);
      return renderDraft(spec, strokeWidth, draft);
    }
    console.log(`[PREMIUM COMPOSER] Rejected ${compositionType}: ${quality.reason}`);
  }

  const fallback = composeDraft(spec, "luxury-editorial", placement);
  console.log("[PREMIUM COMPOSER] Forcing luxury-editorial fallback");
  return renderDraft(spec, strokeWidth, fallback);
}
