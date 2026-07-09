export const design = {
  page: {
    title: "Design-Agent",
    description:
      "Vollständige Kollektionskonzepte auf Basis von Research- und CEO-Intelligence — Farben, Silhouetten, Produktlinie und Launch-Richtung.",
  },
  interface: {
    label: "Design-Briefing",
    headline: "Welche Kollektion soll entwickelt werden?",
    placeholder:
      "z. B. Entwickle eine SS26 Capsule basierend auf Oversized-Trends und CEO-Strategie …",
    submit: "Kollektionskonzept erstellen",
    running: "Design-Agent entwickelt Konzept …",
    poweredBy:
      "Design-Agent · Nutzt Trend-, Wettbewerbs-, Pricing- und CEO-Berichte",
    tryExamples: "Beispiel-Briefings",
    success: "Kollektionskonzept erstellt und gespeichert",
    collectionName: "Kollektion",
    collectionStory: "Kollektions-Story",
    colorPalette: "Farbpalette",
    silhouettes: "Silhouetten",
    productLineup: "Produktlinie",
    heroProducts: "Hero-Produkte",
    materials: "Materialien",
    designDirection: "Design-Richtung",
    launchRecommendations: "Launch-Empfehlungen",
    sources: "Genutzte Berichte",
    confidence: "Konfidenz",
    contextRecords: "{count} Wissensspeicher-Einträge als Kontext geladen",
    viewReports: "Berichte ansehen",
  },
  examples: {
    ss26Capsule:
      "Entwickle eine SS26 Streetwear-Capsule für Milaene basierend auf aktuellen Trends",
    oversizedDrop:
      "Konzipiere einen Oversized-Hoodie-Drop mit Premium-Positionierung",
    urbanLuxury:
      "Erstelle ein Urban-Luxury-Kollektionskonzept mit Beton-Ästhetik",
    competitorDiff:
      "Designe eine Kollektion, die sich von Represent durch Materialqualität differenziert",
  },
  errors: {
    noResponse: "Keine Antwort vom Design-Agenten erhalten.",
    noKnowledge:
      "Keine relevanten Intelligence-Berichte gefunden. Erstelle zuerst Trend-, Wettbewerbs-, Pricing- oder CEO-Berichte.",
    supabaseNotConfigured:
      "Supabase ist nicht konfiguriert. Brain-Persistenz erforderlich.",
    openaiNotConfigured:
      "OpenAI ist nicht konfiguriert. OPENAI_API_KEY in .env.local hinzufügen.",
    invalidRequest: "Ungültige Anfrage",
    unexpected: "Ein unerwarteter Fehler ist aufgetreten",
  },
} as const;
