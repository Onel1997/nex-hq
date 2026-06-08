export const ceo = {
  systemPrompt: `Ich bin der CEO-Agent von {platformName}. Der aktuell aktive Workspace ist: {workspaceName}.

Deine Rolle in diesem Gespräch:
- Berate den Gründer mit dem unten bereitgestellten {brainName}-Kontext für den aktiven Workspace
- Der Kontext umfasst Unternehmensprofil, Markenvision, Regeln, Entscheidungen, Research-Berichte, Wettbewerber-Intelligence sowie Design-, Marketing-, Produkt- und Content-Memories
- Nutze aktiv gespeichertes Wissen — verweise explizit auf Berichtstitel, Wettbewerber-Einträge oder Memory-Domänen, wenn sie zur Frage passen
- Wenn relevante Informationen im Kontext stehen (z. B. ein Research-Bericht zu einem Wettbewerber), nutze sie als Grundlage deiner Antwort
- Sage NICHT „Ich habe keine Informationen über …“ oder „Diese Information liegt mir nicht vor“, wenn der Kontext passende Berichte oder Einträge enthält
- Weise nur dann auf fehlendes Wissen hin, wenn der bereitgestellte Kontext wirklich keine relevante Information enthält
- Beantworte Fragen zu Unternehmen, Marke, Strategie, Wettbewerbern, Trends und gespeicherten Intelligence-Berichten
- Sei prägnant, selbstbewusst und on-brand — sprich wie ein Insider, nicht wie ein Marketer
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
      reports: "Research-Bericht",
      competitor_intelligence: "Wettbewerber-Intelligence",
      design_memory: "Design-Memory",
      marketing_memory: "Marketing-Memory",
      product_memory: "Produkt-Memory",
      content_memory: "Content-Memory",
    },
    recordMeta: {
      status: "Status",
      summary: "Zusammenfassung",
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
    reports: {
      agent: "Agent",
      confidence: "Konfidenz",
      summary: "Bericht-Zusammenfassung",
      findings: "Erkenntnisse",
      recommendations: "Empfehlungen",
      analysisExcerpt: "Analyse (Auszug)",
      notes: "Notizen",
    },
    competitorIntelligence: {
      analysisSummary: "Analyse",
      competitors: "Wettbewerber",
      tier: "Tier",
      positioning: "Positionierung",
      strengths: "Stärken",
      weaknesses: "Schwächen",
      dropCadence: "Drop-Kadenz",
      competitiveEdge: "Wettbewerbsvorteil",
      recommendations: "Empfehlungen",
      marketSignals: "Markt-Signale",
    },
    designMemory: {
      dropVisualDirection: "Visuelle Drop-Richtung",
      moodKeywords: "Mood-Keywords",
      silhouettes: "Silhouetten",
      graphicTreatment: "Grafikbehandlung",
      colorPalette: "Farbpalette",
      empty: "Design-Memory ohne Detailfelder",
    },
    marketingMemory: {
      name: "Kampagne",
      status: "Status",
      objective: "Ziel",
      notes: "Notizen",
      launchSequence: "Launch-Sequenz",
      channelMix: "Channel-Mix",
      kpis: "KPIs",
    },
    productMemory: {
      name: "Produkt",
      status: "Status",
      description: "Beschreibung",
      category: "Kategorie",
      drop: "Drop",
      narrative: "Narrativ",
      tags: "Tags",
    },
    contentMemory: {
      format: "Format",
      channel: "Kanal",
      narrativeArc: "Narrativ-Bogen",
      copyRules: "Copy-Regeln",
      blocks: "Content-Blöcke",
    },
  },
} as const;
