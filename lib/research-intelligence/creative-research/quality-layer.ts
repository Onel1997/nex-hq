/**
 * Creative Quality Layer — idea-level gates + phrase quality + catalog checks.
 */

import { isCatalogProductReference } from "../pattern-intelligence/catalog-filter";
import {
  evaluatePhraseQuality,
  isGenericPhrase,
  isNearDuplicatePhrase,
  normalizePhrase,
  phraseSimilarity,
} from "./phrase-quality";
import type {
  CreativeQualityVerdict,
  DesignIdea,
  WeeklyDesignIdeasInput,
} from "./types";

export {
  GENERIC_PHRASE_BLACKLIST,
  evaluatePhraseQuality,
  isGenericPhrase,
  isNearDuplicatePhrase,
  isWeakPhraseFragment,
  normalizePhrase,
  phraseSimilarity,
  alternativesHaveStructuralVariety,
} from "./phrase-quality";

export function isNearDuplicateConcept(a: string, b: string, threshold = 0.5): boolean {
  return phraseSimilarity(a, b) >= threshold;
}

export function matchesCatalogProductName(
  titleOrPhrase: string,
  catalogTitles: string[],
): boolean {
  if (catalogTitles.length === 0) return false;
  if (isCatalogProductReference(titleOrPhrase, catalogTitles)) return true;
  const normalized = normalizePhrase(titleOrPhrase);
  return catalogTitles.some((title) => {
    const catalogNorm = normalizePhrase(title);
    if (!catalogNorm) return false;
    return (
      normalized === catalogNorm ||
      phraseSimilarity(normalized, catalogNorm) >= 0.72 ||
      (catalogNorm.length >= 8 && normalized.includes(catalogNorm))
    );
  });
}

function scoreWearability(idea: Pick<DesignIdea, "designConcept" | "placement" | "graphicElements">): number {
  const blob = `${idea.designConcept} ${idea.placement} ${idea.graphicElements.join(" ")}`.toLowerCase();
  let score = 70;
  if (/leerraum|negative space|klein|subtle|restrained|zurückhalt|hierarchie/.test(blob)) score += 12;
  if (/überladen|full coverage|all-over|laut|neon|maximal/.test(blob)) score -= 25;
  if (/brust|chest|rücken|back|sleeve|ärmel/.test(blob)) score += 8;
  if (/nicht hinzufügen|nicht ergänzen|vermeiden|leer bleiben/.test(blob)) score += 6;
  return Math.max(0, Math.min(100, score));
}

export function evaluateDesignIdeaQuality(
  idea: DesignIdea,
  options: {
    siblings?: DesignIdea[];
    catalogProductTitles?: string[];
    phraseLanguage?: "de" | "en";
    exclusions?: string[];
    recentPhrases?: string[];
  } = {},
): CreativeQualityVerdict {
  const catalogTitles = options.catalogProductTitles ?? [];
  const siblings = options.siblings ?? [];
  const failures: string[] = [];
  const reasons: string[] = [];

  const phraseQuality =
    idea.phraseQuality ??
    evaluatePhraseQuality(idea.primaryPhrase, {
      meaning: idea.meaning,
      recentPhrases: options.recentPhrases,
      alternatives: idea.alternativePhrases,
    });

  const genericPhraseHit = isGenericPhrase(idea.primaryPhrase) || !phraseQuality.passed;
  const catalogCopyHit =
    matchesCatalogProductName(idea.designTitle, catalogTitles) ||
    matchesCatalogProductName(idea.primaryPhrase, catalogTitles) ||
    idea.alternativePhrases.some((phrase) => matchesCatalogProductName(phrase, catalogTitles));

  if (!phraseQuality.passed) {
    failures.push(...phraseQuality.rejectionReasons);
  } else {
    reasons.push("Spruch besteht Phrase-Quality-Gate");
  }

  if (catalogCopyHit) {
    failures.push("Idee entspricht einem bestehenden Katalog- oder Produktnamen");
  }

  if (idea.alternativePhrases.length < 3) {
    failures.push("Weniger als drei alternative Sprüche");
  }

  if (!idea.wearReason || idea.wearReason.trim().length < 20) {
    failures.push("Wear-Reason fehlt oder ist zu kurz");
  }

  if (idea.designConcept.trim().length < 120) {
    failures.push("Designkonzept zu generisch / zu kurz für manuelle Umsetzung");
  } else if (
    !/hierarchie|maßstab|cm|leer|nicht|vermeiden|beziehung|skal/i.test(idea.designConcept)
  ) {
    failures.push("Designkonzept fehlt Hierarchie-, Leerflächen- oder Verbotsangaben");
  } else {
    reasons.push("Designkonzept ist umsetzungsreif spezifiziert");
  }

  for (const sibling of siblings) {
    if (sibling.id === idea.id) continue;
    if (isNearDuplicatePhrase(idea.primaryPhrase, sibling.primaryPhrase)) {
      failures.push(`Nahezu identischer Spruch zu „${sibling.primaryPhrase}“`);
    }
    if (isNearDuplicateConcept(idea.designConcept, sibling.designConcept)) {
      failures.push(`Nahezu identisches Designkonzept zu „${sibling.designTitle}“`);
    }
    if (idea.visualStructure === sibling.visualStructure) {
      failures.push(`Gleiche Visual Structure wie „${sibling.designTitle}“`);
    }
    if (idea.emotionalTheme.toLowerCase() === sibling.emotionalTheme.toLowerCase()) {
      failures.push(`Gleiches emotionales Theme wie „${sibling.designTitle}“`);
    }
  }

  const exclusions = options.exclusions ?? [];
  const exclusionBlob = normalizePhrase(
    [idea.primaryPhrase, idea.designConcept, idea.emotionalDirection, ...idea.graphicElements].join(
      " ",
    ),
  );
  for (const exclusion of exclusions) {
    const ex = normalizePhrase(exclusion);
    if (ex && exclusionBlob.includes(ex)) {
      failures.push(`Enthält ausgeschlossenes Motiv/Thema: ${exclusion}`);
    }
  }

  const originality = phraseQuality.originalityScore;
  const wearability = scoreWearability(idea);
  const clarity = phraseQuality.semanticClarityScore;
  const emotionalImpact = phraseQuality.campaignPotentialScore;
  const brandFit = idea.brandFitScore;
  const visualFeasibility = idea.designConcept.length >= 120 ? 80 : 45;
  const languageQuality = phraseQuality.phraseStrengthScore;

  if (wearability < 50) failures.push("Geringe Tragbarkeit / zu überladene visuelle Richtung");
  if (brandFit < 55) failures.push("Unzureichender Milaene Brand Fit");

  const passed =
    failures.length === 0 &&
    phraseQuality.passed &&
    wearability >= 50 &&
    brandFit >= 55 &&
    visualFeasibility >= 45;

  return {
    passed,
    originality,
    wearability,
    clarity,
    emotionalImpact,
    brandFit,
    visualFeasibility,
    languageQuality,
    genericPhraseHit,
    catalogCopyHit,
    phraseQuality,
    reasons,
    failures,
  };
}

export function dedupeDesignIdeas(ideas: DesignIdea[]): DesignIdea[] {
  const kept: DesignIdea[] = [];
  for (const idea of ideas) {
    const duplicate = kept.some(
      (existing) =>
        isNearDuplicatePhrase(idea.primaryPhrase, existing.primaryPhrase) ||
        isNearDuplicateConcept(idea.designConcept, existing.designConcept) ||
        existing.visualStructure === idea.visualStructure,
    );
    if (!duplicate) kept.push(idea);
  }
  return kept;
}

export function filterQualityDesignIdeas(
  ideas: DesignIdea[],
  input: Pick<WeeklyDesignIdeasInput, "catalogProductTitles" | "phraseLanguage" | "exclusions"> & {
    recentPhrases?: string[];
  },
): DesignIdea[] {
  const accepted: DesignIdea[] = [];
  for (const idea of ideas) {
    const verdict = evaluateDesignIdeaQuality(idea, {
      siblings: accepted,
      catalogProductTitles: input.catalogProductTitles,
      phraseLanguage: input.phraseLanguage,
      exclusions: input.exclusions,
      recentPhrases: input.recentPhrases,
    });
    if (verdict.passed) {
      accepted.push({
        ...idea,
        phraseQuality: verdict.phraseQuality,
        originalityNotes: [idea.originalityNotes, ...verdict.reasons.slice(0, 2)]
          .filter(Boolean)
          .join(" · "),
        brandFitScore: Math.round((idea.brandFitScore + verdict.brandFit) / 2),
      });
    }
  }
  return dedupeDesignIdeas(accepted);
}
