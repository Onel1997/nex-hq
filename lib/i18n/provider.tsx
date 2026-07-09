"use client";

import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import type { WorkspaceDefinition } from "@/brain/workspaces/types";
import { getActiveWorkspace } from "@/lib/workspace/active";
import { DEFAULT_LOCALE, type Locale } from "./config";
import { getDictionary } from "./get-dictionary";
import { createTranslator, type TFunction } from "./translate";

interface I18nContextValue {
  locale: Locale;
  workspace: WorkspaceDefinition;
  t: TFunction;
  dictionary: ReturnType<typeof getDictionary>;
}

const I18nContext = createContext<I18nContextValue | null>(null);

interface I18nProviderProps {
  children: ReactNode;
  locale?: Locale;
  workspace?: WorkspaceDefinition;
}

export function I18nProvider({
  children,
  locale = DEFAULT_LOCALE,
  workspace = getActiveWorkspace(),
}: I18nProviderProps) {
  const value = useMemo(() => {
    const dictionary = getDictionary(locale);
    return {
      locale,
      workspace,
      dictionary,
      t: createTranslator(dictionary as unknown as Record<string, unknown>),
    };
  }, [locale, workspace]);

  return (
    <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
  );
}

function useI18nContext(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return ctx;
}

export function useI18n() {
  return useI18nContext();
}

export function useT() {
  return useI18nContext().t;
}

export function useLocale() {
  return useI18nContext().locale;
}

export function useDictionary() {
  return useI18nContext().dictionary;
}

export function useWorkspace() {
  return useI18nContext().workspace;
}
