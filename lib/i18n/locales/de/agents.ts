export const agents = {
  page: {
    title: "Agenten-Netzwerk",
    description:
      "Dein KI-Kreativteam — orchestriert vom CEO-Agenten, ausgerichtet auf die Vision deines Workspaces.",
  },
  overview: {
    total: "Agenten gesamt",
    active: "Aktiv",
    planned: "Geplant",
  },
  specialistAgents: "Spezialisten-Agenten",
  capabilities: "Fähigkeiten",
  responsibilities: "Verantwortlichkeiten",
  catalog: {
    ceo: {
      name: "CEO-Agent",
      role: "Master-Orchestrator",
      description:
        "Zentrale Intelligenz, die Markenziele zerlegt, Arbeit an Spezialisten weiterleitet und Ergebnisse zur Freigabe zusammenführt.",
      capabilities: [
        "Zielzerlegung",
        "Aufgaben-Routing",
        "Berichtssynthese",
        "Eskalationsmanagement",
        "Wissensspeicher-Kontextabruf",
      ],
      responsibilities: [
        "Gründer-Intent in ausführbare Aufgaben-Warteschlangen übersetzen",
        "Kohärenz über alle Agenten-Outputs hinweg sicherstellen",
        "Trade-offs für menschliche Entscheidungen sichtbar machen",
        "Drop- und Kampagnen-Workflows End-to-End orchestrieren",
      ],
    },
    research: {
      name: "Research-Agent",
      role: "Markt-Intelligence",
      description:
        "Kulturelles Radar für Streetwear — Trends, Wettbewerber und Drop-Chancen, bevor sie ihren Peak erreichen.",
      capabilities: [
        "Trend-Scanning",
        "Wettbewerbsanalyse",
        "Drop-Timing-Signale",
        "Zielgruppen-Insight-Berichte",
      ],
      responsibilities: [
        "Streetwear- und Kultursignale wöchentlich überwachen",
        "Trend-Briefings für kommende Drops erstellen",
        "Wettbewerbs-Intelligence in den NexHQ Wissensspeicher einspeisen",
        "Positionierung basierend auf Marktlücken empfehlen",
      ],
    },
    designer: {
      name: "Designer-Agent",
      role: "Visuelles Design",
      description:
        "Visuelle Ideation nach Workspace-Designregeln — Konzepte, Moodboards und Asset-Richtung.",
      capabilities: [
        "Moodboard-Generierung",
        "Farbpaletten-Vorschläge",
        "Layout-Richtung",
        "Asset-Brief-Erstellung",
      ],
      responsibilities: [
        "Designkonzepte pro Drop-Capsule generieren",
        "Workspace-Designregeln aus dem Wissensspeicher durchsetzen",
        "Prüfbereite visuelle Richtungen vorbereiten",
        "Freigegebene Design-Historie im Wissensspeicher archivieren",
      ],
    },
    content: {
      name: "Content-Agent",
      role: "Copy & Storytelling",
      description:
        "Hüter der Markenstimme — Produkttexte, Drop-Narrative und kanalspezifische Botschaften.",
      capabilities: [
        "Produktbeschreibungen",
        "Drop-Ankündigungen",
        "Social-Copy-Varianten",
        "E-Mail- & SMS-Entwürfe",
      ],
      responsibilities: [
        "On-Brand-Copy für jedes Produkt und jeden Drop schreiben",
        "Botschaften pro Kanal anpassen (IG, Site, E-Mail)",
        "Stimmkonsistenz über Wissensspeicher-Vorlagen sicherstellen",
        "Copy vor Veröffentlichung zur Freigabe einreichen",
      ],
    },
    image: {
      name: "Image-Agent",
      role: "Visuelle Creative Direction",
      description:
        "AI Creative Director — verwandelt Design-, Content- und Marketing-Intelligence in Image-Generation-Projekte und visuelle Asset-Prompts.",
      capabilities: [
        "Moodboard-Prompts",
        "Produkt-Mockup-Prompts",
        "Campaign Visuals",
        "Social-Creative-Prompts",
        "Lookbook-Richtung",
      ],
      responsibilities: [
        "Design- und Content-Berichte in visuelle Asset-Briefings umwandeln",
        "Plattformspezifische Image-Prompts pro Drop generieren",
        "Visuelle Konsistenz über Wissensspeicher-Brand-Rules sicherstellen",
        "Prompt-Projekte im Wissensspeicher zur Prüfung speichern",
      ],
    },
    marketing: {
      name: "Marketing-Agent",
      role: "Kampagnenplanung",
      description:
        "Wachstumsstratege — Kampagnenkalender, Channel-Mix und Launch-Sequenzen für jeden Drop.",
      capabilities: [
        "Kampagnenplanung",
        "Channel-Mix-Optimierung",
        "Launch-Sequenzierung",
        "Ad-Copy-Briefings",
      ],
      responsibilities: [
        "Kampagnenkalender am Drop-Zeitplan ausrichten",
        "Timing mit Research- und Content-Agenten koordinieren",
        "Paid- und Organic-Growth-Briefings erstellen",
        "Kampagnen-Metadaten im NexHQ Wissensspeicher tracken",
      ],
    },
    shopify: {
      name: "Shopify-Agent",
      role: "Commerce-Operations",
      description:
        "Storefront-Betreiber — Listings, Collections, Inventar-Sync und Commerce-Gesundheitsmonitoring.",
      capabilities: [
        "Produktlisting-Entwürfe",
        "Collection-Management",
        "Inventar-Sync-Vorbereitung",
        "Storefront-Gesundheitschecks",
      ],
      responsibilities: [
        "Shopify-Listings aus freigegebenen Wissensspeicher-Assets vorbereiten",
        "Produktstatus zwischen Wissensspeicher und Storefront synchronisieren",
        "Inventar- und Listing-Anomalien melden",
        "Veröffentlichungen erst nach menschlicher Freigabe ausführen",
      ],
    },
  },
} as const;
