import { getSourceWeightProfile } from "../confidence/source-weights";
import type { BrandIntelligenceSection } from "../brand-intelligence/types";
import { DEFAULT_LOCALE } from "@/lib/i18n/config";
import { formatIntelligenceTemplate, getIntelligenceCopy } from "../copy";
import {
  classifyEntity,
  isCreativeOpportunityEntity,
} from "../pattern-intelligence/entity-quality";
import {
  buildCatalogReferenceIndex,
  isCatalogProductReference,
} from "../pattern-intelligence/catalog-filter";
import {
  buildDesignStudioNextStep,
  resolveProductTarget,
} from "../pattern-intelligence/product-target";
import type { PatternIntelligenceSection } from "../pattern-intelligence/types";
import type { CleanResearchSignalSet } from "../clean-signals";
import type { IntelligenceEntityKind } from "../pattern-intelligence/types";
import type { ResearchReasoningIntelligence } from "../types/reasoning";
import type { UnifiedResearchIntelligence } from "../types/unified";
import type {
  ReportExecutiveNarrative,
  ReportPrioritizedOpportunity,
  ReportRecommendationCard,
  ReportSourceTrustEntry,
  PrioritySignal,
} from "./types";

const TRUSTED_SOURCES: Array<{ key: string; maxStars: number }> = [
  { key: "google_trends", maxStars: 5 },
  { key: "shopify", maxStars: 5 },
  { key: "fashion_news", maxStars: 4 },
  { key: "tiktok", maxStars: 4 },
  { key: "pinterest", maxStars: 4 },
  { key: "reddit", maxStars: 3 },
  { key: "instagram", maxStars: 3 },
];

function priorityFromOpportunity(
  brandFit: number,
  trendScore: number,
  rejected: boolean,
  launchPriority: string,
): PrioritySignal {
  if (rejected || launchPriority === "D") return "reject";
  if (brandFit >= 75 && trendScore >= 65) return "develop";
  if (launchPriority === "A" || (brandFit >= 65 && trendScore >= 55)) return "develop";
  if (launchPriority === "C" || brandFit < 50) return "watch";
  return brandFit >= 60 ? "develop" : "watch";
}

function mapEntityKind(classification: ReturnType<typeof classifyEntity>): IntelligenceEntityKind {
  if (classification === "design_pattern") return "design_pattern";
  if (classification === "trend") return "trend";
  if (classification === "product") return "product";
  if (classification === "category") return "category";
  if (classification === "catalog_metadata") return "catalog_metadata";
  if (classification === "noise") return "noise";
  return "recommendation";
}

export function buildPrioritizedOpportunities(
  intelligence: UnifiedResearchIntelligence,
  brandIntelligence: BrandIntelligenceSection | null | undefined,
  cards: ReportRecommendationCard[],
  patternIntelligence?: PatternIntelligenceSection | null,
  userRequest?: string,
): ReportPrioritizedOpportunity[] {
  if (!brandIntelligence) return [];

  const catalogTitles = patternIntelligence?.catalogProductTitles ?? [];
  const catalogIndex = buildCatalogReferenceIndex(
    catalogTitles.map((title, index) => ({
      id: `catalog-${index}`,
      title,
      handle: "",
      status: "ACTIVE",
      productType: "",
      price: "0",
      currency: "EUR",
      inventory: 0,
      collections: [],
      tags: [],
      colors: [],
      materials: [],
    })),
  );

  const silhouette = resolveProductTarget({
    userRequest,
    patternSilhouette: patternIntelligence?.recommendedSilhouette,
    intelligenceCorpus: brandIntelligence.topOpportunities
      .map((opp) => opp.title)
      .join(" "),
  });

  const opportunities = [
    ...brandIntelligence.topOpportunities,
    ...brandIntelligence.rejectedOpportunities.slice(0, 2),
  ].filter((opp) => {
    if (isCatalogProductReference(opp.title, catalogIndex)) return false;
    const kind = classifyEntity(opp.title, catalogIndex);
    return isCreativeOpportunityEntity(kind);
  });

  const seen = new Set<string>();
  const result: ReportPrioritizedOpportunity[] = [];

  for (const opp of opportunities) {
    const key = opp.title.toLowerCase().trim();
    if (seen.has(key)) continue;
    seen.add(key);

    const designCard = cards.find((card) =>
      /design direction|graphic theme|typography/i.test(card.title),
    );

    const entityKind = mapEntityKind(classifyEntity(opp.title, catalogIndex));
    const dynamicNextStep = opp.rejected
      ? opp.rejectionReasons[0] ?? ""
      : buildDesignStudioNextStep(silhouette, designCard?.title ?? opp.title);

    result.push({
      id: opp.id,
      trend: opp.title,
      brandFit: opp.brandFit,
      trendScore: opp.trendScore,
      commercialPotential: opp.commercialPotential,
      confidence: opp.confidence,
      whyRecommended: opp.reasons[0] ?? opp.matches.join(", "),
      nextStep: dynamicNextStep,
      sourceKeys: opp.sourceKeys,
      prioritySignal: priorityFromOpportunity(
        opp.brandFit,
        opp.trendScore,
        opp.rejected,
        opp.launchPriority,
      ),
      productHint: silhouette,
      designDirection: designCard?.title ?? null,
      entityKind,
    });
  }

  return result
    .sort((a, b) => {
      const order = { develop: 0, watch: 1, reject: 2 };
      const diff = order[a.prioritySignal] - order[b.prioritySignal];
      if (diff !== 0) return diff;
      return b.brandFit - a.brandFit || b.trendScore - a.trendScore;
    })
    .slice(0, 8);
}

export function buildSourceTrust(
  intelligence: UnifiedResearchIntelligence,
): ReportSourceTrustEntry[] {
  const copy = getIntelligenceCopy(DEFAULT_LOCALE);
  const connected = new Map(
    intelligence.manifest.contributions.map((item) => [
      String(item.sourceKey),
      item,
    ]),
  );

  return TRUSTED_SOURCES.map(({ key, maxStars }) => {
    const profile = getSourceWeightProfile(key);
    const contribution = connected.get(key);
    const isConnected = Boolean(contribution && contribution.signalCount > 0);

    let stars = 0;
    if (isConnected) {
      stars = contribution!.mode === "live" ? maxStars : Math.max(1, maxStars - 2);
      if (contribution!.signalCount >= 3) {
        stars = Math.min(maxStars, stars + 1);
      }
    }

    return {
      sourceKey: key,
      label: profile.label,
      stars: Math.min(5, stars),
      connected: isConnected,
      statusLabel: isConnected ? `${stars}/5` : copy.sourceQuality.notConnected,
    };
  });
}

export function buildExecutiveNarrative(
  intelligence: UnifiedResearchIntelligence,
  reasoning: ResearchReasoningIntelligence,
  brandIntelligence: BrandIntelligenceSection | null | undefined,
  weak: boolean,
  cleanSignalSet?: CleanResearchSignalSet | null,
  patternIntelligence?: PatternIntelligenceSection | null,
): ReportExecutiveNarrative | null {
  const copy = getIntelligenceCopy(DEFAULT_LOCALE).executive;

  if (weak) {
    return {
      whatFound: copy.weakData,
      whyInteresting: copy.weakData,
      milaeneFit: copy.brandWeak,
      shouldAct: copy.observe,
      fullText: copy.weakData,
    };
  }

  const scopeLabels = cleanSignalSet?.summaryLabels ?? [];
  const terms =
    scopeLabels.length > 0
      ? scopeLabels.slice(0, 4).join(", ")
      : brandIntelligence?.topOpportunities[0]?.title ?? "aktuelle Trendsignale";

  const sourceKeys = new Set(
    intelligence.manifest.contributions.map((item) => String(item.sourceKey)),
  );

  const whatFound = formatIntelligenceTemplate(copy.trendRising, { terms });

  const whyParts: string[] = [];
  const heavyLearning = patternIntelligence?.brandLearning.find((item) =>
    item.id.includes("heavyweight"),
  );
  if (sourceKeys.has("google_trends")) {
    whyParts.push(
      formatIntelligenceTemplate(copy.googleTrendsSpecific, {
        terms: scopeLabels[0] ?? terms.split(",")[0] ?? "die Zielrichtung",
      }),
    );
  }
  if (sourceKeys.has("shopify")) {
    if (heavyLearning?.evidence) {
      whyParts.push(heavyLearning.evidence);
    } else {
      whyParts.push(copy.shopifyConfirms);
    }
  }
  if (intelligence.manifest.providerCount >= 3 && whyParts.length < 2) {
    whyParts.push(copy.multiSource);
  }
  const whyInteresting = whyParts.length > 0 ? whyParts.join(" ") : reasoning.narratives[0] ?? whatFound;

  const brandFit = brandIntelligence?.brandFitScore ?? reasoning.brandFit.score;
  const alignedAttrs = [
    ...(patternIntelligence?.designLanguage.material.slice(0, 2) ?? []),
    ...(patternIntelligence?.designLanguage.silhouette.slice(0, 2) ?? []),
  ]
    .filter(Boolean)
    .slice(0, 3)
    .join(", ");

  const milaeneFit =
    brandFit >= 70
      ? alignedAttrs
        ? formatIntelligenceTemplate(copy.brandAlignedSpecific, { attrs: alignedAttrs })
        : copy.brandAligned
      : brandFit >= 55
        ? copy.brandPartial
        : copy.brandWeak;

  const topOpp = brandIntelligence?.topOpportunities[0];
  const overall = intelligence.confidence.overallScore;
  const shouldAct =
    topOpp?.launchPriority === "A" || (topOpp && topOpp.brandFit >= 70)
      ? overall >= 65
        ? copy.actNow
        : formatIntelligenceTemplate(copy.actDevelop, {
            channels: sourceKeys.has("tiktok") || sourceKeys.has("pinterest")
              ? "TikTok oder Pinterest"
              : "weitere Quellen",
          })
      : topOpp?.rejected
        ? copy.avoid
        : copy.observe;

  const fullText = [whatFound, whyInteresting, milaeneFit, shouldAct]
    .filter(Boolean)
    .join(" ");

  return { whatFound, whyInteresting, milaeneFit, shouldAct, fullText };
}

export function humanizeInsightDetail(
  detail: string,
  sourceKeys: string[],
): string {
  const copy = getIntelligenceCopy(DEFAULT_LOCALE).human;
  if (/weighted|cluster|contribution|score \d/i.test(detail)) {
    const parts: string[] = [];
    if (sourceKeys.includes("google_trends")) parts.push(copy.googleTrendsRising);
    if (sourceKeys.includes("shopify")) parts.push(copy.shopifySales);
    if (sourceKeys.length >= 2) parts.push(copy.multiSourceSupport);
    if (parts.length > 0) return parts.join(" ");
  }
  return detail
    .replace(/Weighted commerce signal/gi, copy.weightedCommerce.replace("{source}", "Commerce"))
    .replace(/Catalog gap detected/gi, "Lücke im Sortiment erkannt")
    .replace(/Support Milaene/gi, copy.supportsMilaene);
}

function dedupeStrings(values: string[]): string[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = value.toLowerCase().trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export { dedupeStrings };
