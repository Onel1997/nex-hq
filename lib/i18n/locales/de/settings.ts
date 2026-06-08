export const settings = {
  page: {
    title: "Einstellungen",
    description:
      "Konfiguriere dein Headquarters — System, KI-Modelle und Integrationen.",
  },
  tabs: {
    system: "System",
    aiModels: "KI-Modelle",
    integrations: "Integrationen",
  },
  workspace: {
    title: "Workspace",
    subtitle: "Headquarters-Identität",
    nameLabel: "Workspace-Name",
    darkMode: "Dunkelmodus",
    darkModeDescription: "Premium-Anthrazit-Theme",
  },
  ai: {
    title: "KI-Modelle",
    subtitle: "Inferenz-Konfiguration",
    primaryModel: "Primärmodell",
    ceoAgent: "CEO-Agent",
    save: "Einstellungen speichern",
  },
  integrations: {
    active: "Aktiv",
    planned: "Geplant",
    supabase: {
      description: "Datenbank, Authentifizierung, Storage und Realtime",
      connected: "Umgebungsvariablen erkannt",
      disconnected: "Zugangsdaten in .env.local hinzufügen",
    },
    openai: {
      description: "LLM-Inferenz für Agenten-Orchestrierung",
      connected: "API-Schlüssel erkannt",
      disconnected: "OPENAI_API_KEY in .env.local hinzufügen",
    },
    shopify: {
      description: "Commerce-Storefront und Inventar-Sync",
      detail: "Integration für Phase 5 geplant",
    },
    langgraph: {
      description: "Multi-Agenten-Orchestrierung und State Machines",
      detail: "Abhängigkeit installiert — Verkabelung in Phase 3",
    },
    instagram: {
      description: "Content-Publishing und Analytics",
      detail: "Geplant für Marketing-Agenten-Aktivierung",
    },
  },
} as const;
