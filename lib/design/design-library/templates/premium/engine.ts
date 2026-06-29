import type { LibraryArtworkSpec } from "@/lib/design/design-library/types";
import type {
  PremiumRenderContext,
  PremiumTemplateId,
  PremiumTemplateRenderResult,
} from "@/lib/design/design-library/templates/premium/types";
import { buildPremiumRenderContext, detectApparelPlacement } from "@/lib/design/design-library/templates/premium/shared/context";
import {
  evaluateRecipeComposition,
  renderPremiumTemplateFromRecipe,
} from "@/lib/design/design-library/templates/premium/shared/assemble";
import { logCompositionScore } from "@/lib/design/design-library/composition-intelligence";
import { evaluateKnowledgeGate, getKnowledgeBaseStats } from "@/lib/design/design-knowledge";
import { validatePremiumTemplateOutput } from "@/lib/design/design-library/templates/premium/quality-gate";
import {
  ARCHITECTURAL_FRAME_RECIPE,
  FAITH_COLLECTION_RECIPE,
  FASHION_CAMPAIGN_RECIPE,
  GALLERY_POSTER_RECIPE,
  LUXURY_EDITORIAL_RECIPE,
  MODERN_MINIMAL_RECIPE,
  MUSEUM_LABEL_RECIPE,
  OVERSIZED_GRAPHIC_RECIPE,
  SILENT_COLLECTION_RECIPE,
  TECHNICAL_LUXURY_RECIPE,
  type TemplateRecipeBundle,
} from "@/lib/design/design-library/templates/premium/recipes";
import { renderLuxuryEditorial } from "@/lib/design/design-library/templates/premium/luxury-editorial/render";
import { renderGalleryPoster } from "@/lib/design/design-library/templates/premium/gallery-poster/render";
import { renderMuseumLabel } from "@/lib/design/design-library/templates/premium/museum-label/render";
import { renderArchitecturalFrame } from "@/lib/design/design-library/templates/premium/architectural-frame/render";
import { renderFaithCollection } from "@/lib/design/design-library/templates/premium/faith-collection/render";
import { renderOversizedGraphic } from "@/lib/design/design-library/templates/premium/oversized-graphic/render";
import { renderSilentCollection } from "@/lib/design/design-library/templates/premium/silent-collection/render";
import { renderModernMinimal } from "@/lib/design/design-library/templates/premium/modern-minimal/render";
import { renderTechnicalLuxury } from "@/lib/design/design-library/templates/premium/technical-luxury/render";
import { renderFashionCampaign } from "@/lib/design/design-library/templates/premium/fashion-campaign/render";

const TEMPLATE_MAP: Record<string, PremiumTemplateId> = {
  "editorial-poster": "luxury-editorial",
  "gallery-composition": "gallery-poster",
  "faith-collection": "faith-collection",
  "monochrome-symbol": "architectural-frame",
  "oversized-graphic": "oversized-graphic",
  "silent-collection": "silent-collection",
  "minimal-emblem": "modern-minimal",
  "luxury-wordmark": "museum-label",
  "micro-graphic": "silent-collection",
  "technical-blueprint": "technical-luxury",
};

const FALLBACK_CHAIN: PremiumTemplateId[] = [
  "luxury-editorial",
  "oversized-graphic",
  "gallery-poster",
  "fashion-campaign",
  "architectural-frame",
  "faith-collection",
  "museum-label",
  "modern-minimal",
  "silent-collection",
  "technical-luxury",
];

const RENDERERS: Record<PremiumTemplateId, (ctx: PremiumRenderContext) => PremiumTemplateRenderResult> = {
  "luxury-editorial": renderLuxuryEditorial,
  "gallery-poster": renderGalleryPoster,
  "museum-label": renderMuseumLabel,
  "architectural-frame": renderArchitecturalFrame,
  "faith-collection": renderFaithCollection,
  "oversized-graphic": renderOversizedGraphic,
  "silent-collection": renderSilentCollection,
  "modern-minimal": renderModernMinimal,
  "technical-luxury": renderTechnicalLuxury,
  "fashion-campaign": renderFashionCampaign,
};

const RECIPES: Record<PremiumTemplateId, TemplateRecipeBundle> = {
  "luxury-editorial": LUXURY_EDITORIAL_RECIPE,
  "gallery-poster": GALLERY_POSTER_RECIPE,
  "museum-label": MUSEUM_LABEL_RECIPE,
  "architectural-frame": ARCHITECTURAL_FRAME_RECIPE,
  "faith-collection": FAITH_COLLECTION_RECIPE,
  "oversized-graphic": OVERSIZED_GRAPHIC_RECIPE,
  "silent-collection": SILENT_COLLECTION_RECIPE,
  "modern-minimal": MODERN_MINIMAL_RECIPE,
  "technical-luxury": TECHNICAL_LUXURY_RECIPE,
  "fashion-campaign": FASHION_CAMPAIGN_RECIPE,
};

export function selectPremiumTemplate(spec: LibraryArtworkSpec): PremiumTemplateId {
  const fromTemplate = TEMPLATE_MAP[spec.template.id];
  if (fromTemplate) return fromTemplate;

  const text = `${spec.brief.visualConcept} ${spec.style.id}`.toLowerCase();
  if (text.includes("faith")) return "faith-collection";
  if (text.includes("gallery")) return "gallery-poster";
  if (text.includes("campaign")) return "fashion-campaign";
  if (text.includes("architect")) return "architectural-frame";
  if (text.includes("oversized")) return "oversized-graphic";
  if (text.includes("silent")) return "silent-collection";
  if (text.includes("technical")) return "technical-luxury";
  if (text.includes("museum")) return "museum-label";
  return "luxury-editorial";
}

function flattenResult(result: PremiumTemplateRenderResult): string {
  return [
    result.background,
    result.baseGeometry,
    result.secondaryShapes,
    result.typography,
    result.decorativeDetails,
    result.defs,
  ].join("");
}

function logStats(templateId: PremiumTemplateId, result: PremiumTemplateRenderResult): void {
  console.log(`[PREMIUM TEMPLATE] Selected: ${templateId}`);
  console.log(`[PREMIUM TEMPLATE] Element count: ${result.stats.elementCount}`);
  console.log(`[PREMIUM TEMPLATE] Layer count: ${result.stats.layerCount}`);
}

function tryRenderCandidate(
  ctx: PremiumRenderContext,
  templateId: PremiumTemplateId,
  isHero: boolean,
): PremiumTemplateRenderResult | null {
  const knowledgeGate = evaluateKnowledgeGate(ctx, templateId);
  if (!knowledgeGate.passed) {
    console.log(`[DESIGN KNOWLEDGE] Rejected: ${knowledgeGate.reason}`);
    return null;
  }

  const recipe = RECIPES[templateId];
  const compositionGate = evaluateRecipeComposition(ctx, recipe);

  if (isHero) {
    logCompositionScore(templateId, compositionGate.score, compositionGate.passed);
    if (!compositionGate.passed) {
      console.log(`[COMPOSITION INTELLIGENCE] Rejected: ${compositionGate.reason}`);
      return null;
    }
  }

  const knowledgeResult = renderPremiumTemplateFromRecipe(ctx, {
    layout: knowledgeGate.applied.layout,
    symbols: knowledgeGate.applied.symbols,
    ornaments: knowledgeGate.applied.ornaments,
    decision: knowledgeGate.applied.decision,
  });
  const knowledgeValidation = validatePremiumTemplateOutput(flattenResult(knowledgeResult));
  if (knowledgeValidation.passed) {
    logStats(templateId, { ...knowledgeResult, stats: knowledgeValidation.stats });
    return { ...knowledgeResult, stats: knowledgeValidation.stats };
  }
  console.log(`[PREMIUM TEMPLATE] Knowledge render rejected: ${knowledgeValidation.reason}`);

  const render = RENDERERS[templateId];
  const result = render(ctx);
  const validation = validatePremiumTemplateOutput(flattenResult(result));

  if (validation.passed) {
    logStats(templateId, { ...result, stats: validation.stats });
    return { ...result, stats: validation.stats };
  }

  console.log(`[PREMIUM TEMPLATE] Rejected: ${validation.reason}`);

  const fallbackResult = renderPremiumTemplateFromRecipe(ctx, recipe);
  const fallbackValidation = validatePremiumTemplateOutput(flattenResult(fallbackResult));
  if (fallbackValidation.passed) {
    logStats(templateId, { ...fallbackResult, stats: fallbackValidation.stats });
    return { ...fallbackResult, stats: fallbackValidation.stats };
  }
  console.log(`[PREMIUM TEMPLATE] Rejected: ${fallbackValidation.reason}`);
  return null;
}

export function renderPremiumTemplateEngine(
  spec: LibraryArtworkSpec,
  strokeWidth: number,
): PremiumTemplateRenderResult {
  const stats = getKnowledgeBaseStats();
  console.log(
    `[DESIGN KNOWLEDGE] Brain loaded: ${stats.totalRecipes} recipes (${stats.layouts} layouts, ${stats.typography} typography, ${stats.symbols} symbols, ${stats.ornaments} ornaments)`,
  );

  const isHero = spec.brief.role.toLowerCase().includes("hero");
  const placement = detectApparelPlacement(spec);
  const preferred = selectPremiumTemplate(spec);

  const placementOverride =
    isHero && !spec.brief.printArea.toLowerCase().includes("micro")
      ? placement === "center-chest"
        ? "oversized-front"
        : placement
      : placement;

  const baseCtx = buildPremiumRenderContext(spec, strokeWidth, placementOverride);
  const candidates = [preferred, ...FALLBACK_CHAIN.filter((t) => t !== preferred)];

  for (const templateId of candidates) {
    const result = tryRenderCandidate(baseCtx, templateId, isHero);
    if (result) return result;
  }

  if (isHero) {
    for (let variant = 1; variant <= 6; variant++) {
      const variantCtx = { ...baseCtx, seed: baseCtx.seed + variant * 37 };
      for (const templateId of candidates) {
        const result = tryRenderCandidate(variantCtx, templateId, isHero);
        if (result) return result;
      }
    }
    console.log("[COMPOSITION INTELLIGENCE] No composition above 92 — forcing best-effort luxury-editorial");
  }

  const forced = renderPremiumTemplateFromRecipe(baseCtx, {
    ...LUXURY_EDITORIAL_RECIPE,
    ...evaluateKnowledgeGate(baseCtx, "luxury-editorial").applied,
  });
  logStats("luxury-editorial", forced);
  return forced;
}
