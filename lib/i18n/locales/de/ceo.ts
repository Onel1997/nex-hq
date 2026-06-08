export const ceo = {
  systemPrompt: `Du bist der CEO-Agent für {platformName} — die strategische Intelligenzschicht, die den Gründer des {workspaceName}-Workspaces berät.

Deine Rolle in diesem Gespräch:
- Berate den Gründer ausschließlich mit dem unten bereitgestellten {brainName}-Kontext für diesen Workspace
- Beantworte Fragen zu Unternehmen, Markenvision, Markenwerten, Zielgruppe und strategischer Ausrichtung
- Sei prägnant, selbstbewusst und on-brand — sprich wie ein Insider, nicht wie ein Marketer
- Wenn die Antwort nicht im bereitgestellten Kontext steht, sage ehrlich, dass du diese Information im Wissensspeicher noch nicht hast
- Delegiere KEINE Aufgaben, erstelle KEINE Aufgabenlisten und behaupte NICHT, Aktionen ausgeführt zu haben — du bist nur im Beratungsmodus
- Antworte IMMER auf Deutsch

## {brainName}-Kontext

`,
  fallbackResponse:
    "Ich konnte keine Antwort generieren. Bitte versuche es erneut.",
  errors: {
    supabaseNotConfigured:
      "Supabase ist nicht konfiguriert. Füge NEXT_PUBLIC_SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY in .env.local hinzu und führe die Brain-Migration aus.",
    openaiNotConfigured:
      "OpenAI ist nicht konfiguriert. Füge OPENAI_API_KEY in .env.local hinzu.",
    invalidRequest: "Ungültige Anfrage",
    unexpected: "Ein unerwarteter Fehler ist aufgetreten",
  },
  promptBuilder: {
    domainLabels: {
      company_profile: "Unternehmensprofil",
      brand_vision: "Markenvision",
      brand_rules: "Markenregeln",
      decisions: "Entscheidungen",
    },
    companyProfile: {
      company: "Unternehmen",
      industry: "Branche",
      businessModel: "Geschäftsmodell",
      targetAudience: "Zielgruppe",
      goals: "Ziele",
      kpis: "KPIs",
      current: "aktuell",
    },
    brandVision: {
      mission: "Mission",
      vision: "Vision",
      positioning: "Positionierung",
      northStar: "Nordstern",
      voiceTone: "Stimme & Ton",
      culturalIdentity: "Kulturelle Identität",
      brandPillars: "Markensäulen",
      audienceSegments: "Zielgruppensegmente",
      demographics: "Demografie",
      psychographics: "Psychografie",
      geography: "Geografie",
    },
    brandRules: {
      globalConstraints: "Globale Einschränkungen",
      rules: "Regeln",
      good: "Gut",
      avoid: "Vermeiden",
    },
    decisions: {
      decision: "Entscheidung",
      rationale: "Begründung",
      status: "Status",
      outcome: "Ergebnis",
    },
  },
} as const;
