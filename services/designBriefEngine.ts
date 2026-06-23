import { MILAENE_DNA } from "@/services/milaene-dna";
import type { ResearchDesignBrief } from "@/lib/research/types";
import type { ResearchIntelligenceBundle } from "@/services/researchEngine";
import type { ResearchOutput, DesignResearchOutput } from "@/agents/research/types";
import {
  findProductByTitle,
  resolveAvailableColors,
  resolveAvailableProducts,
} from "@/services/productIntelligenceEngine";

function isDesignReport(
  report: Partial<ResearchOutput> | Partial<DesignResearchOutput> | undefined,
): report is Partial<DesignResearchOutput> {
  return (
    report != null &&
    "designs" in report &&
    Array.isArray(report.designs) &&
    report.designs.length > 0
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function averageCompetitorThreat(competitors: ResearchIntelligenceBundle["competitors"]): number {
  if (competitors.length === 0) return 50;
  const statusWeight: Record<string, number> = {
    watching: 65,
    tracked: 55,
    analyzing: 70,
    stable: 40,
  };
  const sum = competitors.reduce(
    (acc, c) => acc + (statusWeight[c.status] ?? 50),
    0,
  );
  return Math.round(sum / competitors.length);
}

function buildColorPalette(
  opportunity: ResearchIntelligenceBundle["opportunities"][0],
  bundle: ResearchIntelligenceBundle,
): ResearchDesignBrief["colorPalette"] {
  const catalog = bundle.productIntelligence;
  const resolvedColors = resolveAvailableColors(
    catalog,
    opportunity.colors,
    opportunity.decisions.products,
  );

  const oppColors = resolvedColors.map((name, i) => ({
    name,
    role: i === 0 ? "primary" : i === 1 ? "secondary" : "accent",
  }));

  if (oppColors.length >= 2) {
    return oppColors.slice(0, 5);
  }

  const dnaColors = resolveAvailableColors(catalog, [...MILAENE_DNA.colors]).map(
    (c) => ({
      name: capitalize(c),
      role: "brand-core",
    }),
  );

  return [...oppColors, ...dnaColors].slice(0, 5);
}

function resolveRecommendedMaterials(
  intelligence: ResearchIntelligenceBundle,
  productTitles: string[],
): string[] {
  const materials = new Set<string>();

  for (const title of productTitles) {
    const product = findProductByTitle(intelligence.productIntelligence, title);
    for (const material of product?.materials ?? []) {
      materials.add(material);
    }
  }

  if (materials.size === 0) {
    return intelligence.productIntelligence.allMaterials.slice(0, 4);
  }

  return [...materials];
}

function resolveRecommendedPrintAreas(
  intelligence: ResearchIntelligenceBundle,
  productTitles: string[],
): string[] {
  const areas = new Set<string>();

  for (const title of productTitles) {
    const product = findProductByTitle(intelligence.productIntelligence, title);
    for (const area of product?.printAreas ?? []) {
      areas.add(area);
    }
  }

  if (areas.size === 0) {
    return intelligence.productIntelligence.allPrintAreas.slice(0, 4);
  }

  return [...areas];
}

export interface DesignBriefInput {
  intelligence: ResearchIntelligenceBundle;
  report?: Partial<ResearchOutput> | Partial<DesignResearchOutput>;
  sourceReportId?: string;
}

/** Generate a structured design brief for Design Studio handoff. */
export function generateDesignBrief(input: DesignBriefInput): ResearchDesignBrief {
  const { intelligence, report, sourceReportId } = input;
  const designReport = isDesignReport(report) ? report : null;
  const classicReport =
    !designReport && report ? (report as Partial<ResearchOutput>) : undefined;
  const featured =
    intelligence.opportunities.find((o) => o.featured) ??
    intelligence.opportunities[0];

  const collectionIdea =
    designReport?.collectionIdea ??
    report?.title ??
    featured?.title ??
    intelligence.recommendation.nextCollection;

  const targetAudience =
    featured?.decisions.targetAudience ??
    classicReport?.competitorReport?.targetAudience?.slice(0, 120) ??
    `Milaene Zielgruppe: ${MILAENE_DNA.audience} — ${MILAENE_DNA.positioning}`;

  const topTrend = intelligence.trends
    .filter((t) => t.direction === "up")
    .sort((a, b) => b.change - a.change)[0];

  const trendScore = featured?.scores.trendScore ?? topTrend?.dnaMatch ?? 85;
  const socialScore =
    featured?.scores.socialScore ??
    intelligence.signalLayers.connectorScores.socialScore;
  const demandScore =
    featured?.scores.demandScore ??
    intelligence.signalLayers.connectorScores.demandScore;
  const competitorScore =
    featured?.scores.competitionScore ??
    100 - averageCompetitorThreat(intelligence.competitors);

  const redditMode = intelligence.external.reddit.mode;
  const trendsMode = intelligence.external.googleTrends.mode;
  const intelligenceMode =
    redditMode === "live" || trendsMode === "live" ? "live" : "simulated";

  const connectorScores = {
    socialScore: intelligence.signalLayers.connectorScores.socialScore,
    demandScore: intelligence.signalLayers.connectorScores.demandScore,
    trendScore: intelligence.signalLayers.connectorScores.trendScore,
    confidence: intelligence.signalLayers.connectorScores.confidence,
  };

  const styleDirection = [
    MILAENE_DNA.style,
    MILAENE_DNA.silhouettes.join(", "),
    designReport?.designs?.join(", "),
    featured?.decisions.designs.join(", "),
    classicReport?.trendReport?.designImplications?.[0],
  ]
    .filter(Boolean)
    .join(" · ");

  const rationale =
    designReport?.rationale ??
    classicReport?.executiveSummary?.slice(0, 300) ??
    featured?.rationale ??
    intelligence.recommendation.rationale;

  const confidence =
    (designReport?.confidence != null
      ? Math.round(designReport.confidence * 100)
      : undefined) ??
    featured?.scores.estimatedPotential ??
    Math.round(
      ((featured?.confidence ?? 80) + trendScore + competitorScore) / 3,
    );

  const rawProductSuggestions =
    designReport?.products ??
    featured?.decisions.products ??
    featured?.products ??
    intelligence.recommendation.recommendedProducts;

  const productSuggestions = resolveAvailableProducts(
    intelligence.productIntelligence,
    rawProductSuggestions,
  ).slice(0, 8);

  const recommendedProducts =
    productSuggestions.length > 0
      ? productSuggestions
      : intelligence.productIntelligence.bestsellers
          .slice(0, 4)
          .map((p) => p.title);
  const recommendedColors = resolveAvailableColors(
    intelligence.productIntelligence,
    designReport?.colors ?? featured?.colors ?? [],
    recommendedProducts,
  );
  const recommendedMaterials =
    designReport?.materials ??
    resolveRecommendedMaterials(intelligence, recommendedProducts);
  const recommendedPrintAreas =
    designReport?.printAreas ??
    resolveRecommendedPrintAreas(intelligence, recommendedProducts);

  return {
    collectionIdea,
    productSuggestions,
    recommendedProducts,
    recommendedColors,
    recommendedMaterials,
    recommendedPrintAreas,
    targetAudience,
    colorPalette: featured
      ? buildColorPalette(featured, intelligence)
      : resolveAvailableColors(
          intelligence.productIntelligence,
          [...MILAENE_DNA.colors],
        ).map((c, i) => ({
          name: capitalize(c),
          role: i === 0 ? "primary" : "brand-core",
        })),
    styleDirection,
    silhouettes: [...MILAENE_DNA.silhouettes],
    trendScore,
    socialScore,
    demandScore,
    competitorScore,
    confidence,
    connectorScores,
    intelligenceMode,
    rationale,
    opportunityId: featured?.id,
    sourceReportId,
    designs: designReport?.designs ?? featured?.decisions.designs,
    priority: featured?.decisions.priority,
    generatedAt: new Date().toISOString(),
  };
}
