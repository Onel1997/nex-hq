import type { CompositionTemplate, CompositionTemplateContext, CompositionTemplateId } from "../types";
import { abstractPerimeterTemplate } from "./abstract-perimeter";
import { editorialBackPrintTemplate } from "./editorial-back-print";
import { luxuryBadgeTemplate } from "./luxury-badge";
import { minimalFrontChestTemplate } from "./minimal-front-chest";
import { oversizedCenterBackTemplate } from "./oversized-center-back";
import { spineTypographyTemplate } from "./spine-typography";
import { vintageLabelTemplate } from "./vintage-label";

export const COMPOSITION_TEMPLATES: CompositionTemplate[] = [
  spineTypographyTemplate,
  luxuryBadgeTemplate,
  editorialBackPrintTemplate,
  abstractPerimeterTemplate,
  vintageLabelTemplate,
  minimalFrontChestTemplate,
  oversizedCenterBackTemplate,
];

export function selectCompositionTemplate(
  ctx: CompositionTemplateContext,
): CompositionTemplate {
  const scored = COMPOSITION_TEMPLATES.map((template) => ({
    template,
    score: template.matches(ctx) + (ctx.attempt > 1 ? alternateBoost(template.id, ctx.attempt) : 0),
  })).sort((a, b) => b.score - a.score);

  const best = scored[0];
  if (best && best.score > 0) {
    return best.template;
  }

  return editorialBackPrintTemplate;
}

function alternateBoost(templateId: CompositionTemplateId, attempt: number): number {
  const rotation: Record<number, Partial<Record<CompositionTemplateId, number>>> = {
    2: {
      "abstract-perimeter": 15,
      "luxury-badge": 12,
      "vintage-label": 10,
    },
    3: {
      "oversized-center-back": 18,
      "editorial-back-print": 14,
      "spine-typography": 12,
    },
  };
  return rotation[attempt]?.[templateId] ?? 0;
}

export function getTemplateById(id: CompositionTemplateId): CompositionTemplate {
  return COMPOSITION_TEMPLATES.find((t) => t.id === id) ?? editorialBackPrintTemplate;
}
