import type { Locale } from "./config";
import { de, type DeDictionary } from "./locales/de";
import { en } from "./locales/en";

export type Dictionary = DeDictionary;

const dictionaries: Record<Locale, Dictionary> = {
  de,
  en,
};

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale] ?? de;
}
