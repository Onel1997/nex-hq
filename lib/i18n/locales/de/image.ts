export const image = {
  page: {
    title: "Image-Agent",
    description:
      "Visual Production Agent für Milaene — Moodboards, Mockups, Campaign Visuals und Landing Assets auf Basis von CEO-, Design-, Content- und Marketing-Berichten.",
  },
  interface: {
    label: "Visual Production Briefing",
    headline: "Welches Visual Production Project soll erstellt werden?",
    placeholder:
      "z. B. Erstelle ein Visual Production Project für Urban Echoes — Moodboard, Product Mockups, Campaign Visuals, Landing Assets und AI Prompts …",
    submit: "Visual Production Project erstellen",
    running: "Image-Agent erstellt Visual Production Project …",
    poweredBy:
      "Visual Production Agent · Nutzt CEO-, Design-, Content- und Marketing-Berichte",
    tryExamples: "Beispiel-Briefings",
    success: "Visual Production Project erstellt und gespeichert",
    projectName: "Projektname",
    moodboardSection: "Moodboard",
    productMockups: "Product Mockups",
    campaignVisuals: "Campaign Visuals",
    landingPageAssets: "Landing Page Assets",
    productionChecklist: "Production Checklist",
    sources: "Genutzte Berichte",
    confidence: "Konfidenz",
    contextRecords: "{count} Wissensspeicher-Einträge als Kontext geladen",
    viewReports: "Berichte ansehen",
    phaseNote: "Phase 1: Strukturierte AI-Prompts — keine Bild-API-Aufrufe",
  },
  examples: {
    urbanEchoes:
      "Erstelle ein Visual Production Project für Urban Echoes — Moodboard, Mockups und Campaign Visuals",
    moodboardMockups:
      "Generiere Moodboard- und Product-Mockup-Prompts aus dem Design-Bericht",
    campaignVisuals:
      "Erstelle Campaign Visuals und Landing Page Assets aus Marketing- und Content-Berichten",
    socialLookbook:
      "Verfasse Social Creatives, Carousel-Konzepte und Ad-Prompts für den SS26 Drop",
  },
  errors: {
    noResponse: "Keine Antwort vom Image-Agenten erhalten.",
    noKnowledge:
      "CEO-, Design-, Content- oder Marketing-Berichte fehlen. Erstelle zuerst alle primären Intelligence-Berichte.",
    supabaseNotConfigured:
      "Supabase ist nicht konfiguriert. Brain-Persistenz erforderlich.",
    openaiNotConfigured:
      "OpenAI ist nicht konfiguriert. OPENAI_API_KEY in .env.local hinzufügen.",
    invalidRequest: "Ungültige Anfrage",
    unexpected: "Ein unerwarteter Fehler ist aufgetreten",
  },
} as const;
