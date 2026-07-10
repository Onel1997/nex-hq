import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import type { ConfidenceScoreId } from "../types/confidence";
import type { ConfidenceTier } from "../types/confidence";

import type { IntelligenceCopy } from "@/lib/i18n/locales/de/intelligence";

export type { IntelligenceCopy };

export function getIntelligenceCopy(locale: Locale = DEFAULT_LOCALE) {
  return getDictionary(locale).intelligence;
}

export function formatIntelligenceTemplate(
  template: string,
  vars: Record<string, string | number>,
): string {
  return Object.entries(vars).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, String(value)),
    template,
  );
}

export function scoreLabel(
  id: ConfidenceScoreId,
  locale: Locale = DEFAULT_LOCALE,
): string {
  return getIntelligenceCopy(locale).scores[id];
}

export function tierLabel(
  tier: ConfidenceTier | string,
  locale: Locale = DEFAULT_LOCALE,
): string {
  const labels = getIntelligenceCopy(locale).tiers;
  const key = tier as keyof typeof labels;
  return key in labels ? labels[key] : tier;
}

export function roleLabelLocalized(
  role: keyof IntelligenceCopy["roles"],
  locale: Locale = DEFAULT_LOCALE,
): string {
  const roles = getIntelligenceCopy(locale).roles;
  return roles[role] ?? role;
}
