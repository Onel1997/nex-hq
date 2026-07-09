import type {
  EmotionTranslation,
  EmotionalLanguageId,
  TypographyBehavior,
} from "@/lib/design/design-knowledge/emotional-language/types";
import {
  getEmotionalLanguage,
} from "@/lib/design/design-knowledge/emotional-language/emotion-library";
import type { LayoutId, OrnamentId, SymbolId, TemplateId } from "@/lib/design/design-library/types";

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function mergeBehaviors(primary: TypographyBehavior[], secondary: TypographyBehavior[]): TypographyBehavior[] {
  const merged = unique([...primary, ...secondary]);
  return merged.slice(0, 4);
}

function pickNegativeSpace(
  primary: ReturnType<typeof getEmotionalLanguage>,
  secondary: ReturnType<typeof getEmotionalLanguage>,
): EmotionTranslation["negativeSpace"] {
  const profiles = [primary?.negativeSpaceProfile, secondary?.negativeSpaceProfile].filter(Boolean);
  if (profiles.includes("high")) return "high";
  if (profiles.includes("elevated")) return "elevated";
  if (profiles.includes("tight")) return "tight";
  return "balanced";
}

function buildNarrative(primaryId: EmotionalLanguageId, secondaryId: EmotionalLanguageId): string {
  const primary = getEmotionalLanguage(primaryId);
  const secondary = getEmotionalLanguage(secondaryId);
  return `${primary?.name ?? primaryId} story with ${secondary?.name ?? secondaryId} undertone — ${primary?.mood ?? "editorial restraint"}`;
}

/**
 * Translate emotional languages into concrete composition directives.
 *
 * Example: ONLY BETWEEN US → Connection + Reflection + Silence
 * → soft oversized type, ghost layer, broken halo, architectural frame,
 *   museum captions, micro coordinates, high negative space.
 */
export function translateEmotions(
  primaryId: EmotionalLanguageId,
  secondaryId: EmotionalLanguageId,
): EmotionTranslation {
  const primary = getEmotionalLanguage(primaryId);
  const secondary = getEmotionalLanguage(secondaryId);
  const tertiary =
    primaryId === "connection" && (secondaryId === "reflection" || secondaryId === "silence")
      ? getEmotionalLanguage("silence")
      : undefined;

  const typography = mergeBehaviors(
    primary?.typographyBehaviors ?? [],
    secondary?.typographyBehaviors ?? [],
  );

  const symbols = unique<SymbolId>([
    ...(primary?.symbolPreferences ?? []),
    ...(secondary?.symbolPreferences ?? []),
    ...(tertiary?.symbolPreferences ?? []),
  ]).slice(0, 5);

  const ornaments = unique<OrnamentId>([
    ...(primary?.ornamentPreferences ?? []),
    ...(secondary?.ornamentPreferences ?? []),
    ...(tertiary?.ornamentPreferences ?? []),
  ]).slice(0, 6);

  const templateHints = unique<TemplateId>([
    ...(primary?.templateBias ?? []),
    ...(secondary?.templateBias ?? []),
  ]).slice(0, 4);

  const layoutHints = unique<LayoutId>([
    ...(primary?.layoutBias ?? []),
    ...(secondary?.layoutBias ?? []),
  ]).slice(0, 4);

  const movement = primary?.movement ?? secondary?.movement ?? "editorial-flow";

  return {
    typography,
    symbols,
    ornaments,
    negativeSpace: pickNegativeSpace(primary, secondary),
    movement,
    templateHints,
    layoutHints,
    narrative: buildNarrative(primaryId, secondaryId),
  };
}

export function formatEmotionTranslation(translation: EmotionTranslation): string {
  const lines = [
    `Typography: ${translation.typography.join(", ")}`,
    `Symbols: ${translation.symbols.join(", ")}`,
    `Ornaments: ${translation.ornaments.join(", ")}`,
    `Negative space: ${translation.negativeSpace}`,
    `Movement: ${translation.movement}`,
  ];
  return lines.join(" · ");
}
