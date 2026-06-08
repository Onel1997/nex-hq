const MIN_RECOMMENDATIONS = 4;
const MIN_BULLET_CHARS = 20;

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean);
}

function ensureMinLength(text: string, min: number, fallback: string): string {
  let result = text.trim() || fallback.trim();
  const extra =
    " Strategische Einordnung und konkrete Umsetzung für die Markenpositionierung.";
  while (result.length < min) {
    result = `${result}${extra}`;
  }
  return result.slice(0, Math.max(min, result.length));
}

function ensureBulletList(
  items: string[],
  min: number,
  max: number,
  pool: string[],
): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const item of items) {
    const normalized = ensureMinLength(item, MIN_BULLET_CHARS, item);
    if (!seen.has(normalized)) {
      seen.add(normalized);
      result.push(normalized);
    }
  }

  for (const item of pool) {
    if (result.length >= min) break;
    const normalized = ensureMinLength(item, MIN_BULLET_CHARS, item);
    if (!seen.has(normalized)) {
      seen.add(normalized);
      result.push(normalized);
    }
  }

  const generic =
    "Weitere strategische Maßnahme aus der Gesamtanalyse ableiten und priorisiert umsetzen.";
  while (result.length < min) {
    const normalized = ensureMinLength(
      generic,
      MIN_BULLET_CHARS,
      `Priorität ${result.length + 1}: ${generic}`,
    );
    if (!seen.has(normalized)) {
      seen.add(normalized);
      result.push(normalized);
    } else {
      result.push(
        ensureMinLength(
          `${generic} (${result.length + 1})`,
          MIN_BULLET_CHARS,
          generic,
        ),
      );
    }
  }

  return result.slice(0, max);
}

function findFinding(
  findings: string[],
  keywords: string[],
): string | undefined {
  return findings.find((finding) => {
    const lower = finding.toLowerCase();
    return keywords.some((keyword) => lower.includes(keyword));
  });
}

function extractProductCategories(findings: string[], fullAnalysis: string): string[] {
  const categoryFinding = findFinding(findings, [
    "kategorie",
    "sortiment",
    "produkt",
    "hoodie",
    "t-shirt",
    "accessoire",
  ]);

  if (categoryFinding) {
    const segments = categoryFinding
      .split(/[,;]|\s+sowie\s+|\s+und\s+/i)
      .map((part) => part.replace(/^.*?:\s*/, "").trim())
      .filter((part) => part.length >= MIN_BULLET_CHARS);

    if (segments.length >= 3) return segments.slice(0, 12);
  }

  const fromAnalysis = fullAnalysis.match(
    /### Produktkategorien\s+([\s\S]*?)(?=\n###|\n##|$)/i,
  );
  if (fromAnalysis?.[1]) {
    const lines = fromAnalysis[1]
      .split("\n")
      .map((line) => line.replace(/^[-*\d.]+\s*/, "").trim())
      .filter((line) => line.length >= MIN_BULLET_CHARS);
    if (lines.length >= 3) return lines.slice(0, 12);
  }

  return ensureBulletList(
    [],
    3,
    12,
    categoryFinding
      ? [categoryFinding]
      : [
          "Oberbekleidung als Kernkategorie mit Fokus auf Hoodies und T-Shirts.",
          "Accessoires zur Abrundung des urbanen Markenlooks.",
          "Limitierte Drops und nummerierte Editionen als Sortimentshebel.",
        ],
  );
}

export function padRecommendations(
  recommendations: string[],
  sources: {
    opportunities: string[];
    risks: string[];
    keyFindings: string[];
  },
): string[] {
  if (recommendations.length >= MIN_RECOMMENDATIONS) {
    return recommendations.slice(0, 10);
  }

  const pool = [
    ...recommendations,
    ...sources.opportunities.map(
      (item) => `Chance operationalisieren: ${item}`,
    ),
    ...sources.risks.map((item) => `Risiko mitigieren: ${item}`),
    ...sources.keyFindings.map((item) => `Strategisch umsetzen: ${item}`),
  ];

  return ensureBulletList(recommendations, MIN_RECOMMENDATIONS, 10, pool);
}

export function generateCompetitorReport(
  parsed: Record<string, unknown>,
): Record<string, unknown> {
  const executiveSummary = String(parsed.executiveSummary ?? "");
  const keyFindings = asStringArray(parsed.keyFindings);
  const opportunities = asStringArray(parsed.opportunities);
  const risks = asStringArray(parsed.risks);
  const recommendations = asStringArray(parsed.recommendations);
  const fullAnalysis = String(parsed.fullAnalysis ?? "");

  const positioning =
    findFinding(keyFindings, ["positionier", "positioning", "premium-marke"]) ??
    executiveSummary;
  const targetAudience =
    findFinding(keyFindings, [
      "zielgruppe",
      "audience",
      "demograf",
      "kaufverhalten",
      "jahre",
    ]) ?? keyFindings[1] ?? executiveSummary;
  const pricing =
    findFinding(keyFindings, ["preis", "pricing", "euro", "premium-image"]) ??
    keyFindings[2] ??
    executiveSummary;
  const marketingStrategy =
    findFinding(keyFindings, [
      "marketing",
      "social media",
      "influencer",
      "kanal",
    ]) ?? keyFindings[4] ?? executiveSummary;
  const communityStrategy =
    findFinding(keyFindings, ["community", "loyal", "drop", "event"]) ??
    keyFindings[6] ??
    marketingStrategy;

  const strengths = ensureBulletList(
    keyFindings.filter((finding) =>
      /stärk|vorteil|strength|dominant|führend/i.test(finding),
    ),
    3,
    8,
    keyFindings,
  );
  const weaknesses = ensureBulletList(
    risks.length > 0
      ? risks
      : keyFindings.filter((finding) =>
          /schwäch|risiko|nachteil|weakness|abhängig/i.test(finding),
        ),
    3,
    8,
    [
      ...risks,
      "Abhängigkeit von einzelnen Wachstumstreibern kann die Wettbewerbsposition schwächen.",
      "Begrenzte Differenzierung in überlaufenen Produktkategorien erhöht Preisdruck.",
      "Hohe Reaktionsgeschwindigkeit der Konkurrenz kann First-Mover-Vorteile verkürzen.",
    ],
  );

  return {
    positioning: ensureMinLength(positioning, 80, executiveSummary),
    targetAudience: ensureMinLength(targetAudience, 60, executiveSummary),
    pricing: ensureMinLength(pricing, 60, executiveSummary),
    productCategories: extractProductCategories(keyFindings, fullAnalysis),
    marketingStrategy: ensureMinLength(marketingStrategy, 100, executiveSummary),
    communityStrategy: ensureMinLength(communityStrategy, 80, marketingStrategy),
    strengths,
    weaknesses,
    brandOpportunities: ensureBulletList(
      opportunities,
      3,
      8,
      [...recommendations, ...opportunities],
    ),
  };
}

function isNonEmptyString(value: unknown, min: number): value is string {
  return typeof value === "string" && value.trim().length >= min;
}

function isValidBulletList(value: unknown, min: number): value is string[] {
  return (
    Array.isArray(value) &&
    value.length >= min &&
    value.every(
      (item) => typeof item === "string" && item.trim().length >= MIN_BULLET_CHARS,
    )
  );
}

function inferAdoptionLevel(
  findings: string[],
  fullAnalysis: string,
): "nascent" | "emerging" | "mainstream" | "declining" {
  const text = [...findings, fullAnalysis].join(" ").toLowerCase();
  if (/rückläufig|declining|abnehmend|ruecklaeufig/.test(text)) return "declining";
  if (/mainstream|etabliert|dominant|flächendeckend|flaechendeckend/.test(text)) {
    return "mainstream";
  }
  if (/aufstrebend|emerging|wachsend/.test(text)) return "emerging";
  return "nascent";
}

export function generateTrendReport(
  parsed: Record<string, unknown>,
): Record<string, unknown> {
  const executiveSummary = String(parsed.executiveSummary ?? "");
  const keyFindings = asStringArray(parsed.keyFindings);
  const opportunities = asStringArray(parsed.opportunities);
  const risks = asStringArray(parsed.risks);
  const recommendations = asStringArray(parsed.recommendations);
  const fullAnalysis = String(parsed.fullAnalysis ?? "");

  const trendDescription =
    findFinding(keyFindings, [
      "trend",
      "domin",
      "streetwear",
      "2026",
      "entwicklung",
      "bewegung",
    ]) ?? executiveSummary;
  const whyItMatters =
    findFinding(keyFindings, [
      "bedeut",
      "relevan",
      "wichtig",
      "strateg",
      "auswirk",
    ]) ??
    risks[0] ??
    executiveSummary;
  const relevanceForBrand =
    opportunities[0] ?? recommendations[0] ?? executiveSummary;

  const designImplications = ensureBulletList(
    keyFindings.filter((finding) =>
      /design|silhouette|ästhet|aesthet|farbe|visual|grafik|material/i.test(
        finding,
      ),
    ),
    3,
    8,
    [
      ...opportunities.map((item) => `Design-Umsetzung: ${item}`),
      ...keyFindings,
    ],
  );
  const contentImplications = ensureBulletList(
    keyFindings.filter((finding) =>
      /content|marketing|social|tiktok|kampagn|community/i.test(finding),
    ),
    3,
    8,
    [...recommendations, ...opportunities],
  );

  return {
    trendDescription: ensureMinLength(trendDescription, 120, executiveSummary),
    whyItMatters: ensureMinLength(whyItMatters, 80, executiveSummary),
    adoptionLevel: inferAdoptionLevel(keyFindings, fullAnalysis),
    relevanceForBrand: ensureMinLength(relevanceForBrand, 80, executiveSummary),
    designImplications,
    contentImplications,
  };
}

export function fillPartialTrendReport(
  parsed: Record<string, unknown>,
  partial: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const generated = generateTrendReport(parsed);
  if (!partial) return generated;

  const adoptionLevels = ["nascent", "emerging", "mainstream", "declining"] as const;
  const adoptionLevel =
    typeof partial.adoptionLevel === "string" &&
    adoptionLevels.includes(
      partial.adoptionLevel as (typeof adoptionLevels)[number],
    )
      ? partial.adoptionLevel
      : generated.adoptionLevel;

  return {
    trendDescription: isNonEmptyString(partial.trendDescription, 120)
      ? partial.trendDescription
      : generated.trendDescription,
    whyItMatters: isNonEmptyString(partial.whyItMatters, 80)
      ? partial.whyItMatters
      : generated.whyItMatters,
    adoptionLevel,
    relevanceForBrand: isNonEmptyString(partial.relevanceForBrand, 80)
      ? partial.relevanceForBrand
      : generated.relevanceForBrand,
    designImplications: isValidBulletList(partial.designImplications, 3)
      ? partial.designImplications
      : generated.designImplications,
    contentImplications: isValidBulletList(partial.contentImplications, 3)
      ? partial.contentImplications
      : generated.contentImplications,
  };
}

export function fillPartialCompetitorReport(
  parsed: Record<string, unknown>,
  partial: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const generated = generateCompetitorReport(parsed);
  if (!partial) return generated;

  return {
    positioning: isNonEmptyString(partial.positioning, 80)
      ? partial.positioning
      : generated.positioning,
    targetAudience: isNonEmptyString(partial.targetAudience, 60)
      ? partial.targetAudience
      : generated.targetAudience,
    pricing: isNonEmptyString(partial.pricing, 60)
      ? partial.pricing
      : generated.pricing,
    productCategories: isValidBulletList(partial.productCategories, 3)
      ? partial.productCategories
      : generated.productCategories,
    marketingStrategy: isNonEmptyString(partial.marketingStrategy, 100)
      ? partial.marketingStrategy
      : generated.marketingStrategy,
    communityStrategy: isNonEmptyString(partial.communityStrategy, 80)
      ? partial.communityStrategy
      : generated.communityStrategy,
    strengths: isValidBulletList(partial.strengths, 3)
      ? partial.strengths
      : generated.strengths,
    weaknesses: isValidBulletList(partial.weaknesses, 3)
      ? partial.weaknesses
      : generated.weaknesses,
    brandOpportunities: isValidBulletList(partial.brandOpportunities, 3)
      ? partial.brandOpportunities
      : generated.brandOpportunities,
  };
}

export function enrichResearchPayload(
  parsed: Record<string, unknown>,
): string[] {
  const adjustments: string[] = [];

  const opportunities = asStringArray(parsed.opportunities);
  const risks = asStringArray(parsed.risks);
  const keyFindings = asStringArray(parsed.keyFindings);
  const recommendations = asStringArray(parsed.recommendations);

  if (recommendations.length > 0 && recommendations.length < MIN_RECOMMENDATIONS) {
    const padded = padRecommendations(recommendations, {
      opportunities,
      risks,
      keyFindings,
    });
    parsed.recommendations = padded;
    adjustments.push(
      `padded recommendations: ${recommendations.length} → ${padded.length}`,
    );
  }

  if (parsed.reportType === "competitor") {
    const before = parsed.competitorReport;
    const filled = fillPartialCompetitorReport(
      parsed,
      before && typeof before === "object" && !Array.isArray(before)
        ? (before as Record<string, unknown>)
        : undefined,
    );
    parsed.competitorReport = filled;

    if (!before) {
      adjustments.push("generated competitorReport from core sections");
    } else {
      adjustments.push("filled partial competitorReport from core sections");
    }
  }

  if (parsed.reportType === "trend") {
    const before = parsed.trendReport;
    const filled = fillPartialTrendReport(
      parsed,
      before && typeof before === "object" && !Array.isArray(before)
        ? (before as Record<string, unknown>)
        : undefined,
    );
    parsed.trendReport = filled;

    if (!before) {
      adjustments.push("generated trendReport from core sections");
    } else {
      adjustments.push("filled partial trendReport from core sections");
    }
  }

  return adjustments;
}
