import type { DesignStudioBrief } from "@/agents/design/studio-brief";
import type { DesignConcept } from "@/lib/design/ai-designer/types";
import {
  generateMockDesignDirections,
  regenerateMockDesignDirection,
} from "@/lib/design/studio-mock-data";
import {
  activateMockModeFromFailure,
  activateMockModeFromNetworkFailure,
  getMockModeActive,
} from "@/lib/design/studio-mock-mode";

export interface DesignDirectionScores {
  commercial: number;
  originality: number;
  printComplexity: number;
  conversionPotential: number;
  luxury: number;
  manufacturingDifficulty: number;
  virality: number;
  brandFit: number;
  collectionFit: number;
}

export interface TeamInsight {
  role: string;
  focus: string;
  insight: string;
}

export interface DesignDirection {
  id: string;
  title: string;
  philosophy: string;
  designStory: string;
  fashionLanguage: string;
  mood: string;
  typography: string;
  printStyle: string;
  colorSystem: string;
  composition: string;
  targetAudience: string;
  trendAlignment: string;
  thumbnailColors: string[];
  variantIndex: number;
  scores: DesignDirectionScores;
  teamInsights: TeamInsight[];
  archived: boolean;
  selected: boolean;
  compareSelected?: boolean;
}

export type EvolutionAction =
  | "more-luxury"
  | "reduce-typography"
  | "increase-emotion"
  | "more-premium"
  | "more-editorial"
  | "more-graphic"
  | "more-minimal"
  | "more-vintage"
  | "version-2"
  | "version-3"
  | "alt-composition";

interface DirectionsApiContext {
  reportId: string;
  brief: DesignStudioBrief;
  concept: DesignConcept;
}

async function fetchDirectionsFromApi(
  context: DirectionsApiContext,
  options?: { mode?: "generate" | "regenerate"; variantIndex?: number; avoidTitles?: string[] },
): Promise<DesignDirection[] | null> {
  try {
    const res = await fetch("/api/design/directions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: options?.mode ?? "generate",
        reportId: context.reportId,
        brief: context.brief,
        concept: context.concept,
        avoidTitles: options?.avoidTitles,
        variantIndex: options?.variantIndex,
      }),
    });

    const data = (await res.json()) as {
      ok?: boolean;
      error?: string;
      directions?: DesignDirection[];
      direction?: DesignDirection;
    };

    if (!res.ok || !data.ok) {
      activateMockModeFromFailure(res.status, data);
      return null;
    }

    if (options?.mode === "regenerate" && data.direction) {
      return [data.direction];
    }

    return data.directions ?? [];
  } catch (error) {
    activateMockModeFromNetworkFailure(error);
    return null;
  }
}

export async function generateDesignDirections(
  brief: DesignStudioBrief,
  concept: DesignConcept,
  reportId: string,
): Promise<DesignDirection[]> {
  if (getMockModeActive()) {
    return generateMockDesignDirections(brief, concept);
  }

  const directions = await fetchDirectionsFromApi(
    { reportId, brief, concept },
    { mode: "generate", avoidTitles: [] },
  );

  if (directions?.length) {
    return directions.sort((a, b) => b.scores.commercial - a.scores.commercial);
  }

  if (getMockModeActive()) {
    return generateMockDesignDirections(brief, concept);
  }

  throw new Error("Failed to generate design directions");
}

export async function regenerateDesignDirection(
  brief: DesignStudioBrief,
  concept: DesignConcept,
  directions: DesignDirection[],
  directionId: string,
  reportId: string,
): Promise<DesignDirection[]> {
  const source = directions.find((d) => d.id === directionId);
  if (!source) return directions;

  if (getMockModeActive()) {
    const refreshed = regenerateMockDesignDirection(brief, concept, directions, directionId);
    return directions.map((d) => (d.id === directionId ? refreshed : d));
  }

  const avoidTitles = directions.map((d) => d.title);
  const apiResult = await fetchDirectionsFromApi(
    { reportId, brief, concept },
    {
      mode: "regenerate",
      variantIndex: source.variantIndex,
      avoidTitles,
    },
  );

  const refreshed = apiResult?.[0];
  if (!refreshed) {
    if (getMockModeActive()) {
      const mockRefreshed = regenerateMockDesignDirection(brief, concept, directions, directionId);
      return directions.map((d) =>
        d.id === directionId
          ? {
              ...mockRefreshed,
              id: d.id,
              selected: d.selected,
              archived: d.archived,
              compareSelected: d.compareSelected,
            }
          : d,
      );
    }
    throw new Error("Failed to regenerate design direction");
  }

  return directions.map((d) =>
    d.id === directionId
      ? {
          ...refreshed,
          id: d.id,
          selected: d.selected,
          archived: d.archived,
          compareSelected: d.compareSelected,
        }
      : d,
  );
}

export function selectDesignDirection(
  directions: DesignDirection[],
  directionId: string,
): DesignDirection[] {
  return directions.map((direction) => ({
    ...direction,
    selected: direction.id === directionId,
  }));
}

export function toggleDirectionCompare(
  directions: DesignDirection[],
  directionId: string,
): DesignDirection[] {
  return directions.map((direction) =>
    direction.id === directionId
      ? { ...direction, compareSelected: !direction.compareSelected }
      : direction,
  );
}

export function clearDirectionCompare(directions: DesignDirection[]): DesignDirection[] {
  return directions.map((direction) => ({ ...direction, compareSelected: false }));
}

export function resolveSelectedDirection(
  directions: DesignDirection[] | undefined,
): DesignDirection | undefined {
  return directions?.find((direction) => direction.selected);
}

export function resolveCompareDirections(
  directions: DesignDirection[] | undefined,
): DesignDirection[] {
  return directions?.filter((d) => d.compareSelected && !d.archived) ?? [];
}

export function archiveDesignDirection(
  directions: DesignDirection[],
  directionId: string,
): DesignDirection[] {
  return directions.map((direction) =>
    direction.id === directionId
      ? { ...direction, archived: true, selected: false, compareSelected: false }
      : direction,
  );
}

export function duplicateDesignDirection(
  directions: DesignDirection[],
  directionId: string,
): DesignDirection[] {
  const source = directions.find((direction) => direction.id === directionId);
  if (!source) return directions;
  const copy: DesignDirection = {
    ...source,
    id: crypto.randomUUID(),
    title: `${source.title} Copy`,
    selected: false,
    archived: false,
    compareSelected: false,
  };
  return [...directions, copy];
}

export function blendDesignDirections(
  directions: DesignDirection[],
  primaryId: string,
  secondaryId: string,
): DesignDirection[] {
  const primary = directions.find((d) => d.id === primaryId);
  const secondary = directions.find((d) => d.id === secondaryId);
  if (!primary || !secondary) return directions;

  const blended: DesignDirection = {
    ...primary,
    id: crypto.randomUUID(),
    title: `${primary.title} × ${secondary.title}`,
    philosophy: `Hybrid of ${primary.title} and ${secondary.title} — ${primary.philosophy.split("—")[0]} meets ${secondary.philosophy.split("—")[0]}.`,
    designStory: `${primary.designStory} Infused with ${secondary.mood} energy from ${secondary.title}.`,
    fashionLanguage: `${primary.fashionLanguage} · ${secondary.mood}`,
    mood: `${primary.mood} / ${secondary.mood}`,
    typography: `${primary.typography} + ${secondary.typography}`,
    printStyle: primary.printStyle,
    colorSystem: `${primary.colorSystem} with ${secondary.colorSystem} accents`,
    composition: `${primary.composition} blended with ${secondary.composition}`,
    thumbnailColors: [
      primary.thumbnailColors[0],
      secondary.thumbnailColors[1] ?? secondary.thumbnailColors[0],
      primary.thumbnailColors[2] ?? secondary.thumbnailColors[2],
    ],
    scores: {
      commercial: Math.round((primary.scores.commercial + secondary.scores.commercial) / 2),
      originality: Math.round((primary.scores.originality + secondary.scores.originality) / 2 + 5),
      printComplexity: Math.round(
        (primary.scores.printComplexity + secondary.scores.printComplexity) / 2,
      ),
      conversionPotential: Math.round(
        (primary.scores.conversionPotential + secondary.scores.conversionPotential) / 2,
      ),
      luxury: Math.round((primary.scores.luxury + secondary.scores.luxury) / 2),
      manufacturingDifficulty: Math.round(
        (primary.scores.manufacturingDifficulty + secondary.scores.manufacturingDifficulty) / 2,
      ),
      virality: Math.round((primary.scores.virality + secondary.scores.virality) / 2),
      brandFit: Math.round((primary.scores.brandFit + secondary.scores.brandFit) / 2),
      collectionFit: Math.round((primary.scores.collectionFit + secondary.scores.collectionFit) / 2),
    },
    teamInsights: primary.teamInsights.map((insight, i) => ({
      ...insight,
      insight: `${insight.insight} Cross-pollinated with ${secondary.teamInsights[i]?.role ?? "peer"} perspective.`,
    })),
    selected: false,
    archived: false,
    compareSelected: false,
    variantIndex: primary.variantIndex,
  };

  return [...directions, blended];
}

const EVOLUTION_MODIFIERS: Record<
  EvolutionAction,
  Partial<Pick<DesignDirection, "title" | "philosophy" | "mood" | "typography" | "printStyle">>
> = {
  "more-luxury": {
    mood: "Elevated quiet luxury",
    philosophy: "Amplified luxury signals — every detail whispers premium.",
  },
  "reduce-typography": {
    typography: "Minimal type accents",
    philosophy: "Typography recedes — visual form takes precedence.",
  },
  "increase-emotion": {
    mood: "Emotionally charged",
    philosophy: "Deeper emotional resonance — the garment tells a personal story.",
  },
  "more-premium": {
    mood: "Ultra-premium",
    printStyle: "Embroidery + foil accents",
    philosophy: "Maximum premium positioning — haute craft execution.",
  },
  "more-editorial": {
    mood: "High-fashion editorial",
    typography: "Magazine-grade type hierarchy",
    philosophy: "Editorial authority — as seen in Vogue, worn on street.",
  },
  "more-graphic": {
    mood: "Bold graphic energy",
    typography: "Graphic-forward mixed hierarchy",
    philosophy: "Graphic intensity dialed up — unmistakable visual identity.",
  },
  "more-minimal": {
    mood: "Radical minimalism",
    typography: "Single-weight refined sans",
    philosophy: "Stripped to essence — nothing extraneous remains.",
  },
  "more-vintage": {
    mood: "Deep heritage",
    typography: "Vintage serif + distressed accents",
    philosophy: "Heritage depth amplified — time-worn authenticity.",
  },
  "version-2": { title: undefined },
  "version-3": { title: undefined },
  "alt-composition": {
    philosophy: "Alternative composition — same identity, fresh spatial arrangement.",
  },
};

export function evolveDesignDirection(
  directions: DesignDirection[],
  directionId: string,
  action: EvolutionAction,
): DesignDirection[] {
  const source = directions.find((d) => d.id === directionId);
  if (!source) return directions;

  const modifier = EVOLUTION_MODIFIERS[action];
  const versionSuffix =
    action === "version-2" ? " V2" : action === "version-3" ? " V3" : ` · ${action.replace(/-/g, " ")}`;

  const evolved: DesignDirection = {
    ...source,
    id: crypto.randomUUID(),
    title: modifier.title ?? `${source.title}${versionSuffix}`,
    philosophy: modifier.philosophy ?? source.philosophy,
    mood: modifier.mood ?? source.mood,
    typography: modifier.typography ?? source.typography,
    printStyle: modifier.printStyle ?? source.printStyle,
    composition:
      action === "alt-composition"
        ? `Alternative layout — ${source.composition}`
        : source.composition,
    designStory: `${source.designStory} Evolved: ${modifier.philosophy ?? action.replace(/-/g, " ")}.`,
    scores: {
      ...source.scores,
      originality: Math.min(98, source.scores.originality + 3),
    },
    selected: true,
    archived: false,
    compareSelected: false,
  };

  return [
    ...directions.map((d) => ({ ...d, selected: false })),
    evolved,
  ];
}

export function buildDirectionBrief(direction: DesignDirection): string {
  return [
    `Direction: ${direction.title}`,
    `Philosophy: ${direction.philosophy}`,
    `Story: ${direction.designStory}`,
    `Fashion Language: ${direction.fashionLanguage}`,
    `Mood: ${direction.mood}`,
    `Typography: ${direction.typography}`,
    `Print: ${direction.printStyle}`,
    `Color System: ${direction.colorSystem}`,
    `Composition: ${direction.composition}`,
    `Target Audience: ${direction.targetAudience}`,
    `Trend: ${direction.trendAlignment}`,
  ].join("\n");
}

export interface DirectionComparisonResult {
  metrics: Array<{
    key: string;
    label: string;
    values: number[];
    winnerIndex: number;
  }>;
  overallWinnerIndex: number;
}

export function compareDirections(directions: DesignDirection[]): DirectionComparisonResult {
  const metricDefs = [
    { key: "luxury", label: "Luxury" },
    { key: "originality", label: "Originality" },
    { key: "commercial", label: "Commercial" },
    { key: "printComplexity", label: "Print" },
    { key: "virality", label: "Virality" },
    { key: "manufacturingDifficulty", label: "Manufacturing" },
    { key: "brandFit", label: "Brand Fit" },
    { key: "collectionFit", label: "Collection Fit" },
  ] as const;

  const metrics = metricDefs.map(({ key, label }) => {
    const values = directions.map((d) => d.scores[key]);
    const isLowerBetter = key === "manufacturingDifficulty" || key === "printComplexity";
    const winnerIndex = isLowerBetter
      ? values.indexOf(Math.min(...values))
      : values.indexOf(Math.max(...values));
    return { key, label, values, winnerIndex };
  });

  const winCounts = directions.map(() => 0);
  for (const metric of metrics) {
    winCounts[metric.winnerIndex] += 1;
  }
  const overallWinnerIndex = winCounts.indexOf(Math.max(...winCounts));

  return { metrics, overallWinnerIndex };
}
