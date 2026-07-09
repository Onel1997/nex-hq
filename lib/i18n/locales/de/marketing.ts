export const marketing = {
  page: {
    title: "Marketing-Agent",
    description:
      "Launch- und Kampagnenpläne auf Basis von Research-, CEO- und Design-Intelligence — Content, Kanäle, KPIs und Budget.",
  },
  interface: {
    label: "Marketing-Briefing",
    headline: "Welche Kampagne soll geplant werden?",
    placeholder:
      "z. B. Erstelle einen 30-Tage-Launch-Plan für die SS26 Capsule basierend auf Design- und CEO-Berichten …",
    submit: "Kampagnenplan erstellen",
    running: "Marketing-Agent plant Kampagne …",
    poweredBy:
      "Marketing-Agent · Nutzt Research-, CEO- und Design-Berichte",
    tryExamples: "Beispiel-Briefings",
    success: "Kampagnenplan erstellt und gespeichert",
    launchStrategy: "Launch-Strategie",
    contentPillars: "Content-Säulen",
    tiktokIdeas: "TikTok-Ideen",
    instagramIdeas: "Instagram-Ideen",
    influencerStrategy: "Influencer-Strategie",
    emailCampaignPlan: "E-Mail-Kampagnenplan",
    communityBuildingPlan: "Community-Aufbau",
    contentCalendar: "30-Tage-Content-Kalender",
    launchKpis: "Launch-KPIs",
    budgetAllocation: "Budget-Allokation",
    sources: "Genutzte Berichte",
    confidence: "Konfidenz",
    contextRecords: "{count} Wissensspeicher-Einträge als Kontext geladen",
    viewReports: "Berichte ansehen",
    day: "Tag",
  },
  examples: {
    ss26Launch:
      "Erstelle einen 30-Tage-Launch-Plan für die Milaene SS26 Capsule",
    tiktokCampaign:
      "Plane eine TikTok-first Kampagne für den nächsten Hoodie-Drop",
    influencerSeeding:
      "Entwickle eine Influencer-Seeding-Strategie basierend auf CEO- und Design-Berichten",
    emailSequence:
      "Erstelle eine VIP-E-Mail-Sequenz für den kommenden Drop",
  },
  errors: {
    noResponse: "Keine Antwort vom Marketing-Agenten erhalten.",
    noKnowledge:
      "Keine relevanten Intelligence-Berichte gefunden. Erstelle zuerst Research-, CEO- oder Design-Berichte.",
    supabaseNotConfigured:
      "Supabase ist nicht konfiguriert. Brain-Persistenz erforderlich.",
    openaiNotConfigured:
      "OpenAI ist nicht konfiguriert. OPENAI_API_KEY in .env.local hinzufügen.",
    invalidRequest: "Ungültige Anfrage",
    unexpected: "Ein unerwarteter Fehler ist aufgetreten",
  },
} as const;
