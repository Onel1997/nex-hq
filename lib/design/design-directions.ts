import type { DesignStudioBrief, DesignStudioColor } from "@/agents/design/studio-brief";
import type { DesignConcept } from "@/lib/design/ai-designer/types";

export interface DesignDirectionScores {
  commercial: number;
  originality: number;
  printComplexity: number;
  conversionPotential: number;
  luxury: number;
}

export interface DesignDirection {
  id: string;
  title: string;
  designStory: string;
  fashionLanguage: string;
  mood: string;
  typography: string;
  printStyle: string;
  thumbnailColors: string[];
  variantIndex: number;
  scores: DesignDirectionScores;
  archived: boolean;
  selected: boolean;
}

const DIRECTION_ARCHETYPES = [
  {
    title: "Luxury Minimal",
    mood: "Quiet luxury",
    typography: "Refined sans",
    printStyle: "DTG fine line",
    fashionKeywords: ["quiet luxury", "editorial restraint", "premium basics"],
  },
  {
    title: "Modern Typography",
    mood: "Type-led",
    typography: "Architectural hero",
    printStyle: "Screen bold",
    fashionKeywords: ["hero type", "graphic fashion", "statement lettering"],
  },
  {
    title: "Editorial Streetwear",
    mood: "Culture-forward",
    typography: "Compressed grotesk",
    printStyle: "Oversized DTG",
    fashionKeywords: ["street editorial", "youth culture", "drop energy"],
  },
  {
    title: "Graphic Fashion",
    mood: "Iconographic",
    typography: "Mixed hierarchy",
    printStyle: "Spot color",
    fashionKeywords: ["symbol system", "graphic identity", "visual hook"],
  },
  {
    title: "Premium Vintage",
    mood: "Heritage luxe",
    typography: "Serif accent",
    printStyle: "Vintage wash",
    fashionKeywords: ["heritage craft", "vintage luxury", "timeless appeal"],
  },
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

function buildThumbnailColors(
  brief: DesignStudioBrief,
  index: number,
): string[] {
  const palette = brief.colorPalette.length > 0
    ? brief.colorPalette.map((entry, i) => resolveColorHex(entry, ["#1a1f2e", "#141820", "#d9b46b"][i] ?? brief.color))
    : [brief.color, "#1a1f2e", "#d9b46b"];
  const rotated = [...palette.slice(index % palette.length), ...palette.slice(0, index % palette.length)];
  return rotated.slice(0, 3);
}

function buildDesignStory(
  archetype: (typeof DIRECTION_ARCHETYPES)[number],
  concept: DesignConcept,
): string {
  const snippet = concept.designStory.split(/[.!?]/)[0]?.trim();
  return snippet ?? concept.creativeDirection.summary;
}

function buildFashionLanguage(
  archetype: (typeof DIRECTION_ARCHETYPES)[number],
  concept: DesignConcept,
): string {
  const principles = concept.fashionLanguage.principles.slice(0, 2).join(" · ");
  return `${archetype.fashionKeywords.join(" · ")}${principles ? ` · ${principles}` : ""}`;
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
    conversionPotential: Math.round(score.commercialPotential ?? score.premiumFeeling ?? healthFallback.conversionPotential),
    luxury: Math.round(score.luxury ?? score.premiumFeeling ?? healthFallback.luxury),
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
  };
}

export async function generateDesignDirections(
  brief: DesignStudioBrief,
  concept: DesignConcept,
): Promise<DesignDirection[]> {
  const count = pickDirectionCount(brief, concept);
  const archetypes = DIRECTION_ARCHETYPES.slice(0, count);

  const directions = await Promise.all(
    archetypes.map(async (archetype, index) => {
      let scores = fallbackScores(brief, index);

      try {
        const res = await fetch("/api/design/commercial-review", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ brief, variantIndex: index }),
        });
        if (res.ok) {
          const data = (await res.json()) as { score?: Record<string, number> };
          scores = mapCommercialScores(data.score, scores);
        }
      } catch {
        /* keep fallback scores */
      }

      return {
        id: crypto.randomUUID(),
        title: archetype.title,
        designStory: buildDesignStory(archetype, concept),
        fashionLanguage: buildFashionLanguage(archetype, concept),
        mood: archetype.mood,
        typography: archetype.typography,
        printStyle: archetype.printStyle,
        thumbnailColors: buildThumbnailColors(brief, index),
        variantIndex: index,
        scores,
        archived: false,
        selected: false,
      } satisfies DesignDirection;
    }),
  );

  return directions.sort((a, b) => b.scores.commercial - a.scores.commercial);
}

export function selectDesignDirection(
  directions: DesignDirection[],
  directionId: string,
): DesignDirection[] {
  return directions.map((direction) => ({
    ...direction,
    selected: direction.id === directionId,
    archived: direction.id !== directionId,
  }));
}

export function resolveSelectedDirection(
  directions: DesignDirection[] | undefined,
): DesignDirection | undefined {
  return directions?.find((direction) => direction.selected);
}

export function archiveDesignDirection(
  directions: DesignDirection[],
  directionId: string,
): DesignDirection[] {
  return directions.map((direction) =>
    direction.id === directionId ? { ...direction, archived: true, selected: false } : direction,
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
  };
  return [...directions, copy];
}
