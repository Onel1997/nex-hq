export const ceo = {
  page: {
    title: "CEO-Agent",
    description:
      "Ziele delegieren, Tasks erstellen und den Fortschritt aller Spezialisten überwachen.",
  },
  interface: {
    label: "Strategische Frage",
    modeLabel: "Strategie-Briefing",
    headline: "Welche strategische Entscheidung steht an?",
    placeholder:
      "z. B. Was sind die größten Chancen für Milaene? Welche Kollektion als nächstes? …",
    submit: "Strategie-Briefing erstellen",
    running: "CEO-Agent analysiert Wissensspeicher …",
    poweredBy:
      "CEO-Agent · Antworten basieren auf gespeicherten Berichten und Brain-Kontext",
    tryExamples: "Beispiel-Fragen",
    success: "Strategie-Briefing erstellt und gespeichert",
    executiveSummary: "Executive Summary",
    keyInsights: "Key Insights",
    strategicOpportunities: "Strategische Chancen",
    risks: "Risiken",
    nextSteps: "Konkrete nächste Schritte",
    sources: "Genutzte Berichte",
    confidence: "Konfidenz",
    contextRecords: "{count} Wissensspeicher-Einträge als Kontext geladen",
    viewReports: "Berichte ansehen",
  },
  delegation: {
    label: "Ziel-Delegation",
    modeLabel: "Ziel delegieren",
    headline: "Welches Ziel soll der CEO umsetzen?",
    placeholder:
      "z. B. Create a summer streetwear drop for Milaene …",
    submit: "Ziel delegieren",
    running: "CEO zerlegt Ziel in Tasks …",
    poweredBy:
      "CEO-Agent · Erstellt Tasks, weist Spezialisten zu und führt Research/Design/Marketing automatisch aus wenn AUTO_EXECUTION_ENABLED=true",
    success: "Delegation abgeschlossen — Tasks erstellt und zugewiesen",
    autoExecuted: "{count} Agenten automatisch ausgeführt",
    executionFailed: "{count} Ausführungen fehlgeschlagen",
    manualPending: "{count} Tasks warten auf manuelle Ausführung",
    objective: "Objective",
    milestones: "Meilensteine",
    taskPlan: "Task-Plan",
    taskStatus: "Status",
    tasksCreated: "{count} Tasks erstellt und zugewiesen",
    viewTasks: "Task-Board ansehen",
  },
  dashboard: {
    label: "Operations",
    title: "CEO Dashboard",
    loading: "Dashboard wird geladen …",
    activeExecutions: "Aktive Ausführungen",
    pendingReview: "Prüfung ausstehend",
    completedToday: "Heute abgeschlossen",
    failedTasks: "Fehlgeschlagene Tasks",
    activeTasks: "Aktive Tasks",
    completedTasks: "Abgeschlossen",
    blockedTasks: "Blockiert",
    ceoCreated: "CEO-delegiert",
    byStatus: "Fortschritt nach Status",
    byAgent: "Tasks nach Agent",
    noTasks: "Keine Tasks zugewiesen",
    more: "weitere",
    delegatedTasks: "Delegierte Tasks & Berichte",
    viewTaskBoard: "Task-Board",
    linkedReports: "Verknüpfte Berichte",
    subtask: "Untertask",
  },
  executiveSummary: {
    label: "Executive Summary",
    title: "CEO Final Report",
    latest: "Aktueller Executive Report",
    noReport: "Noch kein Final Report — wird erstellt sobald Research, Design und Marketing freigegeben sind.",
    completionScore: "Completion Score",
    generatedAt: "Erstellt",
    linkedGoal: "Verknüpftes Ziel",
    ceoVerdict: "CEO Urteil",
    viewReport: "Report ansehen",
  },
  examples: {
    summerDrop: "Create a summer streetwear drop for Milaene",
    launchCampaign: "Plan a launch campaign for the new capsule collection",
    opportunities: "Was sind die größten Chancen für Milaene?",
    nextCollection: "Welche Kollektion sollten wir als nächstes entwickeln?",
    trends2026: "Welche Trends sollten wir 2026 verfolgen?",
    differentiateRepresent:
      "Wie können wir uns von Represent differenzieren?",
  },
  priority: {
    high: "Hoch",
    medium: "Mittel",
    low: "Niedrig",
  },
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
    noResponse: "Keine Antwort vom CEO-Agenten erhalten.",
    noKnowledge:
      "Der Wissensspeicher enthält noch keine relevanten Daten. Erstelle zuerst Research-Berichte oder seede den Brain-Kontext.",
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
      tasks: "Task",
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
