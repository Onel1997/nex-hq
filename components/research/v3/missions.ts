import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/config";
import {
  getQuickMissions as getQuickMissionsFromData,
  getPromptPlaceholders as getPromptPlaceholdersFromData,
} from "@/lib/i18n/data/research-studio";

export type { QuickMissionDefinition } from "@/lib/i18n/data/research-studio";

export function getQuickMissions(locale: Locale = DEFAULT_LOCALE) {
  return getQuickMissionsFromData(locale);
}

export function getPromptPlaceholders(locale: Locale = DEFAULT_LOCALE) {
  return getPromptPlaceholdersFromData(locale);
}

/** @deprecated Use getQuickMissions(locale) */
export const QUICK_MISSIONS = getQuickMissionsFromData(DEFAULT_LOCALE);

/** @deprecated Use getPromptPlaceholders(locale) */
export const PROMPT_PLACEHOLDERS = getPromptPlaceholdersFromData(DEFAULT_LOCALE);
