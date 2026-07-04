import type { DesignStudioBrief, DesignStudioColor } from "@/agents/design/studio-brief";
import type { DesignConcept } from "@/lib/design/ai-designer/types";

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

interface DirectionArchetype {
  title: string;
  philosophy: string;
  mood: string;
  typography: string;
  printStyle: string;
  fashionKeywords: string[];
  composition: string;
  colorSystem: string;
  targetAudience: string;
  trendAlignment: string;
  storyAngle: string;
}

const DIRECTION_ARCHETYPES: DirectionArchetype[] = [
  {
    title: "Luxury Minimal",
    philosophy: "Quiet luxury through editorial restraint — every element earns its place.",
    mood: "Quiet luxury",
    typography: "Refined sans hierarchy",
    printStyle: "DTG fine line",
    fashionKeywords: ["quiet luxury", "editorial restraint", "premium basics"],
    composition: "Centered focal with generous negative space",
    colorSystem: "Monochrome base with single accent",
    targetAudience: "Affluent minimalists, 28–45",
    trendAlignment: "Quiet luxury / stealth wealth",
    storyAngle: "A garment that whispers rather than shouts — precision tailoring meets graphic restraint.",
  },
  {
    title: "Editorial Typography",
    philosophy: "Type as hero — architectural letterforms become the collection's visual signature.",
    mood: "Type-led editorial",
    typography: "Architectural hero type",
    printStyle: "Screen bold",
    fashionKeywords: ["hero type", "editorial fashion", "statement lettering"],
    composition: "Oversized headline with supporting micro-type",
    colorSystem: "High-contrast black/white with accent pop",
    targetAudience: "Culture-forward creatives, 22–35",
    trendAlignment: "Typography-first street editorial",
    storyAngle: "The word becomes the garment — bold typographic architecture commands attention on every scroll.",
  },
  {
    title: "Graphic Narrative",
    philosophy: "Visual storytelling through iconography — symbols carry the collection's mythology.",
    mood: "Iconographic narrative",
    typography: "Mixed hierarchy accents",
    printStyle: "Spot color + DTG",
    fashionKeywords: ["symbol system", "graphic identity", "visual hook"],
    composition: "Layered symbol field with narrative flow",
    colorSystem: "Multi-tone palette with symbolic color coding",
    targetAudience: "Streetwear collectors, 18–30",
    trendAlignment: "Graphic maximalism / culture drops",
    storyAngle: "A visual language built from symbols — each mark tells part of a larger cultural story.",
  },
  {
    title: "Vintage Heritage",
    philosophy: "Heritage craft reimagined — timeless luxury signals with contemporary edge.",
    mood: "Heritage luxe",
    typography: "Serif accent + vintage script",
    printStyle: "Vintage wash + embroidery",
    fashionKeywords: ["heritage craft", "vintage luxury", "timeless appeal"],
    composition: "Classic crest placement with ornamental framing",
    colorSystem: "Washed earth tones with gold accents",
    targetAudience: "Heritage enthusiasts, 30–50",
    trendAlignment: "Heritage revival / craft luxury",
    storyAngle: "Time-worn elegance meets modern street — heritage motifs recontextualized for today's collector.",
  },
  {
    title: "Fashion Art",
    philosophy: "Wearable art object — the garment becomes a canvas for avant-garde expression.",
    mood: "Gallery-worthy",
    typography: "Experimental display type",
    printStyle: "All-over sublimation",
    fashionKeywords: ["wearable art", "avant-garde", "gallery piece"],
    composition: "Full-bleed artistic composition",
    colorSystem: "Expressive multi-chromatic palette",
    targetAudience: "Art-fashion crossover, 25–40",
    trendAlignment: "Art-fashion collab / NFT culture",
    storyAngle: "Not merchandise — a wearable art piece that belongs in a gallery as much as on the street.",
  },
];

const TEAM_ROLES = [
  { role: "Research Director", focus: "Trend Intelligence" },
  { role: "Creative Director", focus: "Visual Story" },
  { role: "Typography Director", focus: "Typography hierarchy" },
  { role: "Fashion Designer", focus: "Garment composition" },
  { role: "Commercial Director", focus: "Conversion analysis" },
  { role: "Print Engineer", focus: "Production feasibility" },
] as const;

function hashSeed(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function pickDirectionCount(brief: DesignStudioBrief, concept: DesignConcept): number {
  const seed = hashSeed(`${brief.designId}:${concept.designId}`);
  return 3 + (seed % 3);
}

function resolveColorHex(entry: DesignStudioColor | string, fallback: string): string {
  if (typeof entry === "string") return entry;
  return entry.hex ?? fallback;
}

function buildThumbnailColors(brief: DesignStudioBrief, index: number): string[] {
  const palette =
    brief.colorPalette.length > 0
      ? brief.colorPalette.map((entry, i) =>
          resolveColorHex(entry, ["#1a1f2e", "#141820", "#d9b46b"][i] ?? brief.color),
        )
      : [brief.color, "#1a1f2e", "#d9b46b"];
  const rotated = [
    ...palette.slice(index % palette.length),
    ...palette.slice(0, index % palette.length),
  ];
  return rotated.slice(0, 3);
}

function buildDesignStory(archetype: DirectionArchetype, concept: DesignConcept): string {
  const collection = concept.collection || concept.title;
  return `${archetype.storyAngle} Built for ${collection} — ${concept.creativeDirection.visualIntent}.`;
}

function buildFashionLanguage(archetype: DirectionArchetype, concept: DesignConcept): string {
  const principles = concept.fashionLanguage.principles.slice(0, 2).join(" · ");
  return `${archetype.fashionKeywords.join(" · ")}${principles ? ` · ${principles}` : ""}`;
}

function buildTeamInsights(
  archetype: DirectionArchetype,
  concept: DesignConcept,
  scores: DesignDirectionScores,
  review?: {
    psychology?: string;
    brandDna?: string;
    critique?: string;
  },
): TeamInsight[] {
  const insights: Record<string, string> = {
    "Research Director": `${archetype.trendAlignment} aligns with current market momentum — ${archetype.targetAudience} segment shows strong purchase intent.`,
    "Creative Director": archetype.storyAngle,
    "Typography Director": `${archetype.typography} — ${concept.typographyLanguage.hierarchy} with ${concept.typographyLanguage.compositionShare} composition share.`,
    "Fashion Designer": `${archetype.composition} on ${concept.product}. ${concept.fashionLanguage.garmentScale} scale with ${concept.fashionLanguage.luxurySignals.slice(0, 2).join(" and ")} signals.`,
    "Commercial Director":
      review?.psychology ??
      `Conversion potential at ${scores.conversionPotential}% — ${concept.commercialIntention.buyerHook}.`,
    "Print Engineer": `${archetype.printStyle} production — complexity ${scores.printComplexity}%, manufacturing difficulty ${scores.manufacturingDifficulty}%.`,
  };

  if (review?.brandDna) {
    insights["Commercial Director"] = `${review.brandDna} Brand fit: ${scores.brandFit}%.`;
  }
  if (review?.critique) {
    insights["Creative Director"] = review.critique;
  }

  return TEAM_ROLES.map(({ role, focus }) => ({
    role,
    focus,
    insight: insights[role] ?? `${focus} analysis complete.`,
  }));
}

function mapCommercialScores(
  score: Record<string, number> | undefined,
  healthFallback: DesignDirectionScores,
): DesignDirectionScores {
  if (!score) return healthFallback;
  return {
    commercial: Math.round(score.overall ?? score.commercialPotential ?? healthFallback.commercial),
    originality: Math.round(score.originality ?? healthFallback.originality),
    printComplexity: Math.round(100 - (score.printQuality ?? 70)),
    conversionPotential: Math.round(
      score.commercialPotential ?? score.premiumFeeling ?? healthFallback.conversionPotential,
    ),
    luxury: Math.round(score.luxury ?? score.premiumFeeling ?? healthFallback.luxury),
    manufacturingDifficulty: Math.round(
      score.productionComplexity ?? healthFallback.manufacturingDifficulty,
    ),
    virality: Math.round(score.virality ?? score.socialAppeal ?? healthFallback.virality),
    brandFit: Math.round(score.brandAlignment ?? score.brandDna ?? healthFallback.brandFit),
    collectionFit: Math.round(score.collectionFit ?? healthFallback.collectionFit),
  };
}

function fallbackScores(brief: DesignStudioBrief, index: number): DesignDirectionScores {
  const base = brief.commercialScore ?? 72;
  const dna = brief.dnaScore ?? 70;
  const drift = (index - 2) * 4;
  return {
    commercial: Math.max(55, Math.min(98, base + drift)),
    originality: Math.max(50, Math.min(96, dna + drift + 2)),
    printComplexity: Math.max(18, Math.min(85, 48 + index * 7)),
    conversionPotential: Math.max(52, Math.min(95, base - 3 + index * 5)),
    luxury: Math.max(58, Math.min(97, dna + 4 + drift)),
    manufacturingDifficulty: Math.max(20, Math.min(90, 35 + index * 8)),
    virality: Math.max(45, Math.min(92, 60 + drift + index * 3)),
    brandFit: Math.max(55, Math.min(95, dna + 2)),
    collectionFit: Math.max(50, Math.min(94, base - 5 + index * 4)),
  };
}

async function fetchCommercialReview(
  brief: DesignStudioBrief,
  variantIndex: number,
): Promise<{
  score?: Record<string, number>;
  psychology?: string;
  brandDna?: string;
  critique?: string;
} | null> {
  try {
    const res = await fetch("/api/design/commercial-review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brief, variantIndex }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      score?: Record<string, number>;
      psychology?: string;
      brandDna?: string;
      critique?: string;
    };
    return data;
  } catch {
    return null;
  }
}

async function buildDirection(
  archetype: DirectionArchetype,
  index: number,
  brief: DesignStudioBrief,
  concept: DesignConcept,
): Promise<DesignDirection> {
  let scores = fallbackScores(brief, index);
  const review = await fetchCommercialReview(brief, index);
  if (review?.score) {
    scores = mapCommercialScores(review.score, scores);
  }

  return {
    id: crypto.randomUUID(),
    title: archetype.title,
    philosophy: archetype.philosophy,
    designStory: buildDesignStory(archetype, concept),
    fashionLanguage: buildFashionLanguage(archetype, concept),
    mood: archetype.mood,
    typography: archetype.typography,
    printStyle: archetype.printStyle,
    colorSystem: archetype.colorSystem,
    composition: archetype.composition,
    targetAudience: archetype.targetAudience,
    trendAlignment: archetype.trendAlignment,
    thumbnailColors: buildThumbnailColors(brief, index),
    variantIndex: index,
    scores,
    teamInsights: buildTeamInsights(archetype, concept, scores, review ?? undefined),
    archived: false,
    selected: false,
    compareSelected: false,
  };
}

export async function generateDesignDirections(
  brief: DesignStudioBrief,
  concept: DesignConcept,
): Promise<DesignDirection[]> {
  const count = pickDirectionCount(brief, concept);
  const archetypes = DIRECTION_ARCHETYPES.slice(0, count);

  const directions = await Promise.all(
    archetypes.map((archetype, index) => buildDirection(archetype, index, brief, concept)),
  );

  return directions.sort((a, b) => b.scores.commercial - a.scores.commercial);
}

export async function regenerateDesignDirection(
  brief: DesignStudioBrief,
  concept: DesignConcept,
  directions: DesignDirection[],
  directionId: string,
): Promise<DesignDirection[]> {
  const source = directions.find((d) => d.id === directionId);
  if (!source) return directions;

  const archetype = DIRECTION_ARCHETYPES[source.variantIndex] ?? DIRECTION_ARCHETYPES[0];
  const refreshed = await buildDirection(archetype, source.variantIndex, brief, concept);

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
