export type IntegrationState = "connected" | "disconnected" | "planned";

export interface IntegrationStatus {
  id: string;
  name: string;
  description: string;
  state: IntegrationState;
  detail: string;
}

export function getIntegrationStatuses(): IntegrationStatus[] {
  const supabaseConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
  const openaiConfigured = Boolean(process.env.OPENAI_API_KEY);
  const replicateConfigured = Boolean(process.env.REPLICATE_API_TOKEN);

  return [
    {
      id: "supabase",
      name: "Supabase",
      description: "Database, authentication, storage, and realtime",
      state: supabaseConfigured ? "connected" : "disconnected",
      detail: supabaseConfigured
        ? "Environment variables detected"
        : "Add credentials in .env.local",
    },
    {
      id: "openai",
      name: "OpenAI",
      description: "LLM inference for agent orchestration",
      state: openaiConfigured ? "connected" : "disconnected",
      detail: openaiConfigured
        ? "API key detected"
        : "Add OPENAI_API_KEY to .env.local",
    },
    {
      id: "replicate",
      name: "Replicate (Flux)",
      description: "Flux image generation via Replicate API",
      state: replicateConfigured ? "connected" : "disconnected",
      detail: replicateConfigured
        ? "API token detected"
        : "Add REPLICATE_API_TOKEN to .env.local",
    },
    {
      id: "shopify",
      name: "Shopify",
      description: "Commerce storefront and inventory sync",
      state: "planned",
      detail: "Integration planned for Phase 5",
    },
    {
      id: "langgraph",
      name: "LangGraph",
      description: "Multi-agent orchestration and state machines",
      state: "planned",
      detail: "Dependency installed — wiring in Phase 3",
    },
    {
      id: "instagram",
      name: "Instagram API",
      description: "Content publishing and analytics",
      state: "planned",
      detail: "Planned for marketing agent activation",
    },
  ];
}
