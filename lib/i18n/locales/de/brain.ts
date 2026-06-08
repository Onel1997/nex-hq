export const brain = {
  page: {
    title: "NexHQ Wissensspeicher",
    description:
      "Das lebendige Gedächtnis deines Workspaces — Vision, Design, Wettbewerber und Strategie an einem Ort.",
  },
  knowledgeIndex: "Wissensindex",
  domainsEntries: "{domains} Domänen · {entries} Einträge",
  sharedContext: "Gemeinsamer Kontext · für alle Agenten zugänglich",
  stats: {
    status: "Status",
    domains: "Domänen",
    synced: "Synchronisiert",
    entries: "Einträge",
  },
  sections: {
    brand_vision: {
      title: "Markenvision",
      subtitle: "Nordstern, Positionierung und kulturelle Identität",
      entries: {
        mission: {
          label: "Mission",
          value:
            "{workspace} ist eine Streetwear-Marke für urbane Kreative, die zwischen Kultur, Kunst und Stadt leben — aufgebaut auf Knappheit, Story und visueller Identität.",
        },
        positioning: {
          label: "Positionierung",
          value:
            "Premium-zugängliche Streetwear. Limitierte Drops, kein Fast Fashion. Jedes Stück erzählt ein Kapitel.",
        },
        pillars: {
          label: "Markensäulen",
          value:
            "Kultur zuerst · Drop-Kadenz · Visuelle Kohärenz · Community-Knappheit",
        },
        voiceTone: {
          label: "Stimme & Ton",
          value:
            "Selbstbewusst, minimal, kulturell versiert. Nie aufdringlich. Wie ein Insider sprechen, nicht wie ein Marketer.",
        },
      },
    },
    target_audience: {
      title: "Zielgruppe",
      subtitle: "Für wen wir bauen und wie sie sich bewegen",
      entries: {
        primary: {
          label: "Primäres Segment",
          value:
            "Urbane Kreative 18–30 — Fotografen, Musiker, Designer und kulturaffine Studierende in Großstädten.",
        },
        psychographics: {
          label: "Psychografie",
          value:
            "Authentizität vor Hype. Underground vor Mainstream. Kauft Drops, keine Kataloge.",
        },
        geography: {
          label: "Geografie",
          value:
            "NYC, LA, London, Tokio — mit sekundärer Reichweite über Instagram- und TikTok-Kultur.",
        },
        purchase: {
          label: "Kaufverhalten",
          value:
            "Mobile-first. Reagiert auf Knappheit und Story. Durchschnittlicher Warenkorb: 120–280 $. Wiederholungskäufer innerhalb von 2 Drops.",
        },
      },
    },
    design_rules: {
      title: "Designregeln",
      subtitle: "Visuelles System und Produkt-Leitplanken",
      entries: {
        palette: {
          label: "Farbpalette",
          value:
            "Kern: Obsidian-Schwarz, Off-White, Betongrau. Akzent: Signalgrün (nur Drops). Kein Neon-Overload.",
        },
        typography: {
          label: "Typografie",
          value:
            "Headlines: fette Grotesk. Body: klare Sans. Logo-Lockup nie gestreckt oder außerhalb des Brand Sheets eingefärbt.",
        },
        silhouettes: {
          label: "Produktsilhouetten",
          value:
            "Oversized Hoodies, Boxy Tees, Wide-Leg-Cargos, strukturierte Caps. Keine Skinny Fits.",
        },
        graphics: {
          label: "Grafikbehandlung",
          value:
            "Minimale Wordmarks, abstrakte Stadttexturen, limitierte Edition-Nummerierung auf Capsule-Pieces.",
        },
      },
    },
    competitors: {
      title: "Wettbewerber",
      subtitle: "Marktlandschaft und Differenzierung",
      entries: {
        tier1: {
          label: "Tier 1 — Direkt",
          value:
            "Corteiz, Represent, Fear of God Essentials (Streetwear-Lane), Palace — drop-geführte, kultur-native Marken.",
        },
        tier2: {
          label: "Tier 2 — Aspirational",
          value:
            "Off-White (Legacy), Stüssy, Aime Leon Dore — Referenzpunkte für Qualität und Storytelling.",
        },
        edge: {
          label: "Wettbewerbsvorteil",
          value:
            "Engere Drops, stärkere visuelle Narrative pro Capsule, KI-beschleunigte Ops ohne Verlust menschlicher Kreativkontrolle.",
        },
        watch: {
          label: "Watchlist",
          value:
            "Syna World, No Faith Studios, Denim Tears — Drop-Kadenz und Community-Engagement beobachten.",
        },
      },
    },
    content_strategy: {
      title: "Content-Strategie",
      subtitle: "Kanäle, Formate und Narrativ-Bogen",
      entries: {
        channels: {
          label: "Primärkanäle",
          value:
            "Instagram (Hero), TikTok (Kultur), E-Mail (VIP-Liste), Site (kanonisch)",
        },
        narrative: {
          label: "Drop-Narrativ-Bogen",
          value:
            "Tease (7 Tage) → Reveal (3 Tage) → Countdown (48 Std.) → Drop → Sell-through-Story (24 Std. danach)",
        },
        pillars: {
          label: "Content-Säulen",
          value:
            "Behind-the-Design · Stadtkultur · Produktdetail · Community-Spotlight",
        },
        copyRules: {
          label: "Copy-Regeln",
          value:
            "Kurze Sätze. Kein Ausrufezeichen-Spam. Produktnamen immer großgeschrieben. Drop-Daten in lokaler Zeit.",
        },
      },
    },
    marketing_strategy: {
      title: "Marketing-Strategie",
      subtitle: "Wachstum, Kampagnen und Akquise",
      entries: {
        acquisition: {
          label: "Akquise",
          value:
            "Organic-first über IG/TikTok. Paid Retargeting nur auf warme Zielgruppen nach Drop-Tease.",
        },
        vip: {
          label: "VIP-Liste",
          value:
            "Early Access 2 Stunden vor öffentlichem Drop. Ziel: 15 % Umsatz von wiederkehrenden VIP-Käufern.",
        },
        calendar: {
          label: "Kampagnenkalender",
          value:
            "4 Major Drops/Jahr · 2 Capsule-Releases/Quartal · 1 Collaboration-Slot reserviert",
        },
        kpis: {
          label: "KPIs",
          value:
            "Sell-through-Rate >85 % · E-Mail-Öffnung >40 % · IG-Save-Rate >5 % bei Drop-Posts",
        },
      },
    },
  },
} as const;
