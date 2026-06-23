import { MILAENE_DNA } from "@/services/milaene-dna";
import type { ResearchDesignBrief } from "@/lib/research/types";
import type { ResearchIntelligenceBundle } from "@/services/researchEngine";
import type { ResearchOutput } from "@/agents/research/types";

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
  const oppColors = opportunity.colors.map((name, i) => ({
    name,
    role: i === 0 ? "primary" : i === 1 ? "secondary" : "accent",
  }));

  const dnaColors = MILAENE_DNA.colors.slice(0, 2).map((c) => ({
    name: capitalize(c),
    role: "brand-core",
  }));

  return [...oppColors, ...dnaColors].slice(0, 5);
}

export interface DesignBriefInput {
  intelligence: ResearchIntelligenceBundle;
  report?: Partial<ResearchOutput>;
  sourceReportId?: string;
}

/** Generate a structured design brief for Design Studio handoff. */
export function generateDesignBrief(input: DesignBriefInput): ResearchDesignBrief {
  const { intelligence, report, sourceReportId } = input;
  const featured =
    intelligence.opportunities.find((o) => o.featured) ??
    intelligence.opportunities[0];

  const collectionIdea =
    report?.title ??
    featured?.title ??
    intelligence.recommendation.nextCollection;

  const targetAudience =
    featured?.decisions.targetAudience ??
    report?.competitorReport?.targetAudience?.slice(0, 120) ??
    `Milaene Zielgruppe: ${MILAENE_DNA.audience} — ${MILAENE_DNA.positioning}`;

  const topTrend = intelligence.trends
    .filter((t) => t.direction === "up")
    .sort((a, b) => b.change - a.change)[0];

  const trendScore = featured?.scores.trendScore ?? topTrend?.dnaMatch ?? 85;
  const competitorScore =
    featured?.scores.competitionScore ??
    100 - averageCompetitorThreat(intelligence.competitors);

  const styleDirection = [
    MILAENE_DNA.style,
    MILAENE_DNA.silhouettes.join(", "),
    featured?.decisions.designs.join(", "),
    report?.trendReport?.designImplications?.[0],
  ]
    .filter(Boolean)
    .join(" · ");

  const rationale =
    report?.executiveSummary?.slice(0, 300) ??
    featured?.rationale ??
    intelligence.recommendation.rationale;

  const confidence =
    featured?.scores.estimatedPotential ??
    Math.round(
      ((featured?.confidence ?? 80) + trendScore + competitorScore) / 3,
    );

  const productSuggestions =
    featured?.decisions.products ??
    featured?.products ??
    intelligence.recommendation.recommendedProducts;

  return {
    collectionIdea,
    productSuggestions,
    targetAudience,
    colorPalette: featured
      ? buildColorPalette(featured, intelligence)
      : MILAENE_DNA.colors.map((c, i) => ({
          name: capitalize(c),
          role: i === 0 ? "primary" : "brand-core",
        })),
    styleDirection,
    silhouettes: [...MILAENE_DNA.silhouettes],
    trendScore,
    competitorScore,
    confidence,
    rationale,
    opportunityId: featured?.id,
    sourceReportId,
    designs: featured?.decisions.designs,
    priority: featured?.decisions.priority,
    generatedAt: new Date().toISOString(),
  };
}
