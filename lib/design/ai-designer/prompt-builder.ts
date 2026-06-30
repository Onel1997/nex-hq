import type { DesignConcept, MockupPromptSpec, PremiumImagePromptSpec } from "@/lib/design/ai-designer/types";

function joinParts(parts: string[]): string {
  return parts.filter(Boolean).join(". ");
}

/** Build premium image-generation prompts — NOT SVG, NOT vectors. */
export function buildImagePrompts(concept: DesignConcept): PremiumImagePromptSpec {
  const {
    title,
    product,
    color,
    printArea,
    creativeDirection,
    fashionLanguage,
    compositionLanguage,
    typographyLanguage,
    heroFocus,
    negativeSpaceProfile,
    productionNotes,
  } = concept;

  const primary = joinParts([
    `Premium fashion apparel concept for "${title}"`,
    `${product} in ${color}`,
    `${printArea} print placement — ${compositionLanguage.placement}`,
    `Creative direction: ${creativeDirection.summary}`,
    `Fashion mood: ${fashionLanguage.mood} — ${creativeDirection.emotion} emotional tone`,
    `Composition: ${compositionLanguage.pattern}, ${compositionLanguage.focalStrategy}`,
    `Typography: ${typographyLanguage.headlineTreatment}, ${typographyLanguage.behaviors.join(", ")}`,
    `Hero focus: ${heroFocus.dominantElement} — ${heroFocus.scrollStopHook}`,
    `Symbol language: ${concept.symbolLanguage.system}, elements: ${concept.symbolLanguage.primarySymbols.join(", ")}`,
    `Ornament: ${concept.ornamentLanguage.density} density, premium restraint`,
    `Negative space: ${negativeSpaceProfile.targetRatio}, ${negativeSpaceProfile.rules[0]}`,
    `Materials: ${productionNotes.materialEffects}`,
    `Luxury styling: ${fashionLanguage.luxurySignals.slice(0, 3).join("; ")}`,
    "Minimalism, premium streetwear editorial aesthetic",
    "Soft studio lighting, high-end fashion photography",
    "Clean background, garment-focused composition",
    "No vector graphics, no SVG, no flat illustration — photorealistic premium apparel",
  ]);

  const social = joinParts([
    `Instagram-ready premium streetwear flat lay`,
    `${product}, ${color}, ${printArea} graphic`,
    `${heroFocus.scrollStopHook}`,
    `${typographyLanguage.direction} typography, editorial fashion mood`,
    "4:5 aspect, soft natural light, luxury minimal styling",
  ]);

  const campaign = joinParts([
    `Campaign hero image for "${title}" collection`,
    `${creativeDirection.mood} — ${creativeDirection.emotion}`,
    `Model wearing ${product} in ${color}, ${printArea} print visible`,
    `${compositionLanguage.movement}, premium editorial streetwear`,
    "Cinematic soft lighting, muted luxury palette, negative space emphasis",
    "High-end lookbook photography, not merch catalog",
  ]);

  const tags = [
    "premium streetwear",
    "editorial fashion",
    "luxury apparel",
    printArea.toLowerCase(),
    creativeDirection.collectionRole.toLowerCase().replace(/\s+/g, "-"),
    "minimalism",
    "negative-space",
    "garment-scale",
  ];

  return { primary, social, campaign, tags };
}

export function buildMockupPrompts(concept: DesignConcept): MockupPromptSpec {
  const { title, product, color, printArea, productionNotes, fashionLanguage } = concept;

  const primary = joinParts([
    `Premium product mockup: ${product} in ${color}`,
    `Design "${title}" — ${printArea} print`,
    `${productionNotes.placement}, ${productionNotes.dimensions}`,
    `${productionNotes.materialEffects}`,
    "Studio flat lay, soft shadow, luxury streetwear presentation",
    "Photorealistic fabric texture, no vector overlay",
  ]);

  const flatLay = joinParts([
    `Editorial flat lay mockup, ${product}, ${color}`,
    `${printArea} print artwork visible on garment`,
    "Premium fleece/cotton texture, washed luxury hand feel",
    "Minimal props, large negative space, Scandinavian studio aesthetic",
  ]);

  const onModel = joinParts([
    `On-model premium streetwear mockup`,
    `Oversized ${product}, ${color}, ${printArea} graphic`,
    `${fashionLanguage.garmentScale}`,
    "Neutral studio backdrop, editorial pose, soft directional lighting",
    "Campaign-ready, lookbook quality",
  ]);

  const tags = ["mockup", "product-photography", "streetwear", "premium", printArea.toLowerCase()];

  return { primary, flatLay, onModel, tags };
}

export function buildAllPrompts(concept: DesignConcept): {
  imagePrompt: PremiumImagePromptSpec;
  mockupPrompt: MockupPromptSpec;
} {
  return {
    imagePrompt: buildImagePrompts(concept),
    mockupPrompt: buildMockupPrompts(concept),
  };
}
