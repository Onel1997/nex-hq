export const dashboard = {
  hero: {
    operatingNormally: "{workspace} läuft normal.",
  },
  command: {
    headline: "Was möchtest du heute tun?",
    ceoAgent: "CEO-Agent",
    thinking: "CEO-Agent denkt nach …",
    placeholder:
      "Stelle Fragen zu Unternehmen, Strategie, Marke oder Zielen …",
    poweredBy: "CEO-Agent · Angetrieben vom {brainName}",
    readingBrain: "{brainName} wird gelesen · Antwort wird generiert",
    tryAsking: "Probiere zu fragen",
    suggestedQuestions: {
      whatIsOurMission: "Was ist unsere Mission?",
      brandValues: "Was sind unsere Markenwerte?",
      targetAudience: "Wer ist unsere Zielgruppe?",
    },
    errors: {
      reachCeo: "CEO-Agent nicht erreichbar",
      generic: "Etwas ist schiefgelaufen",
    },
  },
  team: {
    label: "KI-Team",
    title: "Deine kreative Intelligenz",
    description:
      "Sechs Agenten, auf deine Marke ausgerichtet — einer aktiv, fünf in Vorbereitung.",
    currentFocus: "Aktueller Fokus",
    nextObjective: "Nächstes Ziel",
    priority: "Priorität",
  },
  intelligence: {
    label: "Intelligence",
    title: "Signale & Chancen",
  },
  brainViz: {
    label: "NexHQ Wissensspeicher",
    title: "Das Herz deiner Marke",
    description:
      "Lebendiges Wissen — Markengedächtnis, Design-Intelligenz und Marktkontext an einem Ort.",
    exploreBrain: "Wissensspeicher erkunden",
    knowledgeEntries: "Wissenseinträge",
    synced: "synchronisiert",
  },
  pulses: {
    brandHealth: {
      label: "Markengesundheit",
      value: "Stark",
      detail: "Stimme & visuelle Kohärenz auf Kurs",
    },
    activeProjects: {
      label: "Aktive Projekte",
      value: "2",
      detail: "SS26 Capsule · VIP Relaunch",
    },
    aiTeam: {
      label: "KI-Team-Status",
      value: "Online",
      detail: "CEO aktiv · 5 Agenten geplant",
    },
    alerts: {
      label: "Kritische Hinweise",
      value: "1",
      detail: "Sommer-Drop-Zeitplan muss geprüft werden",
    },
  },
  suggestedActions: {
    researchTrends: {
      label: "Sommertrends recherchieren",
      description: "Kultursignale für SS26-Positionierung scannen",
    },
    capsuleConcept: {
      label: "Neues Capsule-Konzept erstellen",
      description: "Richtungen für den nächsten Drop generieren",
    },
    reviewReports: {
      label: "Neueste Berichte prüfen",
      description: "2 Intelligence-Briefings warten auf dein Feedback",
    },
    contentPlan: {
      label: "Content-Plan erstellen",
      description: "3-wöchigen Drop-Narrativ-Bogen aufbauen",
    },
  },
  agentLive: {
    ceo: {
      currentFocus: "SS26-Capsule-Orchestrierung",
      nextTask: "Research-Briefing an Spezialisten-Warteschlange weiterleiten",
    },
    research: {
      currentFocus: "Wartet auf Aktivierung",
      nextTask: "Q2-Wettbewerber-Drop-Analyse",
    },
    designer: {
      currentFocus: "Wartet auf Aktivierung",
      nextTask: "Hero-Hoodie-Moodboards",
    },
    content: {
      currentFocus: "Wartet auf Aktivierung",
      nextTask: "Drop-Ankündigungstexte",
    },
    marketing: {
      currentFocus: "Kampagnenplan in Prüfung",
      nextTask: "VIP-E-Mail-Sequenz freigeben",
    },
    shopify: {
      currentFocus: "Wartet auf Aktivierung",
      nextTask: "SS26-Kollektion einrichten",
    },
  },
  intelligenceFeed: {
    int1: {
      title: "Y2K-Texturen trenden auf TikTok",
      insight:
        "Abstrakte City-Grunge-Overlays gewinnen an Traktion — subtiler Hinweis in SS26-Grafiken empfohlen, kein wörtliches Retro.",
      time: "vor 12 Min.",
    },
    int2: {
      title: "Signalgrün gewinnt Anteil bei EU-Drops",
      insight:
        "Corteiz und Represent nutzten Akzentgrün in jüngsten Capsules. Markenpalette bereits abgestimmt.",
      time: "vor 1 Std.",
    },
    int3: {
      title: "Wettbewerber-Drop-Fenster verkürzt sich",
      insight:
        "Top-5-Streetwear-Marken im Schnitt 48h Sell-through-Fenster. SS26-Countdown ggf. straffen.",
      time: "vor 2 Std.",
    },
    int4: {
      title: "VIP-Öffnungsraten über Benchmark",
      insight:
        "Letzte Drop-E-Mail 43 % Öffnungsrate. Zielgruppe reagiert auf minimalen Insider-Ton — Knappheitssprache nutzen.",
      time: "vor 4 Std.",
    },
    int5: {
      title: "Oversized-Silhouetten weiter dominant",
      insight:
        "Boxy Tees und Wide-Leg-Cargos bleiben Kategorie-Bestseller. SS26-Lineup bestätigt.",
      time: "vor 6 Std.",
    },
  },
  brainNodes: {
    brand: "Markenwissen",
    design: "Design-Gedächtnis",
    competitor: "Wettbewerber-Intelligence",
    content: "Content-Intelligence",
    marketing: "Marketing-Intelligence",
  },
} as const;
