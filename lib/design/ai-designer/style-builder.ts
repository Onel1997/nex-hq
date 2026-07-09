import type { DesignStudioBrief } from "@/agents/design/studio-brief";
import type { CreativeDirectorDecision } from "@/lib/design/design-knowledge/art-direction/creative-director";
import type { EmotionalDirectorDecision } from "@/lib/design/design-knowledge/emotional-language/types";
import type {
  CreativeDirectionSpec,
  OrnamentLanguageProfile,
  SymbolLanguageProfile,
  TypographyLanguageProfile,
} from "@/lib/design/ai-designer/types";
import { getEmotionalLanguage } from "@/lib/design/design-knowledge/emotional-language/emotion-library";
import { getHeroTypographyDirection } from "@/lib/design/design-knowledge/hero-typography/hero-library";
import type { HeroTypographyDirectorDecision } from "@/lib/design/design-knowledge/hero-typography/types";

/** Build creative direction summary from mood, emotion, and collection. */
export function buildCreativeDirection(
  brief: DesignStudioBrief,
  creativeDirector: CreativeDirectorDecision,
  emotion?: EmotionalDirectorDecision,
  collectionMood?: string,
): CreativeDirectionSpec {
  const primaryEmotion = emotion
    ? getEmotionalLanguage(emotion.primary)?.mood ?? emotion.primary
    : brief.visualConcept.split("—")[0]?.trim() ?? "editorial calm";

  return {
    summary: `${brief.title} — ${brief.visualConcept}`,
    mood: collectionMood ?? creativeDirector.collection.name,
    emotion: primaryEmotion,
    collectionRole: brief.role,
    visualIntent: brief.designDescription,
    fashionSystem: creativeDirector.fashionPrinciples
      .slice(0, 3)
      .map((p) => p.name)
      .join(" · "),
  };
}

export function buildTypographyLanguage(
  brief: DesignStudioBrief,
  creativeDirector: CreativeDirectorDecision,
  heroDirection?: HeroTypographyDirectorDecision,
): TypographyLanguageProfile {
  const typo = creativeDirector.typography;
  const direction = heroDirection
    ? getHeroTypographyDirection(heroDirection.direction)
    : null;

  const concepts = direction?.concepts ?? ["multi-scale-hierarchy", "editorial-headline"];
  const shareTarget = heroDirection
    ? `${Math.round(heroDirection.compositionShareTarget * 100)}% composition share`
    : "55–70% for hero/statement roles";

  const behaviors = emotionTypographyBehaviors(brief);

  return {
    direction: direction?.name ?? typo.meta.family,
    concepts: concepts.map((c) => c.replace(/-/g, " ")),
    hierarchy: direction?.hierarchy ?? "layered editorial",
    behaviors,
    compositionShare: shareTarget,
    headlineTreatment: brief.typography || "cropped stacked headline with ghost layer and micro subline",
  };
}

function emotionTypographyBehaviors(brief: DesignStudioBrief): string[] {
  const text = `${brief.typography} ${brief.visualConcept}`.toLowerCase();
  const behaviors: string[] = [];
  if (text.includes("ghost")) behaviors.push("ghost offset layer");
  if (text.includes("crop")) behaviors.push("cropped hero word");
  if (text.includes("stack")) behaviors.push("stacked editorial headline");
  if (text.includes("micro") || text.includes("coordinate")) behaviors.push("micro coordinates");
  if (behaviors.length === 0) behaviors.push("editorial multi-scale hierarchy");
  return behaviors;
}

export function buildSymbolLanguage(
  creativeDirector: CreativeDirectorDecision,
  brief: DesignStudioBrief,
): SymbolLanguageProfile {
  const symbol = creativeDirector.symbol;
  const elements = brief.visualElements.filter((e) =>
    !e.toLowerCase().includes("headline") && !e.toLowerCase().includes("type"),
  );

  return {
    system: `${symbol.meta.family} (${symbol.meta.name})`,
    primarySymbols: elements.length > 0 ? elements.slice(0, 4) : [symbol.meta.family],
    secondaryGeometry: brief.geometry.split(",").map((g) => g.trim()).filter(Boolean).slice(0, 5),
    restraint: "one dominant symbol system — secondary geometry supports, never competes",
  };
}

export function buildOrnamentLanguage(
  creativeDirector: CreativeDirectorDecision,
  emotion?: EmotionalDirectorDecision,
): OrnamentLanguageProfile {
  const ornament = creativeDirector.ornament;
  const density = emotion
    ? getEmotionalLanguage(emotion.primary)?.ornamentDensity ?? "sparse"
    : "sparse";

  return {
    system: `${ornament.meta.family} (${ornament.meta.name})`,
    elements: ornament.meta.tags.length > 0 ? ornament.meta.tags : ["rule-lines", "coordinates", "micro-lines"],
    density,
    restraint: "premium restraint — ornaments whisper, never shout",
  };
}
