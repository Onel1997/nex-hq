/** Supported UI locales. Code, APIs, and DB fields stay English. */
export const SUPPORTED_LOCALES = ["de", "en"] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "de";

export function isLocale(value: string): value is Locale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

/** BCP 47 tag for date/time formatting. */
export function getDateLocale(locale: Locale): string {
  return locale === "de" ? "de-DE" : "en-US";
}
