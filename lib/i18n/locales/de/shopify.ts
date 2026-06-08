export const shopify = {
  page: {
    title: "Shopify-Agent",
    description:
      "Storefront-Entwürfe auf Basis von Design- und Marketing-Berichten — Produktlistings, Kollektionen, SEO und Launch-Checkliste.",
  },
  interface: {
    label: "Shopify-Briefing",
    headline: "Welche Storefront soll vorbereitet werden?",
    placeholder:
      "z. B. Erstelle Shopify-Produktentwürfe für die SS26 Capsule basierend auf Design- und Marketing-Berichten …",
    submit: "Storefront-Entwurf erstellen",
    running: "Shopify-Agent erstellt Storefront-Entwurf …",
    poweredBy:
      "Shopify-Agent · Nutzt Design-, Marketing-, CEO- und Research-Berichte",
    tryExamples: "Beispiel-Briefings",
    success: "Storefront-Entwurf erstellt und gespeichert",
    collectionName: "Kollektion",
    collectionDescription: "Kollektionsbeschreibung",
    collectionSeo: "Kollektions-SEO",
    products: "Produktentwürfe",
    productCount: "{count} Produkte",
    collectionsToCreate: "Kollektionen anlegen",
    navigationRecommendations: "Navigation",
    homepageRecommendations: "Homepage",
    launchChecklist: "Launch-Checkliste",
    storefrontWarnings: "Storefront-Warnungen",
    sources: "Genutzte Berichte",
    confidence: "Konfidenz",
    contextRecords: "{count} Wissensspeicher-Einträge als Kontext geladen",
    viewReports: "Berichte ansehen",
    price: "Preis",
    compareAtPrice: "Vergleichspreis",
    inventory: "Bestand",
    variants: "Varianten",
    tags: "Tags",
    materials: "Materialien",
    seoTitle: "SEO-Titel",
    seoDescription: "SEO-Beschreibung",
  },
  examples: {
    ss26Storefront:
      "Erstelle Shopify-Produktentwürfe für die Milaene SS26 Capsule aus Design- und Marketing-Berichten",
    hoodieDrop:
      "Bereite den Hoodie-Drop als Shopify-Storefront mit SEO und Varianten vor",
    collectionLaunch:
      "Lege die Kollektion mit Navigation und Homepage-Empfehlungen an",
    pricingSync:
      "Synchronisiere Produktpreise und Bestände aus Pricing- und CEO-Berichten",
  },
  errors: {
    noResponse: "Keine Antwort vom Shopify-Agenten erhalten.",
    noKnowledge:
      "Design- und Marketing-Berichte fehlen. Erstelle zuerst ein Kollektionskonzept und einen Kampagnenplan.",
    supabaseNotConfigured:
      "Supabase ist nicht konfiguriert. Brain-Persistenz erforderlich.",
    openaiNotConfigured:
      "OpenAI ist nicht konfiguriert. OPENAI_API_KEY in .env.local hinzufügen.",
    invalidRequest: "Ungültige Anfrage",
    unexpected: "Ein unerwarteter Fehler ist aufgetreten",
  },
} as const;
