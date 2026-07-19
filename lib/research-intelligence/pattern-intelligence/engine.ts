import "server-only";

import { loadMilaeneCommerceBaseline } from "@/lib/commerce/milaene-commerce-baseline";
import type { ExtractedProductPattern } from "./types";
import {
  buildCatalogReferenceIndex,
  type CatalogReferenceIndex,
} from "./catalog-filter";
import {
  cleanAggregatedPatterns,
  sanitizeSuccessReasons,
} from "../clean-signals/pattern-cleanup";
import {
  dedupeMaterialTraits,
  dedupeSilhouettes,
  filterSilhouettesForScope,
} from "../clean-signals";
import { deriveResearchScope } from "../clean-signals/research-scope";
import { aggregatePatterns, findDominantTraits } from "./similarity";
import { buildDesignLanguage, deriveRecommendedSilhouette } from "./design-language";
import { extractPatternsFromCatalog } from "./extractor";
import {
  PATTERN_INTELLIGENCE_VERSION,
  type BrandLearningInsight,
  type PatternIntelligenceInput,
  type PatternIntelligenceSection,
} from "./types";

function emptySection(generatedAt: string): PatternIntelligenceSection {
  return {
    version: PATTERN_INTELLIGENCE_VERSION,
    generatedAt,
    loaded: false,
    analyzedProductCount: 0,
    patterns: [],
    designLanguage: {
      typography: ["Minimal Sans"],
      placement: ["Großer Rückenprint"],
      colorWorld: ["Schwarz", "Off White"],
      graphicStyle: ["Archive", "Quiet Luxury"],
      symbolism: [],
      complexity: [],
      negativeSpace: [],
      lineWork: [],
      printTechnique: ["Screen Print"],
      material: ["Heavyweight Cotton"],
      silhouette: ["Oversized T-Shirt"],
      premiumLevel: [],
      palette: ["Schwarz", "Off White"],
      guardrails: [],
      risks: [],
      prohibitions: [],
      patternSummary: "",
    },
    brandLearning: [],
    successReasons: [],
    recommendedSilhouette: "Oversized T-Shirt",
    alternativeSilhouettes: ["Heavyweight Hoodie"],
    catalogProductTitles: [],
  };
}

interface ComparisonGroup {
  label: string;
  units: number;
  count: number;
}

type EvidenceLevel = "low" | "medium" | "high";

const EVIDENCE_LEVEL_LABELS: Record<EvidenceLevel, string> = {
  low: "Niedrige Evidenz",
  medium: "Mittlere Evidenz",
  high: "Hohe Evidenz",
};

function sumUnits(items: ExtractedProductPattern[]): number {
  return items.reduce((sum, item) => sum + item.unitsSold, 0);
}

function assessEvidenceLevel(
  positive: ComparisonGroup,
  negative: ComparisonGroup,
  differenceRatio: number,
): EvidenceLevel {
  const totalUnits = positive.units + negative.units;
  if (positive.count < 2 || negative.count < 2 || totalUnits < 10) return "low";
  if (
    positive.count >= 3 &&
    negative.count >= 3 &&
    totalUnits >= 40 &&
    differenceRatio >= 0.2
  ) {
    return "high";
  }
  if (positive.count >= 2 && negative.count >= 2 && totalUnits >= 20 && differenceRatio >= 0.15) {
    return "medium";
  }
  return "low";
}

function compareGroups(
  positive: ComparisonGroup,
  negative: ComparisonGroup,
  minProducts = 2,
  minDifferenceRatio = 0.15,
): {
  confirmed: boolean;
  provisional: boolean;
  evidence: string;
  evidenceLevel: EvidenceLevel;
  evidenceLevelLabel: string;
  status: BrandLearningInsight["status"];
  statementPrefix: string;
} {
  if (positive.count < minProducts || negative.count < minProducts) {
    return {
      confirmed: false,
      provisional: false,
      evidence: "Noch nicht ausreichend bestätigt — zu wenige vergleichbare Shopify-Produkte.",
      evidenceLevel: "low",
      evidenceLevelLabel: EVIDENCE_LEVEL_LABELS.low,
      status: "unconfirmed",
      statementPrefix: "Frühes Signal",
    };
  }

  const total = positive.units + negative.units;
  if (total < 4) {
    return {
      confirmed: false,
      provisional: false,
      evidence: "Noch nicht ausreichend bestätigt — zu geringe Bestellbasis.",
      evidenceLevel: "low",
      evidenceLevelLabel: EVIDENCE_LEVEL_LABELS.low,
      status: "unconfirmed",
      statementPrefix: "Frühes Signal",
    };
  }

  const positiveShare = positive.units / total;
  const negativeShare = negative.units / total;
  const diff = Math.abs(positiveShare - negativeShare);
  const evidenceLevel = assessEvidenceLevel(positive, negative, diff);
  const evidenceLevelLabel = EVIDENCE_LEVEL_LABELS[evidenceLevel];

  if (diff < minDifferenceRatio) {
    return {
      confirmed: false,
      provisional: true,
      evidence: `Vorläufiges Muster — ${positive.label}: ${positive.units} Einheiten vs. ${negative.label}: ${negative.units} Einheiten.`,
      evidenceLevel,
      evidenceLevelLabel,
      status: "provisional",
      statementPrefix: "Vorläufig bestätigtes Muster",
    };
  }

  const confirmed = positive.units > negative.units && evidenceLevel === "high";
  const provisional = positive.units > negative.units && evidenceLevel !== "high";

  const evidence =
    evidenceLevel === "medium" || evidenceLevel === "low"
      ? `${evidenceLevelLabel}: ${positive.label} erzielten in den verfügbaren Shopify-Daten ${positive.units} verkaufte Einheiten gegenüber ${negative.units} Einheiten ${negative.label}.`
      : `${positive.label}: ${positive.units} verkaufte Einheiten vs. ${negative.label}: ${negative.units} Einheiten (Shopify).`;

  return {
    confirmed,
    provisional,
    evidence,
    evidenceLevel,
    evidenceLevelLabel,
    status: confirmed ? "confirmed" : provisional ? "provisional" : "unconfirmed",
    statementPrefix:
      evidenceLevel === "low"
        ? "Frühes Signal"
        : evidenceLevel === "medium"
          ? "Vorläufig bestätigtes Muster"
          : confirmed
            ? "Bestätigtes Muster"
            : "Vorläufig bestätigtes Muster",
  };
}

function buildBrandLearningInsights(
  extracted: ExtractedProductPattern[],
): BrandLearningInsight[] {
  if (extracted.length < 2) return [];

  const insights: BrandLearningInsight[] = [];

  const minimalTags = extracted.filter((item) =>
    (item.patterns.graphicStyle ?? []).some((g) => /quiet|minimal|archive/i.test(g)) ||
    item.dimensionEvidence?.graphicStyle?.some((e) => /tag/i.test(e)),
  );
  const loudTags = extracted.filter(
    (item) => !minimalTags.includes(item),
  );
  const minimalCompare = compareGroups(
    { label: "Minimal/Archive", units: sumUnits(minimalTags), count: minimalTags.length },
    { label: "Andere Grafiksignale", units: sumUnits(loudTags), count: loudTags.length },
  );
  if (minimalCompare.confirmed || minimalCompare.provisional) {
    insights.push({
      id: minimalCompare.confirmed ? "learn-minimal" : "learn-minimal-prov",
      statement: `${minimalCompare.statementPrefix}: minimalistische Designs tendieren zu besserer Performance.`,
      evidence: minimalCompare.evidence,
      supported: minimalCompare.confirmed,
      status: minimalCompare.status,
      evidenceLevel: minimalCompare.evidenceLevel,
      evidenceLevelLabel: minimalCompare.evidenceLevelLabel,
    });
  }

  const heavyweight = extracted.filter((item) =>
    (item.patterns.material ?? []).some((m) => /heavyweight|\d{3}\s*gsm/i.test(m)),
  );
  const light = extracted.filter((item) => !heavyweight.includes(item));
  const heavyCompare = compareGroups(
    { label: "Heavyweight/GSM", units: sumUnits(heavyweight), count: heavyweight.length },
    { label: "Leichtere Materialien", units: sumUnits(light), count: light.length },
  );
  if (heavyCompare.confirmed || heavyCompare.provisional) {
    insights.push({
      id: heavyCompare.confirmed ? "learn-heavyweight" : "learn-heavyweight-prov",
      statement: `${heavyCompare.statementPrefix}: Heavyweight-/GSM-Produkte zeigen in den verfügbaren Shopify-Daten stärkere Verkaufszahlen als leichtere Materialien.`,
      evidence: heavyCompare.evidence,
      supported: heavyCompare.confirmed,
      status: heavyCompare.status,
      evidenceLevel: heavyCompare.evidenceLevel,
      evidenceLevelLabel: heavyCompare.evidenceLevelLabel,
    });
  }

  const backPrint = extracted.filter((item) =>
    (item.patterns.placement ?? []).some((p) => /rücken|back/i.test(p)) &&
    item.dimensionEvidence?.placement?.some((e) => e !== "Für dieses Merkmal"),
  );
  const frontOnly = extracted.filter(
    (item) =>
      !backPrint.includes(item) &&
      (item.patterns.placement ?? []).some((p) => /brust|chest|front/i.test(p)),
  );
  const placementCompare = compareGroups(
    { label: "Rückenprint", units: sumUnits(backPrint), count: backPrint.length },
    { label: "Front/Brust", units: sumUnits(frontOnly), count: frontOnly.length },
  );
  if (placementCompare.confirmed || placementCompare.provisional) {
    insights.push({
      id: placementCompare.confirmed ? "learn-backprint" : "learn-backprint-prov",
      statement: `${placementCompare.statementPrefix}: Rückenprints zeigen in den verfügbaren Shopify-Daten tendenziell stärkere Verkaufszahlen.`,
      evidence: placementCompare.evidence,
      supported: placementCompare.confirmed,
      status: placementCompare.status,
      evidenceLevel: placementCompare.evidenceLevel,
      evidenceLevelLabel: placementCompare.evidenceLevelLabel,
    });
  }

  const embroidery = extracted.filter((item) =>
    (item.patterns.printTechnique ?? []).some((p) => /embroidery|stickerei/i.test(p)) &&
    item.dimensionEvidence?.printTechnique?.some((e) => /druck|print|tag/i.test(e)),
  );
  const screenOnly = extracted.filter(
    (item) =>
      !embroidery.includes(item) &&
      (item.patterns.printTechnique ?? []).some((p) => /screen/i.test(p)),
  );
  const embroideryCompare = compareGroups(
    { label: "Stickerei", units: sumUnits(embroidery), count: embroidery.length },
    { label: "Screen Print", units: sumUnits(screenOnly), count: screenOnly.length },
  );
  if (embroideryCompare.confirmed || embroideryCompare.provisional) {
    insights.push({
      id: embroideryCompare.confirmed ? "learn-embroidery" : "learn-embroidery-prov",
      statement: `${embroideryCompare.statementPrefix}: Stickerei korreliert in den Shopify-Daten mit höherer Premium-Wahrnehmung.`,
      evidence: embroideryCompare.evidence,
      supported: embroideryCompare.confirmed,
      status: embroideryCompare.status,
      evidenceLevel: embroideryCompare.evidenceLevel,
      evidenceLevelLabel: embroideryCompare.evidenceLevelLabel,
    });
  }

  const blackDominant = findDominantTraits(extracted, "colorWorld").some((c) =>
    /schwarz|black|washed/i.test(c),
  );
  const blackProducts = extracted.filter((item) =>
    (item.patterns.colorWorld ?? []).some((c) => /schwarz|black|washed/i.test(c)) &&
    item.dimensionEvidence?.colorWorld?.some((e) => /varianten/i.test(e)),
  );
  const otherColors = extracted.filter((item) => !blackProducts.includes(item));
  if (blackDominant) {
    const colorCompare = compareGroups(
      { label: "Schwarz/Washed", units: sumUnits(blackProducts), count: blackProducts.length },
      { label: "Andere Farbwelten", units: sumUnits(otherColors), count: otherColors.length },
    );
    if (colorCompare.confirmed || colorCompare.provisional) {
      insights.push({
        id: colorCompare.confirmed ? "learn-black" : "learn-black-prov",
        statement: `${colorCompare.statementPrefix}: Schwarz/Washed bleibt in den Shopify-Daten die stärkste Farbwelt.`,
        evidence: colorCompare.evidence,
        supported: colorCompare.confirmed,
        status: colorCompare.status,
        evidenceLevel: colorCompare.evidenceLevel,
        evidenceLevelLabel: colorCompare.evidenceLevelLabel,
      });
    }
  }

  return insights;
}

export async function runPatternIntelligenceEngine(
  input: PatternIntelligenceInput = {},
): Promise<PatternIntelligenceSection> {
  const generatedAt = input.generatedAt ?? new Date().toISOString();

  try {
    const baseline = await loadMilaeneCommerceBaseline();
    const { knowledge, commerceIntelligence } = baseline;

    const catalogProductTitles = knowledge.products.map((p) => p.title);
    const catalogReferenceIndex = buildCatalogReferenceIndex(
      knowledge.products,
      knowledge.collections.map((c) => c.title),
      knowledge.tags,
    );
    const commerceById = commerceIntelligence.byProductId;

    const extracted = extractPatternsFromCatalog(
      knowledge.products,
      commerceById,
      12,
    );

    if (extracted.length === 0) {
      return {
        ...emptySection(generatedAt),
        loaded: true,
        catalogProductTitles,
      };
    }

    const aggregated = cleanAggregatedPatterns(
      aggregatePatterns(extracted),
      input.userRequest,
    );
    const scope = deriveResearchScope(input.userRequest);
    const designLanguage = buildDesignLanguage(
      extracted,
      aggregated,
      catalogProductTitles,
      input.userRequest,
    );
    designLanguage.silhouette = filterSilhouettesForScope(
      designLanguage.silhouette.length > 0
        ? designLanguage.silhouette
        : scope.allowedSilhouettes,
      scope,
    );
    designLanguage.material = dedupeMaterialTraits(designLanguage.material);

    const { recommended, alternatives } = deriveRecommendedSilhouette(
      designLanguage,
      input.userRequest,
    );

    const brandLearning = buildBrandLearningInsights(extracted);

    const successReasons = sanitizeSuccessReasons([
      ...new Set(extracted.flatMap((e) => e.whySuccessful)),
    ]);

    return {
      version: PATTERN_INTELLIGENCE_VERSION,
      generatedAt,
      loaded: true,
      analyzedProductCount: extracted.length,
      patterns: aggregated,
      designLanguage,
      brandLearning,
      successReasons,
      recommendedSilhouette: recommended,
      alternativeSilhouettes: alternatives,
      catalogProductTitles,
    };
  } catch {
    return emptySection(generatedAt);
  }
}

export {
  buildCatalogReferenceIndex,
  isCatalogProductReference,
  isExistingCatalogProduct,
  normalizeProductReference,
  stripVariantFromTitle,
} from "./catalog-filter";
export {
  classifyEntity,
  dedupeByNormalizedLabel,
  isCreativeOpportunityEntity,
  isNoiseEntity,
  passesOpportunityQualityGate,
} from "./entity-quality";
export { parseStructuredMaterials } from "./material-parser";
export {
  buildDesignStudioNextStep,
  resolveProductTarget,
  CORE_PRODUCT_TARGETS,
} from "./product-target";
export { capScoreBySourceAgreement, uniqueSourceCount } from "./score-calibration";
export { buildDesignLanguage, deriveRecommendedSilhouette } from "./design-language";
export { aggregatePatterns, findDominantTraits } from "./similarity";
export type {
  AggregatedDesignPattern,
  BrandLearningInsight,
  DesignLanguage,
  PatternIntelligenceSection,
} from "./types";
export type { CatalogReferenceIndex } from "./catalog-filter";
export { DESIGN_STUDIO_MISSION, PATTERN_INTELLIGENCE_VERSION } from "./types";
