export const image = {
  page: {
    title: "Image-Agent",
    description:
      "Creative Director Workspace — fokussiertes Core Package, Advanced Assets on demand, professionelle Art-Direction-Prompts und Bildgenerierung.",
  },
  interface: {
    label: "Visual Production Briefing",
    headline: "Welches Creative Production Project soll erstellt werden?",
    placeholder:
      "z. B. Erstelle ein Core Production Package für Urban Echoes — Hero Banner, Product Mockups, Campaign Key Visual, Instagram Carousel, Reels und TikTok …",
    submit: "Visual Production Project erstellen",
    running: "Image-Agent erstellt Visual Production Project …",
    poweredBy:
      "Visual Production Agent · Nutzt CEO-, Design-, Content- und Marketing-Berichte",
    tryExamples: "Beispiel-Briefings",
    success: "Visual Production Project erstellt und gespeichert",
    projectName: "Projektname",
    moodboardSection: "Creative Direction",
    corePackage: "Core Package",
    advancedPackage: "Advanced Package",
    campaignShots: "Campaign Shot List",
    assets: "Assets",
    sources: "Genutzte Berichte",
    confidence: "Konfidenz",
    contextRecords: "{count} Wissensspeicher-Einträge als Kontext geladen",
    viewReports: "Berichte ansehen",
    phaseNote: "Creative Production — Prompts planen, Bilder mit OpenAI oder Flux generieren",
    generate: "Generieren",
    generating: "Wird generiert …",
    generatedAt: "Erstellt",
    status: "Status",
    prompt: "Prompt",
    preview: "Vorschau",
    providerOpenai: "OpenAI Images",
    providerFlux: "Flux (Replicate)",
    statusReady: "Ready",
    statusPending: "Ausstehend",
    statusGenerating: "Generiert …",
    statusCompleted: "Fertig",
    statusFailed: "Fehlgeschlagen",
    openProject: "Projekt öffnen",
    generateImages: "Bilder generieren",
    export: "Exportieren",
    delete: "Löschen",
    editPrompt: "Prompt anzeigen",
    hidePrompt: "Prompt ausblenden",
    loadingProject: "Projekt wird geladen …",
    backToReports: "Zurück zu Berichten",
    palettePrimary: "Primary",
    paletteSecondary: "Secondary",
    paletteAccent: "Accent",
    paletteBackground: "Background",
    paletteText: "Text",
  },
  examples: {
    urbanEchoes:
      "Erstelle ein Core Production Package für Urban Echoes",
    corePackage:
      "Generiere Hero Banner, Product Mockups und Campaign Key Visual aus Design- und Marketing-Berichten",
    campaignVisuals:
      "Erstelle Instagram Carousel, Reels und TikTok Concepts für den SS26 Drop",
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
    providerNotConfigured: "Provider nicht konfiguriert",
    projectNotFound: "Image-Projekt nicht gefunden",
  },
} as const;
