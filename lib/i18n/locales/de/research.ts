export const research = {
  page: {
    title: "Research-Agent",
    description:
      "Markt-Intelligence für deinen aktiven Workspace — Wettbewerber, Trends und Signale als strukturierte Berichte.",
  },
  interface: {
    label: "Research-Anfrage",
    headline: "Was soll recherchiert werden?",
    placeholder:
      "z. B. Analysiere Corteiz, finde Sommer-Streetwear-Trends, recherchiere Oversized-Silhouetten …",
    submit: "Bericht erstellen",
    running: "Research-Agent analysiert …",
    poweredBy: "Research-Agent · Berichte werden im Wissensspeicher gespeichert",
    tryExamples: "Beispiel-Anfragen",
    savedDomains: "Gespeichert in: {domains}",
    viewReports: "Berichte ansehen",
    success: "Bericht erstellt und gespeichert",
    executiveSummary: "Executive Summary",
    keyFindings: "Kernaussagen",
    recommendations: "Empfehlungen",
    confidence: "Konfidenz",
  },
  examples: {
    represent: "Analysiere Represent",
    corteiz: "Analysiere Corteiz",
    summerTrends: "Finde Sommer-Streetwear-Trends",
    oversized: "Recherchiere Oversized-Silhouetten",
    luxuryPricing: "Analysiere Luxury-Streetwear-Preise",
  },
  errors: {
    noResponse: "Keine Antwort vom Research-Agenten erhalten.",
    invalidResponse: "Ungültiges Berichtsformat vom Research-Agenten.",
    supabaseNotConfigured:
      "Supabase ist nicht konfiguriert. Brain-Persistenz erforderlich.",
    openaiNotConfigured:
      "OpenAI ist nicht konfiguriert. OPENAI_API_KEY in .env.local hinzufügen.",
    invalidRequest: "Ungültige Anfrage",
    unexpected: "Ein unerwarteter Fehler ist aufgetreten",
  },
} as const;
