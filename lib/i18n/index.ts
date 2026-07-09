export {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  getDateLocale,
  isLocale,
  type Locale,
} from "./config";
export { getDictionary, type Dictionary } from "./get-dictionary";
export {
  I18nProvider,
  useDictionary,
  useI18n,
  useLocale,
  useT,
  useWorkspace,
} from "./provider";
export { createTranslator, type TFunction } from "./translate";
export * from "./data";
