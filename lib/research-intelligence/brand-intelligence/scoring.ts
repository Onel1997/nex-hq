import { clampScore } from "../confidence/scoring-utils";
import {
  brandFitTierFromScore,
  MILAENE_BRAND_PROFILE,
  termIsNotRecommended,
  termMatchesHighMatch,
  termMatchesLowMatch,
  termMatchesMediumMatch,
} from "../confidence/brand-profile";
import type {
  BrandFitDimension,
  BrandFitTier,
  LaunchPriority,
  ScoredOpportunity,
  ShopifyLearningContext,
} from "./types";

const DIMENSION_WEIGHTS: Record<string, number> = {
  product: 0.15,
  color: 0.1,
  material: 0.12,
  typography: 0.08,
  graphic: 0.1,
  silhouette: 0.12,
  audience: 0.1,
  price: 0.1,
  luxury: 0.13,
  historical: 0.2,
};

const SHOPIFY_BONUSES = {
  bestseller: 20,
  category: 15,
  materials: 10,
  silhouette: 15,
  colorWorld: 10,
  brandPositioning: 15,
  googleTrends: 10,
  fashionNews: 5,
} as const;

const BRAND_FIT_REJECT_THRESHOLD = 40;

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function tokenize(text: string): string[] {
  return normalizeText(text)
    .split(/[^a-z0-9]+/i)
    .filter((token) => token.length >= 2);
}

function textContainsAny(text: string, terms: readonly string[]): string[] {
  const normalized = normalizeText(text);
  return terms.filter(
    (term) => normalized.includes(term) || term.includes(normalized),
  );
}

function scoreProductRelevance(text: string): BrandFitDimension {
  const hits = textContainsAny(text, MILAENE_BRAND_PROFILE.coreProducts);
  const highHits = textContainsAny(text, ["hoodie", "t-shirt", "tee", "oversized"]);
  const notRec = textContainsAny(text, MILAENE_BRAND_PROFILE.notRecommended);

  let score = 45;
  if (hits.length > 0) score = 92;
  else if (highHits.length > 0) score = 78;
  if (notRec.some((term) => /dress|jersey|cargo|kids|phone|decor|toy/i.test(term))) {
    score = clampScore(score - 45);
  }

  return {
    id: "product",
    label: "Produktrelevanz",
    score,
    rationale:
      hits.length > 0
        ? `Entspricht dem Milaene-Kernkatalog: ${hits.join(", ")}.`
        : highHits.length > 0
          ? `Angrenzend an Kern-Silhouetten (${highHits.join(", ")}) — gegen Oversized-Tee- und Heavyweight-Hoodie-Fokus validieren.`
          : notRec.length > 0
            ? `Außerhalb des aktuellen Produktkatalogs — ${notRec.slice(0, 2).join(", ")} ist keine Milaene-Kategorie.`
            : "Keine direkte Katalog-Überlappung — Chance erfordert ggf. neue SKU-Begründung.",
  };
}

function scoreColorRelevance(text: string): BrandFitDimension {
  const paletteHits = textContainsAny(text, MILAENE_BRAND_PROFILE.colorPalette);
  const lowHits = textContainsAny(text, ["neon", "color explosion", "rainbow", "bright"]);

  let score = paletteHits.length > 0 ? 70 + paletteHits.length * 6 : 52;
  if (lowHits.length > 0) score = clampScore(score - 35);

  return {
    id: "color",
    label: "Farb-Relevanz",
    score: clampScore(score),
    rationale:
      paletteHits.length > 0
        ? `Neutrale Milaene-Paletten-Ausrichtung: ${paletteHits.slice(0, 4).join(", ")}.`
        : lowHits.length > 0
          ? "Hochchromatische oder Neon-Signale widersprechen der monochromen Milaene-Zurückhaltung."
          : "Farbrichtung neutral — an Schwarz, Weiß, Grau, Creme oder Erdtöne ankern.",
  };
}

function scoreMaterialRelevance(text: string): BrandFitDimension {
  const fabricHits = textContainsAny(text, MILAENE_BRAND_PROFILE.fabricPreferences);
  const heavyHits = textContainsAny(text, ["heavyweight", "gsm", "fleece", "premium cotton"]);

  const score = fabricHits.length > 0 || heavyHits.length > 0 ? 82 : 48;

  return {
    id: "material",
    label: "Material-Relevanz",
    score,
    rationale:
      fabricHits.length > 0
        ? `Entspricht dem Milaene-Stoffstandard (${fabricHits.join(", ")}).`
        : heavyHits.length > 0
          ? `Heavyweight-Konstruktionssignale passen zur Premium-Streetwear-Positionierung.`
          : "Kein Materialsignal — Milaene standardmäßig 280–480 GSM Heavyweight-Blanks.",
  };
}

function scoreTypographyRelevance(text: string): BrandFitDimension {
  const hits = textContainsAny(text, MILAENE_BRAND_PROFILE.typographyTerms);
  const lowHits = textContainsAny(text, ["cartoon", "comic", "bubble", "script", "graffiti"]);

  let score = hits.length > 0 ? 75 + hits.length * 5 : 55;
  if (lowHits.length > 0) score = clampScore(score - 30);

  return {
    id: "typography",
    label: "Typografie-Relevanz",
    score: clampScore(score),
    rationale:
      hits.length > 0
        ? `Editoriale Typografie-Zurückhaltung erkannt.`
        : lowHits.length > 0
          ? "Verspielte oder Graffiti-Typografie widerspricht der Quiet-Luxury-Positionierung."
          : "Typografie nicht spezifiziert — kondensierte Sans mit editorialer Spationierung anwenden.",
  };
}

function scoreGraphicRelevance(text: string): BrandFitDimension {
  const hits = textContainsAny(text, MILAENE_BRAND_PROFILE.graphicTerms);
  const lowHits = textContainsAny(text, MILAENE_BRAND_PROFILE.lowMatch);

  let score = hits.length > 0 ? 78 + hits.length * 4 : 50;
  if (lowHits.length > 0) score = clampScore(score - 40);

  return {
    id: "graphic",
    label: "Grafik-Relevanz",
    score: clampScore(score),
    rationale:
      hits.length > 0
        ? `Grafische Zurückhaltung entspricht Milaene-Emblem und minimaler Print-Sprache.`
        : lowHits.length > 0
          ? `Laute Grafik-Signale (${lowHits.slice(0, 2).join(", ")}) schwächen die Markenidentität.`
          : "Grafikbehandlung undefiniert — Stickerei oder kleine Front-Platzierung bevorzugen.",
  };
}

function scoreSilhouetteRelevance(text: string): BrandFitDimension {
  const hits = textContainsAny(text, MILAENE_BRAND_PROFILE.silhouetteTerms);
  const notRec = textContainsAny(text, ["cargo", "wide leg", "dress", "jersey", "fitted"]);

  let score = hits.length > 0 ? 80 + hits.length * 4 : 48;
  if (notRec.length > 0) score = clampScore(score - 35);

  return {
    id: "silhouette",
    label: "Silhouetten-Relevanz",
    score: clampScore(score),
    rationale:
      hits.length > 0
        ? `Oversized-/Boxy-Silhouetten-Sprache entspricht Milaene-Fit-DNA.`
        : notRec.length > 0
          ? `Silhouette (${notRec[0]}) liegt außerhalb des Milaene-Fokus auf Oversized-Tee und Hoodie.`
          : "Silhouette nicht spezifiziert — standardmäßig Oversized-Drop-Shoulder-Konstruktion.",
  };
}

function scoreAudienceRelevance(text: string): BrandFitDimension {
  const hits = textContainsAny(text, MILAENE_BRAND_PROFILE.audienceTerms);
  const notRec = textContainsAny(text, ["kids", "children", "kawaii", "cosplay", "festival"]);

  let score = hits.length > 0 ? 72 + hits.length * 5 : 50;
  if (notRec.length > 0) score = clampScore(score - 45);

  return {
    id: "audience",
    label: "Zielgruppen-Relevanz",
    score: clampScore(score),
    rationale:
      notRec.length > 0
        ? `Zielgruppensignal (${notRec[0]}) liegt außerhalb des Milaene-Premium-Erwachsenen-Streetwear-Käufers.`
        : hits.length > 0
          ? "Zielt auf Premium-Archive-Streetwear-Käufer — ausgerichtet auf Milaene-Zielgruppe."
          : "Zielgruppensignal neutral — für Quiet-Luxury-Streetwear-Sammler positionieren.",
  };
}

function scorePricePositioning(text: string): BrandFitDimension {
  const premiumHits = textContainsAny(text, ["premium", "luxury", "elevated", "designer", "archive"]);
  const discountHits = textContainsAny(text, ["cheap", "fast fashion", "budget", "mass market", "disposable"]);

  let score = premiumHits.length > 0 ? 78 : 58;
  if (discountHits.length > 0) score = clampScore(score - 40);

  return {
    id: "price",
    label: "Preispositionierung",
    score,
    rationale:
      discountHits.length > 0
        ? "Fast-Fashion- oder Budget-Positionierung widerspricht der Milaene-Premium-Preisarchitektur."
        : premiumHits.length > 0
          ? "Premium-Preisband-Ausrichtung unterstützt Quiet-Luxury-Margenstruktur."
          : "Preispositionierung neutral — Milaene operiert im Premium-Streetwear-Segment.",
  };
}

function scoreLuxuryAlignment(text: string): BrandFitDimension {
  const hits = textContainsAny(text, MILAENE_BRAND_PROFILE.luxuryTerms);
  const conflicts = textContainsAny(text, [...MILAENE_BRAND_PROFILE.lowMatch, ...MILAENE_BRAND_PROFILE.notRecommended]);

  let score = hits.length > 0 ? 75 + hits.length * 5 : 52;
  if (conflicts.length > 0) score = clampScore(score - conflicts.length * 12);

  return {
    id: "luxury",
    label: "Luxus-Ausrichtung",
    score: clampScore(score),
    rationale:
      hits.length > 0
        ? `Quiet-Luxury-Signale (${hits.slice(0, 3).join(", ")}) verstärken die Milaene-Positionierung.`
        : conflicts.length > 0
          ? "Schwache Luxus-Ausrichtung — Trend-Signale wirken lauter als Milaene-Zurückhaltung erlaubt."
          : "Luxus-Ausrichtung moderat — Archive-Zurückhaltung vor Skalierung anwenden.",
  };
}

function scoreHistoricalSuccess(
  text: string,
  shopify: ShopifyLearningContext,
): BrandFitDimension {
  if (!shopify.loaded) {
    return {
      id: "historical",
      label: "Historischer Milaene-Erfolg",
      score: 50,
      rationale: "Shopify-Katalog nicht verfügbar — historisches Erfolgssignal neutral.",
    };
  }

  const normalized = normalizeText(text);
  const catalogCorpus = [
    ...shopify.bestsellerTitles,
    ...shopify.titles,
    ...shopify.tags,
    ...shopify.collectionNames,
  ]
    .map(normalizeText)
    .filter(Boolean);

  const tokens = tokenize(text);
  let overlap = 0;
  for (const token of tokens) {
    if (catalogCorpus.some((entry) => entry.includes(token))) {
      overlap += 1;
    }
  }

  const bestsellerOverlap = shopify.bestsellerTitles.filter((title) => {
    const norm = normalizeText(title);
    return tokens.some((token) => norm.includes(token)) || normalized.includes(norm);
  });

  let score = 45;
  if (bestsellerOverlap.length > 0) score = 88;
  else if (overlap >= 3) score = 72;
  else if (overlap >= 1) score = 62;

  return {
    id: "historical",
    label: "Historischer Milaene-Erfolg",
    score,
    rationale:
      bestsellerOverlap.length > 0
        ? `Überlappt mit bewährter Milaene-Bestseller-Sprache: ${bestsellerOverlap.slice(0, 2).join(", ")}.`
        : overlap > 0
          ? `Teilweise Katalog-Resonanz über ${overlap} Begriff(e) im aktuellen Shopify-Sortiment.`
          : "Keine Katalog-Überlappung — als unbewiesen für Milaene behandeln, bis gegen Shopify validiert.",
  };
}

function catalogCorpus(shopify: ShopifyLearningContext): string[] {
  return [
    ...shopify.bestsellerTitles,
    ...shopify.titles,
    ...shopify.tags,
    ...shopify.collectionNames,
    ...shopify.materials,
  ]
    .map(normalizeText)
    .filter(Boolean);
}

function applyBrandFitBonuses(
  text: string,
  shopify: ShopifyLearningContext,
  sourceKeys: string[],
): { scoreDelta: number; reasons: string[] } {
  const reasons: string[] = [];
  let scoreDelta = 0;
  const normalized = normalizeText(text);
  const tokens = tokenize(text);

  if (shopify.loaded) {
    const corpus = catalogCorpus(shopify);

    const bestsellerOverlap = shopify.bestsellerTitles.filter((title) => {
      const norm = normalizeText(title);
      return tokens.some((token) => norm.includes(token)) || normalized.includes(norm);
    });
    if (bestsellerOverlap.length > 0) {
      scoreDelta += SHOPIFY_BONUSES.bestseller;
      reasons.push(`Shopify-Bestseller-Überlappung: ${bestsellerOverlap.slice(0, 2).join(", ")}.`);
    }

    const categoryOverlap = shopify.collectionNames.filter((name) => {
      const norm = normalizeText(name);
      return tokens.some((token) => norm.includes(token)) || normalized.includes(norm);
    });
    if (categoryOverlap.length > 0) {
      scoreDelta += SHOPIFY_BONUSES.category;
      reasons.push(`Shopify-Kategorie vorhanden: ${categoryOverlap.slice(0, 2).join(", ")}.`);
    }

    const materialOverlap = shopify.materials.filter((material) =>
      normalized.includes(normalizeText(material)),
    );
    if (materialOverlap.length > 0) {
      scoreDelta += SHOPIFY_BONUSES.materials;
      reasons.push(`Gleiche Materialien im Katalog: ${materialOverlap.slice(0, 2).join(", ")}.`);
    }

    const silhouetteTerms = MILAENE_BRAND_PROFILE.silhouetteTerms;
    const silhouetteInCatalog = silhouetteTerms.some((term) =>
      corpus.some((entry) => entry.includes(term) && normalized.includes(term)),
    );
    if (silhouetteInCatalog) {
      scoreDelta += SHOPIFY_BONUSES.silhouette;
      reasons.push("Gleiche Silhouette bereits im Milaene-Sortiment.");
    }

    const paletteHits = textContainsAny(text, MILAENE_BRAND_PROFILE.colorPalette);
    const paletteInCatalog = paletteHits.some((color) =>
      corpus.some((entry) => entry.includes(normalizeText(color))),
    );
    if (paletteInCatalog) {
      scoreDelta += SHOPIFY_BONUSES.colorWorld;
      reasons.push("Gleiche Farbwelt im Shopify-Katalog bestätigt.");
    }

    const luxuryHits = textContainsAny(text, MILAENE_BRAND_PROFILE.luxuryTerms);
    const premiumInCatalog = luxuryHits.length > 0 || /premium|luxury|archive|quiet/i.test(normalized);
    if (premiumInCatalog && shopify.productCount > 0) {
      scoreDelta += SHOPIFY_BONUSES.brandPositioning;
      reasons.push("Gleiche Premium-Markenpositionierung wie Milaene.");
    }
  }

  if (sourceKeys.includes("google_trends")) {
    scoreDelta += SHOPIFY_BONUSES.googleTrends;
    reasons.push("Google Trends bestätigt Nachfrage.");
  }
  if (sourceKeys.includes("fashion_news")) {
    scoreDelta += SHOPIFY_BONUSES.fashionNews;
    reasons.push("Fashion News liefert kulturelle Bestätigung.");
  }

  return { scoreDelta, reasons };
}

export function computeBrandFitDimensions(
  text: string,
  shopify: ShopifyLearningContext,
): BrandFitDimension[] {
  return [
    scoreProductRelevance(text),
    scoreColorRelevance(text),
    scoreMaterialRelevance(text),
    scoreTypographyRelevance(text),
    scoreGraphicRelevance(text),
    scoreSilhouetteRelevance(text),
    scoreAudienceRelevance(text),
    scorePricePositioning(text),
    scoreLuxuryAlignment(text),
    scoreHistoricalSuccess(text, shopify),
  ];
}

export function computeBrandFitScore(dimensions: BrandFitDimension[]): number {
  let total = 0;
  let weightSum = 0;
  for (const dimension of dimensions) {
    const weight = DIMENSION_WEIGHTS[dimension.id] ?? 0.1;
    total += dimension.score * weight;
    weightSum += weight;
  }
  return clampScore(weightSum > 0 ? total / weightSum : 50);
}

export function tierFromScore(score: number): BrandFitTier {
  if (score >= 95) return "perfect";
  if (score >= 80) return "excellent";
  if (score >= 60) return "good";
  if (score >= 40) return "weak";
  return "reject";
}

export function deriveLaunchPriority(
  brandFit: number,
  trendScore: number,
  commercial: number,
): LaunchPriority {
  if (brandFit < BRAND_FIT_REJECT_THRESHOLD) return "D";
  if (brandFit >= 80 && trendScore >= 70 && commercial >= 65) return "A";
  if (brandFit >= 65 && trendScore >= 55) return "B";
  if (brandFit >= 40) return "C";
  return "D";
}

export function extractMatches(text: string): string[] {
  const matches: string[] = [];
  if (termMatchesHighMatch(text)) {
    matches.push(
      ...textContainsAny(text, MILAENE_BRAND_PROFILE.highMatch).slice(0, 4),
    );
  }
  if (termMatchesMediumMatch(text)) {
    matches.push(
      ...textContainsAny(text, MILAENE_BRAND_PROFILE.mediumMatch).slice(0, 2),
    );
  }
  return [...new Set(matches)].slice(0, 6);
}

export function extractConflicts(text: string): string[] {
  const conflicts: string[] = [];
  if (termMatchesLowMatch(text)) {
    conflicts.push(
      ...textContainsAny(text, MILAENE_BRAND_PROFILE.lowMatch).slice(0, 3),
    );
  }
  if (termIsNotRecommended(text)) {
    conflicts.push(
      ...textContainsAny(text, MILAENE_BRAND_PROFILE.notRecommended).slice(0, 3),
    );
  }
  return [...new Set(conflicts)].slice(0, 5);
}

export function buildAdjustments(
  dimensions: BrandFitDimension[],
  conflicts: string[],
): string[] {
  const adjustments: string[] = [];
  const weak = dimensions.filter((dimension) => dimension.score < 55);

  for (const dimension of weak.slice(0, 3)) {
    if (dimension.id === "color") {
      adjustments.push("Palette auf monochrome Neutrals verschieben — Schwarz, Weiß, Grau, Creme oder Erdtöne.");
    } else if (dimension.id === "graphic") {
      adjustments.push("Grafikdichte reduzieren — nur Stickerei oder kleine Front-Platzierung.");
    } else if (dimension.id === "silhouette") {
      adjustments.push("Als Oversized-Tee- oder Heavyweight-Hoodie-Umsetzung neu rahmen.");
    } else if (dimension.id === "product") {
      adjustments.push("Auf Oversized-Tee oder Heavyweight-Hoodie begrenzen — nur Milaene-Kern-SKUs.");
    } else if (dimension.id === "luxury") {
      adjustments.push("Quiet-Luxury-Zurückhaltung anwenden — laute Novelty-Signale entfernen.");
    }
  }

  if (conflicts.some((c) => /cargo|wide leg/i.test(c))) {
    adjustments.push("Nicht in Cargo-Silhouetten expandieren — außerhalb der Milaene-Fit-Architektur.");
  }
  if (conflicts.some((c) => /neon|anime|cartoon/i.test(c))) {
    adjustments.push("Maximalistische oder Novelty-Grafiken entfernen — Milaene liest sich als Archive, nicht Festival.");
  }

  return [...new Set(adjustments)].slice(0, 4);
}

export function buildRejectionReasons(
  brandFit: number,
  dimensions: BrandFitDimension[],
  conflicts: string[],
): string[] {
  const reasons: string[] = [];
  if (brandFit < BRAND_FIT_REJECT_THRESHOLD) {
    reasons.push(`Brand Fit ${brandFit}/100 — unter Milaene-Akzeptanzschwelle (40).`);
  }

  const weakest = [...dimensions].sort((a, b) => a.score - b.score).slice(0, 3);
  for (const dimension of weakest) {
    if (dimension.score < 40) {
      reasons.push(dimension.rationale);
    }
  }

  if (conflicts.length > 0) {
    reasons.push(`Identitätskonflikt: ${conflicts.slice(0, 3).join(", ")}.`);
  }

  return [...new Set(reasons)].slice(0, 5);
}

export function buildBrandFitReasons(
  brandFit: number,
  dimensions: BrandFitDimension[],
  matches: string[],
): string[] {
  const reasons: string[] = [];
  const tierLabel = brandFitTierFromScore(brandFit);
  reasons.push(`${tierLabel} für Milaene Quiet-Luxury-Streetwear-Positionierung.`);

  const strongest = [...dimensions].sort((a, b) => b.score - a.score).slice(0, 2);
  for (const dimension of strongest) {
    if (dimension.score >= 65) {
      reasons.push(dimension.rationale);
    }
  }

  if (matches.length > 0) {
    reasons.push(`Ausgerichtete Signale: ${matches.slice(0, 4).join(", ")}.`);
  }

  return reasons.slice(0, 5);
}

export function scoreOpportunityText(
  id: string,
  title: string,
  trendScore: number,
  commercialPotential: number,
  competition: number,
  longevity: number,
  originality: number,
  sourceKeys: string[],
  shopify: ShopifyLearningContext,
): ScoredOpportunity {
  const dimensions = computeBrandFitDimensions(title, shopify);
  let brandFit = computeBrandFitScore(dimensions);
  const bonuses = applyBrandFitBonuses(title, shopify, sourceKeys);
  brandFit = clampScore(brandFit + bonuses.scoreDelta);
  const brandFitTier = tierFromScore(brandFit);
  const matches = extractMatches(title);
  const conflicts = extractConflicts(title);
  const adjustments = buildAdjustments(dimensions, conflicts);
  const rejected = brandFit < BRAND_FIT_REJECT_THRESHOLD;
  const rejectionReasons = rejected
    ? buildRejectionReasons(brandFit, dimensions, conflicts)
    : [];

  const baseReasons = rejected
    ? rejectionReasons
    : buildBrandFitReasons(brandFit, dimensions, matches);
  const reasons = [...bonuses.reasons, ...baseReasons].slice(0, 6);

  const manufacturingDifficulty = clampScore(
    100 -
      (dimensions.find((d) => d.id === "material")?.score ?? 50) * 0.4 -
      (dimensions.find((d) => d.id === "graphic")?.score ?? 50) * 0.3 -
      (matches.some((m) => /embroidery/i.test(m)) ? 15 : 0),
  );

  const launchPriority = deriveLaunchPriority(brandFit, trendScore, commercialPotential);

  return {
    id,
    title,
    trendScore,
    brandFit,
    brandFitTier,
    commercialPotential,
    competition,
    longevity,
    originality,
    manufacturingDifficulty,
    launchPriority,
    matches,
    conflicts,
    adjustments,
    reasons,
    sourceKeys,
    rejected,
    rejectionReasons,
  };
}

export const BRAND_FIT_THRESHOLD = BRAND_FIT_REJECT_THRESHOLD;
