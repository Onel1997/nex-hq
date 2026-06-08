export const image = {
  page: {
    title: "Image-Agent",
    description:
      "Visuelle Asset-Projekte für Milaene — Moodboards, Mockups, Campaign Visuals und Social Creatives auf Basis von Design-, Content- und Marketing-Berichten.",
  },
  interface: {
    label: "Image-Briefing",
    headline: "Welche visuellen Assets sollen erstellt werden?",
    placeholder:
      "z. B. Erstelle ein Image-Projekt für Urban Echoes — Moodboard, Hoodie-Mockups, Campaign Visuals und Instagram Creatives …",
    submit: "Image-Projekt erstellen",
    running: "Image-Agent erstellt visuelle Prompts …",
    poweredBy:
      "Image-Agent · Nutzt Design-, Content-, Marketing- und CEO-Berichte",
    tryExamples: "Beispiel-Briefings",
    success: "Image-Projekt erstellt und gespeichert",
    projectName: "Projektname",
    visualDirection: "Visual Direction",
    collectionStory: "Kollektions-Story",
    moodboard: "Moodboard",
    campaignConcept: "Campaign Concept",
    assets: "Assets",
    assetCount: "{count} Assets",
    prompt: "Prompt",
    dimensions: "Abmessungen",
    styleNotes: "Style Notes",
    purpose: "Zweck",
    platform: "Plattform",
    sources: "Genutzte Berichte",
    confidence: "Konfidenz",
    contextRecords: "{count} Wissensspeicher-Einträge als Kontext geladen",
    viewReports: "Berichte ansehen",
    moreAssets: "+{count} weitere Assets im gespeicherten Bericht",
    phaseNote: "Phase 1: Strukturierte Prompts — keine Bild-API-Aufrufe",
  },
  examples: {
    urbanEchoes:
      "Erstelle ein Image-Projekt für Urban Echoes — Moodboard, Mockups und Social Creatives",
    moodboardMockups:
      "Generiere Moodboard- und Hoodie-Mockup-Prompts aus dem Design-Bericht",
    campaignVisuals:
      "Erstelle Campaign Visuals und Landing-Page-Hero-Prompts aus Marketing- und Content-Berichten",
    socialLookbook:
      "Verfasse Instagram-, TikTok- und Lookbook-Prompts für den SS26 Drop",
  },
  errors: {
    noResponse: "Keine Antwort vom Image-Agenten erhalten.",
    noKnowledge:
      "Design-, Content- oder Marketing-Berichte fehlen. Erstelle zuerst alle primären Intelligence-Berichte.",
    supabaseNotConfigured:
      "Supabase ist nicht konfiguriert. Brain-Persistenz erforderlich.",
    openaiNotConfigured:
      "OpenAI ist nicht konfiguriert. OPENAI_API_KEY in .env.local hinzufügen.",
    invalidRequest: "Ungültige Anfrage",
    unexpected: "Ein unerwarteter Fehler ist aufgetreten",
  },
} as const;
