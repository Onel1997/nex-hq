import type { IntegrationState, IntegrationStatus } from "@/lib/config/integration-status";
import type { Locale } from "../config";
import { getDictionary } from "../get-dictionary";

export function getIntegrationStateLabels(
  locale: Locale,
): Record<IntegrationState, string> {
  const { common } = getDictionary(locale);
  return { ...common.integrationState };
}

export function getIntegrationStatuses(locale: Locale): IntegrationStatus[] {
  const { settings } = getDictionary(locale);

  const supabaseConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
  const openaiConfigured = Boolean(process.env.OPENAI_API_KEY);

  return [
    {
      id: "supabase",
      name: "Supabase",
      description: settings.integrations.supabase.description,
      state: supabaseConfigured ? "connected" : "disconnected",
      detail: supabaseConfigured
        ? settings.integrations.supabase.connected
        : settings.integrations.supabase.disconnected,
    },
    {
      id: "openai",
      name: "OpenAI",
      description: settings.integrations.openai.description,
      state: openaiConfigured ? "connected" : "disconnected",
      detail: openaiConfigured
        ? settings.integrations.openai.connected
        : settings.integrations.openai.disconnected,
    },
    {
      id: "shopify",
      name: "Shopify",
      description: settings.integrations.shopify.description,
      state: "planned",
      detail: settings.integrations.shopify.detail,
    },
    {
      id: "langgraph",
      name: "LangGraph",
      description: settings.integrations.langgraph.description,
      state: "planned",
      detail: settings.integrations.langgraph.detail,
    },
    {
      id: "instagram",
      name: "Instagram API",
      description: settings.integrations.instagram.description,
      state: "planned",
      detail: settings.integrations.instagram.detail,
    },
  ];
}
