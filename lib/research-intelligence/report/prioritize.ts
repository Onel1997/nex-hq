import { getSourceWeightProfile } from "../confidence/source-weights";
import type { BrandIntelligenceSection } from "../brand-intelligence/types";
import { DEFAULT_LOCALE } from "@/lib/i18n/config";
import { formatIntelligenceTemplate, getIntelligenceCopy } from "../copy";
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

function findNextStep(
  title: string,
  cards: ReportRecommendationCard[],
): string {
  const normalized = title.toLowerCase();
  for (const card of cards) {
    if (
      card.title.toLowerCase().includes(normalized) ||
      normalized.includes(card.title.toLowerCase().slice(0, 12))
    ) {
      return card.suggestedNextStep;
    }
  }
  return cards[0]?.suggestedNextStep ?? "";
}

export function buildPrioritizedOpportunities(
  intelligence: UnifiedResearchIntelligence,
  brandIntelligence: BrandIntelligenceSection | null | undefined,
  cards: ReportRecommendationCard[],
): ReportPrioritizedOpportunity[] {
  if (!brandIntelligence) return [];

  const opportunities = [
    ...brandIntelligence.topOpportunities,
    ...brandIntelligence.rejectedOpportunities.slice(0, 2),
  ];

  const seen = new Set<string>();
  const result: ReportPrioritizedOpportunity[] = [];

  for (const opp of opportunities) {
    const key = opp.title.toLowerCase().trim();
    if (seen.has(key)) continue;
    seen.add(key);

    const designCard = cards.find(
      (card) =>
        card.title.toLowerCase().includes(key) ||
        key.includes(card.title.toLowerCase().replace(/^explore "|" as a design direction$/g, "")),
    );
    const productCard = cards.find((card) => card.title.toLowerCase().includes(key));

    result.push({
      id: opp.id,
      trend: opp.title,
      brandFit: opp.brandFit,
      trendScore: opp.trendScore,
      commercialPotential: opp.commercialPotential,
      whyRecommended: opp.reasons[0] ?? opp.matches.join(", "),
      nextStep:
        findNextStep(opp.title, cards) ||
        (opp.rejected
          ? opp.rejectionReasons[0] ?? ""
          : "Im Design Studio weiterentwickeln und gegen Milaene-Guardrails prüfen."),
      sourceKeys: opp.sourceKeys,
      prioritySignal: priorityFromOpportunity(
        opp.brandFit,
        opp.trendScore,
        opp.rejected,
        opp.launchPriority,
      ),
      productHint: productCard?.title ?? null,
      designDirection: designCard?.title ?? null,
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

  const topOpp = brandIntelligence?.topOpportunities[0];
  const terms = topOpp?.title ?? reasoning.trendSignificance[0]?.replace(/.*?:\s*/, "") ?? "aktuelle Trendsignale";
  const sourceKeys = new Set(
    intelligence.manifest.contributions.map((item) => String(item.sourceKey)),
  );

  const whatFound = formatIntelligenceTemplate(copy.trendRising, { terms });
  const whyParts: string[] = [];
  if (sourceKeys.has("shopify")) whyParts.push(copy.shopifyConfirms);
  if (sourceKeys.has("google_trends")) whyParts.push(copy.googleTrendsConfirms);
  if (intelligence.manifest.providerCount >= 3) whyParts.push(copy.multiSource);
  const whyInteresting = whyParts.length > 0 ? whyParts.join(" ") : reasoning.narratives[0] ?? whatFound;

  const brandFit = brandIntelligence?.brandFitScore ?? reasoning.brandFit.score;
  const milaeneFit =
    brandFit >= 70
      ? copy.brandAligned
      : brandFit >= 55
        ? copy.brandPartial
        : copy.brandWeak;

  const shouldAct =
    topOpp?.launchPriority === "A" || (topOpp && topOpp.brandFit >= 70)
      ? copy.actNow
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
