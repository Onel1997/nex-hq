import { MILAENE_BRAND_PROFILE } from "../confidence/brand-profile";
import { getSourceWeightProfile } from "../confidence/source-weights";
import { extractColorTerms, rankOpportunityTerms } from "../fusion/weighted-fusion";
import { resolveProductTarget } from "../pattern-intelligence/product-target";
import { parseStructuredMaterials } from "../pattern-intelligence/material-parser";
import { DESIGN_STUDIO_MISSION } from "../pattern-intelligence/types";
import type { PatternIntelligenceSection } from "../pattern-intelligence/types";
import {
  graphicThemeForTerms,
  typographyDirectionForTerms,
} from "../recommendation/rules";
import type { BrandIntelligenceSection, ScoredOpportunity } from "../brand-intelligence/types";
import type { ResearchReasoningIntelligence } from "../types/reasoning";
import type { UnifiedResearchIntelligence } from "../types/unified";
import { deriveConceptName } from "./concept-naming";
import {
  CREATIVE_BRIEF_NEXT_STEP,
  CREATIVE_BRIEF_VERSION,
  type ResearchCreativeBrief,
} from "./types";

const DEFAULT_COLORS = ["Black", "Cream", "Stone", "Grey"];
const DEFAULT_MATERIALS = ["280 GSM", "100% Cotton"];
const DEFAULT_PRINT = ["Screen Print", "Embroidery"];
const DEFAULT_AUDIENCE = ["18–30", "Premium Streetwear", "Minimal Luxury"];

function capitalizeTerm(term: string): string {
  return term
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function pickAnchorOpportunity(
  brandIntelligence: BrandIntelligenceSection,
): ScoredOpportunity | null {
  const approved = brandIntelligence.topOpportunities;
  if (approved.length === 0) return null;
  return [...approved].sort((a, b) => b.brandFit - a.brandFit || b.trendScore - a.trendScore)[0];
}

function collectCorpus(
  anchor: ScoredOpportunity,
  brandIntelligence: BrandIntelligenceSection,
  intelligence: UnifiedResearchIntelligence,
  reasoning: ResearchReasoningIntelligence,
): string {
  const terms = rankOpportunityTerms(intelligence).slice(0, 6).map((term) => term.term);
  return [
    anchor.title,
    ...anchor.matches,
    ...brandIntelligence.matches,
    ...reasoning.brandFit.alignedSignals,
    ...terms,
    ...intelligence.brand.culturalSignals,
  ].join(" ");
}

function deriveTypography(corpus: string, intelligence: UnifiedResearchIntelligence): string[] {
  const fromRec = intelligence.recommendations.items.find(
    (item) => item.type === "typography_direction",
  );
  if (fromRec) {
    const parts = fromRec.why
      .replace(/^Brand-fit.*map to:\s*/i, "")
      .split(/[—–-]/)
      .map((part) => part.trim())
      .filter(Boolean);
    if (parts.length > 0) {
      return parts.slice(0, 2).map((part) => capitalizeTerm(part));
    }
  }

  const direction = typographyDirectionForTerms(corpus.split(/\s+/));
  if (!direction) return ["Minimal Sans", "Technical Serif"];

  if (/grotesk|sans/i.test(direction)) return ["Minimal Sans"];
  if (/serif|editorial/i.test(direction)) return ["Technical Serif", "Editorial Serif"];
  return ["Minimal Sans", "Technical Serif"];
}

function deriveGraphicDirection(corpus: string, intelligence: UnifiedResearchIntelligence): string[] {
  const fromRec = intelligence.recommendations.items.find(
    (item) => item.type === "graphic_theme",
  );
  if (fromRec) {
    const theme = fromRec.title.replace(/^Graphic theme:\s*/i, "").trim();
    if (theme) {
      return theme
        .split(/[,;]/)
        .map((part) => capitalizeTerm(part.trim()))
        .filter(Boolean)
        .slice(0, 3);
    }
  }

  const theme = graphicThemeForTerms(corpus.split(/\s+/));
  if (/emblem|symbol/i.test(theme)) return ["Symbolic", "Minimal"];
  if (/archive|texture/i.test(theme)) return ["Architectural", "Minimal"];
  if (/restraint|negative/i.test(theme)) return ["Minimal", "Symbolic"];
  return ["Architectural", "Symbolic", "Minimal"];
}

function deriveColorPalette(
  intelligence: UnifiedResearchIntelligence,
  brandIntelligence: BrandIntelligenceSection,
): string[] {
  const fromRec = intelligence.recommendations.items.find(
    (item) => item.type === "color_palette",
  );
  if (fromRec) {
    const match = fromRec.title.match(/Color palette direction:\s*(.+)/i);
    if (match?.[1]) {
      return match[1]
        .split(",")
        .map((color) => capitalizeTerm(color.trim()))
        .filter(Boolean)
        .slice(0, 5);
    }
  }

  const extracted = extractColorTerms(intelligence).slice(0, 4).map((color) =>
    capitalizeTerm(color.term),
  );
  if (extracted.length >= 2) return extracted;

  const fromMatches = brandIntelligence.matches
    .filter((match) =>
      MILAENE_BRAND_PROFILE.colorPalette.some((color) =>
        match.toLowerCase().includes(color),
      ),
    )
    .map(capitalizeTerm);

  if (fromMatches.length > 0) {
    return [...new Set([...fromMatches, ...DEFAULT_COLORS])].slice(0, 5);
  }

  return DEFAULT_COLORS;
}

function derivePlacement(anchor: ScoredOpportunity, graphicDirection: string[]): string[] {
  const corpus = [...anchor.matches, ...graphicDirection].join(" ").toLowerCase();
  if (/embroidery|emblem|symbol/i.test(corpus)) {
    return ["Large back print", "Small chest embroidery"];
  }
  if (/minimal|small|restraint/i.test(corpus)) {
    return ["Small chest embroidery", "Minimal back print"];
  }
  return ["Large back print", "Small chest embroidery"];
}

function deriveProducts(anchor: ScoredOpportunity): {
  recommended: string;
  alternatives: string[];
} {
  const corpus = anchor.title.toLowerCase();
  if (/hoodie|fleece|sweat/i.test(corpus)) {
    return {
      recommended: "Heavyweight Hoodie",
      alternatives: ["Oversized T-Shirt"],
    };
  }
  return {
    recommended: "Oversized T-Shirt",
    alternatives: ["Heavyweight Hoodie"],
  };
}

function deriveAvoid(
  brandIntelligence: BrandIntelligenceSection,
  anchor: ScoredOpportunity,
): string[] {
  const blocked = [
    ...brandIntelligence.conflicts,
    ...anchor.conflicts,
    ...MILAENE_BRAND_PROFILE.lowMatch.slice(0, 4),
    ...MILAENE_BRAND_PROFILE.notRecommended.slice(0, 4),
  ]
    .map(capitalizeTerm)
    .filter(Boolean);

  const defaults = ["Neon", "Large front graphics", "Anime", "Cargo styling"];
  return [...new Set([...blocked, ...defaults])].slice(0, 8);
}

function deriveResearchEvidence(
  intelligence: UnifiedResearchIntelligence,
  anchor: ScoredOpportunity,
): string[] {
  const keys = new Set<string>([
    ...anchor.sourceKeys,
    ...intelligence.manifest.contributions.map((item) => String(item.sourceKey)),
  ]);

  return [...keys]
    .map((key) => getSourceWeightProfile(key).label)
    .filter(Boolean)
    .slice(0, 8);
}

function buildExecutiveSummary(
  conceptName: string,
  anchor: ScoredOpportunity,
  scores: ResearchCreativeBrief["scores"],
  reasoning: ResearchReasoningIntelligence,
): string {
  const narrative = reasoning.narratives[0];
  if (narrative) {
    return `${conceptName} führt diesen Zyklus an, weil ${narrative} Brand Fit ${scores.brandFit}/100 und Trend Score ${scores.trendScore}/100 es gegenüber alternativen Richtungen für Milaene priorisieren.`;
  }
  return `${conceptName} bietet die höchste Erfolgswahrscheinlichkeit im aktuellen Intelligence-Zyklus. Brand Fit ${scores.brandFit}/100 bestätigt die Milaene-Ausrichtung, während Trend Score ${scores.trendScore}/100 Marktmomentum validiert — ohne die Quiet-Luxury-Positionierung zu verwässern.`;
}

function buildBusinessCase(
  conceptName: string,
  anchor: ScoredOpportunity,
  scores: ResearchCreativeBrief["scores"],
  brandIntelligence: BrandIntelligenceSection,
): string {
  const catalogNote = brandIntelligence.shopifyLearning.loaded
    ? "Shopify-Katalogsignale stärken die Sortimentspassung."
    : "Katalogvalidierung sollte vor Produktionsskalierung gegen Shopify abgesichert werden.";

  return `Milaene kann Premium-Streetwear-Nachfrage über ${conceptName} bedienen, ohne die Markenidentität zu verwässern. Commercial Potential ${scores.commercialPotential}/100 unterstützt margenstarke Umsetzung auf Kernsilhouetten, während Competition ${scores.competition}/100 Spielraum für Differenzierung durch Zurückhaltung statt Volumen lässt. ${catalogNote} ${anchor.reasons[0] ?? "Brand Intelligence bestätigt Quiet-Luxury-Ausrichtung."}`;
}

function buildProductionNotes(
  printTechnique: string[],
  materialRecommendation: string[],
): string {
  const techniques = printTechnique.join(" and ");
  const materials = materialRecommendation.join(", ");
  return `Für POD auf ${materials} geeignet. ${techniques} empfohlen für Premium-Haptik ohne überladene Grafikdichte.`;
}

export function buildResearchCreativeBrief(input: {
  intelligence: UnifiedResearchIntelligence;
  reasoning: ResearchReasoningIntelligence;
  brandIntelligence: BrandIntelligenceSection;
  patternIntelligence?: PatternIntelligenceSection | null;
  generatedAt: string;
  userRequest?: string;
}): ResearchCreativeBrief | null {
  const anchor = pickAnchorOpportunity(input.brandIntelligence);
  if (!anchor || anchor.brandFit < 40) return null;

  const pattern = input.patternIntelligence;
  const designLanguage = pattern?.designLanguage;
  const silhouette = resolveProductTarget({
    userRequest: input.userRequest,
    patternSilhouette: designLanguage?.silhouette?.join(" "),
    intelligenceCorpus: anchor.title,
  });
  const alternatives =
    pattern?.alternativeSilhouettes ??
    ["Heavyweight Hoodie", "Zip Hoodie", "Long Sleeve"].filter((t) => t !== silhouette);

  const corpus = collectCorpus(
    anchor,
    input.brandIntelligence,
    input.intelligence,
    input.reasoning,
  );
  const conceptName = deriveConceptName(corpus, anchor.title);
  const graphicDirection =
    designLanguage?.graphicStyle ?? deriveGraphicDirection(corpus, input.intelligence);
  const typographyDirection =
    designLanguage?.typography ?? deriveTypography(corpus, input.intelligence);
  const colorPalette =
    designLanguage?.palette ??
    designLanguage?.colorWorld ??
    deriveColorPalette(input.intelligence, input.brandIntelligence);
  const recommendedPlacement =
    designLanguage?.placement ?? derivePlacement(anchor, graphicDirection);
  const printTechnique =
    designLanguage?.printTechnique?.length
      ? designLanguage.printTechnique
      : [...DEFAULT_PRINT];
  const materialRecommendation = parseStructuredMaterials(
    designLanguage?.material?.length
      ? designLanguage.material
      : [...DEFAULT_MATERIALS],
  );
  const avoid = [
    ...deriveAvoid(input.brandIntelligence, anchor),
    ...(designLanguage?.prohibitions ?? []),
    ...(pattern?.catalogProductTitles ?? []).map((title) => `Nicht kopieren: ${title}`),
  ];
  const researchEvidence = deriveResearchEvidence(input.intelligence, anchor);

  const scores = {
    trendScore: anchor.trendScore,
    brandFit: anchor.brandFit,
    commercialPotential: anchor.commercialPotential,
    competition: anchor.competition,
    longevity: anchor.longevity,
    originality: anchor.originality,
    confidence: anchor.confidence,
  };

  const briefDesignLanguage = {
    typography: typographyDirection,
    placement: recommendedPlacement,
    colorWorld: colorPalette,
    graphicStyle: graphicDirection,
    symbolism: designLanguage?.symbolism ?? [],
    material: materialRecommendation,
    printTechnique,
    guardrails: designLanguage?.guardrails ?? [],
    risks: designLanguage?.risks ?? [],
    prohibitions: [...new Set(avoid)].slice(0, 10),
    patternSummary: designLanguage?.patternSummary ?? graphicDirection.join(" · "),
  };

  return {
    version: CREATIVE_BRIEF_VERSION,
    generatedAt: input.generatedAt,
    approved: true,
    conceptName,
    executiveSummary: buildExecutiveSummary(
      conceptName,
      anchor,
      scores,
      input.reasoning,
    ),
    businessCase: buildBusinessCase(conceptName, anchor, scores, input.brandIntelligence),
    scores,
    targetAudience: [...DEFAULT_AUDIENCE],
    recommendedProduct: silhouette,
    alternativeProducts: alternatives,
    recommendedPlacement,
    typographyDirection,
    graphicDirection,
    colorPalette,
    materialRecommendation,
    printTechnique,
    productionNotes: buildProductionNotes(printTechnique, materialRecommendation),
    avoid: [...new Set(avoid)].slice(0, 10),
    researchEvidence,
    nextStep: CREATIVE_BRIEF_NEXT_STEP,
    anchorOpportunityId: anchor.id,
    anchorOpportunityTitle: null,
    missionStatement: DESIGN_STUDIO_MISSION,
    designLanguage: briefDesignLanguage,
    patternSummary: briefDesignLanguage.patternSummary,
  };
}
