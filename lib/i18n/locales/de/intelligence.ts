import type { ConfidenceScoreId } from "@/lib/research-intelligence/types/confidence";

export const intelligence = {
  scores: {
    trend_confidence: "Trend-Konfidenz",
    commercial_confidence: "Kommerzielle Konfidenz",
    brand_fit_confidence: "Brand-Fit-Konfidenz",
    source_agreement: "Quellenübereinstimmung",
    source_diversity: "Quellenvielfalt",
    saturation_risk: "Sättigungsrisiko",
    novelty: "Originalität",
    longevity: "Langlebigkeit",
    seasonality: "Saisonalität",
    launch_readiness: "Launch-Bereitschaft",
  } satisfies Record<ConfidenceScoreId, string>,
  tiers: {
    low: "gering",
    medium: "mittel",
    high: "hoch",
    verified: "verifiziert",
  },
  roles: {
    commercial_truth: "kommerzielle Referenz",
    social_momentum: "Social Momentum",
    commerce_validation: "Commerce-Validierung",
    search_demand: "Suchnachfrage",
    consumer_voice: "Verbraucherstimme",
    editorial_cultural: "Editorial & Kultur",
  },
  insights: {
    trendSignal: "Trendsignal",
    marketDemand: "Marktnachfrage",
  },
  report: {
    titleDefault: "Research Intelligence Bericht",
    titleLimited: "Research Intelligence — begrenzte Abdeckung",
    weakExecutive:
      "Die aktuelle Datenlage ist noch begrenzt. Zusätzliche Quellen erhöhen die Zuverlässigkeit der Empfehlungen.",
    opportunityDetail:
      "Gewichteter Chancen-Score {score}/100 über {sources} Quelle(n).",
    evidenceLine: "{label} ({direction}, Beitrag {contribution})",
    directionLabels: {
      supports: "stützt",
      contradicts: "widerspricht",
      neutral: "neutral",
    },
  },
  risks: {
    marketSaturation: "Marktsättigung",
    sourceDisagreement: "Quellenwiderspruch",
    brandMisalignment: "Milaene Brand-Abweichung",
    weakCommercial: "Schwache kommerzielle Bestätigung",
    shortLivedTrend: "Kurzlebiges Trendrisiko",
  },
  reasoning: {
    emptyTrendLandscape: "Keine Trendlandschaft erkannt — Intelligence-Feed ist leer.",
    risingClusters:
      "{count} aufstrebende Trend-Cluster zeigen Richtungsmomentum{terms}.",
    trendConfidenceHigh:
      "Trend-Konfidenz ist {tier} ({score}/100) — mehrere Quellen bestätigen dieselbe Richtung.",
    trendConfidencePartial:
      "Trend-Konfidenz ist {tier} ({score}/100) — Momentum vorhanden, aber quellenübergreifende Bestätigung nur teilweise.",
    decliningDominant:
      "Abnehmende Cluster ({declining}) überwiegen aufstrebende Signale — die Trendlandschaft könnte sich wegdrehen.",
    opportunityTerms: "Chancen-Begriffe: {terms}.",
    sourceConfirms:
      "{provider} bestätigt Momentum bei {terms} als {role}.",
    sourceContributes:
      "{provider} liefert {count} unterstützende Signale als {role}.",
    sourceDiverges:
      "{provider} weicht ab bei {terms} — Richtungskonflikt mit anderen Quellen.",
    sourceContributed:
      "{provider} hat {count} Signale als {role} beigetragen.",
    brandFitInsufficient: "Unzureichende Daten für eine Milaene Brand-Fit-Bewertung.",
    brandFitAligned:
      "Trendlandschaft passt zur Quiet-Luxury- und Archive-Streetwear-DNA von {brand} — {count} bestätigende Signale.",
    brandFitTension:
      "Trendlandschaft zeigt Spannung zur {brand}-Positionierung — {misaligned} abweichende vs. {aligned} passende Signale.",
    scoreEvidence:
      "{label} (Gewicht {weight}, Beitrag {contribution}, {direction})",
    noProviders:
      "Research-Director-Auswertung abgeschlossen — keine Provider-Daten zur Analyse.",
    fusedSummary:
      "Fusionierte Intelligence aus {providers} Provider(n) ergibt {tier} Gesamtkonfidenz ({score}/100).",
    confirmingSources: "Stärkste bestätigende Quellen: {summaries}.",
    keyRisks: "Hauptrisiken: {risks}.",
    noElevatedRisks: "Keine erhöhten Risikoflaggen in dieser Bewertungsrunde.",
    launchReadinessNote:
      "Launch-Bereitschaft bei {score}/100 ({tier}) bewertet — reine Scoring-Aussage, keine Go-to-Market-Empfehlung.",
  },
  recommendations: {
    expandCoverage: "Quellenabdeckung vor kreativer Umsetzung erweitern",
    expandWhyWeak:
      "Gesamtkonfidenz ist {tier} ({score}/100) — die Evidenz ist zu dünn für starke kreative oder kommerzielle Entscheidungen.",
    expandWhyGaps:
      "Gezielte Quellenlücken bestehen — Validierung vor Festlegung der Richtung stärken.",
    expandNextStep:
      "Mindestens drei Quellentypen (Commerce, Social, Search) ergänzen, bevor gehandelt wird.",
    sourceGapWhy: "Quellenvielfalt oder -übereinstimmung zeigt Validierungslücken.",
    reconcileBeforeCapsule:
      "Widersprüchliche Signale abgleichen, bevor über eine Test-Kapsel hinaus skaliert wird.",
    connectShopify: "Shopify verbinden für kommerzielle Referenz-Baseline.",
    enableGoogleTrends: "Google Trends aktivieren für Suchnachfrage-Validierung.",
    addSocialSources: "TikTok oder Pinterest für Social-Momentum-Abdeckung hinzufügen.",
    reconcileSources:
      "Widersprüchliche Quellen bei gemeinsamen Trend-Begriffen abgleichen.",
    overallConfidenceEvidence: "Gesamtkonfidenz {score}/100",
    providersFused: "{count} Provider fusioniert",
    sourceDiversityEvidence: "Quellenvielfalt {score}/100",
    exploreDesign: '"{label}" als Designrichtung untersuchen',
    designWhy:
      'Starke Trendbestätigung für „{label}" — passt zur aktuellen Markenlage von Milaene.',
    designNextStrong:
      'Design Studio mit „{label}" briefen und Brand-Guardrails aus den Research-Belegen übernehmen.',
    designNextWeak:
      '„{label}" beobachten und weitere bestätigende Quellen sammeln, bevor Design Studio startet.',
    productCommercialWhy:
      "{rationale} Kommerzielle Konfidenz: {tier} ({score}/100).",
    productValidateSku: "Wirtschaftlichkeit der SKU prüfen und Shopify-Sortiment abstimmen.",
    productMonitor: "Abverkauf beobachten und auf stärkere kommerzielle Bestätigung warten.",
    productSignalTitle: "Produktsignal: {label}",
    productSignalWhy:
      "Gewichtetes Handelssignal ({score}/100) über {source}: {headline}",
    productCrossRef: "Mit Shopify-Katalog abgleichen, bevor Sortimentsentscheidungen getroffen werden.",
    collectionTitle: "{anchor}-Kollektionskonzept — {alignment} Kapsel",
    collectionAligned: "markenkonforme",
    collectionCaution: "vorsichtige",
    collectionWhy:
      'Originalität ({novelty}/100) und Brand Fit ({brandFit}/100) stützen ein Kapselkonzept um „{anchor}". {summary}',
    collectionCapsuleBrief:
      "Kapsel-Briefing mit Silhouette, Farbe und grafischer Zurückhaltung an Milaene-DNA ausrichten.",
    colorPaletteTitle: "Farbpalette: {colors}",
    colorPaletteWhy:
      "Mehrere Quellen zeigen eine Farbkonvergenz bei {count} Tönen — Trend-Konfidenz: {tier}.",
    colorNextStep:
      "Palette in Garn-/Druckmuster übersetzen und gegen Milaene-Neutral-Baseline validieren.",
    colorSaturationRisk:
      "Palette könnte am Markt bereits gesättigt sein — über Material oder Platzierung differenzieren.",
    typographyTitle: "Typografie-Richtung für diesen Intelligence-Zyklus",
    typographyWhy:
      "Brand Fit ({score}/100) und passende Ästhetik deuten auf: {direction}",
    typographyNext: "Typografie-Paarung in Design Studio an Hero-Artwork testen.",
    graphicTitle: "Grafikrichtung: {theme}",
    graphicWhy:
      "Trend- und Markensignale stützen diese Grafikrichtung — Originalität: {tier}.",
    graphicNext:
      "Zwei bis drei Platzierungsvarianten unter Milaene-Zurückhaltungsregeln prototypen.",
    graphicDefault: "Texturgeführtes Grafiksystem mit moderierter Brand-Fit",
    launchTitle: "Veröffentlichungszeitpunkt",
    launchAlignCalendar:
      "Drop-Kalender mit saisonalem Peak abstimmen und Lieferzeiten prüfen.",
    launchMonitor:
      "Weiter beobachten — kein festes Launch-Datum, bis Bereitschaft und Saisonalität steigen.",
    riskTitle: "Risiko: {label}",
    riskPause: "Downstream-Aktionen pausieren, bis das Risiko entschärft oder widerlegt ist.",
    riskTrack: "Risikoindikatoren beim nächsten Research-Sync verfolgen.",
    summaryEmpty:
      "Keine umsetzbaren Empfehlungen — zuerst Research-Quellen erweitern.",
    summaryGenerated:
      "{count} Empfehlungen ({act} sofort, {monitor} beobachten, {explore} erkunden) bei {tier} Gesamtkonfidenz.",
    caveatInsufficient:
      "Unzureichende fusionierte Daten — Empfehlungen fokussieren auf Quellenerweiterung.",
    caveatDeterministic:
      "Empfehlungen sind deterministische Scoring-Ausgaben — keine finalen Geschäftsentscheidungen.",
    misalignedCue: "Abweichendes Signal: {signal}",
    brandTension: "Markenspannung: {signals}",
    weightedTerm: 'Gewichteter Chancen-Begriff „{term}"',
    weightedScore: "Gewichteter Score {score}/100",
    trendClusterScore: 'Trend-Cluster „{label}" — Score {score}',
    alignedSignals: "Passende Signale: {signals}",
    colorSignal: 'Farbsignal „{color}" ({score}/100)',
    collectionConcept: "{anchor}-Kollektionskonzept",
  },
  typography: {
    minimalGrotesk: "Verfeinerte Grotesk mit großzügiger Spationierung — ruhige Hierarchie",
    archiveSerif: "Editoriale Serif mit zurückhaltender Sans — Archive-Luxus-Ton",
    condensedSans: "Kondensierte Bold-Sans für Headlines mit klarer Body-Grotesk",
    humanistSerif: "Humanistische Serif mit subtiler Kontrastführung — craft-forward editorial",
  },
  graphic: {
    emblem: "Mikro-Emblem und zurückhaltende Symbolsprache",
    archive: "Archive-Grafikmarken mit kontrollierter Textur",
    minimal: "Grafische Zurückhaltung mit negativem Raum — ein Fokusmarken",
    streetwear: "Platzierungsstarke Grafik mit kontrollierter Dichte",
    abstract: "Abstraktes texturgeführtes Grafiksystem mit moderierter Brand-Fit",
  },
  launch: {
    aligned: "Saisonale Nachfrage und Launch-Bereitschaft stimmen überein — Fenster für einen nahen Drop.",
    phased: "Saisonaler Rahmen mit langlebiger Tragfähigkeit — phasierter Launch über die Saison.",
    weakSeason: "Saisonalitätssignal schwach — Launch-Timing erst nach Klarheit festlegen.",
    provisional: "Launch-Timing vorläufig — saisonale Signale weiter beobachten.",
  },
  executive: {
    whatFound: "Was wurde gefunden?",
    whyInteresting: "Warum ist es interessant?",
    milaeneFit: "Passt es zu Milaene?",
    shouldAct: "Sollte gehandelt werden?",
    weakData:
      "Die aktuelle Datenlage ist noch begrenzt. Zusätzliche Quellen erhöhen die Zuverlässigkeit der Empfehlungen.",
    trendRising: "Die Recherche zeigt steigende Nachfrage nach {terms}.",
    shopifyConfirms: "Shopify bestätigt bereits Verkäufe ähnlicher Produkte.",
    googleTrendsConfirms: "Google Trends zeigt zunehmendes Suchinteresse.",
    multiSource: "Mehrere Quellen unterstützen diese Richtung.",
    brandAligned: "Die Richtung passt sehr gut zur Milaene-DNA.",
    brandPartial: "Die Richtung ist teilweise markenkonform — Anpassungen empfohlen.",
    brandWeak: "Die Markenpassung ist noch unscharf — vor Umsetzung validieren.",
    actNow: "Empfehlung: Richtung im Design Studio weiterentwickeln.",
    observe: "Empfehlung: weiter beobachten und Quellenabdeckung stärken.",
    avoid: "Empfehlung: diese Richtung vorerst nicht verfolgen.",
    developExample:
      "Die aktuelle Recherche zeigt eine steigende Nachfrage nach minimalistischen Heavyweight-Produkten. Shopify bestätigt bereits Verkäufe ähnlicher Produkte. Google Trends zeigt zunehmendes Suchinteresse. Die Empfehlung lautet, diese Richtung im Design Studio weiterzuentwickeln.",
  },
  sourceQuality: {
    title: "Vertrauensniveau",
    notConnected: "Nicht verbunden",
    stars: "{filled} von 5",
  },
  priority: {
    develop: "Sofort entwickeln",
    watch: "Beobachten",
    reject: "Verwerfen",
  },
  human: {
    googleTrendsRising: "Google Trends bestätigt eine steigende Nachfrage.",
    shopifySales: "Shopify bestätigt bereits Verkäufe.",
    multiSourceSupport: "Mehrere Quellen unterstützen diese Richtung.",
    milaeneDnaFit: "Diese Designrichtung passt sehr gut zur Milaene-DNA.",
    catalogGap: "Lücke im Sortiment erkannt: {gap}",
    weightedCommerce: "Gewichtetes Handelssignal über {source}",
    supportsMilaene: "Unterstützt Milaene",
  },
  confidence: {
    noData: "Keine Intelligence-Daten verfügbar.",
    noCommercial: "Keine kommerziellen Intelligence-Daten verfügbar.",
    noProvidersBaseline:
      "Keine Provider-Intelligence fusioniert — Konfidenz-Scores auf Baseline null.",
    limitedSourceDiversity:
      "Begrenzte Quellenvielfalt — die Bewertung stützt sich auf wenige Provider.",
    sourceDisagreement:
      "Quellenübergreifende Richtungsabweichungen mindern die Aussagesicherheit.",
    elevatedSaturation:
      "Erhöhtes Sättigungsrisiko — der Trend könnte bereits breit adressiert sein.",
    shopifyAbsent:
      "Shopify-Referenz fehlt — kommerzielle Konfidenz basiert nur auf Proxy-Quellen.",
    simulatedProviders:
      "{count} simulierte(r) Provider enthalten — Live-Bestätigung kann abweichen.",
    disagreeingSources:
      "{count} Quelle(n) zeigen Richtungswiderspruch — Details unter abweichende Quellen prüfen.",
    trendMomentumRising:
      "Trend-Momentum ist {tier} — {rising} aufstrebende Cluster überwiegen {declining} abnehmende.",
    trendMomentumLimited:
      "Trend-Momentum ist {tier} — begrenzte Aufwärtsbestätigung gegenüber {declining} abnehmenden Clustern.",
    commercialWithShopify:
      "Kommerzielle Konfidenz ist {tier} — Shopify als höchstgewichtete kommerzielle Referenzquelle.",
    commercialWithoutShopify:
      "Kommerzielle Konfidenz ist {tier} auf Basis von Marktplatz- und Nachfrage-Proxys — Shopify-Referenz fehlt.",
    launchReadinessComposite:
      "Launch-Bereitschaft ist {tier} als Komposit aus Trend-, Commerce-, Brand-Fit-, Übereinstimmungs-, Vielfalts- und Sättigungssignalen — keine finale Empfehlung.",
    domainFactor: "Beitrag {contribution} ({direction})",
    evidence: {
      risingClusters: "{count} aufstrebende Trend-Cluster",
      positiveSignals: "{count} positive Richtungssignale",
      negativeSignals: "{count} negative Richtungssignale",
      shopifySignals: "{count} Shopify-Referenzsignale",
      demandIndicators: "{count} Nachfrageindikatoren",
      productInsights: "{count} Produkt-Insights",
      commerceValidation: "{count} Commerce-Validierungssignale",
      launchComposite: "Komposit aus Trend-, Commerce- und Brand-Fit-Konfidenz",
      agreementDiversity: "Übereinstimmungs- und Vielfaltsmodifikatoren",
      saturationHeadroom: "Sättigungsspielraum ({headroom})",
    },
  },
  brand: {
    insufficientSignals:
      "Unzureichende brandkonforme Signale im aktuellen Intelligence-Zyklus.",
  },
} as const;

export type IntelligenceCopy = typeof intelligence;
