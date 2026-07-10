import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/config";
import type { ConfidenceIntelligence } from "../types/confidence";
import { CONFIDENCE_SCORE_IDS } from "../types/confidence";
import { formatIntelligenceTemplate, getIntelligenceCopy, scoreLabel } from "./index";

/** Applies German score labels and normalizes tier vocabulary in rationales. */
export function localizeConfidenceIntelligence(
  confidence: ConfidenceIntelligence,
  locale: Locale = DEFAULT_LOCALE,
): ConfidenceIntelligence {
  const copy = getIntelligenceCopy(locale);
  const scores = { ...confidence.scores };

  for (const id of CONFIDENCE_SCORE_IDS) {
    const score = scores[id];
    if (!score) continue;
    scores[id] = {
      ...score,
      label: scoreLabel(id, locale),
      rationale: localizeTierWords(score.rationale, locale),
      evidence: score.evidence.map((item) => ({
        ...item,
        label: localizeEvidenceLabel(item.label, copy),
      })),
    };
  }

  return {
    ...confidence,
    scores,
    caveats: confidence.caveats.map((caveat) => localizeCaveat(caveat, copy)),
  };
}

function localizeTierWords(text: string, locale: Locale): string {
  const tiers = getIntelligenceCopy(locale).tiers;
  return text
    .replace(/\blow\b/gi, tiers.low)
    .replace(/\bmedium\b/gi, tiers.medium)
    .replace(/\bhigh\b/gi, tiers.high)
    .replace(/\bverified\b/gi, tiers.verified);
}

function localizeEvidenceLabel(
  label: string,
  copy: ReturnType<typeof getIntelligenceCopy>,
): string {
  const rising = label.match(/^(\d+) rising\/emerging trend clusters$/);
  if (rising) {
    return formatIntelligenceTemplate(copy.confidence.evidence.risingClusters, {
      count: rising[1],
    });
  }
  const positive = label.match(/^(\d+) positive directional signals$/);
  if (positive) {
    return formatIntelligenceTemplate(copy.confidence.evidence.positiveSignals, {
      count: positive[1],
    });
  }
  const negative = label.match(/^(\d+) negative directional signals$/);
  if (negative) {
    return formatIntelligenceTemplate(copy.confidence.evidence.negativeSignals, {
      count: negative[1],
    });
  }
  const shopify = label.match(/^(\d+) Shopify commercial-truth signals$/);
  if (shopify) {
    return formatIntelligenceTemplate(copy.confidence.evidence.shopifySignals, {
      count: shopify[1],
    });
  }
  const demand = label.match(/^(\d+) demand indicators$/);
  if (demand) {
    return formatIntelligenceTemplate(copy.confidence.evidence.demandIndicators, {
      count: demand[1],
    });
  }
  const products = label.match(/^(\d+) product insights$/);
  if (products) {
    return formatIntelligenceTemplate(copy.confidence.evidence.productInsights, {
      count: products[1],
    });
  }
  const commerce = label.match(/^(\d+) commerce-validation signals$/);
  if (commerce) {
    return formatIntelligenceTemplate(copy.confidence.evidence.commerceValidation, {
      count: commerce[1],
    });
  }
  if (label === "Composite of trend, commercial, and brand-fit confidence") {
    return copy.confidence.evidence.launchComposite;
  }
  if (label === "Agreement and diversity modifiers") {
    return copy.confidence.evidence.agreementDiversity;
  }
  const headroom = label.match(/^Saturation headroom \((\d+)\)$/);
  if (headroom) {
    return formatIntelligenceTemplate(copy.confidence.evidence.saturationHeadroom, {
      headroom: headroom[1],
    });
  }
  return label;
}

function localizeCaveat(
  caveat: string,
  copy: ReturnType<typeof getIntelligenceCopy>,
): string {
  if (caveat === "No provider intelligence fused — confidence scores are baseline zero.") {
    return copy.confidence.noProvidersBaseline;
  }
  return caveat;
}
