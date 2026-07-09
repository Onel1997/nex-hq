export const content = {
  page: {
    title: "Content-Agent",
    description:
      "Veröffentlichungsreife Inhalte für Milaene — Landing Page, Produkt-Copy, E-Mail, Social und SMS auf Basis von CEO-, Design-, Marketing- und Shopify-Berichten.",
  },
  interface: {
    label: "Content-Briefing",
    headline: "Welche Inhalte sollen erstellt werden?",
    placeholder:
      "z. B. Erstelle veröffentlichungsreife Copy für die SS26 Capsule — Landing Page, E-Mails, Social und SMS …",
    submit: "Content-Paket erstellen",
    running: "Content-Agent erstellt Inhalte …",
    poweredBy:
      "Content-Agent · Nutzt CEO-, Design-, Marketing- und Shopify-Berichte",
    tryExamples: "Beispiel-Briefings",
    success: "Content-Paket erstellt und gespeichert",
    brandNarrative: "Brand Narrative",
    landingPage: "Landing Page",
    heroHeadline: "Hero-Headline",
    heroSubheadline: "Hero-Subheadline",
    brandStory: "Brand Story",
    collectionIntroduction: "Kollektionseinführung",
    cta: "Call-to-Action",
    productCopy: "Produkt-Copy",
    productCount: "{count} Produkte",
    emailSequence: "E-Mail-Sequenz",
    teaserEmail: "Teaser-E-Mail",
    revealEmail: "Reveal-E-Mail",
    countdownEmail: "Countdown-E-Mail",
    launchEmail: "Launch-E-Mail",
    socialContent: "Social Content",
    instagramCaptions: "Instagram-Captions",
    tiktokHooks: "TikTok-Hooks",
    storyIdeas: "Story-Ideen",
    launchPosts: "Launch-Posts",
    smsCampaign: "SMS-Kampagne",
    teaserSms: "Teaser-SMS",
    countdownSms: "Countdown-SMS",
    launchSms: "Launch-SMS",
    sources: "Genutzte Berichte",
    confidence: "Konfidenz",
    contextRecords: "{count} Wissensspeicher-Einträge als Kontext geladen",
    viewReports: "Berichte ansehen",
    moreCaptions: "+{count} weitere Captions im gespeicherten Bericht",
  },
  examples: {
    ss26Content:
      "Erstelle veröffentlichungsreife Copy für die Milaene SS26 Capsule",
    landingPage:
      "Schreibe Landing-Page-Copy basierend auf Shopify- und Design-Berichten",
    emailSocial:
      "Erstelle E-Mail-Sequenz und Social Content aus Marketing- und CEO-Berichten",
    productDescriptions:
      "Verfasse Produktbeschreibungen für alle SKUs aus dem Shopify-Bericht",
  },
  errors: {
    noResponse: "Keine Antwort vom Content-Agenten erhalten.",
    noKnowledge:
      "CEO-, Design-, Marketing- oder Shopify-Berichte fehlen. Erstelle zuerst alle primären Intelligence-Berichte.",
    supabaseNotConfigured:
      "Supabase ist nicht konfiguriert. Brain-Persistenz erforderlich.",
    openaiNotConfigured:
      "OpenAI ist nicht konfiguriert. OPENAI_API_KEY in .env.local hinzufügen.",
    invalidRequest: "Ungültige Anfrage",
    unexpected: "Ein unerwarteter Fehler ist aufgetreten",
  },
} as const;
